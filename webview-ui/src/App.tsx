import { useState, useEffect, useCallback } from 'react';
import './App.css'; // Keep or replace with your own styles

// Define the structure of a template object (matching the extension side)
interface Template {
  name: string;
  text: string;
}

// Define the structure of the VS Code API object provided by acquireVsCodeApi
// It's good practice to type this, even if it's simple
interface VsCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(newState: any): void;
}

// Declare the global acquireVsCodeApi function (provided by VS Code webview)
declare const acquireVsCodeApi: () => VsCodeApi;
const vscode = 'acquireVsCodeApi' in window ? acquireVsCodeApi() : window; // Get the VS Code API instance

function App() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mode, setMode] = useState<'view' | 'add' | 'edit'>('view'); // 'view', 'add', 'edit'
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null); // Template being edited
  const [inputName, setInputName] = useState('');
  const [inputText, setInputText] = useState('');


  // --- Communication with Extension Host ---

  // Effect to listen for messages from the extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data; // The message data sent from the extension
      console.log("Webview received message:", message); // Log received messages
      switch (message.command) {
        case 'updateTemplates':
          setTemplates(message.payload || []);
          break;
        // Add other message handlers if needed
        case 'confirmationResult': { // Handle the confirmation result from the extension
          const { confirmed, action, data } = message.payload;
          if (confirmed && action === 'deleteTemplate') {
            // User confirmed deletion, now send the actual delete message
            vscode.postMessage({
              command: 'deleteTemplate',
              payload: data // Send the original data (e.g., { name: templateNameToDelete })
            });
          }
          // Optionally handle the 'not confirmed' case if needed
          break;
        }
      } // End of switch statement
    }; // End of handleMessage function

    window.addEventListener('message', handleMessage);

    // Request initial templates when the component mounts
    vscode.postMessage({ command: 'getTemplates' });
    console.log("Webview requested initial templates.");

    // Cleanup listener when the component unmounts
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [vscode]); // Depend on vscode object

  // --- Action Handlers ---

  const handlePaste = useCallback((template: Template) => {
    vscode.postMessage({
      command: 'pasteTemplate',
      payload: { text: template.text }
    });
  }, [vscode]);

  const handleEditClick = useCallback((template: Template) => {
    setMode('edit');
    setEditingTemplate(template);
    setInputName(template.name);
    setInputText(template.text);
  }, []);

  const handleDelete = useCallback((template: Template) => {
    // Request confirmation from the extension host instead of using window.confirm
    vscode.postMessage({
      command: 'requestConfirmation',
      payload: {
        message: `Are you sure you want to delete the template "${template.name}"?`,
        action: 'deleteTemplate', // Identifier for the action
        data: { name: template.name } // Data needed if confirmed
      }
    });
  }, [vscode]);

  const handleAssignKeybinding = useCallback((template: Template) => {
    vscode.postMessage({
      command: 'assignKeybinding',
      payload: { name: template.name }
    });
  }, [vscode]);

  const handleAddClick = useCallback(() => {
    setMode('add');
    setEditingTemplate(null); // Ensure no template is marked for editing
    setInputName('');
    setInputText('');
  }, []);

  const handleCancel = useCallback(() => {
    setMode('view');
    setEditingTemplate(null);
    setInputName('');
    setInputText('');
  }, []);

  const handleSave = useCallback(() => {
    const finalName = inputName.trim();
    if (!finalName) {
      vscode.postMessage({ command: 'showError', text: 'Template name cannot be empty.' });
      return;
    }

    if (mode === 'add') {
      vscode.postMessage({
        command: 'addTemplate',
        payload: { name: finalName, text: inputText }
      });
    } else if (mode === 'edit' && editingTemplate) {
      vscode.postMessage({
        command: 'editTemplate',
        payload: {
          originalName: editingTemplate.name,
          newName: finalName,
          newText: inputText
        }
      });
    }

    // Reset state after saving
    handleCancel();
  }, [inputName, inputText, mode, editingTemplate, handleCancel, vscode]);

  // --- Rendering ---

  // --- Conditional Rendering ---

  if (mode === 'add' || mode === 'edit') {
    return (
      <main className="form-mode">
        <h2>{mode === 'add' ? 'Add New Template' : `Edit Template: ${editingTemplate?.name}`}</h2>
        <div className="form-group">
          <label htmlFor="template-name">Name:</label>
          <input
            id="template-name"
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder="Unique template name"
          />
        </div>
        <div className="form-group">
          <label htmlFor="template-text">Text:</label>
          <textarea
            id="template-text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Template content"
            rows={10} // Adjust rows as needed
          />
        </div>
        <div className="form-actions template-actions">
          <button onClick={handleSave} className="save-button">Save</button>
          <button onClick={handleCancel} className="cancel-button">Cancel</button>
        </div>
      </main>
    );
  }

  // Default: View mode
  return (
    <main>
      <button onClick={handleAddClick} className="add-button">Add New Template</button>
      <ul className="template-list">
        {templates.length === 0 ? (
          <li>No templates defined yet.</li>
        ) : (
          templates.map((template) => (
            <li key={template.name} className="template-item">
              <div className="template-info">
                <strong>{template.name}</strong>
                {/* Show more text in view mode, maybe with scroll? Or keep it short */}
                <p className="template-text-preview">{template.text.substring(0, 150)}{template.text.length > 150 ? '...' : ''}</p>
              </div>
              <div className="template-actions">
                 <button onClick={() => handlePaste(template)} title="Paste">Paste</button>
                 <button onClick={() => handleEditClick(template)} title="Edit">Edit</button> {/* Use handleEditClick */}
                 <button onClick={() => handleAssignKeybinding(template)} title="Assign Keybinding">Keybind</button>
                 <button onClick={() => handleDelete(template)} title="Delete" className="delete-button">Delete</button>
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

export default App;
