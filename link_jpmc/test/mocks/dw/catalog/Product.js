'use strict';

/**
 * Mock for dw/catalog/Product
 */
function Product() {
    this.ID = 'TEST-PRODUCT-001';
    this.name = 'Test Product';
    this.classificationCategory = null;
}

Product.prototype.getID = function () {
    return this.ID;
};

Product.prototype.getName = function () {
    return this.name;
};

Product.prototype.getClassificationCategory = function () {
    return this.classificationCategory;
};

module.exports = Product;
