'use strict';

module.exports = function () {
    $('body').on('product:updateAddToCart', function (e, response) {
        if (response.product.readyToOrder) {
            var applePayButton = $('.apple-pay-pdp', response.$productContainer);
            if (applePayButton.length !== 0) {
                applePayButton.attr('sku', response.product.id);
            } else {
                var showApplePay = true;
                if (typeof $('.cart-and-ipay').data('ipay-enabled') !== 'undefined') {
                    showApplePay = $('.cart-and-ipay').data('ipay-enabled');
                }
                if ($('.apple-pay-pdp').length === 0 && showApplePay) { // eslint-disable-line no-lonely-if
                    if ($('.cart-and-ipay').data('is-apple-session') === true) {
                        var $applePayBtn = $('<isapplepay></isapplepay>')
                            .addClass('apple-pay-pdp btn btn-block')
                            .attr('sku', response.product.id);
                        var $col = $('<div></div>').addClass('col pl-1 pdp-apple-pay-button').append($applePayBtn);
                        $('.cart-and-ipay .row').append($col);
                        $('.pdp-checkout-button').addClass('pr-1');
                    }
                }
            }
        } else {
            $('.pdp-apple-pay-button').remove();
            $('.pdp-checkout-button').removeClass('pr-1');
        }
    });
};
