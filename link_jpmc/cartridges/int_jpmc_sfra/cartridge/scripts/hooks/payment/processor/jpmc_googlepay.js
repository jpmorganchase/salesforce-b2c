'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'jpmc_googlepay');
var PaymentMgr = require('dw/order/PaymentMgr');
var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');

/**
 * @param {Object} req - current request object
 * @param {Object} paymentForm - billing payment form
 * @param {Object} viewFormData - view data to extend
 * @returns {Object} processed form result
 */
function processForm(req, paymentForm, viewFormData) {
    var viewData = viewFormData;

    viewData.paymentMethod = {
        value: 'JPMC_GOOGLE_PAY',
        htmlName: 'JPMC_GOOGLE_PAY'
    };
    var googlePayToken = session.privacy.jpmcGooglePayToken;
    if (!googlePayToken) {
        Logger.error('processForm: Google Pay token missing from session');
        return {
            fieldErrors: {},
            serverErrors: [Resource.msg('error.technical', 'checkout', null)],
            error: true
        };
    }

    viewData.paymentInformation = {
        googlePayToken: { value: googlePayToken }
    };

    return { error: false, viewData: viewData };
}

/**
 * @param {dw.order.Basket} basket - current basket
 * @param {Object} paymentInformation - billing form payment data
 * @param {string} paymentMethodID - payment method identifier
 * @param {Object} req - request object (unused)
 * @returns {Object} result
 */
function Handle(basket, paymentInformation, paymentMethodID, req) { // eslint-disable-line no-unused-vars
    var collections = require('*/cartridge/scripts/util/collections');
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var serverErrors = [];

    var googlePayTokenStr = paymentInformation.googlePayToken && paymentInformation.googlePayToken.value;
    if (!googlePayTokenStr) {
        Logger.error('Handle: Google Pay token missing');
        serverErrors.push(Resource.msg('error.technical', 'checkout', null));
        return { fieldErrors: [], serverErrors: serverErrors, error: true };
    }
    try {
        var parsed = JSON.parse(googlePayTokenStr);
        if (!parsed.signedMessage || !parsed.protocolVersion) {
            Logger.error('Handle: Invalid token structure - missing signedMessage or protocolVersion');
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            return { fieldErrors: [], serverErrors: serverErrors, error: true };
        }

        var hasSignature = parsed.signature
            || (parsed.intermediateSigningKey
                && parsed.intermediateSigningKey.signatures
                && parsed.intermediateSigningKey.signatures.length > 0);
        if (!hasSignature) {
            Logger.error('Handle: Invalid token structure - no signature found');
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            return { fieldErrors: [], serverErrors: serverErrors, error: true };
        }
    } catch (e) {
        Logger.error('Handle: Failed to parse Google Pay token: {0}', e instanceof Error ? e.message : String(e));
        serverErrors.push(Resource.msg('error.technical', 'checkout', null));
        return { fieldErrors: [], serverErrors: serverErrors, error: true };
    }
    var gpayMethod = PaymentMgr.getPaymentMethod(jpmcConstants.JPMC_GOOGLE_PAY);
    if (!gpayMethod || !gpayMethod.isActive()) {
        Logger.error('Handle: Google Pay payment method not active');
        serverErrors.push(Resource.msg('error.technical', 'checkout', null));
        return { fieldErrors: [], serverErrors: serverErrors, error: true };
    }
    Transaction.wrap(function () {
        var existingGPay = basket.getPaymentInstruments(jpmcConstants.JPMC_GOOGLE_PAY);
        collections.forEach(existingGPay, function (item) {
            basket.removePaymentInstrument(item);
        });

        var existingCC = basket.getPaymentInstruments('CREDIT_CARD');
        collections.forEach(existingCC, function (item) {
            basket.removePaymentInstrument(item);
        });

        var paymentInstrument = basket.createPaymentInstrument(
            jpmcConstants.JPMC_GOOGLE_PAY,
            basket.totalGrossPrice
        );

        paymentInstrument.custom.jpmcWalletProvider = jpmcConstants.GOOGLE_PAY_WALLET_PROVIDER;

        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = JPMCMerchantResolver.resolve();
        if (resolvedConfig && resolvedConfig.merchantId) {
            paymentInstrument.custom.jpmcMerchantId = resolvedConfig.merchantId;
        }
    });

    // Token stays in session.privacy (memory-only, never persisted to DB).
    // authorizeGooglePay() reads it from there and clears it in its finally block.

    return { fieldErrors: {}, serverErrors: [], error: false };
}

/**
 * @param {string} orderNumber - order number to authorize
 * @param {dw.order.PaymentInstrument} paymentInstrument - Google Pay payment instrument
 * @param {dw.order.PaymentProcessor} paymentProcessor - JPMC payment processor
 * @returns {Object} authorization result
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var serverErrors = [];
    var fieldErrors = {};

    try {
        if (!paymentProcessor || !paymentProcessor.getID().equalsIgnoreCase(jpmcConstants.JPMC_Processor)) {
            Logger.error('Authorize: Unsupported payment processor');
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: true };
        }

        var jpmcTransactionHelpers = require('*/cartridge/scripts/helpers/JPMCTransactionHelpers');
        var authResult = jpmcTransactionHelpers.authorizeGooglePay(orderNumber, paymentInstrument, paymentProcessor);

        if (authResult.error) {
            return { fieldErrors: fieldErrors, serverErrors: [Resource.msg('error.technical', 'checkout', null)], error: true };
        }

        return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: false };
    } catch (e) {
        Logger.error('Authorize: {0}', e instanceof Error ? e.message : String(e));
        serverErrors.push(Resource.msg('error.technical', 'checkout', null));
        return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: true };
    }
}

exports.processForm = processForm;
exports.Handle = Handle;
exports.Authorize = Authorize;
