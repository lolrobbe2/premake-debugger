import { Command } from "./command";

export class StepOverCommand implements Command {
    private _command: string = "OVER\n";
    toString(): string {
        return this._command;
    }
    toVerboseString(): string {
        return `[command.over]`;
    }

}