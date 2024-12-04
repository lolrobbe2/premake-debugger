import { Command } from "./command";

export class StepOutCommand implements Command {
    private _command: string = "OUT\n";
    toString(): string {
        return this._command;
    }
    toVerboseString(): string {
        return `[command.out]`;
    }

}