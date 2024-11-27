import {
	InitializedEvent,
	LoggingDebugSession
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { DebugServer } from './mobdebug/DebugServer';
import { MobDebug } from './mobdebug/Mobdebug';
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
    private static threadID = 1;

    private _reportProgress = false;
    private _useInvalidatedEvent = false;
	readonly _configurationDone: Promise<void>;
	
	private _configurationDoneResolve: () => void = () => {};
	readonly eventListener: DebugServer;
	private _mobDebugSession:MobDebug | null = null;
    public constructor(emitter: DebugServer) {
		super("mock-debug.txt");
        this.setDebuggerLinesStartAt1(false);
		this.setDebuggerColumnsStartAt1(false);

		this._configurationDone = new Promise<void>((resolve) => {
       		this._configurationDoneResolve = resolve;
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
        // since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendResponse(response);
		this.sendEvent(new InitializedEvent());

    }

    /**
	 * Called at the end of the configuration sequence.
	 * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		if (this._configurationDoneResolve) {
			this._configurationDoneResolve();
		}
		
	}
	protected async attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArguments) {
		return this.launchRequest(response, args);
	}
	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) {
		await this._configurationDone;
		console.log("launched succesfuly");
	}

	protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> {
		const source = args.source;
		let filename = '';

		// Check if 'source' exists and has a 'name' or 'path' property
		if (source) {
			// The filename might be in the 'name' or 'path' property
			filename = source.name || source.path || 'Unknown File';
		}

		// Log the filename (you can process it further as needed)
		console.log(`Setting breakpoints for file: ${filename}`);

		// Now, proceed with handling the breakpoints as usual
		const breakpoints = args.breakpoints || [];
		if(filename === 'unknown File') {
			vscode.window.showErrorMessage(`unable to set breakpoints for unkown file!`);
			this.sendResponse(response);
			return;
		}
		if(this._mobDebugSession === undefined)
		{
			vscode.window.showErrorMessage(`mobDebugSession was undefined!`);
			this.sendResponse(response);
			return;
		}
		breakpoints.forEach(breakpoint => {
			this._mobDebugSession?.setBreakpoint(filename, breakpoint.line);
		});
	}
	private async onSession(session: MobDebug): Promise<void> {
        console.log(`Session event received for: ${session}`);
		if(this._mobDebugSession){
			this._mobDebugSession.stop();
		}
        this._mobDebugSession = session;
		console.log(await this._mobDebugSession.run());
    }
}