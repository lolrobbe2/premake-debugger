import { Command } from "./command";

export class RunCommand implements Command {
    private _command: string = "RUN\n";
    toString(): string {
        return this._command;
    }
    toVerboseString(): string {
        return `[command.run]`;
    }
    
}