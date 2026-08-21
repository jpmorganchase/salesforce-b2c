'use strict';

var server = require('server');

server.extend(module.superModule);

/**
 * PaymentInstruments-List : In DROP_IN mode redirects to Account-Show.
 * Otherwise filters payment instruments to show only those belonging to the current merchant ID.
 * @name PaymentInstruments-List
 * @function
 * @memberof PaymentInstruments
 * @param {middleware} - server.append
 */
server.append('List', function (req, res, next) {
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

    if (JPMCMerchantResolver.getCheckoutMode() === 'DROP_IN') {
        var URLUtils = require('dw/web/URLUtils');
        res.redirect(URLUtils.url('Account-Show'));
        return next();
    }

    var resolvedConfig = JPMCMerchantResolver.resolve();
    var currentMerchantId = resolvedConfig && resolvedConfig.merchantId;

    if (!currentMerchantId) {
        return next();
    }

    var viewData = res.getViewData();
    if (!viewData.paymentInstruments || !viewData.paymentInstruments.length) {
        return next();
    }

    var CustomerMgr = require('dw/customer/CustomerMgr');
    var customer = CustomerMgr.getCustomerByCustomerNumber(req.currentCustomer.profile.customerNo);
    if (!customer) {
        return next();
    }

    var rawPIs = customer.getProfile().getWallet().getPaymentInstruments().toArray();
    var merchantByUUID = {};
    for (var i = 0; i < rawPIs.length; i++) {
        merchantByUUID[rawPIs[i].UUID] = rawPIs[i].custom.jpmcMerchantId || null;
    }

    viewData.paymentInstruments = viewData.paymentInstruments.filter(function (pi) {
        var piMid = merchantByUUID[pi.UUID];
        return !piMid || piMid === currentMerchantId;
    });
    viewData.noSavedPayments = viewData.paymentInstruments.length === 0;
    res.setViewData(viewData);

    return next();
});

/**
 * Stamps newly saved PIs with the active merchantId.
 */
server.append('SavePayment', function (req, res, next) {
    this.on('route:BeforeComplete', function () {
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
        var resolvedConfig = JPMCMerchantResolver.resolve();
        if (!resolvedConfig || !resolvedConfig.merchantId) {
            return;
        }

        var CustomerMgr = require('dw/customer/CustomerMgr');
        var customer = CustomerMgr.getCustomerByCustomerNumber(req.currentCustomer.profile.customerNo);
        if (!customer) {
            return;
        }

        var Transaction = require('dw/system/Transaction');
        var rawPIs = customer.getProfile().getWallet().getPaymentInstruments().toArray();

        Transaction.wrap(function () {
            for (var i = 0; i < rawPIs.length; i++) {
                if (!rawPIs[i].custom.jpmcMerchantId) {
                    rawPIs[i].custom.jpmcMerchantId = resolvedConfig.merchantId;
                }
            }
        });
    });

    return next();
});

/**
 * PaymentInstruments-AddPayment : In DROP_IN mode redirects to Account-Show.
 * Otherwise exposes PIE encryption URLs on the Add Payment view.
 */
server.append('AddPayment', function (req, res, next) {
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

    if (JPMCMerchantResolver.getCheckoutMode() === 'DROP_IN') {
        var URLUtils = require('dw/web/URLUtils');
        res.redirect(URLUtils.url('Account-Show'));
        return next();
    }

    var resolvedConfig = JPMCMerchantResolver.resolve();

    var pieGetKeyUrl = resolvedConfig.pieGetKeyUrl || '';
    var pieEncryptionUrl = resolvedConfig.pieEncryptionUrl || '';
    var pieKey = resolvedConfig.pieKey || '';
    var jpmcPieGetKeyUrl = (pieGetKeyUrl && pieKey)
        ? pieGetKeyUrl + '/' + pieKey + '/getkey.js' : '';

    res.setViewData({
        jpmcPieGetKeyUrl: jpmcPieGetKeyUrl,
        jpmcPieEncryptionUrl: pieEncryptionUrl
    });

    return next();
});

/**
 * PaymentInstruments-DeletePayment : In DROP_IN mode redirects to Account-Show
 * to prevent direct URL access to the delete endpoint when saved card management
 * is not supported for DROP_IN locales.
 */
server.append('DeletePayment', function (req, res, next) {
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    if (JPMCMerchantResolver.getCheckoutMode() === 'DROP_IN') {
        var URLUtils = require('dw/web/URLUtils');
        res.redirect(URLUtils.url('Account-Show'));
    }
    return next();
});

module.exports = server.exports();
