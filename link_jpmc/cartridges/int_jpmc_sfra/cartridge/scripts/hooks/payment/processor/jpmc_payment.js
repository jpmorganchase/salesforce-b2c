'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'jpmc_payment');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentMgr = require('dw/order/PaymentMgr');
var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');

/**
 * Clears sensitive payment data (CVV, encrypted card data) from session.privacy
 */
function clearSensitivePaymentData() {
    try {
        session.privacy.jpmcEncryptedCvv = null;
        session.privacy.jpmcEncryptedData = null;
    } catch (e) {
        Logger.error('clearSensitivePaymentData: Failed to clear session - {0}', e.message || String(e));
    }
}

/**
 * Extracts the first successful SAFETECH token from a verification response
 * @param {Object} verificationData - JPMC verification API response
 * @returns {string|null} SAFETECH token or null
 */
function extractSafetechToken(verificationData) {
    var tokens = verificationData
        && verificationData.paymentMethodType
        && verificationData.paymentMethodType.card
        && verificationData.paymentMethodType.card.paymentTokens;

    if (!tokens) {
        return null;
    }

    for (var i = 0; i < tokens.length; i++) {
        if (tokens[i].tokenProvider === 'SAFETECH'
            && tokens[i].responseStatus === 'SUCCESS'
            && tokens[i].tokenNumber) {
            return tokens[i].tokenNumber;
        }
    }

    return null;
}

/**
 * Extracts payment information from billing form including PIE encrypted data
 * @param {Object} req - current request object
 * @param {Object} paymentForm - billing payment form
 * @param {Object} viewFormData - view data to extend
 * @returns {Object} processed form result
 */
function processForm(req, paymentForm, viewFormData) {
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');

    var paymentMethodValue = paymentForm.paymentMethod.value;
    if (paymentMethodValue === jpmcConstants.JPMC_GOOGLE_PAY) {
        var googlePayHook = require('*/cartridge/scripts/hooks/payment/processor/jpmc_googlepay');
        return googlePayHook.processForm(req, paymentForm, viewFormData);
    }

    // DROP_IN: the SDK collects and processes payment — no card fields on the SFRA form.
    if (paymentMethodValue === jpmcConstants.JPMC_DROP_IN) {
        var viewDataDropIn = viewFormData;
        viewDataDropIn.paymentMethod = {
            value: jpmcConstants.JPMC_DROP_IN,
            htmlName: paymentForm.paymentMethod.htmlName
        };
        return { error: false, viewData: viewDataDropIn };
    }

    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var array = require('*/cartridge/scripts/util/array');
    
    var viewData = viewFormData;
    var creditCardFields = paymentForm.creditCardFields;

    if (!req.form.storedPaymentUUID) {
        var creditCardErrors = COHelpers.validateCreditCard(paymentForm);
        if (Object.keys(creditCardErrors).length) {
            return { fieldErrors: creditCardErrors, error: true };
        }
    }

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    viewData.paymentInformation = {
        cardNumber: { value: creditCardFields.cardNumber.value, htmlName: creditCardFields.cardNumber.htmlName },
        cardType: { value: creditCardFields.cardType.value, htmlName: creditCardFields.cardType.htmlName },
        securityCode: { value: creditCardFields.securityCode.value, htmlName: creditCardFields.securityCode.htmlName },
        expirationMonth: { value: parseInt(creditCardFields.expirationMonth.selectedOption, 10), htmlName: creditCardFields.expirationMonth.htmlName },
        expirationYear: { value: parseInt(creditCardFields.expirationYear.value, 10), htmlName: creditCardFields.expirationYear.htmlName }
    };

    if (req.form.storedPaymentUUID) {
        viewData.storedPaymentUUID = req.form.storedPaymentUUID;
    }

    viewData.saveCard = creditCardFields.saveCard.checked;

    if (viewData.storedPaymentUUID && req.currentCustomer.raw.authenticated && req.currentCustomer.raw.registered) {
        var paymentInstrument = array.find(req.currentCustomer.wallet.paymentInstruments, function (item) {
            return viewData.storedPaymentUUID === item.UUID;
        });
        if (paymentInstrument) {
            viewData.paymentInformation.cardNumber.value = paymentInstrument.creditCardNumber;
            viewData.paymentInformation.cardType.value = paymentInstrument.creditCardType;
            viewData.paymentInformation.securityCode.value = req.form.securityCode;
            viewData.paymentInformation.expirationMonth.value = paymentInstrument.creditCardExpirationMonth;
            viewData.paymentInformation.expirationYear.value = paymentInstrument.creditCardExpirationYear;
            viewData.paymentInformation.creditCardToken = paymentInstrument.raw.creditCardToken;
            viewData.paymentInformation.storedPaymentUUID = viewData.storedPaymentUUID;
        }
    }

    var encryptedDataValue = creditCardFields.encryptedData && creditCardFields.encryptedData.value;
    if (encryptedDataValue) {
        viewData.paymentInformation.encryptedData = { value: encryptedDataValue };
    }
    viewData.paymentInformation.saveCard = creditCardFields.saveCard.checked;

    return { error: false, viewData: viewData };
}


/**
 * Save the credit card information to login account if save card option is selected
 * @param {Object} req - current request object
 * @param {dw.order.Basket} basket - current basket
 * @param {Object} billingData - billing form data
 */
function savePaymentInformation(req, basket, billingData) {
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');

    if (billingData.paymentMethod && billingData.paymentMethod.value === jpmcConstants.JPMC_GOOGLE_PAY) {
        return;
    }

    if (!billingData.storedPaymentUUID
        && req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered
        && billingData.saveCard
        && (billingData.paymentMethod.value === 'CREDIT_CARD' && session.privacy.jpmcCardSafeTechToken)
    ) {
        var customer = CustomerMgr.getCustomerByCustomerNumber(
            req.currentCustomer.profile.customerNo
        );

        var saveCardResult = COHelpers.savePaymentInstrumentToWallet(
            billingData,
            basket,
            customer
        );

        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = JPMCMerchantResolver.resolve();
        if (resolvedConfig && resolvedConfig.merchantId) {
            Transaction.wrap(function () {
                saveCardResult.custom.jpmcMerchantId = resolvedConfig.merchantId;
            });
        }

        req.currentCustomer.wallet.paymentInstruments.push({
            creditCardHolder: saveCardResult.creditCardHolder,
            maskedCreditCardNumber: saveCardResult.maskedCreditCardNumber,
            creditCardType: saveCardResult.creditCardType,
            creditCardExpirationMonth: saveCardResult.creditCardExpirationMonth,
            creditCardExpirationYear: saveCardResult.creditCardExpirationYear,
            UUID: saveCardResult.UUID,
            creditCardNumber: Object.hasOwnProperty.call(
                saveCardResult,
                'creditCardNumber'
            )
                ? saveCardResult.creditCardNumber
                : null,
            raw: saveCardResult
        });
    }
}

/**
 * Validates PIE encrypted data and creates payment instrument on basket
 * @param {dw.order.Basket} basket - current basket
 * @param {Object} paymentInformation - billing form payment data
 * @param {string} paymentMethodID - payment method identifier
 * @param {Object} req - request object
 * @returns {Object} result
 */
function Handle(basket, paymentInformation, paymentMethodID, req) {
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');

    if (paymentMethodID === jpmcConstants.JPMC_GOOGLE_PAY) {
        var googlePayHook = require('*/cartridge/scripts/hooks/payment/processor/jpmc_googlepay');
        return googlePayHook.Handle(basket, paymentInformation, paymentMethodID, req);
    }

    // DROP_IN: SDK handles payment — just create the placeholder instrument.
    // No PIE encryption or card-data validation required at this stage.
    if (paymentMethodID === jpmcConstants.JPMC_DROP_IN) {
        var dropInCollections = require('*/cartridge/scripts/util/collections');
        Transaction.wrap(function () {
            var existingInstruments = basket.getPaymentInstruments();
            dropInCollections.forEach(existingInstruments, function (item) {
                basket.removePaymentInstrument(item);
            });
            basket.createPaymentInstrument(jpmcConstants.JPMC_DROP_IN, basket.totalGrossPrice);
        });
        return { fieldErrors: [], serverErrors: [], error: false };
    }

    var collections = require('*/cartridge/scripts/util/collections');
    
    var serverErrors = [];
    var cardType = paymentInformation.cardType.value;
    var isStoredCard = !!paymentInformation.storedPaymentUUID;
    var isSaveCardChecked = paymentInformation.saveCard;
    var encrypted = null;
    var errorMsg;
    session.privacy.jpmcCardSafeTechToken = null;
    if (paymentMethodID === PaymentInstrument.METHOD_CREDIT_CARD) {
        var creditCardPaymentMethod = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD);
        
        if (!creditCardPaymentMethod) {
            return { 
                fieldErrors: [], 
                serverErrors: [Resource.msg('error.payment.not.valid', 'checkout', null)], 
                error: true 
            };
        }
        
        var paymentCardValue = PaymentMgr.getPaymentCard(cardType);
        
        if (!paymentCardValue) {
            return { 
                fieldErrors: [], 
                serverErrors: [Resource.msg('error.payment.not.valid', 'checkout', null)], 
                error: true 
            };
        }
        
        var applicablePaymentCards = creditCardPaymentMethod.getApplicablePaymentCards(
            req.currentCustomer.raw,
            req.geolocation.countryCode,
            null
        );

        if (!applicablePaymentCards.contains(paymentCardValue)) {
            return { 
                fieldErrors: [], 
                serverErrors: [Resource.msg('error.payment.not.valid', 'checkout', null)], 
                error: true 
            };
        }
    }
    if (!isStoredCard) {
        try {
            if (!paymentInformation.encryptedData || !paymentInformation.encryptedData.value) {
                Logger.error('Handle: JPMC encrypted data missing');
                serverErrors.push(Resource.msg('error.payment.encryption.missing', 'checkout', null));
                return { fieldErrors: [], serverErrors: serverErrors, error: true };
            }
            encrypted = JSON.parse(paymentInformation.encryptedData.value);
            if (!encrypted.accountNumber || !encrypted.cvv) {
                Logger.error('Handle: Invalid encrypted data structure');
                serverErrors.push(Resource.msg('error.payment.encryption.invalid', 'checkout', null));
                return { fieldErrors: [], serverErrors: serverErrors, error: true };
            }
        } catch (e) {
            errorMsg = e instanceof Error ? e.message : String(e);
            Logger.error('Handle: Failed to parse encrypted data: {0}', errorMsg);
            serverErrors.push(Resource.msg('error.payment.encryption.invalid', 'checkout', null));
            return { fieldErrors: [], serverErrors: serverErrors, error: true };
        }
    }
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    var resolvedConfig = JPMCMerchantResolver.resolve();
    var storedCardTokenType = (resolvedConfig && resolvedConfig.tokenizationType)
        ? resolvedConfig.tokenizationType
        : jpmcConstants.DEFAULT_TOKEN_TYPE;

    if (isStoredCard && req.currentCustomer.raw.authenticated && req.currentCustomer.raw.registered) {
        var array = require('*/cartridge/scripts/util/array');
        var storedPI = array.find(req.currentCustomer.wallet.paymentInstruments, function (item) {
            return paymentInformation.storedPaymentUUID === item.UUID;
        });
        if (storedPI && storedPI.raw && storedPI.raw.custom && storedPI.raw.custom.jpmcMerchantId) {
            var cardMerchantId = storedPI.raw.custom.jpmcMerchantId;
            if (resolvedConfig.merchantId && cardMerchantId !== resolvedConfig.merchantId) {
                serverErrors.push(Resource.msg('error.payment.not.valid', 'checkout', null));
                return { fieldErrors: [], serverErrors: serverErrors, error: true };
            }
        }
    }

    var paymentInstrument = null;
    Transaction.wrap(function () {
        var paymentInstruments = basket.getPaymentInstruments(PaymentInstrument.METHOD_CREDIT_CARD);
        collections.forEach(paymentInstruments, function (item) {
            basket.removePaymentInstrument(item);
        });

        var existingGPayInstruments = basket.getPaymentInstruments(jpmcConstants.JPMC_GOOGLE_PAY);
        collections.forEach(existingGPayInstruments, function (item) {
            basket.removePaymentInstrument(item);
        });

        paymentInstrument = basket.createPaymentInstrument(
            PaymentInstrument.METHOD_CREDIT_CARD, 
            basket.totalGrossPrice
        );

        var billingAddress = basket.getBillingAddress();
        if (billingAddress && billingAddress.fullName) {
            paymentInstrument.setCreditCardHolder(billingAddress.fullName);
        }
        
        paymentInstrument.setCreditCardNumber(
            isStoredCard ? paymentInformation.cardNumber.value : encrypted.accountNumber
        );
        paymentInstrument.setCreditCardType(cardType);
        paymentInstrument.setCreditCardExpirationMonth(paymentInformation.expirationMonth.value);
        paymentInstrument.setCreditCardExpirationYear(paymentInformation.expirationYear.value);


        if (isStoredCard) {
            paymentInstrument.setCreditCardToken(paymentInformation.creditCardToken);
        }
        

        if (req.form.kountSessionId) {
            paymentInstrument.custom.kountSessionId = req.form.kountSessionId;
        }

        if (resolvedConfig && resolvedConfig.merchantId) {
            paymentInstrument.custom.jpmcMerchantId = resolvedConfig.merchantId;
        }
    });

  
    if (isStoredCard) {
        session.privacy.jpmcEncryptedCvv = null;
        session.privacy.jpmcEncryptedData = null;
    } else if (encrypted) {
        session.privacy.jpmcEncryptedCvv = encrypted.cvv || null;
        session.privacy.jpmcEncryptedData = JSON.stringify(encrypted);
    }
    var HookMgr = require('dw/system/HookMgr');
    if (HookMgr.hasHook('app.safetech.fraud.detection')) {
        var accountNumberType = isStoredCard ? storedCardTokenType : jpmcConstants.ACCOUNT_NUMBER_TYPE_PIE;
        
        var fraudDetectionResult = HookMgr.callHook(
            'app.safetech.fraud.detection',
            'fraudDetection',
            basket,
            paymentInstrument,
            { accountNumberType: accountNumberType, resolvedConfig: resolvedConfig }
        );
        if (fraudDetectionResult.fraudRuleAction) {
            Transaction.wrap(function () {
                paymentInstrument.custom.jpmcFraudRuleAction = fraudDetectionResult.fraudRuleAction;
            });
        }
        if (fraudDetectionResult.status === 'fail') {
            Transaction.wrap(function () {
                basket.removePaymentInstrument(paymentInstrument);
            });
            clearSensitivePaymentData();
            Logger.warn('Handle: Fraud detection declined payment for order in progress');
            serverErrors.push(Resource.msg('error.fraud.declined', 'checkout', null));
            return { fieldErrors: [], serverErrors: serverErrors, error: true };
        }
    }
    var safetechToken = null;
    try {
        var JPMCPaymentHelper = require('*/cartridge/scripts/helpers/JPMCPaymentHelper');
        var accountOnFile;
        if (isStoredCard) {
            accountOnFile = 'STORED';
        } else if (isSaveCardChecked) {
            accountOnFile = 'TO_BE_STORED';
        } else {
            accountOnFile = 'NOT_STORED';
        }
        var cardData = {
            accountNumber: isStoredCard ? paymentInformation.creditCardToken : encrypted.accountNumber,
            expirationMonth: paymentInformation.expirationMonth.value,
            expirationYear: paymentInformation.expirationYear.value
        };
        if (!isStoredCard) {
            cardData.cvv = encrypted.cvv;
            if (encrypted.encryptionIntegrityCheck) {
                cardData.encryptionIntegrityCheck = encrypted.encryptionIntegrityCheck;
            }
        }
        // Skip verification for stored cards - already verified at save time
        if (!isStoredCard) {
            var verificationOptions = {
                currency: basket.getCurrencyCode(),
                billingAddress: basket.getBillingAddress(),
                email: basket.getCustomerEmail(),
                initiatorType: 'CARDHOLDER',
                accountOnFile: accountOnFile,
                accountNumberType: jpmcConstants.ACCOUNT_NUMBER_TYPE_PIE,
                resolvedConfig: resolvedConfig
            };
            var verifyResult = JPMCPaymentHelper.verifyPaymentInstrument(cardData, verificationOptions);
            
            if (!verifyResult.success) {
                Logger.error('Handle: JPMC verification failed for order in progress');
                clearSensitivePaymentData();
                serverErrors.push(Resource.msg('error.payment.verification.failed', 'checkout', null));
                return { fieldErrors: [], serverErrors: serverErrors, error: true };
            }
            if (verifyResult.data) {
                safetechToken = extractSafetechToken(verifyResult.data);
                if (safetechToken && isSaveCardChecked) {
                    session.privacy.jpmcCardSafeTechToken = safetechToken;
                }
            }

            // Store cardTypeName if available, otherwise fallback to cardType (short code)
            var cardTypeName = verifyResult.data
                && verifyResult.data.paymentMethodType
                && verifyResult.data.paymentMethodType.card
                && verifyResult.data.paymentMethodType.card.cardTypeName;
            var cardTypeVal = verifyResult.data
                && verifyResult.data.paymentMethodType
                && verifyResult.data.paymentMethodType.card
                && verifyResult.data.paymentMethodType.card.cardType;
            var cardTypeValue = cardTypeName || cardTypeVal || jpmcConstants.PAYMENT_METHOD_DISPLAY_UNKNOWN;
        
            Transaction.wrap(function () {
                paymentInstrument.custom.jpmcCardTypeName = cardTypeValue;
            });

            if (!isSaveCardChecked) {
                session.privacy.jpmcCardSafeTechToken = null;
            }
            if (!isStoredCard && isSaveCardChecked && safetechToken) {
                Transaction.wrap(function () {
                    paymentInstrument.setCreditCardToken(safetechToken);
                });
            }
        }    
    } catch (e) {
        errorMsg = e instanceof Error ? e.message : String(e);
        Logger.error('Handle: JPMC verification exception - {0}', errorMsg);
        clearSensitivePaymentData();
        serverErrors.push(Resource.msg('error.payment.verification.exception', 'checkout', null));
        return { fieldErrors: [], serverErrors: serverErrors, error: true };
    }

    return { fieldErrors: {}, serverErrors: [], error: false };
}

/**
 * Authorizes payment via JPMC processor.
 * @param {string} orderNumber - order number to authorize
 * @param {dw.order.PaymentInstrument} paymentInstrument - payment instrument with card data
 * @param {dw.order.PaymentProcessor} paymentProcessor - JPMC payment processor
 * @returns {Object} authorization result
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var serverErrors = [];
    var fieldErrors = {};

    try {
        if (!paymentProcessor || !paymentProcessor.getID().equalsIgnoreCase(jpmcConstants.JPMC_Processor) || !paymentInstrument) {
            serverErrors.push(Resource.msg('error.payment.processor.not.supported', 'checkout', null));
            return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: true };
        }
        var paymentMethodID = paymentInstrument.getPaymentMethod();
        if (paymentMethodID === jpmcConstants.JPMC_GOOGLE_PAY) {
            var googlePayHook = require('*/cartridge/scripts/hooks/payment/processor/jpmc_googlepay');
            return googlePayHook.Authorize(orderNumber, paymentInstrument, paymentProcessor);
        }

        var jpmcTransactionHelpers = require('*/cartridge/scripts/helpers/JPMCTransactionHelpers');
        var authResult = jpmcTransactionHelpers.authorize(orderNumber, paymentInstrument, paymentProcessor);

        if (authResult.error) {
            return { fieldErrors: fieldErrors, serverErrors: authResult.serverErrors || [], error: true };
        }

        // Clear encrypted data if no 3DS required (direct auth success)
        if (!authResult.requires3DS) {
            clearSensitivePaymentData();
        }

        // Pass through 3DS data if present
        return {
            fieldErrors: fieldErrors,
            serverErrors: serverErrors,
            error: false,
            requires3DS: authResult.requires3DS,
            authenticationOrchestrationUrl: authResult.authenticationOrchestrationUrl,
            transactionId: authResult.transactionId,
            authenticationId: authResult.authenticationId,
            captureMethod: authResult.captureMethod
        };
    } catch (e) {
        var errorMsg = e instanceof Error ? e.message : String(e);
        Logger.error('Authorize failed: {0}', errorMsg);
        serverErrors.push(Resource.msg('error.technical', 'checkout', null));
        return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: true };
    }
}

/**
 * Creates a SAFETECH token for My Account Save Payment flow
 * @returns {string} result
 * @throws {Error}
 */
function createToken() {
    var JPMCPaymentHelper = require('*/cartridge/scripts/helpers/JPMCPaymentHelper');
    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

    var resolvedConfig = JPMCMerchantResolver.resolve();

    var creditCardForm = session.forms.creditCard;
    var encryptedDataValue = creditCardForm.encryptedData.value;

    if (!encryptedDataValue) {
        Logger.error('createToken: Encrypted data missing from form');
        throw new Error('Payment data is missing');
    }

    var encrypted;
    try {
        encrypted = JSON.parse(encryptedDataValue);
    } catch (e) {
        Logger.error('createToken: Failed to parse encrypted data - {0}', e instanceof Error ? e.message : String(e));
        throw new Error('Payment data is invalid');
    }

    if (!encrypted.accountNumber || !encrypted.cvv) {
        Logger.error('createToken: Invalid encrypted data structure - accountNumber and cvv required');
        throw new Error('Payment data is incomplete');
    }

    var cardData = {
        accountNumber: encrypted.accountNumber,
        cvv: encrypted.cvv,
        expirationMonth: creditCardForm.expirationMonth.value,
        expirationYear: creditCardForm.expirationYear.value
    };

    if (encrypted.encryptionIntegrityCheck) {
        cardData.encryptionIntegrityCheck = encrypted.encryptionIntegrityCheck;
    }
    if ((resolvedConfig && resolvedConfig.enableFraudCheck === true)) {
        var fraudCheckOptions = {
            accountNumberType: jpmcConstants.ACCOUNT_NUMBER_TYPE_PIE,
            kountSessionId: creditCardForm.kountSessionId ? creditCardForm.kountSessionId.value : null,
            resolvedConfig: resolvedConfig
        };
        var fraudResult = JPMCPaymentHelper.performFraudCheckForCardSave(cardData, fraudCheckOptions);

        if (fraudResult.success && fraudResult.riskDecision) {
            var fraudRuleAction = fraudResult.riskDecision.fraudRuleAction;

            if (fraudRuleAction === 'D') {
                throw new Error('Card could not be saved due to security reasons. Please contact customer service.');
            }
        } else if (!fraudResult.success) {
            Logger.warn('createToken: Fraud check service error (fail-open) - continuing with card save');
        }
    }
    var verificationOptions = {
        accountNumberType: jpmcConstants.ACCOUNT_NUMBER_TYPE_PIE,
        resolvedConfig: resolvedConfig
    };

    var verifyResult = JPMCPaymentHelper.verifyPaymentInstrument(cardData, verificationOptions);

    if (!verifyResult.success) {
        throw new Error('Payment verification failed');
    }
    var safetechToken = extractSafetechToken(verifyResult.data);
    if (safetechToken) {
        return safetechToken;
    }
    throw new Error('Payment verification failed');
}

exports.processForm = processForm;
exports.Handle = Handle;
exports.Authorize = Authorize;
exports.savePaymentInformation = savePaymentInformation;
exports.createToken = createToken;
exports.clearSensitivePaymentData = clearSensitivePaymentData;
