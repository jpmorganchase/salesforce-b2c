/**
 * JPMC 3D Secure Orchestration Handler
 * Handles 3DS authentication iframe and postback callbacks.
 * The iframe and container are rendered in jpmc/jpmc3DSConfig.isml - this module
 * only shows/hides them and handles the orchestration form submission.
 * @module jpmc/threeDSOrchestration
 */

'use strict';

// DOM element IDs
var IFRAME_ID = 'jpmc-3ds-iframe';
var IFRAME_CONTAINER_ID = 'jpmc-3ds-container';
var CANCEL_BUTTON_ID = 'jpmc-3ds-cancel';
var ORDER_NO_INPUT_ID = 'jpmc-3ds-order-no';
var ORDER_TOKEN_INPUT_ID = 'jpmc-3ds-order-token';

// 3DS Constants (synchronized with jpmcConstants.js)
var THREE_DS_CONFIG = {
    TIMEOUT_MS: 3 * 60 * 1000,  // 3 minutes in milliseconds
    POSTMESSAGE_TYPE: 'jpmc3dsComplete',
    RESPONSE_STATUS: {
        SUCCESS: 'SUCCESS',
        ERROR: 'ERROR',
        DENIED: 'DENIED'
    },
    TRANSACTION_STATUS: {
        SUCCESS: 'Y',
        FAILED: 'N'
    },
    JPMC_ORIGINS: [
        'https://payments.jpmorgan.com',
        'https://api-ms.payments.jpmorgan.com',
        'https://api-ms-test.payments.jpmorgan.com'
    ],
    JPMC_DOMAIN_SUFFIX: '.payments.jpmorgan.com'
};

var currentCleanup = null; // Store cleanup function for manual cancellation

/**
 * Submit orchestration form to iframe - exact JPMC documented pattern.
 * Takes query parameters from orchestrationUrl (Expires, Signature) and
 * submits them as a GET form targeting the iframe by name.
 * @param {HTMLIFrameElement} iframeRef - The iframe element
 * @param {string} orchestrationUrlFromResponse - JPMC authentication orchestration URL with signed query params
 */
function orchestrationFormSubmit(iframeRef, orchestrationUrlFromResponse) {
    var form = document.createElement('form');
    form.action = orchestrationUrlFromResponse;

    // Takes the query parameters from the orchestrationUrl and applies them
    // to the form that will be submitted (preserves Expires & Signature)
    var signedUrl = new URL(form.action);
    signedUrl.searchParams.forEach(function (value, key) {
        var signatureInformation = document.createElement('input');
        signatureInformation.name = key;
        signatureInformation.value = value;
        form.appendChild(signatureInformation);
    });

    form.method = 'GET';
    form.target = iframeRef.name;

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

/**
 * Show the 3DS iframe container and submit the orchestration form.
 * Prefers static elements rendered by jpmc3DSConfig.isml.
 * Falls back to dynamic creation if they are not found in the DOM.
 * In both cases the container is moved directly under document.body so it
 * is never trapped under a CSS display:none ancestor (e.g. a hidden checkout stage).
 * @param {string} orchestrationUrl - JPMC authentication orchestration URL
 * @returns {HTMLIFrameElement} result
 */
function createOrchestrationIframe(orchestrationUrl) {
    var container = document.getElementById(IFRAME_CONTAINER_ID);
    var iframe = document.getElementById(IFRAME_ID);

    if (!container || !iframe) {
        // Fallback: create elements dynamically if ISML did not render them
        container = document.createElement('div');
        container.id = IFRAME_CONTAINER_ID;
        container.className = 'jpmc-3ds-overlay';

        iframe = document.createElement('iframe');
        iframe.id = IFRAME_ID;
        iframe.name = IFRAME_ID;
        iframe.frameBorder = '0';
        iframe.className = 'jpmc-3ds-iframe';

        container.appendChild(iframe);
        document.body.appendChild(container);
    } else {
        // Move the ISML-rendered container to document.body if not already there.
        // This ensures it is never hidden by a display:none ancestor (e.g. collapsed
        // checkout stage section).
        if (container.parentNode !== document.body) {
            document.body.appendChild(container);
        }
        iframe.style.display = 'block';
    }

    // Show the container
    container.style.display = 'flex';

    // Show cancel button if it exists
    var cancelBtn = document.getElementById(CANCEL_BUTTON_ID);
    if (cancelBtn) {
        cancelBtn.style.display = 'block';
    }

    // Submit orchestration form targeting the iframe (JPMC documented pattern)
    orchestrationFormSubmit(iframe, orchestrationUrl);

    return iframe;
}

/**
 * Hide the 3DS iframe container (does not remove from DOM - reusable)
 */
function hideOrchestrationIframe() {
    var container = document.getElementById(IFRAME_CONTAINER_ID);
    var iframe = document.getElementById(IFRAME_ID);
    var cancelBtn = document.getElementById(CANCEL_BUTTON_ID);
    
    if (container) {
        container.style.display = 'none';
    }
    if (iframe) {
        iframe.style.display = 'none';
        // Clear iframe content so it's clean on next use
        iframe.src = 'about:blank';
    }
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
}

/**
 * Setup postMessage listener for 3DS authentication completion
 * Note: JPMC documentation mentions a POST HTTP request (postback) to authenticationReturnUrl
 * This listener handles browser-side events while the server handles the HTTP postback
 * @param {function} onSuccess - Success callback
 * @param {function} onError - Error callback
 * @param {function} onDenied - Denied/cancelled callback
 * @param {Object} expectedData - Expected data for validation (orderID, transactionId)
 * @returns {Object} Object with cleanup method
 */
function setupPostbackListener(onSuccess, onError, onDenied, expectedData) {
    var hasResponded = false;
    var timeoutId = null;
    
    var messageHandler = function (event) {
        var data = event.data;

        // Only handle messages from our own origin (3dsPostback.isml loaded in iframe)
        // String comparison with indexOf is vulnerable to subdomain attacks
        // Use exact origin match or suffix check with dot separator
        var isSameOrigin = event.origin === window.location.origin;
        var isJpmcOrigin = false;

        // Check against exact allowed origins only
        for (var i = 0; i < THREE_DS_CONFIG.JPMC_ORIGINS.length; i++) {
            if (event.origin === THREE_DS_CONFIG.JPMC_ORIGINS[i]) {
                isJpmcOrigin = true;
                break;
            }
        }

        if (!isSameOrigin && !isJpmcOrigin) {
            return;
        }

        // Only handle the jpmc3dsComplete message type
        if (!data || data.type !== THREE_DS_CONFIG.POSTMESSAGE_TYPE) {
            return;
        }

        // Schema validation: Verify orderID and transactionId match expected values
        // Prevents malicious same-origin messages from injecting fake success responses
        if (expectedData) {
            if (expectedData.orderID && data.orderID !== expectedData.orderID) {
                return;
            }
            if (expectedData.transactionId && data.transactionId !== expectedData.transactionId) {
                return;
            }
        }

        // Mark as responded and cleanup
        hasResponded = true;
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        window.removeEventListener('message', messageHandler);
        hideOrchestrationIframe();

        var status = data.responseStatus || data.authenticationStatus;

        if (status === THREE_DS_CONFIG.RESPONSE_STATUS.SUCCESS || status === THREE_DS_CONFIG.TRANSACTION_STATUS.SUCCESS) {
            if (typeof onSuccess === 'function') {
                onSuccess(data);
            }
        } else if (status === THREE_DS_CONFIG.RESPONSE_STATUS.DENIED) {
            if (typeof onDenied === 'function') {
                onDenied(data);
            } else if (typeof onError === 'function') {
                onError(data);
            }
        } else if (typeof onError === 'function') {
            onError(data);
        }
    };

    window.addEventListener('message', messageHandler);

    // Safety timeout - if no callback received, trigger error handler
    timeoutId = setTimeout(function () {
        if (hasResponded) {
            return; // Already handled
        }
        
        window.removeEventListener('message', messageHandler);
        hideOrchestrationIframe();
        
        // Trigger error callback to recover UX
        if (typeof onError === 'function') {
            onError({
                error: 'TIMEOUT',
                message: 'Something went wrong. Please try again later.',
                responseStatus: THREE_DS_CONFIG.RESPONSE_STATUS.ERROR
            });
        }
    }, THREE_DS_CONFIG.TIMEOUT_MS);
    
    // Return cleanup method for manual cancellation
    return {
        cleanup: function () {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            window.removeEventListener('message', messageHandler);
            hideOrchestrationIframe();
        }
    };
}

/**
 * Initiate 3DS authentication orchestration flow
 * @param {Object} config - orchestration configuration
 * @param {string} config.orchestrationUrl - JPMC signed orchestration URL
 * @param {string} config.orderID - Expected order ID for validation
 * @param {string} config.transactionId - Expected transaction ID for validation
 * @param {function} config.onSuccess - Success callback
 * @param {function} config.onError - Error callback
 * @param {function} config.onDenied - Denied/cancelled callback
 */
function initiateOrchestration(config) {
    if (!config || !config.orchestrationUrl) {
        if (config.onError) {
            config.onError({ error: 'Missing orchestration URL' });
        }
        return;
    }

    // Setup postback listener with timeout handling and schema validation
    var listenerCleanup = setupPostbackListener(
        config.onSuccess,
        config.onError,
        config.onDenied,
        {
            orderID: config.orderID,
            transactionId: config.transactionId
        }
    );
    
    // Store cleanup reference for potential manual cancellation
    currentCleanup = listenerCleanup;

    // Show iframe with orchestration URL
    var iframe = createOrchestrationIframe(config.orchestrationUrl);
    if (!iframe) {
        if (typeof config.onError === 'function') {
            config.onError({ message: 'Failed to display 3DS authentication window.' });
        }
        if (currentCleanup) {
            currentCleanup.cleanup();
            currentCleanup = null;
        }
        return;
    }
    
    // Add iframe load error handler - detects if JPMC URL fails to load
    iframe.onerror = function () {
        if (typeof config.onError === 'function') {
            config.onError({
                error: 'IFRAME_LOAD_ERROR',
                message: 'Something went wrong. Please try again later.',
                responseStatus: 'ERROR'
            });
        }
        if (currentCleanup) {
            currentCleanup.cleanup();
            currentCleanup = null;
        }
    };
}

/**
 * Cleanup orchestration iframe and listeners
 */
function cleanup() {
    hideOrchestrationIframe();
    if (currentCleanup) {
        currentCleanup.cleanup();
        currentCleanup = null;
    }
}

/**
 * Cancel ongoing 3DS authentication (user-initiated)
 * Triggers the error callback to recover UX
 * @param {function} onCancel - Optional callback to invoke on cancellation
 */
function cancelAuthentication(onCancel) {
    if (currentCleanup) {
        currentCleanup.cleanup();
        currentCleanup = null;
    } else {
        hideOrchestrationIframe();
    }
    
    if (typeof onCancel === 'function') {
        onCancel({
            error: 'USER_CANCELLED',
            message: 'Authentication cancelled by user.',
            responseStatus: 'DENIED'
        });
    }
}

/**
 * Setup cancel button click handler
 * Binds the cancel button to fail the order and re-enable checkout
 */
function setupCancelButton() {
    var cancelBtn = document.getElementById(CANCEL_BUTTON_ID);
    if (!cancelBtn) {
        return;
    }
    
    // Remove any existing listeners to prevent duplicates
    var newBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newBtn, cancelBtn);
    
    // Add click handler
    newBtn.addEventListener('click', function () {
        cancelAuthentication(function (err) { // eslint-disable-line no-unused-vars
            // Get order info from hidden fields
            var orderNo = document.getElementById(ORDER_NO_INPUT_ID);
            var orderToken = document.getElementById(ORDER_TOKEN_INPUT_ID);
            
            if (!orderNo || !orderToken) {
                return;
            }
            
            // Fail the order on backend (silently, no error message)
            if (typeof $ !== 'undefined' && $('.place-order').length) {
                $.ajax({
                    url: $('.place-order').data('action').replace('PlaceOrder', 'Fail3DSOrder'),
                    method: 'POST',
                    data: {
                        orderNo: orderNo.value,
                        orderToken: orderToken.value,
                        reason: 'USER_CANCELLED',
                        csrf_token: $("input[name*='csrf_token']").val()
                    },
                    success: function () {
                    },
                    error: function (err) {
                    }
                });
            }
            
            // Re-enable Place Order button
            if (typeof $ !== 'undefined') {
                $('body').trigger('checkout:enableButton', '.next-step-button button');
            }
        });
    });
}

module.exports = {
    initiateOrchestration: initiateOrchestration,
    createOrchestrationIframe: createOrchestrationIframe,
    hideOrchestrationIframe: hideOrchestrationIframe,
    cleanup: cleanup,
    cancelAuthentication: cancelAuthentication,
    setupCancelButton: setupCancelButton
};
