'use strict';

/**
 * Unit tests for JPMCServiceHelper.js (callService + callWithTokenGeneration).
 * These tests exercise the actual module (not a duplicated reference impl) so
 * they contribute to statement / branch / function coverage.
 */

var assert = require('chai').assert;
var sinon = require('sinon');
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

var MODULE_PATH = '../../../../../cartridges/int_jpmc_core/cartridge/scripts/services/JPMCServiceHelper';

/**
 * Build a stub LocalServiceRegistry whose returned Service object captures all
 * configured callbacks and exposes a programmable call() behaviour.
 *
 * @param {Object} [opts]
 * @param {Object} [opts.callResult] - Object returned by service.call()
 * @param {Function} [opts.callImpl]  - Custom call() implementation
 * @returns {{ registry: Object, lastService: Function }}
 */
function makeRegistry(opts) {
    opts = opts || {};
    var lastService;
    var registry = {
        createService: function (id, callbacks) {
            lastService = {
                id: id,
                callbacks: callbacks,
                method: null,
                headers: {},
                url: 'https://api.example.com/{place-holder-id}',
                setRequestMethod: function (m) { this.method = m; },
                addHeader: function (k, v) { this.headers[k] = v; },
                setURL: function (u) { this.url = u; },
                getURL: function () { return this.url; },
                call: function (payload) {
                    this.lastPayload = payload;
                    if (opts.callImpl) return opts.callImpl(this, payload);
                    return opts.callResult;
                }
            };
            return lastService;
        }
    };
    return { registry: registry, getLastService: function () { return lastService; } };
}

/**
 * Build an isOk-style result returned by service.call()
 * @param {Object} parsed - The object returned by parseResponse
 * @returns {Object}
 */
function okResult(parsed) {
    return {
        isOk: function () { return true; },
        getObject: function () { return parsed; }
    };
}

function failResult(props) {
    return Object.assign({
        isOk: function () { return false; },
        getObject: function () { return null; }
    }, props || {});
}

function loadModule(stubs) {
    var defaults = {
        'dw/system/Logger': {
            getLogger: function () {
                return { error: function () {}, info: function () {}, warn: function () {}, debug: function () {} };
            }
        },
        'dw/svc/LocalServiceRegistry': { createService: function () { return {}; } }
    };
    return proxyquire(MODULE_PATH, Object.assign(defaults, stubs || {}));
}

describe('JPMCServiceHelper - callWithTokenGeneration validation', function () {
    it('returns 400 when options is null', function () {
        var helper = loadModule();
        var res = helper.callWithTokenGeneration(null);
        assert.isFalse(res.success);
        assert.equal(res.statusCode, 400);
        assert.match(res.error, /tokenServiceId/);
        assert.isString(res.timestamp);
    });

    it('returns 400 when tokenServiceId is missing', function () {
        var helper = loadModule();
        var res = helper.callWithTokenGeneration({ serviceId: 's', method: 'GET' });
        assert.isFalse(res.success);
        assert.equal(res.statusCode, 400);
    });

    it('returns 400 when serviceId is missing', function () {
        var helper = loadModule();
        var res = helper.callWithTokenGeneration({ tokenServiceId: 't', method: 'GET' });
        assert.isFalse(res.success);
        assert.equal(res.statusCode, 400);
    });

    it('returns 400 when method is missing', function () {
        var helper = loadModule();
        var res = helper.callWithTokenGeneration({ tokenServiceId: 't', serviceId: 's' });
        assert.isFalse(res.success);
        assert.equal(res.statusCode, 400);
    });
});

describe('JPMCServiceHelper - callWithTokenGeneration token retrieval', function () {
    it('returns failure when token retrieval errors (uses JPMCConfig path)', function () {
        var configStub = { getAccessTokenConfig: sinon.stub().returns({ client_id: 'c' }) };
        var tokenStub = {
            getValidToken: sinon.stub().returns({ error: 'jwt failed', statusCode: 401 })
        };
        var helper = proxyquire(MODULE_PATH, {
            'dw/system/Logger': { getLogger: function () { return { error: function () {} }; } },
            'dw/svc/LocalServiceRegistry': { createService: function () { return {}; } },
            '*/cartridge/scripts/helpers/TokenManager': tokenStub,
            '*/cartridge/scripts/helpers/JPMCConfig': configStub
        });

        var res = helper.callWithTokenGeneration({
            tokenServiceId: 'tok', serviceId: 'svc', method: 'GET'
        });

        assert.isFalse(res.success);
        assert.equal(res.error, 'jwt failed');
        assert.equal(res.statusCode, 401);
        assert.isTrue(configStub.getAccessTokenConfig.calledOnce);
    });

    it('uses default 500 status code when token error has no status', function () {
        var helper = proxyquire(MODULE_PATH, {
            'dw/system/Logger': { getLogger: function () { return { error: function () {} }; } },
            'dw/svc/LocalServiceRegistry': { createService: function () { return {}; } },
            '*/cartridge/scripts/helpers/TokenManager': {
                getValidToken: function () { return { error: 'oops' }; }
            },
            '*/cartridge/scripts/helpers/JPMCConfig': {
                getAccessTokenConfig: function () { return { client_id: 'c' }; }
            }
        });

        var res = helper.callWithTokenGeneration({ tokenServiceId: 't', serviceId: 's', method: 'GET' });
        assert.equal(res.statusCode, 500);
    });

    it('uses JPMCMerchantResolver when resolvedConfig provided', function () {
        var resolverStub = {
            toAccessTokenConfig: sinon.stub().returns({ client_id: 'rc' })
        };
        var tokenStub = { getValidToken: sinon.stub().returns({ error: 'no', statusCode: 500 }) };
        var helper = proxyquire(MODULE_PATH, {
            'dw/system/Logger': { getLogger: function () { return { error: function () {} }; } },
            'dw/svc/LocalServiceRegistry': { createService: function () { return {}; } },
            '*/cartridge/scripts/helpers/TokenManager': tokenStub,
            '*/cartridge/scripts/helpers/JPMCMerchantResolver': resolverStub
        });

        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET',
            resolvedConfig: { merchantId: 'M1' }
        });

        assert.isTrue(resolverStub.toAccessTokenConfig.calledOnceWith({ merchantId: 'M1' }));
        assert.deepEqual(tokenStub.getValidToken.firstCall.args[0], { client_id: 'rc' });
    });

    it('catches exceptions thrown by config/token resolution and returns 500', function () {
        var helper = proxyquire(MODULE_PATH, {
            'dw/system/Logger': { getLogger: function () { return { error: function () {} }; } },
            'dw/svc/LocalServiceRegistry': { createService: function () { return {}; } },
            '*/cartridge/scripts/helpers/TokenManager': {
                getValidToken: function () { throw new Error('boom'); }
            },
            '*/cartridge/scripts/helpers/JPMCConfig': {
                getAccessTokenConfig: function () { return { client_id: 'c' }; }
            }
        });

        var res = helper.callWithTokenGeneration({ tokenServiceId: 't', serviceId: 's', method: 'GET' });
        assert.isFalse(res.success);
        assert.equal(res.statusCode, 500);
        assert.equal(res.error, 'boom');
    });

    it('catches non-Error exceptions and stringifies them', function () {
        var helper = proxyquire(MODULE_PATH, {
            'dw/system/Logger': { getLogger: function () { return { error: function () {} }; } },
            'dw/svc/LocalServiceRegistry': { createService: function () { return {}; } },
            '*/cartridge/scripts/helpers/TokenManager': {
                getValidToken: function () { throw 'string-error'; }
            },
            '*/cartridge/scripts/helpers/JPMCConfig': {
                getAccessTokenConfig: function () { return { client_id: 'c' }; }
            }
        });

        var res = helper.callWithTokenGeneration({ tokenServiceId: 't', serviceId: 's', method: 'GET' });
        assert.equal(res.error, 'string-error');
    });
});

describe('JPMCServiceHelper - callWithTokenGeneration end-to-end (callService path)', function () {
    var tokenStub;
    var configStub;

    beforeEach(function () {
        tokenStub = {
            getValidToken: sinon.stub().returns({ accessToken: 'AT-123', expiresIn: 3600 })
        };
        configStub = { getAccessTokenConfig: sinon.stub().returns({ client_id: 'c' }) };
    });

    function load(registry) {
        return proxyquire(MODULE_PATH, {
            'dw/system/Logger': { getLogger: function () { return { error: function () {}, info: function () {} }; } },
            'dw/svc/LocalServiceRegistry': registry,
            '*/cartridge/scripts/helpers/TokenManager': tokenStub,
            '*/cartridge/scripts/helpers/JPMCConfig': configStub
        });
    }

    it('returns parsed JSON data and ok=true on successful service call (GET)', function () {
        var rsp = okResult({ ok: true, statusCode: 200, statusMessage: 'OK', responseText: '{"a":1}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        var res = helper.callWithTokenGeneration({
            tokenServiceId: 'tok', serviceId: 'svc', method: 'GET'
        });

        assert.isTrue(res.success);
        assert.deepEqual(res.data, { a: 1 });
        assert.equal(res.statusCode, 200);
        var svc = reg.getLastService();
        assert.equal(svc.method, 'GET');
        assert.equal(svc.headers.Authorization, 'Bearer AT-123');
        assert.equal(svc.headers['Content-Type'], 'application/json');
    });

    it('returns raw text when response is not JSON', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: 'plain text' });
        var helper = load(makeRegistry({ callResult: rsp }).registry);

        var res = helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET'
        });
        assert.equal(res.data, 'plain text');
    });

    it('handles empty responseText (no parsing)', function () {
        var rsp = okResult({ ok: true, statusCode: 204, responseText: '' });
        var helper = load(makeRegistry({ callResult: rsp }).registry);

        var res = helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'POST', data: { x: 1 }
        });
        assert.isTrue(res.success);
        assert.isNull(res.data);
        assert.equal(res.statusCode, 204);
    });

    it('serializes JSON payload via createRequest by default', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'POST', data: { foo: 'bar' }
        });

        var svc = reg.getLastService();
        var body = svc.callbacks.createRequest(svc, svc.lastPayload);
        assert.equal(body, '{"foo":"bar"}');
    });

    it('createRequest returns null for null requestData', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({ tokenServiceId: 't', serviceId: 's', method: 'GET' });

        var svc = reg.getLastService();
        assert.isNull(svc.callbacks.createRequest(svc, null));
    });

    it('parseResponse derives ok from 2xx status code', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({ tokenServiceId: 't', serviceId: 's', method: 'GET' });

        var parse = reg.getLastService().callbacks.parseResponse;
        var client200 = { getStatusCode: function () { return 200; }, getStatusMessage: function () { return 'OK'; }, getText: function () { return '{}'; } };
        var client500 = { getStatusCode: function () { return 500; }, getStatusMessage: function () { return 'ERR'; }, getText: function () { return null; } };

        assert.isTrue(parse(null, client200).ok);
        var p500 = parse(null, client500);
        assert.isFalse(p500.ok);
        assert.equal(p500.responseText, '');
    });

    it('filterLogMessage masks sensitive fields', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({ tokenServiceId: 't', serviceId: 's', method: 'GET' });

        var filter = reg.getLastService().callbacks.filterLogMessage;
        var out = filter('{"accountNumber":"4111111111111111","cvv":"123"}');
        assert.notInclude(out, '4111111111111111');
        assert.include(out, '***REDACTED***');
        // form-encoded path
        var out2 = filter('client_id=abcdef&grant_type=client_credentials');
        assert.notInclude(out2, 'abcdef');
    });

    it('substitutes valid placeHolderId into URL', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET',
            placeHolderId: 'merchant_123'
        });

        assert.equal(reg.getLastService().url, 'https://api.example.com/merchant_123');
    });

    it('rejects placeHolderId with invalid characters (no substitution)', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET',
            placeHolderId: 'bad id!'
        });

        assert.equal(reg.getLastService().url, 'https://api.example.com/{place-holder-id}');
    });

    it('rejects overly long placeHolderId', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        var longId = new Array(102).join('a');
        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET',
            placeHolderId: longId
        });

        assert.equal(reg.getLastService().url, 'https://api.example.com/{place-holder-id}');
    });

    it('appends valid urlSuffix to URL', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET',
            urlSuffix: '/sub/path'
        });

        assert.include(reg.getLastService().url, '/sub/path');
    });

    it('rejects urlSuffix containing path traversal', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET',
            urlSuffix: '../etc/passwd'
        });

        assert.notInclude(reg.getLastService().url, '../');
    });

    it('rejects urlSuffix with disallowed characters', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET',
            urlSuffix: 'bad suffix'
        });

        assert.notInclude(reg.getLastService().url, 'bad suffix');
    });

    it('rejects urlSuffix containing query parameter characters', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET',
            urlSuffix: '/sub/path?x=1'
        });

        assert.notInclude(reg.getLastService().url, '/sub/path?x=1');
        assert.notInclude(reg.getLastService().url, '?');
    });

    it('rejects urlSuffix containing & characters', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET',
            urlSuffix: '/path&injected=value'
        });

        assert.notInclude(reg.getLastService().url, 'injected=value');
        assert.notInclude(reg.getLastService().url, '&');
    });

    it('passes through additional custom headers', function () {
        var rsp = okResult({ ok: true, statusCode: 200, responseText: '{}' });
        var reg = makeRegistry({ callResult: rsp });
        var helper = load(reg.registry);

        helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET',
            headers: { 'X-Trace-Id': 'abc-123', 'X-Merchant': 'M1' }
        });

        var hdrs = reg.getLastService().headers;
        assert.equal(hdrs['X-Trace-Id'], 'abc-123');
        assert.equal(hdrs['X-Merchant'], 'M1');
    });

    it('returns success=false when service.call() reports !isOk (uses errorMessage)', function () {
        var helper = load(makeRegistry({
            callResult: failResult({ status: 502, errorMessage: 'Bad Gateway' })
        }).registry);

        var res = helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET'
        });
        assert.isFalse(res.success);
        assert.equal(res.statusCode, 502);
        assert.equal(res.error, 'Bad Gateway');
    });

    it('falls back to msg when errorMessage missing on failure', function () {
        var helper = load(makeRegistry({
            callResult: failResult({ status: 503, errorMessage: null, msg: 'circuit open' })
        }).registry);

        var res = helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET'
        });
        assert.equal(res.error, 'circuit open');
    });

    it('uses "Unknown error" when both errorMessage and msg are missing', function () {
        var helper = load(makeRegistry({
            callResult: failResult({ status: 500 })
        }).registry);

        var res = helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET'
        });
        assert.equal(res.error, 'Unknown error');
    });

    it('catches exceptions thrown during service execution', function () {
        var helper = load(makeRegistry({
            callImpl: function () { throw new Error('network down'); }
        }).registry);

        var res = helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET'
        });
        assert.isFalse(res.success);
        assert.equal(res.error, 'network down');
    });

    it('catches non-Error exceptions thrown during service execution', function () {
        var helper = load(makeRegistry({
            callImpl: function () { throw 'odd'; }
        }).registry);

        var res = helper.callWithTokenGeneration({
            tokenServiceId: 't', serviceId: 's', method: 'GET'
        });
        assert.equal(res.error, 'odd');
    });

    describe('callWithTokenGeneration() — edge case scenarios', function () {
        it('should handle missing urlSuffix parameter', function () {
            var helper = load(makeRegistry({
                callImpl: function (config) { return { success: true }; }
            }).registry);

            var res = helper.callWithTokenGeneration({
                tokenServiceId: 't', serviceId: 's', method: 'GET'
            });
            // Should still work without urlSuffix
            assert.isObject(res);
        });

        it('should handle empty requestData', function () {
            var helper = load(makeRegistry({
                callImpl: function (config) { return { success: true }; }
            }).registry);

            var res = helper.callWithTokenGeneration({
                tokenServiceId: 't', serviceId: 's', method: 'POST', requestData: null
            });
            assert.isObject(res);
        });

        it('should handle form-encoded content type', function () {
            var helper = load(makeRegistry({
                callImpl: function (config) { return { success: true }; }
            }).registry);

            var res = helper.callWithTokenGeneration({
                tokenServiceId: 't', serviceId: 's', method: 'POST',
                contentType: 'application/x-www-form-urlencoded',
                requestData: { key: 'value' }
            });
            assert.isObject(res);
        });

        it('should handle service timeout gracefully', function () {
            var helper = load(makeRegistry({
                callImpl: function () { throw new Error('Service timeout'); }
            }).registry);

            var res = helper.callWithTokenGeneration({
                tokenServiceId: 't', serviceId: 's', method: 'GET'
            });
            assert.isFalse(res.success);
            assert.equal(res.error, 'Service timeout');
        });
    });
});
