'use strict';

var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var JPMCLogger = require('dw/system/Logger').getLogger('JPMCLogger', 'JPMCLogger');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 * Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
    var array = require('*/cartridge/scripts/util/array');

    var viewData = viewFormData;
    var creditCardErrors = {};

    if (!req.form.storedPaymentUUID) {
        creditCardErrors = COHelpers.validateCreditCard(paymentForm);
    }

    if (Object.keys(creditCardErrors).length) {
        JPMCLogger.error('jpmcOrbitalCardFormProcessor.js (processForm): Credit card errors: {0}.', creditCardErrors);
        return {
            fieldErrors: creditCardErrors,
            error: true
        };
    }

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    viewData.paymentInformation = {
        cardNumber: {
            value: paymentForm.jpmcOCreditForm.cardNumber.value,
            htmlName: paymentForm.jpmcOCreditForm.cardNumber.htmlName
        },
        cardType: {
            value: paymentForm.jpmcOCreditForm.cardType.value,
            htmlName: paymentForm.jpmcOCreditForm.cardType.htmlName
        },
        securityCode: {
            value: paymentForm.jpmcOCreditForm.securityCode.value,
            htmlName: paymentForm.jpmcOCreditForm.securityCode.htmlName
        },
        expirationMonth: {
            value: parseInt(paymentForm.jpmcOCreditForm.expirationMonth.selectedOption, 10),
            htmlName: paymentForm.jpmcOCreditForm.expirationMonth.htmlName
        },
        expirationYear: {
            value: parseInt(paymentForm.jpmcOCreditForm.expirationYear.value, 10),
            htmlName: paymentForm.jpmcOCreditForm.expirationYear.htmlName
        }
    };

    if (req.form.storedPaymentUUID) {
        viewData.storedPaymentUUID = req.form.storedPaymentUUID;
    }

    viewData.saveCard = paymentForm.creditCardFields.saveCard.checked;

    if (viewData.storedPaymentUUID
        && req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered
    ) {
        var paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
        var paymentInstrument = array.find(paymentInstruments, function (item) {
            return viewData.storedPaymentUUID === item.UUID;
        });

        viewData.paymentInformation.cardNumber.value = paymentInstrument.creditCardNumber;
        viewData.paymentInformation.cardType.value = paymentInstrument.creditCardType;
        viewData.paymentInformation.securityCode.value = req.form.securityCode;
        viewData.paymentInformation.expirationMonth.value = paymentInstrument.creditCardExpirationMonth;
        viewData.paymentInformation.expirationYear.value = paymentInstrument.creditCardExpirationYear;
    }

    if (preferenceHelper.isPageEncryptionEnabled() && paymentForm.encryptedData.value && preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken) {
        var encryptedData = JSON.parse(paymentForm.encryptedData.value);

        viewData.paymentInformation.cardNumber.value = encryptedData[0];
        viewData.paymentInformation.securityCode.value = encryptedData[1];
        viewData.paymentInformation.integrityCheck = {
            value: encryptedData[2],
            htmlName: JPMCOrbitalConstants.intgrityCheck
        };
        viewData.paymentInformation.keyID = {
            value: encryptedData[3],
            htmlName: JPMCOrbitalConstants.keyID
        };
    }
    return {
        error: false,
        viewData: viewData
    };
}


exports.processForm = processForm;
