'use strict';

var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var JPMCLogger = require('dw/system/Logger').getLogger('JPMCLogger', 'JPMCLogger');

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
    var formFieldsErrors = {};

    if (!req.form.storedPaymentUUID) {
        formFieldsErrors = COHelpers.validateCreditCard(paymentForm);
    }

    if (Object.keys(formFieldsErrors).length) {
        JPMCLogger.error('jpmcOrbitalElectronicCheckProcessor.js (processForm): electronicCheck errors: {0}.', formFieldsErrors);
        return {
            fieldErrors: formFieldsErrors,
            error: true
        };
    }

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    viewData.paymentInformation = {
        ecpCheckRT: {
            value: paymentForm.jpmcOElectronicCheckForm.ecpCheckRT.value,
            htmlName: paymentForm.jpmcOElectronicCheckForm.ecpCheckRT.htmlName
        },
        ecpCheckDDA: {
            value: paymentForm.jpmcOElectronicCheckForm.ecpCheckDDA.value,
            htmlName: paymentForm.jpmcOElectronicCheckForm.ecpCheckDDA.htmlName
        },
        ecpBankAcctType: {
            value: paymentForm.jpmcOElectronicCheckForm.ecpBankAcctType.selectedOption,
            htmlName: paymentForm.jpmcOElectronicCheckForm.ecpBankAcctType.htmlName
        },
        saveCustomerPaymentCheckboxEC: {
            value: paymentForm.jpmcOElectronicCheckForm.saveCustomerPaymentCheckboxEC.checked,
            htmlName: paymentForm.jpmcOElectronicCheckForm.saveCustomerPaymentCheckboxEC.htmlName
        }

    };

    if (viewData.storedPaymentUUID
        && req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered
    ) {
        var paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
        var paymentInstrument = array.find(paymentInstruments, function (item) {
            return viewData.storedPaymentUUID === item.UUID;
        });

        viewData.paymentInformation.ecpCheckRT.value = paymentInstrument.ecpCheckRT;
        viewData.paymentInformation.ecpCheckDDA.value = paymentInstrument.ecpCheckDDA;
        viewData.paymentInformation.ecpBankAcctType.value = paymentInstrument.ecpBankAcctType;
    }

    return {
        error: false,
        viewData: viewData
    };
}


exports.processForm = processForm;
