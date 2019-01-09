declare module 'busboy' {

    module busboy {
        interface BusboyConfig {
            headers?        : object;
            highWaterMark?  : number;
            fileHwm?        : number;
            defCharset?     : string;
            preservePath?   : string;
            limits?         : BusboyLimits;
        }
    
        interface BusboyLimits {
            fieldNameSize?  : number;   // bytes, default 100
            fieldSize       : number;   // bytes, default 1MB
            fields?         : number;   // default infinity
            fileSize?       : number;   // bytes, default infinity
            files?          : number;   // default infinity
            parts?          : number;   // files+fields, default infinity
            headerPairs?    : number;   // default 2000
        }
    
        interface FileHandler {
            (fieldName: string, stream: NodeJS.ReadableStream, fileName: string, encoding: string, mimetype: string): void;
        }
    
        interface FieldHandler {
            (fieldName: string, fieldValue: string, nameTruncated: boolean, valueTruncated: boolean, encoding: string, mimetype: string): void;
        }
    
        interface Busboy extends NodeJS.WritableStream {
            on(event: 'file', handler: FileHandler): this;
            on(event: 'field', handler: FieldHandler): this;
            on(event: 'finish', handler: () => void): this;
            on(event: 'partsLimit', handler: () => void): this;
            on(event: 'filesLimit', handler: () => void): this;
            on(event: 'fieldsLimit', handler: () => void): this;
            on(event: string, handler: Function): this;

            destroy(error?: Error);
        }
    
        interface BusboyConstructor {
            new (options: BusboyConfig): Busboy;
        }
    }

    const busboy: busboy.BusboyConstructor;
    export = busboy;
}