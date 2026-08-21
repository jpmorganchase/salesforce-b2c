'use strict';

var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru().noPreserveCache();

describe('JPMCConfig', function () {
    var JPMCConfig;
    var SiteMock;
    var LoggerMock;
    var PaymentMgrMock;

    beforeEach(function () {
        SiteMock = require('../../../../../test/mocks/dw/system/Site');
        LoggerMock = require('../../../../../test/mocks/dw/system/Logger');
        PaymentMgrMock = require('../../../../../test/mocks/dw/order/PaymentMgr');
        
        SiteMock.resetMockPreferences();
        LoggerMock.resetAllLoggers();
        PaymentMgrMock.resetMockPaymentMethods();
        
        JPMCConfig = proxyquire('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JPMCConfig', {
            'dw/system/Site': SiteMock,
            'dw/system/Logger': LoggerMock,
            'dw/order/PaymentMgr': PaymentMgrMock,
            '*/cartridge/scripts/helpers/JPMCConstants': require('../../../../../cartridges/int_jpmc_core/cartridge/scripts/helpers/JPMCConstants'),
            '*/cartridge/scripts/helpers/JPMCMerchantResolver': {
                resolve: function () {
                    return { accountUpdaterMode: SiteMock.getCurrent().getPreferences().getCustom().jpmcAccountUpdaterMode || 'NONE' };
                }
            }
        });
    });

    describe('getAccessTokenConfig', function () {
        it('should return valid config with all required preferences', function () {
            SiteMock.setMockPreferences({
                JPMCClientID: 'test-client-id',
                JPMC_MerchantCode: 'test-merchant',
                JPMCResourceID: { value: 'test-resource-id' },
                jpmc_kid: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01',
                JPMCCertAlias: 'test-cert',
                JPMCPrivateKeyAlias: 'test-key'
            });

            var config = JPMCConfig.getAccessTokenConfig();

            assert.equal(config.client_id, 'test-client-id');
            assert.equal(config.merchantId, 'test-merchant');
            assert.equal(config.ida_url, 'https://idag2.jpmorganchase.com/adfs/oauth2/token');
            assert.equal(config.resource_id, 'test-resource-id');
            assert.equal(config.audience, 'https://idag2.jpmorganchase.com/adfs/oauth2/token');
            assert.equal(config.kid, 'ABCDEF0123456789ABCDEF0123456789ABCDEF01');
            assert.equal(config.certAlias, 'test-cert');
            assert.equal(config.privateKeyAlias, 'test-key');
        });

        it('should use default aliases when not configured', function () {
            SiteMock.setMockPreferences({
                JPMCClientID: 'test-client-id',
                JPMC_MerchantCode: 'test-merchant',
                JPMCResourceID: { value: 'test-resource-id' }
            });

            var config = JPMCConfig.getAccessTokenConfig();

            assert.equal(config.certAlias, 'jpmc-certificate');
            assert.equal(config.privateKeyAlias, 'jpmc-private-key');
        });

        it('should throw error when required preference is missing', function () {
            SiteMock.setMockPreferences({
                JPMCClientID: 'test-client-id'
            });

            assert.throws(function () {
                JPMCConfig.getAccessTokenConfig();
            }, Error, 'Required preference not configured');
        });

        it('should throw error when JPMCClientID is missing', function () {
            SiteMock.setMockPreferences({
                JPMC_MerchantCode: 'test-merchant',
                JPMCResourceID: { value: 'test-resource-id' }
            });

            assert.throws(function () {
                JPMCConfig.getAccessTokenConfig();
            }, Error);
        });
    });

    describe('getConfig', function () {
        it('should return valid config with all preferences', function () {
            SiteMock.setMockPreferences({
                JPMC_MerchantCode: 'test-merchant',
                JPMCMerchantSoftwareCompany: 'Test Company',
                JPMCMerchantSoftwareProduct: 'Test Product',
                JPMCMerchantSoftwareVersion: '2.0.0',
                JPMCPlatformId: 'test-platform',
                JPMCTokenizationType: { value: 'NETWORK_TOKEN' }
            });

            var config = JPMCConfig.getConfig();

            assert.equal(config.merchantId, 'test-merchant');
            assert.equal(config.merchantSoftware.companyName, 'Test Company');
            assert.equal(config.merchantSoftware.productName, 'Test Product');
            assert.equal(config.merchantSoftware.version, '2.0.0');
            assert.equal(config.platformId, 'test-platform');
            assert.equal(config.accountNumberType, 'NETWORK_TOKEN');
        });

        it('should use default merchant software values', function () {
            SiteMock.setMockPreferences({
                JPMC_MerchantCode: 'test-merchant'
            });

            var config = JPMCConfig.getConfig();

            assert.equal(config.merchantSoftware.companyName, 'JPMC Plugin');
            assert.equal(config.merchantSoftware.productName, 'JPMC SFCC SFRA Cartridge');
            assert.equal(config.merchantSoftware.version, '1.0');
            assert.equal(config.accountNumberType, 'SAFETECH_TOKEN');
        });

        it('should throw error when merchantId is missing', function () {
            SiteMock.setMockPreferences({});

            assert.throws(function () {
                JPMCConfig.getConfig();
            }, Error, 'Required preference not configured');
        });
    });

    describe('getCaptureMethod', function () {
        it('should return configured capture method', function () {
            SiteMock.setMockPreferences({
                JPMCCaptureMethod: { value: 'DELAYED' }
            });

            var method = JPMCConfig.getCaptureMethod();
            assert.equal(method, 'DELAYED');
        });

        it('should return MANUAL as default', function () {
            SiteMock.setMockPreferences({});

            var method = JPMCConfig.getCaptureMethod();
            assert.equal(method, 'MANUAL');
        });

        it('should handle string value', function () {
            SiteMock.setMockPreferences({
                JPMCCaptureMethod: 'NOW'
            });

            var method = JPMCConfig.getCaptureMethod();
            assert.equal(method, 'NOW');
        });

        it('should return default for invalid method', function () {
            SiteMock.setMockPreferences({
                JPMCCaptureMethod: { value: 'INVALID' }
            });

            var method = JPMCConfig.getCaptureMethod();
            assert.equal(method, 'MANUAL');
        });
    });

    describe('isFraudCheckEnabled', function () {
        it('should return true when enabled', function () {
            SiteMock.setMockPreferences({
                JPMCEnableFraudCheck: true
            });

            assert.isTrue(JPMCConfig.isFraudCheckEnabled());
        });

        it('should return false when disabled', function () {
            SiteMock.setMockPreferences({
                JPMCEnableFraudCheck: false
            });

            assert.isFalse(JPMCConfig.isFraudCheckEnabled());
        });

        it('should return false when not configured', function () {
            SiteMock.setMockPreferences({});

            assert.isFalse(JPMCConfig.isFraudCheckEnabled());
        });

        it('should handle string "true"', function () {
            SiteMock.setMockPreferences({
                JPMCEnableFraudCheck: 'true'
            });

            assert.isTrue(JPMCConfig.isFraudCheckEnabled());
        });
    });

    describe('isFraudCheckEnabledAtAuth', function () {
        it('should return true when enabled', function () {
            SiteMock.setMockPreferences({
                JPMCEnableFraudCheckAtAuth: true
            });

            assert.isTrue(JPMCConfig.isFraudCheckEnabledAtAuth());
        });

        it('should return false when not configured', function () {
            SiteMock.setMockPreferences({});

            assert.isFalse(JPMCConfig.isFraudCheckEnabledAtAuth());
        });
    });

    describe('isAVSEnabled', function () {
        it('should return true when enabled', function () {
            SiteMock.setMockPreferences({
                JPMCEnableAVS: true
            });

            assert.isTrue(JPMCConfig.isAVSEnabled());
        });

        it('should return false when disabled', function () {
            SiteMock.setMockPreferences({
                JPMCEnableAVS: false
            });

            assert.isFalse(JPMCConfig.isAVSEnabled());
        });

        it('should return false when not configured', function () {
            SiteMock.setMockPreferences({});

            assert.isFalse(JPMCConfig.isAVSEnabled());
        });
    });

    describe('getGooglePayConfig', function () {
        it('should return disabled config when payment method is not active', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', {
                isActive: function () { return false; }
            });

            var config = JPMCConfig.getGooglePayConfig();

            assert.isFalse(config.enabled);
        });

        it('should return valid config with all required preferences', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', {
                isActive: function () { return true; }
            });

            SiteMock.setMockPreferences({
                JPMCGooglePayEnvironment: { value: 'PRODUCTION' },
                JPMCGooglePayGateway: 'chase',
                JPMCGooglePayGatewayMerchantId: 'test-gateway-merchant-id',
                JPMCGooglePayMerchantId: 'test-merchant-id',
                JPMCGooglePayMerchantName: 'Test Merchant',
                JPMCGooglePayAllowedCardNetworks: 'VISA,MASTERCARD,AMEX',
                JPMCGooglePayAllowedAuthMethods: 'PAN_ONLY,CRYPTOGRAM_3DS'
            });

            var config = JPMCConfig.getGooglePayConfig();

            assert.isTrue(config.enabled);
            assert.equal(config.environment, 'PRODUCTION');
            assert.equal(config.gateway, 'chase');
            assert.equal(config.gatewayMerchantId, 'test-gateway-merchant-id');
            assert.equal(config.googlePayMerchantId, 'test-merchant-id');
            assert.equal(config.merchantName, 'Test Merchant');
            assert.isArray(config.allowedCardNetworks);
            assert.include(config.allowedCardNetworks, 'VISA');
            assert.include(config.allowedCardNetworks, 'MASTERCARD');
            assert.include(config.allowedCardNetworks, 'AMEX');
            assert.isArray(config.allowedAuthMethods);
            assert.include(config.allowedAuthMethods, 'PAN_ONLY');
            assert.include(config.allowedAuthMethods, 'CRYPTOGRAM_3DS');
        });

        it('should return error config when environment is missing', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', {
                isActive: function () { return true; }
            });

            SiteMock.setMockPreferences({});

            var config = JPMCConfig.getGooglePayConfig();

            assert.isFalse(config.enabled);
            assert.isTrue(config.error);
        });

        it('should handle whitespace in card networks', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', {
                isActive: function () { return true; }
            });

            SiteMock.setMockPreferences({
                JPMCGooglePayEnvironment: { value: 'TEST' },
                JPMCGooglePayGateway: 'chase',
                JPMCGooglePayGatewayMerchantId: 'test-id',
                JPMCGooglePayMerchantName: 'Test',
                JPMCGooglePayAllowedCardNetworks: ' VISA , MASTERCARD , AMEX ',
                JPMCGooglePayAllowedAuthMethods: 'PAN_ONLY, CRYPTOGRAM_3DS'
            });

            var config = JPMCConfig.getGooglePayConfig();

            assert.isTrue(config.enabled);
            assert.equal(config.allowedCardNetworks.length, 3);
            assert.include(config.allowedCardNetworks, 'VISA');
            assert.include(config.allowedCardNetworks, 'MASTERCARD');
        });

        it('should return error when gateway is not configured', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', { isActive: function () { return true; } });
            SiteMock.setMockPreferences({
                JPMCGooglePayEnvironment: { value: 'TEST' }
            });
            var config = JPMCConfig.getGooglePayConfig();
            assert.isFalse(config.enabled);
            assert.isTrue(config.error);
        });

        it('should return error when gatewayMerchantId is not configured', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', { isActive: function () { return true; } });
            SiteMock.setMockPreferences({
                JPMCGooglePayEnvironment: { value: 'TEST' },
                JPMCGooglePayGateway: 'chase'
            });
            var config = JPMCConfig.getGooglePayConfig();
            assert.isFalse(config.enabled);
            assert.isTrue(config.error);
        });

        it('should return error when merchantName is not configured', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', { isActive: function () { return true; } });
            SiteMock.setMockPreferences({
                JPMCGooglePayEnvironment: { value: 'TEST' },
                JPMCGooglePayGateway: 'chase',
                JPMCGooglePayGatewayMerchantId: 'gw-mid'
            });
            var config = JPMCConfig.getGooglePayConfig();
            assert.isFalse(config.enabled);
            assert.isTrue(config.error);
        });

        it('should return error when allowedCardNetworks is not configured', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', { isActive: function () { return true; } });
            SiteMock.setMockPreferences({
                JPMCGooglePayEnvironment: { value: 'TEST' },
                JPMCGooglePayGateway: 'chase',
                JPMCGooglePayGatewayMerchantId: 'gw-mid',
                JPMCGooglePayMerchantName: 'Store'
            });
            var config = JPMCConfig.getGooglePayConfig();
            assert.isFalse(config.enabled);
            assert.isTrue(config.error);
        });

        it('should return error when allowedCardNetworks is empty after parsing', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', { isActive: function () { return true; } });
            SiteMock.setMockPreferences({
                JPMCGooglePayEnvironment: { value: 'TEST' },
                JPMCGooglePayGateway: 'chase',
                JPMCGooglePayGatewayMerchantId: 'gw-mid',
                JPMCGooglePayMerchantName: 'Store',
                JPMCGooglePayAllowedCardNetworks: ',,,'
            });
            var config = JPMCConfig.getGooglePayConfig();
            assert.isFalse(config.enabled);
            assert.isTrue(config.error);
        });

        it('should return error when allowedAuthMethods is not configured', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', { isActive: function () { return true; } });
            SiteMock.setMockPreferences({
                JPMCGooglePayEnvironment: { value: 'TEST' },
                JPMCGooglePayGateway: 'chase',
                JPMCGooglePayGatewayMerchantId: 'gw-mid',
                JPMCGooglePayMerchantName: 'Store',
                JPMCGooglePayAllowedCardNetworks: 'VISA'
            });
            var config = JPMCConfig.getGooglePayConfig();
            assert.isFalse(config.enabled);
            assert.isTrue(config.error);
        });

        it('should return error when allowedAuthMethods is empty after parsing', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', { isActive: function () { return true; } });
            SiteMock.setMockPreferences({
                JPMCGooglePayEnvironment: { value: 'TEST' },
                JPMCGooglePayGateway: 'chase',
                JPMCGooglePayGatewayMerchantId: 'gw-mid',
                JPMCGooglePayMerchantName: 'Store',
                JPMCGooglePayAllowedCardNetworks: 'VISA',
                JPMCGooglePayAllowedAuthMethods: ',,,'
            });
            var config = JPMCConfig.getGooglePayConfig();
            assert.isFalse(config.enabled);
            assert.isTrue(config.error);
        });

        it('should return error for PRODUCTION without googlePayMerchantId', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', { isActive: function () { return true; } });
            SiteMock.setMockPreferences({
                JPMCGooglePayEnvironment: { value: 'PRODUCTION' },
                JPMCGooglePayGateway: 'chase',
                JPMCGooglePayGatewayMerchantId: 'gw-mid',
                JPMCGooglePayMerchantName: 'Store',
                JPMCGooglePayAllowedCardNetworks: 'VISA',
                JPMCGooglePayAllowedAuthMethods: 'PAN_ONLY'
            });
            var config = JPMCConfig.getGooglePayConfig();
            assert.isFalse(config.enabled);
            assert.isTrue(config.error);
        });

        it('should return disabled when payment method is null', function () {
            PaymentMgrMock.setMockPaymentMethod('JPMC_GOOGLE_PAY', null);
            var config = JPMCConfig.getGooglePayConfig();
            assert.isFalse(config.enabled);
        });
    });

    describe('isGooglePayOnCartEnabled', function () {
        it('should return true when enabled', function () {
            SiteMock.setMockPreferences({ JPMCGooglePayCartEnabled: true });
            assert.isTrue(JPMCConfig.isGooglePayOnCartEnabled());
        });

        it('should return true for string "true"', function () {
            SiteMock.setMockPreferences({ JPMCGooglePayCartEnabled: 'true' });
            assert.isTrue(JPMCConfig.isGooglePayOnCartEnabled());
        });

        it('should return false when not configured', function () {
            SiteMock.setMockPreferences({});
            assert.isFalse(JPMCConfig.isGooglePayOnCartEnabled());
        });
    });

    describe('isGooglePayOnPDPEnabled', function () {
        it('should return true when enabled', function () {
            SiteMock.setMockPreferences({ JPMCGooglePayPDPEnabled: true });
            assert.isTrue(JPMCConfig.isGooglePayOnPDPEnabled());
        });

        it('should return false when not configured', function () {
            SiteMock.setMockPreferences({});
            assert.isFalse(JPMCConfig.isGooglePayOnPDPEnabled());
        });
    });

    describe('getAccountUpdaterMode', function () {
        it('should return NONE when not configured', function () {
            SiteMock.setMockPreferences({});
            assert.equal(JPMCConfig.getAccountUpdaterMode(), 'NONE');
        });

        it('should return REAL_TIME when set', function () {
            SiteMock.setMockPreferences({ jpmcAccountUpdaterMode: { value: 'REAL_TIME' } });
            assert.equal(JPMCConfig.getAccountUpdaterMode(), 'REAL_TIME');
        });

        it('should return NONE for invalid value', function () {
            SiteMock.setMockPreferences({ jpmcAccountUpdaterMode: { value: 'INVALID' } });
            assert.equal(JPMCConfig.getAccountUpdaterMode(), 'NONE');
        });
    });

    describe('isAccountUpdaterRTAUEnabled', function () {
        it('should return false when mode is NONE', function () {
            SiteMock.setMockPreferences({});
            assert.isFalse(JPMCConfig.isAccountUpdaterRTAUEnabled());
        });

        it('should return true when mode is REAL_TIME', function () {
            SiteMock.setMockPreferences({ jpmcAccountUpdaterMode: { value: 'REAL_TIME' } });
            assert.isTrue(JPMCConfig.isAccountUpdaterRTAUEnabled());
        });
    });

    describe('getSitePreference edge cases', function () {
        it('should throw when required preference missing and prefs unavailable', function () {
            SiteMock.setMockPreferences({});
            assert.throws(function () {
                JPMCConfig.getPreference('NonExistentRequired', true);
            }, Error, 'Required preference not configured');
        });

        it('should return null when optional preference missing', function () {
            SiteMock.setMockPreferences({});
            var result = JPMCConfig.getPreference('NonExistent', false);
            assert.isNull(result);
        });
    });
});
