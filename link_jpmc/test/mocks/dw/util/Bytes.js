'use strict';

/**
 * Mock for dw.util.Bytes
 * @param {string|Array} data - String or byte array
 * @param {string} encoding - Encoding type (e.g., 'UTF-8')
 */
function Bytes(data, encoding) {
    this.data = data;
    this.encoding = encoding || 'UTF-8';
    
    if (typeof data === 'string') {
        this.bytes = Buffer.from(data, encoding === 'UTF-8' ? 'utf8' : encoding);
    } else {
        this.bytes = Buffer.from(data);
    }
}

Bytes.prototype.toString = function (encoding) {
    return this.bytes.toString(encoding || this.encoding);
};

Bytes.prototype.length = function () {
    return this.bytes.length;
};

module.exports = Bytes;
