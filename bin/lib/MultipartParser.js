"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTS
// =================================================================================================
const Busboy = require("busboy");
const defaults_1 = require("./defaults");
// PUBLIC FUNCTIONS
// =================================================================================================
function buildParser(options) {
    options = options || defaults_1.defaults.multipartParser;
    const filters = buildFilters(options.filter);
    const busboyConfig = buildBusboyConfig(options);
    return function (request, context) {
        return new Promise((resolve, reject) => {
            let errorOccurred = false;
            // TODO: validate that body is a buffer
            const options = Object.assign({}, busboyConfig, { headers: request.headers });
            const busboy = new Busboy(options);
            const body = {};
            const fileCounts = {};
            // parse incoming files
            busboy.on('file', (fieldName, fileStream, fileName, encoding, mimeType) => {
                // check if we need to skip the field
                let maxCount = Number.POSITIVE_INFINITY;
                if (filters) {
                    maxCount = filters.get(fieldName) || 0;
                    if (maxCount === 0) {
                        fileStream.resume();
                        return;
                    }
                }
                // make sure maxCount has not been exceeded
                let fileCount = fileCounts[fieldName] || 0;
                if (fileCount >= maxCount) {
                    fileStream.on('error', (error) => {
                        context.log.error(new Error('FileStream error: ' + error.message));
                        abortWithError(error);
                    });
                    fileStream.destroy(new Error('test1'));
                    //fileStream.resume();
                    return;
                }
                fileCounts[fieldName] = fileCount = fileCount + 1;
                // prepare the field
                let fieldContent = body[fieldName];
                if (!fieldContent || !Array.isArray(fieldContent)) {
                    body[fieldName] = fieldContent = [];
                }
                let buffer = undefined;
                fileStream.on('data', (data) => {
                    buffer = data;
                });
                fileStream.on('error', (error) => {
                    // TODO: use custom error?
                    abortWithError(error);
                });
                fileStream.on('end', () => {
                    fieldContent.push({ fileName, encoding, mimeType, buffer });
                });
                fileStream.on('limit', () => {
                    // TODO: throw error
                });
            });
            // parse incoming fields
            busboy.on('field', (fieldName, fieldValue, nameTruncated, valueTruncated, encoding, mimeType) => {
                if (nameTruncated) {
                    // TODO: throw error
                }
                else if (valueTruncated) {
                    // TODO: throw error
                }
                else {
                    body[fieldName] = fieldValue;
                }
            });
            busboy.on('finish', () => {
                if (errorOccurred)
                    return;
                // flatten fields with maxCount = 1
                if (filters) {
                    for (let [fieldName, maxCount] of filters.entries()) {
                        if (maxCount === 1) {
                            let fieldContent = body[fieldName];
                            if (fieldContent && fieldContent.length === 1) {
                                body[fieldName] = fieldContent[0];
                            }
                        }
                    }
                }
                resolve(body);
            });
            busboy.on('error', abortWithError);
            busboy.on('partsLimit', () => abortWithError(new Error(errors.partCountExceeded)));
            busboy.on('filesLimit', () => abortWithError(new Error(errors.fileCountExceeded)));
            busboy.on('fieldsLimit', () => abortWithError(new Error(errors.fieldCountExceeded)));
            busboy.write(request.body);
            function abortWithError(error) {
                context.log.error(new Error('Error:' + error.message + '[' + errorOccurred + ']'));
                if (errorOccurred)
                    return;
                errorOccurred = true;
                busboy.destroy(new Error('test2'));
                reject(error);
            }
        });
    };
}
exports.buildParser = buildParser;
// HELPER FUNCTIONS
// =================================================================================================
function buildFilters(filterOrFilters) {
    if (!filterOrFilters)
        return undefined;
    const filters = Array.isArray(filterOrFilters) ? filterOrFilters : [filterOrFilters];
    const filterMap = new Map();
    for (let filter of filters) {
        if (typeof filter.field !== 'string')
            throw new TypeError('Filter field must be a string');
        if (filter.maxCount !== undefined && filter.maxCount !== null) {
            if (!Number.isInteger(filter.maxCount))
                throw new TypeError('Filter maxCount must be an integer');
            if (filter.maxCount <= 0)
                throw new TypeError('Filter maxCount must be greater than 0');
        }
        filterMap.set(filter.field, filter.maxCount || Number.POSITIVE_INFINITY);
    }
    return filterMap;
}
function buildBusboyConfig(options) {
    return {
        highWaterMark: defaults_1.defaults.multipartParser.bodyHighWaterMark,
        fileHwm: defaults_1.defaults.multipartParser.fileHighWaterMark,
        defCharset: defaults_1.defaults.multipartParser.defaultCharset,
        preservePath: defaults_1.defaults.multipartParser.preservePath,
        limits: Object.assign({}, defaults_1.defaults.multipartParser.limits, options.limits)
    };
}
// MULTIPART ERRORS
// =================================================================================================
const errors = {
    partCountExceeded: 'Too many parts',
    fileCountExceeded: 'Too many files',
    fileSizeExceeded: 'File size too large',
    fieldCountExceeded: 'Too many fields',
    fieldNameTruncated: 'Field name too long',
    filedValueTruncated: 'Field value too long'
};
//# sourceMappingURL=MultipartParser.js.map