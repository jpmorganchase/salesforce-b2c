'use strict';

/**
 * Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
    var viewData = viewFormData;

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    viewData.paymentInformation = { googlepay: {
        value: paymentForm.jpmcOGooglePayForm.googlepay.value,
        htmlName: paymentForm.jpmcOGooglePayForm.googlepay.htmlName
    } };

    return {
        error: false,
        viewData: viewData
    };
}

exports.processForm = processForm;
