'use strict';

var Collection = require('../../dw.util.Collection');

/**
 * Mock for dw/order/Basket and dw/order/Order
 * Using same mock for both since they share common interfaces
 */
function Order() {
    this.orderNo = 'TEST-ORDER-001';
    this.UUID = 'test-uuid-12345';
    this.orderToken = 'test-order-token';
    this.totalGrossPrice = { value: 100.00, currencyCode: 'USD' };
    this.currencyCode = 'USD';
    this.customerEmail = 'test@example.com';
    this.billingAddress = null;
    this.defaultShipment = null;
    this.productLineItems = new Collection();
    this.paymentInstruments = new Collection();
    this.paymentStatus = Order.PAYMENT_STATUS_NOTPAID;
    this.notes = new Collection();
    this.custom = {};
}

// Payment status constants
Order.PAYMENT_STATUS_NOTPAID = 0;
Order.PAYMENT_STATUS_PARTPAID = 1;
Order.PAYMENT_STATUS_PAID = 2;

Order.prototype.getOrderNo = function () {
    return this.orderNo;
};

Order.prototype.getOrderToken = function () {
    return this.orderToken;
};

Order.prototype.getUUID = function () {
    return this.UUID;
};

Order.prototype.setOrderNo = function (orderNo) {
    this.orderNo = orderNo;
};

Order.prototype.getTotalGrossPrice = function () {
    return {
        value: this.totalGrossPrice.value,
        currencyCode: this.totalGrossPrice.currencyCode,
        getValue: function () {
            return this.value;
        },
        getCurrencyCode: function () {
            return this.currencyCode;
        }
    };
};

Order.prototype.getCurrencyCode = function () {
    return this.currencyCode;
};

Order.prototype.getCustomerEmail = function () {
    return this.customerEmail;
};

Order.prototype.getBillingAddress = function () {
    return this.billingAddress;
};

Order.prototype.getDefaultShipment = function () {
    return this.defaultShipment;
};

Order.prototype.getAllProductLineItems = function () {
    return this.productLineItems;
};

Order.prototype.getPaymentInstruments = function (paymentMethodId) {
    var Collection = require('../../dw.util.Collection');
    var filtered;
    if (paymentMethodId) {
        filtered = this.paymentInstruments.toArray().filter(function (pi) {
            return pi.paymentMethod === paymentMethodId;
        });
    } else {
        filtered = this.paymentInstruments.toArray();
    }
    return new Collection(filtered);
};

Order.prototype.createPaymentInstrument = function (paymentMethod, amount) {
    var PaymentInstrument = require('./PaymentInstrument');
    var PaymentTransaction = require('./PaymentTransaction');
    
    var pi = new PaymentInstrument();
    pi.paymentMethod = paymentMethod;
    pi.paymentTransaction = new PaymentTransaction();
    pi.paymentTransaction.amount = { value: amount };
    
    this.paymentInstruments.add(pi);
    return pi;
};

Order.prototype.removePaymentInstrument = function (pi) {
    var arr = this.paymentInstruments.arr || [];
    var idx = arr.indexOf(pi);
    if (idx !== -1) {
        arr.splice(idx, 1);
    }
};

Order.prototype.getPaymentStatus = function () {
    return this.paymentStatus;
};

Order.prototype.setPaymentStatus = function (status) {
    this.paymentStatus = status;
};

Order.prototype.addNote = function (subject, text) {
    this.notes.add({ subject: subject, text: text });
};

Order.prototype.getNotes = function () {
    return this.notes;
};

/**
 * Helper to reset the mock state
 */
Order.resetMock = function () {
    // Nothing to reset at class level
};

/**
 * Static reset function for test cleanup
 */
Order.reset = function () {
    // Nothing to reset at class level
};

/**
 * Factory method to create a new Order instance
 */
Order.create = function () {
    return new Order();
};

module.exports = Order;
