/// <reference path="../node/node.d.ts" />

declare module "type-is" {
    import http = require("http");

    module typeIs { 
        export function hasBody(request: http.IncomingMessage): boolean;
        export function is(mediaType: string, types: string[]): string | boolean;
    }

    function typeIs(request: http.IncomingMessage, types: string[]): string | boolean;

    export = typeIs;
}