import {
	Breakpoint,
	BreakpointEvent,
	InitializedEvent,
	LoggingDebugSession,
	Source,
	StackFrame,
	StoppedEvent,
	Thread
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PremakeConfig } from './config';
import { DebugServer } from './mobdebug/DebugServer';
import { MobDebug, StackTrace } from './mobdebug/Mobdebug';

interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** An absolute path to the "program" to debug. */
	program: string;
	/** Automatically stop target after launch. If not specified, target does not stop. */
	stopOnEntry?: boolean;
	/** enable logging the Debug Adapter Protocol */
	trace?: boolean;
	/** run without debugging */
	noDebug?: boolean;
	/** if specified, results in a simulated compile error in launch. */
	compileError?: 'default' | 'show' | 'hide';
}

interface IAttachRequestArguments extends ILaunchRequestArguments { }

export class PremakeDebugSession extends LoggingDebugSession {
	private static debugSession: PremakeDebugSession;
    private static threadID = 1;

    private _reportProgress = false;
    private _useInvalidatedEvent = false;
	readonly _configurationDone: Promise<void>;
	
	private _configurationDoneResolve: () => void = () => {};
	private _breakpointsSetResolve: () => void = () => {};
	readonly eventListener: DebugServer;
	private _mobDebugSession:MobDebug | null = null;

	private _premakeProcess?:ChildProcessWithoutNullStreams = undefined;

	private _sessionReady: Promise<void>;
	private _breakpointsSet: Promise<void>;
    private _sessionReadyResolve: () => void = () => {};
	private _breakpoints: Map<string,DebugProtocol.SourceBreakpoint> = new Map();
	private _currentFile: string = "";
	private _currentLine: number = 0;
	private prefixes:string[] = [
		"modules",
		"src"
	];

    public constructor(emitter: DebugServer) {
		super("mock-debug.txt");
        this.setDebuggerLinesStartAt1(false);
		this.setDebuggerColumnsStartAt1(false);
		PremakeDebugSession.debugSession = this;
		this._configurationDone = new Promise<void>((resolve) => {
       		this._configurationDoneResolve = resolve;
    	});

		this._breakpointsSet = new Promise<void>((resolve) => {
			this._breakpointsSetResolve = resolve;
		});

		this._sessionReady = new Promise<void>((resolve) => {
            this._sessionReadyResolve = resolve;
        });

		this.eventListener = emitter;
        this.eventListener.on('session',this.onSession.bind(this));
    }

    /**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void 
    {
        if (args.supportsProgressReporting) {
			this._reportProgress = true;
		}
		if (args.supportsInvalidatedEvent) {
			this._useInvalidatedEvent = true;
		}

        response.body = response.body || {};

        // make VS Code use 'evaluate' when hovering over source
		response.body.supportsEvaluateForHovers = true;
        // make VS Code send cancel request
		response.body.supportsCancelRequest = true;
		response.body.supportsConfigurationDoneRequest = true;
        response.body.supportSuspendDebuggee = true;
		response.body.supportTerminateDebuggee = true;
		response.body.supportsFunctionBreakpoints = true;
		response.body.supportsDelayedStackTraceLoading = true;
		response.body.supportsBreakpointLocationsRequest = true;
		response.body.supportsTerminateRequest = true;
        // since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		if(this._premakeProcess !== null) {
			this._premakeProcess?.kill();
		}

		this._premakeProcess = new PremakeConfig().spawnPremake((err, success) => {
			if (err) {
				vscode.window.showErrorMessage(`Premake failed: ${err.message}`);
				return;
			}
			if (success) {
				vscode.window.showInformationMessage('Premake executed successfully.');
			}
		});	
		this.sendResponse(response);
		// notify the launchRequest that configuration has finished
		if (this._configurationDoneResolve) {
			this._configurationDoneResolve();
		}
		this.sendResponse(response);
		this.sendEvent(new InitializedEvent());

    }

    /**
	 * Called at the end of the configuration sequence.
	 * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		super.configurationDoneRequest(response, args);
		
		
	}
	protected async attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArguments) {
		return this.launchRequest(response, args);
	}
	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) {
		
		await this._configurationDone;
		await this._sessionReady;
		console.log(`setting basedir result: ${await this._mobDebugSession?.setBaseDir(new PremakeConfig().cwd)}`);
		await this._breakpointsSet;

		console.log(`run mobdebug: ${await this._mobDebugSession?.run()}`);
		console.log("launched succesfuly");
		this.sendResponse(response);
		
	}

	protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> {
		await this._sessionReady;
		const source = args.source;
		let filepath: string = "";
		let filename: string = '';
		// Check if 'source' exists and has a 'name' or 'path' property
		if (source) {
			// The filename might be in the 'name' or 'path' property
			filepath = source.path || 'Unknown File';

			// Resolve the path relative to the current working directory
			filename = path.relative(new PremakeConfig().cwd, filepath);
		}
		filename = filename.replace(/\\/g, '/'); // replaces \\ with /
		//filename = this.stripPrefix(filename,this.prefixes);
		filename = `/${filename}`;
		const filesize = this.getFileSize(filepath);
		//filename = filename.replace(/^[/\\]+/, ''); //strips the leading /
		// Log the filename (you can process it further as needed)
		console.log(`Setting breakpoints for file: ${filename}`);
		
		// Now, proceed with handling the breakpoints as usual
		const breakpoints = args.breakpoints || [];
		const actualBreakpoints: DebugProtocol.Breakpoint[] = [];
		if(filename === 'unknown File') {
			vscode.window.showErrorMessage(`unable to set breakpoints for unkown file!`);
			this.sendResponse(response);
			return;
		}
		if(this._mobDebugSession === null)
		{
			vscode.window.showErrorMessage(`mobDebugSession was undefined!`);
			response.success = false;
			this.sendResponse(response);
			return;
		}
		for (const breakpoint of breakpoints) {
			console.log(`setting breakpoint result: ${(await this._mobDebugSession?.setBreakpoint(filename, breakpoint.line)).toString()}`);
			this._breakpoints.set(`${source.path!}:${breakpoint.line}`, breakpoint);
			const bp: DebugProtocol.Breakpoint = { id: this.simpleHash(`${source.path!}:${breakpoint.line}`), verified: true, line: breakpoint.line }; actualBreakpoints.push(bp);
		}
		if (!response.body) { 
			response.body = { breakpoints: [] }; 
		}
		response.body.breakpoints = actualBreakpoints;
		response.success = true;
		this._breakpointsSetResolve();
		this.sendResponse(response);
	}
	protected async cancelRequest(response: DebugProtocol.CancelResponse, args: DebugProtocol.CancelArguments, request?: DebugProtocol.Request): Promise<void> {
		await this._mobDebugSession?.exit();
		this._mobDebugSession?.stop();
		this._mobDebugSession = null;
		this._premakeProcess?.kill('SIGINT');
		this._premakeProcess = undefined;
		response.success = true;
		this.sendResponse(response);
	}
	protected async terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments, request?: DebugProtocol.Request): Promise<void> {
		await this._mobDebugSession?.exit();
		this._mobDebugSession?.stop();
		this._mobDebugSession = null;
		this._premakeProcess?.kill('SIGINT');
		this._premakeProcess = undefined;
		response.success = true;
		this.sendResponse(response);

	}
	protected async breakpointLocationsRequest(response: DebugProtocol.BreakpointLocationsResponse, args: DebugProtocol.BreakpointLocationsArguments, request?: DebugProtocol.Request): Promise<void>
	{
		const sourcePath = args.source?.path;
        const startLine = args.line;
        const endLine = args.endLine || startLine;

        console.log(`Breakpoint locations request for ${sourcePath}, lines ${startLine} to ${endLine}`);

        if (!sourcePath) {
            response.body = { breakpoints: [] };
            this.sendResponse(response);
            return;
        }

        // Since breakpoints are assumed valid, directly generate locations
        const breakpoints: DebugProtocol.BreakpointLocation[] = [];
        for (let i = startLine; i <= endLine; i++) {
            breakpoints.push({
                line: i,
                column: 1 // Assuming breakpoints are always at the start of the line
            });
        }

        // Populate the response
        response.body = { breakpoints };
        response.success = true;
		console.log("testing");
		this.sendResponse(response);
	}

	private async onSession(session: MobDebug): Promise<void> {
        console.log(`Session event received for: ${session}`);
		if(this._mobDebugSession){
			this._mobDebugSession.stop();
		}
        this._mobDebugSession = session;
		this._mobDebugSession.addEventListener(this.onDebugSessionEvent);
		this._sessionReadyResolve();
    }
	private stripPrefix(filename: string, prefixes: string[]): string {
		const matchingPrefix = prefixes.find(prefix => filename.startsWith(prefix));
		return matchingPrefix ? filename.slice(matchingPrefix.length) : filename;
	}
	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
        threads: [
            new Thread(PremakeDebugSession.threadID, "Main Thread")
        ]
    };
    this.sendResponse(response);
	}
	private async onDebugSessionEvent(event: string): Promise<void> {
		if(event.startsWith("202 Paused")) {
			const match = event.match(/202 Paused (\S+) (\d+)/);
			if (match) {
				const filepath = match[1];
				const line = parseInt(match[2], 10);
 				const fileName = path.basename(filepath);
				console.log(`pause at file:${ fileName}, line:${ line}`);

				const breakpointId = PremakeDebugSession.debugSession.generateBreakpointId(filepath, line);
				PremakeDebugSession.debugSession._currentFile = filepath;
				PremakeDebugSession.debugSession._currentLine = line;
				PremakeDebugSession.debugSession.sendEvent(new StoppedEvent("breakpoint",1));
				PremakeDebugSession.debugSession.sendEvent(new BreakpointEvent('new',new Breakpoint(true,line,0,new Source(fileName,filepath))));

			}
			
		} else if(event.startsWith("202 Paused")) {
			
		} else {
			console.log(`new event: ${event}`);
		}
	}
    protected async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments, request?: DebugProtocol.Request): Promise<void> {
		const stackTraces:StackTrace[]  = await this._mobDebugSession!.stack();
		const stackTracesVscode:StackFrame[] = [];
		let id = 0;
		for (const trace of stackTraces){
			const stackFrame:StackFrame = new StackFrame(
				id,
				trace.functionName,
				trace.source,
				trace.endLine,
				1
			);
			id++;
			stackTracesVscode.push(stackFrame);
		}
		response.body = {
			stackFrames: stackTracesVscode,
			totalFrames: stackTracesVscode.length
		};
		this.sendResponse(response);
	}

    protected async stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments, request?: DebugProtocol.Request): Promise<void>
	{
		await this._mobDebugSession?.step();
		this.sendResponse(response);
	}

	protected async stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments, request?: DebugProtocol.Request): Promise<void> {
		await this._mobDebugSession?.stepOut();
		this.sendResponse(response);
	};
	protected async nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments, request?: DebugProtocol.Request): Promise<void>
	{
		await this._mobDebugSession?.stepOver();
		this.sendResponse(response);
	}
	private simpleHash(str:string):number{
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
		}
		return parseInt((hash >>> 0).toString(36));
	}
	private generateBreakpointId(file: string, line: number): number {
		const idString = `${file}:${line}`; 
		return this.simpleHash(idString); 
	}
	private getFileSize(filePath: string): number {
		try {
			const stats = fs.statSync(filePath); // Get file stats
			return stats.size; // Return file size in bytes
		} catch (error) {
			console.error(`Error getting file size for ${filePath}:`, error);
			return 0;
		}
	}
	protected notifyBreakpointHit(path: string, line: number): void {
		const breakpoint = this._breakpoints.get(`${path}:${line}`); 
		if (breakpoint) {
			this.sendEvent(new StoppedEvent('breakpoint', 1, `Breakpoint hit at ${path}:${line}`)); // Optionally, send a BreakpointEvent to update the state in VSCode 
			this.sendEvent(new BreakpointEvent('changed', new Breakpoint(true, line)));
			console.log(`Breakpoint hit at ${path}:${line}`); 
		} else {
			console.log(`No matching breakpoint found at ${path}:${line}`); 
		}
	}
}