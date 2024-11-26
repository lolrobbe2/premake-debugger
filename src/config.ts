import * as vscode from 'vscode';

export class PremakeConfig {
    readonly devMode: string;
    readonly srcLoc: string;

    constructor() {
        // Get the configuration for the extension
        const config = vscode.workspace.getConfiguration('premake');

        // Fetch the dev mode and handle the srcloc conditionally
        this.devMode = config.get('dev', 'disabled');  // Default: 'disabled'

        if (this.devMode === 'development') {
            this.srcLoc = config.get('dev.srcloc', './src');  // Default: './src'
        } else {
            this.srcLoc = '';  // If not in development mode, clear the source location
        }
    }

    public getSrcLoc(): string {
        return this.srcLoc;
    }
}
