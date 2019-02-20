// IMPORTS
// =================================================================================================
import { Credentials, StringBag } from '@nova/azure-functions';

// MODULE VARIABLES
// =================================================================================================
const IPV4_REGEX =  /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/;

// HEADERS
// =================================================================================================
export function parseAuthHeader(headers: StringBag): Credentials {
    const header = headers['authorization'] || headers['Authorization']
    if (!header) return undefined;

    const authParts = header.split(' ');
    if(authParts.length !== 2) return null;
    return {
        type    : authParts[0],
        data    : authParts[1]
    };
}

export function getIpAddress (headers: StringBag): string {
    const header = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
    if (!header) return undefined;

    const addresses = parseForwardedHeader(header);
    const clientAddress = addresses[0];
    if (!clientAddress) return undefined;

    let ip = matchIpV4(clientAddress);
    if (ip) return ip;

    // TODO: implement IPV6 parsing
}

// IP PARSING
// =================================================================================================
function parseForwardedHeader(header: string): string[] {
    let end = header.length;
    let list = [];
    let start = header.length;

    // gather addresses, backwards
    for (let i = header.length - 1; i >= 0; i--) {
        switch (header.charCodeAt(i)) {
            case 0x20: /*   */ {
                if (start === end) {
                    start = end = i;
                }
                break;
            }
            case 0x2c: /* , */ {
                if (start !== end) {
                    list.push(header.substring(start, end));
                }
                start = end = i;
                break;
            }
            default: {
                start = i;
                break;
            }
        }
    }

    // final address
    if (start !== end) {
        list.push(header.substring(start, end));
    }

    return list;
}

export function matchIpV4(value: string): string {
    if (!value) return undefined;
    const result = value.match(IPV4_REGEX);
    if (result) return result[0];
}

// PATH CHECKING
// =================================================================================================
export function cleanPath(path: string) {
    if (!path) throw new TypeError(`Path '${path}' is not valid`);
    if (typeof path !== 'string') throw new TypeError(`Path '${path}' is not valid: path must be a string`);
    if (path.charAt(0) !== '/') throw new TypeError(`Path '${path}' is not valid: path must start with '/'`);
    if (path !== '/') {
        while (path.charAt(path.length - 1) === '/') {
            path = path.slice(0, -1);   // removes last character
            if (path.length === 1) break;
        }
    }
    return path;
}

// FUNCTION CHECKING
// =================================================================================================
export function isRegularFunction(fun: Function): boolean {
    if (typeof fun !== 'function') return false;

    const definition = fun.toString();
    return (definition.startsWith('function') || definition.startsWith('async function'));
}
