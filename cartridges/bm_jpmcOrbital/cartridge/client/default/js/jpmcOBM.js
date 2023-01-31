'use strict';

(function ($) {
    $(document).ready(function () {
        var JPMCOrbitalConstants = $('.form-row').data('jpmc-o-constants-helper');
        $('.form-row').on('click', '.input-value-add', function (e) {
            if (e.offsetX > e.target.offsetWidth) {
                var inputElement = $(e.target).children('input');
                var inputValue = inputElement.val().trim();
                var inputName = inputElement.attr('id');
                var elementWrapper = $(e.target).siblings('.multi-input-wrapper');
                const regex = new RegExp('^[a-z]{2}(?:_[A-Z]{2})?$');
                var alreadyExist = false;
                var values = [];
                for (var i = 0; i < elementWrapper.find('input').length; i++) {
                    var input = elementWrapper.find('input')[i].value;
                    values.push(input);
                }
                if (values.indexOf(inputValue) > -1) {
                    alreadyExist = true;
                }
                var newElement;
                if (inputName === 'avsUnacceptedValues') {
                    newElement = $('<div class="input-value-remove"><input name="' + inputName + '[]" value="' + inputValue + '" /><div>');
                } else {
                    newElement = $('<div class="input-value-remove"><input required name="' + inputName + '[]" value="' + inputValue + '" /><div>');
                }

                var skip = false;
                var correctLocale = false;
                if ($('.allMLocales').length > 0) {
                    $('.locale-error-message').addClass('hidden');
                    if ($('.allMLocales')[0].value.indexOf(inputValue) > -1 && inputName === 'locales') {
                        var allLocales = JSON.parse($('.allMLocales')[0].value);
                        Object.keys(allLocales).forEach(function (localeId) {
                            var merchant = allLocales[localeId];
                            if (merchant === $('.selectedMerchant')[0].value && inputValue === localeId) {
                                inputElement.removeClass('red');
                                $('.locale-error-message').addClass('hidden');
                                skip = false;
                                correctLocale = true;
                            }
                            if (!correctLocale) {
                                inputElement.addClass('red');
                                skip = true;
                                $('.locale-error-message').removeClass('hidden');
                            }
                        });
                    } else {
                        inputElement.removeClass('red');
                        $('.locale-error-message').addClass('hidden');
                    }
                }
                if (!skip) {
                    if (inputValue.length && regex.test(inputValue) && inputName === 'locales' && !alreadyExist) {
                        inputElement.removeClass('red');
                        elementWrapper.append(newElement);
                        inputElement.val('');
                    } else if (inputValue.length && !elementWrapper.find('input').filter('[value="' + inputValue + '"]').length && inputName !== 'locales' && !alreadyExist) {
                        inputElement.removeClass('red');
                        elementWrapper.append(newElement);
                        inputElement.val('');
                    } else {
                        inputElement.addClass('red');
                    }
                }
            }
        });

        $('.form-row').on('click', '.input-value-remove', function (e) {
            if (e.offsetX > e.target.offsetWidth) {
                $(e.target).remove();
            }
        });

        $('.form-row').on('click', '#dwfrm_config_pageEncryptionEnabled', function (e) {
            if (e.target.value === 'true') {
                $('#dwfrm_config_pageEncryptionConfigurationSubID')[0].setAttribute('required', e.target.value);
            } else {
                $('#dwfrm_config_pageEncryptionConfigurationSubID')[0].removeAttribute('required');
            }
        });

        $('.form-row').on('click', '#dwfrm_config_googlePayEnabled', function (e) {
            if (e.target.value === 'true') {
                $('#googlePayConfAllowedCardNetworks')[0].setAttribute('required', e.target.value);
                $('#dwfrm_config_googlePayConfMerchantId')[0].setAttribute('required', e.target.value);
                $('#dwfrm_config_googlePayConfMerchantName')[0].setAttribute('required', e.target.value);
            } else {
                $('#googlePayConfAllowedCardNetworks')[0].removeAttribute('required');
                $('#dwfrm_config_googlePayConfMerchantId')[0].removeAttribute('required');
                $('#dwfrm_config_googlePayConfMerchantName')[0].removeAttribute('required');
            }
        });

        $('.form-row').on('click', '#dwfrm_config_visaPayEnabled', function (e) {
            if (e.target.value === 'true') {
                $('#dwfrm_config_visaPayApiKey')[0].setAttribute('required', e.target.value);
            } else {
                $('#dwfrm_config_visaPayApiKey')[0].removeAttribute('required');
            }
        });

        $('#config-save-button').on('click', function () {
            if ($('.multi-input-wrapper').find('input').length === 0) {
                $('#merchantIDs')[0].setAttribute('required', '');
            } else {
                $('#merchantIDs')[0].removeAttribute('required');
            }
        });
        $('#dwfrm_config_platformMode').change(function (e) {
            var pageEncryptionEnabled = $('#dwfrm_config_pageEncryptionEnabled');
            var incrementalAuthorizationEnabled = $('#dwfrm_config_incrementalAuthorizationEnabled');
            var falseOption = $("#dwfrm_config_pageEncryptionEnabled option[id='false']");
            var incrementalFalseOption = $("#dwfrm_config_incrementalAuthorizationEnabled option[id='false']");
            if (e.target.value === JPMCOrbitalConstants.tandem) {
                falseOption.prop('selected', 'selected').change();
                incrementalFalseOption.prop('selected', 'selected').change();
                pageEncryptionEnabled[0].setAttribute('disabled', true);
                incrementalAuthorizationEnabled[0].setAttribute('disabled', true);
            } else if ($('#dwfrm_config_customerSavedPaymentType').val() !== JPMCOrbitalConstants.orbitalProfile) {
                pageEncryptionEnabled[0].removeAttribute('disabled');
                incrementalAuthorizationEnabled[0].removeAttribute('disabled');
            } else {
                incrementalAuthorizationEnabled[0].removeAttribute('disabled');
            }
        });
        $('#dwfrm_config_customerSavedPaymentType').change(function (e) {
            var pageEncryptionEnabled = $('#dwfrm_config_pageEncryptionEnabled');
            var falseOption = $("#dwfrm_config_pageEncryptionEnabled option[id='false']");
            if (e.target.value === JPMCOrbitalConstants.orbitalProfile) {
                falseOption.prop('selected', 'selected').change();
                pageEncryptionEnabled[0].setAttribute('disabled', true);
            } else if ($('#dwfrm_config_platformMode').val() !== JPMCOrbitalConstants.tandem) {
                pageEncryptionEnabled[0].removeAttribute('disabled');
            }
        });
        if ($('#dwfrm_config_platformMode').val() === JPMCOrbitalConstants.tandem) {
            $("#dwfrm_config_incrementalAuthorizationEnabled option[id='false']").prop('selected', 'selected').change();
            $('#dwfrm_config_incrementalAuthorizationEnabled')[0].setAttribute('disabled', true);
        } else {
            $('#dwfrm_config_incrementalAuthorizationEnabled')[0].removeAttribute('disabled');
        }
        if ($('#dwfrm_config_customerSavedPaymentType').val() === JPMCOrbitalConstants.orbitalProfile || $('#dwfrm_config_platformMode').val() === JPMCOrbitalConstants.tandem) {
            var pageEncryptionEnabled = $('#dwfrm_config_pageEncryptionEnabled');
            var falseOption = $("#dwfrm_config_pageEncryptionEnabled option[id='false']");
            falseOption.prop('selected', 'selected').change();
            pageEncryptionEnabled[0].setAttribute('disabled', true);
        } else {
            $('#dwfrm_config_pageEncryptionEnabled')[0].removeAttribute('disabled');
        }
        $('#config-merchant-save-button').on('click', function () {
            if ($('.locales-form-row .multi-input-wrapper').find('input').length === 0) {
                $('#locales')[0].setAttribute('required', '');
            } else {
                $('#locales')[0].removeAttribute('required');
            }
            if ($('#dwfrm_config_googlePayEnabled')[0].value === 'true' && $('.cards-form-row .multi-input-wrapper').find('input').length === 0) {
                $('#googlePayConfAllowedCardNetworks')[0].setAttribute('required', '');
            } else {
                $('#googlePayConfAllowedCardNetworks')[0].removeAttribute('required');
            }
        });
    });
}(window.jQuery));
