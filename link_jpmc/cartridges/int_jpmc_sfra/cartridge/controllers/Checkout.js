'use strict';

var server = require('server');
server.extend(module.superModule);

server.prepend('Begin', function (req, res, next) {
    var URLUtils = require('dw/web/URLUtils');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    var stage = req.querystring.stage;

    // Prevent deep-linking into the review/placeOrder step in DROP_IN mode.
    // Drop-in payment happens on payment stage and JPMC-PlaceOrder finalizes order.
    if (JPMCMerchantResolver.getCheckoutMode() === 'DROP_IN' && stage === 'placeOrder') {
        res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment'));
        return next();
    }

    return next();
});



/**
 * Builds the Drop-in UI bootstrap configuration passed to the ISML templates.
 * @param {Object} [resolvedConfig] - resolved merchant configuration
 * @returns {Object} bootstrap config consumed by the Drop-in client module
 */
function buildDropInConfig(resolvedConfig) {
    var Site = require('dw/system/Site');
    var URLUtils = require('dw/web/URLUtils');
    var prefs = Site.getCurrent().getPreferences().getCustom();
    var defaultScriptUrl = 'https://checkout-cat.merchant.jpmorgan.com/drop-in-ui.mjs';

    var scriptUrlPref = (resolvedConfig && resolvedConfig.dropInScriptUrl)
        ? resolvedConfig.dropInScriptUrl
        : prefs.JPMCDropInScriptUrl;
    var scriptUrl = (scriptUrlPref && typeof scriptUrlPref === 'object' && scriptUrlPref.value)
        ? scriptUrlPref.value : scriptUrlPref;

    var themeOverridesRaw = (resolvedConfig && resolvedConfig.dropInThemeOverrides)
        ? resolvedConfig.dropInThemeOverrides
        : prefs.JPMCDropInThemeOverrides;
    var themeOverrides = null;
    if (themeOverridesRaw) {
        try {
            themeOverrides = JSON.parse(themeOverridesRaw);
        } catch (e) {
            themeOverrides = null;
        }
    }

    return {
        scriptUrl: scriptUrl || defaultScriptUrl,
        themeOverrides: themeOverrides,
        createSessionUrl: URLUtils.url('JPMC-CreateSession').toString(),
        getIntentUrl: URLUtils.url('JPMC-GetIntent').toString(),
        placeOrderUrl: URLUtils.url('JPMC-PlaceOrder').toString(),
        orderConfirmUrl: URLUtils.url('Order-Confirm').toString(),
        csrfTokenName: require('dw/web/CSRFProtection').getTokenName(),
        csrfToken: require('dw/web/CSRFProtection').generateToken()
    };
}
/**
 * Checkout-Begin : JPMC extension to inject PIE encryption URLs and filter customer payment instruments by merchant ID
 * @name Checkout-Begin
 * @function
 * @memberof Checkout
 * @param {middleware} - server.append
 * @param {httpparameter} - req - HTTP request
 * @param {httpparameter} - res - HTTP response
 * @param {Function} next - next middleware function
 */
server.append('Begin', function (req, res, next) {
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    var AccountModel = require('*/cartridge/models/account');

    var resolvedConfig = JPMCMerchantResolver.resolve();
    var currentMerchantId = resolvedConfig ? resolvedConfig.merchantId : null;

    var viewData = res.getViewData();
    var filteredCustomer = viewData && viewData.customer;

    if (filteredCustomer && req.currentCustomer.raw.registered) {
        filteredCustomer = new AccountModel(
            req.currentCustomer,
            filteredCustomer.preferredAddress,
            null,
            currentMerchantId
        );
    }

    var checkoutMode = JPMCMerchantResolver.getCheckoutMode();
    
    // Apply mode-aware filtering: strip irrelevant settings based on checkout mode
    var filteredConfig = JPMCMerchantResolver.filterByMode(resolvedConfig, checkoutMode);
    
    var pieGetKeyUrl = '';
    var pieEncryptionUrl = '';
    var jpmcDropIn = null;

    if (checkoutMode === 'DROP_IN') {
        jpmcDropIn = buildDropInConfig(filteredConfig);
    } else {
        var pieGetKeyBase = filteredConfig.pieGetKeyUrl || '';
        var pieEncryptionBase = filteredConfig.pieEncryptionUrl || '';
        var pieKey = filteredConfig.pieKey || '';
        pieGetKeyUrl = (pieGetKeyBase && pieKey)
            ? pieGetKeyBase + '/' + pieKey + '/getkey.js' : '';
        pieEncryptionUrl = pieEncryptionBase;
    }

    res.setViewData({
        customer: filteredCustomer,
        jpmcCheckoutMode: checkoutMode,
        jpmcPieGetKeyUrl: pieGetKeyUrl,
        jpmcPieEncryptionUrl: pieEncryptionUrl,
        jpmcDropIn: jpmcDropIn
    });

    return next();
});

module.exports = server.exports();

