'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

describe('JWTHelper', function () {
    var JWTHelper;
    var UUIDUtilsMock;
    var BytesMock;
    var EncodingMock;
    var SignatureMock;
    var KeyRefMock;

    beforeEach(function () {
        UUIDUtilsMock = require('../../../../../test/mocks/dw/util/UUIDUtils');
        BytesMock = require('../../../../../test/mocks/dw/util/Bytes');
        EncodingMock = require('../../../../../test/mocks/dw/crypto/Encoding');
        SignatureMock = require('../../../../../test/mocks/dw/crypto/Signature');
        KeyRefMock = require('../../../../../test/mocks/dw/crypto/KeyRef');
        
        UUIDUtilsMock.resetCounter();
        
        JWTHelper = proxyquire('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JWTHelper', {
            'dw/util/UUIDUtils': UUIDUtilsMock,
            'dw/util/Bytes': BytesMock,
            'dw/crypto/Encoding': EncodingMock,
            'dw/crypto/Signature': SignatureMock,
            'dw/crypto/KeyRef': KeyRefMock
        });
    });

    describe('generateJWT', function () {
        it('should generate valid JWT with required config', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key',
                expiresIn: '5h'
            };

            var jwt = JWTHelper.generateJWT(config);

            assert.isString(jwt);
            assert.match(jwt, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
        });

        it('should generate JWT with three parts separated by dots', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key'
            };

            var jwt = JWTHelper.generateJWT(config);
            var parts = jwt.split('.');

            assert.equal(parts.length, 3);
        });

        it('should include correct header in JWT', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key',
                kid: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01'
            };

            var jwt = JWTHelper.generateJWT(config);
            var parts = jwt.split('.');
            var headerBase64 = parts[0];
            
            // Add padding if needed
            var padding = headerBase64.length % 4;
            if (padding > 0) {
                headerBase64 += '='.repeat(4 - padding);
            }
            
            // Convert base64url to base64
            headerBase64 = headerBase64.replace(/-/g, '+').replace(/_/g, '/');
            
            var header = JSON.parse(Buffer.from(headerBase64, 'base64').toString());

            assert.equal(header.alg, 'RS256');
            assert.equal(header.typ, 'JWT');
            assert.equal(header.kid, 'ABCDEF0123456789ABCDEF0123456789ABCDEF01');
        });

        it('should include correct payload in JWT', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key'
            };

            var beforeTime = Math.floor(Date.now() / 1000);
            var jwt = JWTHelper.generateJWT(config);
            var afterTime = Math.floor(Date.now() / 1000);

            var parts = jwt.split('.');
            var payloadBase64 = parts[1];
            
            // Add padding if needed
            var padding = payloadBase64.length % 4;
            if (padding > 0) {
                payloadBase64 += '='.repeat(4 - padding);
            }
            
            // Convert base64url to base64
            payloadBase64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
            
            var payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

            assert.equal(payload.aud, 'https://test.jpmc.com/token');
            assert.equal(payload.iss, 'test-client-id');
            assert.equal(payload.sub, 'test-client-id');
            assert.isString(payload.jti);
            assert.isNumber(payload.iat);
            assert.isNumber(payload.exp);
            assert.isAtLeast(payload.iat, beforeTime);
            assert.isAtMost(payload.iat, afterTime);
            assert.equal(payload.exp, payload.iat + 300);
        });

        it('should ignore expiresIn hours format and use fixed expiration', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key',
                expiresIn: '8h'
            };

            var jwt = JWTHelper.generateJWT(config);
            var parts = jwt.split('.');
            var payloadBase64 = parts[1];
            
            var padding = payloadBase64.length % 4;
            if (padding > 0) {
                payloadBase64 += '='.repeat(4 - padding);
            }
            
            payloadBase64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
            var payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

            assert.equal(payload.exp - payload.iat, 300);
        });

        it('should use default expiration when not provided', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key'
            };

            var jwt = JWTHelper.generateJWT(config);
            var parts = jwt.split('.');
            var payloadBase64 = parts[1];
            
            var padding = payloadBase64.length % 4;
            if (padding > 0) {
                payloadBase64 += '='.repeat(4 - padding);
            }
            
            payloadBase64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
            var payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

            assert.equal(payload.exp - payload.iat, 300);
        });

        it('should throw error when client_id is missing', function () {
            var config = {
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key'
            };

            assert.throws(function () {
                JWTHelper.generateJWT(config);
            }, Error, 'Missing required JWT config');
        });

        it('should throw error when audience is missing', function () {
            var config = {
                client_id: 'test-client-id',
                privateKeyAlias: 'test-key'
            };

            assert.throws(function () {
                JWTHelper.generateJWT(config);
            }, Error, 'Missing required JWT config');
        });

        it('should throw error when privateKeyAlias is missing', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token'
            };

            assert.throws(function () {
                JWTHelper.generateJWT(config);
            }, Error, 'Missing required JWT config');
        });

        it('should throw error when config is null', function () {
            assert.throws(function () {
                JWTHelper.generateJWT(null);
            }, Error, 'Missing required JWT config');
        });

        it('should ignore numeric expiresIn and use fixed expiration', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key',
                expiresIn: 7200
            };

            var jwt = JWTHelper.generateJWT(config);
            var parts = jwt.split('.');
            var payloadBase64 = parts[1];
            
            var padding = payloadBase64.length % 4;
            if (padding > 0) {
                payloadBase64 += '='.repeat(4 - padding);
            }
            
            payloadBase64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
            var payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

            assert.equal(payload.exp - payload.iat, 300);
        });

        it('should ignore string expiresIn and use fixed expiration', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key',
                expiresIn: '3600'
            };

            var jwt = JWTHelper.generateJWT(config);
            var parts = jwt.split('.');
            var payloadBase64 = parts[1];
            
            var padding = payloadBase64.length % 4;
            if (padding > 0) {
                payloadBase64 += '='.repeat(4 - padding);
            }
            
            payloadBase64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
            var payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

            assert.equal(payload.exp - payload.iat, 300);
        });

        it('should use empty string for kid when not provided', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key'
            };

            var jwt = JWTHelper.generateJWT(config);
            var parts = jwt.split('.');
            var headerBase64 = parts[0];
            
            var padding = headerBase64.length % 4;
            if (padding > 0) {
                headerBase64 += '='.repeat(4 - padding);
            }
            
            headerBase64 = headerBase64.replace(/-/g, '+').replace(/_/g, '/');
            var header = JSON.parse(Buffer.from(headerBase64, 'base64').toString());

            assert.equal(header.kid, '');
        });

        it('should generate unique jti for each JWT', function () {
            var config = {
                client_id: 'test-client-id',
                audience: 'https://test.jpmc.com/token',
                privateKeyAlias: 'test-key'
            };

            var jwt1 = JWTHelper.generateJWT(config);
            var jwt2 = JWTHelper.generateJWT(config);

            var parts1 = jwt1.split('.');
            var parts2 = jwt2.split('.');
            
            var payload1Base64 = parts1[1];
            var payload2Base64 = parts2[1];
            
            var padding1 = payload1Base64.length % 4;
            if (padding1 > 0) {
                payload1Base64 += '='.repeat(4 - padding1);
            }
            
            var padding2 = payload2Base64.length % 4;
            if (padding2 > 0) {
                payload2Base64 += '='.repeat(4 - padding2);
            }
            
            payload1Base64 = payload1Base64.replace(/-/g, '+').replace(/_/g, '/');
            payload2Base64 = payload2Base64.replace(/-/g, '+').replace(/_/g, '/');
            
            var payload1 = JSON.parse(Buffer.from(payload1Base64, 'base64').toString());
            var payload2 = JSON.parse(Buffer.from(payload2Base64, 'base64').toString());

            assert.notEqual(payload1.jti, payload2.jti);
        });
    });
});
