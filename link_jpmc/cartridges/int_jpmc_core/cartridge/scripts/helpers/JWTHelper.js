'use strict';

/**
 * JWT expiry in seconds. Since the JWT is created and immediately consumed
 * for token exchange, a short expiry (5 minutes) is sufficient.
 * @type {number}
 */
var JWT_EXPIRY_SECONDS = 300;

/**
 * @returns {string} result
 */
function generateJTI() {
    var UUIDUtils = require('dw/util/UUIDUtils');
    return UUIDUtils.createUUID();
}

/**
 * @param {string} base64 - standard Base64 encoded string
 * @returns {string} Base64URL encoded string
 */
function toBase64URL(base64) {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * @param {string} str - plain text to encode
 * @returns {string} Base64URL encoded string
 */
function base64UrlEncode(str) {
    var Bytes = require('dw/util/Bytes');
    var Encoding = require('dw/crypto/Encoding');
    return toBase64URL(Encoding.toBase64(new Bytes(str, 'UTF-8')));
}

/**
 * @param {Object} config - JWT signing configuration (clientId, keyId, privateKey)
 * @returns {string} signed JWT token
 * @throws {Error}
 */
function generateJWT(config) {
    if (!config || !config.client_id || !config.audience || !config.privateKeyAlias) {
        throw new Error('Missing required JWT config: client_id, audience, privateKeyAlias');
    }

    var Signature = require('dw/crypto/Signature');
    var KeyRef = require('dw/crypto/KeyRef');
    var Bytes = require('dw/util/Bytes');
    var Encoding = require('dw/crypto/Encoding');
    
    var now = Math.floor(Date.now() / 1000);
    var exp = now + JWT_EXPIRY_SECONDS;
    
    var header = { alg: 'RS256', typ: 'JWT', kid: config.kid || '' };
    var payload = {
        jti: generateJTI(),
        iat: now,
        exp: exp,
        aud: config.audience,
        iss: config.client_id,
        sub: config.client_id
    };
    
    var signingInput = base64UrlEncode(JSON.stringify(header)) + '.' + base64UrlEncode(JSON.stringify(payload));
    
    var keyRef = new KeyRef(config.privateKeyAlias);
    var sig = new Signature();
    var sigBytes = sig.signBytes(new Bytes(signingInput, 'UTF-8'), keyRef, 'SHA256withRSA');
    
    return signingInput + '.' + toBase64URL(Encoding.toBase64(sigBytes));
}

module.exports = {
    generateJWT: generateJWT
};
