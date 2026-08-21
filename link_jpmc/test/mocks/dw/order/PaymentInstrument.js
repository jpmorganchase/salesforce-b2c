'use strict';

/**
 * Mock for dw/order/PaymentInstrument
 */
function PaymentInstrument() {
    this.paymentMethod = 'CREDIT_CARD';
    this.paymentTransaction = null;
    this.creditCardToken = null;
    this.creditCardNumber = null;
    this.creditCardExpirationMonth = null;
    this.creditCardExpirationYear = null;
    this.creditCardType = null;
    this.creditCardHolder = null;
    this.lineItemCtnr = null;
    this.custom = {};
}

// Payment Method Constants
PaymentInstrument.METHOD_CREDIT_CARD = 'CREDIT_CARD';
PaymentInstrument.METHOD_BML = 'BML';
PaymentInstrument.METHOD_DW_APPLE_PAY = 'DW_APPLE_PAY';

PaymentInstrument.prototype.getPaymentMethod = function () {
    return this.paymentMethod;
};

PaymentInstrument.prototype.setPaymentMethod = function (method) {
    this.paymentMethod = method;
};

PaymentInstrument.prototype.getPaymentTransaction = function () {
    return this.paymentTransaction;
};

PaymentInstrument.prototype.getCreditCardToken = function () {
    return this.creditCardToken;
};

PaymentInstrument.prototype.setCreditCardToken = function (token) {
    this.creditCardToken = token;
};

PaymentInstrument.prototype.getCreditCardNumber = function () {
    return this.creditCardNumber;
};

PaymentInstrument.prototype.setCreditCardNumber = function (number) {
    this.creditCardNumber = number;
};

PaymentInstrument.prototype.getCreditCardType = function () {
    return this.creditCardType;
};

PaymentInstrument.prototype.setCreditCardType = function (type) {
    this.creditCardType = type;
};

PaymentInstrument.prototype.getCreditCardExpirationMonth = function () {
    return this.creditCardExpirationMonth;
};

PaymentInstrument.prototype.setCreditCardExpirationMonth = function (month) {
    this.creditCardExpirationMonth = month;
};

PaymentInstrument.prototype.getCreditCardExpirationYear = function () {
    return this.creditCardExpirationYear;
};

PaymentInstrument.prototype.setCreditCardExpirationYear = function (year) {
    this.creditCardExpirationYear = year;
};

PaymentInstrument.prototype.setCreditCardHolder = function (holder) {
    this.creditCardHolder = holder;
};

PaymentInstrument.prototype.getCreditCardHolder = function () {
    return this.creditCardHolder;
};

PaymentInstrument.prototype.getLineItemCtnr = function () {
    return this.lineItemCtnr;
};

/**
 * Static reset function for test cleanup
 */
PaymentInstrument.reset = function () {
    // Nothing to reset at class level
};

/**
 * Factory method to create a new PaymentInstrument instance
 */
PaymentInstrument.create = function () {
    return new PaymentInstrument();
};

module.exports = PaymentInstrument;
