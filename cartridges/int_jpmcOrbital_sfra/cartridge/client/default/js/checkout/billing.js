'use strict';

var base = require('BaseCartridge/checkout/billing');
var cleave = require('../components/cleave');

/**
 * @function updatePaymentInformation
 * @description Update payment details summary based on payment method
 * @param {Object} order - order Object
 */
base.methods.updatePaymentInformation = function (order) {
    var $paymentSummary = $('.payment-details');
    var htmlToAppend = '';
    var JPMCOrbitalConstants = $paymentSummary.data('jpmc-o-constants-helper');
    if (order.billing.payment && order.billing.payment.selectedPaymentInstruments && order.billing.payment.selectedPaymentInstruments.length > 0) {
        order.billing.payment.selectedPaymentInstruments.forEach(function (selectedPaymentInstrument) {
            switch (selectedPaymentInstrument.paymentMethod) {
                case JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD:
                case JPMCOrbitalConstants.CREDIT_CARD:
                case JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD:
                case JPMCOrbitalConstants.JPMC_ORBITAL_PROFILE_METHOD:
                case JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD:
                case JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD:
                case JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD:
                default:
                    if (selectedPaymentInstrument.creditCardType !== JPMCOrbitalConstants.EC) {
                        htmlToAppend += '<span>' + order.resources.cardType + ' '
                        + selectedPaymentInstrument.type
                        + '</span><div>'
                        + selectedPaymentInstrument.maskedCreditCardNumber
                        + '</div>';
                        if (selectedPaymentInstrument.expirationMonth) {
                            htmlToAppend += '<div><span>' + order.resources.cardEnding + ' '
                        + selectedPaymentInstrument.expirationMonth
                        + '/' + selectedPaymentInstrument.expirationYear
                        + '</span></div>';
                        }
                    } else {
                        htmlToAppend += '<span>' + order.resources.cardType + ' '
                        + selectedPaymentInstrument.creditCardType
                        + '</span><div>'
                        + selectedPaymentInstrument.maskedBankAccountNumber
                        + '</div>';
                    }
            }
        });
    }

    $paymentSummary.empty().append(htmlToAppend);
};

/**
 * @function handlePaymentOptionChange
 * @description Handle payment option change
 */
base.methods.handlePaymentOptionChange = function () {
    var $activeTab = $(this);
    var activeTabId = $activeTab.attr('href');
    var $paymentInformation = $('.payment-information');
    var JPMCOrbitalConstants = $paymentInformation.data('jpmc-o-constants-helper');
    var isNewPayment = $('.user-payment-instruments').hasClass('checkout-hidden');

    if ($activeTab.hasClass('google-pay-tab') || $activeTab.hasClass('visa-pay-tab')) {
        $(".js-method-id[data-method-id='" + JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD + "']").removeClass(JPMCOrbitalConstants.hidden);
        $(".js-method-id[data-method-id='" + JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD + "']").removeClass(JPMCOrbitalConstants.hidden);
        $(".js-method-id[data-method-id='" + JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD + "']").removeClass(JPMCOrbitalConstants.hidden);
    } else {
        $(".js-method-id[data-method-id='" + JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD + "']").addClass(JPMCOrbitalConstants.hidden);
        $(".js-method-id[data-method-id='" + JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD + "']").addClass(JPMCOrbitalConstants.hidden);
        $(".js-method-id[data-method-id='" + JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD + "']").addClass(JPMCOrbitalConstants.hidden);
    }

    $('.payment-options [role=tab]').each(function (i, tab) {
        let otherTab = $(tab);
        let otherTabId = otherTab.attr('href');

        $(otherTabId).find('input, select').prop('disabled', otherTabId !== activeTabId);
    });
    if (activeTabId === '#credit-card-content') {
        $paymentInformation.data('is-new-payment', isNewPayment);
    } else {
        $paymentInformation.data('is-new-payment', true);
    }
};

base.selectBillingAddress = function () {
    $('.payment-form .addressSelector').on('change', function () {
        var form = $(this).parents('form')[0];
        var selectedOption = $('option:selected', this);
        var optionID = selectedOption[0].value;

        if (optionID === 'new') {
            $(form).attr('data-address-mode', 'new');
        } else {
            $(form).attr('data-address-mode', 'shipment');
        }

        var attrs = selectedOption.data();
        var element;

        Object.keys(attrs).forEach(function (attr) {
            element = attr === 'countryCode' ? 'country' : attr;
            if (element === 'cardNumber') {
                $('.cardNumber').data('cleave').setRawValue(attrs[attr]);
            } else if (element === 'jpmcOCreditCardNumber') {
                $('.jpmcOCreditCardNumber').data('cleave').setRawValue(attrs[attr]);
            } else {
                $('[name$=' + element + ']', form).val(attrs[attr]);
            }
        });
    });
};

base.handleCreditCardNumber = function () {
    if ($('.cardNumber').length > 0) {
        cleave.handleCreditCardNumber('.cardNumber', '#cardType');
    }
    if ($('.jpmcOCreditCardNumber').length > 0) {
        cleave.handleCreditCardNumber('.jpmcOCreditCardNumber', '#cardType');
    }
};

/**
 * @function changePaymentOption
 * @description Change payment option
 */
base.changePaymentOption = function () {
    $('.payment-options [role=tab]').on('click', base.methods.handlePaymentOptionChange); // By click
};

/**
 * @function initPaymentOption
 * @description Initiate payment option
 */
base.initPaymentOption = function () {
    // Initial
    $('.payment-options [role=tab].enabled').trigger('click');
    base.methods.handlePaymentOptionChange.call($('.payment-options [role=tab].active'));
};

base.changeCardNumber = function () {
    /**
     * @desc function to remove card id's from inputs.
     */
    function removeCardIds() {
        $.each($('.cardNumber'), function (index, el) {
            var $cardNumberField = $(el);
            var id = $cardNumberField.attr('id');
            $cardNumberField.attr('data-id', id);
            $cardNumberField.removeAttr('id');
        });
    }
    $('.js-payment-option-tab').on('click', function () {
        removeCardIds();
        var $this = $(this);
        var methodId = $this.closest('.js-method-id').data('method-id');
        $.each($('.js-method-id-input'), function (i, el) {
            var $el = $(el);
            if ($el.val() === methodId) {
                var $creditCardInput = $el.parent().find('.cardNumber');
                $creditCardInput.attr('id', $creditCardInput.data('id'));
            }
        });
    });
};

module.exports = base;
