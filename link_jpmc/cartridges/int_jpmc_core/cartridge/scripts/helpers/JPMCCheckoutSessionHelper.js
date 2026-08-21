/**
 * JPMC Checkout Session helper.
 * Builds the /checkout/intent payload from an SFCC order/basket and orchestrates
 * the call to mint a checkoutSessionToken for the Drop-in UI.
 *
 * @module scripts/helpers/JPMCCheckoutSessionHelper
 */

'use strict';

var Logger = require('dw/system/Logger').getLogger('JPMC', 'checkout-session');

/**
 * Maps capture method (MANUAL/DELAYED/NOW) to the authorization/capture
 * method strings expected by /checkout/intent.
 *
 * @param {string} configCaptureMethod - resolved capture-method value
 * @returns {{authorizationType: string, captureMethod: string}} mapped values
 * @private
 */
/**
 * Maps resolved capture method to JPMC API enum values.
 * For Drop-in mode: DELAYED is mapped to MANUAL (DELAYED is a Direct API concept).
 *
 * @param {string} configCaptureMethod - resolved capture-method value
 * @param {boolean} [isDropIn] - true when resolving for Drop-in mode
 * @returns {{authorizationType: string, captureMethod: string}} mapped values
 * @private
 */
function mapAuthAndCapture(configCaptureMethod, isDropIn) {
    var captureMethod;
    switch (configCaptureMethod) {
        case 'NOW':
            captureMethod = 'CAPTURE_METHOD_NOW';
            break;
        case 'DELAYED':
            // Drop-in UI does not support DELAYED; map to MANUAL per spec
            captureMethod = isDropIn ? 'CAPTURE_METHOD_MANUAL' : 'CAPTURE_METHOD_DELAYED';
            break;
        case 'MANUAL':
        default:
            captureMethod = 'CAPTURE_METHOD_MANUAL';
            break;
    }
    return {
        authorizationType: 'AUTH_METHOD_CART_AMOUNT',
        captureMethod: captureMethod
    };
}

/**
 * Converts a dollar amount to integer cents.
 * @param {number} amount - dollar amount
 * @returns {number} integer amount in cents
 * @private
 */
function toCents(amount) {
    return Math.round(Number(amount) * 100);
}

/**
 * Safely returns a trimmed string value.
 * @param {string|number|Object|null} value - raw value
 * @returns {string} normalized string
 * @private
 */
function toSafeString(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).trim();
}

/**
 * Builds the consumer object for checkout intent payload.
 * Extracts phone, email, and consumerProfileId from basket/customer data.
 * consumerProfileId is only included for registered customers.
 *
 * @param {dw.order.Order|dw.order.Basket} order - SFCC order or basket
 * @returns {Object} consumer object
 * @private
 */
function buildConsumerObject(order) {
    var consumer = {};

    // Email from basket
    if (order.getCustomerEmail()) {
        consumer.email = order.getCustomerEmail();
    }

    // Phone: billingAddress.phone → profile.phoneHome fallback
    var billingAddress = order.getBillingAddress ? order.getBillingAddress() : null;
    var phone = null;
    if (billingAddress && billingAddress.getPhone()) {
        phone = billingAddress.getPhone();
    }
    if (!phone) {
        var customer = order.getCustomer ? order.getCustomer() : null;
        if (customer && customer.getProfile) {
            var prof = customer.getProfile();
            if (prof && prof.getPhoneHome()) {
                phone = prof.getPhoneHome();
            }
        }
    }
    if (phone) {
        consumer.phone = phone;
    }

    // consumerProfileId: only for registered customers
    var cust = order.getCustomer ? order.getCustomer() : null;
    if (cust && !cust.isAnonymous()) {
        var profile = cust.getProfile();
        if (profile) {
            // Prefer JPMC-specific profile ID if stored
            var profileId = (profile.custom && profile.custom.jpmcProfileId)
                ? profile.custom.jpmcProfileId : null;
            if (profileId) {
                consumer.consumerProfileId = profileId;
            }
        }
    }

    return consumer;
}

/**
 * Reads the JPMCSaveConsumerProfile site preference, defaulting to true.
 * @param {Object|null} resolvedConfig - resolved merchant configuration
 * @returns {boolean} true when the JPMC-managed consumer profile flow is enabled
 * @private
 */
function shouldSaveConsumerProfile(resolvedConfig) {
    if (resolvedConfig && resolvedConfig.saveConsumerProfile !== undefined) {
        return resolvedConfig.saveConsumerProfile === true;
    }

    try {
        var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');
        var val = JPMCConfig.getPreference('JPMCSaveConsumerProfile', false);
        if (val === false) {
            return false;
        }
        if (val === true) {
            return true;
        }
        // not configured -> default true (matches the chosen rollout strategy)
        return true;
    } catch (e) {
        return true;
    }
}

/**
 * Builds cardholder account history for drop-in 3DS authentication.
 * Populates order-count fields from SFCC order history for registered customers.
 * Address and name comparison fields are derived from the current order.
 *
 * @param {dw.order.Order|dw.order.Basket} order - current order or basket
 * @returns {Object} cardholderAccountHistory payload fragment
 * @private
 */
function buildCardholderAccountHistory(order) {
    var history = {};

    try {
        var customer = order.getCustomer();
        if (customer && !customer.isAnonymous()) {
            var profile = customer.getProfile();
            if (profile) {
                if (profile.getCreationDate()) {
                    history.accountCreateTimestamp = profile.getCreationDate().toISOString();
                }

                var customerNo = profile.getCustomerNo();
                var OrderMgr = require('dw/order/OrderMgr');
                var Calendar = require('dw/util/Calendar');

                var cal24h = new Calendar();
                cal24h.add(Calendar.DATE, -1);
                var orders24h = OrderMgr.searchOrders(
                    'customerNo = {0} AND creationDate >= {1}',
                    'creationDate desc',
                    customerNo, cal24h
                );
                history.last24HoursTransactionCount = orders24h.getCount();
                orders24h.close();

                var calYear = new Calendar();
                calYear.add(Calendar.YEAR, -1);
                var ordersYear = OrderMgr.searchOrders(
                    'customerNo = {0} AND creationDate >= {1}',
                    'creationDate desc',
                    customerNo, calYear
                );
                history.lastYearTransactionCount = ordersYear.getCount();
                ordersYear.close();

                var cal6m = new Calendar();
                cal6m.add(Calendar.MONTH, -6);
                var orders6m = OrderMgr.searchOrders(
                    'customerNo = {0} AND creationDate >= {1}',
                    'creationDate desc',
                    customerNo, cal6m
                );
                history.last6MonthsPurchaseCount = orders6m.getCount();
                orders6m.close();
            }
        } else {
            history.last24HoursTransactionCount = 0;
            history.lastYearTransactionCount = 0;
            history.last6MonthsPurchaseCount = 0;
        }
    } catch (e) {
        Logger.warn('buildCardholderAccountHistory: order history query failed: {0}', e.message || String(e));
        if (history.last24HoursTransactionCount == null) { history.last24HoursTransactionCount = 0; }
        if (history.lastYearTransactionCount == null) { history.lastYearTransactionCount = 0; }
        if (history.last6MonthsPurchaseCount == null) { history.last6MonthsPurchaseCount = 0; }
    }

    try {
        var billingAddress = order.getBillingAddress ? order.getBillingAddress() : null;
        var defaultShipment = order.getDefaultShipment ? order.getDefaultShipment() : null;
        var shippingAddress = defaultShipment ? defaultShipment.getShippingAddress() : null;

        if (billingAddress && shippingAddress) {
            var addressIdentical = (
                billingAddress.getAddress1() === shippingAddress.getAddress1() &&
                billingAddress.getCity() === shippingAddress.getCity() &&
                billingAddress.getStateCode() === shippingAddress.getStateCode() &&
                billingAddress.getPostalCode() === shippingAddress.getPostalCode() &&
                billingAddress.getCountryCode().getValue() === shippingAddress.getCountryCode().getValue()
            );
            history.consumerAccountAddressIdenticalIndicator = addressIdentical;

            var billingName = ((billingAddress.getFirstName() || '') + ' ' + (billingAddress.getLastName() || '')).trim().toLowerCase();
            var shippingName = ((shippingAddress.getFirstName() || '') + ' ' + (shippingAddress.getLastName() || '')).trim().toLowerCase();
            history.consumerShipToNameIdenticalIndicator = (billingName === shippingName && billingName.length > 0);
        }
    } catch (e) {
        Logger.warn('buildCardholderAccountHistory: address comparison failed: {0}', e.message || String(e));
    }

    history.consumerAccountSuspiciousActivityIndicator = false;

    return history;
}

/**
 * Builds purchase info for drop-in 3DS authentication.
 * Populates last purchase date, item count, and merchant fraud risk assessment
 * from SFCC order history and the current order.
 *
 * @param {dw.order.Order|dw.order.Basket} order - current order or basket
 * @returns {Object} purchaseInfo payload fragment
 * @private
 */
function buildPurchaseInfo(order) {
    var purchaseInfo = {};

    try {
        var customer = order.getCustomer();
        if (customer && !customer.isAnonymous()) {
            var profile = customer.getProfile();
            if (profile) {
                var OrderMgr = require('dw/order/OrderMgr');
                var pastOrders = OrderMgr.searchOrders(
                    'customerNo = {0}',
                    'creationDate desc',
                    profile.getCustomerNo()
                );
                if (pastOrders.getCount() > 0) {
                    var lastOrder = pastOrders.next();
                    purchaseInfo.lastPurchaseDate = lastOrder.getCreationDate().toISOString();
                }
                pastOrders.close();
            }
        }
    } catch (e) {
        Logger.warn('buildPurchaseInfo: last purchase date query failed: {0}', e.message || String(e));
    }

    try {
        var lineItems = order.getAllProductLineItems ? order.getAllProductLineItems() : null;
        if (lineItems) {
            purchaseInfo.purchasedItemCount = Math.min(parseInt(lineItems.length, 10), 99);
        }
    } catch (e) {
        // best effort
    }

    try {
        var fraudRiskAssessment = {};
        var billingAddr = order.getBillingAddress ? order.getBillingAddress() : null;
        var defaultShipment = order.getDefaultShipment ? order.getDefaultShipment() : null;
        var shippingAddr = defaultShipment ? defaultShipment.getShippingAddress() : null;

        if (shippingAddr && billingAddr) {
            var sameAddress = (
                shippingAddr.getAddress1() === billingAddr.getAddress1() &&
                shippingAddr.getPostalCode() === billingAddr.getPostalCode()
            );
            fraudRiskAssessment.shipmentType = sameAddress
                ? 'SHIPPING_METHOD_SHIP_TO_BILLING_ADDRESS'
                : 'SHIPPING_METHOD_SHIP_TO_ADDRESS_NOT_ON_FILE';
        }

        if (defaultShipment) {
            var shippingMethod = defaultShipment.getShippingMethod();
            if (shippingMethod) {
                var methodId = (shippingMethod.getID() || '').toUpperCase();
                var methodName = (shippingMethod.getDisplayName() || '').toUpperCase();
                var combined = methodId + ' ' + methodName;
                if (combined.indexOf('OVERNIGHT') !== -1 || combined.indexOf('NEXT_DAY') !== -1 || combined.indexOf('NEXT DAY') !== -1) {
                    fraudRiskAssessment.deliveryTimeframe = 'DELIVERY_TYPE_OVERNIGHT_SHIPPING';
                } else if (combined.indexOf('SAME_DAY') !== -1 || combined.indexOf('SAME DAY') !== -1) {
                    fraudRiskAssessment.deliveryTimeframe = 'DELIVERY_TYPE_SAME_DAY_SHIPPING';
                } else if (combined.indexOf('ELECTRONIC') !== -1 || combined.indexOf('DIGITAL') !== -1 || combined.indexOf('EMAIL') !== -1 || combined.indexOf('DOWNLOAD') !== -1) {
                    fraudRiskAssessment.deliveryTimeframe = 'DELIVERY_TYPE_ELECTRONIC_DELIVERY';
                    fraudRiskAssessment.shipmentType = 'SHIPPING_METHOD_DIGITAL_GOODS_DELIVERY';
                } else {
                    fraudRiskAssessment.deliveryTimeframe = 'DELIVERY_TYPE_TWO_DAYS_OR_MORE_SHIPPING';
                }
            }
        }

        var customerEmail = order.getCustomerEmail ? order.getCustomerEmail() : null;
        if (customerEmail) {
            fraudRiskAssessment.orderEmailAddress = customerEmail;
        }

        if (Object.keys(fraudRiskAssessment).length > 0) {
            purchaseInfo.merchantFraudRiskAssessment = fraudRiskAssessment;
        }
    } catch (e) {
        Logger.warn('buildPurchaseInfo: fraud risk assessment failed: {0}', e.message || String(e));
    }

    return purchaseInfo;
}

/**
 * Builds the paymentCardAuthenticationRequest block for /checkout/intent when 3DS is enabled.
 * Uses the same jpmc3DSEnabled flag as the Direct API integration (resolvedConfig or site preference).
 *
 * @param {dw.order.Order|dw.order.Basket} order - current order or basket
 * @param {Object|null} resolvedConfig - resolved merchant configuration (from JPMCMerchantResolver)
 * @returns {Object|null} paymentCardAuthenticationRequest payload, or null if 3DS is disabled
 * @private
 */
function build3DSPaymentCardAuthenticationRequest(order, resolvedConfig) {
    var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');

    var is3DSEnabled = (resolvedConfig && resolvedConfig.jpmc3DSEnabled === true)
        || JPMCConfig.is3DSEnabled();

    if (!is3DSEnabled) {
        return null;
    }

    var authRequest = {};

    var cardholderHistory = buildCardholderAccountHistory(order);
    if (cardholderHistory && Object.keys(cardholderHistory).length > 0) {
        authRequest.cardholderAccountHistory = cardholderHistory;
    }

    var purchaseInfo = buildPurchaseInfo(order);
    if (purchaseInfo && Object.keys(purchaseInfo).length > 0) {
        authRequest.purchaseInfo = purchaseInfo;
    }

    return authRequest;
}

/**
 * Builds the /checkout/intent payload for the given order.
 *
 * @param {dw.order.Order|dw.order.Basket} order - SFCC order or basket
 * @param {Object} [options] - optional overrides (captureMethod, isSaveConsumerProfile)
 * @returns {Object} the request payload
 */
function buildIntentPayload(order, options) {
    if (!order) {
        throw new Error('Order is required to build checkout intent payload');
    }

    var JPMCConfig = require('*/cartridge/scripts/helpers/JPMCConfig');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

    var opts = options || {};
    var resolvedConfig = opts.resolvedConfig || JPMCMerchantResolver.resolve();
    var checkoutMode = (resolvedConfig && resolvedConfig.checkoutMode)
        ? String(resolvedConfig.checkoutMode)
        : JPMCMerchantResolver.getCheckoutMode();
    var isDropIn = checkoutMode === 'DROP_IN';
    var effectiveCaptureMethod = opts.captureMethod
        || (resolvedConfig && resolvedConfig.captureMethod)
        || JPMCConfig.getCaptureMethod();
    var authCapture = mapAuthAndCapture(effectiveCaptureMethod, isDropIn);

    var totalGross = order.getTotalGrossPrice();
    var totalTax = order.getTotalTax();
    
    var shippingCost = null;
    var defaultShipment = order.getDefaultShipment ? order.getDefaultShipment() : null;
    if (defaultShipment && defaultShipment.getShippingTotalGrossPrice) {
        shippingCost = defaultShipment.getShippingTotalGrossPrice();
    }
    
    var currency = totalGross.getCurrencyCode();
    var merchantOrderNumber = (opts.merchantOrderNumber) || order.getUUID().substring(0, 22);
    var consumerObject = buildConsumerObject(order);
    var payload = {
        currencyCode: currency,
        merchantOrderNumber: merchantOrderNumber,
        checkoutOptions: {
            authorization: {
                authorizationType: authCapture.authorizationType
            },
            capture: {
                captureMethod: authCapture.captureMethod
            }
        },
        cart: {
            totalTransactionAmount: toCents(totalGross.getValue())
        },
        consumer: consumerObject
    };

    if (totalTax && totalTax.available) {
        payload.cart.taxAmount = toCents(totalTax.getValue());
    }
    if (shippingCost && shippingCost.available) {
        payload.cart.totalShippingAmount = toCents(shippingCost.getValue());
    }

    var custForCOF = order.getCustomer ? order.getCustomer() : null;
    if (custForCOF && !custForCOF.isAnonymous() && isDropIn) {
        payload.checkoutOptions.cardOnFile = {
            transactionType: 'COF_TRANSACTION_TYPE_UNSCHEDULED'
        };
    }

    var saveProfile = (opts.isSaveConsumerProfile != null)
        ? opts.isSaveConsumerProfile === true
        : shouldSaveConsumerProfile(resolvedConfig);

    if (saveProfile) {
        var customer = order.getCustomer ? order.getCustomer() : null;
        var isRegistered = customer && !customer.isAnonymous();
        
        if (isRegistered) {
            payload.checkoutOptions.consumerProfileOptions = {
                isSaveConsumerProfile: true
            };
        }
    }

    var threeDSRequest = build3DSPaymentCardAuthenticationRequest(order, opts.resolvedConfig || null);
    if (threeDSRequest) {
        payload.checkoutOptions.paymentCardAuthenticationRequest = threeDSRequest;
    }

    return payload;
}

/**
 * Creates a JPMC checkout session for the given order.
 *
 * @param {dw.order.Order|dw.order.Basket} order - SFCC order or basket
 * @param {Object} [options] - optional overrides forwarded to the payload builder
 * @returns {{success: boolean, checkoutSessionToken: ?string, data: ?Object, error: ?string}} result envelope
 */
function createSession(order, options) {
    var JPMCCheckoutIntentService = require('*/cartridge/scripts/services/JPMCCheckoutIntentService');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

    var result = {
        success: false,
        checkoutSessionToken: null,
        data: null,
        error: null
    };

    if (!order) {
        result.error = 'Order is required';
        return result;
    }

    try {
        var resolvedConfig = (options && options.resolvedConfig) || JPMCMerchantResolver.resolve();
        var payloadOptions = Object.assign({}, options || {}, { resolvedConfig: resolvedConfig });
        if (payloadOptions.isSaveConsumerProfile == null
            && resolvedConfig
            && resolvedConfig.saveConsumerProfile !== undefined) {
            payloadOptions.isSaveConsumerProfile = resolvedConfig.saveConsumerProfile === true;
        }
        var payload = buildIntentPayload(order, payloadOptions);

        var serviceResult = JPMCCheckoutIntentService.createCheckoutSession(payload, {
            resolvedConfig: resolvedConfig
        });

        if (!serviceResult.success) {
            result.error = serviceResult.error || 'Failed to create checkout session';
            Logger.error('createSession: {0}', result.error);
            return result;
        }

        result.success = true;
        result.checkoutSessionToken = serviceResult.checkoutSessionToken;
        result.data = serviceResult.data;
        return result;
    } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        Logger.error('createSession exception: {0}', result.error);
        return result;
    }
}

/**
 * Returns an existing checkout intent token when basket ETag is unchanged, or creates
 * a new token with an epoch-suffixed merchantOrderNumber when basket state changes.
 *
 * Basket persistence:
 * - basket.custom.jpmcReservedOrderNo
 * - basket.custom.jpmcLastEtag
 * - basket.custom.jpmcCheckoutIntentOrderNumber
 *
 * Token persistence is intentionally NOT on basket
 *
 * @param {dw.order.Basket} basket - current basket
 * @param {Object} [options] - helper options
 * @param {Object|null} [options.resolvedConfig] - resolved merchant config
 * @param {string|null} [options.cachedSessionToken] - cached checkoutSessionToken for current basket ETag
 * @returns {Object} result - success, checkoutSessionToken, reused, etag, etagChanged, merchantOrderNumber, error
 */
function getOrUpdateJpmcIntent(basket, options) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');
    var opts = options || {};

    var result = {
        success: false,
        checkoutSessionToken: null,
        reused: false,
        etag: '',
        etagChanged: true,
        merchantOrderNumber: null,
        error: null
    };

    if (!basket) {
        result.error = 'Basket is required';
        return result;
    }

    var currentEtag = toSafeString(basket.getEtag ? basket.getEtag() : '');
    var previousEtag = toSafeString(basket.custom && basket.custom.jpmcLastEtag ? basket.custom.jpmcLastEtag : '');
    var reservedOrderNo = toSafeString(basket.custom && basket.custom.jpmcReservedOrderNo ? basket.custom.jpmcReservedOrderNo : '');
    var lastIntentOrderNumber = toSafeString(basket.custom && basket.custom.jpmcCheckoutIntentOrderNumber ? basket.custom.jpmcCheckoutIntentOrderNumber : '');
    var cachedSessionToken = toSafeString(opts.cachedSessionToken || '');

    result.etag = currentEtag;
    result.etagChanged = !!previousEtag && !!currentEtag && currentEtag !== previousEtag;

    try {
        if (!reservedOrderNo) {
            Transaction.wrap(function () {
                reservedOrderNo = String(OrderMgr.createOrderSequenceNo());
                basket.custom.jpmcReservedOrderNo = reservedOrderNo;
                basket.custom.jpmcCheckoutIntentOrderNumber = reservedOrderNo;
                basket.custom.jpmcLastEtag = currentEtag;
            });
        }
    } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        return result;
    }

    var merchantOrderNumber = lastIntentOrderNumber || reservedOrderNo;
    if (result.etagChanged) {
        merchantOrderNumber = reservedOrderNo + '-' + new Date().getTime().toString(36);
    }

    // Reuse token only when basket ETag is truly unchanged for an existing intent state.
    if (!result.etagChanged && cachedSessionToken && previousEtag && lastIntentOrderNumber) {
        result.success = true;
        result.reused = true;
        result.checkoutSessionToken = cachedSessionToken;
        result.merchantOrderNumber = merchantOrderNumber;
        return result;
    }

    var sessionResult = createSession(basket, {
        resolvedConfig: opts.resolvedConfig || null,
        merchantOrderNumber: merchantOrderNumber
    });

    if (!sessionResult.success || !sessionResult.checkoutSessionToken) {
        result.error = sessionResult.error || 'Failed to create checkout session';
        return result;
    }

    try {
        Transaction.wrap(function () {
            basket.custom.jpmcLastEtag = currentEtag;
            basket.custom.jpmcCheckoutIntentOrderNumber = merchantOrderNumber;
        });
    } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        return result;
    }

    result.success = true;
    result.reused = false;
    result.checkoutSessionToken = sessionResult.checkoutSessionToken;
    result.merchantOrderNumber = merchantOrderNumber;
    return result;
}

module.exports = {
    buildIntentPayload: buildIntentPayload,
    createSession: createSession,
    getOrUpdateJpmcIntent: getOrUpdateJpmcIntent
};
