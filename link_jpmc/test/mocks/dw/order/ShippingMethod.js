'use strict';

/**
 * Mock for dw/order/ShippingMethod
 */
function ShippingMethod() {
    this.displayName = 'Standard Shipping';
}

ShippingMethod.prototype.getDisplayName = function () {
    return this.displayName;
};

module.exports = ShippingMethod;
