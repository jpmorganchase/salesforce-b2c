'use strict';

/* global $, google */

/**
 * Provide Google Pay API with a payment amount, currency, and amount status
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#TransactionInfo|TransactionInfo}
 * @returns {Object} transaction info, suitable for use as transactionInfo property of PaymentDataRequest
 */
function getGoogleTransactionInfo() {
    return {
        countryCode: 'US',
        currencyCode: 'USD',
        totalPriceStatus: 'FINAL',
        totalPrice: '0'
    };
}

module.exports.getGoogleTransactionInfo = getGoogleTransactionInfo;
