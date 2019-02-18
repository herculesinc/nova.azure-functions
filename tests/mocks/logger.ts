// IMPORTS
// =================================================================================================
import { Logger } from '@nova/azure-functions';
import { TraceSource, TraceCommand } from '@nova/core';

// CLASS DEFINITION
// =================================================================================================
export class MockLogger implements Logger {
    operationId = 'test-operation';

    debug(message: string) {}
    info(message: string) {}
    warn(message: string) {}
    error(error: Error) {}
    trace(source: TraceSource, command: string | TraceCommand, duration: number, success: boolean) {}
    close(resultCode: number, success: boolean, properties?: { [key: string]: string; } ) {}
}
