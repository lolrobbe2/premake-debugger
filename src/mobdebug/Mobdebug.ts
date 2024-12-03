import { error } from 'console';
import * as net from 'net';
import * as vscode from 'vscode';
import { PremakeConfig } from '../config';
import * as commands from './commands/mod';
type EventCallback = (event: string) => Promise<void>;
export class StackTrace {
    meta: string[];
    params: Record<string, string>;
    fields: Record<string, string>;

    constructor(meta: string[], params: Record<string, string>, fields: Record<string, string>) {
        this.meta = meta;
        this.params = params;
        this.fields = fields;
    }
    get functionName(): string |undefined { 
        if(this.meta[0] === 'nil'){ return undefined; }
        else { return this.meta[0]; }
    }
    get shortPath(): string { return this.meta[1]; }
    get startLine(): number { return parseInt(this.meta[2], 10); }
    get endLine(): number { return parseInt(this.meta[3], 10);}
}

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

    public async stack(): Promise<StackTrace[]> {
        const result:string = await this.sendCommand(new commands.StackCommand());
        const parsedStack = this.parseStackTrace(result);
        return parsedStack;
    }

    private async sendCommand(command: commands.Command): Promise<string> {
        return new Promise((resolve, reject) => {
            this.client.write(command.toString(), (err) => {
                if (err) {
                    error(`Failed to send command: ${command.toVerboseString()}, reason:${err.message}`);
                }
            });

            // Wait for data and the 'end' event.
            this.client.on('data', (data: Buffer) => {
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
    


    private parseStackTrace(stackTrace: string): StackTrace[] {
        const frames: StackTrace[] = [];
        const stackFrameStrings = this.extractStackFrames(stackTrace);

        for (let i = 0; i < stackFrameStrings.length - 3; i += 3) {
            const meta = stackFrameStrings[i]
                .replace("{",'')
                .replace("\"",'')
                .replace("}","")
                .split(',');
            const fields = this.parseFields(stackFrameStrings[i+1]
                .replace("\"",'')
                .replace("{",'')
                .replace("}","")
                .split(','));
            const params = this.parseFields(stackFrameStrings[i+2]
                .replace("\"",'')
                .replace("{",'')
                .replace("}","")
                .split(','));
            frames.push(new StackTrace(meta,params,fields));
        }

        return frames;
    }

    // Extract individual stack frame strings by manually splitting based on curly braces
    private extractStackFrames(stackTraceString: string): string[] {
        let frameStrings: string[] = [];
        let depth = 0;
        let currentFrame = '';
        
        let stackTrace:string | undefined= stackTraceString.match("\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}")?.toString();
        while (stackTrace !== undefined) {
                stackTraceString = stackTraceString.replace(stackTrace!, '').trim();
            stackTrace = stackTrace.replace(",,",'');

            if(stackTrace !==  "{}") {frameStrings.push(stackTrace); }
            stackTrace = stackTraceString.match("\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}")?.toString();
        }
        const remainder = frameStrings.length % 3;
        if(remainder > 0) { return frameStrings.slice(0, frameStrings.length - remainder); }
        return frameStrings;
    }

    // Parse a single frame string into an object


    // Parse dynamic fields (func, p, i, etc.)
    private parseFields(fieldStrings: string[]): Record<string, string> {
        const fields: Record<string, string> = {};
        
        fieldStrings.forEach(fieldString => {
            const [fieldName, fieldValue] = fieldString.split('=').map(str => str.trim());
            if (fieldValue) {
            fields[fieldName] = this.parseFieldValue(fieldValue);
            }
        });
        
        return fields;
    }

    // Parse a field value and determine if it's a number, function, or table
    private parseFieldValue(value: string): string {
        if (value.startsWith('function:')) {
            return value; // Store function as a string reference for now
        } else if (value.startsWith('table:')) {
            return value; // Store table reference as a string
        } else if (!isNaN(Number(value))) {
            return value; // If it's a number, convert it
        }
        
        return value; // Default case: treat it as a string
    }

}