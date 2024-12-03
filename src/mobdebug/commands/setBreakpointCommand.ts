import { Command } from "./command";

export class SetBreakpointCommand implements Command {
    private _file: string;
    private _line: number;
    private _command: string;
    constructor(file: string, line: number) {
        this._file = file;
        this._line = line;
        this._command = `SETB ${this._file} ${this._line}\n`;
    }
    toString(): string {
        return this._command;
    }
    toVerboseString(): string {
        return `[command.setBreakpoint(file: ${this._file}, line: ${this._line})]`;
    }
}