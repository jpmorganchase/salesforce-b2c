var Site = require('dw/system/Site');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 * Retrives orbital configuration object
 * @returns {Object} orbital configuration object
 */
function getPreferences() {
    var prefs = Site.getCurrent().getCustomPreferenceValue('jpmcOConfigStorage');
    var configStorage = JSON.parse(prefs);
    configStorage.jpmcOUserName = Site.getCurrent().getCustomPreferenceValue('jpmcOUserName');
    configStorage.jpmcOPassword = Site.getCurrent().getCustomPreferenceValue('jpmcOPassword');

    return configStorage;
}

/**
 * retrives mercahnt id
 * @returns {string} merchant ID of client site.
  * @param {*} localeID locale
 */
function getMerchantId(localeID) {
    var countryCode;
    var locale = request.getLocale();
    if (locale === 'default') {
        countryCode = localeID;
    } else {
        countryCode = locale;
    }
    var orbitalMerchantIDValue;
    var configStorage = getPreferences();
    Object.keys(configStorage.locales).forEach(function (localeId) {
        if (localeId.toLowerCase() === countryCode.toLowerCase()) {
            orbitalMerchantIDValue = configStorage.locales[localeId];
        }
    });

    return orbitalMerchantIDValue;
}

/**
 * retrive configuration value by name
 * @param {string} valueName name of the config value to retrive
 * @param {*} defaultValue default value to retrive
  * @param {*} locale locale
 * @returns {*} value of the configuration
 */
function getMerchantConfigValue(valueName, defaultValue, locale) {
    var result = defaultValue || null;
    var orbitalMerchantID = getMerchantId(locale);
    var configStorage = getPreferences();
    var merchantConfiguration = configStorage.jpmcOMerchantsMapping[orbitalMerchantID];
    if (!empty(merchantConfiguration) && !empty(merchantConfiguration[valueName])) {
        result = merchantConfiguration[valueName];
    }
    return result;
}
/**
 * @desc returns Locale of the site
 * @returns {string} locale string
 */
function getCurrency() {
    var currency = session.getCurrency().getCurrencyCode();
    return currency;
}

/**
  * @param {*} locale locale
 * @returns {Object} API Credentials for API Call.
 */
function getApiCredentials(locale) {
    var configStorage = getPreferences();

    var orbitalUsername = configStorage.jpmcOUserName;
    var orbitalPassword = configStorage.jpmcOPassword;
    var orbitalMerchantID = getMerchantId(locale);

    return { orbitalMerchantID: orbitalMerchantID,
        orbitalUsername: orbitalUsername,
        orbitalPassword: orbitalPassword
    };
}

/**
 *
 * @returns {boolean} Returns boolean for API Status.
 */
function isOrbitalAPIEnabled() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOEnabled, false);
}

/**
 *
 * @returns {boolean} Returns boolean for API Status.
 */
function isGooglePayEnabled() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOGooglePayEnabled, false);
}

/**
 *
 * @returns {boolean} Returns boolean for API Status.
 */
function isApplePayEnabled() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOApplePayEnabled, false);
}

/**
 *
 * @returns {boolean} Returns boolean for AVS Status.
 */
function isAVSEnabled() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOAVSEnabled, false);
}

/**
 * Incremental Authorization Enabled
  * @param {*} locale locale
 * @returns {boolean} Returns boolean for incremental authorization.
 */
function isIncrementalAuthorizationEnabled(locale) {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOIncrementalAuthorizationEnabled, false, locale);
}
/**
 * @returns {string} Returns paymentPlatform of Orbital API.
 */
function getPaymentPlatformMode() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOPlatformMode, JPMCOrbitalConstants.stratus);
}

/**
 * @returns {boolean} returns customer saved payment type.
 */
function getCustomerSavedPaymentType() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOCustomerSavedPaymentType, JPMCOrbitalConstants.orbitalProfile);
}
/**
 * @returns {boolean} Returns boolean for Page Encryption Status.
 */
function isPageEncryptionEnabled() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOPageEncryptionEnabled, false);
}

/**
 * @function getPageEncryptionConfigurations
 * @returns {Object} Returns object
 */
function getPageEncryptionConfigurations() {
    var subscriberID = getMerchantConfigValue(JPMCOrbitalConstants.jpmcOPageEncryptionConfigurationSubID, '');
    var instanceType = getMerchantConfigValue(JPMCOrbitalConstants.jpmcOPageEncryptionConfiguration, JPMCOrbitalConstants.testing);
    var pageEncryptionConfigurations = {
        pieSubscriberID: subscriberID
    };
    if (instanceType === JPMCOrbitalConstants.live) {
        pageEncryptionConfigurations.urls = {
            getKey: 'https://safetechpageencryption.chasepaymentech.com/pie/v1/64' + subscriberID + '/getkey.js',
            encryption: 'https://safetechpageencryption.chasepaymentech.com/pie/v1/encryption.js'
        };
    } else {
        pageEncryptionConfigurations.urls = {
            getKey: 'https://safetechpageencryptionvar.chasepaymentech.com/pie/v1/64' + subscriberID + '/getkey.js ',
            encryption: 'https://safetechpageencryptionvar.chasepaymentech.com/pie/v1/encryption.js'
        };
    }
    return pageEncryptionConfigurations;
}

/**
 * @function getAVSUnacceptedValues
 * @returns {Object} Returns object
 */
function getAVSUnacceptedValues() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOAVSUnacceptedValues, []);
}

/**
 * @function getVisaPayConfigurations
 * @returns {Object} Returns object
 */
function getVisaPayConfigurations() {
    var visaPayConfigurations = {
        merchantConfig: {}
    };

    visaPayConfigurations.apikey = getMerchantConfigValue(JPMCOrbitalConstants.jpmcOVisaPayApiKey, '');

    return visaPayConfigurations;
}

/**
 *
 * @returns {boolean} Returns boolean for API Status.
 */
function isVisaPayEnabled() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOVisaPayEnabled, false);
}

/**
 * get visa checkout payment mode
 * @returns {string} Returns payment mode value
 */
function getPaymentModeVisaPay() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOPaymentModeVisaPay, JPMCOrbitalConstants.Authorization);
}

/**
 * Update Profile Enabled
 * @returns {boolean} Returns boolean for update profile.
 */
function isUpdateProfileEnabled() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcEnabledUpdateProfile, false);
}

/**
 * @function getGooglePayConfigurations
 * @returns {Object} Returns object
 */
function getGooglePayConfigurations() {
    var googlePayConfigurations = {
        merchantInfo: {}
    };
    googlePayConfigurations.allowedCardNetworks = getMerchantConfigValue(JPMCOrbitalConstants.jpmcOGooglePayConfAllowedCardNetworks, []);
    googlePayConfigurations.environment = getMerchantConfigValue(JPMCOrbitalConstants.jpmcOGooglePayConfMerchantEnviroment, JPMCOrbitalConstants.TEST);
    googlePayConfigurations.merchantInfo.merchantId = getMerchantConfigValue(JPMCOrbitalConstants.jpmcOGooglePayConfMerchantId, '');
    googlePayConfigurations.merchantInfo.merchantName = getMerchantConfigValue(JPMCOrbitalConstants.jpmcOGooglePayConfMerchantName, '');
    googlePayConfigurations.gatewayMerchantId = getMerchantId();

    return JSON.stringify(googlePayConfigurations);
}

/**
 * get card payment mode
 * @returns {string} Returns payment mode value
 */
function getPaymentModeCard() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOPaymentModeCard, JPMCOrbitalConstants.Authorization);
}

/**
 * get Electronic Check payment mode
 * @returns {string} Returns payment mode value
 */
function getPaymentModeElectronicCheck() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOPaymentModeElectronicCheck, JPMCOrbitalConstants.Authorization);
}

/**
 * get google pay payment mode
 * @returns {string} Returns payment mode value
 */
function getPaymentModeGooglePay() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOPaymentModeGooglePay, JPMCOrbitalConstants.Authorization);
}

/**
 * get apple pay payment mode
 * @returns {string} Returns payment mode value
 */
function getPaymentModeApplePay() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOPaymentModeApplePay, JPMCOrbitalConstants.Authorization);
}


/**
 * get profile payment mode
 * @returns {string} Returns payment mode value
 */
function getPaymentModeProfile() {
    return getMerchantConfigValue(JPMCOrbitalConstants.jpmcOPaymentModeProfile, JPMCOrbitalConstants.Authorization);
}

/**
 * @function getCurrencyCodeMapping
 * @returns {Object} Returns object
 */
function getCurrencyCodeMapping() {
    return JPMCOrbitalConstants.currencyCodes;
}

module.exports = {
    getMerchantId: getMerchantId,
    getCurrency: getCurrency,
    getApiCredentials: getApiCredentials,
    isOrbitalAPIEnabled: isOrbitalAPIEnabled,
    isAVSEnabled: isAVSEnabled,
    getPaymentPlatformMode: getPaymentPlatformMode,
    getCustomerSavedPaymentType: getCustomerSavedPaymentType,
    isIncrementalAuthorizationEnabled: isIncrementalAuthorizationEnabled,
    isPageEncryptionEnabled: isPageEncryptionEnabled,
    getPageEncryptionConfigurations: getPageEncryptionConfigurations,
    getVisaPayConfigurations: getVisaPayConfigurations,
    getAVSUnacceptedValues: getAVSUnacceptedValues,
    isUpdateProfileEnabled: isUpdateProfileEnabled,
    getGooglePayConfigurations: getGooglePayConfigurations,
    getPaymentModeCard: getPaymentModeCard,
    getPaymentModeElectronicCheck: getPaymentModeElectronicCheck,
    getPaymentModeGooglePay: getPaymentModeGooglePay,
    isGooglePayEnabled: isGooglePayEnabled,
    isVisaPayEnabled: isVisaPayEnabled,
    getPaymentModeVisaPay: getPaymentModeVisaPay,
    isApplePayEnabled: isApplePayEnabled,
    getPaymentModeApplePay: getPaymentModeApplePay,
    getPaymentModeProfile: getPaymentModeProfile,
    getCurrencyCodeMapping: getCurrencyCodeMapping
};
