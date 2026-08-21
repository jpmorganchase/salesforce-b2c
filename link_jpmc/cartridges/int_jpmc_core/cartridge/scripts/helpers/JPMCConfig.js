'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'config');
var constants = require('*/cartridge/scripts/helpers/JPMCConstants');

/**
 * @param {dw.system.SitePreferences} prefs - site preferences custom attributes
 * @param {string} key - preference attribute name
 * @param {boolean} [required] - whether to log error if missing
 * @returns {string|boolean|number|Object|null} preference value
 */
function getSitePreference(prefs, key, required) {
    if (!prefs) {
        if (required) throw new Error('Site preferences unavailable');
        return null;
    }

    var value = prefs.getCustom()[key];

    if (value !== null && value !== undefined && value !== '') {
        return value;
    }

    if (required) {
        throw new Error('Required preference not configured: ' + key);
    }

    return null;
}

/**
 * @returns {Object} result
 * @throws {Error}
 */
function getAccessTokenConfig() {
    var Site = require('dw/system/Site');
    var prefs = Site.getCurrent().getPreferences();

    var resourceIdPref = getSitePreference(prefs, 'JPMCResourceID', true);
    var resourceId = (resourceIdPref && typeof resourceIdPref === 'object' && resourceIdPref.value)
        ? resourceIdPref.value : resourceIdPref;

    return {
        client_id: getSitePreference(prefs, 'JPMCClientID', true),
        merchantId: getSitePreference(prefs, 'JPMC_MerchantCode', true),
        certAlias: getSitePreference(prefs, 'JPMCCertAlias', false) || constants.DEFAULT_CERT_ALIAS,
        privateKeyAlias: getSitePreference(prefs, 'JPMCPrivateKeyAlias', false) || constants.DEFAULT_KEY_ALIAS,
        audience: 'https://idag2.jpmorganchase.com/adfs/oauth2/token',
        resource_id: resourceId,
        ida_url: 'https://idag2.jpmorganchase.com/adfs/oauth2/token',
        kid: getSitePreference(prefs, 'jpmc_kid', false)
    };
}

/**
 * @param {string} key - preference attribute name
 * @param {boolean} [required] - whether to log error if missing
 * @returns {string|boolean|number|Object|null} preference value
 */
function getPreference(key, required) {
    var Site = require('dw/system/Site');
    return getSitePreference(Site.getCurrent().getPreferences(), key, required);
}

/**
 * @returns {Object} result
 * @throws {Error}
 */
function getConfig() {
    var Site = require('dw/system/Site');
    var prefs = Site.getCurrent().getPreferences();

    var tokenType = getSitePreference(prefs, 'JPMCTokenizationType', false);

    return {
        merchantId: getSitePreference(prefs, 'JPMC_MerchantCode', true),
        merchantSoftware: {
            companyName: getSitePreference(prefs, 'JPMCMerchantSoftwareCompany', false) || constants.DEFAULT_COMPANY_NAME,
            productName: getSitePreference(prefs, 'JPMCMerchantSoftwareProduct', false) || constants.DEFAULT_PRODUCT_NAME,
            version: getSitePreference(prefs, 'JPMCMerchantSoftwareVersion', false) || constants.DEFAULT_VERSION
        },
        platformId: getSitePreference(prefs, 'JPMCPlatformId', false),
        accountNumberType: (tokenType && tokenType.value) || constants.DEFAULT_TOKEN_TYPE
    };
}

/**
 * @returns {string} result
 */
function getCaptureMethod() {
    var methodPref = getPreference('JPMCCaptureMethod', false);
    var methodValue = null;

    if (methodPref && typeof methodPref === 'object' && Object.prototype.hasOwnProperty.call(methodPref, 'value')) {
        methodValue = methodPref.value;
    } else if (typeof methodPref === 'string') {
        methodValue = methodPref;
    }

    var method = methodValue || constants.DEFAULT_CAPTURE_METHOD;
    return constants.VALID_CAPTURE_METHODS.indexOf(method) !== -1 ? method : constants.DEFAULT_CAPTURE_METHOD;
}

/**
 * @returns {boolean} result
 */
function isFraudCheckEnabled() {
    var val = getPreference('JPMCEnableFraudCheck', false);
    return val === true || val === 'true';
}

/**
 * @returns {boolean} result
 */
function isFraudCheckEnabledAtAuth() {
    var val = getPreference('JPMCEnableFraudCheckAtAuth', false);
    return val === true || val === 'true';
}

/**
 * Checks if Address Verification Service (AVS) is enabled
 * When enabled, billing address is included in Verify and Auth API payloads
 * @returns {boolean} result
 */
function isAVSEnabled() {
    var val = getPreference('JPMCEnableAVS', false);
    return val === true || val === 'true';
}

/**
 * Gets Google Pay configuration from site preferences.
 * All values must come from Site Preferences — no hardcoded defaults.
 * @returns {Object} result
 */
function getGooglePayConfig() {
    var Site = require('dw/system/Site');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var prefs = Site.getCurrent().getPreferences();

    var googlePayMethod = PaymentMgr.getPaymentMethod('JPMC_GOOGLE_PAY');
    if (!googlePayMethod || !googlePayMethod.isActive()) {
        return { enabled: false };
    }

    var environmentEnum = getSitePreference(prefs, 'JPMCGooglePayEnvironment', false);
    var environment = (environmentEnum && environmentEnum.value) ? environmentEnum.value : null;
    if (!environment) {
        Logger.error('JPMCGooglePayEnvironment not configured');
        return { enabled: false, error: true };
    }

    var gateway = getSitePreference(prefs, 'JPMCGooglePayGateway', false);
    if (!gateway) {
        Logger.error('JPMCGooglePayGateway not configured');
        return { enabled: false, error: true };
    }

    var gatewayMerchantId = getSitePreference(prefs, 'JPMCGooglePayGatewayMerchantId', false);
    if (!gatewayMerchantId) {
        Logger.error('JPMCGooglePayGatewayMerchantId not configured');
        return { enabled: false, error: true };
    }

    var merchantName = getSitePreference(prefs, 'JPMCGooglePayMerchantName', false);
    if (!merchantName) {
        Logger.error('JPMCGooglePayMerchantName not configured');
        return { enabled: false, error: true };
    }

    var allowedCardNetworksStr = getSitePreference(prefs, 'JPMCGooglePayAllowedCardNetworks', false);
    if (!allowedCardNetworksStr) {
        Logger.error('JPMCGooglePayAllowedCardNetworks not configured');
        return { enabled: false, error: true };
    }

    var allowedCardNetworks = allowedCardNetworksStr.split(',').map(function (n) {
        return n.trim();
    }).filter(function (n) {
        return n.length > 0;
    });

    if (!allowedCardNetworks.length) {
        Logger.error('JPMCGooglePayAllowedCardNetworks is empty after parsing');
        return { enabled: false, error: true };
    }

    var allowedAuthMethodsStr = getSitePreference(prefs, 'JPMCGooglePayAllowedAuthMethods', false);
    if (!allowedAuthMethodsStr) {
        Logger.error('JPMCGooglePayAllowedAuthMethods not configured');
        return { enabled: false, error: true };
    }

    var allowedAuthMethods = allowedAuthMethodsStr.split(',').map(function (m) {
        return m.trim();
    }).filter(function (m) {
        return m.length > 0;
    });

    if (!allowedAuthMethods.length) {
        Logger.error('JPMCGooglePayAllowedAuthMethods is empty after parsing');
        return { enabled: false, error: true };
    }

    var googlePayMerchantId = getSitePreference(prefs, 'JPMCGooglePayMerchantId', false);
    if (environment === 'PRODUCTION' && !googlePayMerchantId) {
        Logger.error('JPMCGooglePayMerchantId required for PRODUCTION environment');
        return { enabled: false, error: true };
    }

    return {
        enabled: true,
        environment: environment,
        gateway: gateway,
        gatewayMerchantId: gatewayMerchantId,
        googlePayMerchantId: googlePayMerchantId || '',
        merchantName: merchantName,
        allowedCardNetworks: allowedCardNetworks,
        allowedAuthMethods: allowedAuthMethods
    };
}

/**
 * Returns whether Google Pay should be shown on the cart page.
 * Checkout always shows Google Pay; this flag additionally enables it on the cart.
 * @returns {boolean} result
 */
function isGooglePayOnCartEnabled() {
    var val = getPreference('JPMCGooglePayCartEnabled', false);
    return val === true || val === 'true';
}

/**
 * Returns whether Google Pay should be shown on the product detail page.
 * @returns {boolean} result
 */
function isGooglePayOnPDPEnabled() {
    var val = getPreference('JPMCGooglePayPDPEnabled', false);
    return val === true || val === 'true';
}

/**
 * @returns {string} One of NONE | REAL_TIME
 */
function getAccountUpdaterMode() {
    var ALLOWED = ['NONE', 'REAL_TIME'];
    try {
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = JPMCMerchantResolver.resolve();
        var raw = resolvedConfig && resolvedConfig.accountUpdaterMode;
        if (raw && typeof raw === 'object' && raw.value) {
            raw = raw.value;
        }
        if (typeof raw === 'string' && ALLOWED.indexOf(raw) !== -1) {
            return raw;
        }
    } catch (e) {
        Logger.warn('getAccountUpdaterMode: Resolver failed: {0}', e instanceof Error ? e.message : String(e));
    }
    return 'NONE';
}

/**
 * @returns {boolean} true when Real-Time Account Updater is enabled in checkout.
 */
function isAccountUpdaterRTAUEnabled() {
    return getAccountUpdaterMode() === 'REAL_TIME';
}

/**
 * Checks if 3D Secure authentication is enabled
 * @returns {boolean} result
 */
function is3DSEnabled() {
    var val = getPreference('jpmc3DSEnabled', false);
    return val === true || val === 'true';
}

/**
 * Reads the JPMCCheckoutMode site preference.
 * @returns {string} 'PIE' | 'DROP_IN'
 */
function getCheckoutMode() {
    var raw = getPreference('JPMCCheckoutMode', 'PIE');
    if (raw && typeof raw === 'object' && raw.value) {
        return raw.value;
    }
    return (typeof raw === 'string' && raw) ? raw : 'PIE';
}

module.exports = {
    getAccessTokenConfig: getAccessTokenConfig,
    getPreference: getPreference,
    getConfig: getConfig,
    getCaptureMethod: getCaptureMethod,
    getGooglePayConfig: getGooglePayConfig,
    isGooglePayOnCartEnabled: isGooglePayOnCartEnabled,
    isGooglePayOnPDPEnabled: isGooglePayOnPDPEnabled,
    isFraudCheckEnabled: isFraudCheckEnabled,
    isFraudCheckEnabledAtAuth: isFraudCheckEnabledAtAuth,
    isAVSEnabled: isAVSEnabled,
    getAccountUpdaterMode: getAccountUpdaterMode,
    isAccountUpdaterRTAUEnabled: isAccountUpdaterRTAUEnabled,
    is3DSEnabled: is3DSEnabled,
    getCheckoutMode: getCheckoutMode
};
