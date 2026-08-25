'use strict';

var base = require('base/checkout/billing');
var cleave = require('../components/cleave');
var jpmcPie = require('../jpmc/jpmcPie');
var kount = require('../jpmc/kount');
var browserDataCollector = require('../jpmc/browserDataCollector');

/**
 * Encrypts card data using JPMC PIE and stores in hidden field
 * @returns {boolean} True if encryption succeeded
 */
function encryptCardData() {
    return jpmcPie.encryptAndStore('.cardNumber', '.securityCode', '.encryptedData');
}

// Capture originals BEFORE overriding (webpack caches the module — mutating base
// means require('base/checkout/billing') would return our overrides too, causing loops)
var originalClearCreditCardForm = base.methods.clearCreditCardForm;

// In DROP_IN mode the credit card form is never rendered, so Cleave is never
// initialized. Guard all functions that assume Cleave is attached to .cardNumber.
// Use the presence of #jpmc-dropin-config as the DROP_IN signal.

base.handleCreditCardNumber = function () {
    // Only run Cleave when the card number input is actually in the DOM.
    // In DROP_IN mode it is never rendered; in a PIE mode SPA flow it only
    // appears after the billing step loads via AJAX — so this single check
    // safely covers both cases without depending on #jpmc-dropin-config timing.
    if (document.querySelector('.cardNumber')) {
        cleave.handleCreditCardNumber('.cardNumber', '#cardType');
    }
};

base.methods.clearCreditCardForm = function () {
    if (document.querySelector('.cardNumber')) {
        originalClearCreditCardForm();
    }
};

// validateAndUpdateBillingPaymentInstrument calls cleave.setRawValue on .cardNumber.
// Re-implement it with a guard around the Cleave-specific line.
base.methods.validateAndUpdateBillingPaymentInstrument = function (order) {
    var billing = order.billing;
    if (!billing.payment || !billing.payment.selectedPaymentInstruments
        || billing.payment.selectedPaymentInstruments.length <= 0) return;

    var form = $('form[name=dwfrm_billing]');
    if (!form) return;

    var instrument = billing.payment.selectedPaymentInstruments[0];
    $('select[name$=expirationMonth]', form).val(instrument.expirationMonth);
    $('select[name$=expirationYear]', form).val(instrument.expirationYear);
    $('input[name$=securityCode]', form).val('');
    // Only clear card number if Cleave is initialized (not in DROP_IN mode)
    var $cardNumber = $('input[name$=cardNumber]');
    if ($cardNumber.length && $cardNumber.data('cleave')) {
        $cardNumber.data('cleave').setRawValue('');
    }
};

// Override santitizeForm to add encryption before serialization
/**
 * Shows a payment encryption error in the standard checkout error area
 * @param {string} msg - Error message text
 */
function showEncryptionError(msg) {
    $('.error-message').show();
    $('.error-message-text').text(msg);
}

// Override santitizeForm to add encryption + conditional 3DS browser info before serialization
var baseSanitizeForm = base.santitizeForm;
base.santitizeForm = function () {
    // Pre-flight PIE readiness check using a direct click binding.
    // Direct handlers on the target element fire before delegated handlers on ancestors
    // (checkout.js binds via delegation on #checkout-main), so stopImmediatePropagation
    // here prevents nextStage() from running when PIE is not yet initialised.
    $('.next-step-button button').on('click', function (e) {
        var stage = $('.data-checkout-stage').attr('data-checkout-stage');
        if (stage !== 'payment') { return; }

        // Only guard new credit-card entries — stored cards and Google Pay are unaffected
        if (!$('.tab-pane.active').find('.cardNumber').length) { return; }
        if ($('.payment-information').data('is-new-payment') === false) { return; }

        if (!jpmcPie.isPieReady()) {
            e.stopImmediatePropagation();
            showEncryptionError(
                'Something went wrong. Please try again later.'
            );
        }
    });

    $('body').on('checkout:serializeBilling', function (e, data) {
        if (data.form && data.form.filter('.cardNumber').length) {
            // Skip PIE encryption for stored/saved cards — the masked card number would
            // fail ValidatePANChecksum and the server uses the stored token instead.
            // 3DS browser data injection below must still run for both new and saved cards.
            var isNewPayment = $('.payment-information').data('is-new-payment');
            if (isNewPayment !== false) {
                // Belt-and-suspenders: if encryption fails here (e.g. ValidatePANChecksum
                // rejects the number after the pre-flight check passed) show an inline error.
                // The AJAX call will still fire but the server will also reject empty data.
                if (!encryptCardData()) {
                    showEncryptionError(
                        'Something went wrong. Please try again later.'
                    );
                }
            }
        }

        // Conditionally inject 3DS browser info if 3DS is enabled — applies to both
        // new card entries and saved cards.
        if (window.jpmc3DSEnabled && data.form) {
            // Use consolidated browser data collector
            browserDataCollector.injectBrowserDataToForm(data.form);
        }
    });

    if (baseSanitizeForm) {
        baseSanitizeForm();
    }
};

/**
 * Updates the payment information in checkout, based on the supplied order model
 * Extended to support Google Pay
 * @param {Object} order - checkout model to use as basis of new truth
 */
function updatePaymentInformation(order) {
    var $paymentSummary = $('.payment-details');
    var htmlToAppend = '';

    if (order.billing.payment && order.billing.payment.selectedPaymentInstruments
        && order.billing.payment.selectedPaymentInstruments.length > 0) {
        var instrument = order.billing.payment.selectedPaymentInstruments[0];

        if (instrument.paymentMethod === 'JPMC_GOOGLE_PAY') {
            // Google Pay display
            htmlToAppend += '<div class="google-pay-type"><span>Google Pay</span></div>';
        } else {
            // Credit card display (default)
            htmlToAppend += '<span>' + order.resources.cardType + ' '
                + instrument.type
                + '</span><div>'
                + instrument.maskedCreditCardNumber
                + '</div><div><span>'
                + order.resources.cardEnding + ' '
                + instrument.expirationMonth
                + '/' + instrument.expirationYear
                + '</span></div>';
        }
    }

    $paymentSummary.empty().append(htmlToAppend);
}

// Override the method in base
base.methods.updatePaymentInformation = updatePaymentInformation;

/**
 * Tracks whether a PIE readiness poll is already in progress to avoid
 * spawning duplicate setIntervals when guardPaymentButton is called more
 * than once before PIE has finished loading.
 * @type {boolean}
 */
var pieGuardActive = false;

/**
 * Disables the payment submit button until the PIE encryption libraries are
 * fully initialised (i.e. the async key-fetch XHR from getkey.js completes).
 * Re-enables the button once PIE is ready or shows an error if PIE never loads.
 * No-ops when:
 *  - PIE is already ready
 *  - A guard poll is already running
 *  - The active payment tab is not a new credit-card entry (Google Pay, stored card)
 */
function guardPaymentButton() {
    // Only guard when the credit-card form is in the active tab
    if (!$('.tab-pane.active').find('.cardNumber').length) { return; }
    // Stored/saved cards don't need PIE encryption
    if ($('.payment-information').data('is-new-payment') === false) { return; }
    if (jpmcPie.isPieReady()) { return; }
    if (pieGuardActive) { return; }

    pieGuardActive = true;
    var $btn = $('.submit-payment');
    $btn.prop('disabled', true);

    jpmcPie.waitForPieReady(function (ready) {
        pieGuardActive = false;
        if (ready) {
            $btn.prop('disabled', false);
        } else {
            // PIE key server did not respond in time; keep button disabled.
            // Only surface the error message when the user is actually on the
            // payment stage — if they are still filling shipping details the
            // error is irrelevant and confusing.
            var currentStage = $('.data-checkout-stage').attr('data-checkout-stage');
            if (currentStage === 'payment') {
                showEncryptionError(
                    'Something went wrong. Please try again later.'
                );
            }
        }
    });
}

/**
 * Initialize Kount fraud detection and PIE guard on checkout page load
 * Only if fraud check is enabled via site preference
 */
$(document).ready(function () {
    if (window.jpmcFraudCheckEnabled === true) {
        kount.init();
    }
    // Disable the submit button until PIE is ready (handles fast form-fill
    // before the async key-fetch XHR from getkey.js has completed)
    guardPaymentButton();
});

/**
 * Re-initialize Kount when returning to payment stage (editing payment)
 * This fires when user clicks edit button from order review/place order stage
 * Only if fraud check is enabled
 */
$('body').on('click', '.payment-summary .edit-button', function () {
    if (window.jpmcFraudCheckEnabled === true) {
        // Small delay to ensure DOM is updated before initializing
        setTimeout(function () {
            kount.refresh();
        }, 100);
    }
    // Re-apply the PIE guard in case PIE somehow became unready after returning
    // to the payment stage. Same 100ms delay ensures the stage DOM has updated.
    setTimeout(function () {
        guardPaymentButton();
    }, 100);
});

/**
 * Re-initialize Kount when checkout view updates (AJAX navigation)
 * This catches stage transitions that update the payment form
 * Only if fraud check is enabled
 */
$('body').on('checkout:updateCheckoutView', function (e, data) { // eslint-disable-line no-unused-vars
    if (window.jpmcFraudCheckEnabled === true) {
        var currentStage = $('.data-checkout-stage').attr('data-checkout-stage');
        if (currentStage === 'payment' && $('.payment-form').is(':visible')) {
            kount.refresh();
        }
    }
    // Reapply the guard on any checkout view update (e.g. navigating forward
    // to payment after filling shipping). No-ops if PIE is already ready.
    guardPaymentButton();
});

module.exports = base;
