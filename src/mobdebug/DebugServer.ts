import { EventEmitter } from 'events';
import * as Net from 'net';
import * as vscode from 'vscode';

import { assert } from 'console';
import { DebugAdapterDescriptor, DebugAdapterServer, ProviderResult } from 'vscode';
import { MobDebug } from './Mobdebug';

/*
*/
export class DebugServer extends EventEmitter {
    readonly host:string;
    readonly port;
    private server?: Net.Server;

    constructor(address: string, port: number){
        super();
        this.host = address;
        this.port = port;
    }
    public process(){
        let inst = this;

        let server = Net.createServer(socket => {
            this.processConnection(socket);
        });
        vscode.window.showInformationMessage('Debug Server started');

        //listen TCP
        server.listen(this.port, this.host, 0, function () {
            let address = <Net.AddressInfo>server.address();
            let listeningAddress: string;
            if (address.family === 'IPv6') {
                listeningAddress = `[${address.address}]:${address.port}`;
            } else {
                listeningAddress = `${address.address}:${address.port}`;
            }
        });
        this.server = server;
    }
    private processConnection(socket: Net.Socket){
        const mobDebugSession = new MobDebug(socket);
        vscode.window.showInformationMessage(`new mobdebug connection(port: ${socket.localPort} , host: ${socket.remoteAddress}`);

        if (!this.emit('session', mobDebugSession)) {
            mobDebugSession.stop();
        }
    }
    public close() {
        vscode.window.showInformationMessage('stopped debug sever');
        this.server?.close();
    }
}