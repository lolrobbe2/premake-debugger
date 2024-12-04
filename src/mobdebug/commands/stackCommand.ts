import { Command } from "./command";

export class StackCommand implements Command {
    private _command: string = "STACK {nocode = true,compact = true, sparse = true, maxlevel = 0}\n";
    toString(): string {
        return this._command;
    }
    toVerboseString(): string {
        return `[command.stack]`;
    }

}