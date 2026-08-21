'use strict';

/**
 * Mock for dw/order/ProductLineItem
 */
function ProductLineItem() {
    this.productID = 'TEST-PRODUCT-001';
    this.productName = 'Test Product';
    this.quantity = { value: 1 };
    this.adjustedPrice = { value: 99.99, getValue: function() { return this.value; } };
    this.product = null;
}

ProductLineItem.prototype.getProductID = function () {
    return this.productID;
};

ProductLineItem.prototype.getProductName = function () {
    return this.productName;
};

ProductLineItem.prototype.getQuantityValue = function () {
    return this.quantity.value;
};

ProductLineItem.prototype.getAdjustedPrice = function () {
    return this.adjustedPrice;
};

ProductLineItem.prototype.getProduct = function () {
    return this.product;
};

module.exports = ProductLineItem;
