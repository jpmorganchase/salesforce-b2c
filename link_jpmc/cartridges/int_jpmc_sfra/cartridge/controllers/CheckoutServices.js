'use strict';

var server = require('server');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
server.extend(module.superModule);

/**
 * CheckoutServices-SubmitPayment : Filters customer payment instruments by merchant ID after payment submission
 * @name CheckoutServices-SubmitPayment
 * @function
 * @memberof CheckoutServices
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
server.append('SubmitPayment', function (req, res, next) {
    this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
        var viewData = res.getViewData();
        if (viewData.error) {
            return;
        }

        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var AccountModel = require('*/cartridge/models/account');
        var renderTemplateHelper = require('*/cartridge/scripts/renderTemplateHelper');

        var resolvedConfig = JPMCMerchantResolver.resolve();
        var currentMerchantId = resolvedConfig ? resolvedConfig.merchantId : null;

        if (!currentMerchantId) {
            return;
        }

        var filteredModel = new AccountModel(req.currentCustomer, null, null, currentMerchantId);
        viewData.customer = filteredModel;

        if (req.currentCustomer.raw.registered) {
            viewData.renderedPaymentInstruments = filteredModel.customerPaymentInstruments.length > 0
                ? renderTemplateHelper.getRenderedHtml(
                    { customer: filteredModel },
                    'checkout/billing/storedPaymentInstruments'
                )
                : null;
        }
    });

    return next();
});

/**
 * CheckoutServices-PlaceOrder extension for JPMC 3DS
 * Uses server.replace (not append/prepend) because the 3DS authentication flow
 * requires full control of the PlaceOrder route to intercept authorization responses,
 * detect 3DS challenges, and redirect to iframe-based authentication before order completion.
 * This cannot be achieved with append/prepend as the base route would complete the order
 * before the 3DS challenge can be presented to the shopper.
 */
server.replace('PlaceOrder', server.middleware.https, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var OrderMgr = require('dw/order/OrderMgr');
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

    // In DROP_IN mode, order placement is handled exclusively by JPMC-PlaceOrder
    // after receiving PaymentSuccess from the Drop-in SDK event bus.
    if (JPMCMerchantResolver.getCheckoutMode() === 'DROP_IN') {
        res.json({
            error: true,
            errorStage: {
                stage: 'payment',
                step: 'paymentInstrument'
            },
            errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null),
            redirectUrl: URLUtils.url('Checkout-Begin', 'stage', 'payment').toString()
        });
        return next();
    }

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.json({
            error: true,
            cartError: true,
            fieldErrors: [],
            serverErrors: [],
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    var validatedProducts = validationHelpers.validateProducts(currentBasket);
    if (validatedProducts.error) {
        res.json({
            error: true,
            cartError: true,
            fieldErrors: [],
            serverErrors: [],
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    if (req.session.privacyCache.get('fraudDetectionStatus')) {
        res.json({
            error: true,
            cartError: true,
            redirectUrl: URLUtils.url('Error-ErrorCode', 'err', '01').toString(),
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });

        return next();
    }

    var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', currentBasket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
    if (validationOrderStatus.error) {
        res.json({
            error: true,
            errorMessage: validationOrderStatus.message
        });
        return next();
    }

    if (currentBasket.defaultShipment.shippingAddress === null) {
        res.json({
            error: true,
            errorStage: {
                stage: 'shipping',
                step: 'address'
            },
            errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
        });
        return next();
    }

    if (!currentBasket.billingAddress) {
        res.json({
            error: true,
            errorStage: {
                stage: 'payment',
                step: 'billingAddress'
            },
            errorMessage: Resource.msg('error.no.billing.address', 'checkout', null)
        });
        return next();
    }

    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(currentBasket);
    });

    var validPayment = COHelpers.validatePayment(req, currentBasket);
    if (validPayment.error) {
        res.json({
            error: true,
            errorStage: {
                stage: 'payment',
                step: 'paymentInstrument'
            },
            errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
        });
        return next();
    }

    var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
    if (calculatedPaymentTransactionTotal.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    var reservedOrderNo = currentBasket.custom && currentBasket.custom.jpmcReservedOrderNo
        ? currentBasket.custom.jpmcReservedOrderNo
        : null;
    var order = null;
    try {
        if (reservedOrderNo) {
            order = Transaction.wrap(function () {
                if (!currentBasket) return null;
                return OrderMgr.createOrder(currentBasket, reservedOrderNo);
            });
        } else {
            order = COHelpers.createOrder(currentBasket);
        }
    } catch (e) {
        order = null;
    }
    if (!order) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    var checkoutIntentOrderNumber = currentBasket.custom && currentBasket.custom.jpmcCheckoutIntentOrderNumber
        ? currentBasket.custom.jpmcCheckoutIntentOrderNumber
        : null;
    if (checkoutIntentOrderNumber) {
        Transaction.wrap(function () {
            order.custom.jpmcCheckoutIntentOrderNumber = checkoutIntentOrderNumber;
        });
    }

    // Nonce is stored in session.privacy (server-side, never sent to browser) and mirrored on the order.
    // Handle3DSReturn compares the two to validate that the incoming postback is legitimate and not a forged request.
    var UUIDUtils = require('dw/util/UUIDUtils');
    var threeDSNonce = UUIDUtils.createUUID();
    Transaction.wrap(function () {
        order.custom.threeDSCallbackNonce = threeDSNonce;
    });
    req.session.privacyCache.set('threeDSCallbackNonce', threeDSNonce);

    // Store orderToken in session to avoid exposing it in URL logs
    // Retrieved in Handle3DSReturn for OrderMgr.getOrder(orderNo, orderToken) call
    req.session.privacyCache.set('threeDSOrderToken', order.orderToken);

    var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo);

    // ========== JPMC 3DS INTEGRATION ==========
    if (handlePaymentResult && handlePaymentResult.requires3DS === true) {
        var Logger = require('dw/system/Logger');
        var responseData = {
            error: false,
            requires3DS: true,
            authenticationOrchestrationUrl: handlePaymentResult.authenticationOrchestrationUrl,
            transactionId: handlePaymentResult.transactionId,
            orderID: order.orderNo,
            orderToken: order.orderToken,
            continueUrl: URLUtils.url('Order-Confirm').toString()
        };
        
        // Log without sensitive orderToken
        Logger.info('JPMC 3DS: Controller returning 3DS response for order: {0}, transactionId: {1}', 
            order.orderNo, handlePaymentResult.transactionId);
        
        res.json(responseData);
        return next();
    }
    // ========== END 3DS INTEGRATION ==========


    var options = { req: req, res: res };
    var postAuthCustomizations = hooksHelper('app.post.auth', 'postAuthorization', handlePaymentResult, order, options, require('*/cartridge/scripts/hooks/postAuthorizationHandling').postAuthorization);
    if (postAuthCustomizations && Object.prototype.hasOwnProperty.call(postAuthCustomizations, 'error')) {
        res.json(postAuthCustomizations);
        return next();
    }

    if (handlePaymentResult.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', currentBasket, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
    if (fraudDetectionStatus.status === 'fail') {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
        req.session.privacyCache.set('fraudDetectionStatus', true);
        res.json({
            error: true,
            cartError: true,
            redirectUrl: URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString(),
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
    if (placeOrderResult.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }

    if (req.currentCustomer.addressBook) {
        var addressBook = req.currentCustomer.addressBook;
        var allAddresses = addressHelpers.gatherShippingAddresses(order);
        allAddresses.forEach(function (address) {
            if (!addressHelpers.checkIfAddressStored(address, addressBook.addresses)) {
                addressHelpers.saveAddress(address, req.currentCustomer, addressHelpers.generateAddressName(address));
            }
        });
    }

    if (order.getCustomerEmail()) {
        COHelpers.sendConfirmationEmail(order, req.locale.id);
    }

    req.session.privacyCache.set('usingMultiShipping', false);

    res.json({
        error: false,
        orderID: order.orderNo,
        orderToken: order.orderToken,
        continueUrl: URLUtils.url('Order-Confirm').toString()
    });

    return next();
});

/**
 * Handle3DSReturn - Handles the HTTP POST postback from JPMC after 3DS authentication
 * Per JPMC documentation Step 4: Listen for the POST HTTP request
 * 
 * JPMC posts to authenticationReturnUrl with:
 * - paymentRequestId
 * - responseStatus (SUCCESS, ERROR, DENIED)
 */
server.post('Handle3DSReturn', server.middleware.https, function (req, res, next) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var Logger = require('dw/system/Logger');
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var THREE_DS = jpmcConstants.THREE_DS;
    var jpmcPayment = require('*/cartridge/scripts/hooks/payment/processor/jpmc_payment');

    var orderNo = req.querystring.orderNo;
    // Read orderToken from session instead of URL to avoid log exposure
    var orderToken = req.session.privacyCache.get('threeDSOrderToken');

    if (!orderNo || !orderToken) {
        Logger.error('JPMC 3DS: Missing orderNo or orderToken in postback URL');

        // Clear encrypted payment data on error
        jpmcPayment.clearSensitivePaymentData();

        res.render('jpmc/3dsPostback', {
            success: false,
            responseStatus: 'ERROR',
            authenticationStatus: 'U',
            authenticationValue: '',
            eci: '',
            transactionId: '',
            orderID: '',
            orderToken: '',
            continueUrl: ''
        });
        return next();
    }

    // Step 2: Look up order
    var order = OrderMgr.getOrder(orderNo, orderToken);

    if (!order) {
        Logger.error('JPMC 3DS: Order not found for orderNo: {0}', orderNo);

        // Clear encrypted payment data on error
        jpmcPayment.clearSensitivePaymentData();
        req.session.privacyCache.set('threeDSOrderToken', null);

        res.render('jpmc/3dsPostback', {
            success: false,
            responseStatus: 'ERROR',
            authenticationStatus: 'U',
            authenticationValue: '',
            eci: '',
            transactionId: '',
            orderID: '',
            orderToken: '',
            continueUrl: ''
        });
        return next();
    }

    // Step 3: Validate one-time nonce — session.privacy vs order.custom 
    var sessionNonce  = req.session.privacyCache.get('threeDSCallbackNonce');
    var expectedNonce = order.custom.threeDSCallbackNonce;
    if (!sessionNonce || !expectedNonce || sessionNonce !== expectedNonce) {
        Logger.error('JPMC 3DS: Nonce mismatch for order {0} — possible spoofed callback', orderNo);
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });

        // Clear encrypted payment data on security failure
        jpmcPayment.clearSensitivePaymentData();

        res.render('jpmc/3dsPostback', {
            success: false,
            responseStatus: 'ERROR',
            authenticationStatus: 'U',
            authenticationValue: '',
            eci: '',
            transactionId: '',
            orderID: '',
            orderToken: '',
            continueUrl: ''
        });
        return next();
    }

    // Step 4: Invalidate nonce immediately — one-time use only, prevents replay
    Transaction.wrap(function () {
        order.custom.threeDSCallbackNonce = null;
    });
    req.session.privacyCache.set('threeDSCallbackNonce', null);
    req.session.privacyCache.set('threeDSOrderToken', null);

    // Step 5: Now safe to read POST body
    var paymentRequestId = req.form.paymentRequestId || req.querystring.paymentRequestId;
    var responseStatus   = req.form.responseStatus   || req.querystring.responseStatus;

    // Input validation: responseStatus must be one of the allowed values
    var allowedStatuses = [
        THREE_DS.RESPONSE_STATUS.SUCCESS,
        THREE_DS.RESPONSE_STATUS.ERROR,
        THREE_DS.RESPONSE_STATUS.DENIED,
        THREE_DS.RESPONSE_STATUS.CANCELLED
    ];
    if (responseStatus && allowedStatuses.indexOf(responseStatus) === -1) {
        Logger.error('JPMC 3DS: Invalid responseStatus received: {0}', responseStatus);
        responseStatus = THREE_DS.RESPONSE_STATUS.ERROR; // Sanitize to safe value
    }

    Logger.info('JPMC 3DS: Received postback - orderNo: {0}, paymentRequestId: {1}, responseStatus: {2}',
        orderNo, paymentRequestId, responseStatus);

    // Step 6: Request additional payment details via GET /payments/{id}
    var JPMCPaymentHelper = require('*/cartridge/scripts/helpers/JPMCPaymentHelper');
    var paymentDetails = JPMCPaymentHelper.getPaymentDetails(order, paymentRequestId);
    
    if (responseStatus === THREE_DS.RESPONSE_STATUS.SUCCESS && paymentDetails.success) {
        // Authentication successful - update order and place it
        var authResultData = (paymentDetails.data && paymentDetails.data.paymentAuthenticationResult) || {};
        var threeDSData = authResultData.threeDomainSecureCompletion || {};
        
        Transaction.wrap(function () {
            order.custom.pending3DSAuthentication = false;
            
            // Map 3DS transaction status (Y=success, N=failed, U=unavailable, A=attempted)
            if (threeDSData.threeDSTransactionStatus) {
                order.custom.threeDSTransactionStatus = threeDSData.threeDSTransactionStatus;
            }
            
            // Map authentication ID (JPMC tracking ID)
            if (authResultData.authenticationId) {
                order.custom.threeDSAuthenticationId = authResultData.authenticationId;
            }
            
            // Map directory server transaction ID
            if (threeDSData.threeDSDirectoryServerTransactionId) {
                order.custom.threeDSTransactionId = threeDSData.threeDSDirectoryServerTransactionId;
            }
            
            // Map CAVV (authentication value)
            if (authResultData.threeDSAuthenticationValue) {
                order.custom.threeDSAuthenticationValue = authResultData.threeDSAuthenticationValue;
            }
            
            // Map ECI from threeDomainSecureCompletion
            if (threeDSData.electronicCommerceIndicator) {
                order.custom.threeDSEci = threeDSData.electronicCommerceIndicator;
            }
        });

        Logger.info('JPMC 3DS: Authentication successful for order {0}, status: {1}, ECI: {2}', 
            order.orderNo, 
            threeDSData.threeDSTransactionStatus || 'unknown',
            threeDSData.electronicCommerceIndicator || 'unknown');

        // Process RTAU with the confirmed post-3DS authorization response
        require('*/cartridge/scripts/helpers/AccountUpdaterHelper').processRTAUForOrder(order, paymentDetails.data);

        // PlaceOrder only handled payment authorisation; OrderMgr.placeOrder() has not been
        // called yet — without this the order stays in CREATED state indefinitely.

        var COHelpers   = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var placeOrderResult = COHelpers.placeOrder(order, {});
        if (placeOrderResult.error) {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            Logger.error('JPMC 3DS: OrderMgr.placeOrder failed for order {0}', order.orderNo);

            // Clear encrypted payment data on failure
            jpmcPayment.clearSensitivePaymentData();

            res.render('jpmc/3dsPostback', {
                success: false,
                responseStatus: THREE_DS.RESPONSE_STATUS.ERROR,
                authenticationStatus: 'U',
                authenticationValue: '',
                eci: '',
                transactionId: paymentRequestId || '',
                orderID: '',
                orderToken: '',
                continueUrl: ''
            });
            return next();
        }

        // Render ISML inside iframe - the page's script will postMessage the parent
        res.render('jpmc/3dsPostback', {
            success: true,
            responseStatus: responseStatus,
            authenticationStatus: threeDSData.threeDSTransactionStatus || 'Y',
            authenticationValue: authResultData.authenticationValue || '',
            eci: threeDSData.electronicCommerceIndicator || '',
            transactionId: paymentRequestId,
            orderID: order.orderNo,
            orderToken: order.orderToken,
            continueUrl: URLUtils.url('Order-Confirm').toString()
        });

        // Clear encrypted payment data after successful 3DS completion
        jpmcPayment.clearSensitivePaymentData();
    } else {
        // Authentication failed or denied - still capture 3DS metadata for audit trail
        authResultData = (paymentDetails.data && paymentDetails.data.paymentAuthenticationResult) || {};
        threeDSData = authResultData.threeDomainSecureCompletion || {};
        
        Transaction.wrap(function () {
            order.custom.pending3DSAuthentication = false;
            
            // Set status based on response or 3DS transaction status
            if (threeDSData.threeDSTransactionStatus) {
                order.custom.threeDSTransactionStatus = threeDSData.threeDSTransactionStatus;
            } else {
                order.custom.threeDSTransactionStatus = responseStatus === THREE_DS.RESPONSE_STATUS.DENIED 
                    ? THREE_DS.TRANSACTION_STATUS.FAILED 
                    : THREE_DS.TRANSACTION_STATUS.UNAVAILABLE;
            }
            
            // Capture available 3DS metadata even on failure for troubleshooting
            if (authResultData.authenticationId) {
                order.custom.threeDSAuthenticationId = authResultData.authenticationId;
            }
            if (threeDSData.threeDSDirectoryServerTransactionId) {
                order.custom.threeDSTransactionId = threeDSData.threeDSDirectoryServerTransactionId;
            }
            if (threeDSData.electronicCommerceIndicator) {
                order.custom.threeDSEci = threeDSData.electronicCommerceIndicator;
            }

            OrderMgr.failOrder(order, true);
        });

        // Clear encrypted payment data on authentication failure
        jpmcPayment.clearSensitivePaymentData();

        Logger.error('JPMC 3DS: Authentication failed for order {0} - status: {1}, reason: {2}',
            order.orderNo,
            responseStatus,
            threeDSData.threeDSTransactionStatusReasonText || 'unknown');

        // Render ISML inside iframe - the page's script will postMessage the parent
        res.render('jpmc/3dsPostback', {
            success: false,
            responseStatus: responseStatus === THREE_DS.RESPONSE_STATUS.DENIED 
                ? THREE_DS.RESPONSE_STATUS.DENIED 
                : THREE_DS.RESPONSE_STATUS.ERROR,
            authenticationStatus: threeDSData.threeDSTransactionStatus || (
                responseStatus === THREE_DS.RESPONSE_STATUS.DENIED 
                    ? THREE_DS.TRANSACTION_STATUS.FAILED 
                    : THREE_DS.TRANSACTION_STATUS.UNAVAILABLE
            ),
            authenticationValue: '',
            eci: threeDSData.electronicCommerceIndicator || '',
            transactionId: paymentRequestId || '',
            orderID: '',
            orderToken: '',
            continueUrl: ''
        });
    }
    
    return next();
});

/**
 * Fail3DSOrder - Fails an order when 3DS authentication times out or fails on frontend
 * This endpoint is called when the user experiences a timeout or cancels authentication
 * WITHOUT receiving a postback from JPMC (which would trigger Handle3DSReturn instead)
 * 
 * Prevents orphaned orders by explicitly failing them and allowing user to retry
 */
server.post('Fail3DSOrder', server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');
    var Logger = require('dw/system/Logger');
    var Resource = require('dw/web/Resource');
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var THREE_DS = jpmcConstants.THREE_DS;
    var jpmcPayment = require('*/cartridge/scripts/hooks/payment/processor/jpmc_payment');

    var orderNo = req.form.orderNo || req.querystring.orderNo;
    var orderToken = req.form.orderToken || req.querystring.orderToken;
    var reasonInput = req.form.reason || THREE_DS.FAILURE_REASON.TIMEOUT;
    
    // Whitelist validation for reason parameter
    var allowedReasons = [
        THREE_DS.FAILURE_REASON.TIMEOUT,
        THREE_DS.FAILURE_REASON.USER_CANCELLED,
        THREE_DS.FAILURE_REASON.IFRAME_ERROR
    ];
    var reason = allowedReasons.indexOf(reasonInput) !== -1 ? reasonInput : THREE_DS.FAILURE_REASON.TIMEOUT;
    
    Logger.info('JPMC 3DS: Fail3DSOrder called - orderNo: {0}, reason: {1}', orderNo, reason);
    
    if (!orderNo) {
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }
    
    // Look up the order
    var order = OrderMgr.getOrder(orderNo, orderToken);
    
    if (!order) {
        Logger.warn('JPMC 3DS: Cannot fail order - order not found: {0}', orderNo);
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
        return next();
    }
    
    // Check if order is in a state that can be failed
    // Only fail if it's still pending 3DS authentication
    if (!order.custom.pending3DSAuthentication) {
        Logger.warn('JPMC 3DS: Order {0} is not pending 3DS - not failing', orderNo);
        res.json({
            error: false,
            message: 'Order already processed'
        });
        return next();
    }
    
    // Fail the order with race condition protection
    try {
        var orderWasFailed = false;
        
        Transaction.wrap(function () {
            // Re-check inside transaction to prevent race conditions
            if (!order.custom.pending3DSAuthentication) {
                return;
            }
            
            order.custom.pending3DSAuthentication = false;
            order.custom.threeDSTransactionStatus = THREE_DS.TRANSACTION_STATUS.UNAVAILABLE;
            order.custom.threeDSFailureReason = reason;
            
            var failOrderStatus = OrderMgr.failOrder(order, true);
            
            // Check if failOrder was successful
            if (!failOrderStatus.isError()) {
                orderWasFailed = true;
            } else {
                Logger.error('JPMC 3DS: OrderMgr.failOrder returned error: {0}', failOrderStatus.message);
            }
        });
        
        if (!orderWasFailed) {
            Logger.warn('JPMC 3DS: Order {0} was not failed - likely already processed by concurrent request', orderNo);
            res.json({
                error: false,
                message: 'Order already processed'
            });
            return next();
        }
        
        Logger.info('JPMC 3DS: Successfully failed order {0} due to {1}', orderNo, reason);

        // Clear encrypted payment data after order failure
        jpmcPayment.clearSensitivePaymentData();

        res.json({
            error: false,
            message: 'Order cancelled successfully',
            orderFailed: true
        });
    } catch (e) {
        var errorMsg = e instanceof Error ? e.message : String(e);
        Logger.error('JPMC 3DS: Error failing order {0}: {1}', orderNo, errorMsg);
        
        res.json({
            error: true,
            errorMessage: Resource.msg('error.technical', 'checkout', null)
        });
    }
    
    return next();
});

module.exports = server.exports();
