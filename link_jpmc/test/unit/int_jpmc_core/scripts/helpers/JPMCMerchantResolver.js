'use strict';

var assert = require('assert');
var proxyquire = require('proxyquire').noCallThru();

function makeMockLogger() {
    return { debug: function () {}, info: function () {}, warn: function () {}, error: function () {} };
}

function makeMockCache(overrides) {
    return Object.assign({
        get: function (key, cb) { return cb(); },
        invalidate: function () {}
    }, overrides || {});
}

function makeMockCacheMgr(cache) {
    return { getCache: function () { return cache; } };
}

function makeSitePrefs(custom) {
    return {
        getCurrent: function () {
            return {
                getID: function () { return 'RefArch'; },
                getPreferences: function () {
                    return {
                        getCustom: function () {
                            return Object.assign({
                                JPMC_MerchantCode: 'sp-merchant',
                                JPMCClientID: 'sp-client',
                                JPMCResourceID: 'sp-resource',
                                JPMCCertAlias: 'sp-cert',
                                JPMCPrivateKeyAlias: 'sp-key',
                                jpmc_kid: 'sp-kid',
                                JPMCTokenizationType: { value: 'SAFETECH_TOKEN' },
                                JPMCCaptureMethod: { value: 'MANUAL' },
                                JPMCEnableAVS: true,
                                JPMCEnableFraudCheck: false,
                                JPMCEnableFraudCheckAtAuth: false,
                                jpmcKountEnvironment: { value: 'TEST' },
                                JPMCGetKeyUrl: 'https://sp-pie-key.example.com',
                                JPMCEncryptionUrl: 'https://sp-pie-enc.example.com',
                                JPMCPlatformId: 'sp-platform',
                                JPMCGooglePayGatewayMerchantId: 'sp-gpay-gw-mid',
                                JPMCGooglePayMerchantId: 'sp-gpay-mid',
                                JPMCGooglePayMerchantName: 'SP Store',
                                JPMCGooglePayEnvironment: { value: 'TEST' },
                                JPMCGooglePayGateway: 'sp-gateway',
                                JPMCGooglePayAllowedCardNetworks: 'VISA,MASTERCARD',
                                JPMCGooglePayAllowedAuthMethods: 'PAN_ONLY',
                                JPMCGooglePayCartEnabled: false,
                                JPMCGooglePayPDPEnabled: false,
                                jpmcKountClientId: 'sp-kount',
                                JPMCMerchantSoftwareCompany: null,
                                JPMCMerchantSoftwareProduct: null,
                                JPMCMerchantSoftwareVersion: null
                            }, custom || {});
                        },
                        custom: Object.assign({ JPMCEnableMultiMerchant: false }, custom || {})
                    };
                }
            };
        }
    };
}

function makeCO(fields) {
    return { custom: Object.assign({ enabled: true }, fields || {}) };
}

function makeIterator(items) {
    var idx = 0;
    return {
        hasNext: function () { return idx < items.length; },
        next: function () { return items[idx++]; },
        close: function () {}
    };
}

var CONSTANTS = {
    MERCHANT_CONFIG_CACHE_ID: 'jpmc-merchant-config',
    MERCHANT_CONFIG_CACHE_KEY_PREFIX: 'jpmc_config_',
    MERCHANT_CONFIG_CO_TYPE: 'JPMCMerchantConfig',
    DEFAULT_CERT_ALIAS: 'default-cert',
    DEFAULT_KEY_ALIAS: 'default-key',
    DEFAULT_TOKEN_TYPE: 'SAFETECH_TOKEN',
    DEFAULT_CAPTURE_METHOD: 'MANUAL',
    DEFAULT_COMPANY_NAME: 'JPMC',
    DEFAULT_PRODUCT_NAME: 'JPMC Plugin',
    DEFAULT_VERSION: '1.0.0'
};

function loadResolver(mockSite, mockCacheMgr, mockCustomObjectMgr, mockLogger, extraMocks) {
    var defaultJPMCConfig = { 
        getCheckoutMode: function () { return 'PIE'; },
        isGooglePayOnCartEnabled: function () { return false; },
        isGooglePayOnPDPEnabled: function () { return false; },
        getGooglePayConfig: function () { return { enabled: false }; }
    };
    
    // Merge JPMCConfig methods if provided in extraMocks
    var jpMCConfigMock = extraMocks && extraMocks['*/cartridge/scripts/helpers/JPMCConfig']
        ? Object.assign({}, defaultJPMCConfig, extraMocks['*/cartridge/scripts/helpers/JPMCConfig'])
        : defaultJPMCConfig;
    
    // Clone extraMocks and update JPMCConfig with merged version
    var mocksToMerge = extraMocks ? Object.assign({}, extraMocks) : {};
    mocksToMerge['*/cartridge/scripts/helpers/JPMCConfig'] = jpMCConfigMock;
    
    var mocks = Object.assign({
        'dw/system/Logger': { getLogger: function () { return mockLogger || makeMockLogger(); } },
        'dw/system/CacheMgr': mockCacheMgr,
        'dw/system/Site': mockSite,
        '*/cartridge/scripts/helpers/JPMCConstants': CONSTANTS,
        'dw/order/PaymentMgr': {
            getPaymentMethod: function () { return { isActive: function () { return true; } }; }
        }
    }, mocksToMerge);
    
    if (mockCustomObjectMgr) {
        mocks['dw/object/CustomObjectMgr'] = mockCustomObjectMgr;
    }
    return proxyquire('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JPMCMerchantResolver', mocks);
}

describe('JPMCMerchantResolver', function () {

  
    describe('isMultiMerchantEnabled()', function () {

        it('should return false when JPMCEnableMultiMerchant is false', function () {
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: false }), makeMockCacheMgr(makeMockCache()), null);
            assert.strictEqual(r.isMultiMerchantEnabled(), false);
        });

        it('should return false when JPMCEnableMultiMerchant is undefined', function () {
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: undefined }), makeMockCacheMgr(makeMockCache()), null);
            assert.strictEqual(r.isMultiMerchantEnabled(), false);
        });

        it('should return false when JPMCEnableMultiMerchant is null', function () {
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: null }), makeMockCacheMgr(makeMockCache()), null);
            assert.strictEqual(r.isMultiMerchantEnabled(), false);
        });

        it('should return false when JPMCEnableMultiMerchant is string "false"', function () {
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: 'false' }), makeMockCacheMgr(makeMockCache()), null);
            assert.strictEqual(r.isMultiMerchantEnabled(), false);
        });

        it('should return true when JPMCEnableMultiMerchant is boolean true', function () {
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), null);
            assert.strictEqual(r.isMultiMerchantEnabled(), true);
        });

        it('should return false and not throw when Site.getCurrent() throws', function () {
            var badSite = { getCurrent: function () { throw new Error('Site unavailable'); } };
            var r = loadResolver(badSite, makeMockCacheMgr(makeMockCache()), null);
            assert.strictEqual(r.isMultiMerchantEnabled(), false);
        });

        it('should return false and not throw when getPreferences() throws', function () {
            var badSite = {
                getCurrent: function () {
                    return { getID: function () { return 'X'; }, getPreferences: function () { throw new Error('prefs fail'); } };
                }
            };
            var r = loadResolver(badSite, makeMockCacheMgr(makeMockCache()), null);
            assert.strictEqual(r.isMultiMerchantEnabled(), false);
        });

        it('should log a warning when an exception occurs', function () {
            var warnMessages = [];
            var logger = Object.assign(makeMockLogger(), { warn: function (msg) { warnMessages.push(msg); } });
            var badSite = { getCurrent: function () { throw new Error('boom'); } };
            var r = loadResolver(badSite, makeMockCacheMgr(makeMockCache()), null, logger);
            r.isMultiMerchantEnabled();
            assert(warnMessages.length > 0, 'Should log a warning on exception');
        });
    });


    describe('mergeConfigWithSPFallback() — mandatory field priority: CO > fallback > null', function () {
        var r;
        beforeEach(function () {
            r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null);
        });

        it('should take merchantId from CO when present', function () {
            var co = makeCO({ configKey: 'K', merchantId: 'co-mid' });
            assert.strictEqual(r.mergeConfigWithSPFallback(co, { merchantId: 'sp-mid' }).merchantId, 'co-mid');
        });

        it('should fallback merchantId to fallbackConfig when CO has none', function () {
            var co = makeCO({ configKey: 'K' });
            assert.strictEqual(r.mergeConfigWithSPFallback(co, { merchantId: 'sp-mid' }).merchantId, 'sp-mid');
        });

        it('should return null merchantId when both CO and fallback are empty', function () {
            var co = makeCO({ configKey: 'K' });
            assert.strictEqual(r.mergeConfigWithSPFallback(co, null).merchantId, null);
        });

        it('should take clientId from CO when present', function () {
            var co = makeCO({ configKey: 'K', clientId: 'co-cid' });
            assert.strictEqual(r.mergeConfigWithSPFallback(co, { clientId: 'sp-cid' }).clientId, 'co-cid');
        });

        it('should fallback clientId to fallbackConfig', function () {
            var co = makeCO({ configKey: 'K' });
            assert.strictEqual(r.mergeConfigWithSPFallback(co, { clientId: 'sp-cid' }).clientId, 'sp-cid');
        });

        it('should return null clientId when both empty', function () {
            var co = makeCO({ configKey: 'K' });
            assert.strictEqual(r.mergeConfigWithSPFallback(co, null).clientId, null);
        });

        it('should take resourceId from CO when present', function () {
            var co = makeCO({ configKey: 'K', resourceId: 'co-rid' });
            assert.strictEqual(r.mergeConfigWithSPFallback(co, { resourceId: 'sp-rid' }).resourceId, 'co-rid');
        });

        it('should fallback resourceId to fallbackConfig', function () {
            var co = makeCO({ configKey: 'K' });
            assert.strictEqual(r.mergeConfigWithSPFallback(co, { resourceId: 'sp-rid' }).resourceId, 'sp-rid');
        });

        it('should return null resourceId when both empty', function () {
            var co = makeCO({ configKey: 'K' });
            assert.strictEqual(r.mergeConfigWithSPFallback(co, null).resourceId, null);
        });

        it('should not expose audience in resolved merchant config', function () {
            var co = makeCO({ configKey: 'K' });
            assert.strictEqual(r.mergeConfigWithSPFallback(co, null).audience, undefined);
        });
    });


    describe('mergeConfigWithSPFallback() — optional scalar fields: CO > fallback > constant default', function () {
        var r;
        beforeEach(function () { r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null); });

        it('does not expose expiresIn in resolved merchant config', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).expiresIn, undefined);
        });

        it('certAlias — uses CO value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ certAlias: 'co-cert' }), { certAlias: 'sp-cert' }).certAlias, 'co-cert');
        });
        it('certAlias — falls back to SP value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), { certAlias: 'sp-cert' }).certAlias, 'sp-cert');
        });
        it('certAlias — falls back to DEFAULT_CERT_ALIAS', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).certAlias, CONSTANTS.DEFAULT_CERT_ALIAS);
        });

        it('privateKeyAlias — uses CO value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ privateKeyAlias: 'co-key' }), { privateKeyAlias: 'sp-key' }).privateKeyAlias, 'co-key');
        });
        it('privateKeyAlias — falls back to SP value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), { privateKeyAlias: 'sp-key' }).privateKeyAlias, 'sp-key');
        });
        it('privateKeyAlias — falls back to DEFAULT_KEY_ALIAS', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).privateKeyAlias, CONSTANTS.DEFAULT_KEY_ALIAS);
        });

        it('kid — uses CO value over fallback', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ kid: 'co-kid' }), { kid: 'sp-kid' }).kid, 'co-kid');
        });
        it('kid — falls back to SP value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), { kid: 'sp-kid' }).kid, 'sp-kid');
        });
        it('kid — null when both empty', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).kid, null);
        });

        it('pieGetKeyUrl — uses CO value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ pieGetKeyUrl: 'https://co-pie-key.example.com' }), null).pieGetKeyUrl, 'https://co-pie-key.example.com');
        });
        it('pieEncryptionUrl — uses CO value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ pieEncryptionUrl: 'https://co-enc.example.com' }), null).pieEncryptionUrl, 'https://co-enc.example.com');
        });
        it('platformId — uses CO value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ platformId: 'co-plat' }), { platformId: 'sp-plat' }).platformId, 'co-plat');
        });
        it('kountClientId — uses CO value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ kountClientId: 'co-kount' }), null).kountClientId, 'co-kount');
        });
        it('kountClientId — falls back to SP value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), { kountClientId: 'sp-kount' }).kountClientId, 'sp-kount');
        });
    });

    // -------------------------------------------------------------------------
    // mergeConfigWithSPFallback() — enum fields
    // -------------------------------------------------------------------------
    describe('mergeConfigWithSPFallback() — enum fields', function () {
        var r;
        beforeEach(function () { r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null); });

        it('captureMethod — extracts .value from CO enum', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ captureMethod: { value: 'NOW' } }), null).captureMethod, 'NOW');
        });
        it('captureMethod — falls back to SP string value', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), { captureMethod: 'DELAYED' }).captureMethod, 'DELAYED');
        });
        it('captureMethod — null when both empty', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).captureMethod, null);
        });

        it('tokenizationType — extracts .value from CO enum', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ tokenizationType: { value: 'NETWORK_TOKEN' } }), null).tokenizationType, 'NETWORK_TOKEN');
        });
        it('tokenizationType — falls back to DEFAULT_TOKEN_TYPE when both empty', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).tokenizationType, CONSTANTS.DEFAULT_TOKEN_TYPE);
        });

        it('kountEnvironment — extracts .value from CO enum (PROD)', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ kountEnvironment: { value: 'PROD' } }), null).kountEnvironment, 'PROD');
        });
        it('kountEnvironment — defaults to TEST when both empty', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).kountEnvironment, 'TEST');
        });

        it('googlePayEnvironment — extracts .value from CO enum', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ googlePayEnvironment: { value: 'PRODUCTION' } }), null).googlePayEnvironment, 'PRODUCTION');
        });
        it('googlePayEnvironment — null when both empty', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).googlePayEnvironment, null);
        });

    });


    describe('mergeConfigWithSPFallback() — boolean fields', function () {
        var r;
        beforeEach(function () { r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null); });

        it('enableAVS — true when CO=true', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ enableAVS: true }), { enableAVS: false }).enableAVS, true);
        });
        it('enableAVS — false when CO=false (no fallback)', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ enableAVS: false }), { enableAVS: true }).enableAVS, false);
        });
        it('enableAVS — defaults to true when undefined in CO and fallback', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).enableAVS, true);
        });
        it('enableAVS — uses SP fallback when CO is undefined', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), { enableAVS: false }).enableAVS, false);
        });

        it('enableFraudCheck — true when CO=true', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ enableFraudCheck: true }), null).enableFraudCheck, true);
        });
        it('enableFraudCheck — false when CO=false', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ enableFraudCheck: false }), { enableFraudCheck: true }).enableFraudCheck, false);
        });
        it('enableFraudCheck — uses SP fallback=true when CO is undefined', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), { enableFraudCheck: true }).enableFraudCheck, true);
        });
        it('enableFraudCheck — defaults to false when both empty', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).enableFraudCheck, false);
        });

        it('enableFraudCheckAtAuth — true when CO=true', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ enableFraudCheckAtAuth: true }), null).enableFraudCheckAtAuth, true);
        });
        it('enableFraudCheckAtAuth — defaults to false when both empty', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).enableFraudCheckAtAuth, false);
        });

        it('JPMCGooglePayCartEnabled — true when CO=true', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ JPMCGooglePayCartEnabled: true }), null).JPMCGooglePayCartEnabled, true);
        });
        it('JPMCGooglePayCartEnabled — false when CO=false', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ JPMCGooglePayCartEnabled: false }), { JPMCGooglePayCartEnabled: true }).JPMCGooglePayCartEnabled, false);
        });
        it('JPMCGooglePayCartEnabled — defaults to false when both empty', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).JPMCGooglePayCartEnabled, false);
        });

        it('JPMCGooglePayPDPEnabled — true when CO=true', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ JPMCGooglePayPDPEnabled: true }), null).JPMCGooglePayPDPEnabled, true);
        });
        it('JPMCGooglePayPDPEnabled — defaults to false when both empty', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).JPMCGooglePayPDPEnabled, false);
        });
    });


    describe('mergeConfigWithSPFallback() — Google Pay & Apple Pay fields', function () {
        var r;
        beforeEach(function () { r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null); });

        it('googlePayGatewayMerchantId — CO over fallback', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ googlePayGatewayMerchantId: 'co-gw' }), { googlePayGatewayMerchantId: 'sp-gw' }).googlePayGatewayMerchantId, 'co-gw');
        });
        it('googlePayGatewayMerchantId — fallback to SP', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), { googlePayGatewayMerchantId: 'sp-gw' }).googlePayGatewayMerchantId, 'sp-gw');
        });
        it('googlePayMerchantId — CO over fallback', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ googlePayMerchantId: 'co-gpay-mid' }), null).googlePayMerchantId, 'co-gpay-mid');
        });
        it('googlePayMerchantName — CO over fallback', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ googlePayMerchantName: 'CO Store' }), { googlePayMerchantName: 'SP Store' }).googlePayMerchantName, 'CO Store');
        });
        it('googlePayGateway — CO over fallback', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ googlePayGateway: 'co-gw' }), null).googlePayGateway, 'co-gw');
        });
        it('googlePayAllowedCardNetworks — CO over fallback', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ googlePayAllowedCardNetworks: 'VISA,AMEX' }), null).googlePayAllowedCardNetworks, 'VISA,AMEX');
        });
        it('googlePayAllowedAuthMethods — CO over fallback', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ googlePayAllowedAuthMethods: 'CRYPTOGRAM_3DS' }), null).googlePayAllowedAuthMethods, 'CRYPTOGRAM_3DS');
        });
    });

  
    describe('mergeConfigWithSPFallback() — source, configKey, software info', function () {
        var r;
        beforeEach(function () { r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null); });

        it('should always set source to CustomObject', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ configKey: 'K' }), null).source, 'CustomObject');
        });
        it('should preserve configKey from CO', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ configKey: 'RefArch::en_CA' }), null).configKey, 'RefArch::en_CA');
        });
        it('merchantSoftwareCompany — always uses DEFAULT_COMPANY_NAME (not CO)', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({ merchantSoftwareCompany: 'CO Corp' }), null).merchantSoftwareCompany, CONSTANTS.DEFAULT_COMPANY_NAME);
        });
        it('merchantSoftwareCompany — defaults to DEFAULT_COMPANY_NAME', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).merchantSoftwareCompany, CONSTANTS.DEFAULT_COMPANY_NAME);
        });
        it('merchantSoftwareProduct — defaults to DEFAULT_PRODUCT_NAME', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).merchantSoftwareProduct, CONSTANTS.DEFAULT_PRODUCT_NAME);
        });
        it('merchantSoftwareVersion — defaults to DEFAULT_VERSION', function () {
            assert.strictEqual(r.mergeConfigWithSPFallback(makeCO({}), null).merchantSoftwareVersion, CONSTANTS.DEFAULT_VERSION);
        });
    });

    describe('resolve() — multi-merchant DISABLED', function () {
        var r;
        beforeEach(function () {
            r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: false }), makeMockCacheMgr(makeMockCache()), null);
        });

        it('should return SitePreferences as source', function () {
            assert.strictEqual(r.resolve().source, 'SitePreferences');
        });
        it('should return merchantId from SP', function () {
            assert.strictEqual(r.resolve().merchantId, 'sp-merchant');
        });
        it('should return clientId from SP', function () {
            assert.strictEqual(r.resolve().clientId, 'sp-client');
        });
        it('should return resourceId from SP', function () {
            assert.strictEqual(r.resolve().resourceId, 'sp-resource');
        });
        it('should not expose audience from SP', function () {
            assert.strictEqual(r.resolve().audience, undefined);
        });
        it('should not expose expiresIn from SP', function () {
            assert.strictEqual(r.resolve().expiresIn, undefined);
        });
        it('should return certAlias from SP', function () {
            assert.strictEqual(r.resolve().certAlias, 'sp-cert');
        });
        it('should include siteId in configKey', function () {
            assert.ok(r.resolve().configKey.indexOf('RefArch') > -1);
        });
        it('should respect siteId override in configKey', function () {
            
            assert.ok(r.resolve({ siteId: 'CanadaSite' }).configKey.indexOf('RefArch') > -1);
        });
        it('should NOT query CustomObjects when disabled', function () {
            var coCallCount = 0;
            var mockCO = { getCustomObject: function () { coCallCount++; return null; } };
            var r2 = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: false }), makeMockCacheMgr(makeMockCache()), mockCO);
            r2.resolve({ locale: 'en_CA' });
            assert.strictEqual(coCallCount, 0, 'Should NOT query CO when disabled');
        });
        it('should return consistent results on repeated calls', function () {
            var r1 = r.resolve(); var r2 = r.resolve();
            assert.strictEqual(r1.merchantId, r2.merchantId);
        });
    });


    describe('resolve() — multi-merchant ENABLED, locale CO hit', function () {

        it('should return CustomObject source when locale CO found', function () {
            var localeCoObj = makeCO({ configKey: 'RefArch::en_CA', merchantId: 'co-en-ca-merchant', clientId: 'co-en-ca-client', resourceId: 'co-en-ca-res' });
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::en_CA' ? localeCoObj : null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolve({ siteId: 'RefArch', locale: 'en_CA' });
            assert.strictEqual(result.source, 'CustomObject');
            assert.strictEqual(result.merchantId, 'co-en-ca-merchant');
        });

        it('should fallback optional fields to SP when CO does not set them', function () {
            var localeCoObj = makeCO({ configKey: 'RefArch::en_CA', merchantId: 'co-mid', clientId: 'co-cid', resourceId: 'co-rid' });
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::en_CA' ? localeCoObj : null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolve({ siteId: 'RefArch', locale: 'en_CA' });
            assert.strictEqual(result.certAlias, 'sp-cert', 'Optional certAlias must fallback to SP');
            assert.strictEqual(result.expiresIn, undefined, 'expiresIn is no longer resolved from config');
        });

        it('should load fr_CA locale-specific CO correctly', function () {
            var frCoObj = makeCO({ configKey: 'RefArch::fr_CA', merchantId: 'co-fr-ca-merchant', clientId: 'co-fr-ca-client', resourceId: 'co-fr-ca-res' });
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::fr_CA' ? frCoObj : null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolve({ siteId: 'RefArch', locale: 'fr_CA' });
            assert.strictEqual(result.merchantId, 'co-fr-ca-merchant');
        });
    });

    describe('resolve() — multi-merchant ENABLED, no locale CO → Site Preferences', function () {

        it('should return SitePreferences when locale CO not found', function () {
            var mockCO = { getCustomObject: function () { return null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolve({ siteId: 'RefArch', locale: 'zh_CN' });
            assert.strictEqual(result.source, 'SitePreferences');
            assert.strictEqual(result.merchantId, 'sp-merchant');
        });

        it('should return SitePreferences when no locale provided', function () {
            var mockCO = { getCustomObject: function () { return null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolve({ siteId: 'RefArch', locale: null });
            assert.strictEqual(result.source, 'SitePreferences');
            assert.strictEqual(result.merchantId, 'sp-merchant');
        });
    });


    describe('resolve() — disabled CO (enabled=false) is skipped', function () {

        it('should skip disabled locale CO and fallback to SP', function () {
            var disabledCo = makeCO({ configKey: 'RefArch::en_CA', enabled: false, merchantId: 'disabled-co-merchant' });
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::en_CA' ? disabledCo : null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolve({ siteId: 'RefArch', locale: 'en_CA' });
            assert.strictEqual(result.source, 'SitePreferences', 'Disabled CO must be skipped');
            assert.notStrictEqual(result.merchantId, 'disabled-co-merchant');
        });
    });

    describe('resolveForOrder() — multi-merchant DISABLED', function () {
        var r;
        beforeEach(function () {
            r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: false }), makeMockCacheMgr(makeMockCache()), { getCustomObject: function () { return null; } });
        });

        it('should return SP when disabled and no jpmcMerchantId', function () {
            assert.strictEqual(r.resolveForOrder({ custom: {}, getCustomerLocaleID: function () { return 'en_CA'; } }).source, 'SitePreferences');
        });
        it('should pass order locale to inner resolve', function () {
            var result = r.resolveForOrder({ custom: {}, getCustomerLocaleID: function () { return 'fr_CA'; } });
            assert.strictEqual(result.source, 'SitePreferences');
        });
        it('should handle null locale from order gracefully', function () {
            assert.strictEqual(r.resolveForOrder({ custom: {}, getCustomerLocaleID: function () { return null; } }).source, 'SitePreferences');
        });
        it('should still return SP even when order has jpmcMerchantId but feature disabled', function () {
            var result = r.resolveForOrder({ custom: { jpmcMerchantId: 'some-mid' }, getCustomerLocaleID: function () { return 'en_CA'; } });
            assert.strictEqual(result.source, 'SitePreferences');
        });
    });

    describe('resolveForOrder() — ENABLED, no jpmcMerchantId on order', function () {

        it('should use locale-based resolution and hit locale CO', function () {
            var localeCoObj = makeCO({ configKey: 'RefArch::fr_CA', merchantId: 'fr-ca-merchant', clientId: 'fr-ca-cid', resourceId: 'fr-ca-rid', audience: 'fr-ca-aud' });
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::fr_CA' ? localeCoObj : null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolveForOrder({ custom: {}, getCustomerLocaleID: function () { return 'fr_CA'; } });
            assert.strictEqual(result.merchantId, 'fr-ca-merchant');
        });

        it('should fallback to SP when no CO found for order locale', function () {
            var mockCO = { getCustomObject: function () { return null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolveForOrder({ custom: {}, getCustomerLocaleID: function () { return 'en_AU'; } });
            assert.strictEqual(result.source, 'SitePreferences');
        });
    });

    describe('resolveForOrder() — ENABLED, jpmcMerchantId present, CO found', function () {

        it('should resolve by merchant ID when CO found', function () {
            var merchantCoObj = makeCO({ configKey: 'RefArch::merchant-abc', merchantId: 'merchant-abc', clientId: 'abc-cid', resourceId: 'abc-rid', audience: 'abc-aud' });
            var mockCO = {
                getCustomObject: function () { return null; },
                queryCustomObjects: function (type, query, sort, mid) {
                    return makeIterator(mid === 'merchant-abc' ? [merchantCoObj] : []);
                }
            };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolveForOrder({ custom: { jpmcMerchantId: 'merchant-abc' }, getCustomerLocaleID: function () { return 'en_CA'; } });
            assert.strictEqual(result.merchantId, 'merchant-abc');
        });

        it('should skip disabled CO for merchant ID and fallback to locale resolution', function () {
            var disabledMerchantCo = makeCO({ configKey: 'RefArch::merchant-abc', enabled: false, merchantId: 'merchant-abc', clientId: 'abc-cid', resourceId: 'abc-rid', audience: 'abc-aud' });
            var mockCO = {
                getCustomObject: function () { return null; },
                queryCustomObjects: function () { return makeIterator([disabledMerchantCo]); }
            };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolveForOrder({ custom: { jpmcMerchantId: 'merchant-abc' }, getCustomerLocaleID: function () { return 'en_CA'; } });
            assert.strictEqual(result.source, 'SitePreferences', 'Disabled CO should be skipped');
        });
    });

    describe('resolveForOrder() — ENABLED, jpmcMerchantId present, CO NOT found', function () {

        it('should fallback to locale-based resolution', function () {
            var mockCO = {
                getCustomObject: function () { return null; },
                queryCustomObjects: function () { return makeIterator([]); }
            };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolveForOrder({ custom: { jpmcMerchantId: 'unknown-mid' }, getCustomerLocaleID: function () { return 'en_US'; } });
            assert.strictEqual(result.source, 'SitePreferences');
        });
    });

    describe('resolveForOrder() — queryCustomObjects throws', function () {

        it('should not throw and fallback to SP on DB error', function () {
            var mockCO = {
                getCustomObject: function () { return null; },
                queryCustomObjects: function () { throw new Error('DB error'); }
            };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);

            var result = r.resolveForOrder({ custom: { jpmcMerchantId: 'mid-xyz' }, getCustomerLocaleID: function () { return 'en_CA'; } });
            assert.strictEqual(result.source, 'SitePreferences');
        });
    });

    describe('invalidateCache()', function () {
        var cache, r;
        beforeEach(function () {
            cache = makeMockCache();
            r = loadResolver(makeSitePrefs(), makeMockCacheMgr(cache), null);
        });

        it('should return false for empty string configKey', function () {
            assert.strictEqual(r.invalidateCache(''), false);
        });
        it('should return false for null configKey', function () {
            assert.strictEqual(r.invalidateCache(null), false);
        });
        it('should return false for undefined configKey', function () {
            assert.strictEqual(r.invalidateCache(undefined), false);
        });
        it('should return true for valid configKey', function () {
            assert.strictEqual(r.invalidateCache('RefArch::en_CA'), true);
        });
        it('should call invalidate once for configKey only when no merchantId', function () {
            var calls = [];
            cache.invalidate = function (k) { calls.push(k); };
            r.invalidateCache('RefArch::en_CA');
            assert.strictEqual(calls.length, 1);
        });
        it('should include CACHE_KEY_PREFIX in key', function () {
            var calls = [];
            cache.invalidate = function (k) { calls.push(k); };
            r.invalidateCache('RefArch::en_CA');
            assert.ok(calls[0].indexOf(CONSTANTS.MERCHANT_CONFIG_CACHE_KEY_PREFIX) > -1);
        });
        it('should call invalidate twice when merchantId also provided', function () {
            var calls = [];
            cache.invalidate = function (k) { calls.push(k); };
            r.invalidateCache('RefArch::en_CA', 'merchant-123');
            assert.strictEqual(calls.length, 2);
        });
        it('second invalidate call should include mid_ prefix', function () {
            var calls = [];
            cache.invalidate = function (k) { calls.push(k); };
            r.invalidateCache('RefArch::en_CA', 'merchant-123');
            assert.ok(calls[1].indexOf('mid_merchant-123') > -1);
        });
        it('should NOT call second invalidate when merchantId is empty string', function () {
            var calls = [];
            cache.invalidate = function (k) { calls.push(k); };
            r.invalidateCache('RefArch::en_CA', '');
            assert.strictEqual(calls.length, 1);
        });
        it('should return false when cache.invalidate throws', function () {
            cache.invalidate = function () { throw new Error('Cache exploded'); };
            assert.strictEqual(r.invalidateCache('some-key'), false);
        });
        it('should log error when cache.invalidate throws', function () {
            var errorMsgs = [];
            var logger = Object.assign(makeMockLogger(), { error: function (msg) { errorMsgs.push(msg); } });
            cache.invalidate = function () { throw new Error('boom'); };
            var r2 = loadResolver(makeSitePrefs(), makeMockCacheMgr(cache), null, logger);
            r2.invalidateCache('some-key');
            assert(errorMsgs.length > 0);
        });
    });


    describe('toAccessTokenConfig()', function () {
        var r;
        var base;
        beforeEach(function () {
            r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null);
            base = { clientId: 'my-client', merchantId: 'my-merchant', certAlias: 'my-cert', privateKeyAlias: 'my-key', resourceId: 'my-rid', kid: 'my-kid' };
        });

        it('maps clientId → client_id', function () {
            assert.strictEqual(r.toAccessTokenConfig(base).client_id, 'my-client');
        });
        it('maps merchantId directly', function () {
            assert.strictEqual(r.toAccessTokenConfig(base).merchantId, 'my-merchant');
        });
        it('maps certAlias directly', function () {
            assert.strictEqual(r.toAccessTokenConfig(base).certAlias, 'my-cert');
        });
        it('uses DEFAULT_CERT_ALIAS when certAlias is null', function () {
            assert.strictEqual(r.toAccessTokenConfig(Object.assign({}, base, { certAlias: null })).certAlias, CONSTANTS.DEFAULT_CERT_ALIAS);
        });
        it('maps privateKeyAlias directly', function () {
            assert.strictEqual(r.toAccessTokenConfig(base).privateKeyAlias, 'my-key');
        });
        it('uses DEFAULT_KEY_ALIAS when privateKeyAlias is null', function () {
            assert.strictEqual(r.toAccessTokenConfig(Object.assign({}, base, { privateKeyAlias: null })).privateKeyAlias, CONSTANTS.DEFAULT_KEY_ALIAS);
        });
        it('maps hardcoded audience', function () {
            assert.strictEqual(r.toAccessTokenConfig(base).audience, 'https://idag2.jpmorganchase.com/adfs/oauth2/token');
        });
        it('maps resourceId → resource_id', function () {
            assert.strictEqual(r.toAccessTokenConfig(base).resource_id, 'my-rid');
        });
        it('maps kid directly', function () {
            assert.strictEqual(r.toAccessTokenConfig(base).kid, 'my-kid');
        });
        it('kid is null when not set', function () {
            assert.strictEqual(r.toAccessTokenConfig(Object.assign({}, base, { kid: null })).kid, null);
        });
    });


    describe('Caching — cache.get called with correct keys', function () {

        it('should call cache.get with locale key when ENABLED and locale provided', function () {
            var getCalls = [];
            var cache = Object.assign(makeMockCache(), { get: function (key, cb) { getCalls.push(key); return cb(); } });
            var mockCO = { getCustomObject: function () { return null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(cache), mockCO);
            r.resolve({ siteId: 'RefArch', locale: 'en_CA' });
            assert.ok(getCalls.some(function (k) { return k.indexOf('RefArch::en_CA') > -1; }));
        });

        it('should NOT call cache.get for default key — no siteId::default fallback', function () {
            var getCalls = [];
            var cache = Object.assign(makeMockCache(), { get: function (key, cb) { getCalls.push(key); return cb(); } });
            var mockCO = { getCustomObject: function () { return null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(cache), mockCO);
            r.resolve({ siteId: 'RefArch', locale: 'en_CA' });
            assert.ok(!getCalls.some(function (k) { return k.indexOf('::default') > -1; }), 'Should NOT query ::default key');
        });

        it('should NOT query CustomObjectMgr when cache returns a hit', function () {
            var coCallCount = 0;
            var cachedCo = makeCO({ configKey: 'RefArch::en_CA', merchantId: 'cached-mid', clientId: 'cached-cid', resourceId: 'cached-rid', audience: 'cached-aud' });
            var cache = Object.assign(makeMockCache(), { get: function (key, cb) { return cachedCo; } });
            var mockCO = { getCustomObject: function () { coCallCount++; return null; } };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(cache), mockCO);
            r.resolve({ siteId: 'RefArch', locale: 'en_CA' });
            assert.strictEqual(coCallCount, 0);
        });

        it('should use mid_ prefix when querying cache for merchant ID', function () {
            var getCalls = [];
            var cache = Object.assign(makeMockCache(), { get: function (key, cb) { getCalls.push(key); return cb(); } });
            var mockCO = {
                getCustomObject: function () { return null; },
                queryCustomObjects: function () { return makeIterator([]); }
            };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(cache), mockCO);
            r.resolveForOrder({ custom: { jpmcMerchantId: 'merchant-xyz' }, getCustomerLocaleID: function () { return 'en_CA'; } });
            assert.ok(getCalls.some(function (k) { return k.indexOf('mid_merchant-xyz') > -1; }));
        });
    });

   
    describe('Logging behavior', function () {

        it('should NOT emit any logs from resolve() under normal operation', function () {
            var logCalls = [];
            var logger = {
                debug: function (msg) { logCalls.push(msg); },
                info: function (msg) { logCalls.push(msg); },
                warn: function (msg) { logCalls.push(msg); },
                error: function (msg) { logCalls.push(msg); }
            };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: false }), makeMockCacheMgr(makeMockCache()), null, logger);
            r.resolve();
            assert.strictEqual(logCalls.length, 0, 'resolve() should not emit any logs under normal operation');
        });

        it('should NOT emit any logs from resolveForOrder() under normal operation', function () {
            var logCalls = [];
            var logger = {
                debug: function (msg) { logCalls.push(msg); },
                info: function (msg) { logCalls.push(msg); },
                warn: function (msg) { logCalls.push(msg); },
                error: function (msg) { logCalls.push(msg); }
            };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: false }), makeMockCacheMgr(makeMockCache()), null, logger);
            r.resolveForOrder({ custom: {}, getCustomerLocaleID: function () { return 'en_US'; } });
            assert.strictEqual(logCalls.length, 0, 'resolveForOrder() should not emit any logs under normal operation');
        });

        it('should log warn when isMultiMerchantEnabled throws', function () {
            var warnMsgs = [];
            var logger = Object.assign(makeMockLogger(), { warn: function (msg) { warnMsgs.push(msg); } });
            var r = loadResolver({ getCurrent: function () { throw new Error('oops'); } }, makeMockCacheMgr(makeMockCache()), null, logger);
            r.isMultiMerchantEnabled();
            assert.ok(warnMsgs.length > 0);
        });
    });


    describe('module.exports — public API shape', function () {
        var r;
        before(function () { r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null); });

        it('exports resolve', function () { assert.strictEqual(typeof r.resolve, 'function'); });
        it('exports resolveForOrder', function () { assert.strictEqual(typeof r.resolveForOrder, 'function'); });
        it('exports toAccessTokenConfig', function () { assert.strictEqual(typeof r.toAccessTokenConfig, 'function'); });
        it('exports invalidateCache', function () { assert.strictEqual(typeof r.invalidateCache, 'function'); });
        it('exports isMultiMerchantEnabled', function () { assert.strictEqual(typeof r.isMultiMerchantEnabled, 'function'); });
        it('does NOT expose internal buildSitePrefsConfig', function () { assert.strictEqual(r.buildSitePrefsConfig, undefined); });
        it('does NOT expose internal getMerchantConfigCO', function () { assert.strictEqual(r.getMerchantConfigCO, undefined); });
    });

    describe('extractCOData(null) — line 92', function () {
        it('resolveForOrder with null order falls back to site prefs (exercises extractCOData null guard indirectly)', function () {
            var r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null);
            var result = r.resolveForOrder(null);
            assert.strictEqual(result.source, 'SitePreferences');
        });

        it('mergeConfigWithSPFallback with null coData returns fallback (line 142)', function () {
            var r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null);
            var fb = { merchantId: 'fb-mid', clientId: 'fb-cid' };
            var result = r.mergeConfigWithSPFallback(null, fb);
            assert.strictEqual(result, fb);
        });
    });

    describe('getMerchantConfigCO error path — lines 255-257', function () {
        it('logs warning and returns null when CustomObjectMgr.getCustomObject throws', function () {
            var warnMsgs = [];
            var logger = Object.assign(makeMockLogger(), { warn: function (msg) { warnMsgs.push(msg); } });
            var throwingCO = { getCustomObject: function () { throw new Error('db error'); } };
            // cache always calls cb, so the error inside cb is caught
            var cache = makeMockCache({
                get: function (key, cb) { return cb ? cb() : null; }
            });
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: true }),
                makeMockCacheMgr(cache),
                throwingCO,
                logger
            );
            var result = r.resolve({ siteId: 'RefArch', locale: 'en_US' });
            // Falls back to site prefs because CO threw
            assert.strictEqual(result.source, 'SitePreferences');
            assert.ok(warnMsgs.length > 0, 'Should log warning when CO access throws');
        });
    });

    describe('resolveForOrder(null) — line 310', function () {
        it('returns site prefs config when order is null', function () {
            var r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null);
            var result = r.resolveForOrder(null);
            assert.strictEqual(result.source, 'SitePreferences');
            assert.strictEqual(result.merchantId, 'sp-merchant');
        });
    });

    describe('toAccessTokenConfig(null) — line 405', function () {
        it('uses buildSitePrefsConfig when resolvedConfig is null', function () {
            var r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null);
            var result = r.toAccessTokenConfig(null);
            assert.strictEqual(result.client_id, 'sp-client');
            assert.strictEqual(result.merchantId, 'sp-merchant');
        });

        it('uses buildSitePrefsConfig when resolvedConfig is undefined', function () {
            var r = loadResolver(makeSitePrefs(), makeMockCacheMgr(makeMockCache()), null);
            var result = r.toAccessTokenConfig(undefined);
            assert.strictEqual(result.client_id, 'sp-client');
        });
    });

    describe('resolveByMerchantId() — error handling', function () {
        it('should fallback to resolve() when merchantId is empty/falsy', function () {
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), null);
            var result = r.resolveByMerchantId(null);
            assert.strictEqual(result.source, 'SitePreferences');
        });

        it('should fallback to resolve() when merchantId is empty string', function () {
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), null);
            var result = r.resolveByMerchantId('');
            assert.strictEqual(result.source, 'SitePreferences');
        });

        it('should fallback to resolve() when multi-merchant is disabled', function () {
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: false }), makeMockCacheMgr(makeMockCache()), null);
            var result = r.resolveByMerchantId('mid-123');
            assert.strictEqual(result.source, 'SitePreferences');
        });

        it('should handle CustomObjectMgr.queryCustomObjects() throwing exception', function () {
            var warnMsgs = [];
            var logger = Object.assign(makeMockLogger(), { warn: function (msg) { warnMsgs.push(msg); } });
            var throwingCO = {
                queryCustomObjects: function () { throw new Error('Query failed'); }
            };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), throwingCO, logger);
            var result = r.resolveByMerchantId('mid-failed');
            assert.strictEqual(result.source, 'SitePreferences', 'Should fallback to SP when query throws');
            assert.ok(warnMsgs.length > 0, 'Should log warning on query failure');
        });

        it('should handle queryResult.close() throwing exception', function () {
            var warnMsgs = [];
            var logger = Object.assign(makeMockLogger(), { warn: function (msg) { warnMsgs.push(msg); } });
            var resultIterator = {
                hasNext: function () { return false; },
                next: function () { return null; },
                close: function () { throw new Error('Close failed'); }
            };
            var throwingCO = {
                queryCustomObjects: function () { return resultIterator; }
            };
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), throwingCO, logger);
            var result = r.resolveByMerchantId('mid-closed');
            // Should still fallback to SP even though close threw
            assert.strictEqual(result.source, 'SitePreferences');
        });

        it('should return result from cache when merchantId CO found', function () {
            var coObj = makeCO({ configKey: 'RefArch::mid-123', merchantId: 'mid-123', clientId: 'cached-cid', resourceId: 'cached-rid' });
            var mockCO = { queryCustomObjects: function () {
                return {
                    hasNext: function () { return true; },
                    next: function () { return coObj; },
                    close: function () {}
                };
            }};
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);
            var result = r.resolveByMerchantId('mid-123');
            assert.strictEqual(result.clientId, 'cached-cid');
        });

        it('should skip disabled CO and fallback to SP', function () {
            var disabledCo = makeCO({ configKey: 'RefArch::mid-disabled', merchantId: 'mid-disabled', enabled: false });
            var mockCO = { queryCustomObjects: function () {
                return {
                    hasNext: function () { return true; },
                    next: function () { return disabledCo; },
                    close: function () {}
                };
            }};
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);
            var result = r.resolveByMerchantId('mid-disabled');
            assert.strictEqual(result.source, 'SitePreferences');
        });

        it('should return SP when no CO found for merchantId', function () {
            var emptyIterator = {
                hasNext: function () { return false; },
                next: function () { return null; },
                close: function () {}
            };
            var mockCO = { queryCustomObjects: function () { return emptyIterator; }};
            var r = loadResolver(makeSitePrefs({ JPMCEnableMultiMerchant: true }), makeMockCacheMgr(makeMockCache()), mockCO);
            var result = r.resolveByMerchantId('mid-notfound');
            assert.strictEqual(result.source, 'SitePreferences');
        });
    });

    describe('invalidateCache() — error handling', function () {
        it('should return true when invalidation succeeds', function () {
            var cache = makeMockCache({ invalidate: function () {} });
            var r = loadResolver(makeSitePrefs(), makeMockCacheMgr(cache), null);
            var result = r.invalidateCache('RefArch::en_CA');
            assert.strictEqual(result, true);
        });

        it('should handle null configKey gracefully', function () {
            var cache = makeMockCache();
            var r = loadResolver(makeSitePrefs(), makeMockCacheMgr(cache), null);
            var result = r.invalidateCache(null);
            assert.strictEqual(result, false);
        });

        it('should handle empty configKey', function () {
            var cache = makeMockCache();
            var r = loadResolver(makeSitePrefs(), makeMockCacheMgr(cache), null);
            var result = r.invalidateCache('');
            assert.strictEqual(result, false);
        });

        it('should handle cache.invalidate() throwing exception', function () {
            var errorMsgs = [];
            var logger = Object.assign(makeMockLogger(), { error: function (msg) { errorMsgs.push(msg); } });
            var throwingCache = { invalidate: function () { throw new Error('Invalidate failed'); } };
            var r = loadResolver(makeSitePrefs(), makeMockCacheMgr(throwingCache), null, logger);
            var result = r.invalidateCache('RefArch::en_CA');
            assert.strictEqual(result, false, 'Should return false when invalidate throws');
            assert.ok(errorMsgs.length > 0, 'Should log error on invalidate failure');
        });

        it('should invalidate both locale and merchantId cache keys', function () {
            var invalidatedKeys = [];
            var cache = makeMockCache({
                invalidate: function (key) { invalidatedKeys.push(key); }
            });
            var r = loadResolver(makeSitePrefs(), makeMockCacheMgr(cache), null);
            r.invalidateCache('RefArch::en_CA', 'mid-123');
            assert.ok(invalidatedKeys.length >= 2, 'Should invalidate both locale and merchantId cache keys');
        });
    });

    describe('getCheckoutMode()', function () {
        it('should return checkoutMode from resolved config when multi-merchant enabled and locale CO exists', function () {
            var coCa = makeCO({ configKey: 'RefArch::en_CA', checkoutMode: 'DROP_IN' });
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::en_CA' ? coCa : null; } };
            var mockJPMCConfig = { getCheckoutMode: function () { return 'PIE'; } };
            
            // Mock global request object with locale
            global.request = { getLocale: function () { return 'en_CA'; } };
            
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: true }),
                makeMockCacheMgr(makeMockCache()),
                mockCO,
                null,
                { '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig }
            );
            
            var checkoutMode = r.getCheckoutMode();
            
            // Clean up global request mock
            delete global.request;
            
            assert.strictEqual(checkoutMode, 'DROP_IN', 'Should use checkoutMode from resolved config');
        });

        it('should fallback to JPMCConfig.getCheckoutMode() when multi-merchant disabled', function () {
            var mockJPMCConfig = { getCheckoutMode: function () { return 'PIE'; } };
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: false }),
                makeMockCacheMgr(makeMockCache()),
                null,
                null,
                { '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig }
            );
            
            var checkoutMode = r.getCheckoutMode();
            assert.strictEqual(checkoutMode, 'PIE', 'Should fallback to JPMCConfig.getCheckoutMode()');
        });

        it('should return string type for checkoutMode', function () {
            var mockJPMCConfig = { getCheckoutMode: function () { return 'PIE'; } };
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: false }),
                makeMockCacheMgr(makeMockCache()),
                null,
                null,
                { '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig }
            );
            
            var checkoutMode = r.getCheckoutMode();
            assert.strictEqual(typeof checkoutMode, 'string', 'Should return string type');
        });
    });

    describe('isGooglePayOnCartEnabled()', function () {
        it('should return true from resolved config when JPMCGooglePayCartEnabled is true', function () {
            var coCa = makeCO({ configKey: 'RefArch::en_CA', JPMCGooglePayCartEnabled: true });
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::en_CA' ? coCa : null; } };
            var mockJPMCConfig = { isGooglePayOnCartEnabled: function () { return false; } };
            
            global.request = { getLocale: function () { return 'en_CA'; } };
            
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: true }),
                makeMockCacheMgr(makeMockCache()),
                mockCO,
                null,
                { '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig }
            );
            
            var enabled = r.isGooglePayOnCartEnabled();
            delete global.request;
            
            assert.strictEqual(enabled, true, 'Should use value from resolved config');
        });

        it('should fallback to JPMCConfig when multi-merchant disabled', function () {
            var mockJPMCConfig = { isGooglePayOnCartEnabled: function () { return true; } };
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: false }),
                makeMockCacheMgr(makeMockCache()),
                null,
                null,
                { '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig }
            );
            
            var enabled = r.isGooglePayOnCartEnabled();
            assert.strictEqual(enabled, true, 'Should fallback to JPMCConfig');
        });
    });

    describe('isGooglePayOnPDPEnabled()', function () {
        it('should return false from resolved config when JPMCGooglePayPDPEnabled is false', function () {
            var coCa = makeCO({ configKey: 'RefArch::en_CA', JPMCGooglePayPDPEnabled: false });
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::en_CA' ? coCa : null; } };
            var mockJPMCConfig = { isGooglePayOnPDPEnabled: function () { return true; } };
            
            global.request = { getLocale: function () { return 'en_CA'; } };
            
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: true }),
                makeMockCacheMgr(makeMockCache()),
                mockCO,
                null,
                { '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig }
            );
            
            var enabled = r.isGooglePayOnPDPEnabled();
            delete global.request;
            
            assert.strictEqual(enabled, false, 'Should use value from resolved config');
        });

        it('should fallback to JPMCConfig when multi-merchant disabled', function () {
            var mockJPMCConfig = { isGooglePayOnPDPEnabled: function () { return false; } };
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: false }),
                makeMockCacheMgr(makeMockCache()),
                null,
                null,
                { '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig }
            );
            
            var enabled = r.isGooglePayOnPDPEnabled();
            assert.strictEqual(enabled, false, 'Should fallback to JPMCConfig');
        });
    });

    describe('getGooglePayConfig()', function () {
        var mockPaymentMethod;
        
        beforeEach(function () {
            mockPaymentMethod = { isActive: function () { return true; } };
        });

        it('should return config from resolved custom object when all fields present', function () {
            var coCa = makeCO({ 
                configKey: 'RefArch::en_CA',
                googlePayEnvironment: 'TEST',
                googlePayGateway: 'jpmorgan',
                googlePayGatewayMerchantId: 'co-gw-mid-123',
                googlePayMerchantId: 'co-merchant-123',
                googlePayMerchantName: 'CO Store',
                googlePayAllowedCardNetworks: 'VISA,MASTERCARD',
                googlePayAllowedAuthMethods: 'PAN_ONLY,CRYPTOGRAM_3DS'
            });
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::en_CA' ? coCa : null; } };
            var mockJPMCConfig = { getGooglePayConfig: function () { return { enabled: false, error: true }; } };
            var mockPaymentMgr = { getPaymentMethod: function () { return mockPaymentMethod; } };
            
            global.request = { getLocale: function () { return 'en_CA'; } };
            
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: true }),
                makeMockCacheMgr(makeMockCache()),
                mockCO,
                null,
                { 
                    '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
                    'dw/order/PaymentMgr': mockPaymentMgr
                }
            );
            
            var config = r.getGooglePayConfig();
            delete global.request;
            
            assert.strictEqual(config.enabled, true, 'Should be enabled');
            assert.strictEqual(config.environment, 'TEST', 'Should use CO environment');
            assert.strictEqual(config.gatewayMerchantId, 'co-gw-mid-123', 'Should use CO gateway merchant ID');
            assert.strictEqual(config.merchantName, 'CO Store', 'Should use CO merchant name');
            assert.deepStrictEqual(config.allowedCardNetworks, ['VISA', 'MASTERCARD'], 'Should parse card networks');
            assert.deepStrictEqual(config.allowedAuthMethods, ['PAN_ONLY', 'CRYPTOGRAM_3DS'], 'Should parse auth methods');
        });

        it('should return disabled when payment method is not active', function () {
            mockPaymentMethod.isActive = function () { return false; };
            var mockJPMCConfig = { getGooglePayConfig: function () { return { enabled: true }; } };
            var mockPaymentMgr = { getPaymentMethod: function () { return mockPaymentMethod; } };
            
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: false }),
                makeMockCacheMgr(makeMockCache()),
                null,
                null,
                { 
                    '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
                    'dw/order/PaymentMgr': mockPaymentMgr
                }
            );
            
            var config = r.getGooglePayConfig();
            assert.strictEqual(config.enabled, false, 'Should be disabled when payment method inactive');
        });

        it('should use site prefs from merged config when custom object missing Google Pay fields', function () {
            var coCa = makeCO({ configKey: 'RefArch::en_CA' }); // Missing Google Pay fields
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::en_CA' ? coCa : null; } };
            var mockPaymentMgr = { getPaymentMethod: function () { return mockPaymentMethod; } };
            
            global.request = { getLocale: function () { return 'en_CA'; } };
            
            var r = loadResolver(
                makeSitePrefs({ JPMCEnableMultiMerchant: true }),
                makeMockCacheMgr(makeMockCache()),
                mockCO,
                null,
                { 
                    'dw/order/PaymentMgr': mockPaymentMgr
                }
            );
            
            var config = r.getGooglePayConfig();
            delete global.request;
            
            // Since CO doesn't have Google Pay fields, merged config uses site pref values
            assert.strictEqual(config.enabled, true, 'Should be enabled using site pref fallback');
            assert.strictEqual(config.environment, 'TEST', 'Should use site pref environment from merged config');
            assert.strictEqual(config.gateway, 'sp-gateway', 'Should use site pref gateway from merged config');
            assert.strictEqual(config.gatewayMerchantId, 'sp-gpay-gw-mid', 'Should use site pref gatewayMerchantId');
        });

        it('should return error when production environment missing merchantId', function () {
            var coCa = makeCO({ 
                configKey: 'RefArch::en_CA',
                googlePayEnvironment: 'PRODUCTION',
                googlePayGateway: 'jpmorgan',
                googlePayGatewayMerchantId: 'co-gw-mid',
                googlePayMerchantId: null, // Missing for production
                googlePayMerchantName: 'CO Store',
                googlePayAllowedCardNetworks: 'VISA',
                googlePayAllowedAuthMethods: 'PAN_ONLY'
            });
            var mockCO = { getCustomObject: function (type, key) { return key === 'RefArch::en_CA' ? coCa : null; } };
            var mockJPMCConfig = { getGooglePayConfig: function () { return { enabled: false }; } };
            var mockPaymentMgr = { getPaymentMethod: function () { return mockPaymentMethod; } };
            
            global.request = { getLocale: function () { return 'en_CA'; } };
            
            // Create site prefs WITHOUT googlePayMerchantId to test error case
            var customSitePrefs = makeSitePrefs({ 
                JPMCEnableMultiMerchant: true,
                JPMCGooglePayMerchantId: null // Explicitly null in site prefs too
            });
            
            var r = loadResolver(
                customSitePrefs,
                makeMockCacheMgr(makeMockCache()),
                mockCO,
                null,
                { 
                    '*/cartridge/scripts/helpers/JPMCConfig': mockJPMCConfig,
                    'dw/order/PaymentMgr': mockPaymentMgr
                }
            );
            
            var config = r.getGooglePayConfig();
            delete global.request;
            
            assert.strictEqual(config.enabled, false, 'Should be disabled');
            assert.strictEqual(config.error, true, 'Should have error flag');
        });
    });
});
