'use strict';

/* global $ */

/**
 * Provide Google Pay API with a payment amount, currency, and amount status
 *
 * @see {@link https://developers.google.com/pay/api/web/reference/request-objects#TransactionInfo|TransactionInfo}
 * @returns {Object} transaction info, suitable for use as transactionInfo property of PaymentDataRequest
 */
function getGoogleTransactionInfo() {
    const NUMERIC_REGEXP = /[-]{0,1}[\d]*[.]{0,1}[\d]+/g;

    return {
        displayItems: [
            {
                label: $('.subtotal-item').find('.order-receipt-label')[0].innerText,
                type: 'SUBTOTAL',
                price: $('.sub-total')[0].innerText.match(NUMERIC_REGEXP)[0]
            },
            {
                label: $('.shipping-item').find('.order-receipt-label')[0].innerText,
                type: 'LINE_ITEM',
                price: $('.shipping-total-cost')[0].innerText.match(NUMERIC_REGEXP)[0]
            },
            {
                label: $('.sales-tax-item').find('.order-receipt-label')[0].innerText,
                type: 'TAX',
                price: $('.tax-total')[0].innerText.match(NUMERIC_REGEXP)[0]
            }
        ],
        countryCode: $('.payment-options').data('country-code').split('_')[1],
        currencyCode: $('.payment-options').data('currency-code'),
        totalPriceStatus: 'FINAL',
        totalPrice: $('.grand-total-sum')[0].innerText.match(NUMERIC_REGEXP)[0],
        totalPriceLabel: $('.grand-total').find('.order-receipt-label')[0].innerText
    };
}

module.exports.getGoogleTransactionInfo = getGoogleTransactionInfo;
