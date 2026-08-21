'use strict';

var baseHelpers = module.superModule;

/**
 * Creates an account model for the current customer with merchant ID filtering.
 * @param {Object} req - local instance of request object
 * @returns {Object} a plain object of the current customer's account
 */
baseHelpers.getAccountModel = function getAccountModel(req) {
    var AccountModel = require('*/cartridge/models/account');
    var AddressModel = require('*/cartridge/models/address');
    var orderHelpers = require('*/cartridge/scripts/order/orderHelpers');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

    if (!req.currentCustomer.profile) {
        return null;
    }

    var preferredAddressModel = req.currentCustomer.addressBook.preferredAddress
        ? new AddressModel(req.currentCustomer.addressBook.preferredAddress)
        : null;

    var orderModel = orderHelpers.getLastOrder(req);

    var resolvedConfig = JPMCMerchantResolver.resolve();
    var currentMerchantId = resolvedConfig ? resolvedConfig.merchantId : null;

    return new AccountModel(req.currentCustomer, preferredAddressModel, orderModel, currentMerchantId);
};

module.exports = baseHelpers;
