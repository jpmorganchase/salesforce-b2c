'use strict';

var processInclude = require('base/util');

$(document).ready(function () {
    processInclude(require('base/cart/cart'));
    require('./jpmc/googlePay').init('cart');
});
