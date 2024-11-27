import { error } from 'console';
import * as net from 'net';
import * as vscode from 'vscode';
import * as commands from './commands/mod';
export enum Result {
    ok,
    failure,
}
export class MobDebug {
    
    readonly client = new net.Socket();

    readonly port:number = 0;
    readonly host:string = '';
    private responseBuffer: string = '';
    private isConnected:boolean = false;
    constructor(client:net.Socket) {
        this.client = client;
        this.client.on('error', (err: Error) => {
            vscode.window.showErrorMessage(`Error: ${err.message}`);
        });

        this.client.on('close', () => {
            vscode.window.showInformationMessage('Connection to mobdebug server closed');
        });
    }




    public async setBreakpoint(file: string, line: number): Promise<Result> {
        const command: string = `SETB ${file}:${line}\n`;
        const result:string = await this.sendCommand(new commands.SetBreakpointCommand(file, line));
        return Result.ok;
    }
    public async removeBreakpoint(file: string, line: number): Promise<Result> {
       // const result:string = await this.sendCommand();
        return Result.ok;
    }
    public async step():Promise<Result> {
        const result:string = await this.sendCommand(new commands.StepCommand());
        return Result.ok;
    }
    public async run(): Promise<String> {
        const result:string = await this.sendCommand(new commands.RunCommand());
        return result;
    }
    private async sendCommand(command: commands.Command): Promise<string> {
        return new Promise((resolve, reject) => {
            this.client.write(command.toString(), (err) => {
                if (err) {
                    error(`Failed to send command: ${command.toVerboseString()}, reason:${err.message}`);
                }
            });

            // Wait for data and the 'end' event.
            this.client.once('data', (data: Buffer) => {
                this.responseBuffer += data.toString();
            });

            this.client.once('end', () => {
                const response = this.responseBuffer;
                this.responseBuffer = ''; // Clear buffer after reading.
                resolve(response);
            });

            // Handle potential timeout or unexpected behavior.
            setTimeout(() => {
                if (!this.responseBuffer) {
                    error('Timeout: No response received from the server');
                }
            }, 5000); // Adjust the timeout as needed.
        });
    }
    public stop(){
        this.client.end();
    }
}