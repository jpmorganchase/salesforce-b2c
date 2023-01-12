'use strict';

/* global $ */

var processInclude = require('BaseCartridge/util');

$(document).ready(function () {
    try {
        processInclude(require('./checkout/jpmcOGooglePayCommon'));
    } catch (error) {
        console.log(error);
    }
});
