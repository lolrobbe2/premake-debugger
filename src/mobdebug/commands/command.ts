export interface Command {
    //converts the command to a string
    toString(): string;
    toVerboseString(): string;
}