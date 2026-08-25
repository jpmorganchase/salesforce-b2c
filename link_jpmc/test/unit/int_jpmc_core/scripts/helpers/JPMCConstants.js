'use strict';

var assert = require('chai').assert;

describe('jpmcConstants', function () {
    var jpmcConstants = require('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JPMCConstants');

    it('should export JPMC_Processor constant', function () {
        assert.equal(jpmcConstants.JPMC_Processor, 'JPMC_Payment');
    });

    it('should export TRANSACTION_STATE constants', function () {
        assert.isObject(jpmcConstants.TRANSACTION_STATE);
        assert.equal(jpmcConstants.TRANSACTION_STATE.AUTHORIZED, 'AUTHORIZED');
        assert.equal(jpmcConstants.TRANSACTION_STATE.CLOSED, 'CLOSED');
        assert.equal(jpmcConstants.TRANSACTION_STATE.DECLINED, 'DECLINED');
    });

    it('should export APPLE_PAY_PROTOCOL constants', function () {
        assert.isObject(jpmcConstants.APPLE_PAY_PROTOCOL);
        assert.equal(jpmcConstants.APPLE_PAY_PROTOCOL.EC_V1, 'EC_v1');
        assert.equal(jpmcConstants.APPLE_PAY_PROTOCOL.RSA_V1, 'RSA_v1');
    });

    it('should export Google Pay constants', function () {
        assert.equal(jpmcConstants.JPMC_GOOGLE_PAY, 'JPMC_GOOGLE_PAY');
        assert.equal(jpmcConstants.GOOGLE_PAY_WALLET_PROVIDER, 'GOOGLE_PAY');
    });

    it('should export token management constants', function () {
        assert.equal(jpmcConstants.TOKEN_CACHE_ID, 'jpmc_access_token_cache');
        assert.equal(jpmcConstants.TOKEN_CACHE_KEY, 'jpmc_access_token');
        assert.equal(jpmcConstants.TOKEN_CUSTOM_OBJECT_TYPE, 'JPMCAccessToken');
        assert.equal(jpmcConstants.CLOCK_SKEW_SECONDS, 30);
    });

    it('should export keystore alias defaults', function () {
        assert.equal(jpmcConstants.DEFAULT_CERT_ALIAS, 'jpmc-certificate');
        assert.equal(jpmcConstants.DEFAULT_KEY_ALIAS, 'jpmc-private-key');
    });

    it('should export config defaults', function () {
        assert.equal(jpmcConstants.DEFAULT_COMPANY_NAME, 'JPMC Plugin');
        assert.equal(jpmcConstants.DEFAULT_PRODUCT_NAME, 'JPMC SFCC SFRA Cartridge');
        assert.equal(jpmcConstants.DEFAULT_VERSION, '1.0');
        assert.equal(jpmcConstants.DEFAULT_TOKEN_TYPE, 'SAFETECH_TOKEN');
        assert.equal(jpmcConstants.DEFAULT_CAPTURE_METHOD, 'MANUAL');
    });

    it('should export validation constants', function () {
        assert.isArray(jpmcConstants.VALID_CAPTURE_METHODS);
        assert.include(jpmcConstants.VALID_CAPTURE_METHODS, 'MANUAL');
        assert.include(jpmcConstants.VALID_CAPTURE_METHODS, 'DELAYED');
        assert.include(jpmcConstants.VALID_CAPTURE_METHODS, 'NOW');
        assert.equal(jpmcConstants.VALID_CAPTURE_METHODS.length, 3);
    });

    it('should export ALIAS_PATTERN regex', function () {
        assert.instanceOf(jpmcConstants.ALIAS_PATTERN, RegExp);
        assert.isTrue(jpmcConstants.ALIAS_PATTERN.test('jpmc-certificate'));
        assert.isTrue(jpmcConstants.ALIAS_PATTERN.test('jpmc_private_key'));
        assert.isTrue(jpmcConstants.ALIAS_PATTERN.test('test123'));
        assert.isFalse(jpmcConstants.ALIAS_PATTERN.test('invalid alias'));
        assert.isFalse(jpmcConstants.ALIAS_PATTERN.test(''));
    });

    it('should export THUMBPRINT_PATTERN regex', function () {
        assert.instanceOf(jpmcConstants.THUMBPRINT_PATTERN, RegExp);
        assert.isTrue(jpmcConstants.THUMBPRINT_PATTERN.test('ABCDEF0123456789ABCDEF0123456789ABCDEF01'));
        assert.isFalse(jpmcConstants.THUMBPRINT_PATTERN.test('abcdef0123456789abcdef0123456789abcdef01'));
        assert.isFalse(jpmcConstants.THUMBPRINT_PATTERN.test('ABCDEF0123456789'));
        assert.isFalse(jpmcConstants.THUMBPRINT_PATTERN.test('GHIJKL0123456789ABCDEF0123456789ABCDEF01'));
    });

    it('should have all expected properties', function () {
        var expectedKeys = [
            'JPMC_Processor',
            'TRANSACTION_STATE',
            'APPLE_PAY_PROTOCOL',
            'JPMC_GOOGLE_PAY',
            'GOOGLE_PAY_WALLET_PROVIDER',
            'TOKEN_CACHE_ID',
            'TOKEN_CACHE_KEY',
            'TOKEN_CUSTOM_OBJECT_TYPE',
            'CLOCK_SKEW_SECONDS',
            'DEFAULT_CERT_ALIAS',
            'DEFAULT_KEY_ALIAS',
            'DEFAULT_COMPANY_NAME',
            'DEFAULT_PRODUCT_NAME',
            'DEFAULT_VERSION',
            'DEFAULT_TOKEN_TYPE',
            'DEFAULT_CAPTURE_METHOD',
            'VALID_CAPTURE_METHODS',
            'ALIAS_PATTERN',
            'THUMBPRINT_PATTERN'
        ];

        expectedKeys.forEach(function (key) {
            assert.property(jpmcConstants, key, 'Missing property: ' + key);
        });
    });
});
