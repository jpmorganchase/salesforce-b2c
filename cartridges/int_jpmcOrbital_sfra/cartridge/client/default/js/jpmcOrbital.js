'use strict';
(function ($) {
    var processInclude = require('BaseCartridge/util');

    /**
     * Validate whole form. Requires `this` to be set to form object
     * @param {jQuery.event} event - Event to be canceled if form is invalid.
     * @returns {boolean} - Flag to indicate if form is valid
     */
    function validateForm(event) {
        var valid = true;
        if (this.checkValidity && !this.checkValidity()) {
            // safari
            valid = false;
            if (event) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
            $(this).find('input, select').each(function () {
                if (!this.validity.valid) {
                    $(this).trigger('invalid', this.validity);
                }
            });
        }
        return valid;
    }

    /**
     * Creates 'Invalid' event for input and select
     */
    function invalid() {
        $('form input, form select').on('invalid', function (e) {
            e.preventDefault();
            this.setCustomValidity('');
            if (!this.validity.valid) {
                var validationMessage = this.validationMessage;
                $(this).addClass('is-invalid');
                if (this.validity.patternMismatch && $(this).data('pattern-mismatch')) {
                    validationMessage = $(this).data('pattern-mismatch');
                }
                if (this.validity.valueMissing && $(this).data('missing-error')) {
                    validationMessage = $(this).data('missing-error');
                }
                $(this).parents('.form-group').find('.invalid-feedback').text(validationMessage);
            }
        });
    }

    /**
     * Remove all validation. Should be called every time before revalidating form
     * @param {element} form - Form to be cleared
     * @returns {void}
     */
    function clearForm(form) {
        $(form).find('.form-control.is-invalid').removeClass('is-invalid');
    }

    /**
     * initializes modal events
     * @returns {void}
     */
    function initModalEvents() {
        $('#updateprofilebutton').on('click touch', function (e) {
            clearForm($('#updateprofileform'));
            invalid();
            validateForm.call($('#updateprofileform'), e);
        });
        $('#updateprofileform').submit(function (e) {
            e.preventDefault();
            var form = $('#updateprofileform');
            form.spinner().start();
            var formData = {
                cardNumber: $('#cardNumber').val(),
                month: $('#expirationMonth').val(),
                year: $('#expirationYear').val(),
                type: $('.card-number-wrapper').data('type'),
                transitNr: $('.jpmcOCreditEcpCheckRT').val(),
                accNrDDA: $('.jpmcOCreditEcpCheckDDA').val(),
                googlePayToken: $('#googlePayToken').val(),
                applePayToken: $('#applePayToken').val(),
                depAccType: $('.ecpBankAcctType').val(),
                visaPay: $('#visaPay').val()
            };
            var csrfToken = $('#csrfToken');
            if (csrfToken) {
                formData[csrfToken.attr('name')] = csrfToken.val();
            }
            $.ajax({
                method: 'POST',
                url: form.attr('action'),
                dataType: 'json',
                data: formData,
                success: function (response) {
                    if (response.success) {
                        setTimeout(function () {
                            $('#updateProfileViewModal').modal('hide');
                            location.reload();
                        }, 1000);
                    } else {
                        if (response.errorMessage) {
                            $('.modal-update-error-message').html(response.errorMessage);
                        }
                        $('.modal-update-error-message').removeAttr('hidden');
                        $('.modal-update-error-message').css('color', 'red');
                    }
                    form.spinner().stop();
                }
            });
        });
    }

    /**
     * creditCardType
     * @param {string} cc cc
     * @returns {string} type
     */
    function creditCardType(cc) {
        var JPMCOrbitalConstants = $('.card-number-wrapper').data('jpmc-o-constants-helper') || $('.creditCardType').data('jpmc-o-constants-helper');
        let amex = new RegExp('^3[47][0-9]{13}$');
        let visa = new RegExp('^4[0-9]{12}(?:[0-9]{3})?$');

        let mastercard = new RegExp('^5[1-5][0-9]{14}$');
        let mastercard2 = new RegExp('^2[2-7][0-9]{14}$');

        let disco1 = new RegExp('^6011[0-9]{12}[0-9]*$');
        let disco2 = new RegExp('^62[24568][0-9]{13}[0-9]*$');
        let disco3 = new RegExp('^6[45][0-9]{14}[0-9]*$');

        let diners = new RegExp('^3[0689][0-9]{12}[0-9]*$');
        let jcb = new RegExp('^35[0-9]{14}[0-9]*$');
        let maestro = new RegExp('^(?:5[0678][0-9]{0,2}|6304|67[0-9]{0,2})[0-9]{0,15}');

        if (visa.test(cc)) {
            return JPMCOrbitalConstants.Visa;
        }
        if (amex.test(cc)) {
            return JPMCOrbitalConstants.Amex;
        }
        if (mastercard.test(cc) || mastercard2.test(cc)) {
            return JPMCOrbitalConstants.Master_Card;
        }
        if (disco1.test(cc) || disco2.test(cc) || disco3.test(cc)) {
            return JPMCOrbitalConstants.Discover;
        }
        if (diners.test(cc)) {
            return JPMCOrbitalConstants.Diners;
        }
        if (jcb.test(cc)) {
            return JPMCOrbitalConstants.Jcb;
        }
        if (maestro.test(cc)) {
            return JPMCOrbitalConstants.International_Maestro;
        }
        return undefined;
    }

    /**
     * loadModal
     * @param {*} url url
     */
    function loadModal(url) {
        var $modal = $('#updateProfileViewModal');
        $.ajax({
            method: 'GET',
            url: url,
            dataType: 'html',
            success: function (resp) {
                if (resp) {
                    if ($('#updateProfileViewModal').hasClass('show')) {
                        $('#updateProfileViewModal').modal('hide');
                    }
                    $modal.empty().html(resp).modal('show');
                    $.spinner().stop();
                    $('#cardNumber').on('input', function () {
                        var cardNr = $('#cardNumber').val().replace(/\D/g, '');
                        $('#cardNumber').attr('value', cardNr);
                        $('#cardNumber').val(cardNr);
                        var type = creditCardType(cardNr);
                        $('.card-number-wrapper').attr('data-type', type);
                    });
                    $('.info-icon').on('mouseenter focusin', function () {
                        $(this).find('.tooltip').removeClass('d-none');
                    });
                    $('.info-icon').on('mouseleave focusout', function () {
                        $(this).find('.tooltip').addClass('d-none');
                    });
                    initModalEvents();
                }
            },
            error: function () {
                $.spinner().stop();
            }
        });
    }
        /**
     * create wrapper modal
     *
     * @retutns {void}
     */
    function createModalWrapper() {
        $('body').append(
            $('<div/>')
                .attr('id', 'updateProfileViewModal')
                .attr('role', 'dialog')
                .addClass('modal fade')
        );
    }
    $(document).ready(function () {
        createModalWrapper();
        $('.updateprofile').on('click', function (e) {
            if (!e.detail || e.detail === 1) {
                e.preventDefault();
                var url = $(this).attr('href');
                loadModal(url);
            }
        });
        $('#customerPaymentCheckboxEC').on('change', function () {
            $('#saveCustomerPaymentCheckboxEC').val(this.checked);
        });
        $('#customerPaymentCheckbox').on('change', function () {
            $('#saveCustomerPaymentCheckbox').val(this.checked);
        });
        $('#customerPaymentCheckboxGP').on('change', function () {
            $('#saveCustomerPaymentCheckboxGP').val(this.checked);
        });
        $('#customerPaymentCheckboxVP').on('change', function () {
            $('#saveCustomerPaymentCheckboxVP').val(this.checked);
        });
        $('#customerPaymentCheckboxAP').on('change', function () {
            $('#saveCustomerPaymentCheckboxAP').val(this.checked);
        });
        $('#paymentOption-ecp').on('change', function () {
            if ($('#paymentOption-ecp')[0].checked) {
                $('#paymentOption-cc').prop('checked', false);
                $('#paymentOption-gp').prop('checked', false);
                $('#paymentOption-vp').prop('checked', false);
                $('#paymentOption-ap').prop('checked', false);
                $('.jpmc-card-content').attr('hidden', true);
                $('.jpmc-google-pay-content').attr('hidden', true);
                $('.jpmc-visa-pay-content').attr('hidden', true);
                $('.jpmc-apple-pay-content').attr('hidden', true);
                $('.jpmc-ecp-content').removeAttr('hidden');
            }
        });
        $('#paymentOption-cc').on('change', function () {
            if ($('#paymentOption-cc')[0].checked) {
                $('#paymentOption-ecp').prop('checked', false);
                $('#paymentOption-gp').prop('checked', false);
                $('#paymentOption-vp').prop('checked', false);
                $('#paymentOption-ap').prop('checked', false);
                $('.jpmc-ecp-content').attr('hidden', true);
                $('.jpmc-google-pay-content').attr('hidden', true);
                $('.jpmc-visa-pay-content').attr('hidden', true);
                $('.jpmc-apple-pay-content').attr('hidden', true);
                $('.jpmc-card-content').removeAttr('hidden');
            }
        });
        $('#paymentOption-gp').on('change', function () {
            if ($('#paymentOption-gp')[0].checked) {
                $('#paymentOption-cc').prop('checked', false);
                $('#paymentOption-ecp').prop('checked', false);
                $('#paymentOption-vp').prop('checked', false);
                $('#paymentOption-ap').prop('checked', false);
                $('.jpmc-ecp-content').attr('hidden', true);
                $('.jpmc-card-content').attr('hidden', true);
                $('.jpmc-visa-pay-content').attr('hidden', true);
                $('.jpmc-apple-pay-content').attr('hidden', true);
                $('.jpmc-google-pay-content').removeAttr('hidden');
            }
        });
        $('#paymentOption-ap').on('change', function () {
            if ($('#paymentOption-ap')[0].checked) {
                $('#paymentOption-cc').prop('checked', false);
                $('#paymentOption-gp').prop('checked', false);
                $('#paymentOption-ecp').prop('checked', false);
                $('#paymentOption-vp').prop('checked', false);
                $('.jpmc-ecp-content').attr('hidden', true);
                $('.jpmc-card-content').attr('hidden', true);
                $('.jpmc-visa-pay-content').attr('hidden', true);
                $('.jpmc-google-pay-content').attr('hidden', true);
                $('.jpmc-apple-pay-content').removeAttr('hidden');
            }
        });
        $('#paymentOption-vp').on('change', function () {
            if ($('#paymentOption-vp')[0].checked) {
                $('#paymentOption-cc').prop('checked', false);
                $('#paymentOption-ecp').prop('checked', false);
                $('#paymentOption-gp').prop('checked', false);
                $('#paymentOption-ap').prop('checked', false);
                $('.jpmc-ecp-content').attr('hidden', true);
                $('.jpmc-card-content').attr('hidden', true);
                $('.jpmc-google-pay-content').attr('hidden', true);
                $('.jpmc-apple-pay-content').attr('hidden', true);
                $('.jpmc-visa-pay-content').removeAttr('hidden');
            }
        });
        $('.jpmc-ecp-content #submit-payment-form').on('click', function () {
            document.getElementById('jpmco-electronic_check-content').scrollIntoView();
        });
        $('.jpmcO-google-pay').on('click', function () {
            $('#paymentOption-gp').click();
        });
        $('.jpmcO-visa-pay').on('click', function () {
            $('#paymentOption-vp').click();
        });
        if (window.ApplePaySession && window.ApplePaySession.canMakePayments) {
            $('.js-applepay-payment-row').css('display', 'block');
        }
        processInclude(require('./checkout/pageEncryption'));
    });
}(jQuery));
