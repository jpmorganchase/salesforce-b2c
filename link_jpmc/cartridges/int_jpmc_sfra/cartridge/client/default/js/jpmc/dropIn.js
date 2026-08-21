'use strict';

/**
 * JPMC Drop-in UI client module.
 *
 * Renders the JPMC Drop-in UI inside the billing step when the site is in
 * DROP_IN checkout mode. Subscribes to the Drop-in event bus and finalizes
 * the SFCC order via the JPMC-PlaceOrder endpoint on PaymentSuccess.
 *
 * Bootstrap configuration is read from the #jpmc-dropin-config DOM element
 * (data-* attributes rendered by jpmcDropIn.isml).
 */

var instance = null;
var sessionToken = null;
var isBootstrapInFlight = false;
var restartDebounceTimer = null;
var RESTART_DEBOUNCE_MS = 120;
var intentRetryCount = 0;
var MAX_INTENT_RETRIES = 5;
var dropInSdkLoader = require('./dropInSdkLoader');

/**
 * Returns the merged config and falls back to safe defaults.
 * @returns {Object|null} the Drop-in bootstrap config, or null when missing
 */
function getConfig() {
    var el = document.getElementById('jpmc-dropin-config');
    if (!el) {
        return null;
    }
    var d = el.dataset;
    if (!d.createSessionUrl) {
        return null;
    }
    var themeOverrides = null;
    if (d.themeOverrides) {
        try { themeOverrides = JSON.parse(d.themeOverrides); } catch (e) { themeOverrides = null; }
    }
    var config = {
        scriptUrl: d.scriptUrl || 'https://checkout-cat.merchant.jpmorgan.com/drop-in-ui.mjs',
        themeOverrides: themeOverrides,
        createSessionUrl: d.createSessionUrl,
        getIntentUrl: d.getIntentUrl,
        placeOrderUrl: d.placeOrderUrl,
        orderConfirmUrl: d.orderConfirmUrl,
        csrfTokenName: d.csrfTokenName,
        csrfToken: d.csrfToken
    };
    return config;
}

/**
 * Returns the Drop-in container element, or null if not on the page.
 * @returns {HTMLElement|null} the container element, or null when absent
 */
function getContainer() {
    return document.getElementById('jpmc-dropin-container');
}

/**
 * Returns the current SFRA checkout stage.
 * @returns {string} stage name (shipping/payment/placeOrder/submitted)
 */
function getCurrentCheckoutStage() {
    var stageEl = document.querySelector('.data-checkout-stage');
    return stageEl ? stageEl.getAttribute('data-checkout-stage') : '';
}

/**
 * Lazily loads the Drop-in UI ES module from the configured URL.
 * Resolves with the DropInUI constructor.
 * @param {string} url - the script URL to load
 * @returns {Promise<Function>} a promise resolving to the DropInUI constructor
 */
function loadSdk(url) {
    return dropInSdkLoader.loadSdk(url);
}

/**
 * Posts a form-encoded request with the SFRA CSRF token attached.
 * @param {string} url - the endpoint to call
 * @param {Object} data - form data to send
 * @returns {Promise<Object>} jQuery ajax promise
 */
function postForm(url, data) {
    var config = getConfig();
    var payload = $.extend({}, data || {});
    if (config && config.csrfTokenName && config.csrfToken) {
        payload[config.csrfTokenName] = config.csrfToken;
    }
    return $.ajax({
        url: url,
        type: 'POST',
        dataType: 'json',
        data: payload
    });
}

/**
 * Displays an inline error inside the Drop-in panel.
 * @param {string} message - the message to display
 */
function showError(message) {
    // Remove loading spinner if still visible
    $('.jpmc-dropin-loading').remove();
    $('.jpmc-dropin-error')
        .text(message || 'Payment could not be completed. Please try again.')
        .removeClass('d-none');
}

/**
 * Hides the inline error if visible.
 */
function clearError() {
    $('.jpmc-dropin-error').addClass('d-none').text('');
}

/**
 * Refreshes the CSRF token cached in the config element after server consumes it.
 * @param {Object} response - server response that may carry a fresh csrfToken
 */
function syncCsrfToken(response) {
    if (response && response.csrfToken) {
        var el = document.getElementById('jpmc-dropin-config');
        if (el) el.dataset.csrfToken = response.csrfToken;
    }
}

/**
 * Normalizes the Drop-in SDK PaymentSuccess payload into a flat object.
 *
 * The SDK wraps payment data differently depending on the flow:
 *  - Standard (non-3DS): flat object with paymentGatewayTransactionId at top level,
 *    or wrapped inside a `payResponse` string.
 *  - 3DS: only `{ payResponse: '{"status":"STATUS_SUCCESS"}' }` — the transactionId
 *    is intentionally omitted because the final auth happened server-to-server.
 *    The backend polling job resolves the actual ID later via GET /checkout/notifications.
 *  - Some SDK versions use `payment_response` (object) instead of `payResponse` (string).
 *
 * Always returns the innermost parsed object so the server receives a flat payload.
 * @param {Object} payload - raw announcement.payload from the SDK event bus
 * @returns {Object} flat payment data object
 */
function normalizePayload(payload) {
    if (!payload) return {};
    if (payload.paymentGatewayTransactionId) return payload;
    if (payload.payResponse && typeof payload.payResponse === 'string') {
        try {
            var inner = JSON.parse(payload.payResponse);
            if (inner) return inner;
        } catch (e) { /* fall through */ }
    }
    // Alternative field used by some SDK versions.
    if (payload.payment_response && typeof payload.payment_response === 'object') {
        return payload.payment_response;
    }
    return payload;
}

/**
 * Calls JPMC-PlaceOrder to finalize the SFCC order after a successful payment.
 * The server creates the SFCC order from the basket at this point.
 * @param {Object} payload - the JPMC PaymentSuccess payload
 */
function finalizeOrder(payload) {
    var config = getConfig();
    if (!config) {
        showError('Missing payment config. Please refresh and try again.');
        return;
    }
    postForm(config.placeOrderUrl, {
        paymentPayload: JSON.stringify(normalizePayload(payload))
    }).done(function (data) {
        syncCsrfToken(data);
        if (data && !data.error && data.continueUrl) {
            var freshConfig = getConfig();
            var $form = $('<form>').appendTo(document.body).attr({
                method: 'POST',
                action: data.continueUrl
            });
            $('<input>').appendTo($form).attr({ name: 'orderID', value: data.orderID });
            $('<input>').appendTo($form).attr({ name: 'orderToken', value: data.orderToken });
            if (freshConfig && freshConfig.csrfTokenName && freshConfig.csrfToken) {
                $('<input>').appendTo($form).attr({ name: freshConfig.csrfTokenName, value: freshConfig.csrfToken });
            }
            $form.submit();
            return;
        }
        showError((data && data.errorMessage) || 'We could not place your order.');
    }).fail(function () {
        showError('We could not contact the server. Please try again.');
    });
}

/**
 * Handles a payment failure: clears local Drop-in state and automatically
 * bootstraps a fresh checkout session so the shopper can retry immediately
 * without refreshing the page.
 *
 * No SFCC order exists at this point (order creation is deferred to
 * JPMC-PlaceOrder after PaymentSuccess), so no server-side fail call is needed.
 */
function failServerOrder() {
    instance = null;
    sessionToken = null;

    setTimeout(function () {
        showSubmitButton();
        bootstrap();
    }, 800);
}

/**
 * Subscribes to the Drop-in UI event bus for the active instance.
 */
function subscribeToEvents() {
    if (!instance) {
        return;
    }
    instance.subscribe(function (announcement) {
        if (!announcement) return;
        var ns = announcement.namespace;
        var level = announcement.level;
        var message = announcement.message;
        var payload = announcement.payload || {};


        if (ns === 'payment' && level === 'info') {
            if (message === 'PaymentSuccess') {
                clearError();
                finalizeOrder(payload);
                return;
            }
            if (message === 'PaymentUnsuccessful' || message === 'PaymentValidationFailed') {
                showError('Payment was not successful. Please try a different payment method.');
                failServerOrder();
                return;
            }
        }
        if (ns === 'payment' && level === 'error') {
            showError('Payment was not successful. Please try a different payment method.');
            failServerOrder();
            return;
        }
        if (ns === 'render' && level === 'error') {
            showError('The payment form could not be loaded. Please refresh the page.');
        }
        if (ns === 'unknown' && level === 'error') {
            showError('An unexpected error occurred. Please refresh the page.');
        }
    });
}

/**
 * Mounts a new Drop-in UI instance with the given session token.
 * @param {Function} DropInUI - the Drop-in UI constructor
 * @param {string} token - the checkout session token
 */
function mount(DropInUI, token) {
    var config = getConfig();
    var ctorArgs = {
        checkoutSessionToken: token

    };
    if (config.themeOverrides) {
        ctorArgs.themeValueOverrides = config.themeOverrides;
    }
    try {
        instance = new DropInUI(ctorArgs);
        instance.mount('jpmc-dropin-container');
        // Remove loading spinner once SDK has mounted
        $('.jpmc-dropin-loading').remove();
        syncNextStepButtonVisibility();
        subscribeToEvents();
    } catch (e) {
        showError('Failed to initialize payment form.');
    }
}

/**
 * Fetches a fresh checkout intent token from server validation path.
 * @returns {Promise<Object>} jQuery ajax promise
 */
function fetchIntentToken() {
    var config = getConfig();
    if (!config || !config.getIntentUrl) {
        return $.Deferred().reject().promise();
    }
    return postForm(config.getIntentUrl, {});
}

/**
 * Bootstraps the Drop-in flow: creates the checkout session, loads the SDK,
 * and mounts the form.
 */
function bootstrap() {
    var container = getContainer();
    var config = getConfig();
    if (!container || !config || !config.scriptUrl || !config.createSessionUrl) {
        return;
    }
    if (instance || isBootstrapInFlight) {
        return;
    }

    isBootstrapInFlight = true;
    clearError();

    postForm(config.createSessionUrl, {}).done(function (data) {
        syncCsrfToken(data);
        if (!data || data.error || !data.checkoutSessionToken) {
            isBootstrapInFlight = false;
            if (data && data.redirectUrl) {
                window.location.href = data.redirectUrl;
                return;
            }
            showError((data && data.errorMessage) || 'Unable to start checkout.');
            return;
        }
        sessionToken = data.checkoutSessionToken;
        loadSdk(config.scriptUrl).then(function (DropInUI) {
            mount(DropInUI, sessionToken);
            isBootstrapInFlight = false;
        }, function (err) {
            isBootstrapInFlight = false;
            showError(err && err.message ? err.message : 'Drop-in UI failed to load.');
        });
    }).fail(function () {
        isBootstrapInFlight = false;
        showError('Unable to contact the server to start checkout.');
    });
}

/**
 * Re-shows the SFRA next-step button when the Drop-in is torn down (e.g. on
 * payment failure before re-mount) so the page does not get stuck in a hidden state.
 */
function showSubmitButton() {
    $('.next-step-button').show();
}

/**
 * Tears down current Drop-in instance before creating a new one.
 */
function teardownInstance() {
    if (!instance) {
        return;
    }
    try {
        if (typeof instance.unmount === 'function') {
            instance.unmount();
        }
        if (typeof instance.destroy === 'function') {
            instance.destroy();
        }
    } catch (e) {
        // best effort teardown
    }
    instance = null;
}

/**
 * Keeps SFRA next-step button visibility in sync with stage when Drop-in mode is active.
 * Hide only on payment stage (Drop-in has its own Pay button); show on all others.
 */
function syncNextStepButtonVisibility() {
    var config = getConfig();
    var stage = getCurrentCheckoutStage();
    if (config && stage === 'payment') {
        $('.next-step-button').hide();
        return;
    }
    showSubmitButton();
}

/**
 * Restarts Drop-in using the same bootstrap flow as page refresh.
 */
function restartDropInIfPaymentStage() {
    var stage = getCurrentCheckoutStage();
    var config = getConfig();
    var container = getContainer();
    if (stage !== 'payment' || isBootstrapInFlight) {
        return;
    }
    if (!config || !container || !config.scriptUrl) {
        return;
    }
    teardownInstance();
    sessionToken = null;
    intentRetryCount = 0;
    isBootstrapInFlight = true;
 
    /* eslint-disable require-jsdoc */
    function loadFreshIntentAndMount() {
        fetchIntentToken().done(function (data) {
            syncCsrfToken(data);
            if (!data || data.error || !data.checkoutSessionToken) {
                isBootstrapInFlight = false;
                if (data && data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                    return;
                }

                if (data && data.errorStage && intentRetryCount < MAX_INTENT_RETRIES) {
                    intentRetryCount++;
                    setTimeout(function () {
                        schedulePaymentStageRestart();
                    }, 250);
                    return;
                }

                showError((data && data.errorMessage) || 'Unable to refresh checkout intent.');
                return;
            }

            intentRetryCount = 0;
            sessionToken = data.checkoutSessionToken;
            loadSdk(config.scriptUrl).then(function (DropInUI) {
                mount(DropInUI, sessionToken);
                isBootstrapInFlight = false;
            }, function (err) {
                isBootstrapInFlight = false;
                showError(err && err.message ? err.message : 'Drop-in UI failed to load.');
            });
        }).fail(function (xhr) {
            isBootstrapInFlight = false;

            var responseData = xhr && xhr.responseJSON;
            if (responseData) {
                syncCsrfToken(responseData);
            }

            if (responseData && responseData.errorStage && intentRetryCount < MAX_INTENT_RETRIES) {
                intentRetryCount++;
                setTimeout(function () {
                    schedulePaymentStageRestart();
                }, 250);
                return;
            }

            showError((responseData && responseData.errorMessage) || 'Unable to refresh checkout intent.');
        });
    }

    loadFreshIntentAndMount();
}

/**
 * Waits briefly for async checkout stage transitions and restarts Drop-in
 * as soon as payment stage becomes active.
 */
function waitForPaymentStageAndRestart() {
    var attempts = 0;
    var maxAttempts = 20;
    var intervalMs = 120;
    var restarted = false;

    /* eslint-disable require-jsdoc */
    function check() {
        attempts++;
        syncNextStepButtonVisibility();
        clearError();
        var stage = getCurrentCheckoutStage();
        var config = getConfig();
        var container = getContainer();

        if (stage === 'payment' && !restarted) {
            if (!config || !container) {
                if (attempts < maxAttempts) {
                    setTimeout(check, intervalMs);
                }
                return;
            }
            restarted = true;
            restartDropInIfPaymentStage();
            if (isBootstrapInFlight || instance) {
                return;
            }
        }

        if (attempts < maxAttempts) {
            setTimeout(check, intervalMs);
        }
    }

    check();
}

/**
 * Debounces restart calls from overlapping checkout lifecycle triggers.
 */
function schedulePaymentStageRestart() {
    if (restartDebounceTimer) {
        clearTimeout(restartDebounceTimer);
        restartDebounceTimer = null;
    }

    restartDebounceTimer = setTimeout(function () {
        restartDebounceTimer = null;
        waitForPaymentStageAndRestart();
    }, RESTART_DEBOUNCE_MS);
}

module.exports = function () {
    syncNextStepButtonVisibility();
    clearError(); // Ensure no stale errors from previous session
    var initialStage = getCurrentCheckoutStage();
    if (initialStage === 'payment') {
        bootstrap();
    }

    $('body').on('checkout:updateCheckoutView', function () {
        setTimeout(function () {
            syncNextStepButtonVisibility();
            clearError();
            schedulePaymentStageRestart();
        }, 0);
    });

    $('body').on('click', '.next-step-button button', function () {
        schedulePaymentStageRestart();
    });

    $('body').on('click', '.customer-summary .edit-button, .shipping-summary .edit-button', function () {
        setTimeout(function () {
            syncNextStepButtonVisibility();
        }, 100);
    });

    $('body').on('click', '.payment-summary .edit-button', function () {
        schedulePaymentStageRestart();
    });
};
