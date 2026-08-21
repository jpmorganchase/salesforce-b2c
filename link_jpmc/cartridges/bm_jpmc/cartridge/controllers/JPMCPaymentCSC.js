'use strict';

var ISML = require('dw/template/ISML');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var PaymentTransaction = require('dw/order/PaymentTransaction');
var csrfProtection = require('dw/web/CSRFProtection');
var Logger = require('dw/system/Logger').getLogger('JPMC', 'jpmc_payment_csc');

var CSCHelper = require('~/cartridge/scripts/helpers/CSCPaymentHelpers');

var PAYMENT_STATUS = CSCHelper.PAYMENT_STATUS;
var PAYMENT_STATUS_LABELS = CSCHelper.PAYMENT_STATUS_LABELS;
var AMOUNT_REGEX = CSCHelper.AMOUNT_REGEX;
var DELAYED_CAPTURE_WINDOW_MINUTES = CSCHelper.DELAYED_CAPTURE_WINDOW_MINUTES;

/**
 * @returns {Object} csrf block
 */
function buildCsrfBlock() {
    return {
        tokenName: csrfProtection.getTokenName(),
        token: csrfProtection.generateToken()
    };
}

/**
 * @param {Object} viewData - template view data
 */
function renderOrder(viewData) {
    viewData.csrf = buildCsrfBlock();
    ISML.renderTemplate('csc/order', viewData);
}

/**
 * @param {dw.order.Order} order - order to update
 * @param {number} status - order status constant
 */
function setOrderStatus(order, status) {
    if (!order || typeof status !== 'number') {
        return;
    }

    try {
        order.setStatus(status);
    } catch (e) {
        Logger.warn('setOrderStatus: unable to set order {0} to status {1}: {2}',
            order.orderNo,
            status,
            String(e));
    }
}

/**
 * @param {string|null} amountParam - amount string from request parameter
 * @param {number} fallback - fallback amount
 * @returns {Object} parsed amount result
 */
function validateAndParseAmount(amountParam, fallback) {
    if (!amountParam) return { amount: fallback, error: null };
    if (!AMOUNT_REGEX.test(amountParam)) {
        return { amount: null, error: Resource.msg('csc.error.amount.format', 'jpmcbm', null) };
    }
    var parsed = parseFloat(amountParam);
    if (!parsed || parsed <= 0) {
        return { amount: null, error: Resource.msg('csc.error.amount.positive', 'jpmcbm', null) };
    }
    return { amount: parsed, error: null };
}

/**
 * @param {dw.order.PaymentTransaction} paymentTransaction - order payment transaction
 * @param {number} authorizedAmount - total authorized amount in cents
 * @param {number} capturedAmount - total captured amount in cents
 * @param {number} refundedAmount - total refunded amount in cents
 * @returns {Object} payment status details
 */
function derivePaymentStatus(paymentTransaction, authorizedAmount, capturedAmount, refundedAmount) {
    var custom = paymentTransaction.custom;
    var remainingAuthAmount = Math.max(authorizedAmount - capturedAmount, 0);

    var remainingRefundableAmount = Math.max(capturedAmount - refundedAmount, 0);

    if (custom && custom.jpmcRemainingAuthAmount !== null && custom.jpmcRemainingAuthAmount !== undefined
        && !isNaN(Number(custom.jpmcRemainingAuthAmount))) {
        remainingAuthAmount = Math.max(Number(custom.jpmcRemainingAuthAmount), 0);
    }

    if (custom && custom.jpmcRemainingRefundableAmount !== null && custom.jpmcRemainingRefundableAmount !== undefined
        && !isNaN(Number(custom.jpmcRemainingRefundableAmount))) {
        remainingRefundableAmount = Math.max(Number(custom.jpmcRemainingRefundableAmount), 0);
    }

    var paymentStatus = custom.jpmcPaymentStatus;

    if (!paymentStatus) {
        if (refundedAmount > 0 && refundedAmount >= capturedAmount) {
            paymentStatus = PAYMENT_STATUS.REFUNDED;
        } else if (refundedAmount > 0) {
            paymentStatus = PAYMENT_STATUS.PARTIAL_REFUNDED;
        } else if (capturedAmount > 0 && capturedAmount >= authorizedAmount) {
            paymentStatus = PAYMENT_STATUS.CAPTURED;
        } else if (capturedAmount > 0) {
            paymentStatus = PAYMENT_STATUS.PARTIAL_CAPTURED;
        } else if (authorizedAmount > 0) {
            var txType = paymentTransaction.type ? paymentTransaction.type.value : null;
            if (txType === PaymentTransaction.TYPE_CAPTURE) {
                paymentStatus = PAYMENT_STATUS.AUTH_AND_CAPTURE;
                if (capturedAmount === 0) {
                    capturedAmount = authorizedAmount;
                    remainingAuthAmount = 0;
                    remainingRefundableAmount = authorizedAmount;
                }
            } else {
                paymentStatus = PAYMENT_STATUS.AUTHORIZED;
            }
        } else {
            paymentStatus = PAYMENT_STATUS.AUTHORIZED;
        }
    }

    if (PAYMENT_STATUS && (paymentStatus === PAYMENT_STATUS.VOIDED || paymentStatus === PAYMENT_STATUS.PARTIAL_VOID)) {
        remainingAuthAmount = 0;
    }

    return {
        paymentStatus: paymentStatus,
        capturedAmount: capturedAmount,
        remainingAuthAmount: remainingAuthAmount,
        remainingRefundableAmount: remainingRefundableAmount
    };
}

/**
 * @param {Array} captureHistory - list of capture records
 * @param {Array} refundHistory - list of refund records
 */
function enrichCaptureHistory(captureHistory, refundHistory) {
    if (!captureHistory.length || !refundHistory) return;

    var refundedPerCapture = {};
    for (var ri = 0; ri < refundHistory.length; ri++) {
        var rh = refundHistory[ri];
        if (rh.captureId) {
            refundedPerCapture[rh.captureId] = (refundedPerCapture[rh.captureId] || 0) + (rh.amount || 0);
        }
    }

    for (var ci = 0; ci < captureHistory.length; ci++) {
        var cap = captureHistory[ci];
        var capCents = cap.amount || 0;
        var refCents = refundedPerCapture[cap.transactionId] || 0;
        var remainCents = Math.max(capCents - refCents, 0);
        cap.refundedCents = refCents;
        cap.remainingRefundableCents = remainCents;
        cap.remainingRefundableDollars = remainCents / 100;
    }
}

/**
 * @param {dw.order.Order} order - order to query
 * @returns {Object} payment details for CSC display
 */
function getOrderPaymentDetails(order) {
    var instruments = order.getPaymentInstruments();
    var paymentInstrument = null;
    for (var i = 0; i < instruments.length; i++) {
        if (CSCHelper.isSupportedPaymentMethod(instruments[i].paymentMethod)) {
            paymentInstrument = instruments[i];
            break;
        }
    }

    if (!paymentInstrument) {
        return { found: false, errorMessage: Resource.msg('csc.error.no.jpmc.instrument', 'jpmcbm', null) };
    }

    var paymentTransaction = paymentInstrument.getPaymentTransaction();
    var custom = paymentTransaction.custom;
    var authorizedAmount = paymentTransaction.amount.value;
    var capturedAmount = custom.jpmcCapturedAmount || 0;
    var refundedAmount = custom.jpmcRefundedAmount || 0;
    var captureMethodValue = custom.jpmcCaptureMethod || null;

    var derived = derivePaymentStatus(paymentTransaction, authorizedAmount, capturedAmount, refundedAmount);
    var paymentStatus = derived.paymentStatus;
    capturedAmount = derived.capturedAmount;
    var remainingAuthAmount = derived.remainingAuthAmount;
    var remainingRefundableAmount = derived.remainingRefundableAmount;

    var delayedAutoCapture = false;

    if (captureMethodValue === 'NOW' && authorizedAmount > 0 && capturedAmount <= 0) {
        capturedAmount = authorizedAmount;
        remainingAuthAmount = 0;
        remainingRefundableAmount = Math.max(authorizedAmount - refundedAmount, 0);
        if (paymentStatus === PAYMENT_STATUS.AUTHORIZED) {
            paymentStatus = PAYMENT_STATUS.AUTH_AND_CAPTURE;
        }
    }

    if (captureMethodValue === 'DELAYED'
        && paymentStatus === PAYMENT_STATUS.AUTHORIZED
        && !CSCHelper.isWithinDelayedCaptureWindow(custom.jpmcAuthTimestamp)) {
        delayedAutoCapture = true;
        capturedAmount = authorizedAmount;
        remainingAuthAmount = 0;
        remainingRefundableAmount = Math.max(authorizedAmount - refundedAmount, 0);
    }

    var authorizationId = custom.jpmcAuthorizationId
        || (paymentInstrument.custom && paymentInstrument.custom.jpmcTransactionId)
        || paymentTransaction.transactionID
        || null;

    if (!authorizationId || (authorizationId ==='Awaiting Transaction Id')) {
        return {
            found: false,
            errorMessage: Resource.msg('csc.error.transaction.id.missing', 'jpmcbm', null)
        };
    }

    var captureHistory = CSCHelper.getCaptureHistory(paymentTransaction);
    var refundHistory = CSCHelper.getRefundHistory(paymentTransaction);
    var voidHistory = CSCHelper.getVoidHistory(paymentTransaction);

    enrichCaptureHistory(captureHistory, refundHistory);

    return {
        found: true,
        paymentInstrument: paymentInstrument,
        paymentTransaction: paymentTransaction,
        paymentMethod: CSCHelper.getPaymentMethodName(paymentInstrument.paymentMethod),
        paymentStatus: paymentStatus,
        captureMethod: captureMethodValue,
        authTimestamp: custom.jpmcAuthTimestamp || null,
        delayedAutoCapture: delayedAutoCapture,
        transactionId: paymentTransaction.transactionID,
        jpmcTransactionId: authorizationId,
        captureHistory: captureHistory,
        refundHistory: refundHistory,
        voidHistory: voidHistory,
        amounts: {
            authorized: authorizedAmount,
            captured: capturedAmount,
            refunded: refundedAmount,
            total: authorizedAmount,
            remainingAuth: remainingAuthAmount,
            remainingRefundable: remainingRefundableAmount,
            currency: order.getCurrencyCode()
        }
    };
}

/**
 * @param {dw.order.Order} order - order to capture
 * @param {Object} paymentDetails - payment details
 * @param {Object} params - request params
 * @returns {Object} capture result
 */
function handleCapture(order, paymentDetails, params) {
    var JPMCPaymentHelper = require('*/cartridge/scripts/helpers/JPMCPaymentHelper');
    var error = { isError: false, message: '' };

    var captureEligibility = CSCHelper.canCapture(paymentDetails);
    if (!captureEligibility.allowed) {
        return {
            error: { isError: true, message: captureEligibility.reason || Resource.msg('csc.error.capture.notmanual', 'jpmcbm', null) },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    var parsed = validateAndParseAmount(params.amountParam, paymentDetails.amounts.remainingAuth);
    if (parsed.error) {
        return {
            error: { isError: true, message: parsed.error },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    var captureAmount = parsed.amount || 0;
    if (captureAmount > paymentDetails.amounts.remainingAuth) {
        return {
            error: {
                isError: true,
                message: Resource.msgf('csc.error.capture.exceeds', 'jpmcbm', null,
                    captureAmount.toFixed(2), paymentDetails.amounts.remainingAuth.toFixed(2))
            },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    var existingCaptures = paymentDetails.captureHistory || [];
    var isFinalCapture = captureAmount >= paymentDetails.amounts.remainingAuth || params.finalCaptureParam === 'true';

    var captureResult = JPMCPaymentHelper.capturePayment(order, {
        amount: captureAmount,
        isFinal: isFinalCapture,
        multiCapture: { sequenceNumber: existingCaptures.length + 1, isFinal: isFinalCapture },
        resolvedConfig: params.resolvedConfig
    });

    if (!captureResult.success) {
        return {
            error: { isError: true, message: Resource.msg('csc.error.capture.failed', 'jpmcbm', null) },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    Transaction.wrap(function () {
        var txCustom = paymentDetails.paymentInstrument.paymentTransaction.custom;
        txCustom.jpmcPaymentStatus = isFinalCapture ? PAYMENT_STATUS.CAPTURED : PAYMENT_STATUS.PARTIAL_CAPTURED;
        if (isFinalCapture) txCustom.jpmcRemainingAuthAmount = 0;
        if (isFinalCapture) {
            setOrderStatus(order, Order.ORDER_STATUS_COMPLETED);
        } else {
            setOrderStatus(order, Order.ORDER_STATUS_OPEN);
        }
    });

    return {
        error: error,
        successMessage: Resource.msgf('csc.success.capture', 'jpmcbm', null, captureAmount.toFixed(2)),
        paymentDetails: getOrderPaymentDetails(order)
    };
}

/**
 * @param {dw.order.Order} order - order to refund
 * @param {Object} paymentDetails - payment details
 * @param {Object} params - request params
 * @returns {Object} refund result
 */
function handleRefund(order, paymentDetails, params) {
    var JPMCPaymentHelper = require('*/cartridge/scripts/helpers/JPMCPaymentHelper');
    var error = { isError: false, message: '' };

    var refundEligibility = CSCHelper.canRefund(paymentDetails);
    if (!refundEligibility.allowed) {
        return {
            error: { isError: true, message: refundEligibility.reason || Resource.msg('csc.info.refund.nothing', 'jpmcbm', null) },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    if (refundEligibility.delayedAutoCapture) {
        try {
            Transaction.wrap(function () {
                var txCustom = paymentDetails.paymentInstrument.paymentTransaction.custom;
                txCustom.jpmcCapturedAmount = paymentDetails.amounts.authorized;
                txCustom.jpmcRemainingAuthAmount = 0;
                txCustom.jpmcPaymentStatus = PAYMENT_STATUS.CAPTURED;
            });
            paymentDetails = getOrderPaymentDetails(order);
        } catch (syncErr) {
            return {
                error: { isError: true, message: Resource.msg('csc.error.sync.auto.capture', 'jpmcbm', null) },
                successMessage: null,
                paymentDetails: paymentDetails
            };
        }
    }

    var effectiveMax = paymentDetails.amounts.remainingRefundable;
    if (params.refundCaptureId && paymentDetails.captureHistory) {
        var targetCapture = null;
        for (var ci = 0; ci < paymentDetails.captureHistory.length; ci++) {
            if (paymentDetails.captureHistory[ci].transactionId === params.refundCaptureId) {
                targetCapture = paymentDetails.captureHistory[ci];
                break;
            }
        }
        if (!targetCapture) {
            return {
                error: {
                    isError: true,
                    message: Resource.msg('csc.error.capture.id.not.found', 'jpmcbm', null) + ': ' + params.refundCaptureId
                },
                successMessage: null,
                paymentDetails: paymentDetails
            };
        }
        var perCaptureMax = targetCapture.remainingRefundableDollars || 0;
        if (perCaptureMax <= 0) {
            return {
                error: { isError: true, message: Resource.msg('csc.info.refund.nothing', 'jpmcbm', null) },
                successMessage: null,
                paymentDetails: paymentDetails
            };
        }
        effectiveMax = perCaptureMax;
    }

    var isFullRefund = params.refundFullParam === 'true';
    if (!isFullRefund && (!params.amountParam || !String(params.amountParam).trim())) {
        return {
            error: {
                isError: true,
                message: Resource.msg('csc.error.amount.format', 'jpmcbm', null)
            },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    var parsed = validateAndParseAmount(isFullRefund ? null : params.amountParam, effectiveMax);
    if (parsed.error) {
        return {
            error: { isError: true, message: parsed.error },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    var refundAmount = parsed.amount || 0;
    if (refundAmount > effectiveMax + 0.001) {
        return {
            error: {
                isError: true,
                message: Resource.msgf('csc.error.refund.exceeds', 'jpmcbm', null,
                    refundAmount.toFixed(2), effectiveMax.toFixed(2))
            },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    var refundOpts = { amount: refundAmount };
    if (params.refundCaptureId) refundOpts.captureId = params.refundCaptureId;
    if (params.resolvedConfig) refundOpts.resolvedConfig = params.resolvedConfig;

    var refundResult = JPMCPaymentHelper.refundPayment(order, refundOpts);
    if (!refundResult.success) {
        return {
            error: {
                isError: true,
                message: refundResult.error || Resource.msg('csc.error.refund.failed', 'jpmcbm', null)
            },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    Transaction.wrap(function () {
        var txCustom = paymentDetails.paymentInstrument.paymentTransaction.custom;
        txCustom.jpmcPaymentStatus = refundAmount >= paymentDetails.amounts.remainingRefundable
            ? PAYMENT_STATUS.REFUNDED
            : PAYMENT_STATUS.PARTIAL_REFUNDED;
        setOrderStatus(order, Order.ORDER_STATUS_COMPLETED);
    });

    return {
        error: error,
        successMessage: Resource.msgf('csc.success.refund', 'jpmcbm', null, refundAmount.toFixed(2)),
        paymentDetails: getOrderPaymentDetails(order)
    };
}

/**
 * @param {dw.order.Order} order - order to void
 * @param {Object} paymentDetails - payment details
 * @param {Object} params - request params
 * @returns {Object} void result
 */
function handleVoid(order, paymentDetails, params) {
    var JPMCPaymentHelper = require('*/cartridge/scripts/helpers/JPMCPaymentHelper');

    var voidEligibility = CSCHelper.canVoid(paymentDetails);
    if (!voidEligibility.allowed) {
        return {
            error: { isError: true, message: voidEligibility.reason || Resource.msg('csc.error.void.notallowed', 'jpmcbm', null) },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    var voidResult = JPMCPaymentHelper.voidPayment(order, { resolvedConfig: params ? params.resolvedConfig : undefined });
    if (!voidResult.success) {
        return {
            error: { isError: true, message: Resource.msg('csc.error.void.failed', 'jpmcbm', null) },
            successMessage: null,
            paymentDetails: paymentDetails
        };
    }

    var hadCaptures = paymentDetails.amounts.captured > 0;
    var voidedAmount = paymentDetails.amounts.remainingAuth;

    Transaction.wrap(function () {
        var txCustom = paymentDetails.paymentInstrument.paymentTransaction.custom;
        txCustom.jpmcPaymentStatus = hadCaptures ? PAYMENT_STATUS.PARTIAL_VOID : PAYMENT_STATUS.VOIDED;
        txCustom.jpmcRemainingAuthAmount = 0;
        if (!hadCaptures) {
            setOrderStatus(order, Order.ORDER_STATUS_CANCELLED);
        } else {
            setOrderStatus(order, Order.ORDER_STATUS_COMPLETED);
        }

        var existingVoidHistory = [];
        if (txCustom.jpmcVoidHistory) {
            try { existingVoidHistory = JSON.parse(txCustom.jpmcVoidHistory); } catch (parseErr) {
                // Ignore parse errors, treat as empty history
            }
        }
        existingVoidHistory.push({
            amount: voidedAmount,
            amountDisplay: voidedAmount.toFixed(2),
            currency: paymentDetails.amounts.currency,
            timestamp: new Date().toISOString(),
            status: 'SUCCESS',
            type: hadCaptures ? 'PARTIAL_VOID' : 'FULL_VOID',
            userId: session.userName || 'System'
        });
        txCustom.jpmcVoidHistory = JSON.stringify(existingVoidHistory);
    });

    return {
        error: { isError: false, message: '' },
        successMessage: Resource.msg('csc.success.void', 'jpmcbm', null),
        paymentDetails: getOrderPaymentDetails(order)
    };
}

/**
 * Exports getOrderPaymentDetails helper for external use
 */
exports.getOrderPaymentDetails = getOrderPaymentDetails;

/**
 * JPMCPaymentCSC-ManagePayment : Business Manager customer service center for managing JPMC payment transactions
 * @name JPMCPaymentCSC-ManagePayment
 * @function
 * @memberof JPMCPaymentCSC
 * @param {querystringparameter} orderNo - Order number to manage
 * @param {querystringparameter} action - Action to perform (capture, refund, void)
 */
exports.ManagePayment = function () {
    var orderId = request.httpParameterMap.orderNo.stringValue || '';
    var captureAction = request.httpParameterMap.capture.stringValue || null;
    var refundAction = request.httpParameterMap.refund.stringValue || null;
    var voidAction = request.httpParameterMap.voidAuth.stringValue || null;
    var amountParam = request.httpParameterMap.amountIntroduced.stringValue || null;
    var finalCaptureParam = request.httpParameterMap.isFinalCapture.stringValue || null;
    var refundFullParam = request.httpParameterMap.isFullRefund.stringValue || null;
    var refundCaptureId = request.httpParameterMap.refundCaptureId.stringValue || null;

    // Mutating actions (capture/refund/void) are picked from request parameters
    // regardless of HTTP method, so the CSRF guard must apply to them
    // unconditionally. Require a POST with a valid CSRF token whenever a mutating
    // action is requested; a GET carrying an action param must never be honoured.
    var isMutating = !!(captureAction || refundAction || voidAction);
    if (isMutating && (request.httpMethod !== 'POST' || !csrfProtection.validateRequest())) {
        ISML.renderTemplate('csrfFail');
        return; // eslint-disable-line consistent-return
    }

    var error = { isError: false, message: '' };
    var successMessage = null;

    if (!orderId) {
        error.isError = true;
        error.message = Resource.msg('error.order.notfound', 'jpmcbm', null);
        renderOrder({ error: error, orderId: orderId });
        return; // eslint-disable-line consistent-return
    }

    var order = OrderMgr.getOrder(orderId);
    if (!order) {
        error.isError = true;
        error.message = Resource.msg('error.order.notfound', 'jpmcbm', null);
        renderOrder({ error: error, orderId: orderId });
        return; // eslint-disable-line consistent-return
    }

    var paymentDetails = getOrderPaymentDetails(order);
    if (!paymentDetails.found) {
        error.isError = true;
        error.message = paymentDetails.errorMessage;
        renderOrder({ error: error, orderId: orderId, order: order });
        return; // eslint-disable-line consistent-return
    }

    try {
        var result;
        var params = {
            amountParam: amountParam,
            finalCaptureParam: finalCaptureParam,
            refundFullParam: refundFullParam,
            refundCaptureId: refundCaptureId
        };

        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = JPMCMerchantResolver.resolveForOrder(order);
        params.resolvedConfig = resolvedConfig;

        if (captureAction) {
            result = handleCapture(order, paymentDetails, params);
        } else if (refundAction) {
            result = handleRefund(order, paymentDetails, params);
        } else if (voidAction) {
            result = handleVoid(order, paymentDetails, params);
        }

        if (result) {
            error = result.error;
            successMessage = result.successMessage;
            paymentDetails = result.paymentDetails;
        }
    } catch (e) {
        error.isError = true;
        error.message = Resource.msg('csc.error.unexpected', 'jpmcbm', null);
    }

    var delayedWindowRemaining = 0;
    if (paymentDetails && paymentDetails.captureMethod === 'DELAYED' && paymentDetails.authTimestamp) {
        delayedWindowRemaining = CSCHelper.delayedWindowMinutesRemaining(paymentDetails.authTimestamp);
    }

    renderOrder({
        error: error,
        successMessage: successMessage,
        orderId: orderId,
        order: order,
        paymentDetails: paymentDetails,
        PAYMENT_STATUS: PAYMENT_STATUS,
        PAYMENT_STATUS_LABELS: PAYMENT_STATUS_LABELS,
        captureInfo: paymentDetails ? CSCHelper.canCapture(paymentDetails) : { allowed: false, reason: null },
        voidInfo: paymentDetails ? CSCHelper.canVoid(paymentDetails) : { allowed: false, reason: null },
        refundInfo: paymentDetails ? CSCHelper.canRefund(paymentDetails) : { allowed: false, reason: null },
        delayedWindowRemaining: delayedWindowRemaining,
        delayedWindowMinutes: DELAYED_CAPTURE_WINDOW_MINUTES
    });
};
exports.ManagePayment.public = true;
