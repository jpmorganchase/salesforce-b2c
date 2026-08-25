'use strict';

var base = require('base/paymentInstruments/paymentInstruments');
var cleave = require('../components/cleave');
var formValidation = require('base/components/formValidation');
var jpmcPie = require('../jpmc/jpmcPie');

/**
 * Encrypts card data before form submission
 * @returns {boolean} True if encryption was successful
 */
function encryptCardData() {
    return jpmcPie.encryptAndStore('#cardNumber', '#securityCode', '#encryptedData');
}

/**
 * Shows a PIE encryption error inside the card form body
 * @param {string} msg - Error message text
 */
function showPieError(msg) {
    $('.card-body').find('.alert-danger.jpmc-pie-error').remove();
    var errorHtml = '<div class="alert alert-danger jpmc-pie-error" role="alert">' + msg + '</div>';
    $('.card-body').prepend(errorHtml);
}

/**
 * Disables the payment submit button until PIE encryption keys are ready.
 * Mirrors billing.js guardPaymentButton to protect My Account Add-Payment
 * from locale-switch race conditions where a new getkey.js is still fetching
 * its key material when the user tries to submit.
 */
function guardSubmitButton() {
    var $btn = $('form.payment-form button[type="submit"], form.payment-form .submit-payment');
    if (!$btn.length) { return; }
    if (jpmcPie.isPieReady()) { return; }

    $btn.prop('disabled', true);
    jpmcPie.waitForPieReady(function (ready) {
        if (ready) {
            $btn.prop('disabled', false);
        } else {
            showPieError('Something went wrong. Please try again later.');
        }
    });
}

/**
 * Overrides submitPayment to add PIE encryption before form submission
 */
base.submitPayment = function () {
    // Guard on initial page load
    $(document).ready(function () {
        guardSubmitButton();
    });

    $('form.payment-form').submit(function (e) {
        e.preventDefault();
        var $form = $(this);

        // Clear any previous error messages
        $('.card-body').find('.alert-danger').remove();

        // Encrypt card data before submission
        if (!encryptCardData()) {
            // Show error if encryption fails
            showPieError('Something went wrong. Please try again later.');
            return false;
        }

        $form.spinner().start();
        $('form.payment-form').trigger('payment:submit', e);

        var formData = cleave.serializeData($form);

        $.ajax({
            url: $form.attr('action'),
            type: 'post',
            dataType: 'json',
            data: formData,
            success: function (data) {
                $form.spinner().stop();
                if (!data.success) {
                    formValidation($form, data);
                } else {
                    window.location.href = data.redirectUrl;
                }
            },
            error: function (err) {
                $form.spinner().stop();
                if (err.responseJSON && err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                }
            }
        });
        return false;
    });
};

base.handleCreditCardNumber = function () {
    if ($('#cardNumber').length && $('#cardType').length) {
        cleave.handleCreditCardNumber('#cardNumber', '#cardType');
    }
};

module.exports = base;
