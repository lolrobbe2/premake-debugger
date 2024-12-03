import { Command } from "./command";

export class BasedirCommand implements Command {
    readonly _command: string;
    constructor(dir:string) {
        this._command = `BASEDIR ${dir.replace(/\\/g,'/')}\n`;
    }
    toString(): string {
        return this._command;
    }
    toVerboseString(): string {
        return `[command.basedir]`;
    }
    
}