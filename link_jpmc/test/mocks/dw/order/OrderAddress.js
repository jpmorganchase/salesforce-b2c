'use strict';

/**
 * Mock for dw/order/OrderAddress
 */
function OrderAddress() {
    this.firstName = 'John';
    this.lastName = 'Doe';
    this.address1 = '123 Main St';
    this.address2 = 'Apt 4B';
    this.city = 'New York';
    this.stateCode = 'NY';
    this.postalCode = '10001';
    this.countryCode = { value: 'US', getValue: function() { return this.value; } };
    this.phone = '555-123-4567';
    this.fullName = 'John Doe';
}

OrderAddress.prototype.getFirstName = function () {
    return this.firstName;
};

OrderAddress.prototype.getLastName = function () {
    return this.lastName;
};

OrderAddress.prototype.getAddress1 = function () {
    return this.address1;
};

OrderAddress.prototype.getAddress2 = function () {
    return this.address2;
};

OrderAddress.prototype.getCity = function () {
    return this.city;
};

OrderAddress.prototype.getStateCode = function () {
    return this.stateCode;
};

OrderAddress.prototype.getPostalCode = function () {
    return this.postalCode;
};

OrderAddress.prototype.getCountryCode = function () {
    return this.countryCode;
};

OrderAddress.prototype.getPhone = function () {
    return this.phone;
};

module.exports = OrderAddress;
