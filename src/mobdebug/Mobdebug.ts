import { error } from 'console';
import * as net from 'net';
import * as vscode from 'vscode';
export class MobDebug {
    readonly client = new net.Socket();

    readonly port:number = 0;
    readonly host:string = '';
    private responseBuffer: string = '';
    private isConnected:boolean = false;
    readonly connectionPromise: Promise<void>;
    constructor(port: number = 8172,host:string = 'localhost') {
        this.connectionPromise = this.connect();
        this.port = port;
        this.host = host;
    }

    private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
        this.client.connect(this.port, this.host, () => {
            vscode.window.showInformationMessage('Connected to mobdebug server');
            this.isConnected = true;
            resolve(); // Connection established, resolve the promise.
        });

        this.client.on('error', (err: Error) => {
            vscode.window.showErrorMessage(`Error: ${err.message}`);
            reject(err); // Reject the promise on connection error.
        });

        this.client.on('close', () => {
            vscode.window.showInformationMessage('Connection to mobdebug server closed');
        });
    });
}


    public async setBreakpoint(file: string, line: number) {
        const command: string = `SETB ${file}:${line}`;
        this.sendCommand(command);
    }
    public async removeBreakpoint(file: string, line: number) {
        const command: string = `SETB ${file}:${line}`;
        this.sendCommand(command);
    }
    public async step(){
        const command: string = `STEP`;
        this.sendCommand(command);
    }

    private async sendCommand(command: string): Promise<string> {
        if (!this.isConnected) {
            vscode.window.showErrorMessage('Could not send command to mobdebug as client is not connected');
            return Promise.reject('Client is not connected');
        }
        return new Promise((resolve, reject) => {
            this.client.write(command, (err) => {
                if (err) {
                    error(`Failed to send command: ${err.message}`);
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
}