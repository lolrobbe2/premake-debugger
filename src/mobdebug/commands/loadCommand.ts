import { PremakeConfig } from "../../config";
import { Command } from "./command";
import * as fs from 'fs';

export class LoadCommand implements Command {
    private _size: number;
    private _file: string;
    private _command: string;
    private _fileContent: string = "";

    constructor(size: number, file: string) {
        this._size = size;
        this._file = file;
        this._command = `LOAD ${this._size} ${file}\n`;
    }

    toString():string {
        
        return this._command + this._fileContent;
    }

    setFileContent(content: string): void { this._fileContent = content; }
    
    toVerboseString(): string {
        return `[command.load(size: ${this._size}, file: ${this._file})]`;
    }

    async readFile(filePath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            fs.readFile(filePath, 'utf-8', (err: any, data: string | Promise<string>) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
}
