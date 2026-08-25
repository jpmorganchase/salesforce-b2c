'use strict';

var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger').getLogger('JPMC', 'fraud');

/**
 * Performs fraud detection check for JPMC SAFETECH
 * Hook: app.safetech.fraud.detection
 * 
 * @param {dw.order.Basket|dw.order.Order} basketOrOrder - basket or order to check
 * @param {dw.order.PaymentInstrument} paymentInstrument - payment instrument with card data
 * @param {Object} [options] - fraud detection options
 * @param {string} [options.accountNumberType] - card number encryption type
 * @param {string} [options.orderNo] - order number for logging
 * @returns {Object} fraud detection result
 */
function fraudDetection(basketOrOrder, paymentInstrument, options) {
    var JPMCPaymentHelper = require('*/cartridge/scripts/helpers/JPMCPaymentHelper');
    
    var result = {
        status: 'success',
        errorCode: null,
        errorMessage: null,
        fraudScore: null,
        riskLevel: null,
        action: null,
        fraudRuleAction: null
    };
    
    try {
        if (!basketOrOrder) {
            result.status = 'fail';
            result.errorCode = 'INVALID_INPUT';
            result.errorMessage = 'Basket or order is required for fraud detection';
            Logger.error('fraudDetection: {0}', result.errorMessage);
            return result;
        }
        
        if (!paymentInstrument) {
            result.status = 'fail';
            result.errorCode = 'INVALID_INPUT';
            result.errorMessage = 'Payment instrument is required for fraud detection';
            Logger.error('fraudDetection: {0}', result.errorMessage);
            return result;
        }
        if (!(options && options.resolvedConfig && options.resolvedConfig.enableFraudCheck === true)) {
            result.status = 'success';
            result.errorMessage = 'Fraud check disabled';
            return result;
        }
        var orderNo = options && options.orderNo ? options.orderNo : null;
        var deviceIPAddress = request.getHttpRemoteAddress();
        var kountSessionId = (paymentInstrument.custom && paymentInstrument.custom.kountSessionId) 
            ? paymentInstrument.custom.kountSessionId 
            : null;
        var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');
        var accountNumberType = jpmcConstants.ACCOUNT_NUMBER_TYPE_PIE;
        if (options && options.accountNumberType) {
            accountNumberType = options.accountNumberType;
        }
        var fraudCheckOptions = {
            paymentInstrument: paymentInstrument,
            fraudScore: {
                cardholderBrowserInformation: request.httpUserAgent || jpmcConstants.FALLBACK_USER_AGENT,
                isFraudRuleReturn: true,
                sessionId: kountSessionId
            },
            accountNumberType: accountNumberType,
            deviceIPAddress: deviceIPAddress,
            orderNo: orderNo
        };
        var fraudResult = JPMCPaymentHelper.performFraudCheck(basketOrOrder, fraudCheckOptions);
        if (fraudResult.success) {
            result.fraudScore = fraudResult.riskDecision && fraudResult.riskDecision.fraudRiskScore
                ? fraudResult.riskDecision.fraudRiskScore
                : null;
            result.fraudRuleAction = fraudResult.riskDecision && fraudResult.riskDecision.fraudRuleAction
                ? fraudResult.riskDecision.fraudRuleAction
                : null;
            result.riskLevel = fraudResult.riskElement || 'UNKNOWN';
            if (result.fraudRuleAction) {
                switch (result.fraudRuleAction) {
                    case 'A':
                        result.status = 'success';
                        result.action = 'APPROVE';
                        break;
                    
                    case 'D':
                        result.status = 'fail';
                        result.action = 'DECLINE';
                        result.errorCode = 'FRAUD_DECLINED';
                        result.errorMessage = 'Transaction declined due to fraud detection';
                        if (orderNo) {
                            Logger.warn('Fraud DECLINED - Order: {0}, FraudRuleAction: {1}, Score: {2}',
                                orderNo, result.fraudRuleAction, result.fraudScore);
                        } else {
                            Logger.warn('Fraud DECLINED - FraudRuleAction: {0}, Score: {1}',
                                result.fraudRuleAction, result.fraudScore);
                        }
                        break;
                    
                    case 'E':
                    case 'R':
                        result.status = 'flag';
                        result.action = result.fraudRuleAction === 'E' ? 'MANAGER_REVIEW' : 'REVIEW';
                        result.errorCode = 'FRAUD_REVIEW';
                        result.errorMessage = 'Transaction flagged for review';
                        if (orderNo) {
                            Logger.warn('Fraud flagged for {0} - Order: {1}, FraudRuleAction: {2}, Score: {3}',
                                result.action, orderNo, result.fraudRuleAction, result.fraudScore);
                        } else {
                            Logger.warn('Fraud flagged for {0} - FraudRuleAction: {1}, Score: {2}',
                                result.action, result.fraudRuleAction, result.fraudScore);
                        }
                        break;

                    default:
                        // Unknown action codes should flag for review, not auto-approve
                        result.status = 'flag';
                        result.action = 'REVIEW';
                        result.errorCode = 'FRAUD_REVIEW';
                        result.captureMethod = 'MANUAL';
                        result.errorMessage = 'Transaction flagged for review - unknown action code';
                        if (orderNo) {
                            Logger.warn('Fraud unknown action code flagged for review - Order: {0}, FraudRuleAction: {1}, Score: {2}',
                                orderNo, result.fraudRuleAction, result.fraudScore);
                        } else {
                            Logger.warn('Fraud unknown action code flagged for review - FraudRuleAction: {0}, Score: {1}',
                                result.fraudRuleAction, result.fraudScore);
                        }
                        break;
                }
            } else {
                result.status = 'success';
                result.action = 'NO_ACTION';
            }
            
        } else {
            // Fail-open: fraud API down — proceed but record the failure
            result.status = 'success';
            result.errorCode = 'FRAUD_SERVICE_ERROR';
            result.errorMessage = fraudResult.error || 'Fraud check service error';
            result.action = 'FAIL_OPEN';
            result.captureMethod = 'MANUAL';
            
            if (orderNo) {
                Logger.error('FRAUD_FAIL_OPEN - Order: {0} - Fraud service unavailable, proceeding with order', orderNo);
            } else {
                Logger.error('FRAUD_FAIL_OPEN - Fraud service unavailable, proceeding with order');
            }
            
            if (orderNo) {
                Transaction.wrap(function () {
                    basketOrOrder.custom.jpmcFraudRiskElement = 'UNKNOWN';
                    basketOrOrder.custom.jpmcFraudCheckDate = new Date();
                });
            }
        }
        
        return result;
        
    } catch (e) {
        var errorMsg = e instanceof Error ? e.message : String(e);
        Logger.error('FRAUD_FAIL_OPEN - Fraud check exception, proceeding with order: {0}', errorMsg);
        
        // Fail-open on exception
        result.status = 'success';
        result.errorCode = 'FRAUD_EXCEPTION';
        result.errorMessage = 'Fraud check exception: ' + errorMsg;
        result.action = 'FAIL_OPEN';
        result.captureMethod = 'MANUAL';
        
        return result;
    }
}

module.exports = {
    fraudDetection: fraudDetection
};
