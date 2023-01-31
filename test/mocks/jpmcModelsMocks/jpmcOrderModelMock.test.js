'use strict';

var JPMCOrbitalConstants = require('../jpmcOConstantsHelperMocks.test');

/**
 *
 * @param {orderObject} orderObject orderObject
 */
function OrderModel(orderObject) {
    this.orderID = orderObject.orderID;
    this.amount = orderObject.amount;
    this.industryType = JPMCOrbitalConstants.EC;
}

OrderModel.getOrderObjectForCredit = function (order) {
    var orderObject = {};
    orderObject.orderID = order.currentOrderNo;
    orderObject.amount = (order.totalGrossPrice.value * 100).toFixed(0);
    return orderObject;
};

OrderModel.getOrderObjectForProfile = function (order) {
    var orderObject = {};
    orderObject.orderID = order.currentOrderNo;
    orderObject.amount = (order.totalGrossPrice.value * 100).toFixed(0);
    return orderObject;
};


OrderModel.getOrderObjectForElectronicCheck = function (order) {
    var orderObject = {};
    orderObject.orderID = order.currentOrderNo;
    orderObject.amount = (order.totalGrossPrice.value * 100).toFixed(0);
    return orderObject;
};

module.exports = OrderModel;
