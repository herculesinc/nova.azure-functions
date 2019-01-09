"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// MODULE VARIABLES
// =================================================================================================
const IPV4_REGEX = /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/;
// HEADERS
// =================================================================================================
function parseAuthHeader(headers) {
    const header = headers['authorization'] || headers['Authorization'];
    if (!header)
        return undefined;
    const authParts = header.split(' ');
    if (authParts.length !== 2)
        return null;
    return {
        type: authParts[0],
        data: authParts[1]
    };
}
exports.parseAuthHeader = parseAuthHeader;
function getIpAddress(headers) {
    const header = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
    if (!header)
        return undefined;
    const addresses = parseForwardedHeader(header);
    const clientAddress = addresses[0];
    if (!clientAddress)
        return undefined;
    let ip = matchIpV4(clientAddress);
    if (ip)
        return ip;
    // TODO: implement IPV6 parsing
}
exports.getIpAddress = getIpAddress;
// IP PARSING
// =================================================================================================
function parseForwardedHeader(header) {
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
function matchIpV4(value) {
    if (!value)
        return undefined;
    const result = value.match(IPV4_REGEX);
    if (result)
        return result[0];
}
exports.matchIpV4 = matchIpV4;
//# sourceMappingURL=util.js.map