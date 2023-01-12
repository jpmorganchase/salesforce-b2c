'use strict';

/* global $ */

var processInclude = require('BaseCartridge/util');

$(document).ready(function () {
    processInclude(require('./checkout/jpmcOVisaPay'));
});
