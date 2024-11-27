import { DebugAdapterDescriptor, DebugAdapterExecutable, DebugAdapterInlineImplementation, DebugSession, ProviderResult } from 'vscode';
import { PremakeConfig } from '../config';
import { PremakeDebugSession } from '../debugSession';
import { DebugServer } from "../mobdebug/DebugServer";

export class DebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {
    private server?: DebugServer;
    private session?: PremakeDebugSession;
    createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable | undefined): ProviderResult<DebugAdapterDescriptor> {
        if (!this.server) {
            const config: PremakeConfig = new PremakeConfig();
            this.server = new DebugServer(config.host,config.port);
            this.server.process();
            this.session = new PremakeDebugSession(this.getServer()!);

        }
        return new DebugAdapterInlineImplementation(this.session!);
        
    }
    dispose() {
        if (this.server) {
            this.server.close();
            this.server = undefined;
            this.session?.dispose();
        }
    }
    public getServer(): DebugServer | undefined {
        return this.server;
    }
}