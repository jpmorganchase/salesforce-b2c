'use strict';

/* global $, google */
var jpmcOGooglePay = $('a[href="#jpmco-google-pay-content"]').length ? require('./jpmcOGooglePay') : require('./jpmcOGooglePayMyAccount');

/**
 * Define the version of the Google Pay API referenced when creating your
 * configuration
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#PaymentDataRequest|apiVersion in PaymentDataRequest}
 */
const baseRequest = {
    apiVersion: 2,
    apiVersionMinor: 0
};

var googlePayConfigurations = $('.jpmcO-google-pay').data('google-pay-configurations');

/**
 * Card networks supported by your site and your gateway
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#CardParameters|CardParameters}
 * @todo confirm card networks supported by your site and gateway
*/

const allowedCardNetworks = googlePayConfigurations.allowedCardNetworks;

/**
 * Card authentication methods supported by your site and your gateway
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#CardParameters|CardParameters}
 * @todo confirm your processor supports Android device tokens for your
 * supported card networks
*/
const allowedCardAuthMethods = ['PAN_ONLY', 'CRYPTOGRAM_3DS'];

/**
 * Identify your gateway and your site's gateway merchant identifier
 *
 * The Google Pay API response will return an encrypted payment method capable
 * of being charged by a supported gateway after payer authorization
 *
 * @todo check with your gateway on the parameters to pass
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#gateway|PaymentMethodTokenizationSpecification}
*/

const tokenizationSpecification = {
    type: 'PAYMENT_GATEWAY',
    parameters: {
        gateway: 'chase',
        gatewayMerchantId: googlePayConfigurations.gatewayMerchantId
    }
};

/**
 * Describe your site's support for the CARD payment method and its required
 * fields
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#CardParameters|CardParameters}
*/
const baseCardPaymentMethod = {
    type: 'CARD',
    parameters: {
        allowedAuthMethods: allowedCardAuthMethods,
        allowedCardNetworks: allowedCardNetworks
    }
};

/**
 * Describe your site's support for the CARD payment method including optional
 * fields
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#CardParameters|CardParameters}
*/
const cardPaymentMethod = Object.assign(
    {},
    baseCardPaymentMethod,
    {
        tokenizationSpecification: tokenizationSpecification
    }
);

/**
 * An initialized google.payments.api.PaymentsClient object or null if not yet set
 *
 * @see {@link getGooglePaymentsClient}
*/
let paymentsClient = null;

/**
 * Configure your site's support for payment methods supported by the Google Pay
 * API.
 *
 * Each member of allowedPaymentMethods should contain only the required fields,
 * allowing reuse of this base request when determining a viewer's ability
 * to pay and later requesting a supported payment method
 *
 * @returns {Object} Google Pay API version, payment methods supported by the site
*/
function getGoogleIsReadyToPayRequest() {
    return Object.assign(
        {},
        baseRequest,
        {
            allowedPaymentMethods: [baseCardPaymentMethod]
        }
    );
}

/**
 * Configure support for the Google Pay API
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#PaymentDataRequest|PaymentDataRequest}
 * @returns {Object} PaymentDataRequest fields
*/
function getGooglePaymentDataRequest() {
    const paymentDataRequest = Object.assign({}, baseRequest);
    paymentDataRequest.allowedPaymentMethods = [cardPaymentMethod];
    paymentDataRequest.transactionInfo = jpmcOGooglePay.getGoogleTransactionInfo();
    paymentDataRequest.merchantInfo = googlePayConfigurations.merchantInfo;
    paymentDataRequest.callbackIntents = ['PAYMENT_AUTHORIZATION'];

    return paymentDataRequest;
}

/**
 * Process payment data returned by the Google Pay API
 *
 * @param {Object} paymentData response from Google Pay API after user approves payment
 * @see {@link https://developers.google.com/pay/api/web/reference/response-objects#PaymentData|PaymentData object reference}
 * @returns {null} return null
*/
function processPayment(paymentData) {
    return new Promise(function (resolve) {
        setTimeout(function () {
            var paymentToken = paymentData.paymentMethodData.tokenizationData.token;
            $('#googlePayToken').val(paymentToken);
            resolve({});
        }, 3000);
    });
}

/**
 * Handles authorize payments callback intents.
 *
 * @param {Object} paymentData response from Google Pay API after a payer approves payment through user gesture.
 * @see {@link https://developers.google.com/pay/api/web/reference/response-objects#PaymentData object reference}
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/response-objects#PaymentAuthorizationResult}
 * @returns {Object} Promise<{object}> Promise of PaymentAuthorizationResult object to acknowledge the payment authorization status.
*/
function onPaymentAuthorized(paymentData) {
    return new Promise(function (resolve, reject) {
        processPayment(paymentData)
        .then(function () {
            resolve({ transactionState: 'SUCCESS' });
        })
        .catch(function () {
            reject({
                transactionState: 'ERROR',
                error: {
                    intent: 'PAYMENT_AUTHORIZATION',
                    message: 'Insufficient funds',
                    reason: 'PAYMENT_DATA_INVALID'
                }
            });
        });
    });
}

/**
 * Return an active PaymentsClient or initialize
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/client#PaymentsClient|PaymentsClient constructor}
 * @returns {google.payments.api.PaymentsClient} Google Pay API client
*/
function getGooglePaymentsClient() {
    if (paymentsClient === null) {
        paymentsClient = new google.payments.api.PaymentsClient({
            environment: googlePayConfigurations.environment,
            paymentDataCallbacks: {
                onPaymentAuthorized: onPaymentAuthorized
            }
        });
    }
    return paymentsClient;
}

/**
 * Show Google Pay payment sheet when Google Pay payment button is clicked
*/
function onGooglePaymentButtonClicked() {
    const paymentDataRequest = getGooglePaymentDataRequest();
    paymentDataRequest.transactionInfo = jpmcOGooglePay.getGoogleTransactionInfo();
    paymentsClient = getGooglePaymentsClient();
    paymentsClient.loadPaymentData(paymentDataRequest);
}

/**
 * Add a Google Pay purchase button alongside an existing checkout button
 * @param {string} selector selector for button
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#ButtonOptions|Button options}
 * @see {@link https://developers.google.com/pay/api/web/guides/brand-guidelines|Google Pay brand guidelines}
 */
function addGooglePayButton(selector) {
    paymentsClient = getGooglePaymentsClient();
    const button =
        paymentsClient.createButton({
            onClick: onGooglePaymentButtonClicked,
            allowedPaymentMethods: [baseCardPaymentMethod]
        });

    $(selector).append(button);
}

/**
 * Initialize Google PaymentsClient after Google-hosted JavaScript has loaded
 *
 * Display a Google Pay payment button after confirmation of the viewer's
 * ability to pay.
*/
function onGooglePayLoaded() {
    paymentsClient = getGooglePaymentsClient();
    paymentsClient.isReadyToPay(getGoogleIsReadyToPayRequest())
        .then(function (response) {
            if (response.result) {
                var selector = $('a[href="#jpmco-google-pay-content"]').length ? 'a[href="#jpmco-google-pay-content"]' : '#google-pay-my-account';
                addGooglePayButton(selector);
            }
        })
        .catch(function () {
        });
}

module.exports.onGooglePayLoaded = onGooglePayLoaded;
