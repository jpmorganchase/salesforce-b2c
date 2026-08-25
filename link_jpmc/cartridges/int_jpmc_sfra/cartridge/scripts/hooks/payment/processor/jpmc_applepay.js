'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'jpmc_applepay');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentMgr = require('dw/order/PaymentMgr');
var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');
var Status = require('dw/system/Status');

/**
 * Maps Apple Pay token paymentData to the JPMC encryptedPaymentBundle structure.
 * @param {Object} paymentData - Apple Pay token payment data
 * @returns {Object} JPMC encryptedPaymentBundle object
 * @throws {Error}
 */
function buildEncryptedPaymentBundle(paymentData) {
    if (!paymentData || !paymentData.data || !paymentData.signature) {
        throw new Error('Invalid Apple Pay payment data');
    }
    if (!paymentData.header || !paymentData.header.ephemeralPublicKey
        || !paymentData.header.publicKeyHash || !paymentData.header.transactionId) {
        throw new Error('Invalid Apple Pay payment header');
    }

    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');

    var bundle = {
        encryptedPayload: paymentData.data,
        signature: paymentData.signature,
        protocolVersion: paymentData.version || jpmcConstants.APPLE_PAY_PROTOCOL.EC_V1,
        encryptedPaymentHeader: {
            ephemeralPublicKey: paymentData.header.ephemeralPublicKey,
            publicKeyHash: paymentData.header.publicKeyHash,
            walletTransactionId: paymentData.header.transactionId
        }
    };

    if (paymentData.header.applicationData) {
        bundle.encryptedPaymentHeader.walletApplicationData = paymentData.header.applicationData;
    }

    return bundle;
}

/**
 * Persists JPMC authorization response data onto the payment instrument and
 * transaction, mirroring the CC and GPay patterns in jpmcTransactionHelpers
 * so BM extension capture/refund/void flows work for all payment methods.
 *
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument - order payment instrument to update
 * @param {Object} paymentResponse - JPMC authorization response
 * @param {string} captureMethod - capture method (NOW, DELAYED, MANUAL)
 */
function persistAuthorizationData(paymentInstrument, paymentResponse, captureMethod) {
    var PaymentTransaction = require('dw/order/PaymentTransaction');
    var txnHelpers = require('*/cartridge/scripts/helpers/JPMCTransactionHelpers');
    var jpmcConst = require('*/cartridge/scripts/helpers/JPMCConstants');

    var isCaptureNow = (captureMethod === jpmcConst.CAPTURE_METHOD_NOW);

    Transaction.wrap(function () {
        var pt = paymentInstrument.getPaymentTransaction();

        pt.setType(isCaptureNow ? PaymentTransaction.TYPE_CAPTURE : PaymentTransaction.TYPE_AUTH);
        pt.setTransactionID(paymentResponse.transactionId || '');

        txnHelpers.persistAuthorizationData({
            paymentInstrument: paymentInstrument,
            transactionId: paymentResponse.transactionId,
            captureMethod: captureMethod,
            walletProvider: jpmcConst.APPLE_PAY_WALLET_PROVIDER
        });

        if (paymentResponse.paymentMethodType && paymentResponse.paymentMethodType.card) {
            var cardInfo = paymentResponse.paymentMethodType.card;
            if (cardInfo.maskedAccountNumber) {
                paymentInstrument.setCreditCardNumber(cardInfo.maskedAccountNumber);
            }
            if (cardInfo.cardType) {
                paymentInstrument.setCreditCardType(cardInfo.cardType);
            }
        }
    });
}

/**
 * Authorizes an Apple Pay order payment via the JPMC gateway.
 * Hook: dw.extensions.applepay.paymentAuthorized.authorizeOrderPayment
 *
 * @param {dw.order.Order} order - order to authorize
 * @param {Object} event - Apple Pay authorization event with payment token
 * @returns {dw.system.Status|dw.extensions.applepay.ApplePayHookResult} result
 */
function authorizeOrderPayment(order, event) {
    var ApplePayHookResult = require('dw/extensions/applepay/ApplePayHookResult');

    /**
     * Logs the error and returns an ApplePayHookResult with REASON_FAILURE.
     * @param {string} message - error message to log
     * @returns {dw.extensions.applepay.ApplePayHookResult} result
     */
    function errorResult(message) {
        Logger.error('Apple Pay auth failed - Order: {0} - {1}', order.getOrderNo(), message);
        return new ApplePayHookResult(
            new Status(Status.ERROR, ApplePayHookResult.REASON_FAILURE, message),
            null
        );
    }

    try {
        var paymentInstruments = order.getPaymentInstruments(PaymentInstrument.METHOD_DW_APPLE_PAY);
        if (paymentInstruments.empty) {
            return errorResult(Resource.msg('error.payment.instrument.not.found', 'checkout', null));
        }
        var paymentInstrument = paymentInstruments[0];
        var paymentMethod = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_DW_APPLE_PAY);
        var paymentProcessor = paymentMethod ? paymentMethod.getPaymentProcessor() : null;
        if (!paymentProcessor) {
            return errorResult(Resource.msg('error.payment.processor.missing', 'checkout', null));
        }
        Transaction.wrap(function () {
            paymentInstrument.getPaymentTransaction().setPaymentProcessor(paymentProcessor);
        });
        var paymentToken = event.payment.token;
        if (!paymentToken || !paymentToken.paymentData) {
            return errorResult(Resource.msg('error.technical', 'checkout', null));
        }
        var encryptedPaymentBundle;
        try {
            encryptedPaymentBundle = buildEncryptedPaymentBundle(paymentToken.paymentData);
        } catch (bundleError) {
            return errorResult(Resource.msg('error.technical', 'checkout', null));
        }
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = JPMCMerchantResolver.resolveForOrder(order);
        if (!resolvedConfig || !resolvedConfig.merchantId) {
            return errorResult('Unable to resolve merchant configuration for order');
        }

        var captureMethod = resolvedConfig.captureMethod;
        var merchantId = resolvedConfig.merchantId;

        var JPMCPayloadBuilder = require('*/cartridge/scripts/helpers/JPMCPayloadBuilder');
        var paymentPayload = JPMCPayloadBuilder.buildApplePayPaymentPayload({
            order: order,
            encryptedPaymentBundle: encryptedPaymentBundle,
            captureMethod: captureMethod
        });
        var UUID = require('dw/util/UUIDUtils');
        var requestId = ('AP-' + order.getOrderNo() + '-' + UUID.createUUID()).substring(0, 40);

        var JPMCServiceHelper = require('*/cartridge/scripts/services/JPMCServiceHelper');
        var serviceResult = JPMCServiceHelper.callWithTokenGeneration({
            tokenServiceId: 'JPMCAccessToken',
            serviceId: 'JPMCPaymentService',
            method: 'POST',
            data: paymentPayload,
            headers: {
                'merchant-id': merchantId,
                'request-id': requestId
            },
            resolvedConfig: resolvedConfig
        });

        if (!serviceResult.success || !serviceResult.data
                || serviceResult.data.responseStatus !== 'SUCCESS') {
            Logger.error('Apple Pay payment failed - Order: {0} - Status: {1}, Message: {2}',
                order.getOrderNo(),
                serviceResult.data ? serviceResult.data.responseStatus : 'NO_RESPONSE',
                serviceResult.data ? serviceResult.data.responseMessage : serviceResult.error
            );
            return errorResult(Resource.msg('error.technical', 'checkout', null));
        }

        persistAuthorizationData(paymentInstrument, serviceResult.data, captureMethod);

        Transaction.wrap(function () {
            order.custom.jpmcMerchantId = merchantId;
            
            // Store card network response if available
            if (serviceResult.data && 
                serviceResult.data.paymentMethodType && 
                serviceResult.data.paymentMethodType.card && 
                serviceResult.data.paymentMethodType.card.networkResponse) {
                try {
                    order.custom.jpmcCardNetworkResponse = JSON.stringify(serviceResult.data.paymentMethodType.card.networkResponse);
                } catch (networkErr) {
                    Logger.warn('Failed to store Apple Pay card network response: {0}', networkErr.message);
                }
            }
        });

        Logger.info('Apple Pay authorized - Order: {0}', order.getOrderNo());
        return new Status(Status.OK);

    } catch (e) {
        return errorResult(e instanceof Error ? e.message : String(e));
    }
}

exports.authorizeOrderPayment = authorizeOrderPayment;

exports.getRequest = function (basket, applePayRequest) {
    var ApplePayHookResult = require('dw/extensions/applepay/ApplePayHookResult');
    try {
        var Site = require('dw/system/Site');
        // No Multi-MID support for Apple Pay, so we can return an error if locale doesn't match site default since that indicates a mismatch in configuration
        if (request.getLocale() !== Site.getCurrent().getDefaultLocale()) {
            session.privacy.applepaysession = 'no';   // eslint-disable-line no-param-reassign
            return new ApplePayHookResult(new Status(Status.ERROR), null);
        }

        var basketCurrencyCode = basket.getCurrencyCode();
        if (basketCurrencyCode) {
            applePayRequest.currencyCode = basketCurrencyCode;
        }
        var countryCode = request.locale.slice(-2).toUpperCase();
        if (countryCode) {
            applePayRequest.countryCode = countryCode;
        }
        session.privacy.applepaysession = 'yes';   // eslint-disable-line no-param-reassign
        return new ApplePayHookResult(new Status(Status.OK), null);
    } catch (e) {
        session.privacy.applepaysession = 'no';   // eslint-disable-line no-param-reassign
        return new ApplePayHookResult(new Status(Status.ERROR), null);
    }
};

/**
 * Validates shipping address when customer selects shipping contact in Apple Pay sheet
 * Restricts shipping to the country matching the current locale and filters shipping methods
 * 
 * @param {dw.order.Basket} basket - the basket being checked out
 * @param {Object} event - ApplePayShippingContactSelectedEvent object
 * @param {Object} response - JS object containing Apple Pay event callback parameters
 * @returns {dw.extensions.applepay.ApplePayHookResult} result
 */
exports.shippingContactSelected = function (basket, event, response) {
    var ApplePayHookResult = require('dw/extensions/applepay/ApplePayHookResult');
    
    try {
        // Get the shipping address country from the event
        var shippingContact = event.shippingContact;
        if (!shippingContact || !shippingContact.countryCode) {
            // If no country code provided, let it proceed (will be caught later)
            return new ApplePayHookResult(new Status(Status.OK), null);
        }
        
        var selectedCountry = shippingContact.countryCode.toUpperCase();
        
        // Get the expected country from the current locale (e.g., en_US -> US, en_CA -> CA)
        var currentLocaleCountry = request.locale.slice(-2).toUpperCase();
        
        // Validate that the selected shipping country matches the locale country
        if (selectedCountry !== currentLocaleCountry) {
            Logger.warn('Apple Pay shipping address rejected - Selected country {0} does not match locale country {1}', 
                selectedCountry, currentLocaleCountry);
            
            // Return error status with proper reason detail for Apple Pay
            var error = new Status(Status.ERROR);
            error.addDetail(
                ApplePayHookResult.STATUS_REASON_DETAIL_KEY,
                ApplePayHookResult.REASON_SHIPPING_ADDRESS
            );
            
            return new ApplePayHookResult(error, null);
        }

        // Filter shipping methods to only show methods applicable to the current locale country
        if (response && response.shippingMethods && response.shippingMethods.length > 0) {
            var filteredMethods = [];
            
            for (var i = 0; i < response.shippingMethods.length; i++) {
                var method = response.shippingMethods[i];
                
                // Get the shipping method from SFCC to check its applicable countries
                var ShippingMgr = require('dw/order/ShippingMgr');
                var shippingMethod = ShippingMgr.getShippingMethod(method.identifier);
                
                if (shippingMethod) {
                    var applicableCountries = shippingMethod.getApplicableShippingCountries();
                    
                    // If no countries configured, include the method (assume it's valid)
                    if (!applicableCountries || applicableCountries.length === 0) {
                        filteredMethods.push(method);
                    } else {
                        // Check if current locale country is in the applicable countries
                        var isApplicable = false;
                        var iterator = applicableCountries.iterator();
                        
                        while (iterator.hasNext()) {
                            var country = iterator.next();
                            if (country.toUpperCase() === currentLocaleCountry) {
                                isApplicable = true;
                                break;
                            }
                        }
                        
                        if (isApplicable) {
                            filteredMethods.push(method);
                        }
                    }
                } else {
                    // If shipping method not found, include it to avoid breaking the flow
                    filteredMethods.push(method);
                }
            }
            
            // Update response with filtered shipping methods
            response.shippingMethods = filteredMethods;
            
            Logger.debug('Apple Pay shipping methods filtered - Locale: {0}, Original count: {1}, Filtered count: {2}',
                currentLocaleCountry, response.shippingMethods.length, filteredMethods.length);
        }

        // Country matches locale, proceed normally
        return new ApplePayHookResult(new Status(Status.OK), null);
        
    } catch (e) {
        Logger.error('Apple Pay shippingContactSelected failed: {0}', e instanceof Error ? e.message : String(e));
        
        var expError = new Status(Status.ERROR);
        expError.addDetail(
            ApplePayHookResult.STATUS_REASON_DETAIL_KEY,
            ApplePayHookResult.REASON_FAILURE
        );
        
        return new ApplePayHookResult(expError, null);
    }
};

exports.cancel = function () {
    var ApplePayHookResult = require('dw/extensions/applepay/ApplePayHookResult');
    return new ApplePayHookResult(new Status(Status.OK), null);
};