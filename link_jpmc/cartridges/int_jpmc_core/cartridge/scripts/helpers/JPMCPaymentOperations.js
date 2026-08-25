/**
 * @module scripts/helpers/JPMCPaymentOperations
 */

'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'payment-ops');
var Transaction = require('dw/system/Transaction');
var UUID = require('dw/util/UUIDUtils');

/**
 * Performs fraud check for a basket or order.
 * @param {dw.order.Basket|dw.order.Order} basketOrOrder - basket or order to fraud-check
 * @param {Object} options - fraud check options (paymentInstrument, accountNumberType, etc.)
 * @returns {Object} fraud check result
 */
function performFraudCheck(basketOrOrder, options) {
    var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCPayloadBuilder = require('*/cartridge/scripts/helpers/JPMCPayloadBuilder');

    var result = {
        success: false,
        fraudCheckId: null,
        riskLevel: null,
        fraudScore: null,
        error: null,
        data: null
    };

    if (!basketOrOrder) {
        result.error = 'Basket or order is required';
        Logger.error('performFraudCheck: {0}', result.error);
        return result;
    }

    try {
        var orderNo = options && options.orderNo ? options.orderNo : null;
        var hasOrderNo = !!(orderNo);

        var paymentInstrument;
        if (options && options.paymentInstrument) {
            paymentInstrument = options.paymentInstrument;
        } else {
            var paymentInstruments = basketOrOrder.getPaymentInstruments();
            if (paymentInstruments.length === 0) {
                result.error = 'No payment instruments found';
                Logger.error('performFraudCheck: {0}', result.error);
                return result;
            }
            paymentInstrument = paymentInstruments[0];
        }

        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = (options && options.resolvedConfig) || JPMCMerchantResolver.resolve();
        if (!resolvedConfig || !resolvedConfig.merchantId) {
            result.error = 'Merchant ID not configured';
            Logger.error('performFraudCheck: {0}', result.error);
            return result;
        }

        var fraudCheckPayload = JPMCPayloadBuilder.buildFraudCheckPayload({
            basketOrOrder: basketOrOrder,
            paymentInstrument: paymentInstrument,
            deviceIPAddress: options ? options.deviceIPAddress : undefined,
            fraudScore: options ? options.fraudScore : null,
            accountNumberType: options ? options.accountNumberType : undefined,
            resolvedConfig: resolvedConfig
        });

        var requestId = 'fraud-' + UUID.createUUID();
        var headers = {
            'merchant-id': resolvedConfig.merchantId,
            'request-id': requestId
        };

        if (resolvedConfig.platformId) {
            headers['platform-id'] = resolvedConfig.platformId;
        }

        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCFraudCheck',
            method: 'POST',
            data: fraudCheckPayload,
            headers: headers,
            resolvedConfig: resolvedConfig
        });

        if (serviceResult.success && serviceResult.data) {
            var fraudData = serviceResult.data;

            if (fraudData.responseStatus === 'SUCCESS' || fraudData.responseStatus === 'APPROVED') {
                result.success = true;
                result.transactionId = fraudData.transactionId || null;
                result.riskElement = fraudData.riskElement || null;
                result.riskDecision = fraudData.riskDecision || null;
                result.data = fraudData;

                Logger.info('performFraudCheck: SUCCESS - TransactionId={0}', result.transactionId);

                if (hasOrderNo) {
                    Transaction.wrap(function () {
                        if (result.transactionId) {
                            basketOrOrder.custom.jpmcFraudTransactionId = result.transactionId;
                        }
                        if (result.riskElement) {
                            basketOrOrder.custom.jpmcFraudRiskElement = result.riskElement ? JSON.stringify(result.riskElement) : '';
                        }
                        if (result.riskDecision !== null) {
                            basketOrOrder.custom.jpmcFraudRiskDecision = result.riskDecision ? JSON.stringify(result.riskDecision) : '';
                        }
                        basketOrOrder.custom.jpmcFraudCheckDate = new Date();

                        if (options.fraudScore && options.fraudScore.sessionId) {
                            basketOrOrder.custom.kountSessionId = options.fraudScore.sessionId;
                        }

                        if (fraudData) {
                            try {
                                basketOrOrder.custom.jpmcFraudResponse = JSON.stringify(fraudData);
                            } catch (jsonError) {
                                // intentionally empty
                            }
                        }
                    });
                }

            } else {
                result.error = fraudData.responseMessage || 'Fraud check failed with status: ' + fraudData.responseStatus;
                result.data = fraudData;
                result.riskLevel = fraudData.riskLevel || 'UNKNOWN';

                Logger.warn('performFraudCheck: FLAGGED - Status: {0}, Code: {1}, RiskLevel: {2}, Message: {3}',
                    fraudData.responseStatus, fraudData.responseCode, result.riskLevel, fraudData.responseMessage);

                if (hasOrderNo) {
                    Transaction.wrap(function () {
                        if (fraudData) {
                            try {
                                basketOrOrder.custom.jpmcFraudResponse = JSON.stringify(fraudData);
                                basketOrOrder.custom.jpmcFraudCheckDate = new Date();
                            } catch (jsonError) {
                                // intentionally empty
                            }
                        }
                    });
                }
            }
        } else {
            result.error = serviceResult.error || 'Fraud check service call failed';
            Logger.error('performFraudCheck: SERVICE ERROR - Error: {0}', result.error);

            if (hasOrderNo && serviceResult) {
                Transaction.wrap(function () {
                    try {
                        basketOrOrder.custom.jpmcFraudResponse = JSON.stringify(serviceResult);
                        basketOrOrder.custom.jpmcFraudCheckDate = new Date();
                    } catch (jsonError) {
                        // intentionally empty
                    }
                });
            }
        }

    } catch (e) {
        result.error = e.message || String(e);
        Logger.error('performFraudCheck: EXCEPTION - Error: {0}', result.error);
    }

    return result;
}

/**
 * Performs fraud check for card save in My Account (minimal payload).
 * @param {Object} cardData - card data (accountNumber, expirationMonth, expirationYear)
 * @param {Object} options - fraud check options (deviceIPAddress, browserInformation, etc.)
 * @returns {Object} fraud check result
 */
function performFraudCheckForCardSave(cardData, options) {
    var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCPayloadBuilder = require('*/cartridge/scripts/helpers/JPMCPayloadBuilder');
    var Site = require('dw/system/Site');
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');

    var result = {
        success: false,
        riskDecision: null,
        riskElement: null,
        error: null,
        data: null
    };

    try {
        if (!cardData || !cardData.accountNumber) {
            result.error = 'Card data is required for fraud check';
            Logger.error('performFraudCheckForCardSave: {0}', result.error);
            return result;
        }

        var opts = options || {};
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = (opts && opts.resolvedConfig) || JPMCMerchantResolver.resolve();
        if (!resolvedConfig || !resolvedConfig.merchantId) {
            result.error = 'Merchant ID not configured';
            Logger.error('performFraudCheckForCardSave: {0}', result.error);
            return result;
        }

        var customerEmail = (customer && customer.authenticated && customer.profile)
            ? customer.profile.email
            : null;

        var payload = JPMCPayloadBuilder.buildFraudCheckForCardSavePayload({
            cardData: cardData,
            currency: (session && session.currency && session.currency.currencyCode)
                ? session.currency.currencyCode
                : Site.getCurrent().getDefaultCurrency(),
            accountNumberType: opts.accountNumberType,
            deviceIPAddress: request.getHttpRemoteAddress() || jpmcConstants.FALLBACK_IP_ADDRESS,
            customerEmail: customerEmail,
            browserInformation: request.httpUserAgent || jpmcConstants.FALLBACK_USER_AGENT,
            kountSessionId: opts.kountSessionId,
            resolvedConfig: resolvedConfig
        });

        var requestId = 'fraud-' + UUID.createUUID().toString();

        var headers = {
            'merchant-id': resolvedConfig.merchantId,
            'request-id': requestId
        };

        if (resolvedConfig.platformId) {
            headers['platform-id'] = resolvedConfig.platformId;
        }

        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCFraudCheck',
            method: 'POST',
            data: payload,
            headers: headers,
            resolvedConfig: resolvedConfig
        });

        if (serviceResult.success && serviceResult.data) {
            var fraudData = serviceResult.data;
            result.data = fraudData;

            if (fraudData.responseStatus === 'SUCCESS' || fraudData.responseStatus === 'APPROVED') {
                result.success = true;
                result.riskDecision = fraudData.riskDecision || null;
                result.riskElement = fraudData.riskElement || 'LOW';

                Logger.info('performFraudCheckForCardSave: SUCCESS - RiskLevel: {0}', result.riskElement);
            } else {
                result.error = fraudData.responseMessage || 'Fraud check failed with status: ' + fraudData.responseStatus;
                result.riskDecision = fraudData.riskDecision || null;
                result.riskElement = fraudData.riskElement || 'UNKNOWN';

                Logger.warn('performFraudCheckForCardSave: FLAGGED - Status: {0}, Code: {1}',
                    fraudData.responseStatus, fraudData.responseCode);
            }
        } else {
            result.error = serviceResult.error || 'Fraud check service call failed';
            Logger.error('performFraudCheckForCardSave: SERVICE ERROR - Error: {0}', result.error);
        }

    } catch (e) {
        result.error = e.message || String(e);
        Logger.error('performFraudCheckForCardSave: EXCEPTION - Error: {0}', result.error);
    }

    return result;
}

/**
 * Verifies card details without placing a funds hold.
 * @param {Object} cardData - card data (accountNumber, expirationMonth, expirationYear)
 * @param {Object} [options] - verification options (billingAddress, authentication, etc.)
 * @returns {Object} verification result
 */
function verifyPaymentInstrument(cardData, options) {
    var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCPayloadBuilder = require('*/cartridge/scripts/helpers/JPMCPayloadBuilder');
    var Site = require('dw/system/Site');

    var result = {
        success: false,
        verificationId: null,
        responseStatus: null,
        error: null,
        data: null
    };

    if (!cardData || !cardData.accountNumber) {
        result.error = 'Card account number is required';
        Logger.error('verifyPaymentInstrument: {0}', result.error);
        return result;
    }

    if (!cardData.expirationMonth || !cardData.expirationYear) {
        result.error = 'Card expiration month and year are required';
        Logger.error('verifyPaymentInstrument: {0}', result.error);
        return result;
    }

    try {
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = (options && options.resolvedConfig) || JPMCMerchantResolver.resolve();
        if (!resolvedConfig || !resolvedConfig.merchantId) {
            result.error = 'Merchant ID not configured';
            Logger.error('verifyPaymentInstrument: {0}', result.error);
            return result;
        }

        var opts = options || {};
        var sessionCurrency = (typeof session !== 'undefined' && session && session.currency)
            ? session.currency.currencyCode
            : null;
        var currency = opts.currency || sessionCurrency || Site.getCurrent().getDefaultCurrency();

        var payload = JPMCPayloadBuilder.buildVerificationPayload({
            cardData: cardData,
            currency: currency,
            accountNumberType: opts.accountNumberType || 'SAFETECH_PAGE_ENCRYPTION',
            billingAddress: opts.billingAddress,
            email: opts.email,
            authentication: opts.authentication,
            walletProvider: opts.walletProvider,
            accountOnFile: opts.accountOnFile,
            initiatorType: opts.initiatorType,
            resolvedConfig: resolvedConfig
        });

        var requestId = 'verify-' + UUID.createUUID().toString();

        var headers = {
            'merchant-id': resolvedConfig.merchantId,
            'request-id': requestId
        };

        if (resolvedConfig.platformId) {
            headers['platform-id'] = resolvedConfig.platformId;
        }

        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCVerification',
            method: 'POST',
            data: payload,
            headers: headers,
            resolvedConfig: resolvedConfig
        });

        if (serviceResult.success && serviceResult.data) {
            var verificationData = serviceResult.data;

            if (verificationData.responseStatus === 'SUCCESS' || verificationData.responseStatus === 'APPROVED') {
                result.success = true;
                result.verificationId = verificationData.transactionId || null;
                result.responseStatus = verificationData.responseStatus;
                result.data = verificationData;
            } else {
                result.error = verificationData.responseMessage || 'Verification failed: ' + verificationData.responseStatus;
                result.responseStatus = verificationData.responseStatus;
                result.data = verificationData;
                Logger.warn('verifyPaymentInstrument: FAILED - Status: {0}, Code: {1}',
                    verificationData.responseStatus, verificationData.responseCode);
            }
        } else {
            result.error = serviceResult.error || 'Verification service call failed';
            Logger.error('verifyPaymentInstrument: SERVICE ERROR - {0}', result.error);
        }

    } catch (e) {
        result.error = e.message || String(e);
        Logger.error('verifyPaymentInstrument: EXCEPTION - {0}', result.error);
    }

    return result;
}

module.exports = {
    performFraudCheck: performFraudCheck,
    performFraudCheckForCardSave: performFraudCheckForCardSave,
    verifyPaymentInstrument: verifyPaymentInstrument
};
