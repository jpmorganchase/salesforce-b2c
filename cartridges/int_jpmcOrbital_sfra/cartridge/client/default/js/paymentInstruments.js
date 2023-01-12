'use strict';

var processInclude = require('BaseCartridge/util');

$(document).ready(function () {
    processInclude(require('./paymentInstruments/paymentInstruments'));
});
