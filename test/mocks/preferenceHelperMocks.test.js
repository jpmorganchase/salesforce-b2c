var JPMCOrbitalConstants = require('../../test/mocks/jpmcOConstantsHelperMocks.test');

var Site = {
    getCurrent: function () {
        return {
            getCustomPreferenceValue: function (value) {
                if (value === 'jpmcOConfigStorage') {
                    return '{"jpmcOAPISecret":"password","jpmcOAPIUser":"username","jpmcOMerchantIDs":[{"ID":"441759"},{"ID":"424781"},{"ID":"429133"},{"ID":"427233"}],"locales":{"en_GB":"429133","fr_FR":"427233","fr_CA":"424781","en_US":"441759"},"jpmcOMerchantsMapping":{"424781":{"ID":"424781","locales":["fr_CA"],"jpmcOGooglePayConfAllowedCardNetworks":["AMEX","DISCOVER","INTERAC","JCB","MASTERCARD","MIR","VISA"],"jpmcOEnabled":true,"jpmcOAVSEnabled":true,"jpmcOPageEncryptionEnabled":false,"jpmcOIncrementalAuthorizationEnabled":true,"jpmcEnabledUpdateProfile":true,"jpmcOPaymentModeCard":"A","jpmcOPaymentModeElectronicCheck":"A","jpmcOPaymentModeProfile":"A","jpmcOCustomerSavedPaymentType":"orbitalProfile","jpmcOPageEncryptionConfiguration":"testing","jpmcOPageEncryptionConfigurationSubID":"100000000005","jpmcOGooglePayEnabled":true,"jpmcOGooglePayConfMerchantId":"MERCHANTID","jpmcOGooglePayConfMerchantName":"MERCHANT","jpmcOGooglePayConfMerchantEnvironment":"TEST","jpmcOPlatformMode":"000001","jpmcOPaymentModeGooglePay":"A"},"427233":{"ID":"427233","locales":["fr_FR"],"jpmcOGooglePayConfAllowedCardNetworks":["AMEX","DISCOVER","INTERAC","JCB","MASTERCARD","MIR","VISA"],"jpmcOEnabled":true,"jpmcOAVSEnabled":true,"jpmcOPageEncryptionEnabled":false,"jpmcOIncrementalAuthorizationEnabled":true,"jpmcEnabledUpdateProfile":true,"jpmcOPaymentModeCard":"A","jpmcOPaymentModeProfile":"A","jpmcOPaymentModeElectronicCheck":"A","jpmcOCustomerSavedPaymentType":"orbitalProfile","jpmcOPageEncryptionConfiguration":"testing","jpmcOPageEncryptionConfigurationSubID":"100000000004","jpmcOGooglePayEnabled":true,"jpmcOGooglePayConfMerchantId":"MERCHANTID","jpmcOGooglePayConfMerchantName":"MERCHANT","jpmcOGooglePayConfMerchantEnvironment":"TEST","jpmcOPlatformMode":"000001","jpmcOPaymentModeGooglePay":"A"},"429133":{"ID":"429133","locales":["en_GB"],"jpmcOGooglePayConfAllowedCardNetworks":["AMEX","DISCOVER","INTERAC","JCB","MASTERCARD","MIR","VISA"],"jpmcOEnabled":true,"jpmcOAVSEnabled":true,"jpmcOPageEncryptionEnabled":false,"jpmcOIncrementalAuthorizationEnabled":true,"jpmcEnabledUpdateProfile":true,"jpmcOPaymentModeCard":"A","jpmcOPaymentModeProfile":"A","jpmcOPaymentModeElectronicCheck":"A","jpmcOCustomerSavedPaymentType":"orbitalProfile","jpmcOPageEncryptionConfiguration":"testing","jpmcOPageEncryptionConfigurationSubID":"100000000004","jpmcOGooglePayEnabled":true,"jpmcOGooglePayConfMerchantId":"MERCHANTID","jpmcOGooglePayConfMerchantName":"MERCHANT","jpmcOGooglePayConfMerchantEnvironment":"TEST","jpmcOPlatformMode":"000001","jpmcOPaymentModeGooglePay":"A"},"441759":{"ID":"441759","locales":["en_US"],"jpmcOGooglePayConfAllowedCardNetworks":["VISA","MASTERCARD","AMEX","DISCOVER","INTERAC","MIR","JCB"],"jpmcOEnabled":true,"jpmcOAVSEnabled":true,"jpmcOPageEncryptionEnabled":false,"jpmcOIncrementalAuthorizationEnabled":true,"jpmcEnabledUpdateProfile":false,"jpmcOPaymentModeCard":"A","jpmcOPaymentModeProfile":"A","jpmcOPaymentModeElectronicCheck":"AC","jpmcOCustomerSavedPaymentType":"orbitalProfile","jpmcOPageEncryptionConfiguration":"testing","jpmcOPageEncryptionConfigurationSubID":"100000000005","jpmcOGooglePayEnabled":true,"jpmcOGooglePayConfMerchantId":"MERCHANTID","jpmcOGooglePayConfMerchantName":"MERCHANT","jpmcOGooglePayConfMerchantEnvironment":"TEST","jpmcOPlatformMode":"000001","jpmcOPaymentModeGooglePay":"A"}}}';
                }
                return null;
            }
        };
    },
    current: {
        ID: 'SFRA_V_6'
    }
};
var request = {
    getLocale: function () {
        return 'en_US';
    }
};

global.empty = function (params) {
    if (params) {
        return false;
    }
    return true;
};

/**
 * Retrives orbital configuration object
 * @returns {Object} orbital configuration object
 */
function getPreferences() {
    var prefs = Site.getCurrent().getCustomPreferenceValue('jpmcOConfigStorage');
    var configStorage = JSON.parse(prefs);
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

    var orbitalUsername = configStorage.jpmcOAPIUser;
    var orbitalPassword = configStorage.jpmcOAPISecret;
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
    if (instanceType === 'live') {
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
    return {
        AFN: '971',
        ALL: '8',
        DZD: '12',
        AOA: '973',
        ARS: '32',
        AMD: '51',
        AWG: '533',
        AUD: '36',
        AZN: '944',
        BSD: '44',
        BDT: '50',
        BBD: '52',
        BYR: '933',
        BZD: '84',
        BMD: '60',
        BOB: '68',
        BAM: '977',
        BWP: '72',
        BRL: '986',
        GBP: '826',
        BND: '96',
        BGN: '975',
        BIF: '108',
        BTN: '64',
        XOF: '952',
        XAF: '950',
        XPF: '953',
        CAD: '124',
        KHR: '116',
        CVE: '132',
        KYD: '136',
        CLP: '152',
        CNY: '156',
        COP: '170',
        KMF: '174',
        CDF: '976',
        CRC: '188',
        HRK: '191',
        CZK: '203',
        DKK: '208',
        DJF: '262',
        DOP: '214',
        XCD: '951',
        EGP: '818',
        SVC: '222',
        ETB: '230',
        EUR: '978',
        FKP: '238',
        FJD: '242',
        GMD: '270',
        GEL: '981',
        GHS: '936',
        GIP: '292',
        GTQ: '320',
        GNF: '324',
        GWP: '624',
        GYD: '328',
        HTG: '332',
        HNL: '340',
        HKD: '344',
        HUF: '348',
        ISK: '352',
        INR: '356',
        IDR: '360',
        ILS: '376',
        JMD: '388',
        JPY: '392',
        KZT: '398',
        KES: '404',
        KGS: '417',
        LAK: '418',
        LVL: '422',
        LSL: '426',
        LRD: '430',
        MOP: '446',
        MGA: '969',
        MWK: '454',
        MYR: '458',
        MVR: '462',
        MRO: '478',
        MUR: '480',
        MXN: '484',
        MDL: '498',
        MNT: '496',
        MAD: '504',
        MZN: '943',
        MMK: '104',
        NAD: '516',
        NPR: '524',
        NLG: '532',
        PGK: '598',
        NZD: '554',
        NIO: '558',
        NGN: '566',
        NOK: '578',
        PKR: '586',
        PAB: '590',
        PYG: '600',
        PEN: '604',
        PHP: '608',
        PLN: '985',
        QAR: '634',
        RON: '946',
        RUB: '643',
        RWF: '646',
        SHP: '654',
        WST: '882',
        STD: '678',
        SAR: '682',
        RSD: '941',
        SCR: '690',
        SLL: '694',
        SGD: '702',
        SBD: '90',
        SOS: '706',
        ZAR: '710',
        KRW: '410',
        LKR: '144',
        SRD: '968',
        SZL: '748',
        SEK: '752',
        CHF: '756',
        TWD: '901',
        TJS: '972',
        TZS: '834',
        THB: '764',
        TOP: '776',
        TTD: '780',
        TL: '949',
        UGX: '800',
        UAH: '980',
        AED: '784',
        UYU: '858',
        USD: '840',
        UZM: '860',
        VUV: '548',
        VND: '704',
        YER: '886',
        ZMK: '967',
        ZWD: '716'
    };
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
    getAVSUnacceptedValues: getAVSUnacceptedValues,
    isUpdateProfileEnabled: isUpdateProfileEnabled,
    getGooglePayConfigurations: getGooglePayConfigurations,
    getPaymentModeCard: getPaymentModeCard,
    getPaymentModeElectronicCheck: getPaymentModeElectronicCheck,
    getPaymentModeGooglePay: getPaymentModeGooglePay,
    getPaymentModeProfile: getPaymentModeProfile,
    isGooglePayEnabled: isGooglePayEnabled,
    getCurrencyCodeMapping: getCurrencyCodeMapping,
    getVisaPayConfigurations: getVisaPayConfigurations,
    isVisaPayEnabled: isVisaPayEnabled,
    getPaymentModeVisaPay: getPaymentModeVisaPay
};
