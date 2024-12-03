import { error } from 'console';
import * as net from 'net';
import * as vscode from 'vscode';
import * as commands from './commands/mod';
import { PremakeConfig } from '../config';
type EventCallback = (event: string) => Promise<void>;

export enum Result {
    ok,
    bad_request,
    error_in_expression,
    failure,
}
export class MobDebug {
    
    readonly client = new net.Socket();

    readonly port:number = 0;
    readonly host:string = '';
    private responseBuffer: string = '';
    private isConnected:boolean = false;
    private eventCallbacks: EventCallback[] = [];
    private sendingCommand:boolean = false;
    private eventBuffer: string = '';
    private sendingFile:boolean = false;
    readonly commandResponses: string[] =  [
        "200 OK",
        "400 Bad Request",
        "401 Error in Expression"
    ];
    constructor(client:net.Socket) {
        this.client = client;
        this.client.on('data', (data:string)=>{
            const responses = data.toString().split('\n');
            this.launchEvents(responses.filter((response) => !this.isResponse(response)));
            
        });

        this.client.on('error', (err: Error) => {
            vscode.window.showErrorMessage(`Error: ${err.message}`);
        });

        this.client.on('close', () => {
            vscode.window.showInformationMessage('Connection to mobdebug server closed');
        });
    }



    public async loadFile(size:number,file:string): Promise<Result> {
        const loadCommand = new commands.LoadCommand(size,file);
        const fileContent = await loadCommand.readFile(new PremakeConfig().cwd + "\\" + file);
        loadCommand.setFileContent(fileContent);
        const result: string = await this.sendCommand(loadCommand);
        return this.getResultEnum(result);
    }

    public async setBreakpoint(file: string, line: number): Promise<Result> {
        const result:string = await this.sendCommand(new commands.SetBreakpointCommand(file, line));
        return this.getResultEnum(result);
    }
    public async removeBreakpoint(file: string, line: number): Promise<Result> {
       // const result:string = await this.sendCommand();
        return Result.ok;
    }
    public async step():Promise<Result> {
        const result:string = await this.sendCommand(new commands.StepCommand());
        return this.getResultEnum(result);
    }
    public async run(): Promise<String> {
        const result:string = await this.sendCommand(new commands.RunCommand());
        return result;
    }
    public async exit(): Promise<Result> {
        const result:string = await this.sendCommand(new commands.ExitCommand());
        return this.getResultEnum(result);
    }
    public async setBaseDir(dir: string): Promise<Result> {
        const result:string = await this.sendCommand(new commands.BasedirCommand(dir));
        return this.getResultEnum(result);
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
                if (this.responseBuffer.includes('\n')) {
                    // Split the buffer into responses
                    const responses = this.responseBuffer.split('\n').filter((line) => line.trim() !== '');
                    
                    // Reset the buffer for subsequent processing
                    this.responseBuffer = '';
                    const events: string[] = [];
                    // Check responses for the expected condition
                    for (const response of responses) {
                        if (this.isResponse(response)) {
                            // Handle events first
                            this.launchEvents(events);

                            // Resolve the promise as the response was found
                            resolve(response);
                            return;
                        } else {
                            // Add non-matching responses to events
                            events.push(response);
                        }
                    }
                }
            });
            setTimeout(()=>{
                if(!this.sendingFile && this.responseBuffer !== '') { console.log("error sending command"!); }
            },5000);
            // Handle potential timeout or unexpected behavior.
        });
    }
    public stop(){
        this.client.end();
    }
     // Add event listener
    public addEventListener(callback: EventCallback): void {
        this.eventCallbacks.push(callback);
    }

    // Remove event listener
    public removeEventListener(callback: EventCallback): void {
        const index = this.eventCallbacks.indexOf(callback);
        if (index !== -1) {
            this.eventCallbacks.splice(index, 1);
        }
    }
    private async launchEvents(events:string[]): Promise<void> {
        for(const event of events) {
            for (const callback of this.eventCallbacks) {
                if(!this.isResponse(event)) {
                    await callback(event);
                }
            }
        }
    }
    private isResponse(data: string): boolean {
        for (const responseStart of this.commandResponses) {
            if (data.startsWith(responseStart)) { return true; }
        }
        return false;
    }
    private getResultEnum(data: string): Result {
        if(data.startsWith("200 OK")){ return Result.ok; }
        else if(data.startsWith("400 Bad Request")) {return Result.bad_request;}
        else if(data.startsWith("401 Error in Expression")) {return Result.error_in_expression;}
        else {return Result.failure;}
    }
}