'use strict';

/**
 * @module jpmc/googlePay
 * @description Google Pay integration for JPMC — supports checkout, cart, and PDP contexts.
 */

var GPAY_SCRIPT_URL = 'https://pay.google.com/gp/p/js/pay.js';

var GPAY_API_VERSION = { apiVersion: 2, apiVersionMinor: 0 };

var gpayConfig = null;

var paymentsClient = null;

var gpayContext = 'checkout';

var isLoadingPaymentData = false;

/** @type {jQuery} */
var $gpayWrapper = null;

/**
 * getCsrfToken
 * @returns {string} csrf token
 */
function getCsrfToken() {
    return $('input[name*="csrf_token"]').val() || '';
}

/**
 * validateUrl
 * @param {string} url - url to validate
 * @returns {boolean} result
 */
function validateUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    if (url.startsWith('/')) {
        return true;
    }
    try {
        var parsed = new URL(url);
        return parsed.protocol === 'https:' && parsed.hostname === window.location.hostname;
    } catch (e) {
        return false;
    }
}

/**
 * baseCardPaymentMethod
  * @returns {Object} result
 */
function baseCardPaymentMethod() {
    return {
        type: 'CARD',
        parameters: {
            allowedAuthMethods: gpayConfig.allowedAuthMethods,
            allowedCardNetworks: gpayConfig.allowedCardNetworks,
            billingAddressRequired: true,
            billingAddressParameters: {
                format: 'FULL',
                phoneNumberRequired: true
            }
        }
    };
}

/**
 * tokenizedCardPaymentMethod
  * @returns {Object} result
 */
function tokenizedCardPaymentMethod() {
    return Object.assign({}, baseCardPaymentMethod(), {
        tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: {
                gateway: gpayConfig.gateway,
                gatewayMerchantId: gpayConfig.gatewayMerchantId
            }
        }
    });
}

/**
 * getCallbackIntents
  * @returns {Object} result
 */
function getCallbackIntents() {
    if (gpayContext === 'cart' || gpayContext === 'pdp') {
        return ['SHIPPING_ADDRESS', 'SHIPPING_OPTION', 'PAYMENT_AUTHORIZATION'];
    }
    return ['PAYMENT_AUTHORIZATION'];
}

/**
 * buildPaymentDataRequest
 * @returns {Object} payment data request
 */
function buildPaymentDataRequest() {
    var callbackIntents = getCallbackIntents();
    var transactionInfo = {
        totalPriceStatus: (gpayContext === 'cart' || gpayContext === 'pdp') ? 'ESTIMATED' : 'FINAL',
        totalPrice: gpayConfig.totalPrice,
        currencyCode: gpayConfig.currencyCode,
        countryCode: gpayConfig.countryCode,
        totalPriceLabel : (gpayContext === 'cart' || gpayContext === 'pdp') ? 'Est. Total' : 'Total'
    };
    if (gpayConfig.subtotal && gpayConfig.totalTax) {
        transactionInfo.displayItems = [
            { label: 'Subtotal', type: 'SUBTOTAL', price: gpayConfig.subtotal.toString() },
            { label: 'Shipping', type: 'SHIPPING_OPTION', price: gpayConfig.shippingCost.toString()},
            { label: 'Tax', type: 'TAX', price: gpayConfig.totalTax.toString() }
        ];
    }

    var request = Object.assign({}, GPAY_API_VERSION, {
        allowedPaymentMethods: [tokenizedCardPaymentMethod()],
        transactionInfo: transactionInfo,
        merchantInfo: {
            merchantName: gpayConfig.merchantName
        },
        callbackIntents: callbackIntents
    });

    if (gpayConfig.environment === 'PRODUCTION' && gpayConfig.googlePayMerchantId) {
        request.merchantInfo.merchantId = gpayConfig.googlePayMerchantId;
    }

    if (gpayContext === 'cart' || gpayContext === 'pdp') {
        request.shippingAddressRequired = true;
        request.shippingOptionRequired = true;
        if (gpayConfig.isGuest) {
            request.emailRequired = true;
        }
        request.shippingAddressParameters = {
            phoneNumberRequired: true
        };
        if (gpayConfig.countryCode) {
            request.shippingAddressParameters.allowedCountryCodes = [gpayConfig.countryCode];
        }
    }

    return request;
}

/**
 * getPaymentDataCallbacks
  * @returns {Object} result
 */
function getPaymentDataCallbacks() {
    var callbacks = {
        onPaymentAuthorized: onPaymentAuthorized
    };
    if (gpayContext === 'cart' || gpayContext === 'pdp') {
        callbacks.onPaymentDataChanged = onPaymentDataChanged;
    }
    return callbacks;
}

/**
 * getPaymentsClient
 * @returns {Object} payments client
 */
function getPaymentsClient() {
    if (!paymentsClient) {
        paymentsClient = new google.payments.api.PaymentsClient({
            environment: gpayConfig.environment,
            paymentDataCallbacks: getPaymentDataCallbacks()
        });
    }
    return paymentsClient;
}

/**
 * showStatus
 * @param {string} state - one of 'none', 'authorized', or 'error' to control which messages/buttons are shown
 */
function showStatus(state) {
    var $error = $('#googlepay-error');
    var $message = $('.googlepay-message');
    var $buttonWrapper = $gpayWrapper || $('#googlepay-button-wrapper');

    if (state === 'authorized') {
        $error.addClass('d-none');
        $message.addClass('d-none');
        $buttonWrapper.addClass('d-none');
    } else if (state === 'error') {
        $error.removeClass('d-none');
        $message.addClass('d-none');
    } else {
        $error.addClass('d-none');
        $message.removeClass('d-none');
        $buttonWrapper.removeClass('d-none');
    }
}

/**
 * Stores the Google Pay token in the server session, then triggers SFRA submit-payment.
 * @param {string} token - payment token
 * @param {Function} resolve - promise resolve function to call with the result of the authorization attempt
 */
function storeTokenOnServer(token, resolve) {
    var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
    $.ajax({
        url: $wrapper.data('store-url'),
        type: 'POST',
        dataType: 'json',
        data: { token: token, csrf_token: getCsrfToken() },
        success: function (data) {
            if (data.error) {
                showStatus('error');
                resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: 'Token storage failed', reason: 'PAYMENT_DATA_INVALID' } });
                return;
            }
            resolve({ transactionState: 'SUCCESS' });
            showStatus('authorized');
            $.spinner().start();
            $('button.submit-payment').trigger('click');
        },
        error: function () {
            showStatus('error');
            resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: 'Token storage failed', reason: 'PAYMENT_DATA_INVALID' } });
        }
    });
}

/**
 * onPaymentDataChanged
 * @param {Object} intermediatePaymentData - intermediate payment data
 * @returns {Promise} result
 */
function onPaymentDataChanged(intermediatePaymentData) {
    return new Promise(function (resolve) {
        var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
        if (!intermediatePaymentData) {
            resolve({});
            return;
        }
        var trigger = intermediatePaymentData.callbackTrigger;
        if (!trigger) {
            resolve({});
            return;
        }
        if (trigger === 'INITIALIZE' || trigger === 'SHIPPING_ADDRESS') {
            var shippingAddress = intermediatePaymentData.shippingAddress || {};

            if (!shippingAddress.countryCode) {
                resolve({});
                return;
            }

            var detailsUrl = $wrapper.data('shipping-details-url');

            if (!validateUrl(detailsUrl)) {
                resolve({
                    error: {
                        reason: 'SHIPPING_ADDRESS_UNSERVICEABLE',
                        message: 'Invalid server URL',
                        intent: 'SHIPPING_ADDRESS'
                    }
                });
                return;
            }

            $.ajax({
                url: detailsUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    csrf_token: getCsrfToken(),
                    body: JSON.stringify({
                        address: {
                            administrativeArea: shippingAddress.administrativeArea || '',
                            locality: shippingAddress.locality || '',
                            postalCode: shippingAddress.postalCode || '',
                            countryCode: shippingAddress.countryCode || ''
                        }
                    })
                },
                success: function (data) {
                    if (data.error || !data.shippingOptions || data.shippingOptions.length === 0) {
                        resolve({
                            error: {
                                reason: 'SHIPPING_ADDRESS_UNSERVICEABLE',
                                message: 'Cannot ship to this address',
                                intent: 'SHIPPING_ADDRESS'
                            }
                        });
                        return;
                    }

                    var defaultShippingOptions = data.shippingOptions.map(function (opt) {
                        return {
                            id: opt.id,
                            label: opt.label,
                            description: opt.description || ''
                        };
                    });

                    var displayItems = data.displayItems || [
                        { label: 'Subtotal', type: 'SUBTOTAL', price: data.subtotal || '0.00' },
                        { label: 'Shipping', type: 'SHIPPING_OPTION', price: data.shippingCost || '0.00' },
                        { label: 'Tax', type: 'TAX', price: data.totalTax || '0.00' }
                    ];

                    var defaultOptionId = data.selectedShippingMethodId || defaultShippingOptions[0].id;
                    resolve({
                        newTransactionInfo: {
                            totalPriceStatus: 'ESTIMATED',
                            totalPrice: data.totalPrice,
                            currencyCode: data.currencyCode,
                            countryCode: gpayConfig.countryCode || '',
                            totalPriceLabel: 'Total',
                            displayItems: displayItems
                        },
                        newShippingOptionParameters: {
                            defaultSelectedOptionId: defaultOptionId,
                            shippingOptions: defaultShippingOptions
                        }
                    });
                },
                error: function () {
                    resolve({
                        error: {
                            reason: 'SHIPPING_ADDRESS_UNSERVICEABLE',
                            message: 'Error processing shipping address',
                            intent: 'SHIPPING_ADDRESS'
                        }
                    });
                }
            });
        } else if (trigger === 'SHIPPING_OPTION') {
            var selectedOption = intermediatePaymentData.shippingOptionData.id;
            var methodUrl = $wrapper.data('shipping-method-url');

            if (!validateUrl(methodUrl)) {
                resolve({
                    error: {
                        reason: 'SHIPPING_OPTION_INVALID',
                        message: 'Invalid server URL',
                        intent: 'SHIPPING_OPTION'
                    }
                });
                return;
            }

            $.ajax({
                url: methodUrl,
                type: 'POST',
                dataType: 'json',
                data: {
                    csrf_token: getCsrfToken(),
                    body: JSON.stringify({ shippingMethodId: selectedOption })
                },
                success: function (data) {
                    if (data.error) {
                        resolve({
                            error: {
                                reason: 'SHIPPING_OPTION_INVALID',
                                message: 'Cannot apply this shipping method',
                                intent: 'SHIPPING_OPTION'
                            }
                        });
                        return;
                    }

                    var displayItems = data.displayItems || [
                        { label: 'Subtotal', type: 'SUBTOTAL', price: data.subtotal || '0.00' },
                        { label: 'Shipping', type: 'SHIPPING_OPTION', price: data.shippingCost || '0.00' },
                        { label: 'Tax', type: 'TAX', price: data.totalTax || '0.00' }
                    ];

                    resolve({
                        newTransactionInfo: {
                            totalPriceStatus: 'FINAL',
                            totalPrice: data.totalPrice,
                            currencyCode: data.currencyCode,
                            countryCode: gpayConfig.countryCode || '',
                            totalPriceLabel: 'Total',
                            displayItems: displayItems
                        }
                    });
                },
                error: function () {
                    resolve({
                        error: {
                            reason: 'SHIPPING_OPTION_INVALID',
                            message: 'Error applying shipping method',
                            intent: 'SHIPPING_OPTION'
                        }
                    });
                }
            });
        } else {
            resolve({});
        }
    });
}


/**
 * Restores the shopping basket when Google Pay flow is cancelled or fails.
 */
function restoreBasketOnError() {
    var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
    var restoreUrl = $wrapper.data('restore-basket-url');
    if (restoreUrl) {
        $.ajax({
            url: restoreUrl,
            type: 'POST',
            data: { csrf_token: getCsrfToken() },
            success: function (data) {
                if (data && !data.error && $.isNumeric(data.quantityTotal)) {
                    $('.minicart').trigger('count:update', { quantityTotal: data.quantityTotal });
                }
            },
            complete: function () {
                $('body').trigger('cart:update');
            }
        });
    }
}

/**
 * onPaymentAuthorized
 * @param {Object} paymentData - payment data
 * @returns {Promise} result
 */
function onPaymentAuthorized(paymentData) {
    return new Promise(function (resolve) {
        try {
            var token = paymentData.paymentMethodData.tokenizationData.token;
            if (!token) {
                resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: 'No payment token received', reason: 'PAYMENT_DATA_INVALID' } });
                return;
            }

            if (gpayContext === 'cart' || gpayContext === 'pdp') {
                var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
                var submitUrl = $wrapper.data('submit-order-url');

                if (!validateUrl(submitUrl)) {
                    restoreBasketOnError();
                    resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: 'Invalid server URL', reason: 'PAYMENT_DATA_INVALID' } });
                    return;
                }

                $.ajax({
                    url: submitUrl,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        csrf_token: getCsrfToken(),
                        body: JSON.stringify({ paymentData: paymentData })
                    },
                    success: function (data) {
                        if (data.error) {
                            restoreBasketOnError();
                            resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: data.errorMessage || 'Order processing failed', reason: 'PAYMENT_DATA_INVALID' } });
                            return;
                        }

                        var placeOrderUrl = $wrapper.data('place-order-url');
                        $.ajax({
                            url: placeOrderUrl,
                            type: 'POST',
                            timeout: 12000,
                            data: {
                                csrf_token: getCsrfToken(),
                                browserScreenHeight: screen.height,
                                browserScreenWidth: screen.width
                            },
                            success: function (placeResponse) {
                                if (placeResponse.redirectUrl) {
                                    restoreBasketOnError();
                                    resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: placeResponse.errorMessage || 'Order failed', reason: 'PAYMENT_DATA_INVALID' } });
                                    window.location.href = placeResponse.redirectUrl;
                                } else if (placeResponse.errorMessage) {
                                    restoreBasketOnError();
                                    resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: placeResponse.errorMessage, reason: 'PAYMENT_DATA_INVALID' } });
                                } else if (placeResponse.action || placeResponse.continueUrl) {
                                    var continueUrl = placeResponse.continueUrl;
                                    if (!validateUrl(continueUrl)) {
                                        restoreBasketOnError();
                                        resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: 'Something went wrong. Please try again later.', reason: 'PAYMENT_DATA_INVALID' } });
                                        return;
                                    }
                                    var orderID = placeResponse.orderID;
                                    var orderToken = placeResponse.orderToken;
                                    var doRedirect = function () {
                                        var redirect = $('<form>')
                                            .appendTo(document.body)
                                            .attr({ method: 'POST', action: continueUrl });
                                        $('<input>').appendTo(redirect).attr({ type: 'hidden', name: 'orderID', value: orderID });
                                        $('<input>').appendTo(redirect).attr({ type: 'hidden', name: 'orderToken', value: orderToken });
                                        redirect.submit();
                                    };
                                    resolve({ transactionState: 'SUCCESS' });
                                    if (gpayContext === 'pdp') {
                                        var pdpRestoreUrl = $wrapper.data('restore-basket-url');
                                        if (pdpRestoreUrl) {
                                            $.ajax({
                                                url: pdpRestoreUrl,
                                                type: 'POST',
                                                data: { csrf_token: getCsrfToken() },
                                                complete: doRedirect
                                            });
                                        } else {
                                            doRedirect();
                                        }
                                    } else {
                                        doRedirect();
                                    }
                                } else {
                                    restoreBasketOnError();
                                    resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: 'Unexpected response', reason: 'PAYMENT_DATA_INVALID' } });
                                }
                            },
                            error: function () {
                                restoreBasketOnError();
                                resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: 'Payment processing error', reason: 'PAYMENT_DATA_INVALID' } });
                            }
                        });
                    },
                    error: function () {
                        restoreBasketOnError();
                        resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: 'Payment processing error', reason: 'PAYMENT_DATA_INVALID' } });
                    }
                });
            } else {
                storeTokenOnServer(token, resolve);
            }
        } catch (e) {
            resolve({ transactionState: 'ERROR', error: { intent: 'PAYMENT_AUTHORIZATION', message: 'Payment processing error', reason: 'PAYMENT_DATA_INVALID' } });
        }
    });
}

/**
 * onGooglePayButtonClicked
 */
function onGooglePayButtonClicked() {
    showStatus('none');

    if (isLoadingPaymentData) {
        return;
    }

    if (gpayContext === 'pdp') {
        var $addToCart = $('.add-to-cart');
        if (!$addToCart.length || $addToCart.prop('disabled')) {
            showStatus('error');
            return;
        }

        isLoadingPaymentData = true;
        var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
        var prepareUrl = $wrapper.data('prepare-basket-url');

        $.ajax({
            url: prepareUrl,
            type: 'POST',
            dataType: 'json',
            data: { csrf_token: getCsrfToken() },
            success: function (prepData) {
                if (prepData.error) {
                    isLoadingPaymentData = false;
                    showStatus('error');
                    return;
                }

                $('body').one('product:afterAddToCart', function () {
                    var configUrl = $wrapper.data('config-url');
                    $.ajax({
                        url: configUrl,
                        type: 'GET',
                        dataType: 'json',
                        success: function (cfgData) {
                            if (cfgData.error || !cfgData.enabled) {
                                restoreBasketOnError();
                                showStatus('error');
                                isLoadingPaymentData = false;
                                return;
                            }

                            gpayConfig.totalPrice = cfgData.totalPrice;
                            gpayConfig.currencyCode = cfgData.currencyCode;
                            gpayConfig.subtotal = cfgData.subtotal;
                            gpayConfig.shippingCost = cfgData.shippingCost;
                            gpayConfig.totalTax = cfgData.totalTax;

                            try {
                                var paymentDataRequest = buildPaymentDataRequest();
                                getPaymentsClient().loadPaymentData(paymentDataRequest).catch(function (err) {
                                    paymentsClient = null;
                                    restoreBasketOnError();
                                    if (err.statusCode !== 'CANCELED') { showStatus('error'); }
                                }).finally(function () {
                                    isLoadingPaymentData = false;
                                });
                            } catch (e) {
                                paymentsClient = null;
                                restoreBasketOnError();
                                showStatus('error');
                                isLoadingPaymentData = false;
                            }
                        },
                        error: function () {
                            restoreBasketOnError();
                            showStatus('error');
                            isLoadingPaymentData = false;
                        }
                    });
                });

                $addToCart.trigger('click');
            },
            error: function () {
                isLoadingPaymentData = false;
                showStatus('error');
            }
        });
        return;
    }

    try {
        isLoadingPaymentData = true;
        var paymentDataRequest = buildPaymentDataRequest();
        getPaymentsClient().loadPaymentData(paymentDataRequest).catch(function (err) {
            paymentsClient = null;
            if (gpayContext === 'cart') { refreshBasketTotal(); }
            if (err.statusCode !== 'CANCELED') { showStatus('error'); }
        }).finally(function () {
            isLoadingPaymentData = false;
        });
    } catch (e) {
        paymentsClient = null;
        showStatus('error');
        isLoadingPaymentData = false;
    }
}

/**
 * clearGooglePayState
 */
function clearGooglePayState() {
    if (!paymentsClient) return;
    paymentsClient = null;
    showStatus('none');
    var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
    var clearUrl = $wrapper.data('clear-url');
    if (clearUrl) {
        $.ajax({ url: clearUrl, type: 'POST', dataType: 'json', data: { csrf_token: getCsrfToken() } });
    }
}

/**
 * renderButton - Renders the Google Pay button
 * @returns {void}
 */
function renderButton() {
    var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
    if (!gpayConfig) { return; }

    try {
        var button = getPaymentsClient().createButton({
            onClick: onGooglePayButtonClicked,
            allowedPaymentMethods: [baseCardPaymentMethod()]
        });
        $wrapper.empty().append(button);
        if (gpayContext === 'pdp') { syncPDPButtonState(); }
    } catch (e) { /* intentionally empty */ }
}

/**
 * loadScript
 * @param {Function} callback - callback function
 */
function loadScript(callback) {
    if (typeof google !== 'undefined' && google.payments) { callback(); return; }
    var script = document.createElement('script');
    script.src = GPAY_SCRIPT_URL;
    script.async = true;
    script.onload = callback;
    script.onerror = function () {};
    document.head.appendChild(script);
}

/**
 * initGooglePay
 * @param {string} expectedContext - expected context ('pdp', 'cart', or 'checkout')
 */
function initGooglePay(expectedContext) {
    var validContexts = ['pdp', 'cart', 'checkout'];
    var $wrapper;
    if (expectedContext && validContexts.indexOf(expectedContext) !== -1) {
        $wrapper = $('[data-gpay-context="' + expectedContext + '"]').first();
    } else {
        $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
    }
    $gpayWrapper = $wrapper;
    if (!$gpayWrapper.length || $gpayWrapper.hasClass('d-none')) {
        return;
    }

    var wrapperContext = $wrapper.data('gpay-context');
    if (wrapperContext === 'cart') {
        gpayContext = 'cart';
    } else if (wrapperContext === 'pdp') {
        gpayContext = 'pdp';
    } else {
        gpayContext = 'checkout';
    }

    var configUrl = $wrapper.data('config-url');
    if (!configUrl || !validateUrl(configUrl)) {
        return;
    }

    gpayConfig = null;
    showStatus('none');

    $.ajax({
        url: configUrl,
        type: 'GET',
        dataType: 'json',
        success: function (data) {
            if (!data.enabled) {
                return;
            }

            if (data.error && gpayContext !== 'pdp') {
                return;
            }

            if (gpayContext === 'cart' && !data.cartEnabled) {
                return;
            }
            if (gpayContext === 'pdp' && !data.pdpEnabled) {
                return;
            }

            gpayConfig = data;

            loadScript(function () {
                try {
                    getPaymentsClient()
                        .isReadyToPay(Object.assign({}, GPAY_API_VERSION, { allowedPaymentMethods: [baseCardPaymentMethod()] }))
                        .then(function (response) {
                            if (response.result) { renderButton(); }
                        })
                        .catch(function (err) {}); // eslint-disable-line no-unused-vars
                } catch (e) { /* intentionally empty */ }
            });
        },
        error: function () {}
    });
}

/**
 * refreshBasketTotal
 */
function refreshBasketTotal() {
    var configUrl = ($gpayWrapper || $('#googlepay-button-wrapper')).data('config-url');
    if (!configUrl || !gpayConfig) return;
    $.ajax({
        url: configUrl,
        type: 'GET',
        dataType: 'json',
        success: function (data) {
            if (!data.error && data.enabled && data.totalPrice) {
                gpayConfig.totalPrice = data.totalPrice;
                gpayConfig.currencyCode = data.currencyCode;
                gpayConfig.subtotal = data.subtotal;
                gpayConfig.shippingCost = data.shippingCost;
                gpayConfig.totalTax = data.totalTax;
            }
        }
    });
}

/**
 * setupCheckoutEventListeners
 */
function setupCheckoutEventListeners() {
    $('body').on('click', '.payment-options .nav-item', function () {
        if ($(this).data('method-id') === 'JPMC_GOOGLE_PAY') {
            initGooglePay();
            $('button.submit-payment').hide();
        } else {
            clearGooglePayState();
            $('button.submit-payment').show();
        }
    });

    $('body').on('click', '.customer-summary .edit-button, .shipping-summary .edit-button', function () {
        clearGooglePayState();
    });

    $('body').on('click', '.payment-summary .edit-button', function () {
        clearGooglePayState();
        if ($('.googlepay-tab').hasClass('active')) {
            initGooglePay();
            $('button.submit-payment').hide();
        }
    });

    $(window).on('popstate', function () { clearGooglePayState(); });

    $('body').on('checkout:updateCheckoutView', function () {
        $.spinner().stop();

        var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
        if (!$wrapper.length) return;
        if (!$wrapper.children().length) {
            initGooglePay();
        } else if (gpayConfig) {
            refreshBasketTotal();
        }
    });
}

/**
 * setupCartEventListeners
 */
function setupCartEventListeners() {
    $('body').on('cart:update', function () {
        var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
        if (!$wrapper.length) return;
        if (!$wrapper.children().length) {
            initGooglePay();
        } else {
            refreshBasketTotal();
        }
    });
}

/**
 * syncPDPButtonState
 */
function syncPDPButtonState() {
    var $addToCart = $('.add-to-cart');
    var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
    if (!$wrapper.length) return;
    if ($addToCart.length && $addToCart.prop('disabled')) {
        $wrapper.addClass('d-none');
    } else {
        $wrapper.removeClass('d-none');
    }
}

/**
 * setupPDPEventListeners
 */
function setupPDPEventListeners() {
    syncPDPButtonState();

    $('body').on('product:afterAttributeSelect', function () {
        var $wrapper = $gpayWrapper || $('#googlepay-button-wrapper');
        if ($wrapper.length) {
            $wrapper.empty();
            syncPDPButtonState();
            initGooglePay();
        }
    });

    $('body').on('product:statusUpdate', function () {
        syncPDPButtonState();
    });
}

/**
 * setupEventListeners
 */
function setupEventListeners() {
    if (gpayContext === 'cart') {
        setupCartEventListeners();
    } else if (gpayContext === 'pdp') {
        setupPDPEventListeners();
    } else {
        setupCheckoutEventListeners();
    }
}

module.exports = {
    init: function (expectedContext) {
        initGooglePay(expectedContext);
        setupEventListeners();
    }
};
