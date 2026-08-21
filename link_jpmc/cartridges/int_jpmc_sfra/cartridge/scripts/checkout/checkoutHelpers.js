'use strict';

var Transaction = require('dw/system/Transaction');

var baseCheckoutHelpers = module.superModule
    || require('*/cartridge/scripts/checkout/checkoutHelpers');

/**
 * Saves a payment instrument to the customer's wallet.
 *
 * @param {Object} billingData - billing form data with card info
 * @param {dw.order.Basket} currentBasket - active basket
 * @param {dw.customer.Customer} customer - logged-in customer
 * @returns {dw.customer.CustomerPaymentInstrument} saved payment instrument
 */
baseCheckoutHelpers.savePaymentInstrumentToWallet = function savePaymentInstrumentToWallet(
    billingData,
    currentBasket,
    customer
) {
    var PaymentInstrument = require('dw/order/PaymentInstrument');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    var wallet = customer.getProfile().getWallet();

    return Transaction.wrap(function () {
        var verifiedCardToken = session.privacy.jpmcCardSafeTechToken;
        var paymentInfo = billingData.paymentInformation;

        var storedPaymentInstrument = wallet.createPaymentInstrument(
            PaymentInstrument.METHOD_CREDIT_CARD
        );

        storedPaymentInstrument.setCreditCardHolder(currentBasket.getBillingAddress().fullName);
        storedPaymentInstrument.setCreditCardNumber(paymentInfo.cardNumber.value);
        storedPaymentInstrument.setCreditCardType(paymentInfo.cardType.value);
        storedPaymentInstrument.setCreditCardExpirationMonth(paymentInfo.expirationMonth.value);
        storedPaymentInstrument.setCreditCardExpirationYear(paymentInfo.expirationYear.value);
        storedPaymentInstrument.setCreditCardToken(verifiedCardToken);

        var resolvedConfig = JPMCMerchantResolver.resolve();
        if (resolvedConfig.merchantId) {
            storedPaymentInstrument.custom.jpmcMerchantId = resolvedConfig.merchantId;
        }

        delete session.privacy.jpmcCardSafeTechToken;
        return storedPaymentInstrument;
    });
};

/**
 * Extended handlePayments to pass through 3DS authentication data
 * @param {dw.order.Order} order - placed order
 * @param {string} orderNumber - order number
 * @returns {Object} payment handling result
 */
baseCheckoutHelpers.handlePayments = function (order, orderNumber) {
    var OrderMgr = require('dw/order/OrderMgr');
    var PaymentMgr = require('dw/order/PaymentMgr');
    var HookMgr = require('dw/system/HookMgr');
    var result = {};

    if (order.totalNetPrice !== 0.00) {
        var paymentInstruments = order.paymentInstruments;

        if (paymentInstruments.length === 0) {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            result.error = true;
        }

        if (!result.error) {
            for (var i = 0; i < paymentInstruments.length; i++) {
                var paymentInstrument = paymentInstruments[i];
                var paymentProcessor = PaymentMgr
                    .getPaymentMethod(paymentInstrument.paymentMethod)
                    .paymentProcessor;
                var authorizationResult;
                
                if (paymentProcessor === null) {
                    Transaction.wrap(function () {
                        paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
                    });
                } else {
                    if (HookMgr.hasHook('app.payment.processor.' + paymentProcessor.ID.toLowerCase())) {
                        authorizationResult = HookMgr.callHook(
                            'app.payment.processor.' + paymentProcessor.ID.toLowerCase(),
                            'Authorize',
                            orderNumber,
                            paymentInstrument,
                            paymentProcessor
                        );
                    } else {
                        authorizationResult = HookMgr.callHook(
                            'app.payment.processor.default',
                            'Authorize'
                        );
                    }

                    if (authorizationResult.error) {
                        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
                        result.error = true;
                        break;
                    }
                    
                    // ========== JPMC 3DS INTEGRATION ==========
                    // Pass through 3DS orchestration data if present
                    if (authorizationResult.requires3DS) {
                        result.requires3DS = authorizationResult.requires3DS;
                        result.authenticationOrchestrationUrl = authorizationResult.authenticationOrchestrationUrl;
                        result.transactionId = authorizationResult.transactionId;
                        result.captureMethod = authorizationResult.captureMethod;
                        
                        // Store orchestration URL in session for controller access
                        session.privacy.jpmc3DSOrchestrationUrl = authorizationResult.authenticationOrchestrationUrl;
                        
                        // Return immediately - don't continue processing
                        return result;
                    }
                    // ========== END 3DS INTEGRATION ==========
                }
            }
        }
    }

    return result;
};

module.exports = baseCheckoutHelpers;
