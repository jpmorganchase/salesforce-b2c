/**
 * JPMC Payment Helper — create, capture, and refund operations.
 * @module scripts/helpers/JPMCPaymentHelper
 */

'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'payment');
var Transaction = require('dw/system/Transaction');
var PaymentTransaction = require('dw/order/PaymentTransaction');
var UUID = require('dw/util/UUIDUtils');
var jpmcTransactionHelpers = require('*/cartridge/scripts/helpers/JPMCTransactionHelpers');

/**
 * Creates a payment (Authorization or Sale).
 * @param {dw.order.Basket|dw.order.Order} order - basket or order to authorize
 * @param {Object} options - payment options (captureMethod, authentication, etc.)
 * @returns {Object} payment creation result
 */
function createPayment(order, options) {
    var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCPayloadBuilder = require('*/cartridge/scripts/helpers/JPMCPayloadBuilder');
    
    var result = {
        success: false,
        transactionId: null,
        paymentId: null,
        captureId: null,
        authorizationCode: null,
        transactionState: null,
        captureMethod: null,
        error: null,
        data: null
    };

    if (!order) {
        result.error = 'Order is not Present';
        Logger.error('createPayment: {0}', result.error);
        return result;
    }
    
    if (!options || !options.paymentInstrument) {
        result.error = 'Payment instrument is required';
        Logger.error('createPayment: {0}', result.error);
        return result;
    }
    
    try {
        var paymentInstrument = options.paymentInstrument;
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = options.resolvedConfig || JPMCMerchantResolver.resolve();
        var merchantId = resolvedConfig.merchantId;
        var captureMethod = options.captureMethod;
        result.captureMethod = captureMethod;
        
        var payload = JPMCPayloadBuilder.buildCreatePaymentPayload({
            order: order,
            paymentInstrument: paymentInstrument,
            captureMethod: captureMethod,
            initiatorType: options.initiatorType,
            accountOnFile: options.accountOnFile,
            isAmountFinal: options.isAmountFinal,
            accountNumberType: options.accountNumberType,
            IPAddress: options.IPAddress,
            resolvedConfig: resolvedConfig,
            requestAccountUpdater: options.requestAccountUpdater === true,
            authentication: options.authentication,
            walletProvider: options.walletProvider,
            paymentAuthenticationRequest: options.paymentAuthenticationRequest,
            browserInfo: options.browserInfo,
            recurring: options.recurring,
            merchantCategoryCode: options.merchantCategoryCode,
            requestFraudScore: options.requestFraudScore,
            transactionRiskScore: options.transactionRiskScore,
        });
        var requestId = UUID.createUUID().toString();

        var headers = {
            'merchant-id': merchantId,
            'request-id': requestId
        };
        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCPaymentService',
            method: 'POST',
            data: payload,
            headers: headers,
            resolvedConfig: resolvedConfig
        });
        
        if (serviceResult.success && serviceResult.data) {
            var paymentData = serviceResult.data;
            
            if (paymentData.responseCode === 'PERFORM_AUTHENTICATION') {
                var authResult = paymentData.paymentAuthenticationResult;
                Logger.debug(
                    'JPMC 3DS: Received PERFORM_AUTHENTICATION response. authenticationId: {0}, urlPresent: {1}',
                    authResult ? (authResult.authenticationId || 'unknown') : 'unknown',
                    !!(authResult && authResult.authenticationOrchestrationUrl)
                );
            }
            
            if (paymentData.responseStatus === 'SUCCESS') {
                
                Transaction.wrap(function () {
                    
                    if (order.getOrderNo) {
                        var paymentNote = 'JPMC Payment Created\n' +
                            'Transaction ID: ' + paymentData.transactionId + '\n' +
                            'Capture Method: ' + captureMethod + '\n' +
                            'Amount: $' + (payload.amount / 100).toFixed(2) + ' ' + payload.currency + '\n' +
                            'Transaction State: ' + paymentData.transactionState;
                        
                        if (paymentData.approvalCode) {
                            paymentNote += '\nApproval Code: ' + paymentData.approvalCode;
                        }
                        
                        order.addNote('JPMC Payment Created', paymentNote);
                    }
                });
                
                result.success = true;
                result.transactionId = paymentData.transactionId;
                result.paymentId = paymentData.paymentId || paymentData.transactionId;
                result.authorizationCode = paymentData.approvalCode;
                result.transactionState = paymentData.transactionState;
                result.captureId = paymentData.captureId;
                result.data = paymentData;
                
                Logger.info('createPayment: SUCCESS - TransactionID: {0}, State: {1}, CaptureMethod: {2}', 
                    paymentData.transactionId, paymentData.transactionState, captureMethod);
            } else {
                result.error = paymentData.responseMessage || 'Payment creation failed with status: ' + paymentData.responseStatus;
                result.data = paymentData;
                
                Logger.error('createPayment: FAILED - Status: {0}, Code: {1}, Message: {2}', 
                    paymentData.responseStatus, paymentData.responseCode, paymentData.responseMessage);
            }
        } else {
            result.error = serviceResult.error || 'Payment creation service call failed';
            Logger.error('createPayment: SERVICE ERROR - {0}', result.error);
        }
        
    } catch (e) {
        result.error = e.message || String(e);
        Logger.error('createPayment: EXCEPTION - {0}', result.error);
    }
    
    return result;
}

/**
 * Captures a payment for an order.
 * @param {dw.order.Order} order - order with authorized payment
 * @param {Object} options - capture options (amount, isFinal, multiCapture)
 * @returns {Object} capture result
 */
function capturePayment(order, options) {
    var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCPayloadBuilder = require('*/cartridge/scripts/helpers/JPMCPayloadBuilder');
    
    var result = {
        success: false,
        captureId: null,
        amount: null,
        error: null
    };
    
    if (!order) {
        result.error = 'Order is required';
        Logger.error('capturePayment: {0}', result.error);
        return result;
    }
    
    try {
        var paymentInstruments = order.getPaymentInstruments();
        if (paymentInstruments.length === 0) {
            result.error = 'No payment instruments found on order';
            Logger.error('capturePayment: Order {0} - {1}', order.orderNo, result.error);
            return result;
        }
        
        var paymentInstrument = paymentInstruments[0];
        var paymentTransaction = paymentInstrument.getPaymentTransaction();
        
        
        var jpmcTransactionId = jpmcTransactionHelpers.resolveJpmcTransactionId(paymentInstrument, paymentTransaction);
        
        if (!jpmcTransactionId) {
            result.error = 'JPMC transaction ID not found';
            Logger.error('capturePayment: Order {0} - {1}', order.orderNo, result.error);
            return result;
        }
        var captureAmount = options && options.amount 
            ? options.amount 
            : order.getTotalGrossPrice().getValue();
        
        var capturePayload = JPMCPayloadBuilder.buildCapturePayload({
            order: order,
            amount: captureAmount,
            isFinal: options && options.isFinal,
            multiCapture: options && options.multiCapture
        });
        
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = (options && options.resolvedConfig) || JPMCMerchantResolver.resolveForOrder(order);
        var merchantId = resolvedConfig.merchantId;
        
        if (!merchantId) {
            result.error = 'Merchant ID not configured';
            Logger.error('capturePayment: {0}', result.error);
            return result;
        }

        var captureAmountCents = capturePayload.amount;
        var captureSeq = (options && options.multiCapture && options.multiCapture.sequenceNumber) ? options.multiCapture.sequenceNumber : 1;
        var requestIdRaw = 'CAP-' + order.orderNo + '-' + captureAmountCents + '-' + captureSeq;
        var requestId = requestIdRaw.length > 40 ? requestIdRaw.substring(0, 40) : requestIdRaw;
        
        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCPaymentCapture',
            method: 'POST',
            data: capturePayload,
            headers: {
                'merchant-id': merchantId,
                'request-id': requestId
            },
            placeHolderId: jpmcTransactionId,
            resolvedConfig: resolvedConfig
        });
        
        
        if (serviceResult.success && serviceResult.data) {
            var captureData = serviceResult.data;
            
            if (captureData.responseStatus === 'SUCCESS' && captureData.transactionState === 'CLOSED') {

                var thisCaptureEntry = null;
                if (captureData.captures && captureData.captures.length > 0) {
                    thisCaptureEntry = captureData.captures[captureData.captures.length - 1];
                }

                var captureTransactionId = (thisCaptureEntry && thisCaptureEntry.captureId)
                    || captureData.transactionId;
                var captureTransactionState = (thisCaptureEntry && thisCaptureEntry.transactionStatusCode)
                    || captureData.transactionState;

                Transaction.wrap(function () {
                    paymentTransaction.setType(PaymentTransaction.TYPE_CAPTURE);
                    var captureAmountDollars = capturePayload.amount / 100;

                    if (paymentTransaction.custom) {

                        var previousCaptured = paymentTransaction.custom.jpmcCapturedAmount || 0;
                        paymentTransaction.custom.jpmcCapturedAmount = previousCaptured + captureAmountDollars;
                        
                        var captureHistoryEntry = {
                            transactionId: captureTransactionId,
                            amount: capturePayload.amount,
                            amountDisplay: captureAmountDollars.toFixed(2),
                            currency: order.getCurrencyCode(),
                            timestamp: new Date().toISOString(),
                            status: captureTransactionState,
                            userId: session.userName || 'System',
                            notes: 'Capture of $' + captureAmountDollars.toFixed(2) + ' ' + order.getCurrencyCode()
                        };
                        
                        var captureHistory = [];
                        if (paymentTransaction.custom.jpmcCaptureHistory) {
                            try {
                                captureHistory = JSON.parse(paymentTransaction.custom.jpmcCaptureHistory);
                            } catch (e) {
                                Logger.warn('Failed to parse existing jpmcCaptureHistory, starting fresh: {0}', e.message);
                            }
                        }
                        captureHistory.push(captureHistoryEntry);
                        paymentTransaction.custom.jpmcCaptureHistory = JSON.stringify(captureHistory);
                        
                        if (captureData.remainingAuthAmount !== undefined) {
                            paymentTransaction.custom.jpmcRemainingAuthAmount = captureData.remainingAuthAmount / 100;
                        }
                        var totalCapturedDollars = paymentTransaction.custom.jpmcCapturedAmount || 0;
                        var totalRefundedDollars = paymentTransaction.custom.jpmcRefundedAmount || 0;
                        paymentTransaction.custom.jpmcRemainingRefundableAmount = Math.max(totalCapturedDollars - totalRefundedDollars, 0);
                    }
                    
                    var totalGross = order.getTotalGrossPrice().getValue();
                    if (captureAmount >= totalGross || Math.abs(captureAmount - totalGross) < 0.01) {
                        order.setPaymentStatus(order.PAYMENT_STATUS_PAID);
                    } else {
                        order.setPaymentStatus(order.PAYMENT_STATUS_PARTPAID);
                    }
                    
                    var captureNote = 'JPMC Capture Successful\n' +
                        'Capture ID: ' + captureTransactionId + '\n' +
                        'Amount: $' + captureAmountDollars.toFixed(2) + ' ' + order.getCurrencyCode() + '\n' +
                        'Transaction State: ' + captureTransactionState;
                    
                    if (captureData.approvalCode) {
                        captureNote += '\nApproval Code: ' + captureData.approvalCode;
                    }
                    
                    order.addNote('JPMC Payment Captured', captureNote);
                });
                
                result.success = true;
                result.captureId = captureTransactionId;
                result.amount = captureAmount;
                result.data = captureData;
                
                Logger.info('capturePayment: SUCCESS - Order {0}, CaptureID: {1}, State: {2}', 
                    order.orderNo, captureTransactionId, captureTransactionState);
            } else {
                result.error = captureData.responseMessage || 'Capture failed with status: ' + captureData.responseStatus;
                result.data = captureData;
                
                Logger.error('capturePayment: FAILED - Order {0}, Status: {1}, Code: {2}, Message: {3}', 
                    order.orderNo, captureData.responseStatus, captureData.responseCode, captureData.responseMessage);
            }
        } else {
            result.error = serviceResult.error || 'Capture service call failed';
            Logger.error('capturePayment: SERVICE ERROR - Order {0}, Error: {1}', 
                order.orderNo, result.error);
        }
        
    } catch (e) {
        result.error = e.message || String(e);
        Logger.error('capturePayment: EXCEPTION - Order {0}, Error: {1}', 
            order.orderNo, result.error);
    }
    
    return result;
}

/**
 * Refunds a payment for an order.
 * @param {dw.order.Order} order - order with captured payment
 * @param {Object} options - refund options (amount, currency, reason)
 * @returns {Object} refund result
 */
function refundPayment(order, options) {
    var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCPayloadBuilder = require('*/cartridge/scripts/helpers/JPMCPayloadBuilder');
    
    var result = {
        success: false,
        refundId: null,
        amount: null,
        error: null
    };
    
    if (!order) {
        result.error = 'Order is required';
        Logger.error('refundPayment: {0}', result.error);
        return result;
    }
    if (options && options.amount !== undefined && options.amount !== null) {
        if (options.amount <= 0) {
            result.error = 'Refund amount must be greater than zero';
            Logger.error('refundPayment: Order {0} - {1}', order.orderNo, result.error);
            return result;
        }
    }
    
    try {
        var paymentInstruments = order.getPaymentInstruments();
        if (paymentInstruments.length === 0) {
            result.error = 'No payment instruments found on order';
            Logger.error('refundPayment: Order {0} - {1}', order.orderNo, result.error);
            return result;
        }
        
        var paymentInstrument = paymentInstruments[0];
        var paymentTransaction = paymentInstrument.getPaymentTransaction();
        
       
        var jpmcTransactionId = jpmcTransactionHelpers.resolveJpmcTransactionId(paymentInstrument, paymentTransaction);
        
        if (!jpmcTransactionId) {
            result.error = 'JPMC transaction ID not found';
            Logger.error('refundPayment: Order {0} - {1}', order.orderNo, result.error);
            return result;
        }

       
        var refundReferenceId = jpmcTransactionId;

        if (options && options.captureId) {
            refundReferenceId = options.captureId;
        } else if (paymentTransaction.custom && paymentTransaction.custom.jpmcCaptureHistory) {
            try {
                var captureHistory = JSON.parse(paymentTransaction.custom.jpmcCaptureHistory);

                if (captureHistory.length > 1) {

                    var refundedPerCapture = {};
                    if (paymentTransaction.custom.jpmcRefundHistory) {
                        try {
                            var refundHistory = JSON.parse(paymentTransaction.custom.jpmcRefundHistory);
                            for (var r = 0; r < refundHistory.length; r++) {
                                var rEntry = refundHistory[r];
                                var refCapId = rEntry.captureId;
                                if (refCapId) {
                                    refundedPerCapture[refCapId] = (refundedPerCapture[refCapId] || 0) + (rEntry.amount || 0);
                                }
                            }
                        } catch (refErr) {
                            Logger.warn('refundPayment: Could not parse refundHistory for per-capture tracking: {0}', refErr.message);
                        }
                    }

                    var refundCents = options.amount ? Math.round(options.amount * 100) : 0;

                    for (var c = 0; c < captureHistory.length; c++) {
                        var cap = captureHistory[c];
                        var capAmountCents = cap.amount || 0;
                        var capRefundedCents = refundedPerCapture[cap.transactionId] || 0;
                        var capRemainingCents = capAmountCents - capRefundedCents;

                        if (cap.transactionId && capRemainingCents > 0) {
                            if (!options.amount || refundCents <= capRemainingCents) {
                                refundReferenceId = cap.transactionId;
                                break;
                            }
                        }
                    }
                } else if (captureHistory.length === 1 && captureHistory[0].transactionId) {
                    refundReferenceId = captureHistory[0].transactionId;
                }
            } catch (parseErr) {
                Logger.warn('refundPayment: Could not parse captureHistory, falling back to auth ID: {0}', parseErr.message);
            }
        }
        
        var refundAmount = options.amount;
        var isFullRefund = !refundAmount;
        
        if (!isFullRefund && paymentTransaction.custom) {
            var capturedDollarsForValidation = paymentTransaction.custom.jpmcCapturedAmount || 0;
            var refundedDollarsForValidation = paymentTransaction.custom.jpmcRefundedAmount || 0;
            var authDollars = paymentTransaction.amount ? paymentTransaction.amount.value : 0;
            var captureMethod = paymentTransaction.custom.jpmcCaptureMethod || null;

            if (captureMethod === 'NOW' && authDollars > 0 && capturedDollarsForValidation <= 0) {
                capturedDollarsForValidation = authDollars;
            }

            if (capturedDollarsForValidation > authDollars * 2 && authDollars > 0) {
                capturedDollarsForValidation /= 100;
            }
            if (refundedDollarsForValidation > authDollars * 2 && authDollars > 0) {
                refundedDollarsForValidation /= 100;
            }

            var remainingRefundableAmount = Math.max(capturedDollarsForValidation - refundedDollarsForValidation, 0);

            if (refundAmount > remainingRefundableAmount + 0.01) {
                result.error = 'Refund amount ($' + refundAmount + ') exceeds remaining refundable amount ($' + remainingRefundableAmount.toFixed(2) + ')';
                Logger.error('refundPayment: Order {0} - {1}', order.orderNo, result.error);
                return result;
            }
        }
        
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = (options && options.resolvedConfig) || JPMCMerchantResolver.resolveForOrder(order);
        var merchantId = resolvedConfig.merchantId;
        
        if (!merchantId) {
            result.error = 'Merchant ID not configured';
            Logger.error('refundPayment: {0}', result.error);
            return result;
        }
        var refundPayload = JPMCPayloadBuilder.buildRefundPayload({
            transactionReferenceId: refundReferenceId,
            amount: refundAmount, 
            currency: !isFullRefund ? order.getCurrencyCode() : undefined,
            resolvedConfig: resolvedConfig
        });
        
        var refundAmountCents = refundPayload.amount || 0;
        var refIdSuffix = refundReferenceId ? refundReferenceId.slice(-8) : 'FULL';
        var refRequestIdRaw = 'REF-' + order.orderNo + '-' + refIdSuffix + '-' + refundAmountCents;
        var requestId = refRequestIdRaw.length > 40 ? refRequestIdRaw.substring(0, 40) : refRequestIdRaw;
        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCPaymentRefund',
            method: 'POST',
            data: refundPayload,
            headers: {
                'merchant-id': merchantId,
                'request-id': requestId
            },
            resolvedConfig: resolvedConfig
        });
        
        
        if (serviceResult.success && serviceResult.data) {
            var refundData = serviceResult.data;
            
            if (refundData.responseStatus === 'SUCCESS') {
                Transaction.wrap(function () {
                    paymentTransaction.setType(PaymentTransaction.TYPE_CREDIT);
                    var actualRefundedAmountCents = refundData.amount || refundPayload.amount || 0;
                    var actualRefundedDollars = actualRefundedAmountCents / 100;

                    if (paymentTransaction.custom) {
                        
                        var previousRefunded = paymentTransaction.custom.jpmcRefundedAmount || 0;
                        paymentTransaction.custom.jpmcRefundedAmount = previousRefunded + actualRefundedDollars;
                        
                        var refundHistoryEntry = {
                            transactionId: refundData.transactionId,
                            captureId: refundReferenceId,
                            amount: actualRefundedAmountCents,
                            amountDisplay: actualRefundedDollars.toFixed(2),
                            currency: order.getCurrencyCode(),
                            timestamp: new Date().toISOString(),
                            status: 'CLOSED',
                            userId: session.userName || 'System',
                            notes: (options.reason || 'Refund') + ' - $' + actualRefundedDollars.toFixed(2) + ' ' + order.getCurrencyCode()
                        };
                        
                        var refundHistory = []; // eslint-disable-line no-shadow
                        if (paymentTransaction.custom.jpmcRefundHistory) {
                            try {
                                refundHistory = JSON.parse(paymentTransaction.custom.jpmcRefundHistory);
                            } catch (e) {
                                Logger.warn('Failed to parse existing jpmcRefundHistory, starting fresh: {0}', e.message);
                            }
                        }
                        refundHistory.push(refundHistoryEntry);
                        paymentTransaction.custom.jpmcRefundHistory = JSON.stringify(refundHistory);
                        
                        var capturedDollars = paymentTransaction.custom.jpmcCapturedAmount || 0;
                        var captureMethodAtRefund = paymentTransaction.custom.jpmcCaptureMethod || null;
                        var authorizedDollars = paymentTransaction.amount ? paymentTransaction.amount.value : 0;

                        if (captureMethodAtRefund === 'NOW' && authorizedDollars > 0 && capturedDollars <= 0) {
                            capturedDollars = authorizedDollars;
                            paymentTransaction.custom.jpmcCapturedAmount = capturedDollars;
                        }

                        var refundedDollars = paymentTransaction.custom.jpmcRefundedAmount || 0;
                        paymentTransaction.custom.jpmcRemainingRefundableAmount = Math.max(capturedDollars - refundedDollars, 0);
                    }
                    var capturedAmountDollars = paymentTransaction.custom && paymentTransaction.custom.jpmcCapturedAmount
                        ? paymentTransaction.custom.jpmcCapturedAmount
                        : order.getTotalGrossPrice().getValue();
                    
                    var totalRefundedDollars = paymentTransaction.custom.jpmcRefundedAmount || 0;
                    
                    if (totalRefundedDollars >= capturedAmountDollars) {
                        order.setPaymentStatus(order.PAYMENT_STATUS_NOTPAID);
                    } else {
                        order.setPaymentStatus(order.PAYMENT_STATUS_PARTPAID);
                    }
                    var refundNote = 'JPMC Refund Successful\n' +
                        'Refund ID: ' + refundData.transactionId + '\n' +
                        'Amount: $' + actualRefundedDollars.toFixed(2) + ' ' + order.getCurrencyCode() + '\n' +
                        'Transaction State: ' + refundData.transactionState;
                    
                    if (options.reason) {
                        refundNote += '\nReason: ' + options.reason;
                    }
                    
                    if (refundData.remainingRefundableAmount !== undefined) {
                        refundNote += '\nRemaining Refundable: $' + (refundData.remainingRefundableAmount / 100).toFixed(2);
                    }
                    
                    order.addNote('JPMC Payment Refunded', refundNote);
                });
                
                result.success = true;
                result.refundId = refundData.transactionId;
                result.amount = refundAmount;
                result.data = refundData;
                
                Logger.info('refundPayment: SUCCESS - Order {0}, RefundID: {1}, State: {2}', 
                    order.orderNo, refundData.transactionId, refundData.transactionState);
            } else {
                result.error = refundData.responseMessage || 'Refund failed with status: ' + refundData.responseStatus;
                result.data = refundData;
                
                Logger.error('refundPayment: FAILED - Order {0}, Status: {1}, Code: {2}, Message: {3}', 
                    order.orderNo, refundData.responseStatus, refundData.responseCode, refundData.responseMessage);
            }
        } else {
            result.error = serviceResult.error || 'Refund service call failed';
            Logger.error('refundPayment: SERVICE ERROR - Order {0}, Error: {1}', 
                order.orderNo, result.error);
        }
        
    } catch (e) {
        result.error = e.message || String(e);
        Logger.error('refundPayment: EXCEPTION - Order {0}, Error: {1}', 
            order.orderNo, result.error);
    }
    
    return result;
}

/**
 * Get payment details after 3DS authentication (JPMC Step 5)
 * Performs GET /payments/{id} to retrieve authentication results
 * @param {dw.order.Order} order - order with payment to retrieve
 * @param {string} transactionId - JPMC transaction/payment ID
 * @returns {Object} { success: boolean, data: object }
 */
function getPaymentDetails(order, transactionId) {
    var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    
    var result = {
        success: false,
        data: null,
        error: null
    };
    
    if (!transactionId) {
        result.error = 'Transaction ID is required';
        Logger.error('getPaymentDetails: {0}', result.error);
        return result;
    }
    
    try {
        var resolvedConfig = JPMCMerchantResolver.resolve();
        var merchantId = resolvedConfig.merchantId;
        
        var requestId = UUID.createUUID().toString();
        var headers = {
            'merchant-id': merchantId,
            'request-id': requestId
        };
        
        // GET /payments/{id}
        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCPaymentService',
            method: 'GET',
            urlSuffix: '/' + transactionId,
            headers: headers,
            resolvedConfig: resolvedConfig
        });
        
        if (serviceResult.success && serviceResult.data) {
            result.success = true;
            result.data = serviceResult.data;
            
            Logger.info('JPMC 3DS: Retrieved payment details for transaction {0} - responseCode: {1}', 
                transactionId, serviceResult.data.responseCode);
            
            // Log authentication result
            if (serviceResult.data.paymentAuthenticationResult) {
                Logger.info('JPMC 3DS: Authentication result - authenticationId: {0}', 
                    serviceResult.data.paymentAuthenticationResult.authenticationId);
            }
        } else {
            result.error = 'Failed to retrieve payment details';
            Logger.error('getPaymentDetails: {0}', result.error);
        }
    } catch (e) {
        result.error = e.message || String(e);
        Logger.error('getPaymentDetails exception: {0}', result.error);
    }
    
    return result;
}


var JPMCPaymentOperations = require('*/cartridge/scripts/helpers/JPMCPaymentOperations');

module.exports = {
    createPayment: createPayment,
    capturePayment: capturePayment,
    refundPayment: refundPayment,
    voidPayment: jpmcTransactionHelpers.voidPayment,
    performFraudCheck: JPMCPaymentOperations.performFraudCheck,
    performFraudCheckForCardSave: JPMCPaymentOperations.performFraudCheckForCardSave,
    verifyPaymentInstrument: JPMCPaymentOperations.verifyPaymentInstrument,
    getPaymentDetails: getPaymentDetails
};
