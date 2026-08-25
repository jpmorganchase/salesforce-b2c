'use strict';

/**
 * Mock for dw.crypto.Encoding
 */
function Encoding() {}

Encoding.toBase64 = function (bytes) {
    if (bytes && bytes.bytes) {
        return bytes.bytes.toString('base64');
    }
    return Buffer.from(bytes).toString('base64');
};

Encoding.fromBase64 = function (str) {
    return Buffer.from(str, 'base64');
};

module.exports = Encoding;
