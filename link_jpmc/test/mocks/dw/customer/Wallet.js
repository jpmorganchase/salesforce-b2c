'use strict';

var PaymentInstrument = require('../../dw/order/PaymentInstrument');

/**
 * Mock for dw.customer.Wallet
 * Supports createPaymentInstrument / removePaymentInstrument for RTAU unit tests.
 */
function Wallet() {
    this._instruments = [];
}

Wallet.prototype.createPaymentInstrument = function (paymentMethodId) {
    var pi = new PaymentInstrument();
    pi.paymentMethod = paymentMethodId;
    this._instruments.push(pi);
    return pi;
};

Wallet.prototype.removePaymentInstrument = function (pi) {
    var idx = this._instruments.indexOf(pi);
    if (idx !== -1) {
        this._instruments.splice(idx, 1);
    }
};

Wallet.prototype.getPaymentInstruments = function (paymentMethodId) {
    var filtered = this._instruments.filter(function (pi) {
        return !paymentMethodId || pi.paymentMethod === paymentMethodId;
    });
    return {
        iterator: function () {
            var i = 0;
            return {
                hasNext: function () { return i < filtered.length; },
                next: function () { return filtered[i++]; }
            };
        }
    };
};

module.exports = Wallet;
