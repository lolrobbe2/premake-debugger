import { Command } from "./command";

export class SuspendCommand implements Command {
    private _command: string = "SUSPEND\n";
    toString(): string {
        return this._command;
    }
    toVerboseString(): string {
        return `[command.suspend]`;
    }
    
}