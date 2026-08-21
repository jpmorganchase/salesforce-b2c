'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

describe('bm_jpmc/scripts/helpers/MerchantConfigHelper', function () {
    var helper;

    beforeEach(function () {
        helper = proxyquire(
            '../../../../../../cartridges/bm_jpmc/cartridge/scripts/helpers/MerchantConfigHelper',
            {}
        );
    });

    // ─── getDefaultConfig ────────────────────────────────────────────────────

    describe('getDefaultConfig', function () {
        it('should return an object with all expected default fields', function () {
            var cfg = helper.getDefaultConfig();
            assert.equal(cfg.merchantId, '');
            assert.equal(cfg.resourceId, 'JPMC:URI:RS-105239-85484-HelixAPIEntitlementsCAT-PROD');
            assert.equal(cfg.captureMethod, 'MANUAL');
            assert.equal(cfg.tokenizationType, 'SAFETECH_TOKEN');
            assert.isTrue(cfg.enabled);
            assert.isTrue(cfg.enableAVS);
            assert.isFalse(cfg.enableFraudCheck);
            assert.equal(cfg.accountUpdaterMode, 'NONE');
        });

        it('should return a new copy each time (not a shared reference)', function () {
            var a = helper.getDefaultConfig();
            var b = helper.getDefaultConfig();
            a.merchantId = 'CHANGED';
            assert.equal(b.merchantId, '');
        });
    });

    // ─── isMaskedValue ───────────────────────────────────────────────────────

    describe('isMaskedValue', function () {
        it('should return true for the mask placeholder', function () {
            assert.isTrue(helper.isMaskedValue('***********'));
        });

        it('should return false for a real value', function () {
            assert.isFalse(helper.isMaskedValue('my-real-client-id'));
        });

        it('should return false for empty string', function () {
            assert.isFalse(helper.isMaskedValue(''));
        });

        it('should return false for null', function () {
            assert.isFalse(helper.isMaskedValue(null));
        });

        it('should return false for undefined', function () {
            assert.isFalse(helper.isMaskedValue(undefined));
        });
    });

    // ─── buildEditConfig ─────────────────────────────────────────────────────

    describe('buildEditConfig', function () {
        it('should return defaults when co is null', function () {
            var cfg = helper.buildEditConfig(null, false);
            assert.equal(cfg.merchantId, '');
            assert.equal(cfg.captureMethod, 'MANUAL');
        });

        it('should return defaults when co is undefined', function () {
            var cfg = helper.buildEditConfig(undefined, false);
            assert.equal(cfg.tokenizationType, 'SAFETECH_TOKEN');
        });

        it('should map basic string fields from custom object', function () {
            var co = {
                custom: {
                    configKey: 'TestSite::en_US',
                    merchantId: 'mid-123',
                    certAlias: 'my-cert',
                    privateKeyAlias: 'my-key',
                    pieGetKeyUrl: 'https://pie.jpmc.com/key',
                    pieEncryptionUrl: 'https://pie.jpmc.com/encrypt',
                    pieKey: 'test-pie-key',
                    platformId: 'platform-1',
                    googlePayGateway: 'jpmc',
                    googlePayGatewayMerchantId: 'gw-mid',
                    googlePayMerchantId: 'gp-mid',
                    googlePayMerchantName: 'Test Store',
                    googlePayAllowedCardNetworks: 'VISA,MC',
                    googlePayAllowedAuthMethods: 'PAN_ONLY',
                    applePayMerchantId: 'ap-mid',
                    kountClientId: 'kount-123'
                }
            };
            var cfg = helper.buildEditConfig(co, false);
            assert.equal(cfg.merchantId, 'mid-123');
            assert.equal(cfg.configKey, 'TestSite::en_US');
            assert.equal(cfg.locale, 'en_US');
            assert.equal(cfg.pieKey, 'test-pie-key');
            assert.equal(cfg.certAlias, 'my-cert');
            assert.equal(cfg.googlePayGateway, 'jpmc');
        });

        it('should mask clientId and kid when isMasked=true', function () {
            var co = {
                custom: {
                    clientId: 'real-client-id',
                    resourceId: 'real-resource-id',
                    kid: 'real-kid'
                }
            };
            var cfg = helper.buildEditConfig(co, true);
            assert.equal(cfg.clientId, '***********');
            assert.equal(cfg.resourceId, 'real-resource-id');
            assert.equal(cfg.kid, '***********');
        });

        it('should NOT mask clientId and kid when isMasked=false', function () {
            var co = {
                custom: {
                    clientId: 'real-client-id',
                    resourceId: 'real-resource-id',
                    kid: 'real-kid'
                }
            };
            var cfg = helper.buildEditConfig(co, false);
            assert.equal(cfg.clientId, 'real-client-id');
            assert.equal(cfg.resourceId, 'real-resource-id');
            assert.equal(cfg.kid, 'real-kid');
        });

        it('should not mask empty clientId even when isMasked=true', function () {
            var co = { custom: { clientId: '' } };
            var cfg = helper.buildEditConfig(co, true);
            assert.equal(cfg.clientId, '');
        });

        it('should extract enum values for captureMethod', function () {
            var co = { custom: { captureMethod: { value: 'NOW' } } };
            var cfg = helper.buildEditConfig(co, false);
            assert.equal(cfg.captureMethod, 'NOW');
        });

        it('should extract enum values for tokenizationType', function () {
            var co = { custom: { tokenizationType: { value: 'NETWORK_TOKEN' } } };
            var cfg = helper.buildEditConfig(co, false);
            assert.equal(cfg.tokenizationType, 'NETWORK_TOKEN');
        });

        it('should handle string captureMethod directly', function () {
            var co = { custom: { captureMethod: 'DELAYED' } };
            var cfg = helper.buildEditConfig(co, false);
            assert.equal(cfg.captureMethod, 'DELAYED');
        });

        it('should extract accountUpdaterMode from jpmcAccountUpdaterMode', function () {
            var co = { custom: { jpmcAccountUpdaterMode: { value: 'REAL_TIME' } } };
            var cfg = helper.buildEditConfig(co, false);
            assert.equal(cfg.accountUpdaterMode, 'REAL_TIME');
        });

        it('should fall back to defaultVal in safeEnumString when val has no value property', function () {
            // Passes an object without a .value property to trigger the false branch on line 17
            var co = { custom: { captureMethod: {} } };
            var cfg = helper.buildEditConfig(co, false);
            assert.equal(cfg.captureMethod, 'MANUAL');
        });

        it('should map boolean fields correctly', function () {
            var co = {
                custom: {
                    enabled: true,
                    enableAVS: false,
                    enableFraudCheck: true,
                    enableFraudCheckAtAuth: true,
                    JPMCGooglePayCartEnabled: true,
                    JPMCGooglePayPDPEnabled: false
                }
            };
            var cfg = helper.buildEditConfig(co, false);
            assert.isTrue(cfg.enabled);
            assert.isFalse(cfg.enableAVS);
            assert.isTrue(cfg.enableFraudCheck);
            assert.isTrue(cfg.enableFraudCheckAtAuth);
            assert.isTrue(cfg.JPMCGooglePayCartEnabled);
            assert.isFalse(cfg.JPMCGooglePayPDPEnabled);
        });

        it('should default enabled to true when not explicitly false', function () {
            var co = { custom: {} };
            var cfg = helper.buildEditConfig(co, false);
            assert.isTrue(cfg.enabled);
        });

        it('should set enabled to false when co.custom.enabled is false', function () {
            var co = { custom: { enabled: false } };
            var cfg = helper.buildEditConfig(co, false);
            assert.isFalse(cfg.enabled);
        });
    });

    // ─── buildFromParams ─────────────────────────────────────────────────────

    describe('buildFromParams', function () {
        function makeParam(val) {
            return { stringValue: val };
        }

        it('should map all params to config object', function () {
            var params = {
                configKey: makeParam('TestSite::fr_FR'),
                locale: makeParam('fr_FR'),
                enabled: makeParam('true'),
                merchantId: makeParam('mid-456'),
                clientId: makeParam('cid-456'),
                resourceId: makeParam('rid-456'),
                certAlias: makeParam('cert-a'),
                privateKeyAlias: makeParam('key-a'),
                kid: makeParam('kid-1'),
                pieGetKeyUrl: makeParam('https://pie/key'),
                pieEncryptionUrl: makeParam('https://pie/enc'),
                pieKey: makeParam('my-pie-key'),
                captureMethod: makeParam('NOW'),
                platformId: makeParam('plat-1'),
                tokenizationType: makeParam('SAFETECH_TOKEN'),
                enableAVS: makeParam('true'),
                enableFraudCheck: makeParam('true'),
                enableFraudCheckAtAuth: makeParam('false'),
                googlePayEnvironment: makeParam('PRODUCTION'),
                googlePayGateway: makeParam('jpmc'),
                googlePayGatewayMerchantId: makeParam('gw-mid'),
                googlePayMerchantId: makeParam('gp-mid'),
                googlePayMerchantName: makeParam('My Store'),
                googlePayAllowedCardNetworks: makeParam('VISA'),
                googlePayAllowedAuthMethods: makeParam('CRYPTOGRAM_3DS'),
                JPMCGooglePayCartEnabled: makeParam('true'),
                JPMCGooglePayPDPEnabled: makeParam('false'),
                applePayMerchantId: makeParam('apple-mid'),
                kountClientId: makeParam('kount-cid'),
                kountEnvironment: makeParam('PROD'),
                checkoutMode: makeParam('PIE'),
                dropInScriptUrl: makeParam('https://checkout-cat.merchant.jpmorgan.com/drop-in-ui.mjs'),
                dropInControlledSubmit: makeParam('true'),
                saveConsumerProfile: makeParam('true'),
                dropInThemeOverrides: makeParam(''),
                accountUpdaterMode: makeParam('REAL_TIME'),
                jpmc3DSEnabled: makeParam('false')
            };

            var cfg = helper.buildFromParams(params);
            assert.equal(cfg.configKey, 'TestSite::fr_FR');
            assert.equal(cfg.locale, 'fr_FR');
            assert.isTrue(cfg.enabled);
            assert.equal(cfg.merchantId, 'mid-456');
            assert.equal(cfg.clientId, 'cid-456');
            assert.equal(cfg.captureMethod, 'NOW');
            assert.isTrue(cfg.enableFraudCheck);
            assert.isFalse(cfg.enableFraudCheckAtAuth);
            assert.equal(cfg.googlePayEnvironment, 'PRODUCTION');
            assert.isTrue(cfg.JPMCGooglePayCartEnabled);
            assert.isFalse(cfg.JPMCGooglePayPDPEnabled);
            assert.equal(cfg.accountUpdaterMode, 'REAL_TIME');
        });

        it('should handle enabled=false', function () {
            var baseParams = {
                configKey: { stringValue: '' }, locale: { stringValue: '' }, enabled: { stringValue: 'false' },
                merchantId: { stringValue: '' }, clientId: { stringValue: '' }, resourceId: { stringValue: '' },
                certAlias: { stringValue: '' }, privateKeyAlias: { stringValue: '' }, kid: { stringValue: '' },
                pieGetKeyUrl: { stringValue: '' }, pieEncryptionUrl: { stringValue: '' }, pieKey: { stringValue: '' }, captureMethod: { stringValue: 'MANUAL' },
                platformId: { stringValue: '' }, tokenizationType: { stringValue: 'SAFETECH_TOKEN' },
                enableAVS: { stringValue: 'true' }, enableFraudCheck: { stringValue: 'false' },
                enableFraudCheckAtAuth: { stringValue: 'false' }, googlePayEnvironment: { stringValue: '' },
                googlePayGateway: { stringValue: '' }, googlePayGatewayMerchantId: { stringValue: '' },
                googlePayMerchantId: { stringValue: '' }, googlePayMerchantName: { stringValue: '' },
                googlePayAllowedCardNetworks: { stringValue: '' }, googlePayAllowedAuthMethods: { stringValue: '' },
                JPMCGooglePayCartEnabled: { stringValue: 'false' }, JPMCGooglePayPDPEnabled: { stringValue: 'false' },
                applePayMerchantId: { stringValue: '' }, kountClientId: { stringValue: '' },
                kountEnvironment: { stringValue: '' }, checkoutMode: { stringValue: 'PIE' },
                dropInScriptUrl: { stringValue: '' }, dropInControlledSubmit: { stringValue: 'true' },
                saveConsumerProfile: { stringValue: 'true' }, dropInThemeOverrides: { stringValue: '' },
                accountUpdaterMode: { stringValue: 'NONE' }, jpmc3DSEnabled: { stringValue: 'false' }
            };
            var cfg = helper.buildFromParams(baseParams);
            assert.isFalse(cfg.enabled);
        });

        it('should default enableAVS to true when not "false"', function () {
            var params = {
                configKey: { stringValue: '' }, locale: { stringValue: '' }, enabled: { stringValue: 'true' },
                merchantId: { stringValue: '' }, clientId: { stringValue: '' }, resourceId: { stringValue: '' },
                certAlias: { stringValue: '' }, privateKeyAlias: { stringValue: '' }, kid: { stringValue: '' },
                pieGetKeyUrl: { stringValue: '' }, pieEncryptionUrl: { stringValue: '' }, pieKey: { stringValue: '' }, captureMethod: { stringValue: 'MANUAL' },
                platformId: { stringValue: '' }, tokenizationType: { stringValue: 'SAFETECH_TOKEN' },
                enableAVS: { stringValue: 'anything' }, enableFraudCheck: { stringValue: 'false' },
                enableFraudCheckAtAuth: { stringValue: 'false' }, googlePayEnvironment: { stringValue: '' },
                googlePayGateway: { stringValue: '' }, googlePayGatewayMerchantId: { stringValue: '' },
                googlePayMerchantId: { stringValue: '' }, googlePayMerchantName: { stringValue: '' },
                googlePayAllowedCardNetworks: { stringValue: '' }, googlePayAllowedAuthMethods: { stringValue: '' },
                JPMCGooglePayCartEnabled: { stringValue: 'false' }, JPMCGooglePayPDPEnabled: { stringValue: 'false' },
                applePayMerchantId: { stringValue: '' }, kountClientId: { stringValue: '' },
                kountEnvironment: { stringValue: '' }, checkoutMode: { stringValue: 'PIE' },
                dropInScriptUrl: { stringValue: '' }, dropInControlledSubmit: { stringValue: 'true' },
                saveConsumerProfile: { stringValue: 'true' }, dropInThemeOverrides: { stringValue: '' },
                accountUpdaterMode: { stringValue: 'NONE' }, jpmc3DSEnabled: { stringValue: 'false' }
            };
            assert.isTrue(helper.buildFromParams(params).enableAVS);
        });

    });

    // ─── assignToCustomObject ─────────────────────────────────────────────────

    describe('assignToCustomObject', function () {
        function makeCO() {
            return { custom: {} };
        }

        it('should assign all non-sensitive fields to custom object', function () {
            var co = makeCO();
            var config = {
                configKey: 'TestSite::de_DE',
                enabled: true,
                merchantId: 'mid-789',
                clientId: 'cid-real',
                resourceId: 'rid-real',
                certAlias: 'cert-b',
                privateKeyAlias: 'key-b',
                kid: 'kid-real',
                pieGetKeyUrl: 'https://pie/k',
                pieEncryptionUrl: 'https://pie/e',
                pieKey: 'pie-key-1',
                captureMethod: 'DELAYED',
                platformId: 'plat-2',
                tokenizationType: 'NETWORK_TOKEN',
                enableAVS: false,
                enableFraudCheck: true,
                enableFraudCheckAtAuth: false,
                googlePayEnvironment: 'PRODUCTION',
                googlePayGateway: 'gateway',
                googlePayGatewayMerchantId: 'gw-mid-2',
                googlePayMerchantId: 'gp-mid-2',
                googlePayMerchantName: 'Store Name',
                googlePayAllowedCardNetworks: 'VISA,AMEX',
                googlePayAllowedAuthMethods: 'PAN_ONLY,CRYPTOGRAM_3DS',
                JPMCGooglePayCartEnabled: true,
                JPMCGooglePayPDPEnabled: true,
                applePayMerchantId: 'ap-mid-2',
                kountClientId: 'kount-2',
                kountEnvironment: 'PROD',
                accountUpdaterMode: 'REAL_TIME'
            };

            helper.assignToCustomObject(co, config);

            assert.equal(co.custom.configKey, 'TestSite::de_DE');
            assert.isTrue(co.custom.enabled);
            assert.equal(co.custom.merchantId, 'mid-789');
            assert.equal(co.custom.clientId, 'cid-real');
            assert.equal(co.custom.resourceId, 'rid-real');
            assert.equal(co.custom.captureMethod, 'DELAYED');
            assert.isFalse(co.custom.enableAVS);
            assert.isTrue(co.custom.enableFraudCheck);
            assert.isTrue(co.custom.JPMCGooglePayCartEnabled);
            assert.equal(co.custom.jpmcAccountUpdaterMode, 'REAL_TIME');
        });

        it('should NOT overwrite clientId when value is masked', function () {
            var co = makeCO();
            co.custom.clientId = 'original-client-id';
            helper.assignToCustomObject(co, {
                configKey: 'k', enabled: true, merchantId: 'm', clientId: '***********',
                resourceId: 'rid', certAlias: '',
                privateKeyAlias: '', kid: 'kid-val', pieGetKeyUrl: '', pieEncryptionUrl: '',
                pieKey: '',
                captureMethod: 'MANUAL', platformId: '', tokenizationType: 'SAFETECH_TOKEN',
                enableAVS: true, enableFraudCheck: false, enableFraudCheckAtAuth: false,
                googlePayEnvironment: 'TEST', googlePayGateway: '', googlePayGatewayMerchantId: '',
                googlePayMerchantId: '', googlePayMerchantName: '', googlePayAllowedCardNetworks: '',
                googlePayAllowedAuthMethods: '', JPMCGooglePayCartEnabled: false, JPMCGooglePayPDPEnabled: false,
                applePayMerchantId: '', kountClientId: '', kountEnvironment: 'TEST',
                accountUpdaterMode: 'NONE'
            });
            assert.equal(co.custom.clientId, 'original-client-id');
        });

        it('should overwrite resourceId when provided', function () {
            var co = makeCO();
            co.custom.resourceId = 'original-resource-id';
            helper.assignToCustomObject(co, {
                configKey: 'k', enabled: true, merchantId: 'm', clientId: 'cid',
                resourceId: 'new-resource-id', certAlias: '',
                privateKeyAlias: '', kid: '', pieGetKeyUrl: '', pieEncryptionUrl: '',
                pieKey: '',
                captureMethod: 'MANUAL', platformId: '', tokenizationType: 'SAFETECH_TOKEN',
                enableAVS: true, enableFraudCheck: false, enableFraudCheckAtAuth: false,
                googlePayEnvironment: 'TEST', googlePayGateway: '', googlePayGatewayMerchantId: '',
                googlePayMerchantId: '', googlePayMerchantName: '', googlePayAllowedCardNetworks: '',
                googlePayAllowedAuthMethods: '', JPMCGooglePayCartEnabled: false, JPMCGooglePayPDPEnabled: false,
                applePayMerchantId: '', kountClientId: '', kountEnvironment: 'TEST',
                accountUpdaterMode: 'NONE'
            });
            assert.equal(co.custom.resourceId, 'new-resource-id');
        });

        it('should NOT overwrite kid when value is masked', function () {
            var co = makeCO();
            co.custom.kid = 'original-kid';
            helper.assignToCustomObject(co, {
                configKey: 'k', enabled: true, merchantId: 'm', clientId: 'cid',
                resourceId: 'rid', certAlias: '',
                privateKeyAlias: '', kid: '***********', pieGetKeyUrl: '', pieEncryptionUrl: '', pieKey: '',
                captureMethod: 'MANUAL', platformId: '', tokenizationType: 'SAFETECH_TOKEN',
                enableAVS: true, enableFraudCheck: false, enableFraudCheckAtAuth: false,
                googlePayEnvironment: 'TEST', googlePayGateway: '', googlePayGatewayMerchantId: '',
                googlePayMerchantId: '', googlePayMerchantName: '', googlePayAllowedCardNetworks: '',
                googlePayAllowedAuthMethods: '', JPMCGooglePayCartEnabled: false, JPMCGooglePayPDPEnabled: false,
                applePayMerchantId: '', kountClientId: '', kountEnvironment: 'TEST',
                accountUpdaterMode: 'NONE'
            });
            assert.equal(co.custom.kid, 'original-kid');
        });

    });

    // ─── module exports ──────────────────────────────────────────────────────

    describe('module exports', function () {
        it('should export all required functions', function () {
            assert.isFunction(helper.getDefaultConfig);
            assert.isFunction(helper.buildEditConfig);
            assert.isFunction(helper.buildFromParams);
            assert.isFunction(helper.assignToCustomObject);
            assert.isFunction(helper.isMaskedValue);
        });
    });
});
