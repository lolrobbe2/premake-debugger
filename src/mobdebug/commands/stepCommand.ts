import { Command } from "./command";

export class StepCommand implements Command {
    private _command: string = "STEP\n";
    toString(): string {
        return this._command;
    }
    toVerboseString(): string {
        return `[command.step]`;
    }

}