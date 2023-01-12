/* eslint-disable no-param-reassign */
var ISML = require('dw/template/ISML');
var server = require('server');
var params = request.httpParameterMap;
var Transaction = require('dw/system/Transaction');
var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var OrbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
var Resource = require('dw/web/Resource');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');
var csrfProtection = require('dw/web/CSRFProtection');

/**
 * This function renders a object as a json response
 * @param {Object} object object
 */
function renderJSON(object) {
    ISML.renderTemplate('jpmcOrbital/util/json', {
        jsonObject: object
    });
}
/**
 * Depends on action parameter passed, render JPMC Profile modal
 */
module.exports.HandleProfileUpdateModal = function () {
    var paymentMethodID = params.paymentMethodID.stringValue;
    var customerNo = params.customerNo.stringValue;
    var customerToken = params.customerToken.stringValue;

    var JPMCOProfileServices = require('*/cartridge/scripts/services/jpmcOServices.js');
    var profileServices = new JPMCOProfileServices();
    var profileRetrieveResponse = profileServices.retrieveProfileDetails(customerToken);
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var customer = CustomerMgr.getCustomerByCustomerNumber(customerNo);
    var wallet = customer.getProfile().getWallet();
    var paymentInstruments = wallet.getPaymentInstruments(paymentMethodID);
    var googlePayConfigurations = preferenceHelper.getGooglePayConfigurations();
    var visaPayConfigurations = preferenceHelper.getVisaPayConfigurations();
    var paymentInstrument;
    for (var i = 0; i < paymentInstruments.length; i++) {
        if (paymentInstruments[i].creditCardToken.indexOf(customerToken) > -1) {
            paymentInstrument = paymentInstruments[i];
        }
    }
    var UUID = params.UUID;
    var jpmcOCreditForm = server.forms.getForm('billing').jpmcOCreditForm;
    var jpmcOGooglePayForm = server.forms.getForm('billing').jpmcOGooglePayForm;
    var jpmcOVisaPayForm = server.forms.getForm('billing').jpmcOVisaPayForm;
    var jpmcOApplePayForm = server.forms.getForm('billing').jpmcOApplePayForm;

    if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
        jpmcOCreditForm.expirationMonth.options[paymentInstrument.creditCardExpirationMonth].selected = true;
        jpmcOCreditForm.expirationYear.htmlValue = paymentInstrument.creditCardExpirationYear.toString();
        jpmcOCreditForm.securityCode.value = '';
    }

    var jpmcOElectronicCheckForm = server.forms.getForm('billing').jpmcOElectronicCheckForm;
    if (jpmcOElectronicCheckForm.ecpCheckDDA && paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
        jpmcOElectronicCheckForm.ecpCheckDDA.htmlValue = profileRetrieveResponse.responseBody.paymentInstrument.ecp.ecpCheckDDA.replace(/\d(?=\d{4})/g, '*');
        jpmcOElectronicCheckForm.ecpCheckRT.htmlValue = profileRetrieveResponse.responseBody.paymentInstrument.ecp.ecpCheckRT.replace(/\d/g, '*');
        jpmcOElectronicCheckForm.ecpBankAcctType.htmlValue = profileRetrieveResponse.responseBody.paymentInstrument.ecp.ecpBankAcctType;
        jpmcOElectronicCheckForm.ecpBankAcctType.selectedOption = profileRetrieveResponse.responseBody.paymentInstrument.ecp.ecpBankAcctType;
    }
    var currentYear = new Date().getFullYear();
    var creditCardExpirationYears = [];

    for (var j = 0; j < 10; j++) {
        creditCardExpirationYears.push((currentYear + j));
    }
    var hideSecurityCode = true;
    var hideSecurityCodeGoogle = true;
    var hideSecurityCodeVisa = true;
    var hideSecurityCodeApple = true;

    if (preferenceHelper.isPageEncryptionEnabled() && preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken) {
        hideSecurityCode = false;
    }
    var csrf = {
        tokenName: csrfProtection.getTokenName(),
        token: csrfProtection.generateToken()
    };
    ISML.renderTemplate('jpmcOrbital/jpmcOProfileUpdateForm', {
        jpmcOCreditForm: jpmcOCreditForm,
        jpmcOElectronicCheckForm: jpmcOElectronicCheckForm,
        jpmcOGooglePayForm: jpmcOGooglePayForm,
        jpmcOVisaPayForm: jpmcOVisaPayForm,
        jpmcOApplePayForm: jpmcOApplePayForm,
        paymentMethodID: paymentMethodID,
        expirationYears: creditCardExpirationYears,
        customerNo: customerNo,
        customerToken: customerToken,
        UUID: UUID,
        paymentInstrument: paymentInstrument,
        showGooglePayForm: preferenceHelper.isGooglePayEnabled(),
        showVisaPayForm: preferenceHelper.isVisaPayEnabled(),
        showApplePayForm: preferenceHelper.isApplePayEnabled(),
        googlePayConfigurations: googlePayConfigurations,
        visaPayConfigurations: visaPayConfigurations,
        hideSecurityCode: hideSecurityCode,
        hideSecurityCodeGoogle: hideSecurityCodeGoogle,
        hideSecurityCodeApple: hideSecurityCodeApple,
        JPMC_ORBITAL_CC_METHOD: JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD,
        JPMC_ORBITAL_GOOGLEPAY_METHOD: JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD,
        JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD: JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD,
        JPMC_ORBITAL_VISA_CHECKOUT_METHOD: JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD,
        JPMC_ORBITAL_APPLEPAY_METHOD: JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD,
        hideSecurityCodeVisa: hideSecurityCodeVisa,
        csrf: csrf
    });
};
module.exports.HandleProfileUpdateModal.public = true;


module.exports.UpdateProfile = function () {
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var customer = CustomerMgr.getCustomerByCustomerNumber(
        params.customerNo
    );
    var customerToken = params.customerToken.stringValue;
    var profileChangeModel = require('*/cartridge/models/jpmcModels/jpmcProfileChangeModel');
    var paymentMethodID = params.paymentMethodID.stringValue;
    var ccAccountNum = params.cardNumber.value;
    var googlePayToken = params.googlePayToken.stringValue;
    var visaPay = params.visaPay.stringValue;
    var applePayToken = params.applePayToken.stringValue;
    var cardType = params.type.value;
    var currencyCode = session.currency.currencyCode;
    var profileUpdateObject;
    var formDataGooglePay;
    var formDataVisaPay;
    var formDataApplePay;
    var validateRequest = csrfProtection.validateRequest();
    if (!validateRequest) {
        CustomerMgr.logoutCustomer(false);
    }
    if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
        var currentMonth = (new Date().getMonth() + 1);
        var currentYear = new Date().getFullYear();
        if ((params.month.value <= currentMonth) && (params.year.value <= currentYear)) {
            renderJSON({
                success: false,
                errorMessage: Resource.msg('error.expired.credit.card', 'creditCard', null)
            });
            return;
        }
        if (cardType === JPMCOrbitalConstants.Discover && (currencyCode === JPMCOrbitalConstants.GBP || currencyCode === JPMCOrbitalConstants.EUR)) {
            renderJSON({
                success: false,
                errorMessage: Resource.msgf('card.error.message', 'payment', null, cardType)
            });
            return;
        }
        var ccNum = params.year.value.toString() + ((JPMCOrbitalConstants.n_0 + params.month.value).slice(-2).toString());
        profileUpdateObject = profileChangeModel.getProfileChangeObject(ccAccountNum, ccNum, customer.profile, customerToken, JPMCOrbitalConstants.CC);
    } else if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
        var ecp = {
            ecpCheckRT: params.transitNr.stringValue,
            ecpCheckDDA: params.accNrDDA.stringValue,
            ecpBankAcctType: params.depAccType.stringValue
        };
        profileUpdateObject = profileChangeModel.getProfileChangeObject('', '', customer.profile, customerToken, JPMCOrbitalConstants.EC, ecp);
    } else if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
        var debundlePaymentObjectVisaPay = OrbitalAPIHelper.prepareDebundlePaymentObjectForVisaPay(visaPay);
        var debundlePaymentInfoVisaPay = OrbitalAPIHelper.debundlePaymentInfoForVisaPay(debundlePaymentObjectVisaPay);
        formDataVisaPay = {
            expirationMonth: { value: debundlePaymentInfoVisaPay.TokenData.expirationMonth },
            expirationYear: { value: debundlePaymentInfoVisaPay.TokenData.expirationYear },
            cardNumber: { value: debundlePaymentInfoVisaPay.TokenData.accountNumber },
            cardType: { value: JPMCOrbitalConstants.VISA_CHECKOUT }
        };
        var visaNum = formDataVisaPay.expirationYear.value.toString() + ((JPMCOrbitalConstants.n_0 + formDataVisaPay.expirationMonth.value).slice(-2).toString());
        profileUpdateObject = profileChangeModel.getProfileChangeObject(formDataVisaPay.cardNumber.value, visaNum, customer.profile, customerToken, JPMCOrbitalConstants.VISA_CHECKOUT);
    } else if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
        var debundlePaymentObjectGoogle = OrbitalAPIHelper.prepareDebundlePaymentObjectForGooglePay(googlePayToken);
        var debundlePaymentInfoGoogle = OrbitalAPIHelper.debundlePaymentInfoForGooglePay(debundlePaymentObjectGoogle);
        formDataGooglePay = {
            expirationMonth: { value: debundlePaymentInfoGoogle.TokenData.expirationMonth },
            expirationYear: { value: debundlePaymentInfoGoogle.TokenData.expirationYear },
            cardNumber: { value: debundlePaymentInfoGoogle.TokenData.pan },
            cardType: { value: JPMCOrbitalConstants.GOOGLE }
        };
        var googleNum = formDataGooglePay.expirationYear.value.toString() + ((JPMCOrbitalConstants.n_0 + formDataGooglePay.expirationMonth.value).slice(-2).toString());
        profileUpdateObject = profileChangeModel.getProfileChangeObject(formDataGooglePay.cardNumber.value, googleNum, customer.profile, customerToken, JPMCOrbitalConstants.GOOGLE);
    } else if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
        var debundlePaymentObjectApple = OrbitalAPIHelper.prepareDebundlePaymentObjectForApplePay(applePayToken);
        var debundlePaymentInfoApple = OrbitalAPIHelper.debundlePaymentInfoForApplePay(debundlePaymentObjectApple);
        formDataApplePay = {
            expirationMonth: { value: debundlePaymentInfoApple.TokenData.applicationExpirationDate.slice(2, 4) },
            expirationYear: { value: JPMCOrbitalConstants.n_20 + debundlePaymentInfoApple.TokenData.applicationExpirationDate.slice(0, 2) },
            cardNumber: { value: debundlePaymentInfoApple.TokenData.applicationPrimaryAccountNumber },
            cardType: { value: JPMCOrbitalConstants.APPLE }
        };
        var appleNum = JPMCOrbitalConstants.n_20 + debundlePaymentInfoApple.TokenData.applicationExpirationDate.slice(0, 4);
        profileUpdateObject = profileChangeModel.getProfileChangeObject(formDataApplePay.cardNumber.value, appleNum, customer.profile, customerToken, JPMCOrbitalConstants.APPLE);
    }

    var JPMCOProfileServices = require('*/cartridge/scripts/services/jpmcOServices.js');
    var profileServices = new JPMCOProfileServices();
    var profileUpdateResponse = profileServices.updateProfile(profileUpdateObject);
    if (profileUpdateResponse.status === JPMCOrbitalConstants.OK && validateRequest) {
        var UUID = params.UUID.value;
        var paymentInstruments = customer.profile.wallet.getPaymentInstruments();
        Transaction.wrap(function () {
            var paymentRemoved = false;
            var paymentInstrumentsKeys = Object.keys(paymentInstruments);
            paymentInstrumentsKeys.forEach(function (index) {
                var paymentInstrument = paymentInstruments[index];
                if (paymentInstrument.UUID === UUID) {
                    customer.profile.wallet.removePaymentInstrument(paymentInstrument);
                    paymentRemoved = true;
                }
            });
            if (paymentRemoved) {
                var newPaymentInstrument = customer.profile.wallet.createPaymentInstrument(paymentMethodID);
                var name = customer.profile.firstName + ' ' + customer.profile.lastName;
                newPaymentInstrument.setCreditCardHolder(name);
                if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
                    newPaymentInstrument.setCreditCardExpirationYear(parseInt(params.year.value, 10));
                    newPaymentInstrument.setCreditCardExpirationMonth(parseInt(params.month.value, 10));
                    newPaymentInstrument.setCreditCardType(params.type);
                    newPaymentInstrument.setCreditCardNumber(ccAccountNum);
                } else if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
                    newPaymentInstrument.setCreditCardType(JPMCOrbitalConstants.EC);
                    newPaymentInstrument.setBankAccountNumber(params.accNrDDA.stringValue);
                    newPaymentInstrument.setBankRoutingNumber(params.transitNr.stringValue);
                    newPaymentInstrument.setBankAccountHolder(params.depAccType.stringValue);
                    newPaymentInstrument.custom.jpmco_ecp_ecpCheckDDA = params.accNrDDA.stringValue;
                } else if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
                    newPaymentInstrument.setCreditCardExpirationYear(parseInt(formDataVisaPay.expirationYear.value, 10));
                    newPaymentInstrument.setCreditCardExpirationMonth(parseInt(formDataVisaPay.expirationMonth.value, 10));
                    newPaymentInstrument.setCreditCardNumber(formDataVisaPay.cardNumber.value);
                    newPaymentInstrument.setCreditCardType(JPMCOrbitalConstants.VISA_CHECKOUT);
                } else if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
                    newPaymentInstrument.setCreditCardExpirationYear(parseInt(formDataGooglePay.expirationYear.value, 10));
                    newPaymentInstrument.setCreditCardExpirationMonth(parseInt(formDataGooglePay.expirationMonth.value, 10));
                    newPaymentInstrument.setCreditCardNumber(formDataGooglePay.cardNumber.value);
                    newPaymentInstrument.setCreditCardType(JPMCOrbitalConstants.GOOGLE);
                } else if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
                    newPaymentInstrument.setCreditCardExpirationYear(parseInt(formDataApplePay.expirationYear.value, 10));
                    newPaymentInstrument.setCreditCardExpirationMonth(parseInt(formDataApplePay.expirationMonth.value, 10));
                    newPaymentInstrument.setCreditCardNumber(formDataApplePay.cardNumber.value);
                    newPaymentInstrument.setCreditCardType(JPMCOrbitalConstants.APPLE);
                }
                newPaymentInstrument.setCreditCardToken(profileUpdateResponse.responseBody.profile.customerRefNum);
                if (paymentMethodID === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD || preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.orbitalProfile) {
                    newPaymentInstrument.custom.jpmcOIsProfile = true;
                    newPaymentInstrument.custom.jpmcOIsSafetech = false;
                    newPaymentInstrument.custom.jpmcOAccountID = preferenceHelper.getMerchantId();
                } else {
                    newPaymentInstrument.custom.jpmcOIsSafetech = true;
                    newPaymentInstrument.custom.jpmcOIsProfile = false;
                    newPaymentInstrument.custom.jpmcOAccountID = preferenceHelper.getPageEncryptionConfigurations().pieSubscriberID;
                }
                renderJSON({
                    success: true
                });
            } else {
                renderJSON({
                    success: true
                });
            }
        });
    } else if (!validateRequest) {
        renderJSON({
            success: false
        });
    } else {
        renderJSON({
            errorMessage: JSON.parse(profileUpdateResponse.errorMessage).procStatusMessage,
            success: false
        });
    }
};
module.exports.UpdateProfile.public = true;
