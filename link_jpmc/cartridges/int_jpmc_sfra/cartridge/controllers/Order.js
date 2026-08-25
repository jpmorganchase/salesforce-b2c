'use strict';

var server = require('server');

server.extend(module.superModule);

/**
 * Injects JPMC checkout mode for conditional template rendering.
 * DROP_IN mode hides billing summary in confirmation page (address arrives via notification).
 * Direct API (PIE) mode shows billing summary as OOTB.
 */
server.append('Confirm', function (req, res, next) {
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');
    var checkoutMode = JPMCMerchantResolver.getCheckoutMode();
    
    var viewData = res.getViewData();
    viewData.jpmcCheckoutMode = checkoutMode;
    res.setViewData(viewData);
    
    return next();
});

module.exports = server.exports();
