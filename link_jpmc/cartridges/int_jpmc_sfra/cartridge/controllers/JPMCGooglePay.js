'use strict';

var server = require('server');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

/**
 * clearBasketState
 * @param {dw.order.Basket} basket - basket to clear
 * @param {dw.system.Transaction} Transaction - transaction module
 */
function clearBasketState(basket, Transaction) {
    try {
        Transaction.wrap(function () {
            basket.defaultShipment.createShippingAddress();
            basket.createBillingAddress();
            basket.removeAllPaymentInstruments();
        });
    } catch (e) { /* intentionally empty */ }
}

/**
 * JPMCGooglePay-GetConfig : Returns Google Pay merchant configuration and current basket totals.
 */
server.get('GetConfig',
    server.middleware.https,
    consentTracking.consent,
    function (req, res, next) {
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var BasketMgr = require('dw/order/BasketMgr');

        var resolvedConfig = JPMCMerchantResolver.resolve();
        var gpayConfig;
        var PaymentMgr = require('dw/order/PaymentMgr');
        var googlePayMethod = PaymentMgr.getPaymentMethod('JPMC_GOOGLE_PAY');
        if (!googlePayMethod || !googlePayMethod.isActive() || !resolvedConfig.googlePayGatewayMerchantId) {
            gpayConfig = { enabled: false };
        } else {
            var allowedCards = resolvedConfig.googlePayAllowedCardNetworks
                ? resolvedConfig.googlePayAllowedCardNetworks.split(',').map(function (n) { return n.trim(); }).filter(Boolean)
                : [];
            var allowedAuth = resolvedConfig.googlePayAllowedAuthMethods
                ? resolvedConfig.googlePayAllowedAuthMethods.split(',').map(function (m) { return m.trim(); }).filter(Boolean)
                : [];
            gpayConfig = {
                enabled: allowedCards.length > 0 && allowedAuth.length > 0,
                environment: resolvedConfig.googlePayEnvironment || 'TEST',
                gateway: resolvedConfig.googlePayGateway || '',
                gatewayMerchantId: resolvedConfig.googlePayGatewayMerchantId,
                googlePayMerchantId: resolvedConfig.googlePayMerchantId || '',
                merchantName: resolvedConfig.googlePayMerchantName || '',
                allowedCardNetworks: allowedCards,
                allowedAuthMethods: allowedAuth
            };
        }

        if (!gpayConfig.enabled) {
            res.json({ error: false, enabled: false });
            return next();
        }

        var currentBasket = BasketMgr.getCurrentBasket();
        var totalPrice = '0.00';
        var currencyCode = '';
        var subtotal = '0.00';
        var shippingCost = '0.00';
        var totalTax = '0.00';

        if (currentBasket) {
            var totalGrossPrice = currentBasket.getTotalGrossPrice();
            if (totalGrossPrice.available) {
                totalPrice = totalGrossPrice.getValue().toFixed(2);
                currencyCode = totalGrossPrice.getCurrencyCode();
            }
            var subTotal = currentBasket.getAdjustedMerchandizeTotalPrice();
            if (subTotal.available) {
                subtotal = subTotal.getValue().toFixed(2);
            }
            var shippingTotal = currentBasket.getShippingTotalPrice();
            if (shippingTotal.available) {
                shippingCost = shippingTotal.getValue().toFixed(2);
            }
            var taxTotal = currentBasket.getTotalTax();
            if (taxTotal.available) {
                totalTax = taxTotal.getValue().toFixed(2);
            }
        }

        var basketEmpty = !currencyCode || totalPrice === '0.00';
        var isPDPEnabled = resolvedConfig.JPMCGooglePayPDPEnabled === true;
        
        if (basketEmpty && !isPDPEnabled) {
            res.json({ error: true, enabled: false });
            return next();
        }

        if (basketEmpty) {
            var Site = require('dw/system/Site');
            currencyCode = Site.getCurrent().getDefaultCurrency() || '';
        }

        var countryCode = '';
        if (req.locale && req.locale.id) {
            var Locale = require('dw/util/Locale');
            var localeObj = Locale.getLocale(req.locale.id);
            countryCode = localeObj && localeObj.country ? localeObj.country : '';
        }

        var isGuest = !(req.currentCustomer && req.currentCustomer.profile);
        var responseData = {
            error: basketEmpty && !isPDPEnabled,
            enabled: true,
            environment: gpayConfig.environment,
            gateway: gpayConfig.gateway,
            gatewayMerchantId: gpayConfig.gatewayMerchantId,
            merchantName: gpayConfig.merchantName,
            allowedCardNetworks: gpayConfig.allowedCardNetworks,
            allowedAuthMethods: gpayConfig.allowedAuthMethods,
            totalPrice: totalPrice,
            currencyCode: currencyCode,
            countryCode: countryCode,
            subtotal: subtotal,
            shippingCost: shippingCost,
            totalTax: totalTax,
            cartEnabled: resolvedConfig.JPMCGooglePayCartEnabled === true,
            pdpEnabled: isPDPEnabled,
            isGuest: isGuest
        };

        if (gpayConfig.environment === 'PRODUCTION' && gpayConfig.googlePayMerchantId) {
            responseData.googlePayMerchantId = gpayConfig.googlePayMerchantId;
        }

        res.json(responseData);

        return next();
    }
);

/**
 * JPMCGooglePay-StoreToken : Persists Google Pay payment token in session for checkout flow.
 */
server.post('StoreToken',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {

        var token = req.form.token;
        if (!token) {
            res.json({ error: true });
            return next();
        }

        try {
            JSON.parse(token);
        } catch (e) {
            res.json({ error: true });
            return next();
        }

        session.privacy.jpmcGooglePayToken = token;
        res.json({ error: false });
        return next();
    }
);

/**
 * JPMCGooglePay-ClearToken : Clears Google Pay payment token from session
 * @name JPMCGooglePay-ClearToken
 * @function
 * @memberof JPMCGooglePay
 * @param {middleware} - server.middleware.https
 * @param {middleware} - csrfProtection.validateAjaxRequest
 */
server.post('ClearToken',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        session.privacy.jpmcGooglePayToken = null;
        res.json({ error: false });
        return next();
    }
);

/**
 * JPMCGooglePay-SelectShippingDetails : Processes shipping address selection and returns available shipping methods
 * @name JPMCGooglePay-SelectShippingDetails
 * @function
 * @memberof JPMCGooglePay
 * @param {middleware} - server.middleware.https
 * @param {middleware} - csrfProtection.validateAjaxRequest
 * @param {httpparameter} - address - Shipping address object from Google Pay
 */
server.post('SelectShippingDetails',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Transaction = require('dw/system/Transaction');
        var ShippingMgr = require('dw/order/ShippingMgr');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');

        var currentBasket = BasketMgr.getCurrentBasket();
        if (!currentBasket) {
            res.json({ error: true });
            return next();
        }

        var body;
        try {
            body = JSON.parse(req.form.body);
        } catch (e) {
            res.json({ error: true });
            return next();
        }

        var address = body.address;
        if (!address) {
            res.json({ error: true });
            return next();
        }

        var shipment = currentBasket.defaultShipment;
        var shippingOptions = [];
        var firstMethodId = null;
        var selectedShippingMethodId = null;
        var currentMethodId = shipment.shippingMethodID;
        var ShippingHelper = require('*/cartridge/scripts/checkout/shippingHelpers');

        Transaction.wrap(function () {
            var shippingAddress = shipment.shippingAddress;
            if (!shippingAddress) {
                shippingAddress = shipment.createShippingAddress();
            }
            shippingAddress.setCountryCode(address.countryCode || '');
            shippingAddress.setStateCode(address.administrativeArea || '');
            shippingAddress.setCity(address.locality || '');
            shippingAddress.setPostalCode(address.postalCode || '');
            var shipmentModel = ShippingMgr.getShipmentShippingModel(shipment);
            var applicableMethods = shipmentModel.getApplicableShippingMethods();
            var methodsToUse = (applicableMethods && applicableMethods.size() > 0)
                ? applicableMethods
                : shipmentModel.getShippingMethods();
            var methodIterator = methodsToUse.iterator();

            while (methodIterator.hasNext()) {
                var method = methodIterator.next();
                if (!firstMethodId) {
                    firstMethodId = method.getID();
                }
                if (method.getID() === currentMethodId) {
                    selectedShippingMethodId = currentMethodId;
                }
                shippingOptions.push({
                    id: method.getID(),
                    label: method.getDisplayName(),
                    description: method.getDescription() || ''
                });
            }

            var methodToApply = selectedShippingMethodId || firstMethodId;
            if (methodToApply) {
                ShippingHelper.selectShippingMethod(shipment, methodToApply);
                basketCalculationHelpers.calculateTotals(currentBasket);
            }
        });

        if (!selectedShippingMethodId) {
            selectedShippingMethodId = firstMethodId;
        }

        var totalGrossPrice = currentBasket.getTotalGrossPrice();
        var totalTax = currentBasket.getTotalTax();
        var shippingTotal = currentBasket.getShippingTotalPrice();
        var subtotal = currentBasket.getAdjustedMerchandizeTotalPrice();

        var totalPriceValue = totalGrossPrice.available ? totalGrossPrice.getValue().toFixed(2) : '0.00';
        var totalTaxValue = totalTax.available ? totalTax.getValue().toFixed(2) : '0.00';
        var shippingCostValue = shippingTotal.available ? shippingTotal.getValue().toFixed(2) : '0.00';
        var subtotalValue = subtotal.available ? subtotal.getValue().toFixed(2) : '0.00';
        var currencyCodeValue = totalGrossPrice.available ? totalGrossPrice.getCurrencyCode() : '';

        var displayItems = [
            { label: 'Subtotal', type: 'SUBTOTAL', price: subtotalValue },
            { label: 'Shipping', type: 'SHIPPING_OPTION', price: shippingCostValue },
            { label: 'Tax', type: 'TAX', price: totalTaxValue }
        ];
        var hasError = !shippingOptions || shippingOptions.length === 0;

        res.json({
            error: hasError,
            shippingOptions: shippingOptions,
            selectedShippingMethodId: selectedShippingMethodId,
            totalPrice: totalPriceValue,
            subtotal: subtotalValue,
            totalTax: totalTaxValue,
            shippingCost: shippingCostValue,
            currencyCode: currencyCodeValue,
            displayItems: displayItems
        });

        return next();
    }
);

/**
 * JPMCGooglePay-SelectShippingMethod : Updates basket with selected shipping method and returns updated totals
 * @name JPMCGooglePay-SelectShippingMethod
 * @function
 * @memberof JPMCGooglePay
 * @param {middleware} - server.middleware.https
 * @param {middleware} - csrfProtection.validateAjaxRequest
 * @param {httpparameter} - shippingMethodId - Shipping method ID to apply
 */
server.post('SelectShippingMethod',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Transaction = require('dw/system/Transaction');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');

        var currentBasket = BasketMgr.getCurrentBasket();
        if (!currentBasket) {
            res.json({ error: true });
            return next();
        }

        var body;
        try {
            body = JSON.parse(req.form.body);
        } catch (e) {
            res.json({ error: true });
            return next();
        }

        var shippingMethodId = body.shippingMethodId;
        if (!shippingMethodId) {
            res.json({ error: true });
            return next();
        }

        var shipment = currentBasket.defaultShipment;
        var ShippingHelper = require('*/cartridge/scripts/checkout/shippingHelpers');
        var ShippingMgr = require('dw/order/ShippingMgr');

        // Security: validate that the requested method is actually applicable
        var shipmentModel = ShippingMgr.getShipmentShippingModel(shipment);
        var applicableMethods = shipmentModel.getApplicableShippingMethods();
        var isApplicable = false;
        var checkIterator = applicableMethods.iterator();
        while (checkIterator.hasNext()) {
            if (checkIterator.next().getID() === shippingMethodId) {
                isApplicable = true;
                break;
            }
        }
        if (!isApplicable) {
            res.json({ error: true });
            return next();
        }

        Transaction.wrap(function () {
            ShippingHelper.selectShippingMethod(shipment, shippingMethodId);
            basketCalculationHelpers.calculateTotals(currentBasket);
        });

        var totalGrossPrice = currentBasket.getTotalGrossPrice();
        var totalTax = currentBasket.getTotalTax();
        var shippingTotal = currentBasket.getShippingTotalPrice();
        var subtotal = currentBasket.getAdjustedMerchandizeTotalPrice();

        var totalPriceValue = totalGrossPrice.available ? totalGrossPrice.getValue().toFixed(2) : '0.00';
        var totalTaxValue = totalTax.available ? totalTax.getValue().toFixed(2) : '0.00';
        var shippingCostValue = shippingTotal.available ? shippingTotal.getValue().toFixed(2) : '0.00';
        var subtotalValue = subtotal.available ? subtotal.getValue().toFixed(2) : '0.00';
        var currencyCodeValue = totalGrossPrice.available ? totalGrossPrice.getCurrencyCode() : '';

        var displayItems = [
            { label: 'Subtotal', type: 'SUBTOTAL', price: subtotalValue },
            { label: 'Shipping', type: 'SHIPPING_OPTION', price: shippingCostValue },
            { label: 'Tax', type: 'TAX', price: totalTaxValue }
        ];

        res.json({
            error: false,
            totalPrice: totalPriceValue,
            totalTax: totalTaxValue,
            shippingCost: shippingCostValue,
            subtotal: subtotalValue,
            currencyCode: currencyCodeValue,
            displayItems: displayItems
        });

        return next();
    }
);

/**
 * JPMCGooglePay-SubmitOrder : Processes Google Pay order submission with payment authorization
 * @name JPMCGooglePay-SubmitOrder
 * @function
 * @memberof JPMCGooglePay
 * @param {middleware} - server.middleware.https
 * @param {middleware} - csrfProtection.validateAjaxRequest
 * @returns {json} Order confirmation data or error details
 */
server.post('SubmitOrder',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Transaction = require('dw/system/Transaction');
        var Resource = require('dw/web/Resource');
        var PaymentMgr = require('dw/order/PaymentMgr');
        var HookMgr = require('dw/system/HookMgr');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var jpmcConstants = require('*/cartridge/scripts/helpers/JPMCConstants');

        var currentBasket = BasketMgr.getCurrentBasket();
        if (!currentBasket) {
            res.json({ error: true, errorMessage: Resource.msg('error.cart.expired', 'cart', null) });
            return next();
        }

        var body;
        try {
            body = JSON.parse(req.form.body);
        } catch (e) {
            res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
            return next();
        }

        var paymentData = body.paymentData;
        if (!paymentData) {
            res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
            return next();
        }

        var token = paymentData.paymentMethodData
            && paymentData.paymentMethodData.tokenizationData
            && paymentData.paymentMethodData.tokenizationData.token;
        if (!token) {
            res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
            return next();
        }

        var email = '';
        if (req.currentCustomer.profile && req.currentCustomer.profile.email) {
            email = req.currentCustomer.profile.email;
        } else if (paymentData.email) {
            email = paymentData.email;
        }
        if (!email) {
            res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
            return next();
        }

        var gpayShippingAddress = paymentData.shippingAddress || {};
        var gpayBillingAddress = (paymentData.paymentMethodData
            && paymentData.paymentMethodData.info
            && paymentData.paymentMethodData.info.billingAddress) || {};
        var shipment = currentBasket.defaultShipment;
        var ShippingHelper = require('*/cartridge/scripts/checkout/shippingHelpers');
        var ShippingMgr = require('dw/order/ShippingMgr');

        try {
            Transaction.wrap(function () {
                currentBasket.setCustomerEmail(email);

                var shippingAddress = shipment.shippingAddress || shipment.createShippingAddress();
                var nameParts = (gpayShippingAddress.name || '').split(' ');
                shippingAddress.setFirstName(nameParts[0] || '');
                shippingAddress.setLastName(nameParts.slice(1).join(' ') || '');
                shippingAddress.setAddress1(gpayShippingAddress.address1 || '');
                shippingAddress.setAddress2(gpayShippingAddress.address2 || '');
                shippingAddress.setCity(gpayShippingAddress.locality || '');
                shippingAddress.setStateCode(gpayShippingAddress.administrativeArea || '');
                shippingAddress.setPostalCode(gpayShippingAddress.postalCode || '');
                shippingAddress.setCountryCode(gpayShippingAddress.countryCode || '');
                shippingAddress.setPhone(gpayShippingAddress.phoneNumber || '');

                var billingAddress = currentBasket.billingAddress || currentBasket.createBillingAddress();
                var billingNameParts = (gpayBillingAddress.name || '').split(' ');
                billingAddress.setFirstName(billingNameParts[0] || '');
                billingAddress.setLastName(billingNameParts.slice(1).join(' ') || '');
                billingAddress.setAddress1(gpayBillingAddress.address1 || '');
                billingAddress.setAddress2(gpayBillingAddress.address2 || '');
                billingAddress.setCity(gpayBillingAddress.locality || '');
                billingAddress.setStateCode(gpayBillingAddress.administrativeArea || '');
                billingAddress.setPostalCode(gpayBillingAddress.postalCode || '');
                billingAddress.setCountryCode(gpayBillingAddress.countryCode || '');
                billingAddress.setPhone(gpayBillingAddress.phoneNumber || '');

                if (!shipment.shippingMethod) {
                    var applicableMethods = ShippingMgr.getShipmentShippingModel(shipment).getApplicableShippingMethods();
                    if (applicableMethods.iterator().hasNext()) {
                        var firstMethod = applicableMethods.iterator().next();
                        ShippingHelper.selectShippingMethod(shipment, firstMethod.getID());
                    }
                }

                currentBasket.removeAllPaymentInstruments();
                var paymentInstrument = currentBasket.createPaymentInstrument(
                    jpmcConstants.JPMC_GOOGLE_PAY,
                    currentBasket.totalGrossPrice
                );
                paymentInstrument.custom.jpmcWalletProvider = jpmcConstants.GOOGLE_PAY_WALLET_PROVIDER;

                basketCalculationHelpers.calculateTotals(currentBasket);
            });

            var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
            var validatedProducts = validationHelpers.validateProducts(currentBasket);
            if (validatedProducts.error) {
                clearBasketState(currentBasket, Transaction);
                session.privacy.jpmcGooglePayToken = null;
                res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
                return next();
            }

            var gpayMethod = PaymentMgr.getPaymentMethod(jpmcConstants.JPMC_GOOGLE_PAY);
            var processor = gpayMethod && gpayMethod.getPaymentProcessor();
            if (!processor) {
                clearBasketState(currentBasket, Transaction);
                session.privacy.jpmcGooglePayToken = null;
                res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
                return next();
            }

            var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(currentBasket);
            if (calculatedPaymentTransaction.error) {
                clearBasketState(currentBasket, Transaction);
                session.privacy.jpmcGooglePayToken = null;
                res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
                return next();
            }

            var handleResult;
            var hookId = 'app.payment.processor.' + processor.ID.toLowerCase();
            if (HookMgr.hasHook(hookId)) {
                handleResult = HookMgr.callHook(
                    hookId,
                    'Handle',
                    currentBasket,
                    { googlePayToken: { value: token } },
                    jpmcConstants.JPMC_GOOGLE_PAY,
                    req
                );
            } else {
                handleResult = HookMgr.callHook('app.payment.processor.default', 'Handle');
            }

            if (handleResult.error) {
                clearBasketState(currentBasket, Transaction);
                session.privacy.jpmcGooglePayToken = null;
                res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
                return next();
            }

            session.privacy.jpmcGooglePayToken = token;
            res.json({ error: false });

        } catch (e) {
            clearBasketState(currentBasket, Transaction);
            session.privacy.jpmcGooglePayToken = null;
            res.json({ error: true, errorMessage: Resource.msg('error.technical', 'checkout', null) });
        }

        return next();
    }
);

/**
 * JPMCGooglePay-PrepareBasket : Saves basket state and clears all items for Google Pay flow (PDP express checkout)
 * @name JPMCGooglePay-PrepareBasket
 * @function
 * @memberof JPMCGooglePay
 * @param {middleware} - server.middleware.https
 * @param {middleware} - csrfProtection.validateAjaxRequest
 * @returns {json} Success or error status
 */
server.post('PrepareBasket',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Transaction = require('dw/system/Transaction');

        try {
            var currentBasket = BasketMgr.getCurrentOrNewBasket();
            if (!currentBasket) {
                res.json({ error: true });
                return next();
            }

            Transaction.wrap(function () {
                var lineItemsList = {};
                var pliIterator = currentBasket.getProductLineItems().iterator();
                while (pliIterator.hasNext()) {
                    var pli = pliIterator.next();
                    lineItemsList[pli.productID] = (lineItemsList[pli.productID] || 0) + pli.quantityValue;
                }
                session.privacy.allProductLineItems = JSON.stringify(lineItemsList);

                currentBasket.removeAllPaymentInstruments();

                var bonusItems = currentBasket.getBonusDiscountLineItems().iterator();
                while (bonusItems.hasNext()) {
                    currentBasket.removeBonusDiscountLineItem(bonusItems.next());
                }

                var couponItems = currentBasket.getCouponLineItems().iterator();
                while (couponItems.hasNext()) {
                    currentBasket.removeCouponLineItem(couponItems.next());
                }

                var giftItems = currentBasket.getGiftCertificateLineItems().iterator();
                while (giftItems.hasNext()) {
                    currentBasket.removeGiftCertificateLineItem(giftItems.next());
                }

                var priceAdjs = currentBasket.getPriceAdjustments().iterator();
                while (priceAdjs.hasNext()) {
                    currentBasket.removePriceAdjustment(priceAdjs.next());
                }

                var allPlis = currentBasket.getProductLineItems().iterator();
                while (allPlis.hasNext()) {
                    currentBasket.removeProductLineItem(allPlis.next());
                }

                currentBasket.updateTotals();
            });

            res.json({ error: false });
        } catch (e) {
            res.json({ error: true });
        }

        return next();
    }
);

/**
 * JPMCGooglePay-RestoreBasket : Restores previously saved basket state when Google Pay flow is cancelled
 * @name JPMCGooglePay-RestoreBasket
 * @function
 * @memberof JPMCGooglePay
 * @param {middleware} - server.middleware.https
 * @param {middleware} - csrfProtection.validateAjaxRequest
 * @returns {json} Success or error status
 */
server.post('RestoreBasket',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var Transaction = require('dw/system/Transaction');

        var snapshotStr = session.privacy.allProductLineItems;
        if (!snapshotStr) {
            res.json({ error: false });
            return next();
        }

        var snapshot;
        try {
            snapshot = JSON.parse(snapshotStr);
        } catch (e) {
            res.json({ error: true });
            return next();
        }

        try {
            Transaction.wrap(function () {
                var basket = BasketMgr.getCurrentOrNewBasket();

                var plisToRemove = [];
                var existingPlis = basket.getProductLineItems().iterator();
                while (existingPlis.hasNext()) {
                    plisToRemove.push(existingPlis.next());
                }
                for (var r = 0; r < plisToRemove.length; r++) {
                    basket.removeProductLineItem(plisToRemove[r]);
                }
                basket.removeAllPaymentInstruments();

                var couponsToRemove = [];
                var existingCoupons = basket.getCouponLineItems().iterator();
                while (existingCoupons.hasNext()) {
                    couponsToRemove.push(existingCoupons.next());
                }
                for (var c = 0; c < couponsToRemove.length; c++) {
                    basket.removeCouponLineItem(couponsToRemove[c]);
                }

                var defaultShipment = basket.getDefaultShipment();
                var products = snapshot.products || snapshot;
                var productIds = Object.keys(products);
                for (var i = 0; i < productIds.length; i++) {
                    var productId = productIds[i];
                    var qty = products[productId];
                    if (productId && qty > 0) {
                        var newPli = basket.createProductLineItem(productId, defaultShipment);
                        newPli.setQuantityValue(qty);
                    }
                }

                var coupons = snapshot.coupons || [];
                for (var d = 0; d < coupons.length; d++) {
                    try {
                        basket.createCouponLineItem(coupons[d], true);
                    } catch (couponErr) { /* coupon may no longer be valid */ }
                }
            });

            var quantityTotal = 0;
            var products2 = snapshot.products || snapshot;
            var snapshotKeys = Object.keys(products2);
            for (var j = 0; j < snapshotKeys.length; j++) {
                var snapshotQty = products2[snapshotKeys[j]];
                if (snapshotQty > 0) { quantityTotal += snapshotQty; }
            }

            session.privacy.allProductLineItems = null;
            res.json({ error: false, quantityTotal: quantityTotal });
        } catch (e) {
            res.json({ error: true });
        }

        return next();
    }
);

module.exports = server.exports();
