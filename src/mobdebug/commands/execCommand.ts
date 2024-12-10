import { Command } from "./command";

export class ExecCommand implements Command {
    private _statement: string ="";
    private _command: string = "";
    constructor(statement: string) {
        this._statement = statement;
        this._command = `EXEC ${this._statement}\n`;
    }
    toString(): string {
        return this._command;
    }
    toVerboseString(): string {
        return `[command.exec(statement: ${this._statement})]`;
    }

}