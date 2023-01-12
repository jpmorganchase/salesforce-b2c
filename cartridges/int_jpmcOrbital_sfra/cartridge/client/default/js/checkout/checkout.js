'use strict';

var billingHelpers = require('./billing');
var base = require('BaseCartridge/checkout/checkout');

Object.keys(billingHelpers).forEach(function (item) {
    if (typeof billingHelpers[item] === 'object') {
        base[item] = $.extend({}, base[item], billingHelpers[item]);
    } else {
        base[item] = billingHelpers[item];
    }
});


base.showHiddenMethods = function () {
    var JPMCOrbitalConstants = $('.billing-nav.payment-information').data('jpmc-o-constants-helper');
    $('.add-payment').on('click', function () {
        var jpmcEnabled = $('.billing-nav.payment-information').data('isJpmcEnabled');
        if (jpmcEnabled) {
            $('.credit-card-selection-new input:enabled').each(function (i, input) {
                $(input).prop('disabled', true);
            });
            $('.credit-card-selection-new select:enabled').each(function (i, select) {
                $(select).prop('disabled', true);
            });
            $('.js-method-id').each(function (i, method) {
                if ($(method).data('method-id') === JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD) {
                    $(method).addClass(JPMCOrbitalConstants.hidden);
                } else if ($(method).data('method-id') !== JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD && $(method).data('method-id') !== JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD && $(method).data('method-id') !== JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
                    $(method).removeClass(JPMCOrbitalConstants.hidden);
                }
            });
            $('#jpmco-profile-content').removeClass('active');
            $('.cancel-new-payment').removeClass(JPMCOrbitalConstants.hidden);
        }
    });
    $('.cancel-new-payment').on('click', function () {
        $('.js-method-id').each(function (i, method) {
            if ($(method).data('method-id') !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD) {
                $(method).addClass(JPMCOrbitalConstants.hidden);
            } else {
                $(method).removeClass(JPMCOrbitalConstants.hidden);
            }
        });
        $('.cancel-new-payment').addClass(JPMCOrbitalConstants.hidden);
        $('#saved-instruments').click();
        $('#jpmco-profile-content').addClass('active');
    });
    $('.digital-wallets').on('click', function () {
        $('.js-method-id').each(function (i, method) {
            if ($(method).data('method-id') !== JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD) {
                $(method).removeClass(JPMCOrbitalConstants.hidden);
                $(method).find('.js-payment-option-tab').removeClass('active');
            }
        });
        $('#jpmco-electronic_check-content').addClass(JPMCOrbitalConstants.hidden);
        $('#jpmco-credit-card-content').addClass(JPMCOrbitalConstants.hidden);
        $('.digital-wallets').removeClass(JPMCOrbitalConstants.hidden);
        $('.digital-wallets').addClass('active');
    });
    $('.jpmco-electronic_check').on('click', function () {
        $('#jpmco-electronic_check-content').removeClass(JPMCOrbitalConstants.hidden);
    });
    $('.jpmco-credit-card').on('click', function () {
        $('#jpmco-credit-card-content').removeClass(JPMCOrbitalConstants.hidden);
    });
};

base.validateInput = function () {
    /**
     * @desc function to validate if the input is space character
     */
    $('.securityCode').on('input', function () {
        var value = $(this).val();
        value = value.replace(/\D/g, '');
        $(this).val(value);
    }
    );
    $('.creditContentSe').on('input', function () {
        var value = $(this).val();
        value = value.replace(/\D/g, '');
        $(this).val(value);
        $('.creditContentSe').data('cleave').setRawValue(value);
    }
    );
};

base.showSecurityCodeInput = function () {
    var JPMCOrbitalConstants = $('.billing-nav.payment-information').data('jpmc-o-constants-helper');
    $('#saved-instruments').on('click', function () {
        var text = $('#customerRefNum option:selected').text();
        if (text.includes(JPMCOrbitalConstants.Card) || text.includes(JPMCOrbitalConstants.GOOGLE) || text.includes(JPMCOrbitalConstants.VISA_CHECKOUT) || text.includes(JPMCOrbitalConstants.APPLE)) {
            $('.cvv_input').show();
        } else {
            $('.cvv_input').hide();
        }
    });

    $('#customerRefNum').change(function () {
        var text = $('#customerRefNum option:selected').text();
        if (text.includes(JPMCOrbitalConstants.Card) || text.includes(JPMCOrbitalConstants.GOOGLE) || text.includes(JPMCOrbitalConstants.VISA_CHECKOUT) || text.includes(JPMCOrbitalConstants.APPLE)) {
            $('.cvv_input').show();
        } else {
            $('.cvv_input').hide();
        }
    });
};


module.exports = base;
