import * as vscode from 'vscode';

// Type definition for template objects from configuration
export interface Template {
  name: string;
  text: string;
}

/**
 * Pastes the given text into the Cursor chat input.
 * @param text The text to paste.
 */
export async function pasteTemplateText(text: string) {
  if (text === undefined || text === null) { // Check for undefined/null as well
    console.warn('Cursor Templates: Attempted to paste undefined/null text.');
    return; // Avoid errors
  }
  try {
    await vscode.env.clipboard.writeText(text);
    // Ensure Cursor chat is ready - using composer.startComposerPrompt might be sufficient
    await vscode.commands.executeCommand('composer.startComposerPrompt');
    // Wait a short period for the UI to potentially update/focus
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
  } catch (error) {
    vscode.window.showErrorMessage(`Cursor Templates: Failed to paste template. Error: ${error}`);
    console.error('Cursor Templates: Error pasting template:', error);
  }
}

/**
 * Sanitizes a template name to be used as part of a VS Code command ID.
 * Replaces whitespace with underscores and removes invalid characters.
 * @param name The original template name.
 * @returns A sanitized string suitable for a command ID.
 */
export function sanitizeNameForCommand(name: string): string {
    if (!name) {return '';} // Handle empty input
    return name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}