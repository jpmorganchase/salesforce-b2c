'use strict';

var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');

/**
 * Builds 3DS authentication parameters from browser info collected on the frontend
 * @param {dw.order.Order} order - order with browser info in custom attributes
 * @param {Object} resolvedConfig - resolved merchant configuration
 * @returns {Object|null} Object with paymentAuthenticationRequest and browserInfo, or null if 3DS not enabled
 */
function build3DSAuthenticationParameters(order, resolvedConfig) {
    var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');
    
    // Check if 3DS is enabled (locale-specific config or site preference)
    var is3DSEnabled = (resolvedConfig && resolvedConfig.jpmc3DSEnabled === true) || JPMCConfig.is3DSEnabled();
    
    if (!is3DSEnabled) {
        return null;
    }
    
    // Collect browser info from request form parameters (injected by frontend)
    var form = request.httpParameterMap;
    
    // Helper function to safely get form parameter value
    /**
     * getFormValue
     * @param {string} paramName - parameter name
     * @param {string} defaultValue - default value
     * @returns {string} value
     */
    function getFormValue(paramName, defaultValue) {
        var param = form.get(paramName);
        if (param && param.stringValue) {
            return param.stringValue;
        }
        return defaultValue || '';
    }
    
    // Browser info fields for root-level browserInfo object
    // CRITICAL: All these fields are REQUIRED by JPMC for 3DS
    var browserInfo = {
        // Required string fields with fallback defaults
        browserAcceptHeader: getFormValue('browserAcceptHeader', 'application/json'),
        browserLanguage: getFormValue('browserLanguage', 'en'),
        browserColorDepth: getFormValue('browserColorDepth', '24'),
        browserScreenHeight: getFormValue('browserScreenHeight', '1080'),
        browserScreenWidth: getFormValue('browserScreenWidth', '1920'),
        browserUserAgent: getFormValue('browserUserAgent', 'Mozilla/5.0 (compatible; SFCC/1.0)'),
        
        // Device local timezone (required, integer offset in minutes)
        deviceLocalTimeZone: parseInt(getFormValue('deviceLocalTimeZone', '0'), 10),
        
        // Boolean fields (required)
        javaEnabled: getFormValue('javaEnabled', 'false') === 'true',
        javaScriptEnabled: getFormValue('javaScriptEnabled', 'true') === 'true',
        
        challengeWindowSize: getFormValue('challengeWindowSize', 'FULL_SCREEN')
    };
    
    // Device IP address (required for 3DS)
    var ipAddress = null;
    try {
        ipAddress = request.getHttpRemoteAddress();
    } catch (e) {
        // Fall back to form parameter if available
        ipAddress = getFormValue('deviceIPAddress', null);
    }
    if (ipAddress) {
        browserInfo.deviceIPAddress = ipAddress;
    } else {
        // Fallback IP if unable to detect (should not happen in production)
        browserInfo.deviceIPAddress = '0.0.0.0';
    }

    // Build paymentAuthenticationRequest object (goes inside card object)
    var URLUtils = require('dw/web/URLUtils');
    var Site = require('dw/system/Site');
    
    // Build authenticationReturnUrl (where JPMC redirects after 3DS challenge).
    // orderNo included for debugging; orderToken stored in session to avoid log exposure
    var authReturnUrl;
    try {
        authReturnUrl = URLUtils.https(
            'CheckoutServices-Handle3DSReturn',
            'orderNo', order.orderNo
        ).toString();
    } catch (urlErr) {
        var siteUrl = Site.getCurrent().getHttpsHostName();
        authReturnUrl = 'https://' + siteUrl + '/checkout/3ds-return';
    }

    var paymentAuthenticationRequest = {
        authenticationReturnUrl: authReturnUrl,
        threeDSRequestorAuthenticationInfo: {
            authenticationPurpose: jpmcConstants.THREE_DS.AUTHENTICATION_PURPOSE.PAYMENT_TRANSACTION
        },
        threeDSPurchaseInfo: {
            purchaseDate: new Date().toISOString(),
            threeDomainSecureTransactionType: jpmcConstants.THREE_DS.TRANSACTION_TYPE.GOODS_SERVICES
        }
    };
    
    return {
        paymentAuthenticationRequest: paymentAuthenticationRequest,
        browserInfo: browserInfo
    };
}

/**
 * @param {dw.order.PaymentInstrument} paymentInstrument - payment instrument to check
 * @param {dw.order.PaymentTransaction} paymentTransaction - payment transaction to check
 * @returns {string|null} JPMC transaction ID or null
 */
function resolveJpmcTransactionId(paymentInstrument, paymentTransaction) {
    if (paymentTransaction && paymentTransaction.custom && paymentTransaction.custom.jpmcAuthorizationId) {
        return paymentTransaction.custom.jpmcAuthorizationId;
    }
    if (paymentInstrument && paymentInstrument.custom && paymentInstrument.custom.jpmcTransactionId) {
        return paymentInstrument.custom.jpmcTransactionId;
    }
    if (paymentTransaction && paymentTransaction.getTransactionID()) {
        return paymentTransaction.getTransactionID();
    }
    return null;
}

/**
 * @param {Object} opts - authorization data options
 */
function persistAuthorizationData(opts) {
    var paymentInstrument = opts.paymentInstrument;
    var transactionId = opts.transactionId;
    var captureMethod = opts.captureMethod;
    var walletProvider = opts.walletProvider;
    var pt = paymentInstrument.paymentTransaction || paymentInstrument.getPaymentTransaction();

    if (paymentInstrument.custom) {
        paymentInstrument.custom.jpmcTransactionId = transactionId;
        if (walletProvider) {
            paymentInstrument.custom.jpmcWalletProvider = walletProvider;
        }
    }

    if (pt && pt.custom) {
        var custom = pt.custom;
        custom.jpmcAuthorizationId = transactionId;
        custom.jpmcCaptureMethod = captureMethod;
        custom.jpmcAuthTimestamp = new Date().toISOString();

        if (captureMethod === 'NOW') {
            custom.jpmcPaymentStatus = 'AC';
            custom.jpmcCapturedAmount = pt.amount.value;
            custom.jpmcRemainingAuthAmount = 0;
            custom.jpmcRemainingRefundableAmount = pt.amount.value;
        } else {
            custom.jpmcPaymentStatus = 'A';
            custom.jpmcRemainingAuthAmount = pt.amount.value;
            custom.jpmcRemainingRefundableAmount = 0;
        }
    }
}

/**
 * Authorizes a credit card payment via JPMC
 * @param {string} orderNumber - order number to authorize
 * @param {dw.order.PaymentInstrument} paymentInstrument - payment instrument with card data
 * @param {dw.order.PaymentProcessor} paymentProcessor - JPMC payment processor
 * @returns {Object} authorization result
 */
function authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    var Resource = require('dw/web/Resource');
    var serverErrors = [];

    var order = OrderMgr.getOrder(orderNumber);

    try {
        if (!order) {
            return { error: true, serverErrors: [Resource.msg('error.payment.order.not.found', 'checkout', null)] };
        }

        var resolvedConfig = JPMCMerchantResolver.resolve();
        var creditCardToken = paymentInstrument.getCreditCardToken();
        var isStoredCard = !!(creditCardToken);
        var billingForm = session.forms.billing;
        var creditCardForm = billingForm && billingForm.creditCardFields;
        var isSaveCardChecked = creditCardForm && creditCardForm.saveCard && creditCardForm.saveCard.checked;
        var accountOnFile;
        if (isStoredCard) {
            accountOnFile = 'STORED';
        } else if (isSaveCardChecked) {
            accountOnFile = 'TO_BE_STORED';
        } else {
            accountOnFile = 'NOT_STORED';
        }
        var captureMethod = resolvedConfig.captureMethod || JPMCConfig.getCaptureMethod();
        var HookMgr = require('dw/system/HookMgr');
        var JPMCPaymentHelper = require('*/cartridge/scripts/helpers/JPMCPaymentHelper');
        
        var fraudRuleActionFromVerify = null;
        var fraudRuleActionFromAuth = null;
        if (paymentInstrument.custom && paymentInstrument.custom.jpmcFraudRuleAction) {
            fraudRuleActionFromVerify = paymentInstrument.custom.jpmcFraudRuleAction;
        }
        if ((resolvedConfig ? resolvedConfig.enableFraudCheckAtAuth === true : false) && HookMgr.hasHook('app.safetech.fraud.detection')) {
            var accountNumberType;
            if (isStoredCard) {
                accountNumberType = resolvedConfig ? resolvedConfig.tokenizationType : JPMCConfig.getConfig().accountNumberType;
            } else {
                accountNumberType = jpmcConstants.ACCOUNT_NUMBER_TYPE_PIE;
            }
            
            var fraudDetectionResult = HookMgr.callHook(
                'app.safetech.fraud.detection',
                'fraudDetection',
                order,
                paymentInstrument,
                { 
                    accountNumberType: accountNumberType,
                    orderNo: orderNumber
                }
            );
            if (fraudDetectionResult.fraudRuleAction) {
                fraudRuleActionFromAuth = fraudDetectionResult.fraudRuleAction;
            }
            if (fraudDetectionResult.status === 'fail') {
                return {
                    error: true,
                    serverErrors: [Resource.msg('error.fraud.declined', 'checkout', null)]
                };
            }
            if (fraudDetectionResult.captureMethod) {
                captureMethod = fraudDetectionResult.captureMethod;
            }
        }

        var isFraudFlagged = (fraudRuleActionFromVerify === 'E' || fraudRuleActionFromVerify === 'R') ||
                             (fraudRuleActionFromAuth === 'E' || fraudRuleActionFromAuth === 'R');
        
        if (isFraudFlagged) {
            captureMethod = 'MANUAL';
            
            Transaction.wrap(function () {
                var existingNotes = order.getNotes();
                var noteExists = false;
                for (var i = 0; i < existingNotes.length; i++) {
                    if (existingNotes[i].subject === jpmcConstants.FRAUD_REVIEW_NOTE_SUBJECT || existingNotes[i].text.indexOf('Order marked for review') !== -1) {
                        noteExists = true;
                        break;
                    }
                }
                
                if (!noteExists) {
                    order.addNote(jpmcConstants.FRAUD_REVIEW_NOTE_SUBJECT, 'Order marked for review');
                }
            });
        }

        var ipAddress = null;
        try {
            ipAddress = (typeof request !== 'undefined' && request) ? request.getHttpRemoteAddress() : null;
        } catch (ipErr) {
            // intentionally empty
        }

        var paymentAccountNumberType;
        if (isStoredCard) {
            paymentAccountNumberType = resolvedConfig ? resolvedConfig.tokenizationType : JPMCConfig.getConfig().accountNumberType;
        } else {
            paymentAccountNumberType = jpmcConstants.ACCOUNT_NUMBER_TYPE_PIE;
        }
        // Build 3DS authentication parameters if 3DS is enabled.
        // Only Visa, Mastercard, and American Express support 3DS (whitelist approach).
        var cardTypeName = paymentInstrument.custom && paymentInstrument.custom.jpmcCardTypeName;
        var is3DSSupportedCard = false;
        
        // Check if card type (name or code) is in supported list
        if (cardTypeName) {
            var upperCardType = cardTypeName.toUpperCase();
            is3DSSupportedCard = jpmcConstants.THREE_DS.SUPPORTED_CARD_TYPES.indexOf(upperCardType) !== -1;
        }
        
        var threeDSParams = is3DSSupportedCard
            ? build3DSAuthenticationParameters(order, resolvedConfig)
            : null;

        var paymentResult = JPMCPaymentHelper.createPayment(order, {
            paymentInstrument: paymentInstrument,
            accountNumberType: paymentAccountNumberType,
            captureMethod: captureMethod,
            initiatorType: 'CARDHOLDER',
            accountOnFile: accountOnFile,
            isAmountFinal: true,
            IPAddress: ipAddress,
            resolvedConfig: resolvedConfig,
            requestAccountUpdater: (isStoredCard && resolvedConfig.accountUpdaterMode === 'REAL_TIME'),
            paymentAuthenticationRequest: threeDSParams ? threeDSParams.paymentAuthenticationRequest : null,
            browserInfo: threeDSParams ? threeDSParams.browserInfo : null
        });

        if (!paymentResult.success) {
            return { error: true, serverErrors: [Resource.msg('error.payment.authorization.failed', 'checkout', null)] };
        }

        // For 3DS orders, RTAU is processed post-authentication in CheckoutServices-Handle3DSReturn.
        if (isStoredCard && paymentResult.data && paymentResult.data.responseCode !== 'PERFORM_AUTHENTICATION') {
            require('*/cartridge/scripts/helpers/AccountUpdaterHelper').processRTAUForOrder(order, paymentResult.data);
        }
        // Check if 3DS authentication is required
        // JPMC returns responseCode "PERFORM_AUTHENTICATION" with paymentAuthenticationResult
        var requires3DS = !!(paymentResult.data && 
                             paymentResult.data.responseCode === 'PERFORM_AUTHENTICATION' && 
                             paymentResult.data.paymentAuthenticationResult &&
                             paymentResult.data.paymentAuthenticationResult.authenticationOrchestrationUrl);
        
        var authenticationId = null;
        var orchestrationUrl = null;
        
        if (requires3DS) {
            orchestrationUrl = paymentResult.data.paymentAuthenticationResult.authenticationOrchestrationUrl;
            authenticationId = paymentResult.data.paymentAuthenticationResult.authenticationId;
        }

        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setTransactionID(paymentResult.transactionId || orderNumber);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);

            persistAuthorizationData({
                paymentInstrument: paymentInstrument,
                transactionId: paymentResult.transactionId,
                captureMethod: captureMethod
            });

            order.custom.jpmcMerchantId = resolvedConfig.merchantId;
            
            // Store card network response if available
            if (paymentResult.data && 
                paymentResult.data.paymentMethodType && 
                paymentResult.data.paymentMethodType.card && 
                paymentResult.data.paymentMethodType.card.networkResponse) {
                try {
                    order.custom.jpmcCardNetworkResponse = JSON.stringify(paymentResult.data.paymentMethodType.card.networkResponse);
                } catch (networkErr) {
                    var Logger = require('dw/system/Logger');
                    Logger.warn('Failed to store card network response: {0}', networkErr.message);
                }
            }
            
            // If 3DS is required, mark order as pending authentication
            if (requires3DS) {
                order.custom.pending3DSAuthentication = true;
                order.custom.threeDSTransactionId = paymentResult.transactionId;
                order.custom.threeDSAuthenticationId = authenticationId;
            }
        });

        var result = {
            error: false,
            serverErrors: serverErrors,
            transactionId: paymentResult.transactionId,
            captureMethod: captureMethod
        };
        
        // Send Orchestration data if present
        if (requires3DS) {
            result.requires3DS = true;
            result.authenticationOrchestrationUrl = orchestrationUrl;
            result.authenticationId = authenticationId;
        }
        
        return result;

    } catch (e) {
        serverErrors.push(Resource.msg('error.technical', 'checkout', null));
        if (order) {
            try {
                OrderMgr.failOrder(order, true);
            } catch (failErr) {
                // intentionally empty
            }
        }
        return { error: true, serverErrors: serverErrors };
    } finally {
        try {
            session.privacy.jpmcEncryptedCvv = null;
            session.privacy.jpmcEncryptedData = null;
        } catch (clearErr) {
            // intentionally empty
        }
    }
}

/**
 * Authorizes a Google Pay payment
 * @param {string} orderNumber - order number to authorize
 * @param {dw.order.PaymentInstrument} paymentInstrument - Google Pay payment instrument
 * @param {dw.order.PaymentProcessor} paymentProcessor - JPMC payment processor
 * @returns {Object} authorization result
 */
function authorizeGooglePay(orderNumber, paymentInstrument, paymentProcessor) {
    var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    var Resource = require('dw/web/Resource');
    var serverErrors = [];

    var order = OrderMgr.getOrder(orderNumber);

    try {
        if (!order) {
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            return { error: true, serverErrors: serverErrors };
        }

        var resolvedConfig = JPMCMerchantResolver.resolve();

        var googlePayTokenStr = session.privacy.jpmcGooglePayToken;
        if (!googlePayTokenStr) {
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            return { error: true, serverErrors: serverErrors };
        }

        var googlePayToken;
        try {
            googlePayToken = JSON.parse(googlePayTokenStr);
        } catch (parseError) {
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            return { error: true, serverErrors: serverErrors };
        }

        if (!googlePayToken.signedMessage || !googlePayToken.protocolVersion) {
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            return { error: true, serverErrors: serverErrors };
        }

        var hasSignature = googlePayToken.signature
            || (googlePayToken.intermediateSigningKey
                && googlePayToken.intermediateSigningKey.signatures
                && googlePayToken.intermediateSigningKey.signatures.length > 0);
        if (!hasSignature) {
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            return { error: true, serverErrors: serverErrors };
        }

        var captureMethod = resolvedConfig.captureMethod || JPMCConfig.getCaptureMethod();
        var merchantId = resolvedConfig.merchantId;
        var JPMCPayloadBuilder = require('*/cartridge/scripts/helpers/JPMCPayloadBuilder');
        var payload = JPMCPayloadBuilder.buildGooglePayPaymentPayload({
            order: order,
            paymentInstrument: paymentInstrument,
            captureMethod: captureMethod,
            googlePayToken: googlePayToken,
            initiatorType: 'CARDHOLDER',
            accountOnFile: 'NOT_STORED',
            isAmountFinal: true,
            resolvedConfig: resolvedConfig
        });
        var UUID = require('dw/util/UUIDUtils');
        var requestId = UUID.createUUID().toString();

        var headers = {
            'merchant-id': merchantId,
            'request-id': requestId
        };

        var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCPaymentService',
            method: 'POST',
            data: payload,
            headers: headers,
            resolvedConfig: resolvedConfig
        });

        if (!serviceResult.success || !serviceResult.data) {
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            return { error: true, serverErrors: serverErrors };
        }

        var paymentData = serviceResult.data;

        if (paymentData.responseStatus !== 'SUCCESS') {
            serverErrors.push(Resource.msg('error.technical', 'checkout', null));
            return { error: true, serverErrors: serverErrors };
        }

        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setTransactionID(paymentData.transactionId || orderNumber);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);

            persistAuthorizationData({
                paymentInstrument: paymentInstrument,
                transactionId: paymentData.transactionId,
                captureMethod: captureMethod,
                walletProvider: jpmcConstants.GOOGLE_PAY_WALLET_PROVIDER
            });
            order.addNote(jpmcConstants.NOTE_SUBJECT_GPAY_PAYMENT,
                'Transaction ID: ' + (paymentData.transactionId || '') +
                '\nCapture Method: ' + captureMethod +
                '\nAmount: ' + paymentInstrument.paymentTransaction.amount.value + ' ' + order.getCurrencyCode());

            order.custom.jpmcMerchantId = resolvedConfig.merchantId;
            
            // Store card network response if available
            if (paymentData && 
                paymentData.paymentMethodType && 
                paymentData.paymentMethodType.card && 
                paymentData.paymentMethodType.card.networkResponse) {
                try {
                    order.custom.jpmcCardNetworkResponse = JSON.stringify(paymentData.paymentMethodType.card.networkResponse);
                } catch (networkErr) {
                    var Logger = require('dw/system/Logger');
                    Logger.warn('Failed to store Google Pay card network response: {0}', networkErr.message);
                }
            }
        });

        return {
            error: false,
            serverErrors: serverErrors,
            transactionId: paymentData.transactionId,
            captureMethod: captureMethod
        };

    } catch (e) {
        serverErrors.push(Resource.msg('error.technical', 'checkout', null));
        return { error: true, serverErrors: serverErrors };
    } finally {
        try {
            session.privacy.jpmcGooglePayToken = null;
        } catch (clearErr) {
            // intentionally empty
        }
    }
}

/**
 * Voids the remaining uncaptured authorization for an order.
 * @param {dw.order.Order} order - order with authorization to void
 * @param {Object} [options] - void options
 * @param {Object} [options.resolvedConfig] - resolved merchant configuration
 * @returns {Object} void result
 */
function voidPayment(order, options) {
    var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
    var JPMCPayloadBuilder = require('*/cartridge/scripts/helpers/JPMCPayloadBuilder');
    var UUID = require('dw/util/UUIDUtils');

    var result = { success: false, error: null, data: null };

    if (!order) {
        result.error = 'Order is required';
        return result;
    }

    try {
        var paymentInstruments = order.getPaymentInstruments();
        if (paymentInstruments.length === 0) {
            result.error = 'No payment instruments found on order';
            return result;
        }

        var paymentInstrument = paymentInstruments[0];
        var paymentTransaction = paymentInstrument.getPaymentTransaction();

        var jpmcTransactionId = resolveJpmcTransactionId(paymentInstrument, paymentTransaction);

        if (!jpmcTransactionId) {
            result.error = 'JPMC transaction ID not found';
            return result;
        }

        var voidPayload = JPMCPayloadBuilder.buildVoidPayload();

        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = (options && options.resolvedConfig) || JPMCMerchantResolver.resolveForOrder(order);
        var merchantId = resolvedConfig.merchantId;

        if (!merchantId) {
            result.error = 'Merchant ID not configured';
            return result;
        }

        var requestId = UUID.createUUID().toString();

        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCPaymentVoid',
            method: 'PATCH',
            data: voidPayload,
            headers: {
                'merchant-id': merchantId,
                'request-id': requestId
            },
            placeHolderId: jpmcTransactionId,
            resolvedConfig: resolvedConfig
        });

        if (serviceResult.success && serviceResult.data) {
            var voidData = serviceResult.data;

            if (voidData.responseStatus === 'SUCCESS' && voidData.transactionState === 'VOIDED') {
                Transaction.wrap(function () {
                    if (paymentTransaction.custom) {
                        paymentTransaction.custom.jpmcRemainingAuthAmount = 0;
                    }

                    var voidNote = 'JPMC Void Successful\n' +
                        'Transaction ID: ' + (voidData.transactionId || jpmcTransactionId) + '\n' +
                        'Transaction State: ' + voidData.transactionState + '\n' +
                        'User: ' + (session.userName || 'System');

                    if (voidData.approvalCode) {
                        voidNote += '\nApproval Code: ' + voidData.approvalCode;
                    }

                    order.addNote('JPMC Authorization Voided', voidNote);
                });

                result.success = true;
                result.data = voidData;
            } else {
                result.error = voidData.responseMessage || 'Void failed with status: ' + voidData.responseStatus;
                result.data = voidData;
            }
        } else {
            result.error = serviceResult.error || 'Void service call failed';
        }
    } catch (e) {
        result.error = e.message || String(e);
    }

    return result;
}

module.exports = {
    authorize: authorize,
    authorizeGooglePay: authorizeGooglePay,
    voidPayment: voidPayment,
    resolveJpmcTransactionId: resolveJpmcTransactionId,
    persistAuthorizationData: persistAuthorizationData
};

