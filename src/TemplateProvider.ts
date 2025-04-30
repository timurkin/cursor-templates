import * as vscode from 'vscode';

interface TemplateConfig {
    name: string;
    text: string;
}

export class TemplateItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        // Store the original template text and name for commands
        public readonly templateText: string,
        public readonly templateName: string // Store original name for edit/delete
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}: ${this.templateText}`; // Tooltip shows name and full text
        this.description = this.templateText.length > 50 ? this.templateText.substring(0, 50) + '...' : this.templateText; // Description shows snippet

        // Command to execute when the item is clicked
        this.command = {
          command: 'cursor-templates.pasteTemplateFromView',
          title: 'Paste Template',
          arguments: [this] // Pass the item itself
        };
    }

    // Context value for the 'when' clause in package.json
    contextValue = 'templateItem';

    // Optional: Add an icon for the tree item
    // iconPath = {
    //     light: path.join(__filename, '..', '..', 'resources', 'light', 'template.svg'),
    //     dark: path.join(__filename, '..', '..', 'resources', 'dark', 'template.svg')
    // };
}

export class TemplateProvider implements vscode.TreeDataProvider<TemplateItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<TemplateItem | undefined | null | void> = new vscode.EventEmitter<TemplateItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TemplateItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TemplateItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TemplateItem): Thenable<TemplateItem[]> {
        if (element) {
            // Templates are leaf nodes
            return Promise.resolve([]);
        } else {
            // Get root elements (the templates)
            const config = vscode.workspace.getConfiguration('cursor-templates');
            const templates = config.get<TemplateConfig[]>('templates') || [];

            const templateItems = templates.map(template => {
                const description = template.text.length > 50
                    ? template.text.substring(0, 50) + '...'
                    : template.text;

                return new TemplateItem(
                    template.name, // label
                    template.text, // tooltip (will be combined with label in constructor)
                    description,   // description (will be generated in constructor)
                    vscode.TreeItemCollapsibleState.None,
                    template.text, // templateText
                    template.name  // templateName
                );
            });

            return Promise.resolve(templateItems);
        }
    }
}