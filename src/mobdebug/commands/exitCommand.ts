import { Command } from "./command";

export class ExitCommand implements Command {
    private _command: string = "EXIT\n";
    toString(): string {
        return this._command;
    }
    toVerboseString(): string {
        return `[command.exit]`;
    }
    
}