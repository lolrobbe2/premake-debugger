import * as vscode from 'vscode';
import { DebugConfiguration, ProviderResult, WorkspaceFolder } from 'vscode';

export class PremakeConfig {
    readonly devMode: string;
    readonly srcLoc: string;
    readonly binLocation: string;
    readonly mode: string;

    readonly port: number;
    readonly host: string;
    constructor() {
        // Get the configuration for the extension
        const config = vscode.workspace.getConfiguration('premake');

        this.port = parseInt(process.env.MOBDEBUG_PORT || config.get('port',"8172"));
        this.host = config.get('host','localhost');

        // Fetch the dev mode and handle the srcloc conditionally
        this.devMode = config.get('dev', 'disabled');  // Default: 'disabled'

        if (this.devMode === 'development') {
            this.srcLoc = config.get('dev.srcloc', './src');  // Default: './src'
            this.binLocation = config.get('dev.binloc','./bin');
            this.mode = config.get('dev.mode', 'debug');
        } else {
            this.srcLoc = './src';  // If not in development mode, clear the source location
            this.binLocation = './bin';
            this.mode = 'debug';

        }
    }

    
    public getSrcLoc(): string {
        return this.srcLoc;
    }

    public provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
        return [
        {
            name: "Premake Lua Debug",
            request: "launch",
            type: "premake",  // The type should match the one in `registerDebugAdapterDescriptorFactory`
            program: this.devMode === 'normal' ? `./premake5.exe` : `${this.binLocation}/${this.devMode}/premake5.exe`,  // Path to the Lua file to be executed
            args: [`--scripts=${this.srcLoc} --debugger`],
            stopOnEntry: false,  // Optional: stop at the first line of the script
        }
    ];
}
}
