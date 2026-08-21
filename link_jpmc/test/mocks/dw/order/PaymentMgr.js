'use strict';

/**
 * Mock for dw.order.PaymentMgr
 */
var paymentMethods = {};

function PaymentMgr() {}

PaymentMgr.getPaymentMethod = function (methodId) {
    return paymentMethods[methodId] || null;
};

/**
 * Helper to set mock payment methods
 * @param {string} methodId - Payment method ID
 * @param {Object} method - Payment method mock
 */
PaymentMgr.setMockPaymentMethod = function (methodId, method) {
    paymentMethods[methodId] = method;
};

/**
 * Helper to reset payment methods
 */
PaymentMgr.resetMockPaymentMethods = function () {
    paymentMethods = {};
};

module.exports = PaymentMgr;
