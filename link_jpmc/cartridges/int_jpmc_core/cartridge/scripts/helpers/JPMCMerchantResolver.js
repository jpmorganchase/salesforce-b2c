'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'resolver');
var CacheMgr = require('dw/system/CacheMgr');
var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');

/**
 * Returns the merchant config custom cache instance.
 * @returns {dw.system.Cache} result
 */
function getMerchantCache() {
    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');
    return CacheMgr.getCache(constants.MERCHANT_CONFIG_CACHE_ID);
}

/**
 * Safely extracts a string value from an enum-of-string attribute
 * @param {dw.value.EnumValue|string|null} enumVal - enum attribute value
 * @param {string|null} defaultVal - fallback if enumVal is empty
 * @returns {string|null} resolved string value
 */
function getEnumValue(enumVal, defaultVal) {
    if (!enumVal) {
        return defaultVal;
    }
    if (typeof enumVal === 'string') {
        return enumVal;
    }
    return (enumVal.value) ? String(enumVal.value) : defaultVal;
}

/**
 * Returns coValue if not null/undefined, else fallbackValue, else defaultValue.
 * @param {string|number|boolean|Object|null} coValue - custom object attribute value
 * @param {string|number|boolean|Object|null} fallbackValue - site preference fallback
 * @param {string|number|boolean|Object|null} defaultValue - hard-coded default
 * @param {boolean} isEnum - whether the value is an enum type
 * @returns {string|number|boolean|Object|null} resolved value
 */
function getFieldWithFallback(coValue, fallbackValue, defaultValue, isEnum) {
    var value = (coValue != null) ? coValue : fallbackValue;
    if (isEnum && value) {
        return getEnumValue(value, defaultValue);
    }
    return (value != null) ? value : defaultValue;
}

/**
 * Boolean-aware fallback: explicit true/false from CO wins, then fallback, then default.
 * @param {boolean|undefined} coValue - custom object boolean value
 * @param {boolean|undefined} fallbackValue - site preference fallback
 * @param {boolean} defaultValue - hard-coded default
 * @returns {boolean} resolved boolean
 */
function getBoolWithFallback(coValue, fallbackValue, defaultValue) {
    if (coValue === true) return true;
    if (coValue === false) return false;
    if (fallbackValue === true) return true;
    if (fallbackValue === false) return false;
    return defaultValue;
}

/**
 * Checks whether a CO is enabled (exists and enabled !== false).
 * @param {dw.object.CustomObject|null} co - merchant config custom object
 * @returns {boolean} true if CO exists and is enabled
 */
function isMerchantConfigEnabled(co) {
    return co && co.custom && co.custom.enabled !== false;
}

/**
 * Reads the JPMCEnableMultiMerchant site preference.
 * @returns {boolean} result
 */
function isMultiMerchantEnabled() {
    try {
        var Site = require('dw/system/Site');
        return Site.getCurrent().getPreferences().getCustom().JPMCEnableMultiMerchant === true;
    } catch (e) {
        Logger.warn('Error reading JPMCEnableMultiMerchant preference: {0}',
            e instanceof Error ? e.message : String(e));
        return false;
    }
}

/**
 * @param {dw.object.CustomObject} co - merchant config custom object
 * @returns {Object|null} Plain JS object with primitive values only
 */
function extractCOData(co) {
    if (!co) {
        return null;
    }

    return {
        configKey: String(co.custom.configKey || ''),
        enabled: co.custom.enabled !== false,
        merchantId: co.custom.merchantId || null,
        clientId: co.custom.clientId || null,
        resourceId: getEnumValue(co.custom.resourceId, null),
        certAlias: co.custom.certAlias || null,
        privateKeyAlias: co.custom.privateKeyAlias || null,
        kid: co.custom.kid || null,
        pieGetKeyUrl: getEnumValue(co.custom.pieGetKeyUrl, null),
        pieEncryptionUrl: getEnumValue(co.custom.pieEncryptionUrl, null),
        pieKey: co.custom.pieKey || null,
        checkoutMode: getEnumValue(co.custom.checkoutMode, null),
        dropInScriptUrl: getEnumValue(co.custom.dropInScriptUrl, null),
        dropInControlledSubmit: co.custom.dropInControlledSubmit,
        saveConsumerProfile: co.custom.saveConsumerProfile,
        dropInThemeOverrides: co.custom.dropInThemeOverrides || null,
        captureMethod: getEnumValue(co.custom.captureMethod, null),
        platformId: co.custom.platformId || null,
        tokenizationType: getEnumValue(co.custom.tokenizationType, null),
        enableAVS: co.custom.enableAVS,
        enableFraudCheck: co.custom.enableFraudCheck,
        enableFraudCheckAtAuth: co.custom.enableFraudCheckAtAuth,
        jpmc3DSEnabled: co.custom.jpmc3DSEnabled,
        googlePayGatewayMerchantId: co.custom.googlePayGatewayMerchantId || null,
        googlePayMerchantId: co.custom.googlePayMerchantId || null,
        googlePayMerchantName: co.custom.googlePayMerchantName || null,
        googlePayEnvironment: getEnumValue(co.custom.googlePayEnvironment, null),
        googlePayGateway: co.custom.googlePayGateway || null,
        googlePayAllowedCardNetworks: co.custom.googlePayAllowedCardNetworks || null,
        googlePayAllowedAuthMethods: co.custom.googlePayAllowedAuthMethods || null,
        JPMCGooglePayCartEnabled: co.custom.JPMCGooglePayCartEnabled,
        JPMCGooglePayPDPEnabled: co.custom.JPMCGooglePayPDPEnabled,
        kountClientId: co.custom.kountClientId || null,
        kountEnvironment: getEnumValue(co.custom.kountEnvironment, null),
        accountUpdaterMode: getEnumValue(co.custom.jpmcAccountUpdaterMode, null)
    };
}

/**
 * Merges extracted CO data with site preferences fallback.
 * CO values win when present; site preferences fill the gaps.
 * @param {Object} coData - Result from extractCOData()
 * @param {Object} fallbackConfig - Result from buildSitePrefsConfig()
 * @returns {Object} Merged configuration
 */
function mergeConfigWithSPFallback(coData, fallbackConfig) {
    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var fb = fallbackConfig || {};

    if (!coData) {
        return fb;
    }

    var c = coData.custom || coData;

    return {
        source: 'CustomObject',
        configKey: getFieldWithFallback(c.configKey, fb.configKey, '', false),
        merchantId: getFieldWithFallback(c.merchantId, fb.merchantId, null, false),
        clientId: getFieldWithFallback(c.clientId, fb.clientId, null, false),
        resourceId: getFieldWithFallback(c.resourceId, fb.resourceId, null, true),
        certAlias: getFieldWithFallback(c.certAlias, fb.certAlias, constants.DEFAULT_CERT_ALIAS, false),
        privateKeyAlias: getFieldWithFallback(c.privateKeyAlias, fb.privateKeyAlias, constants.DEFAULT_KEY_ALIAS, false),
        kid: getFieldWithFallback(c.kid, fb.kid, null, false),
        pieGetKeyUrl: getFieldWithFallback(c.pieGetKeyUrl, fb.pieGetKeyUrl, null, true),
        pieEncryptionUrl: getFieldWithFallback(c.pieEncryptionUrl, fb.pieEncryptionUrl, null, true),
        pieKey: getFieldWithFallback(c.pieKey, fb.pieKey, null, false),
        checkoutMode: getFieldWithFallback(c.checkoutMode, fb.checkoutMode, 'PIE', true),
        dropInScriptUrl: getFieldWithFallback(c.dropInScriptUrl, fb.dropInScriptUrl, null, true),
        dropInControlledSubmit: getBoolWithFallback(c.dropInControlledSubmit, fb.dropInControlledSubmit, true),
        saveConsumerProfile: getBoolWithFallback(c.saveConsumerProfile, fb.saveConsumerProfile, true),
        dropInThemeOverrides: getFieldWithFallback(c.dropInThemeOverrides, fb.dropInThemeOverrides, null, false),
        captureMethod: getFieldWithFallback(c.captureMethod, fb.captureMethod, null, true),
        platformId: getFieldWithFallback(c.platformId, fb.platformId, null, false),
        tokenizationType: getFieldWithFallback(c.tokenizationType, fb.tokenizationType, constants.DEFAULT_TOKEN_TYPE, true),
        enableAVS: getBoolWithFallback(c.enableAVS, fb.enableAVS, true),
        enableFraudCheck: getBoolWithFallback(c.enableFraudCheck, fb.enableFraudCheck, false),
        enableFraudCheckAtAuth: getBoolWithFallback(c.enableFraudCheckAtAuth, fb.enableFraudCheckAtAuth, false),
        jpmc3DSEnabled: getBoolWithFallback(c.jpmc3DSEnabled, fb.jpmc3DSEnabled, false),
        merchantSoftwareCompany: constants.DEFAULT_COMPANY_NAME,
        merchantSoftwareProduct: constants.DEFAULT_PRODUCT_NAME,
        merchantSoftwareVersion: constants.DEFAULT_VERSION,
        googlePayGatewayMerchantId: getFieldWithFallback(c.googlePayGatewayMerchantId, fb.googlePayGatewayMerchantId, null, false),
        googlePayMerchantId: getFieldWithFallback(c.googlePayMerchantId, fb.googlePayMerchantId, null, false),
        googlePayMerchantName: getFieldWithFallback(c.googlePayMerchantName, fb.googlePayMerchantName, null, false),
        googlePayEnvironment: getFieldWithFallback(c.googlePayEnvironment, fb.googlePayEnvironment, null, true),
        googlePayGateway: getFieldWithFallback(c.googlePayGateway, fb.googlePayGateway, null, false),
        googlePayAllowedCardNetworks: getFieldWithFallback(c.googlePayAllowedCardNetworks,
            fb.googlePayAllowedCardNetworks, null, false),
        googlePayAllowedAuthMethods: getFieldWithFallback(c.googlePayAllowedAuthMethods,
            fb.googlePayAllowedAuthMethods, null, false),
        JPMCGooglePayCartEnabled: getBoolWithFallback(c.JPMCGooglePayCartEnabled, fb.JPMCGooglePayCartEnabled, false),
        JPMCGooglePayPDPEnabled: getBoolWithFallback(c.JPMCGooglePayPDPEnabled, fb.JPMCGooglePayPDPEnabled, false),
        kountClientId: getFieldWithFallback(c.kountClientId, fb.kountClientId, null, false),
        kountEnvironment: getFieldWithFallback(c.kountEnvironment, fb.kountEnvironment, 'TEST', true),
        
        accountUpdaterMode: getFieldWithFallback(c.accountUpdaterMode, fb.accountUpdaterMode, 'NONE', false)
    };
}

/**
 * Builds configuration from site preferences
 * @returns {Object} result
 */
function buildSitePrefsConfig() {
    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var Site = require('dw/system/Site');
    var prefs = Site.getCurrent().getPreferences().getCustom();

    return {
        source: 'SitePreferences',
        configKey: Site.getCurrent().getID() + '::site-prefs',
        merchantId: prefs.JPMC_MerchantCode || null,
        clientId: prefs.JPMCClientID || null,
        resourceId: getEnumValue(prefs.JPMCResourceID, null),
        certAlias: prefs.JPMCCertAlias || constants.DEFAULT_CERT_ALIAS,
        privateKeyAlias: prefs.JPMCPrivateKeyAlias || constants.DEFAULT_KEY_ALIAS,
        kid: prefs.jpmc_kid || null,
        pieGetKeyUrl: getEnumValue(prefs.JPMCGetKeyUrl, null),
        pieEncryptionUrl: getEnumValue(prefs.JPMCEncryptionUrl, null),
        pieKey: prefs.JPMCPieKey || null,
        checkoutMode: getEnumValue(prefs.JPMCCheckoutMode, 'PIE'),
        dropInScriptUrl: getEnumValue(prefs.JPMCDropInScriptUrl, null),
        saveConsumerProfile: prefs.JPMCSaveConsumerProfile !== false,
        dropInThemeOverrides: prefs.JPMCDropInThemeOverrides || null,
        captureMethod: getEnumValue(prefs.JPMCCaptureMethod, constants.DEFAULT_CAPTURE_METHOD),
        platformId: prefs.JPMCPlatformId || null,
        tokenizationType: getEnumValue(prefs.JPMCTokenizationType, constants.DEFAULT_TOKEN_TYPE),
        enableAVS: prefs.JPMCEnableAVS !== false,
        enableFraudCheck: prefs.JPMCEnableFraudCheck === true,
        enableFraudCheckAtAuth: prefs.JPMCEnableFraudCheckAtAuth === true,
        jpmc3DSEnabled: prefs.jpmc3DSEnabled === true,
        merchantSoftwareCompany: constants.DEFAULT_COMPANY_NAME,
        merchantSoftwareProduct: constants.DEFAULT_PRODUCT_NAME,
        merchantSoftwareVersion: constants.DEFAULT_VERSION,
        googlePayGatewayMerchantId: prefs.JPMCGooglePayGatewayMerchantId || null,
        googlePayMerchantId: prefs.JPMCGooglePayMerchantId || null,
        googlePayMerchantName: prefs.JPMCGooglePayMerchantName || null,
        googlePayEnvironment: getEnumValue(prefs.JPMCGooglePayEnvironment, null),
        googlePayGateway: prefs.JPMCGooglePayGateway || null,
        googlePayAllowedCardNetworks: prefs.JPMCGooglePayAllowedCardNetworks || null,
        googlePayAllowedAuthMethods: prefs.JPMCGooglePayAllowedAuthMethods || null,
        JPMCGooglePayCartEnabled: prefs.JPMCGooglePayCartEnabled === true,
        JPMCGooglePayPDPEnabled: prefs.JPMCGooglePayPDPEnabled === true,
        kountClientId: prefs.jpmcKountClientId || null,
        kountEnvironment: getEnumValue(prefs.jpmcKountEnvironment, 'TEST'),
        applePayMerchantId: null,
        
        accountUpdaterMode: getEnumValue(prefs.jpmcAccountUpdaterMode, 'NONE')
    };
}

/**
 * Loads a merchant config CO by key, using cache
 * @param {string} coKey - e.g. "RefArch::en_CA"
 * @returns {Object|null} result
 */
function getMerchantConfigCO(coKey) {
    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var cache = getMerchantCache();
    var cacheKey = constants.MERCHANT_CONFIG_CACHE_KEY_PREFIX + coKey;

    var cached = cache.get(cacheKey, function () {
        try {
            var CustomObjectMgr = require('dw/object/CustomObjectMgr');
            var co = CustomObjectMgr.getCustomObject(constants.MERCHANT_CONFIG_CO_TYPE, coKey);

            if (!isMerchantConfigEnabled(co)) {
                return { _notFound: true };
            }

            return extractCOData(co);
        } catch (e) {
            Logger.warn('Error loading merchant CO for key {0}: {1}', coKey,
                e instanceof Error ? e.message : String(e));
            return { _notFound: true };
        }
    });

    return (cached && cached._notFound) ? null : cached;
}

/**
 * Resolves merchant configuration for the current request context.
 *
 * @param {Object} [overrides] - Optional { siteId, locale }
 * @returns {Object} Resolved configuration
 */
function resolve(overrides) {
    var Site = require('dw/system/Site');
    var opts = overrides || {};
    var siteId = opts.siteId || Site.getCurrent().getID();
    var locale = opts.locale || null;
    var sitePrefConfig = buildSitePrefsConfig();

    if (!isMultiMerchantEnabled()) {
        return sitePrefConfig;
    }

    if (!locale) {
        try {
            locale = request.getLocale();
        } catch (e) {
            Logger.debug('Request locale not available in current context: {0}',
                e instanceof Error ? e.message : String(e));
        }
    }

    if (locale) {
        var localeKey = siteId + '::' + locale;
        var localeResult = getMerchantConfigCO(localeKey);
        if (localeResult) {
            return mergeConfigWithSPFallback(localeResult, sitePrefConfig);
        }
    }

    return sitePrefConfig;
}

/**
 * Resolves merchant configuration for a specific order.
 * @param {dw.order.Order} order - order to resolve configuration for
 * @returns {Object} Resolved configuration
 */
function resolveForOrder(order) {
    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');

    if (!order) {
        return buildSitePrefsConfig();
    }

    var orderLocale = order.getCustomerLocaleID() || null;

    if (!isMultiMerchantEnabled()) {
        return resolve({ locale: orderLocale });
    }

    var merchantId = order.custom.jpmcMerchantId;
    if (!merchantId) {
        return resolve({ locale: orderLocale });
    }

    var cache = getMerchantCache();
    var midCacheKey = constants.MERCHANT_CONFIG_CACHE_KEY_PREFIX + 'mid_' + merchantId;

    var midCached = cache.get(midCacheKey, function () {
        try {
            var CustomObjectMgr = require('dw/object/CustomObjectMgr');
            var queryResult = CustomObjectMgr.queryCustomObjects(
                constants.MERCHANT_CONFIG_CO_TYPE,
                'custom.merchantId = {0}',
                null,
                merchantId
            );

            try {
                if (!queryResult.hasNext()) {
                    return { _notFound: true };
                }

                var co = queryResult.next();
                if (!isMerchantConfigEnabled(co)) {
                    return { _notFound: true };
                }

                return extractCOData(co);
            } finally {
                queryResult.close();
            }
        } catch (e) {
            Logger.warn('Error querying merchant CO by merchantId {0}: {1}', merchantId,
                e instanceof Error ? e.message : String(e));
            return { _notFound: true };
        }
    });

    if (midCached && !midCached._notFound) {
        var sitePrefConfig = buildSitePrefsConfig();
        return mergeConfigWithSPFallback(midCached, sitePrefConfig);
    }

    return resolve({ locale: orderLocale });
}

/**
 * Resolves merchant configuration by merchantId.
 * @param {string} merchantId - JPMC merchantId to look up.
 * @returns {Object} Resolved merchant configuration.
 */
function resolveByMerchantId(merchantId) {
    if (!merchantId || !isMultiMerchantEnabled()) {
        return resolve();
    }

    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var cache = getMerchantCache();
    var midCacheKey = constants.MERCHANT_CONFIG_CACHE_KEY_PREFIX + 'mid_' + merchantId;

    var midCached = cache.get(midCacheKey, function () {
        var queryResult = null;
        try {
            var CustomObjectMgr = require('dw/object/CustomObjectMgr');
            queryResult = CustomObjectMgr.queryCustomObjects(
                constants.MERCHANT_CONFIG_CO_TYPE,
                'custom.merchantId = {0}',
                null,
                merchantId
            );

            if (!queryResult.hasNext()) {
                return { _notFound: true };
            }

            var co = queryResult.next();
            if (!isMerchantConfigEnabled(co)) {
                return { _notFound: true };
            }

            return extractCOData(co);
        } catch (e) {
            Logger.warn('resolveByMerchantId: error querying CO for merchantId={0}: {1}', merchantId,
                e instanceof Error ? e.message : String(e));
            return { _notFound: true };
        } finally {
            if (queryResult) {
                try { queryResult.close(); } catch (ignored) { /* noop */ }
            }
        }
    });

    if (midCached && !midCached._notFound) {
        return mergeConfigWithSPFallback(midCached, buildSitePrefsConfig());
    }

    return resolve();
}

/**
 * Invalidates cached merchant configurations.
 * @param {string} configKey - merchant config key to invalidate
 * @param {string} [merchantId] - specific merchant ID to clear
 * @returns {boolean} true if invalidation succeeded
 */
function invalidateCache(configKey, merchantId) {
    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');

    if (!configKey) {
        Logger.warn('invalidateCache called with empty configKey');
        return false;
    }

    try {
        var cache = getMerchantCache();
        cache.invalidate(constants.MERCHANT_CONFIG_CACHE_KEY_PREFIX + configKey);

        if (merchantId) {
            cache.invalidate(constants.MERCHANT_CONFIG_CACHE_KEY_PREFIX + 'mid_' + merchantId);
        }

        return true;
    } catch (e) {
        Logger.error('Failed to invalidate merchant cache for configKey={0}, merchantId={1}: {2}',
            configKey, merchantId || 'N/A', e instanceof Error ? e.message : String(e));
        return false;
    }
}

/**
 * Maps resolved config to access token service format.
 * @param {Object} [resolvedConfig] - resolved merchant configuration
 * @returns {Object} token service configuration
 */
function toAccessTokenConfig(resolvedConfig) {
    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');

    if (!resolvedConfig) {
        resolvedConfig = buildSitePrefsConfig();
    }

    return {
        client_id: resolvedConfig.clientId,
        merchantId: resolvedConfig.merchantId,
        certAlias: resolvedConfig.certAlias || constants.DEFAULT_CERT_ALIAS,
        privateKeyAlias: resolvedConfig.privateKeyAlias || constants.DEFAULT_KEY_ALIAS,
        audience: 'https://idag2.jpmorganchase.com/adfs/oauth2/token',
        resource_id: resolvedConfig.resourceId,
        ida_url: 'https://idag2.jpmorganchase.com/adfs/oauth2/token',
        kid: resolvedConfig.kid || null
    };
}

/**
 * Filters resolved config by checkout mode to strip irrelevant settings.
 * DROP_IN mode: strips PIE URLs, Google Pay, tokenization type (Direct API only)
 * PIE/Direct mode: strips Drop-in settings (scriptUrl, themeOverrides, controlledSubmit)
 *
 * @param {Object} config - resolved merchant config
 * @returns {Object} mode-filtered config
 */
function filterByMode(config) {
    if (!config) return config;

    var mode = config.checkoutMode || 'PIE';
    var filtered = Object.create(null);
    var keys = Object.keys(config);
    for (var i = 0; i < keys.length; i++) {
        filtered[keys[i]] = config[keys[i]];
    }

    if (mode === 'DROP_IN') {
        // Strip Direct API settings not needed for Drop-in
        filtered.pieGetKeyUrl = null;
        filtered.pieEncryptionUrl = null;
        filtered.pieKey = null;
        filtered.tokenizationType = null;
        filtered.googlePayGatewayMerchantId = null;
        filtered.googlePayMerchantId = null;
        filtered.googlePayMerchantName = null;
        filtered.googlePayEnvironment = null;
        filtered.googlePayGateway = null;
        filtered.googlePayAllowedCardNetworks = null;
        filtered.googlePayAllowedAuthMethods = null;
        filtered.JPMCGooglePayCartEnabled = false;
        filtered.JPMCGooglePayPDPEnabled = false;
    } else {
        // Strip Drop-in settings not needed for Direct API
        filtered.dropInScriptUrl = null;
        filtered.dropInThemeOverrides = null;
        filtered.dropInControlledSubmit = false;
        filtered.saveConsumerProfile = false;
    }

    return filtered;
}

/**
 * Returns the JPMC checkout mode, preferring resolved merchant config when available.
 * Resolution order:
 * 1. resolvedConfig.checkoutMode (from custom object via resolve())
 * 2. JPMCConfig.getCheckoutMode() (site preference fallback)
 *
 * @returns {string} 'PIE' | 'DROP_IN'
 */
function getCheckoutMode() {
    var resolvedConfig = resolve();
    if (resolvedConfig && resolvedConfig.checkoutMode) {
        return String(resolvedConfig.checkoutMode);
    }
    
    return JPMCConfig.getCheckoutMode();
}

/**
 * Returns whether Google Pay should be shown on the cart page.
 * Resolution order:
 * 1. resolvedConfig.JPMCGooglePayCartEnabled (from custom object via resolve())
 * 2. JPMCConfig.isGooglePayOnCartEnabled() (site preference fallback)
 *
 * @returns {boolean} result
 */
function isGooglePayOnCartEnabled() {
    var resolvedConfig = resolve();
    // Only use resolved config value if it came from a custom object
    if (resolvedConfig && resolvedConfig.source === 'CustomObject' && typeof resolvedConfig.JPMCGooglePayCartEnabled === 'boolean') {
        return resolvedConfig.JPMCGooglePayCartEnabled;
    }
    
    return JPMCConfig.isGooglePayOnCartEnabled();
}

/**
 * Returns whether Google Pay should be shown on the product detail page.
 * Resolution order:
 * 1. resolvedConfig.JPMCGooglePayPDPEnabled (from custom object via resolve())
 * 2. JPMCConfig.isGooglePayOnPDPEnabled() (site preference fallback)
 *
 * @returns {boolean} result
 */
function isGooglePayOnPDPEnabled() {
    var resolvedConfig = resolve();
    // Only use resolved config value if it came from a custom object
    if (resolvedConfig && resolvedConfig.source === 'CustomObject' && typeof resolvedConfig.JPMCGooglePayPDPEnabled === 'boolean') {
        return resolvedConfig.JPMCGooglePayPDPEnabled;
    }
    
    return JPMCConfig.isGooglePayOnPDPEnabled();
}

/**
 * Returns Google Pay configuration object.
 * Uses resolved config which already has site preference fallbacks for each field.
 *
 * @returns {Object} Google Pay configuration with { enabled, environment, gateway, etc. }
 */
function getGooglePayConfig() {
    var PaymentMgr = require('dw/order/PaymentMgr');
    
    // Check if payment method is active
    var googlePayMethod = PaymentMgr.getPaymentMethod('JPMC_GOOGLE_PAY');
    if (!googlePayMethod || !googlePayMethod.isActive()) {
        return { enabled: false };
    }
    
    // Get resolved config (already merged with site pref fallbacks)
    var resolvedConfig = resolve();
    
    // Validate required fields (after merge with site prefs)
    if (!resolvedConfig.googlePayEnvironment) {
        Logger.error('JPMCGooglePayEnvironment not configured');
        return { enabled: false, error: true };
    }
    
    if (!resolvedConfig.googlePayGateway) {
        Logger.error('JPMCGooglePayGateway not configured');
        return { enabled: false, error: true };
    }
    
    if (!resolvedConfig.googlePayGatewayMerchantId) {
        Logger.error('JPMCGooglePayGatewayMerchantId not configured');
        return { enabled: false, error: true };
    }
    
    if (!resolvedConfig.googlePayMerchantName) {
        Logger.error('JPMCGooglePayMerchantName not configured');
        return { enabled: false, error: true };
    }
    
    if (!resolvedConfig.googlePayAllowedCardNetworks) {
        Logger.error('JPMCGooglePayAllowedCardNetworks not configured');
        return { enabled: false, error: true };
    }
    
    // Parse card networks
    var allowedCardNetworks = resolvedConfig.googlePayAllowedCardNetworks.split(',').map(function (n) {
        return n.trim();
    }).filter(function (n) {
        return n.length > 0;
    });
    
    if (!allowedCardNetworks.length) {
        Logger.error('JPMCGooglePayAllowedCardNetworks is empty after parsing');
        return { enabled: false, error: true };
    }
    
    if (!resolvedConfig.googlePayAllowedAuthMethods) {
        Logger.error('JPMCGooglePayAllowedAuthMethods not configured');
        return { enabled: false, error: true };
    }
    
    // Parse auth methods
    var allowedAuthMethods = resolvedConfig.googlePayAllowedAuthMethods.split(',').map(function (m) {
        return m.trim();
    }).filter(function (m) {
        return m.length > 0;
    });
    
    if (!allowedAuthMethods.length) {
        Logger.error('JPMCGooglePayAllowedAuthMethods is empty after parsing');
        return { enabled: false, error: true };
    }
    
    // Validate production environment requirements
    if (resolvedConfig.googlePayEnvironment === 'PRODUCTION' && !resolvedConfig.googlePayMerchantId) {
        Logger.error('JPMCGooglePayMerchantId required for PRODUCTION environment');
        return { enabled: false, error: true };
    }
    
    return {
        enabled: true,
        environment: resolvedConfig.googlePayEnvironment,
        gateway: resolvedConfig.googlePayGateway,
        gatewayMerchantId: resolvedConfig.googlePayGatewayMerchantId,
        googlePayMerchantId: resolvedConfig.googlePayMerchantId || '',
        merchantName: resolvedConfig.googlePayMerchantName,
        allowedCardNetworks: allowedCardNetworks,
        allowedAuthMethods: allowedAuthMethods
    };
}

// Export public API
module.exports = {
    resolve: resolve,
    resolveForOrder: resolveForOrder,
    resolveByMerchantId: resolveByMerchantId,
    toAccessTokenConfig: toAccessTokenConfig,
    invalidateCache: invalidateCache,
    isMultiMerchantEnabled: isMultiMerchantEnabled,
    mergeConfigWithSPFallback: mergeConfigWithSPFallback,
    filterByMode: filterByMode,
    getCheckoutMode: getCheckoutMode,
    isGooglePayOnCartEnabled: isGooglePayOnCartEnabled,
    isGooglePayOnPDPEnabled: isGooglePayOnPDPEnabled,
    getGooglePayConfig: getGooglePayConfig
};
