'use strict';

/**
 * Mock for dw/order/PaymentTransaction
 */
function PaymentTransaction() {
    this.transactionID = null;
    this.type = null;
    this.amount = null;
    this.custom = {};
}

// Constants
PaymentTransaction.TYPE_AUTH = 'AUTH';
PaymentTransaction.TYPE_CAPTURE = 'CAPTURE';
PaymentTransaction.TYPE_CREDIT = 'CREDIT';

PaymentTransaction.prototype.getTransactionID = function () {
    return this.transactionID;
};

PaymentTransaction.prototype.setTransactionID = function (id) {
    this.transactionID = id;
};

PaymentTransaction.prototype.getType = function () {
    return this.type;
};

PaymentTransaction.prototype.setType = function (type) {
    this.type = type;
};

PaymentTransaction.prototype.getAmount = function () {
    return this.amount;
};

PaymentTransaction.prototype.setAmount = function (amount) {
    this.amount = amount;
};

PaymentTransaction.prototype.setPaymentProcessor = function (processor) {
    this.paymentProcessor = processor;
};

PaymentTransaction.prototype.getPaymentProcessor = function () {
    return this.paymentProcessor;
};

/**
 * Static reset function for test cleanup
 */
PaymentTransaction.reset = function () {
    // Nothing to reset at class level
};

/**
 * Factory method to create a new PaymentTransaction instance
 */
PaymentTransaction.create = function () {
    return new PaymentTransaction();
};

module.exports = PaymentTransaction;
