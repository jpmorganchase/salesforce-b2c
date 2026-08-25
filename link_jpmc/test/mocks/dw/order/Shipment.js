'use strict';

/**
 * Mock for dw/order/Shipment
 */
function Shipment() {
    this.shippingAddress = null;
    this.shippingMethod = null;
}

Shipment.prototype.getShippingAddress = function () {
    return this.shippingAddress;
};

Shipment.prototype.getShippingMethod = function () {
    return this.shippingMethod;
};

module.exports = Shipment;
