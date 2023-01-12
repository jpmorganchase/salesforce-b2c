'use strict';

/* global $ V*/

/**
 *@function onVisaCheckoutReady
*/
function onVisaCheckoutReady() {
    const NUMERIC_REGEXP = /[-]{0,1}[\d]*[.]{0,1}[\d]+/g;
    var visaPayConfigurations = $('.jpmcO-visa-pay').data('visa-pay-configurations');
    V.init({
        apikey: visaPayConfigurations.apikey,
        paymentRequest: {
            currencyCode: $('.payment-options').length > 0 ? $('.payment-options').data('currency-code') : 'USD',
            subtotal: $('.payment-options').length > 0 ? $('.grand-total-sum')[0].innerText.match(NUMERIC_REGEXP)[0] : '0'

        }
    });
    V.on('payment.success', function (payment) {
        $('#visaPay').val(JSON.stringify(payment));
    });
    V.on('payment.cancel', function (payment) {
        $('#visaPay').val(JSON.stringify(payment));
    });
    V.on('payment.error', function (payment, error) {
        $('#visaPay').val(JSON.stringify(error));
    });
}

module.exports.onVisaCheckoutReady = onVisaCheckoutReady;
