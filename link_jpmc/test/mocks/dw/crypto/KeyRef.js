'use strict';

/**
 * Mock for dw.crypto.KeyRef
 * @param {string} alias - Key alias
 */
function KeyRef(alias) {
    this.alias = alias;
    this.mockPrivateKey = null;
}

KeyRef.prototype.getAlias = function () {
    return this.alias;
};

KeyRef.prototype.setMockPrivateKey = function (key) {
    this.mockPrivateKey = key;
};

KeyRef.prototype.getMockPrivateKey = function () {
    return this.mockPrivateKey;
};

module.exports = KeyRef;
