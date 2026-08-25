'use strict';

/**
 * JPMC controller — endpoints for the Drop-in UI checkout flow.
 *
 * Routes:
 *   - JPMC-CreateSession  Validates the basket, reserves an SFCC order number,
 *                         calls POST /checkout/intent, returns { checkoutSessionToken }.
 *   - JPMC-PlaceOrder     Called by the Drop-in SDK on PaymentSuccess; attaches JPMC
 *                         transaction data, runs fraud detection, and places the order.
 */

var server = require('server');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

/**
 * Ensures the basket has a JPMC CREDIT_CARD payment instrument before order creation.
 * @param {dw.order.Basket} basket - current basket
 * @private
 */
function ensureJpmcPaymentInstrument(basket) {
    var Transaction = require('dw/system/Transaction');
    var PaymentMgr = require('dw/order/PaymentMgr');

    Transaction.wrap(function () {
        basket.getPaymentInstruments().toArray().forEach(function (pi) {
            basket.removePaymentInstrument(pi);
        });

        var paymentMethod = PaymentMgr.getPaymentMethod('CREDIT_CARD');
        var inst = basket.createPaymentInstrument('CREDIT_CARD', basket.getTotalGrossPrice());
        if (paymentMethod) {
            var processor = paymentMethod.getPaymentProcessor();
            if (processor && inst.paymentTransaction) {
                inst.paymentTransaction.setPaymentProcessor(processor);
            }
        }
    });
}

/**
 * Parses and unwraps the Drop-in SDK payment payload.
 * Handles standard, wrapped payResponse string, and 3DS status-only shapes.
 * @param {string} raw - JSON string from req.form.paymentPayload
 * @param {dw.system.Log} Logger - logger instance
 * @returns {Object|null} flat payload object or null on parse failure
 * @private
 */
function parsePayload(raw, Logger) {
    if (!raw) { return null; }
    try {
        var outer = JSON.parse(raw);
        if (outer && !outer.paymentGatewayTransactionId && outer.payResponse) {
            try {
                return JSON.parse(outer.payResponse);
            } catch (e) {
                Logger.warn('PlaceOrder: could not parse payResponse: {0}',
                    e instanceof Error ? e.message : String(e));
            }
        }
        return outer;
    } catch (e) {
        Logger.warn('PlaceOrder: could not parse paymentPayload: {0}',
            e instanceof Error ? e.message : String(e));
        return null;
    }
}

/**
 * Returns a normalized basket ETag.
 * @param {dw.order.Basket} basket - current basket
 * @returns {string} basket ETag, or empty string when unavailable
 */
function getBasketEtag(basket) {
    if (!basket || !basket.getEtag) {
        return '';
    }
    var etag = basket.getEtag();
    return etag ? String(etag) : '';
}

/**
 * Returns cached Drop-in token only when it was cached for the current basket ETag.
 * @param {Object} req - SFRA request object
 * @param {dw.order.Basket} basket - current basket
 * @returns {string|null} cached token for current ETag
 */
function getCachedDropInTokenForCurrentEtag(req, basket) {
    var currentEtag = getBasketEtag(basket);
    if (!currentEtag) {
        return null;
    }

    var cachedToken = req.session.privacyCache.get('jpmcDropInSessionToken') || null;
    var cachedTokenEtag = req.session.privacyCache.get('jpmcDropInSessionTokenEtag') || null;

    if (cachedToken && cachedTokenEtag && String(cachedTokenEtag) === currentEtag) {
        return cachedToken;
    }

    return null;
}

/**
 * Caches Drop-in token together with basket ETag to prevent stale-token reuse.
 * @param {Object} req - SFRA request object
 * @param {dw.order.Basket} basket - current basket
 * @param {string} token - checkout session token
 */
function cacheDropInTokenByEtag(req, basket, token) {
    req.session.privacyCache.set('jpmcDropInSessionToken', token || null);
    req.session.privacyCache.set('jpmcDropInSessionTokenEtag', getBasketEtag(basket));
}

/**
 * Returns a 400 response for invalid checkout-stage state transitions.
 * @param {Object} res - SFRA response object
 * @param {Object} payload - response payload
 * @private
 */
function respondBadRequest(res, payload) {
    res.setStatusCode(400);
    res.json(withCsrfToken(payload));
}

/**
 * Attaches a fresh CSRF token to JSON responses consumed by AJAX clients.
 * @param {Object} payload - response payload object
 * @returns {Object} payload with csrfToken field
 * @private
 */
function withCsrfToken(payload) {
    var CSRFProtection = require('dw/web/CSRFProtection');
    var responsePayload = payload || {};
    responsePayload.csrfToken = CSRFProtection.generateToken();
    return responsePayload;
}

server.post(
    'CreateSession',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Resource = require('dw/web/Resource');
        var Transaction = require('dw/system/Transaction');
        var URLUtils = require('dw/web/URLUtils');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
        var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
        var JPMCCheckoutSessionHelper = require('*/cartridge/scripts/helpers/JPMCCheckoutSessionHelper');
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var Logger = require('dw/system/Logger').getLogger('JPMC', 'checkout-session');

        if (JPMCMerchantResolver.getCheckoutMode() !== 'DROP_IN') {
            res.json({ error: true, errorMessage: 'JPMC Drop-in checkout is not enabled.' });
            return next();
        }

        var currentBasket = BasketMgr.getCurrentBasket();
        if (!currentBasket) {
            res.json({ error: true, cartError: true, redirectUrl: URLUtils.url('Cart-Show').toString() });
            return next();
        }

        if (validationHelpers.validateProducts(currentBasket).error) {
            res.json({ error: true, cartError: true, redirectUrl: URLUtils.url('Cart-Show').toString() });
            return next();
        }

        var validationOrderStatus = hooksHelper(
            'app.validate.order', 'validateOrder', currentBasket,
            require('*/cartridge/scripts/hooks/validateOrder').validateOrder
        );
        if (validationOrderStatus.error) {
            res.json({ error: true, errorMessage: validationOrderStatus.message });
            return next();
        }

        if (!currentBasket.defaultShipment.shippingAddress) {
            res.json({
                error: true,
                errorStage: { stage: 'shipping', step: 'address' },
                errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
            });
            return next();
        }

        // In DROP_IN mode, the billing form is handled by the SDK so the SFRA
        // billing address may not be set yet.  Copy from shipping address.
        if (!currentBasket.billingAddress) {
            var shippingAddr = currentBasket.defaultShipment.shippingAddress;
            Transaction.wrap(function () {
                if (!currentBasket) return;
                var billing = currentBasket.createBillingAddress();
                billing.setFirstName(shippingAddr.firstName);
                billing.setLastName(shippingAddr.lastName);
                billing.setAddress1(shippingAddr.address1);
                billing.setAddress2(shippingAddr.address2 || '');
                billing.setCity(shippingAddr.city);
                billing.setPostalCode(shippingAddr.postalCode);
                billing.setStateCode(shippingAddr.stateCode);
                billing.setCountryCode(shippingAddr.countryCode.value);
                billing.setPhone(shippingAddr.phone || '');
            });
        }

        var cachedTokenForCurrentEtag = getCachedDropInTokenForCurrentEtag(req, currentBasket);
        if (cachedTokenForCurrentEtag) {
            res.json({ error: false, checkoutSessionToken: cachedTokenForCurrentEtag });
            return next();
        }

        Transaction.wrap(function () { basketCalculationHelpers.calculateTotals(currentBasket); });

        var resolvedConfig = null;
        try {
            resolvedConfig = JPMCMerchantResolver.resolve();
        } catch (e) {
            Logger.warn('CreateSession: merchant resolver threw: {0}',
                e instanceof Error ? e.message : String(e));
        }

        var cachedSessionToken = req.session.privacyCache.get('jpmcDropInSessionToken') || null;
        var sessionResult = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(currentBasket, {
            resolvedConfig: resolvedConfig,
            cachedSessionToken: cachedSessionToken
        });

        if (!sessionResult.success) {
            Logger.error('CreateSession: /checkout/intent failed: {0}', sessionResult.error);
            res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
            return next();
        }

        res.json({ error: false, checkoutSessionToken: sessionResult.checkoutSessionToken });
        return next();
    }
);

/**
 * Handler for the JPMC-GetIntent endpoint.
 * @param {Object} req - request object
 * @param {Object} res - response object
 * @param {Function} next - next middleware function
 * @returns {void}
 */
function getIntentHandler(req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    var JPMCCheckoutSessionHelper = require('*/cartridge/scripts/helpers/JPMCCheckoutSessionHelper');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    var Logger = require('dw/system/Logger').getLogger('JPMC', 'checkout-session');

    if (JPMCMerchantResolver.getCheckoutMode() !== 'DROP_IN') {
        res.json({ success: false, error: true, errorMessage: 'JPMC Drop-in checkout is not enabled.' });
        return next();
    }

    var currentBasket = BasketMgr.getCurrentBasket();
    if (!currentBasket) {
        res.json(({ success: false, error: true, cartError: true, redirectUrl: URLUtils.url('Cart-Show').toString() }));
        return next();
    }

    if (validationHelpers.validateProducts(currentBasket).error) {
        res.json({ success: false, error: true, cartError: true, redirectUrl: URLUtils.url('Cart-Show').toString() });
        return next();
    }

    var validationOrderStatus = hooksHelper(
        'app.validate.order', 'validateOrder', currentBasket,
        require('*/cartridge/scripts/hooks/validateOrder').validateOrder
    );
    if (validationOrderStatus.error) {
        respondBadRequest(res, { success: false, error: true, errorMessage: validationOrderStatus.message });
        return next();
    }

    if (!currentBasket.defaultShipment.shippingAddress) {
        respondBadRequest(res, {
            success: false,
            error: true,
            errorStage: { stage: 'shipping', step: 'address' },
            errorMessage: Resource.msg('error.no.shipping.address', 'checkout', null)
        });
        return next();
    }

    // In DROP_IN mode, the billing form is handled by the SDK so the SFRA
    // billing address may not be set yet.  Copy from shipping address to
    // unblock intent creation.
    if (!currentBasket.billingAddress) {
        var shippingAddr = currentBasket.defaultShipment.shippingAddress;
        Transaction.wrap(function () {
            if (!currentBasket) return;
            var billing = currentBasket.createBillingAddress();
            billing.setFirstName(shippingAddr.firstName);
            billing.setLastName(shippingAddr.lastName);
            billing.setAddress1(shippingAddr.address1);
            billing.setAddress2(shippingAddr.address2 || '');
            billing.setCity(shippingAddr.city);
            billing.setPostalCode(shippingAddr.postalCode);
            billing.setStateCode(shippingAddr.stateCode);
            billing.setCountryCode(shippingAddr.countryCode.value);
            billing.setPhone(shippingAddr.phone || '');
        });
    }

    var cachedTokenForCurrentEtag = getCachedDropInTokenForCurrentEtag(req, currentBasket);
    if (cachedTokenForCurrentEtag) {
        res.json({ success: true, checkoutSessionToken: cachedTokenForCurrentEtag });
        return next();
    }

    Transaction.wrap(function () { basketCalculationHelpers.calculateTotals(currentBasket); });

    var resolvedConfig = null;
    try {
        resolvedConfig = JPMCMerchantResolver.resolve();
    } catch (e) {
        Logger.warn('GetIntent: merchant resolver threw: {0}',
            e instanceof Error ? e.message : String(e));
    }

    var cachedSessionToken = req.session.privacyCache.get('jpmcDropInSessionToken') || null;
    var sessionResult = JPMCCheckoutSessionHelper.getOrUpdateJpmcIntent(currentBasket, {
        resolvedConfig: resolvedConfig,
        cachedSessionToken: cachedSessionToken
    });

    if (!sessionResult.success) {
        Logger.error('GetIntent: intent retrieval failed: {0}', sessionResult.error);
        res.json({ success: false, error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
        return next();
    }

    cacheDropInTokenByEtag(req, currentBasket, sessionResult.checkoutSessionToken);
    res.json({ success: true, checkoutSessionToken: sessionResult.checkoutSessionToken });
    return next();
}
server.post(
    'GetIntent',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    getIntentHandler
);

server.post(
    'PlaceOrder',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var OrderMgr = require('dw/order/OrderMgr');
        var Order = require('dw/order/Order');
        var Resource = require('dw/web/Resource');
        var Transaction = require('dw/system/Transaction');
        var URLUtils = require('dw/web/URLUtils');
        var BasketMgr = require('dw/order/BasketMgr');
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
        var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var Logger = require('dw/system/Logger').getLogger('JPMC', 'place-order');

        if (JPMCMerchantResolver.getCheckoutMode() !== 'DROP_IN') {
            res.json({ error: true, errorMessage: 'JPMC Drop-in checkout is not enabled.' });
            return next();
        }

        if (!req.form.paymentPayload) {
            res.json({ error: true, errorMessage: 'Missing payment payload.' });
            return next();
        }

        var paymentPayload = parsePayload(req.form.paymentPayload, Logger);

        // Validate Drop-in confirmed a successful payment.
        // 3DS flows send only { status: 'STATUS_SUCCESS' } — transactionId arrives later
        // via the notifications polling job.
        if (!paymentPayload || paymentPayload.status !== 'STATUS_SUCCESS') {
            Logger.error('PlaceOrder: payment not confirmed. status={0}',
                paymentPayload ? (paymentPayload.status || 'missing') : 'no payload');
            res.json({
                error: true,
                errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null),
                errorStage: { stage: 'payment', step: 'paymentInstrument' }
            });
            return next();
        }

        var currentBasket = BasketMgr.getCurrentBasket();
        if (!currentBasket) {
            res.json({ error: true, cartError: true, redirectUrl: URLUtils.url('Cart-Show').toString() });
            return next();
        }

        if (validationHelpers.validateProducts(currentBasket).error) {
            res.json({ error: true, cartError: true, redirectUrl: URLUtils.url('Cart-Show').toString() });
            return next();
        }

        Transaction.wrap(function () { basketCalculationHelpers.calculateTotals(currentBasket); });

        try {
            ensureJpmcPaymentInstrument(currentBasket);
        } catch (e) {
            Logger.error('PlaceOrder: failed to attach payment instrument: {0}',
                e instanceof Error ? e.message : String(e));
            res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
            return next();
        }

        // Create SFCC order with the clean base reserved order number.
        var reservedOrderNo = currentBasket.custom.jpmcReservedOrderNo || null;
        var checkoutIntentOrderNumber = currentBasket.custom.jpmcCheckoutIntentOrderNumber || null;
        var order = null;
        try {
            order = Transaction.wrap(function () {
                if (!currentBasket) return null;
                return reservedOrderNo
                    ? OrderMgr.createOrder(currentBasket, reservedOrderNo)
                    : OrderMgr.createOrder(currentBasket);
            });
        } catch (e) {
            Logger.error('PlaceOrder: createOrder threw: {0}', e instanceof Error ? e.message : String(e));
        }
        if (!order) {
            res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
            return next();
        }

        var resolvedConfig = null;
        try {
            resolvedConfig = JPMCMerchantResolver.resolve();
        } catch (e) {
            Logger.warn('PlaceOrder: merchant resolver threw: {0}', e instanceof Error ? e.message : String(e));
        }

        var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');
        var txId = paymentPayload.paymentGatewayTransactionId || jpmcConstants.AWAITING_TRANSACTION_ID;
        var authId = paymentPayload.paymentGatewayTransactionId || jpmcConstants.AWAITING_TRANSACTION_ID;
        var authTimestamp = paymentPayload.paymentGatewayTransactionTimestamp || '';
        var merchantId = resolvedConfig && resolvedConfig.merchantId;
        var captureMethod = resolvedConfig && resolvedConfig.captureMethod || 'MANUAL';
        try {
            Transaction.wrap(function () {
                // Order custom attributes
                order.custom.jpmcCheckoutMode = 'DROP_IN';
                if (checkoutIntentOrderNumber) {
                    order.custom.jpmcCheckoutIntentOrderNumber = checkoutIntentOrderNumber;
                }
                order.custom.jpmcGatewayTransactionId = txId;
                if (merchantId) { order.custom.jpmcMerchantId = merchantId; }
                if (paymentPayload.maskedPan) { order.custom.jpmcMaskedPan = paymentPayload.maskedPan; }
                if (paymentPayload.approvalCode) { order.custom.jpmcApprovalCode = paymentPayload.approvalCode; }

                // Payment instrument — mirrors PIE (jpmc_payment.js) for BM/email/wallet display
                order.getPaymentInstruments().toArray().forEach(function (inst) {
                    var pt = inst.getPaymentTransaction();
                    if (pt) {
                        pt.setTransactionID(txId);
                        if (pt.custom) {
                            pt.custom.jpmcAuthorizationId = authId;
                            pt.custom.jpmcAuthTimestamp = authTimestamp;
                        }
                        if (captureMethod) { pt.custom.jpmcCaptureMethod = captureMethod; }
                    }
                    if (paymentPayload.maskedPan) { inst.setCreditCardNumber(paymentPayload.maskedPan); }
                    inst.setCreditCardType(paymentPayload.cardTypeName || paymentPayload.cardBrand || 'Credit Card - Dropin');
                    if (paymentPayload.cardExpirationMonth) {
                        inst.setCreditCardExpirationMonth(parseInt(paymentPayload.cardExpirationMonth, 10));
                    }
                    if (paymentPayload.cardExpirationYear) {
                        inst.setCreditCardExpirationYear(parseInt(paymentPayload.cardExpirationYear, 10));
                    }
                    if (paymentPayload.accountHolderName) { inst.setCreditCardHolder(paymentPayload.accountHolderName); }
                    if (merchantId) { inst.custom.jpmcMerchantId = merchantId; }
                });
            });
        } catch (e) {
            Logger.warn('PlaceOrder: could not persist payment data: {0}', e instanceof Error ? e.message : String(e));
        }

        var fraudDetectionStatus = hooksHelper(
            'app.fraud.detection', 'fraudDetection', order,
            require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection
        );

        if (fraudDetectionStatus && fraudDetectionStatus.status === 'fail') {
            try {
                Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            } catch (e) {
                Logger.error('PlaceOrder: failOrder after fraud failed: {0}', e instanceof Error ? e.message : String(e));
            }
            req.session.privacyCache.set('fraudDetectionStatus', true);
            res.json({
                error: true,
                cartError: true,
                redirectUrl: URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString(),
                errorMessage: Resource.msg('error.technical', 'checkout', null)
            });
            return next();
        }

        var placeResult = COHelpers.placeOrder(order, fraudDetectionStatus);
        if (placeResult.error) {
            res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
            return next();
        }

        // Hold the order until the notifications polling job confirms payment server-to-server.
        // Prevents warehouse dispatch on a fraudulent frontend payload.
        try {
            Transaction.wrap(function () {
                order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
                order.setExportStatus(Order.EXPORT_STATUS_NOTEXPORTED);
            });
        } catch (e) {
            Logger.warn('PlaceOrder: could not set hold status: {0}', e instanceof Error ? e.message : String(e));
        }

        if (req.currentCustomer.addressBook) {
            var addressBook = req.currentCustomer.addressBook;
            addressHelpers.gatherShippingAddresses(order).forEach(function (address) {
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
            orderID: order.getOrderNo(),
            orderToken: order.getOrderToken(),
            continueUrl: URLUtils.url('Order-Confirm').toString()
        });
        return next();
    }
);

/**
 * JPMC-GetSequenceNumber : Generates an SFCC order sequence number for use as
 * the JPMC Drop-in UI reference number in PWA/headless flows.
 * Called by the PWA before loading the Drop-in UI.
 * @name JPMC-GetSequenceNumber
 * @function
 * @memberof JPMC
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
server.get('GetSequenceNumber', function (req, res, next) {
    var OrderMgr = require('dw/order/OrderMgr');
    try {
        var sequenceNumber = OrderMgr.createOrderSequenceNo();
        res.json({
            success: true,
            sequenceNumber: sequenceNumber
        });
    } catch (e) {
        var Logger = require('dw/system/Logger').getLogger('JPMC', 'sequence');
        Logger.error('GetSequenceNumber: failed to generate sequence number: {0}',
            e instanceof Error ? e.message : String(e));
        res.setStatusCode(500);
        res.json({
            success: false,
            error: 'Failed to generate sequence number'
        });
    }
    return next();
});

module.exports = server.exports();
