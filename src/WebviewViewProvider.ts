import * as vscode from 'vscode';
import { getNonce } from './utilities/getNonce';
import { getUri } from './utilities/getUri';
import { Template, pasteTemplateText, sanitizeNameForCommand } from './utilities/templateUtils'; // Import helpers (removed updateTemplatesConfig)

export class TemplatesWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cursor-templates-webview-view'; // Match package.json ID
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext; // Store context
  private _registerCommands: () => void; // Store registerCommands function

  constructor(
    private readonly _extensionUri: vscode.Uri,
    context: vscode.ExtensionContext, // Accept context
    registerCommands: () => void // Accept registerCommands function
  ) {
    this._context = context; // Store context
    this._registerCommands = registerCommands; // Store function
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
          vscode.Uri.joinPath(this._extensionUri, 'out'),
          vscode.Uri.joinPath(this._extensionUri, 'webview-ui/dist')
        ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Listener for messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'getTemplates':
          this.sendTemplatesToWebview();
          return;
        case 'addTemplate':
          await this.handleAddTemplate(message.payload.name, message.payload.text);
          return;
        case 'editTemplate':
           await this.handleEditTemplate(message.payload.originalName, message.payload.newName, message.payload.newText);
           return;
        case 'deleteTemplate':
           // This now relies on the confirmation flow having happened first
           await this.handleDeleteTemplate(message.payload.name);
           return;
        case 'pasteTemplate':
           await this.handlePasteTemplate(message.payload.text);
           return;
        case 'assignKeybinding':
            await this.handleAssignKeybinding(message.payload.name);
            return;
        case 'showError':
            vscode.window.showErrorMessage(message.text);
            return;
        case 'showInfo':
            vscode.window.showInformationMessage(message.text);
            return;
        case 'requestConfirmation': { // Handle confirmation request from webview
          const { message: confirmationMessage, action, data } = message.payload;
          // Use showWarningMessage for confirmation dialogs
          const confirmation = await vscode.window.showWarningMessage(
            confirmationMessage,
            { modal: true }, // Make it modal
            "Yes" // Confirmation option text
          );

          // Send the result back to the webview
          this._view?.webview.postMessage({
            command: 'confirmationResult',
            payload: { confirmed: confirmation === "Yes", action, data }
          });
          return;
        }
      }
    });

     // Send initial data when the view becomes visible or is resolved
     this.sendTemplatesToWebview();

     // Optional: Re-send data if the view visibility changes
     webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
            this.sendTemplatesToWebview();
        }
    });
  }

  // Send current templates to the webview
  public sendTemplatesToWebview() {
    if (this._view) {
      // Read from globalState instead of configuration
      const templates = this._context.globalState.get<Template[]>('cursorTemplates') || [];
      this._view.webview.postMessage({ command: 'updateTemplates', payload: templates });
      console.log('Cursor Templates: Sent templates to webview.');
    } else {
        console.warn('Cursor Templates: Webview not available to send templates to.');
    }
  }

  // --- Message Handlers ---

  private async handleAddTemplate(name: string, text: string) {
      console.log('Webview wants to add:', name, text);
      if (!name || !name.trim()) {
          vscode.window.showErrorMessage('Template name cannot be empty.');
          return;
      }
      const trimmedName = name.trim();

      // Read from globalState
      const currentTemplates = this._context.globalState.get<Template[]>('cursorTemplates') || [];

      // Validation: Check for duplicate names
      if (currentTemplates.some(t => t.name === trimmedName)) {
          vscode.window.showErrorMessage(`A template with the name "${trimmedName}" already exists.`);
          return;
      }

      const newTemplate: Template = { name: trimmedName, text: text || '' }; // Allow empty text
      const newTemplates = [...currentTemplates, newTemplate];

      // Write to globalState
      await this._context.globalState.update('cursorTemplates', newTemplates);
      vscode.window.showInformationMessage(`Template "${newTemplate.name}" added.`);
      this.sendTemplatesToWebview(); // Notify webview of the change
      this._registerCommands(); // Re-register commands
  }

  private async handleEditTemplate(originalName: string, newName: string, newText: string) {
      console.log('Webview wants to edit:', originalName, 'to', newName, newText);
      if (!newName || !newName.trim()) {
          vscode.window.showErrorMessage('Template name cannot be empty.');
          return;
      }
      const trimmedNewName = newName.trim();

      // Read from globalState
      const currentTemplates = this._context.globalState.get<Template[]>('cursorTemplates') || [];
      const templateIndex = currentTemplates.findIndex(t => t.name === originalName);

      if (templateIndex === -1) {
          vscode.window.showErrorMessage(`Could not find template "${originalName}" to edit.`);
          return;
      }

      // Validation: Check for duplicate names (excluding the original name if it hasn't changed)
      if (trimmedNewName !== originalName && currentTemplates.some(t => t.name === trimmedNewName)) {
          vscode.window.showErrorMessage(`Another template with the name "${trimmedNewName}" already exists.`);
          return;
      }

      const updatedTemplates = [...currentTemplates];
      updatedTemplates[templateIndex] = { name: trimmedNewName, text: newText || '' }; // Allow empty text

      // Write to globalState
      await this._context.globalState.update('cursorTemplates', updatedTemplates);
      vscode.window.showInformationMessage(`Template "${originalName}" updated to "${trimmedNewName}".`);
      this.sendTemplatesToWebview(); // Notify webview
      this._registerCommands(); // Re-register commands
  }

  private async handleDeleteTemplate(name: string) {
      console.log('Webview wants to delete:', name);
      if (!name) {
          vscode.window.showErrorMessage('Cannot delete template: Name not provided.');
          return;
      }

      // Optional: Add confirmation dialog? The webview UI might handle this.
      // For simplicity here, we proceed directly. Consider adding confirmation in the webview UI.
      // const confirm = await vscode.window.showWarningMessage(
      //     `Are you sure you want to delete the template "${name}"?`,
      //     { modal: true }, 'Yes', 'No'
      // );
      // if (confirm !== 'Yes') { return; }

      // Read from globalState
      const currentTemplates = this._context.globalState.get<Template[]>('cursorTemplates') || [];
      const updatedTemplates = currentTemplates.filter(t => t.name !== name);

      if (updatedTemplates.length === currentTemplates.length) {
           vscode.window.showErrorMessage(`Could not find template "${name}" to delete.`);
           return;
      }

      // Write to globalState
      await this._context.globalState.update('cursorTemplates', updatedTemplates);
      vscode.window.showInformationMessage(`Template "${name}" deleted.`);
      this.sendTemplatesToWebview(); // Notify webview
      this._registerCommands(); // Re-register commands
  }

  private async handlePasteTemplate(text: string) {
      console.log('Webview wants to paste:', text);
      await pasteTemplateText(text);
      // Optional: Show confirmation?
      // vscode.window.showInformationMessage(`Pasting template via webview.`);
  }

  private async handleAssignKeybinding(name: string) {
      console.log('Webview wants to assign keybinding for:', name);
      if (!name) {
          vscode.window.showErrorMessage('Cannot assign keybinding: Template name not provided.');
          return;
      }

      const sanitizedName = sanitizeNameForCommand(name);
      if (!sanitizedName) {
          vscode.window.showErrorMessage(`Cannot assign keybinding for template with invalid sanitized name: "${name}"`);
          return;
      }
      const commandId = `cursor-templates.pasteTemplate.${sanitizedName}`;

      // Check if the command actually exists (it should have been registered by registerCommands in extension.ts)
      const allCommands = await vscode.commands.getCommands(true);
      if (!allCommands.includes(commandId)) {
          vscode.window.showErrorMessage(`Command "${commandId}" not found. This might happen if the template was just added/edited. Try refreshing or restarting VS Code if the issue persists.`);
          // Optionally trigger a re-registration? This might be complex to coordinate.
          // vscode.commands.executeCommand('cursor-templates.internal.reregisterDynamicCommands'); // Example hypothetical command
          return;
      }

      // Open keybindings JSON file
      await vscode.commands.executeCommand('workbench.action.openGlobalKeybindingsFile');

      vscode.commands.executeCommand('workbench.action.openGlobalKeybindings', commandId);
  }


  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Use a nonce for Content Security Policy
    const nonce = getNonce();

    // Get URIs for the React build output
    const scriptUri = getUri(webview, this._extensionUri, ["webview-ui", "dist", "assets", "index.js"]);
    const stylesUri = getUri(webview, this._extensionUri, ["webview-ui", "dist", "assets", "index.css"]);

    console.log('Cursor Templates: Webview Script URI:', scriptUri.toString());
    console.log('Cursor Templates: Webview Styles URI:', stylesUri.toString());

    // Tip: Use developer tools (Command Palette > Developer: Toggle Developer Tools) to inspect the webview DOM and network requests if things aren't loading.

    // Build HTML string incrementally
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Allow specific styles and scripts -->
  <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}';
      connect-src ${webview.cspSource};
      img-src ${webview.cspSource} data:;
      font-src ${webview.cspSource};
  ">
  <link rel="stylesheet" type="text/css" href="${stylesUri}">
  <title>Cursor Templates</title>
</head>
<body>
  <!-- This div is where the React app will mount -->
  <div id="root"></div>
  <!-- Load the React app script -->
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;

    return html;
  }
}