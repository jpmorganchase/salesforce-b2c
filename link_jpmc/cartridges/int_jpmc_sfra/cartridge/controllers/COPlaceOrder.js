'use strict';

var server = require('server');

var OrderMgr = require('dw/order/OrderMgr');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

/**
 * COPlaceOrder-Submit : Handles post-3DS order confirmation for Apple Pay and standard payments
 * @name COPlaceOrder-Submit
 * @function
 * @memberof COPlaceOrder
 * @param {middleware} - csrfProtection.validateRequest
 * @param {httpparameter} - order_id - Order ID from query string
 * @param {httpparameter} - order_token - Order token for verification
 * @param {Function} next - next middleware function
 */
server.post('Submit', csrfProtection.validateRequest, function (req, res, next) {
    var checkoutHelper = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var OrderModel = require('*/cartridge/models/order');
    var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');

    var order = OrderMgr.getOrder(req.querystring.order_id, req.querystring.order_token);

   
    if (!order) {
        return next(new Error('Order not found or token mismatch'));
    }

   
    if (req.session.privacyCache.get('fraudDetectionStatus')) {
        return next(new Error(Resource.msg('error.technical', 'checkout', null)));
    }

    var fraudDetectionStatus = hooksHelper(
        'app.fraud.detection',
        'fraudDetection',
        order,
        require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection
    );

    if (fraudDetectionStatus.status === 'fail') {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

      
        req.session.privacyCache.set('fraudDetectionStatus', true);
        return next(new Error(Resource.msg('error.technical', 'checkout', null)));
    }

    var orderPlacementStatus = checkoutHelper.placeOrder(order, fraudDetectionStatus);

    if (orderPlacementStatus.error) {
        return next(new Error('Could not place order'));
    }

    var applePayInstruments = order.getPaymentInstruments(PaymentInstrument.METHOD_DW_APPLE_PAY);
    if (!applePayInstruments.empty) {
        var applePayInstrument = applePayInstruments[0];
        var applePayPt = applePayInstrument.getPaymentTransaction();
        Transaction.wrap(function () {
            order.addNote(
                jpmcConstants.NOTE_SUBJECT_APPLEPAY_PAYMENT,
                'Transaction ID: ' + (applePayPt.getTransactionID() || '') +
                '\nCapture Method: ' + (applePayPt.custom.jpmcCaptureMethod || '') +
                '\nAmount: ' + applePayPt.amount.value +
                ' ' + order.getCurrencyCode()
            );
        });
    }

  
    if (order.getCustomerEmail()) {
        checkoutHelper.sendConfirmationEmail(order, req.locale.id);
    }

   
    req.session.privacyCache.set('usingMultiShipping', false);

   
    var config = {
        numberOfLineItems: '*'
    };
    var orderModel = new OrderModel(order, { config: config });
    
    // Inject checkout mode for conditional template rendering (DROP_IN vs Direct API)
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    var checkoutMode = JPMCMerchantResolver.getCheckoutMode();
    
    if (!req.currentCustomer.profile) {
        var passwordForm = server.forms.getForm('newPasswords');
        passwordForm.clear();
        res.render('checkout/confirmation/confirmation', {
            order: orderModel,
            returningCustomer: false,
            passwordForm: passwordForm,
            jpmcCheckoutMode: checkoutMode
        });
    } else {
        res.render('checkout/confirmation/confirmation', {
            order: orderModel,
            returningCustomer: true,
            jpmcCheckoutMode: checkoutMode
        });
    }

    return next();
});

module.exports = server.exports();
