'use strict';

var getConfig = require('@tridnguyen/config');

var customerNo = '00001001';
var customerToken = '225068845';
var UUID_CC = 'c03a47b97d53b06db14daf2d19';
var UUID_EC = 'b02e9193b57444922b9186cfe1';
var siteID = 'JPMC-SFRA';

var opts = Object.assign({}, getConfig({
    baseUrl: 'https://' + global.baseUrl + '/on/demandware.store/Sites-' + siteID + '-Site/en_US',
    customerNo: customerNo,
    customerToken: customerToken,
    UUID_CC: UUID_CC,
    UUID_EC: UUID_EC,
    suite: '*',
    reporter: 'spec',
    timeout: 60000,
    locale: 'x_default'
}, './config.json'));

module.exports = opts;
