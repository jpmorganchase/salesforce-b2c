/**
 * JPMC Payload Builder
 * Generates request payloads for JPMC API calls (capture, refund, etc.)
 * 
 * @module scripts/helpers/JPMCPayloadBuilder
 */

'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'payload');

/**
 * ISO 4217 zero-decimal currencies — amounts sent as-is (no * 100).
 * @private
 */
var ZERO_DECIMAL_CURRENCIES = {
    BIF: true, CLP: true, DJF: true, GNF: true, ISK: true,
    JPY: true, KMF: true, KRW: true, MGA: true, PYG: true,
    RWF: true, UGX: true, VND: true, VUV: true, XAF: true,
    XOF: true, XPF: true
};

/**
 * Converts an amount to the minor unit required by the API.
 * For standard currencies (e.g. USD, GBP) multiplies by 100.
 * For zero-decimal currencies (e.g. JPY, KRW) returns the value as-is.
 *
 * @param {number} amount - amount to convert
 * @param {string} [currencyCode] - ISO 4217 currency code (e.g. 'USD', 'JPY')
 * @returns {number} amount in the currency's minor unit
 * @private
 */
function convertToCents(amount, currencyCode) {
    if (currencyCode && ZERO_DECIMAL_CURRENCIES[currencyCode.toUpperCase()]) {
        return Math.round(amount);
    }
    return Math.round(amount * 100);
}

/**
 * Builds merchant object with software details from configuration.
 * @returns {Object} merchant object with merchantSoftware details
 */
function buildMerchantObject() {
    var System = require('dw/system/System');
    var Site = require('dw/system/Site');
    var constants = require('*/cartridge/scripts/helpers/JPMCConstants');

    var softwareCompany = constants.DEFAULT_COMPANY_NAME;
    var softwareProduct = constants.DEFAULT_PRODUCT_NAME;
    var softwareVersion = constants.DEFAULT_VERSION;

    var merchantSoftware = {
        companyName: softwareCompany,
        productName: softwareProduct,
        version: softwareVersion
    };

    var realmId = System.getPreferences().getCustom().jpmcRealmId;
    var siteId = Site.getCurrent().getID();
    var parts = [];
    
    if (realmId) {
        parts.push('realm=' + realmId);
    }
    if (siteId) {
        parts.push('site=' + siteId);
    }
    
    merchantSoftware.softwareId = parts.join('|');

    return {
        merchantSoftware: merchantSoftware
    };
}
/**
 * Formats phone number for JPMC API (digits only, max 12 chars).
 * Sets countryCode when the address country is in the PHONE_COUNTRY_CODES map
 * (US, CA and all EU member states).
 *
 * @param {string} phone - raw phone number string
 * @param {string} [countryAlpha2] - ISO 3166 Alpha-2 country code (e.g. 'US', 'CA')
 * @returns {Object} formatted phone object with subscriber and countryCode
 * @private
 */
function formatPhoneNumber(phone, countryAlpha2) {
    if (!phone) {
        return null;
    }

    var phoneObj = {
        phoneNumber: phone.replace(/[^0-9]/g, '').substring(0, 12)
    };

    if (countryAlpha2) {
        var jpmcConst = require('*/cartridge/scripts/helpers/JPMCConstants');
        var code = countryAlpha2.toUpperCase();
        var phoneCountryCodes = jpmcConst.PHONE_COUNTRY_CODES || {};
        var dialCode = phoneCountryCodes[code];
        if (dialCode) {
            phoneObj.countryCode = dialCode;
        }
    }

    return phoneObj;
}

/**
 * Converts ISO 3166 Alpha-2 country code to Alpha-3
 * JPMC API requires Alpha-3 country codes; SFCC stores Alpha-2
 *
 * @param {string} alpha2 - ISO 3166 Alpha-2 country code (e.g. 'US')
 * @returns {string} Alpha-3 country code (e.g. 'USA')
 * @private
 */
function toAlpha3CountryCode(alpha2) {
    var map = {
        US: 'USA', CA: 'CAN', GB: 'GBR', MX: 'MEX', AU: 'AUS',
        DE: 'DEU', FR: 'FRA', IT: 'ITA', ES: 'ESP', NL: 'NLD',
        BR: 'BRA', JP: 'JPN', CN: 'CHN', IN: 'IND', KR: 'KOR',
        SG: 'SGP', HK: 'HKG', NZ: 'NZL', IE: 'IRL', CH: 'CHE',
        SE: 'SWE', NO: 'NOR', DK: 'DNK', FI: 'FIN', AT: 'AUT',
        BE: 'BEL', PT: 'PRT', PL: 'POL', CZ: 'CZE', ZA: 'ZAF',
        AE: 'ARE', SA: 'SAU', IL: 'ISR', TW: 'TWN', PH: 'PHL',
        TH: 'THA', MY: 'MYS', ID: 'IDN', VN: 'VNM', CL: 'CHL',
        CO: 'COL', AR: 'ARG', PE: 'PER', RO: 'ROU', HU: 'HUN',
        GR: 'GRC', RU: 'RUS', TR: 'TUR', UA: 'UKR', EG: 'EGY'
    };
    var code = alpha2 ? alpha2.toUpperCase() : '';
    var mapped = map[code];
    if (code && !mapped) {
        Logger.warn('toAlpha3CountryCode: No ISO-3166 alpha-3 mapping for country code "{0}". Falling back to alpha-2. Add this country to the mapping table.', code);
    }
    return mapped || code;
}

/**
 * Builds fraudCheckShoppingCart string from basket or order line items.
 * @param {dw.order.Basket|dw.order.Order} basketOrOrder - basket or order containing line items
 * @returns {string} URL-encoded shopping cart string for fraud scoring
 * @private
 */
function buildFraudCheckShoppingCart(basketOrOrder) {
    try {
        var items = [];
        var productLineItems = basketOrOrder.getAllProductLineItems();
        var iterator = productLineItems.iterator();
        
        while (iterator.hasNext()) {
            var pli = iterator.next();
            var product = pli.getProduct();
            
            if (!product) {
                continue;
            }
            
            var productType = product.getClassificationCategory() 
                ? product.getClassificationCategory().getDisplayName() 
                : 'Product';
            var itemId = pli.getProductID() || pli.getProductName();
            var description = pli.getProductName() || product.getName() || 'Item';
            var quantity = pli.getQuantityValue();
            var priceValue = pli.getAdjustedPrice().getValue();
            var priceCents = Math.round(priceValue * 100);
            
            var encodedType = encodeURIComponent(productType);
            var encodedItemId = encodeURIComponent(itemId);
            var encodedDescription = encodeURIComponent(description);
            
            var itemString = 'T=' + encodedType + 
                           '&I=' + encodedItemId + 
                           '&D=' + encodedDescription + 
                           '&Q=' + quantity + 
                           '&P=' + priceCents + '&|';
            
            items.push(itemString);
        }
        
        var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');
        var CART_MAX = jpmcConstants.FRAUD_CART_MAX_LENGTH;
        var shoppingCartString = items.join('');
        
        if (shoppingCartString.length > CART_MAX) {
            Logger.warn('Shopping cart string exceeds {0} characters ({1}), truncating', CART_MAX, shoppingCartString.length);
            shoppingCartString = shoppingCartString.substring(0, CART_MAX);
        }
        
        return shoppingCartString;
    } catch (e) {
        Logger.warn('Error building shopping cart string: {0}', e instanceof Error ? e.message : String(e));
        return '';
    }
}

/**
 * Builds capture request payload per JPMC API specification
 * 
 * @param {Object} params - capture request parameters
 * @param {dw.order.Order} params.order - order to capture
 * @param {number} params.amount - capture amount in dollars
 * @param {boolean} [params.isFinal=true] - whether this is a final capture
 * @param {Object} [params.multiCapture] - multi-capture settings
 * @param {number} [params.multiCapture.sequenceNumber] - capture sequence number
 * @param {number} [params.multiCapture.recordCount] - total number of captures
 * @param {boolean} [params.multiCapture.isFinal] - whether this is the final capture in sequence
 * @returns {Object} capture request payload
 */
function buildCapturePayload(params) {
    if (!params || !params.order || params.amount === undefined) {
        throw new Error('Order and amount are required for capture payload');
    }

    var payload = {
        amount: convertToCents(params.amount, params.order.getCurrencyCode()),
        currency: params.order.getCurrencyCode(),
        merchant: buildMerchantObject()
    };
    if (params.multiCapture) {
        var seqNum = params.multiCapture.sequenceNumber || 1;
        var isFinal = params.multiCapture.isFinal || false;
        var jpmcConst = require('*/cartridge/scripts/helpers/JPMCConstants');
        payload.multiCapture = {
            multiCaptureSequenceNumber: String(seqNum),
            multiCaptureRecordCount: isFinal ? seqNum : jpmcConst.MULTI_CAPTURE_MAX_RECORD_COUNT,
            isFinalCapture: isFinal
        };
    } else {
        payload.isAmountFinal = (params.isFinal !== undefined) ? params.isFinal : true;
    }

    return payload;
}

/**
 * Builds refund request payload per JPMC API specification
 * @param {Object} params - refund request parameters
 * @param {string} params.transactionReferenceId - original transaction reference ID
 * @param {number} [params.amount] - refund amount in dollars (omit for full refund)
 * @param {string} [params.currency] - currency code (e.g. 'USD')
 * @param {string} [params.reason] - reason for refund
 * @returns {Object} refund request payload
 */
function buildRefundPayload(params) {
    if (!params || !params.transactionReferenceId) {
        throw new Error('Transaction reference ID is required for refund payload');
    }

    var payload = {
        paymentMethodType: {
            transactionReference: {
                transactionReferenceId: params.transactionReferenceId
            }
        },
        merchant: buildMerchantObject()
    };

    if (params.amount !== undefined && params.amount !== null && params.currency) {
        payload.amount = convertToCents(params.amount, params.currency);
        payload.currency = params.currency;
    }

    return payload;
}

/**
 * Builds fraud check request payload per JPMC API specification
 * 
 * @param {Object} params - fraud check request parameters
 * @param {dw.order.Basket|dw.order.Order} params.basketOrOrder - basket or order to check
 * @param {dw.order.PaymentInstrument} params.paymentInstrument - payment instrument with card data
 * @param {string} [params.deviceIPAddress] - customer device IP address
 * @param {Object} [params.fraudScore] - fraud scoring parameters
 * @param {string} [params.fraudScore.cardholderBrowserInformation] - cardholder browser info
 * @param {boolean} [params.fraudScore.isFraudRuleReturn] - whether to return fraud rule details
 * @param {string} [params.fraudScore.fraudCheckShoppingCart] - shopping cart XML for fraud check
 * @param {string} [params.fraudScore.sessionId] - Kount session identifier
 * @param {string} [params.fraudScore.websiteRootDomainName] - merchant website domain
 * @param {number} [params.fraudScore.fencibleItemAmount] - fencible item total amount
 * @param {string} [params.fraudScore.aNITelephoneNumber] - ANI telephone number
 * @param {string} [params.accountNumberType] - account number type
 * @returns {Object} fraud check payload
 */
function buildFraudCheckPayload(params) {
    if (!params || !params.basketOrOrder) {
        throw new Error('Basket or order is required for fraud check payload');
    }

    if (!params.paymentInstrument) {
        throw new Error('Payment instrument is required for fraud check payload');
    }

    var basketOrOrder = params.basketOrOrder;
    var pi = params.paymentInstrument;
    
    var payload = {
        amount: convertToCents(basketOrOrder.getTotalGrossPrice().value, basketOrOrder.getCurrencyCode()),
        currency: basketOrOrder.getCurrencyCode(),
        accountHolder: buildAccountHolderObject(basketOrOrder, params.deviceIPAddress, 'deviceIPAddress'),
        paymentMethodType: buildPaymentMethodTypeObject(pi, params),
        merchant: buildMerchantObject()
    };

    var autoShoppingCart;
    if (params.fraudScore) {
        payload.fraudScore = {};

        if (params.fraudScore.cardholderBrowserInformation) {
            payload.fraudScore.cardholderBrowserInformation = params.fraudScore.cardholderBrowserInformation;
        }
        
        if (params.fraudScore.isFraudRuleReturn !== undefined) {
            payload.fraudScore.isFraudRuleReturn = params.fraudScore.isFraudRuleReturn;
        }
        
        if (params.fraudScore.fraudCheckShoppingCart) {
            payload.fraudScore.fraudCheckShoppingCart = params.fraudScore.fraudCheckShoppingCart;
        } else {
            autoShoppingCart = buildFraudCheckShoppingCart(basketOrOrder);
            if (autoShoppingCart) {
                payload.fraudScore.fraudCheckShoppingCart = autoShoppingCart;
            }
        }

        if (params.fraudScore.sessionId) {
            payload.fraudScore.sessionId = params.fraudScore.sessionId;
        }
        
        if (params.fraudScore.fencibleItemAmount !== undefined) {
            payload.fraudScore.fencibleItemAmount = convertToCents(params.fraudScore.fencibleItemAmount, basketOrOrder.getCurrencyCode());
        }
        
        if (params.fraudScore.aNITelephoneNumber) {
            payload.fraudScore.aNITelephoneNumber = params.fraudScore.aNITelephoneNumber;
        }
    } else {
        payload.fraudScore = {};
        autoShoppingCart = buildFraudCheckShoppingCart(basketOrOrder);
        if (autoShoppingCart) {
            payload.fraudScore.fraudCheckShoppingCart = autoShoppingCart;
        }
    }

    var defaultShipment = basketOrOrder.getDefaultShipment();
    if (defaultShipment && defaultShipment.getShippingAddress()) {
        payload.shipTo = buildShipToObject(defaultShipment);
    }

    return payload;
}

/**
 * Builds fraud check payload for card save in My Account (minimal payload)
 * Used when customer saves a payment card to their wallet without an active basket/order
 * 
 * @param {Object} params - fraud check parameters
 * @param {Object} params.cardData - card data for fraud check
 * @param {string} params.cardData.accountNumber - encrypted or tokenized card number
 * @param {number} params.cardData.expirationMonth - card expiration month
 * @param {number} params.cardData.expirationYear - card expiration year
 * @param {string} [params.currency] - currency code (defaults to site currency)
 * @param {string} [params.accountNumberType='SAFETECH_TOKEN'] - card number encryption type
 * @param {string} [params.deviceIPAddress] - customer device IP address
 * @param {string} [params.customerEmail] - customer email address
 * @param {string} [params.browserInformation] - customer browser user agent
 * @param {string} [params.kountSessionId] - Kount fraud session identifier
 * @returns {Object} fraud check payload for card save
 */
function buildFraudCheckForCardSavePayload(params) {
    if (!params || !params.cardData || !params.cardData.accountNumber) {
        throw new Error('Card data with account number is required for fraud check payload');
    }

    var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');
    var card = params.cardData;
    var Site = require('dw/system/Site');
    var currency = params.currency || Site.getCurrent().getDefaultCurrency();
    var payload = {
        amount: 0,
        currency: currency,
        accountHolder: {
            deviceIPAddress: params.deviceIPAddress || jpmcConstants.FALLBACK_IP_ADDRESS
        },
        paymentMethodType: {
            card: {
                accountNumber: card.accountNumber,
                accountNumberType: params.accountNumberType,
                expiry: {
                    month: card.expirationMonth,
                    year: card.expirationYear
                },
                cvv: card.cvv
            }
        },
        merchant: buildMerchantObject(),
        fraudScore: {
            cardholderBrowserInformation: params.browserInformation || jpmcConstants.FALLBACK_USER_AGENT,
            isFraudRuleReturn: true
        }
    };
    if (params.customerEmail) {
        payload.accountHolder.email = params.customerEmail;
    }
    if (card.encryptionIntegrityCheck) {
        payload.paymentMethodType.card.encryptionIntegrityCheck = card.encryptionIntegrityCheck;
    }
    if (params.kountSessionId) {
        payload.fraudScore.sessionId = params.kountSessionId;
    }
    
    return payload;
}

/**
 * Builds accountHolder object for fraud check and payment authorization
 *
 * @param {dw.order.Basket|dw.order.Order} basketOrOrder - basket or order for account holder data
 * @param {string} [ipAddress] - customer IP address
 * @param {string} [ipAddressFieldName='deviceIPAddress'] - IP address field name in payload
 * @param {Object} [resolvedConfig] - resolved merchant configuration
 * @returns {Object} account holder payload object
 * @private
 */
function buildAccountHolderObject(basketOrOrder, ipAddress, ipAddressFieldName, resolvedConfig) {
    var accountHolder = {};
    var billingAddress = basketOrOrder.getBillingAddress();
    var customerEmail = basketOrOrder.getCustomerEmail();
    if (customerEmail) {
        accountHolder.email = customerEmail;
    }

    var shouldIncludeBillingAddress;
    if (ipAddressFieldName === 'deviceIPAddress') {
        shouldIncludeBillingAddress = true;
    } else if (resolvedConfig) {
        shouldIncludeBillingAddress = resolvedConfig.enableAVS !== false;
    } else {
        var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');
        shouldIncludeBillingAddress = JPMCConfig.isAVSEnabled();
    }

    if (billingAddress) {
        var firstName = billingAddress.getFirstName() || '';
        var lastName = billingAddress.getLastName() || '';
        if (firstName || lastName) {
            accountHolder.fullName = (firstName + ' ' + lastName).trim();
        }
        if (firstName) {
            accountHolder.firstName = firstName;
        }
        if (lastName) {
            accountHolder.lastName = lastName;
        }

        if (shouldIncludeBillingAddress) {
            accountHolder.billingAddress = buildAddressObject(billingAddress);
        }

        var phone = billingAddress.getPhone();
        if (phone) {
            accountHolder.phone = formatPhoneNumber(phone, billingAddress.getCountryCode().getValue());
        }
    }

    if (ipAddress) {
        var fieldName = ipAddressFieldName || 'deviceIPAddress';
        accountHolder[fieldName] = ipAddress;
    }

    return accountHolder;
}

/**
 * Builds address object for fraud check
 * 
 * @param {dw.order.OrderAddress} address - order address to format
 * @returns {Object} JPMC-formatted address object
 * @private
 */
function buildAddressObject(address) {
    var addressObj = {};

    if (address.getAddress1()) {
        addressObj.line1 = address.getAddress1().substring(0, 40);
    }

    if (address.getAddress2()) {
        addressObj.line2 = address.getAddress2().substring(0, 40);
    }

    if (address.getCity()) {
        addressObj.city = address.getCity().substring(0, 40);
    }

    if (address.getStateCode()) {
        addressObj.state = address.getStateCode().substring(0, 3);
    }

    if (address.getPostalCode()) {
        addressObj.postalCode = address.getPostalCode().substring(0, 12);
    }
    if (address.getCountryCode()) {
        addressObj.countryCode = toAlpha3CountryCode(address.getCountryCode().getValue());
    }

    return addressObj;
}

/**
 * Builds paymentMethodType object for fraud check
 * 
 * @param {dw.order.PaymentInstrument} paymentInstrument - payment instrument with card data
 * @param {Object} options - card processing options
 * @param {string} options.accountNumberType - encryption type (PIE, SAFETECH_TOKEN, PAN)
 * @param {string} [options.cvv] - card verification value
 * @param {string} [options.encryptedCvv] - PIE-encrypted CVV
 * @param {string} [options.encryptionIntegrityCheck] - encryption integrity check value
 * @returns {Object} payment method type payload
 * @private
 */
function buildPaymentMethodTypeObject(paymentInstrument, options) {
    var jpmcConst = require('*/cartridge/scripts/helpers/JPMCConstants');
    var paymentMethodType = {};
    var opts = options || {};
    var accountNumberType = opts.accountNumberType || jpmcConst.ACCOUNT_NUMBER_TYPE_PIE;
    var accountNumber;
    var creditCardToken = paymentInstrument.getCreditCardToken();
    
    if (accountNumberType === 'SAFETECH_PAGE_ENCRYPTION') {
        accountNumber = paymentInstrument.getCreditCardNumber();
    } else {
        accountNumber = creditCardToken || paymentInstrument.getCreditCardNumber();
    }
    if (accountNumber) {
        paymentMethodType.card = {
            accountNumber: accountNumber,
            accountNumberType: accountNumberType
        };
        if (paymentInstrument.getCreditCardExpirationMonth() && paymentInstrument.getCreditCardExpirationYear()) {
            paymentMethodType.card.expiry = {
                month: paymentInstrument.getCreditCardExpirationMonth(),
                year: paymentInstrument.getCreditCardExpirationYear()
            };
        }
        if (accountNumberType === 'SAFETECH_PAGE_ENCRYPTION') {
            var sessionEncryptedCvv = session.privacy.jpmcEncryptedCvv || null;
            var sessionEncryptedData = session.privacy.jpmcEncryptedData || null;

            if (sessionEncryptedCvv) {
                paymentMethodType.card.cvv = sessionEncryptedCvv;
            }

            var encryptedDataStr = sessionEncryptedData ? String(sessionEncryptedData) : null;
            if (encryptedDataStr) {
                try {
                    var encryptedData = JSON.parse(encryptedDataStr);
                    if (encryptedData.encryptionIntegrityCheck) {
                        paymentMethodType.card.encryptionIntegrityCheck = encryptedData.encryptionIntegrityCheck;
                    }
                } catch (e) {
                    require('dw/system/Logger').warn('buildPaymentMethodTypeObject: Failed to parse encrypted data for integrity check: {0}', e.message);
                }
            }
        }
    }

    return paymentMethodType;
}

/**
 * Builds shipTo object for fraud check
 * 
 * @param {dw.order.Shipment} shipment - order shipment with shipping address
 * @returns {Object} ship-to payload object
 * @private
 */
function buildShipToObject(shipment) {
    var shipTo = {};
    var shippingAddress = shipment.getShippingAddress();

    if (shippingAddress) {
        shipTo.shippingAddress = buildAddressObject(shippingAddress);
        var firstName = shippingAddress.getFirstName() || '';
        var lastName = shippingAddress.getLastName() || '';
        if (firstName || lastName) {
            shipTo.fullName = (firstName + ' ' + lastName).trim();
        }
        if (firstName) {
            shipTo.firstName = firstName.substring(0, 70);
        }
        if (lastName) {
            shipTo.lastName = lastName.substring(0, 70);
        }
        var phone = shippingAddress.getPhone();
        if (phone) {
            shipTo.phone = formatPhoneNumber(phone, shippingAddress.getCountryCode().getValue());
        }
    }
    var shippingMethod = shipment.getShippingMethod();
    if (shippingMethod && shippingMethod.getDisplayName()) {
        shipTo.shippingDescription = shippingMethod.getDisplayName().substring(0, 120);
    }

    return shipTo;
}

/**
 * Builds verification request payload per JPMC API specification
 * Validates card details without placing a funds hold
 * 
 * @param {Object} params - verification request parameters
 * @param {Object} params.cardData - card data for verification
 * @param {string} params.cardData.accountNumber - encrypted or tokenized card number
 * @param {string} [params.cardData.cvv] - card verification value
 * @param {number} params.cardData.expirationMonth - card expiration month
 * @param {number} params.cardData.expirationYear - card expiration year
 * @param {string} [params.cardData.encryptionIntegrityCheck] - encryption integrity check value
 * @param {string} params.currency - currency code (e.g. 'USD')
 * @param {string} [params.accountNumberType='SAFETECH_PAGE_ENCRYPTION'] - card number encryption type
 * @param {Object} [params.billingAddress] - billing address for AVS
 * @param {Object} [params.authentication] - 3DS authentication data
 * @param {string} [params.walletProvider] - wallet provider (e.g. APPLE_PAY)
 * @param {string} [params.email] - customer email address
 * @returns {Object} verification request payload
 */
function buildVerificationPayload(params) {
    if (!params || !params.cardData || !params.currency) {
        throw new Error('Missing required parameters: cardData, currency');
    }

    var card = params.cardData;
    var jpmcConst = require('*/cartridge/scripts/helpers/JPMCConstants');
    var cardPayload = {
        accountNumberType: params.accountNumberType || jpmcConst.ACCOUNT_NUMBER_TYPE_PIE,
        accountNumber: card.accountNumber,
        expiry: {
            month: parseInt(String(card.expirationMonth), 10),
            year: parseInt(String(card.expirationYear), 10)
        }
    };
    if (card.cvv) {
        cardPayload.cvv = card.cvv;
    }

    var payload = {
        merchant: buildMerchantObject(),
        currency: params.currency,
        initiatorType: params.initiatorType,
        paymentMethodType: {
            card: cardPayload
        }
    };
    if (params.accountOnFile) {
        payload.accountOnFile = params.accountOnFile;
    }
    if (card.encryptionIntegrityCheck) {
        payload.paymentMethodType.card.encryptionIntegrityCheck = card.encryptionIntegrityCheck;
    }
    if (params.walletProvider) {
        payload.paymentMethodType.card.walletProvider = params.walletProvider;
    }
    if (params.authentication) {
        payload.paymentMethodType.card.authentication = buildVerificationAuthenticationObject(params.authentication);
    }
    if (params.billingAddress) {
        payload.accountHolder = buildVerificationAccountHolderObject(params.billingAddress, params);
    }

    return payload;
}

/**
 * Builds authentication object for verification
 * @param {Object} auth - 3DS authentication response data
 * @returns {Object} formatted authentication object
 * @private
 */
function buildVerificationAuthenticationObject(auth) {
    var authObj = {};

    if (auth.authenticationId) {
        authObj.authenticationId = auth.authenticationId;
    }
    if (auth.threeDS) {
        authObj.threeDS = {};
        
        if (auth.threeDS.authenticationValue) {
            authObj.threeDS.authenticationValue = auth.threeDS.authenticationValue;
        }

        if (auth.threeDS.authenticationTransactionId) {
            authObj.threeDS.authenticationTransactionId = auth.threeDS.authenticationTransactionId;
        }

        if (auth.threeDS.threeDSProgramProtocol) {
            authObj.threeDS.threeDSProgramProtocol = auth.threeDS.threeDSProgramProtocol;
        }

        if (auth.threeDS.version1) {
            authObj.threeDS.version1 = {
                threeDSVEResEnrolled: auth.threeDS.version1.threeDSVEResEnrolled,
                threeDSPAResStatus: auth.threeDS.version1.threeDSPAResStatus
            };
        }

        if (auth.threeDS.version2) {
            authObj.threeDS.version2 = {
                threeDSTransactionStatus: auth.threeDS.version2.threeDSTransactionStatus
            };
            
            if (auth.threeDS.version2.threeDSTransactionStatusReasonCode) {
                authObj.threeDS.version2.threeDSTransactionStatusReasonCode = 
                    auth.threeDS.version2.threeDSTransactionStatusReasonCode;
            }

            if (auth.threeDS.version2.threeDSChallengeType) {
                authObj.threeDS.version2.threeDSChallengeType =
                    auth.threeDS.version2.threeDSChallengeType;
            }
        }

        if (auth.threeDS.threeDSChallengeType) {
            authObj.threeDS.threeDSChallengeType = auth.threeDS.threeDSChallengeType;
        }

        if (auth.threeDS.electronicCommerceIndicator) {
            authObj.threeDS.electronicCommerceIndicator = auth.threeDS.electronicCommerceIndicator;
        }

        if (auth.threeDS.tokenAuthenticationValue) {
            authObj.threeDS.tokenAuthenticationValue = auth.threeDS.tokenAuthenticationValue;
        }

        if (auth.threeDS.SCAExemptionReason) {
            authObj.threeDS.SCAExemptionReason = auth.threeDS.SCAExemptionReason;
        }
    }

    return authObj;
}

/**
 * Builds account holder object for verification
 * @param {dw.order.OrderAddress} billingAddress - billing address for AVS
 * @param {Object} params - verification parameters
 * @returns {Object} account holder payload
 * @private
 */
function buildVerificationAccountHolderObject(billingAddress, params) {
    var accountHolder = {};
    if (billingAddress.getFirstName() || billingAddress.getLastName()) {
        accountHolder.fullName = (billingAddress.getFirstName() + ' ' + billingAddress.getLastName()).trim();
    }
    if (params.email) {
        accountHolder.email = params.email;
    }
    var avsEnabled;
    if (params.resolvedConfig) {
        avsEnabled = params.resolvedConfig.enableAVS !== false;
    } else {
        var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');
        avsEnabled = JPMCConfig.isAVSEnabled();
    }
    if (avsEnabled) {
        accountHolder.billingAddress = buildAddressObject(billingAddress);
    }
    var phone = billingAddress.getPhone();
    if (phone) {
        accountHolder.phone = formatPhoneNumber(phone, billingAddress.getCountryCode().getValue());
    }

    return accountHolder;
}

/**
 * Builds create payment request payload per JPMC API specification
 * Supports Authorization (MANUAL), Sale (NOW), and Delayed Capture (DELAYED)
 * 
 * @param {Object} params - payment request parameters
 * @param {dw.order.Basket|dw.order.Order} params.order - basket or order to authorize
 * @param {dw.order.PaymentInstrument} params.paymentInstrument - payment instrument with card data
 * @param {string} [params.captureMethod='NOW'] - capture method (NOW, DELAYED, MANUAL)
 * @param {Object} [params.authentication] - 3DS authentication data
 * @param {string} [params.walletProvider] - wallet provider identifier
 * @param {string} [params.accountNumberType='PAN'] - card number encryption type
 * @param {string} [params.initiatorType='CARDHOLDER'] - transaction initiator type
 * @param {string} [params.accountOnFile='NOT_STORED'] - account on file status
 * @param {string} [params.deviceIPAddress] - customer device IP address
 * @param {Object} [params.recurring] - recurring payment configuration
 * @param {boolean} [params.isAmountFinal=true] - whether the amount is final
 * @param {string} [params.merchantCategoryCode] - merchant category code (MCC)
 * @param {boolean} [params.requestFraudScore=false] - whether to request fraud score
 * @param {number} [params.transactionRiskScore] - pre-calculated transaction risk score
 * @returns {Object} create payment request payload
 */
function buildCreatePaymentPayload(params) {
    if (!params || !params.order || !params.paymentInstrument) {
        throw new Error('Order, payment instrument, and merchant ID are required for create payment payload');
    }

    var basket = params.order;
    var paymentInstrument = params.paymentInstrument;
    var totalAmount = basket.getTotalGrossPrice();
    
    var payload = {
        captureMethod: params.captureMethod || 'NOW',
        amount: convertToCents(totalAmount.getValue(), basket.getCurrencyCode()),
        currency: basket.getCurrencyCode(),
        isAmountFinal: (params.isAmountFinal !== undefined) ? params.isAmountFinal : true,
        initiatorType: params.initiatorType || 'CARDHOLDER',
        accountOnFile: params.accountOnFile || 'NOT_STORED',
        merchantOrderNumber: basket.getOrderNo ? basket.getOrderNo() : ('BASKET-' + basket.getUUID()),
        merchant: buildMerchantObject()
    };
    payload.accountHolder = buildAccountHolderObject(basket, params.IPAddress, 'IPAddress', params.resolvedConfig);
    if (params.merchantCategoryCode) {
        payload.merchantCategoryCode = params.merchantCategoryCode;
    }

    payload.paymentMethodType = buildCreatePaymentMethodTypeObject(paymentInstrument, {
        accountNumberType: params.accountNumberType,
        walletProvider: params.walletProvider,
        authentication: params.authentication,
        resolvedConfig: params.resolvedConfig,
        requestAccountUpdater: params.requestAccountUpdater === true,
        paymentAuthenticationRequest: params.paymentAuthenticationRequest
    });
    
    // Add browserInfo at root level (required for 3DS)
    if (params.browserInfo) {
        payload.browserInfo = params.browserInfo;
    }
    if (params.recurring) {
        payload.recurring = {
            recurringSequence: params.recurring.sequence || 'FIRST',
            isVariableAmount: params.recurring.isVariableAmount || false
        };
        
        if (params.recurring.agreementId) {
            payload.recurring.agreementId = params.recurring.agreementId;
        }
        
        if (params.recurring.expiryDate) {
            payload.recurring.paymentAgreementExpiryDate = params.recurring.expiryDate;
        }
        
        if (params.recurring.recurringNumber) {
            payload.recurring.recurringNumber = params.recurring.recurringNumber;
        }
    }
    if (params.requestFraudScore) {
        payload.risk = {
            requestFraudScore: true
        };
        
        if (params.transactionRiskScore) {
            payload.risk.transactionRiskScore = params.transactionRiskScore;
        }
    }
    
    // Log payload for debugging 3DS issues
    if (payload.browserInfo) {
        require('dw/system/Logger').info('JPMC 3DS: Payload browserInfo: {0}', JSON.stringify(payload.browserInfo));
    }

    return payload;
}

/**
 * Builds payment method type object for create payment
 * 
 * @param {dw.order.PaymentInstrument} paymentInstrument - payment instrument with card data
 * @param {Object} options - card and wallet options
 * @returns {Object} payment method type payload with wallet/auth extensions
 * @private
 */
function buildCreatePaymentMethodTypeObject(paymentInstrument, options) {
    var paymentMethodType = buildPaymentMethodTypeObject(paymentInstrument, options);

    if (paymentMethodType.card) {
        if (options.walletProvider) {
            paymentMethodType.card.walletProvider = options.walletProvider;
        }

        if (options.authentication) {
            paymentMethodType.card.authentication = options.authentication;
        }

        // Real-Time Account Updater (RTAU): include the flag for eligible saved cards.
        // Eligibility: stored card (token present) and RTAU mode is REAL_TIME.
        try {
            if (options.requestAccountUpdater === true) {
                paymentMethodType.card.accountUpdater = {
                    requestAccountUpdater: true
                };
            }
        } catch (e) {
            Logger.warn('buildCreatePaymentMethodTypeObject: failed to attach RTAU flag - {0}',
                e instanceof Error ? e.message : String(e));
        }

        // CRITICAL: paymentAuthenticationRequest must be nested inside card object
        if (options.paymentAuthenticationRequest) {
            paymentMethodType.card.paymentAuthenticationRequest = options.paymentAuthenticationRequest;
        }
    }

    return paymentMethodType;
}

/**
 * Builds the void authorization payload for JPMC PATCH /payments/{id}
 * @returns {Object} result
 */
function buildVoidPayload() {
    return {
        isVoid: true
    };
}

/**
 * Builds Apple Pay payment request payload per JPMC Online Payments API specification
 * Maps Apple Pay encrypted payment token to JPMC's paymentMethodType.applepay structure
 * 
 * @param {Object} params - Apple Pay payment parameters
 * @param {dw.order.Order} params.order - order for payment
 * @param {Object} params.encryptedPaymentBundle - Apple Pay encrypted payment token
 * @param {string} params.encryptedPaymentBundle.encryptedPayload - encrypted payment data
 * @param {string} params.encryptedPaymentBundle.signature - payment token signature
 * @param {string} params.encryptedPaymentBundle.protocolVersion - encryption protocol version
 * @param {Object} params.encryptedPaymentBundle.encryptedPaymentHeader - payment token header
 * @param {string} params.encryptedPaymentBundle.encryptedPaymentHeader.ephemeralPublicKey - ephemeral public key
 * @param {string} params.encryptedPaymentBundle.encryptedPaymentHeader.publicKeyHash - merchant public key hash
 * @param {string} params.encryptedPaymentBundle.encryptedPaymentHeader.walletTransactionId - Apple Pay transaction ID
 * @param {string} [params.encryptedPaymentBundle.encryptedPaymentHeader.walletApplicationData] - wallet application data
 * @param {string} [params.captureMethod] - capture method (NOW, DELAYED, MANUAL)
 * @param {string} [params.latLong] - latitude/longitude coordinates
 * @param {boolean} [params.isAmountFinal] - whether payment amount is final
 * @returns {Object} Apple Pay payment payload
 */
function buildApplePayPaymentPayload(params) {
    if (!params || !params.order) {
        throw new Error('Order is required for Apple Pay payment payload');
    }
    
    if (!params.encryptedPaymentBundle) {
        throw new Error('Encrypted payment bundle is required for Apple Pay payment payload');
    }
    
    var bundle = params.encryptedPaymentBundle;
    
    if (!bundle.encryptedPayload) {
        throw new Error('encryptedPayload is required in payment bundle');
    }
    if (!bundle.signature) {
        throw new Error('signature is required in payment bundle');
    }
    if (!bundle.encryptedPaymentHeader || !bundle.encryptedPaymentHeader.ephemeralPublicKey) {
        throw new Error('encryptedPaymentHeader.ephemeralPublicKey is required in payment bundle');
    }
    if (!bundle.encryptedPaymentHeader.publicKeyHash) {
        throw new Error('encryptedPaymentHeader.publicKeyHash is required in payment bundle');
    }
    if (!bundle.encryptedPaymentHeader.walletTransactionId) {
        throw new Error('encryptedPaymentHeader.walletTransactionId is required in payment bundle');
    }

    var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');
    var order = params.order;
    var totalAmount = order.getTotalGrossPrice();
    var captureMethod = params.captureMethod || JPMCConfig.getCaptureMethod();
    var payload = {
        captureMethod: captureMethod,
        amount: convertToCents(totalAmount.getValue(), order.getCurrencyCode()),
        currency: order.getCurrencyCode(),
        isAmountFinal: params.isAmountFinal !== undefined ? params.isAmountFinal : true,
        initiatorType: 'CARDHOLDER',
        accountOnFile: 'NOT_STORED',
        merchantOrderNumber: order.getOrderNo(),
        merchant: buildMerchantObject()
    };
    payload.paymentMethodType = {
        applepay: {
            encryptedPaymentBundle: {
                encryptedPayload: bundle.encryptedPayload,
                signature: bundle.signature,
                protocolVersion: bundle.protocolVersion || 'EC_v1',
                encryptedPaymentHeader: {
                    ephemeralPublicKey: bundle.encryptedPaymentHeader.ephemeralPublicKey,
                    publicKeyHash: bundle.encryptedPaymentHeader.publicKeyHash,
                    walletTransactionId: bundle.encryptedPaymentHeader.walletTransactionId
                }
            }
        }
    };

    if (params.latLong) {
        payload.paymentMethodType.applepay.latLong = params.latLong;
    }
    
    if (bundle.encryptedPaymentHeader.walletApplicationData) {
        payload.paymentMethodType.applepay.encryptedPaymentBundle.encryptedPaymentHeader.walletApplicationData = 
            bundle.encryptedPaymentHeader.walletApplicationData;
    }
    
    return payload;
}

/**
 * Builds Google Pay payment request payload for JPMC API
 * @param {Object} params - Google Pay payment parameters
 * @param {dw.order.Basket|dw.order.Order} params.order - basket or order for payment
 * @param {dw.order.PaymentInstrument} params.paymentInstrument - payment instrument
 * @param {Object} params.googlePayToken - decrypted Google Pay token data
 * @param {string} [params.captureMethod='NOW'] - capture method (NOW, DELAYED, MANUAL)
 * @param {string} [params.initiatorType='CARDHOLDER'] - transaction initiator type
 * @param {string} [params.accountOnFile='NOT_STORED'] - account on file status
 * @param {boolean} [params.isAmountFinal=true] - whether the amount is final
 * @returns {Object} Google Pay payment request payload
 */
function buildGooglePayPaymentPayload(params) {
    if (!params || !params.order || !params.paymentInstrument) {
        throw new Error('Order and payment instrument are required for Google Pay payment payload');
    }

    if (!params.googlePayToken) {
        throw new Error('Google Pay token data is required');
    }

    var basket = params.order;
    var totalAmount = basket.getTotalGrossPrice();
    var gpToken = params.googlePayToken;

    var encryptedPaymentBundle = {
        encryptedPayload: gpToken.signedMessage,
        protocolVersion: gpToken.protocolVersion
    };

    if (gpToken.intermediateSigningKey
        && gpToken.intermediateSigningKey.signatures
        && gpToken.intermediateSigningKey.signatures.length > 0) {
        encryptedPaymentBundle.signature = gpToken.intermediateSigningKey.signatures[0];
    } else {
        encryptedPaymentBundle.signature = gpToken.signature;
    }

    try {
        var signedMessageObj = JSON.parse(gpToken.signedMessage);
        encryptedPaymentBundle.encryptedPaymentHeader = {
            ephemeralPublicKey: signedMessageObj.ephemeralPublicKey || ''
        };
    } catch (e) {
        encryptedPaymentBundle.encryptedPaymentHeader = { ephemeralPublicKey: '' };
    }

    var payload = {
        captureMethod: params.captureMethod || 'NOW',
        amount: convertToCents(totalAmount.getValue(), basket.getCurrencyCode()),
        currency: basket.getCurrencyCode(),
        isAmountFinal: (params.isAmountFinal !== undefined) ? params.isAmountFinal : true,
        initiatorType: params.initiatorType || 'CARDHOLDER',
        accountOnFile: params.accountOnFile || 'NOT_STORED',
        merchantOrderNumber: basket.getOrderNo ? basket.getOrderNo() : ('BASKET-' + basket.getUUID()),
        merchant: buildMerchantObject(),
        paymentMethodType: {
            googlepay: {
                encryptedPaymentBundle: encryptedPaymentBundle
            }
        }
    };

    if (params.latLong) {
        payload.paymentMethodType.googlepay.latLong = params.latLong;
    }

    return payload;
}

module.exports = {
    buildCapturePayload: buildCapturePayload,
    buildRefundPayload: buildRefundPayload,
    buildVoidPayload: buildVoidPayload,
    buildFraudCheckPayload: buildFraudCheckPayload,
    buildFraudCheckForCardSavePayload: buildFraudCheckForCardSavePayload,
    buildVerificationPayload: buildVerificationPayload,
    buildCreatePaymentPayload: buildCreatePaymentPayload,
    buildApplePayPaymentPayload: buildApplePayPaymentPayload,
    buildGooglePayPaymentPayload: buildGooglePayPaymentPayload
};