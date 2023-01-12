'use strict';

var base = require('BaseCartridge/paymentInstruments/paymentInstruments');
var cleave = require('../components/cleave');

base.submitPayment = function () {
    $('form.payment-form').submit(function (e) {
        var $form = $(this);
        var url;
        e.preventDefault();
        url = $form.attr('action');
        $form.spinner().start();
        $('form.payment-form').trigger('payment:submit', e);

        var formData = cleave.serializeData($form);

        $.ajax({
            url: url,
            type: 'post',
            dataType: 'json',
            data: formData,
            success: function (data) {
                $form.spinner().stop();
                if (!data.success) {
                    $('.error-message').text(data.errorMessage);
                } else {
                    location.href = data.redirectUrl;
                }
            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                }
                $form.spinner().stop();
            }
        });
        return false;
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

module.exports = base;
