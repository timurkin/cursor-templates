import * as vscode from 'vscode';
// Removed: import { TemplateProvider, TemplateItem } from './TemplateProvider';
import { TemplatesWebviewViewProvider } from './WebviewViewProvider'; // Import the new provider
import { Template, pasteTemplateText, sanitizeNameForCommand } from './utilities/templateUtils'; // Import helpers (removed updateTemplatesConfig)

// Removed: Local Template interface definition
// Removed: pasteTemplateText helper function
// Removed: updateTemplatesConfig helper function
// Removed: sanitizeNameForCommand helper function

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

  console.log('Cursor Templates: extension is activating.');

  let templateCommandDisposables: vscode.Disposable[] = []; // To track dynamic template commands

  // Function to register all commands based on current configuration
  function registerCommands() {
    // Dispose previously registered template commands
    templateCommandDisposables.forEach(disposable => disposable.dispose());
    templateCommandDisposables = []; // Clear the array
    console.log('Cursor Templates: Disposed old template commands.');

    // Read from globalState
    const templates = context.globalState.get<Template[]>('cursorTemplates') || [];

    console.log(`Cursor Templates: Found ${templates.length} templates in configuration.`);

    // Register individual commands for each template (for keybindings)
    templates.forEach(template => {
      if (!template.name || !template.text) {
        console.warn('Cursor Templates: Skipping template with missing name or text:', template);
        return;
      }
      const sanitizedName = sanitizeNameForCommand(template.name);
      if (!sanitizedName) {
          console.warn(`Cursor Templates: Skipping template with invalid name after sanitization: "${template.name}"`);
          return;
      }
      const commandId = `cursor-templates.pasteTemplate.${sanitizedName}`;

      try {
        const disposable = vscode.commands.registerCommand(commandId, () => {
            console.log(`Cursor Templates: Executing command ${commandId}`);
            pasteTemplateText(template.text);
        });
        templateCommandDisposables.push(disposable); // Add to our tracked list
        console.log(`Cursor Templates: Registered command ${commandId}`);
      } catch (error) {
          console.error(`Cursor Templates: Failed to register command ${commandId}`, error);
      }
    });
    // Add the dynamic commands to the main context subscriptions
    context.subscriptions.push(...templateCommandDisposables);
  }

  // Register the command to show the template list (original command)
  const listCommandDisposable = vscode.commands.registerCommand('cursor-templates.showTemplateList', async () => {
    console.log('Cursor Templates: Executing command cursor-templates.showTemplateList');
    // Read from globalState
    const templates = context.globalState.get<Template[]>('cursorTemplates') || [];

    if (templates.length === 0) {
      vscode.window.showInformationMessage('Cursor Templates: No templates defined in settings (cursor-templates.templates).');
      return;
    }

    const quickPickItems = templates.map(t => ({
      label: t.name,
      description: t.text.substring(0, 100) + (t.text.length > 100 ? '...' : ''),
      templateText: t.text // Store the full text here
    }));

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: 'Select a template to paste into Cursor chat',
      matchOnDescription: true
    });

    if (selected) {
      console.log(`Cursor Templates: Template selected from list: "${selected.label}"`);
      pasteTemplateText(selected.templateText);
    } else {
        console.log('Cursor Templates: No template selected from list.');
    }
  });
  context.subscriptions.push(listCommandDisposable);
  console.log('Cursor Templates: Registered command cursor-templates.showTemplateList');

  // Removed: Tree View Provider instantiation and registration

  // Instantiate and register the Webview View Provider
  // Pass context and the registerCommands function to the provider
  const provider = new TemplatesWebviewViewProvider(context.extensionUri, context, registerCommands);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TemplatesWebviewViewProvider.viewType, provider)
  );
  // Initial registration of dynamic template commands (for keybindings)
  registerCommands();

  // Re-register commands AND update webview if the configuration changes
  // Remove the onDidChangeConfiguration listener for cursor-templates.templates
  // Updates are now triggered directly after globalState changes via the provider
  // context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
  //   if (e.affectsConfiguration('cursor-templates.templates')) {
  //     console.log('Cursor Templates: Configuration changed, re-registering template commands and updating webview.');
  //     registerCommands(); // Re-register dynamic commands for keybindings
  //     provider.sendTemplatesToWebview(); // Update the webview view
  //   }
  // }));

  console.log('Cursor Templates extension activated successfully.');
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log('Cursor Templates extension deactivated.');
  // Disposables added to context.subscriptions are automatically handled
}
