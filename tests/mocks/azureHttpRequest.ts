// IMPORTS
// =================================================================================================
import {
    AzureHttpRequest, HttpMethod
} from 'azure-functions';

type obj = { [param: string]: string; };

// CLASS DEFINITION
// =================================================================================================
export class AzureHttpReq implements AzureHttpRequest {
    readonly method: HttpMethod;
    readonly url: string;
    readonly originalUrl: string;
    readonly headers: obj;
    readonly query?: obj;
    readonly params?: obj;
    readonly body?: object | Buffer | string;
    readonly rawBody?: string;

    constructor (method: HttpMethod, url: string, headers?: obj, query?: obj, body?: obj) {
        this.method = method;

        this.url = url;
        this.originalUrl = url;

        this.headers = {
            'content-type': 'application/json',
            ...(headers || {})
        };

        const [protocol, rest] = url.split('//');
        const [origin, ...path] = rest.split('/');

        this.query = query || {};
        this.params = {route: path.join('/')};
        this.body = body || {};
        this.rawBody = JSON.stringify(this.body);
    }
}
