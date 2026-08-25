'use strict';

var processInclude = require('base/util');
require('./components/cleave');

// ========== JPMC 3DS INTEGRATION ==========
/**
 * JPMC 3D Secure Integration
 * Intercepts PlaceOrder AJAX requests to:
 * 1. Inject browser fingerprint data required for 3DS authentication
 * 2. Detect PERFORM_AUTHENTICATION responses from JPMC
 * 3. Display 3DS challenge iframe when authentication is required
 */

// Verify jQuery is available before attempting $.ajax interception
if (typeof $ === 'undefined' || typeof $.ajax === 'undefined') {
    throw new Error('jQuery must be loaded before JPMC 3DS integration');
}

// Check if 3DS is enabled via site preference (set in template)
if (window.jpmc3DSEnabled === true) {
    
    var threeDSHandled = false; // Prevent double handling of 3DS flow
    var threeDSOrchestration = require('./jpmc/threeDSOrchestration');
    var browserDataCollector = require('./jpmc/browserDataCollector');
    
    // Expose on window for cancel button access (legacy - can be removed if not needed elsewhere)
    window.jpmc3DSOrchestration = threeDSOrchestration;
    
    // Setup cancel button event handler (when DOM is ready)
    $(document).ready(function () {
        threeDSOrchestration.setupCancelButton();
    });
    
    var originalAjax = $.ajax;

    /**
     * Override jQuery $.ajax to intercept PlaceOrder requests
     * This must happen at module load time (before event handlers bind)
     * @param {string} url - request url
     * @param {Object} options - ajax options
     * @returns {Object} ajax result
     */
    $.ajax = function (url, options) {
        // Handle both $.ajax(url, options) and $.ajax(options) signatures
        if (typeof url === 'object') {
            options = url;
            url = options.url;
        }

        // Only intercept CheckoutServices-PlaceOrder endpoint
        if (url && url.indexOf('CheckoutServices-PlaceOrder') !== -1) {
            
            // Ensure options.data exists
            if (!options.data) {
                options.data = {};
            }
            
            // Collect and inject browser fingerprint data for 3DS
            var browserData = browserDataCollector.getBrowserDataAsObject();

            // Merge browser data into request (handle both string and object formats)
            if (typeof options.data === 'string') {
                // Convert URL-encoded string to object
                var dataObj = {};
                options.data.split('&').forEach(function (pair) {
                    var parts = pair.split('=');
                    if (parts.length === 2) {
                        dataObj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
                    }
                });
                Object.assign(dataObj, browserData);
                options.data = $.param(dataObj);
            } else {
                // Merge directly into object
                Object.assign(options.data, browserData);
            }
            
            // Wrap the original success callback to detect 3DS requirement
            var originalSuccess = options.success;
            options.success = function (data, textStatus, jqXHR) {
                
                // Check if 3DS authentication is required from JPMC
                // Response will have: requires3DS=true, authenticationOrchestrationUrl, transactionId
                if (data && 
                    data.requires3DS === true && 
                    data.authenticationOrchestrationUrl && 
                    !data.error && 
                    !threeDSHandled) {
                    
                    threeDSHandled = true;

                    // Store order info for cancel button access
                    $('#jpmc-3ds-order-no').val(data.orderID || '');
                    $('#jpmc-3ds-order-token').val(data.orderToken || '');

                    // Display 3DS authentication iframe
                    threeDSOrchestration.initiateOrchestration({
                        orchestrationUrl: data.authenticationOrchestrationUrl,
                        orderID: data.orderID,
                        transactionId: data.transactionId,

                        onSuccess: function (authResult) {
                            threeDSHandled = false;
                            threeDSOrchestration.hideOrchestrationIframe();

                            // Order-Confirm is a POST-only route (reads req.form.orderID/orderToken).
                            // Submit a hidden form just like base SFRA checkout.js does.
                            var continueUrl = (authResult && authResult.continueUrl) ? authResult.continueUrl : data.continueUrl;
                            var orderID = (authResult && authResult.orderID) ? authResult.orderID : data.orderID;
                            var orderToken = (authResult && authResult.orderToken) ? authResult.orderToken : data.orderToken;

                            if (continueUrl) {
                                var redirect = $('<form>')
                                    .appendTo(document.body)
                                    .attr({ method: 'POST', action: continueUrl });
                                $('<input>').appendTo(redirect).attr({ name: 'orderID', value: orderID });
                                $('<input>').appendTo(redirect).attr({ name: 'orderToken', value: orderToken });
                                redirect.submit();
                            }
                            
                        },
                        
                        onError: function (error) {
                            threeDSHandled = false;

                            // Hide iframe
                            threeDSOrchestration.hideOrchestrationIframe();

                            // Fail the order on backend to prevent orphaned orders
                            var failReason = error.error || 'TIMEOUT';
                            $.ajax({
                                url: $('.place-order').data('action').replace('PlaceOrder', 'Fail3DSOrder'),
                                method: 'POST',
                                data: {
                                    orderNo: data.orderID,
                                    orderToken: data.orderToken,
                                    reason: failReason,
                                    csrf_token: $("input[name*='csrf_token']").val()
                                }
                            });

                            // Show error message
                            $('.error-message').show();
                            if ($('.error-message-text').length) {
                                $('.error-message-text').text(
                                    error.message || 'Something went wrong. Please try again later.'
                                );
                            }

                            // Re-enable Place Order button
                            $('body').trigger('checkout:enableButton', '.next-step-button button');
                        },
                        
                        onDenied: function () {
                            threeDSHandled = false;

                            // Hide iframe
                            threeDSOrchestration.hideOrchestrationIframe();

                            // Fail the order on backend to prevent orphaned orders
                            $.ajax({
                                url: $('.place-order').data('action').replace('PlaceOrder', 'Fail3DSOrder'),
                                method: 'POST',
                                data: {
                                    orderNo: data.orderID,
                                    orderToken: data.orderToken,
                                    reason: 'USER_CANCELLED',
                                    csrf_token: $("input[name*='csrf_token']").val()
                                }
                            });

                            // Show error message
                            $('.error-message').show();
                            if ($('.error-message-text').length) {
                                $('.error-message-text').text(
                                    'Something went wrong. Please try again later.'
                                );
                            }

                            // Re-enable Place Order button
                            $('body').trigger('checkout:enableButton', '.next-step-button button');
                        }
                    });

                    // DO NOT call original SFRA success handler
                    // We're handling the redirect manually after 3DS completes
                    return;
                }

                // No 3DS required - pass through to original SFRA success handler
                if (originalSuccess && typeof originalSuccess === 'function') {
                    originalSuccess(data, textStatus, jqXHR);
                }
            };
        }

        // Call original $.ajax with potentially modified options
        return originalAjax.call(this, url, options);
    };
}
// ========== END 3DS INTEGRATION ==========

/**
 * Initialize checkout page components
 */
$(document).ready(function () {
    processInclude(require('base/checkout/checkout'));
    processInclude(require('./checkout/billing'));
    processInclude(require('./jpmc/dropIn'));
    require('./jpmc/googlePay').init('checkout');
    // Enable Apple Pay button if supported
    if (window.dw
        && window.dw.applepay
        && window.ApplePaySession
        && window.ApplePaySession.canMakePayments()) {
        $('body').addClass('apple-pay-enabled');
    }
});
