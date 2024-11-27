import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as vscode from 'vscode';

export class PremakeConfig {
    readonly devMode: string;
    readonly rootLoc: string;
    readonly binLocation: string;
    readonly mode: string;

    readonly port: number;
    readonly host: string;
    private outputChannel: vscode.OutputChannel;
    constructor() {
        // Get the configuration for the extension
        const config = vscode.workspace.getConfiguration('premake');

        this.port = parseInt(process.env.MOBDEBUG_PORT || config.get('port',"8172"));
        this.host = config.get('host','localhost');

        // Fetch the dev mode and handle the srcloc conditionally
        this.devMode = config.get('dev', 'disabled');  // Default: 'disabled'

        if (this.devMode === 'development') {
            this.rootLoc = config.get('dev.rootloc', '/.');  // Default: '/'
            this.binLocation = config.get('dev.binloc','./bin');
            this.mode = config.get('dev.mode', 'debug');
        } else {
            this.rootLoc = '/.';  // If not in development mode, clear the source location
            this.binLocation = './bin';
            this.mode = 'debug';

        }
        this.outputChannel = vscode.window.createOutputChannel('Premake');
    }

    public spawnPremake(callback: (error: Error | null, success: boolean) => void): ChildProcessWithoutNullStreams {
        const premakePath =
            this.devMode === 'normal'
                ? '/premake5.exe'
                : `"${this.binLocation}/${this.mode}/premake5.exe"`;

        const args = [`--scripts=${this.rootLoc}`, 'test', '--debugger'];
        console.log(`Spawning Premake: ${premakePath} ${args.join(' ')}`);
        this.outputChannel.show(true);
        this.outputChannel.appendLine(`Spawning Premake: ${premakePath} ${args.join(' ')}`);

        const premakeProcess: ChildProcessWithoutNullStreams = spawn(premakePath, args, {
            cwd: vscode.workspace.workspaceFolders
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : this.rootLoc,
            shell: true,
            detached: false
        });

        // Handle stdout
        premakeProcess.stdout.on('data', (data) => {
            this.outputChannel.append(data.toString());
        });

        // Handle stderr
        premakeProcess.stderr.on('data', (data) => {
            console.error(`Premake stderr: ${data.toString().trim()}`);
            this.outputChannel.append(`[ERROR] ${data.toString()}`);
        });

        // Handle close
        premakeProcess.on('close', (code) => {
            if (code === 0) {
                console.log('Premake process completed successfully.');
                callback(null, true);
            } else {
                console.error(`Premake exited with code ${code}`);
                callback(new Error(`Premake exited with code ${code}`), false);
                this.outputChannel.dispose();
            }
        });

        // Handle errors
        premakeProcess.on('error', (err) => {
            console.error('Error spawning Premake process:', err);
            callback(err, false);
        });
        
        return premakeProcess;
    }
}