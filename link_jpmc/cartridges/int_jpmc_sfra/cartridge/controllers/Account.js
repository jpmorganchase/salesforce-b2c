'use strict';

var server = require('server');

server.extend(module.superModule);

/**
 * Hides the payment section on the Account dashboard when DROP_IN checkout mode is active.
 * Saved card management is not supported in My Account for DROP_IN locales;
 * payment-related routes redirect to Account-Show instead.
 */
server.append('Show', function (req, res, next) {
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    if (JPMCMerchantResolver.getCheckoutMode() === 'DROP_IN') {
        res.setViewData({ hidePaymentSection: true });
    }
    return next();
});

module.exports = server.exports();
