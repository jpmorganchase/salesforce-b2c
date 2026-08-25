'use strict';

var crypto = require('crypto');
var path = require('path');

/**
 * Mock for dw.crypto.Signature
 */
function Signature() {}

Signature.prototype.signBytes = function (bytes, keyRef, algorithm) {
    // Mock implementation - in real tests, you might want to use actual crypto
    var mockPrivateKey = keyRef.getMockPrivateKey();
    
    if (!mockPrivateKey) {
        // Return a mock signature for testing
        var Bytes = require(path.join(__dirname, '../util/Bytes'));
        return new Bytes('mock-signature-' + Date.now());
    }
    
    // If a real key is provided, use it
    var sign = crypto.createSign('RSA-SHA256');
    sign.update(bytes.bytes || bytes);
    var signature = sign.sign(mockPrivateKey);
    
    var BytesClass = require(path.join(__dirname, '../util/Bytes'));
    return new BytesClass(signature);
};

module.exports = Signature;
