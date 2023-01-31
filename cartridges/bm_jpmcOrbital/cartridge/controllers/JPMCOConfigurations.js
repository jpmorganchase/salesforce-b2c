/* eslint-disable consistent-return */
'use strict';

var ISML = require('dw/template/ISML');
var URLUtils = require('dw/web/URLUtils');
var Site = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');
var csrfProtection = require('dw/web/CSRFProtection');

 /**
  * configutaion tools
  */

exports.Config = function () {
    var currentSite = Site.current;
    var form = session.forms.config;
    var prefs = currentSite.getCustomPreferenceValue('jpmcOConfigStorage');
    var jpmcOUserName = currentSite.getCustomPreferenceValue('jpmcOUserName');
    var jpmcOPassword = currentSite.getCustomPreferenceValue('jpmcOPassword');
    var configStorage = JSON.parse(prefs);
    if (!empty(form.submittedAction) && form.valid) {
        var validateRequest = csrfProtection.validateRequest();
        if (!validateRequest) {
            ISML.renderTemplate('csrfFail');
            return null;
        }
        var newConfigStorage = {};
        jpmcOPassword = form.password.htmlValue;
        jpmcOUserName = form.username.htmlValue;
        var listArray = [];
        var mList = [];
        var formMerchantIDs = request.httpParameterMap['merchantIDs[]'];
        for (var i = 0; i < formMerchantIDs.values.length; i++) {
            listArray.push(formMerchantIDs.values[i]);
            mList.push({ ID: formMerchantIDs.values[i] });
        }
        newConfigStorage.jpmcOMerchantIDs = mList;
        var merchantInfo = {};

        if (configStorage && configStorage.jpmcOMerchantsMapping) {
            var mKeys = Object.keys(configStorage.jpmcOMerchantsMapping);
            mKeys.forEach(function (index) {
                var merchantID = configStorage.jpmcOMerchantsMapping[index].ID;
                if (listArray.indexOf(merchantID) > -1) {
                    merchantInfo[merchantID] = configStorage.jpmcOMerchantsMapping[index];
                }
            });
        }
        var newLocales = {};
        if (configStorage && configStorage.locales) {
            var lKeys = Object.keys(configStorage.locales);
            lKeys.forEach(function (index) {
                var locale = configStorage.locales[index];
                if (listArray.indexOf(locale) > -1) {
                    newLocales[index] = locale;
                }
            });
            newConfigStorage.locales = newLocales;
        }
        newConfigStorage.jpmcOMerchantsMapping = merchantInfo;
        Transaction.wrap(function () {
            currentSite.setCustomPreferenceValue('jpmcOConfigStorage', JSON.stringify(newConfigStorage));
            currentSite.setCustomPreferenceValue('jpmcOUserName', jpmcOUserName);
            currentSite.setCustomPreferenceValue('jpmcOPassword', jpmcOPassword);
        });
        response.redirect(URLUtils.url('JPMCOConfigurations-Config'));
    } else if (empty(form.submittedAction)) {
        form.clearFormElement();
        var merchantIDs = [];
        if (configStorage) {
            if (jpmcOPassword) {
                form.password.value = jpmcOPassword;
            }
            if (jpmcOUserName) {
                form.username.value = jpmcOUserName;
            }
            if (configStorage.jpmcOMerchantIDs) {
                var merchantKeys = Object.keys(configStorage.jpmcOMerchantIDs);
                merchantKeys.forEach(function (index) {
                    var merchantID = configStorage.jpmcOMerchantIDs[index].ID;
                    merchantIDs.push(merchantID);
                });
            }
        }
        ISML.renderTemplate('jpmcO/config', {
            navigation: 'config',
            merchantIDs: merchantIDs
        });
    }
};
exports.Config.public = true;


exports.ConfigMerchant = function () {
    var params = request.httpParameterMap;
    var merchantID = params.merchantID.stringValue;
    var currentSite = Site.current;
    var form = session.forms.config;
    var prefs = currentSite.getCustomPreferenceValue('jpmcOConfigStorage');
    var configStorage = JSON.parse(prefs);
    var allLocales = configStorage.locales;
    if (empty(allLocales)) {
        allLocales = {};
    }
    if (!empty(form.submittedAction)) {
        var merchantConfiguration = {};
        merchantConfiguration.ID = merchantID;
        var newLocales = {};
        var validateRequest = csrfProtection.validateRequest();
        if (!validateRequest) {
            ISML.renderTemplate('csrfFail');
            return null;
        }
        Object.keys(allLocales).forEach(function (localeId) {
            if (allLocales[localeId] !== merchantID) {
                newLocales[localeId] = allLocales[localeId];
            }
        });
        if (!params['locales[]'].empty) {
            var merchantLocales = params['locales[]'].values.toArray();
            merchantConfiguration.locales = [];
            merchantLocales.forEach(function (localeId) {
                if (empty(newLocales[localeId])) {
                    merchantConfiguration.locales.push(localeId);
                    newLocales[localeId] = merchantID;
                }
            });
        }
        configStorage.locales = newLocales;
        if (!params['avsUnacceptedValues[]'].empty) {
            merchantConfiguration.jpmcOAVSUnacceptedValues = params['avsUnacceptedValues[]'].values.toArray();
        }
        if (!params['googlePayConfAllowedCardNetworks[]'].empty) {
            merchantConfiguration.jpmcOGooglePayConfAllowedCardNetworks = params['googlePayConfAllowedCardNetworks[]'].values.toArray();
        }
        merchantConfiguration.jpmcOEnabled = form.enabled.value;
        merchantConfiguration.jpmcOAVSEnabled = form.avsEnabled.value;
        merchantConfiguration.jpmcOPageEncryptionEnabled = form.pageEncryptionEnabled.value;
        merchantConfiguration.jpmcOIncrementalAuthorizationEnabled = form.incrementalAuthorizationEnabled.value;
        merchantConfiguration.jpmcEnabledUpdateProfile = form.updateProfileEnabled.value;
        merchantConfiguration.jpmcOPaymentModeCard = form.paymentModeCard.value;
        merchantConfiguration.jpmcOPaymentModeProfile = form.paymentModeProfile.value;
        merchantConfiguration.jpmcOPaymentModeElectronicCheck = form.paymentModeElectronicCheck.value;
        merchantConfiguration.jpmcOCustomerSavedPaymentType = form.customerSavedPaymentType.value;
        merchantConfiguration.jpmcOPageEncryptionConfiguration = form.pageEncryptionConfiguration.value;
        merchantConfiguration.jpmcOPageEncryptionConfigurationSubID = form.pageEncryptionConfigurationSubID.value;
        merchantConfiguration.jpmcOGooglePayEnabled = form.googlePayEnabled.value;
        merchantConfiguration.jpmcOVisaPayEnabled = form.visaPayEnabled.value;
        merchantConfiguration.jpmcOApplePayEnabled = form.applePayEnabled.value;
        merchantConfiguration.jpmcOGooglePayConfMerchantId = form.googlePayConfMerchantId.value;
        merchantConfiguration.jpmcOGooglePayConfMerchantName = form.googlePayConfMerchantName.value;
        merchantConfiguration.jpmcOGooglePayConfMerchantEnvironment = form.googlePayConfMerchantEnvironment.value;
        merchantConfiguration.jpmcOPlatformMode = form.platformMode.value;
        merchantConfiguration.jpmcOPaymentModeGooglePay = form.paymentModeGooglePay.value;
        merchantConfiguration.jpmcOPaymentModeVisaPay = form.paymentModeVisaPay.value;
        merchantConfiguration.jpmcOPaymentModeApplePay = form.paymentModeApplePay.value;
        merchantConfiguration.jpmcOVisaPayApiKey = form.visaPayApiKey.value;
        configStorage.jpmcOMerchantsMapping[merchantID] = merchantConfiguration;
        Transaction.wrap(function () {
            currentSite.setCustomPreferenceValue('jpmcOConfigStorage', JSON.stringify(configStorage));
        });

        response.redirect(URLUtils.url('JPMCOConfigurations-ConfigMerchant', 'merchantID', merchantID));
    } else if (empty(form.submittedAction)) {
        form.clearFormElement();
        var merchantIDs = [];
        var locales = [];
        var avsUnacceptedValues = [];
        var googlePayConfAllowedCardNetworks = [];
        var allMLocales = {};
        if (configStorage) {
            if (configStorage.locales) {
                allMLocales = configStorage.locales;
            }
            if (configStorage.jpmcOMerchantIDs) {
                var merchantKeys = Object.keys(configStorage.jpmcOMerchantIDs);
                merchantKeys.forEach(function (index) {
                    var mID = configStorage.jpmcOMerchantIDs[index].ID;
                    merchantIDs.push(mID);
                });
            }
            if (configStorage && configStorage.jpmcOMerchantsMapping) {
                var mKeys = Object.keys(configStorage.jpmcOMerchantsMapping);

                mKeys.forEach(function (index) {
                    var merchant = configStorage.jpmcOMerchantsMapping[index];
                    if (merchant) {
                        var merchantMID = merchant.ID;
                        if (merchantMID === merchantID) {
                            if (!empty(merchant.locales)) {
                                locales = merchant.locales;
                            }
                            if (!empty(merchant.jpmcOAVSUnacceptedValues)) {
                                avsUnacceptedValues = merchant.jpmcOAVSUnacceptedValues;
                            }
                            if (!empty(merchant.jpmcOGooglePayConfAllowedCardNetworks)) {
                                googlePayConfAllowedCardNetworks = merchant.jpmcOGooglePayConfAllowedCardNetworks;
                            }
                            form.enabled.value = merchant.jpmcOEnabled;
                            form.avsEnabled.value = merchant.jpmcOAVSEnabled;
                            form.pageEncryptionEnabled.value = merchant.jpmcOPageEncryptionEnabled;
                            form.incrementalAuthorizationEnabled.value = merchant.jpmcOIncrementalAuthorizationEnabled;
                            form.updateProfileEnabled.value = merchant.jpmcEnabledUpdateProfile;
                            form.paymentModeCard.value = merchant.jpmcOPaymentModeCard;
                            form.paymentModeProfile.value = merchant.jpmcOPaymentModeProfile;
                            form.paymentModeElectronicCheck.value = merchant.jpmcOPaymentModeElectronicCheck;
                            form.customerSavedPaymentType.value = merchant.jpmcOCustomerSavedPaymentType;
                            form.pageEncryptionConfiguration.value = merchant.jpmcOPageEncryptionConfiguration;
                            form.pageEncryptionConfigurationSubID.value = merchant.jpmcOPageEncryptionConfigurationSubID;
                            form.googlePayEnabled.value = merchant.jpmcOGooglePayEnabled;
                            form.googlePayConfMerchantId.value = merchant.jpmcOGooglePayConfMerchantId;
                            form.googlePayConfMerchantName.value = merchant.jpmcOGooglePayConfMerchantName;
                            form.googlePayConfMerchantEnvironment.value = merchant.jpmcOGooglePayConfMerchantEnvironment;
                            form.platformMode.value = merchant.jpmcOPlatformMode;
                            form.paymentModeGooglePay.value = merchant.jpmcOPaymentModeGooglePay;
                            form.paymentModeVisaPay.value = merchant.jpmcOPaymentModeVisaPay;
                            form.paymentModeApplePay.value = merchant.jpmcOPaymentModeApplePay;
                            form.visaPayApiKey.value = merchant.jpmcOVisaPayApiKey;
                            form.visaPayEnabled.value = merchant.jpmcOVisaPayEnabled;
                            form.applePayEnabled.value = merchant.jpmcOApplePayEnabled;
                        }
                    }
                });
            }
        }
        ISML.renderTemplate('jpmcO/configMerchant', {
            navigation: merchantID,
            merchantIDs: merchantIDs,
            locales: locales,
            avsUnacceptedValues: avsUnacceptedValues,
            googlePayConfAllowedCardNetworks: googlePayConfAllowedCardNetworks,
            allMLocales: allMLocales
        });
    }
};
exports.ConfigMerchant.public = true;
