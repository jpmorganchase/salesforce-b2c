/* eslint-disable no-useless-escape */
'use strict';

(function ($) {
    $(document).ready(function () {
        $('#jpmc-orbital-capture-button').on('click', function () {
            var value = $('#jpmc-orbital-capture-input')[0].value;
            var remainedAmountValue = $('.order-remained-amount').attr('data-amount');
            var remainedAmount = $('.order-amount').attr('data-amount');
            if (remainedAmountValue) {
                remainedAmount = $('.order-remained-amount').attr('data-amount');
            }
            var amount = 0;
            if ($('#jpmc-orbital-capture-input')[0].value) {
                amount = $('#jpmc-orbital-capture-input')[0].value;
            }
            var regex = new RegExp('^[\.0-9]*$');
            if (regex.test(value)) {
                if (Number(remainedAmount) >= Number(amount)) {
                    if (Number(amount) > Number($('.order-amount').attr('data-amount'))) {
                        $('span').removeClass('hide-message-capture');
                        document.getElementById('jpmc-orbital-capture-input').style.borderColor = 'red';
                    } else {
                        var skip = false;
                        document.getElementById('jpmc-orbital-capture-input').style.borderColor = '';
                        document.getElementById('error-message-capture').classList.add('hide-message-capture');
                        var url = $('#jpmc-orbital-capture').attr('action');
                        if (!$('#jpmc-orbital-capture-input')[0].classList.contains('jpmc-input-hidden')) {
                            if ($('#jpmc-orbital-capture-input')[0].value) {
                                url = url + '&amountIntroduced=' + amount;
                            } else if (document.getElementById('captureFullAmount').checked) {
                                url += '&amountIntroduced=null';
                            } else {
                                $('span').removeClass('hide-message-capture');
                                document.getElementById('jpmc-orbital-capture-input').style.borderColor = 'red';
                                skip = true;
                            }
                            if (!skip) {
                                $('#jpmc-orbital-capture').attr('action', url);
                                $('#jpmc-orbital-capture').submit();
                            }
                        } else {
                            url += '&amountIntroduced=null';
                            $('#jpmc-orbital-capture').attr('action', url);
                            $('#jpmc-orbital-capture').submit();
                        }
                    }
                } else {
                    $('span').removeClass('hide-message-capture');
                    document.getElementById('jpmc-orbital-capture-input').style.borderColor = 'red';
                }
            } else {
                $('span').removeClass('hide-message-capture');
                document.getElementById('jpmc-orbital-capture-input').style.borderColor = 'red';
            }
        });
        $('#jpmc-orbital-reversal-button').on('click', function () {
            $('#jpmc-orbital-reversal').submit();
        });
        $('#jpmc-orbital-refund-button').on('click', function () {
            var capturedAmountValue = $('.order-full-captured-amount').attr('data-amount');
            var capturedAmount;
            if (!capturedAmountValue || Number(capturedAmountValue) === 0 || capturedAmountValue === null) {
                capturedAmount = $('.order-amount').attr('data-amount');
            } else {
                capturedAmount = $('.order-full-captured-amount').attr('data-amount');
            }
            var refundedAmountValue = $('.order-refunded-amount').attr('data-amount');
            var refundedAmount;
            if (isNaN(refundedAmountValue)) {
                refundedAmount = 0;
            } else {
                refundedAmount = refundedAmountValue;
            }
            var amount = 0;
            var value = 0;
            if ($('#jpmc-orbital-refund-input').length > 0) {
                amount = $('#jpmc-orbital-refund-input')[0].value;
                value = $('#jpmc-orbital-refund-input')[0].value;
            }
            var regex = new RegExp('^[\.0-9]*$');
            if (regex.test(value)) {
                if (Number(amount) > Number(capturedAmount) - Number(refundedAmount)) {
                    $('span').removeClass('hide-message-refund');
                    document.getElementById('jpmc-orbital-refund-input').style.borderColor = 'red';
                } else {
                    var skip = false;
                    document.getElementById('jpmc-orbital-refund-input').style.borderColor = '';
                    document.getElementById('error-message-refund').classList.add('hide-message-refund');
                    var url = $('#jpmc-orbital-refund').attr('action');

                    if (!$('#jpmc-orbital-refund-input')[0].classList.contains('jpmc-input-hidden-refund')) {
                        if ($('#jpmc-orbital-refund-input')[0].value) {
                            url = url + '&amountIntroduced=' + amount;
                        } else if (document.getElementById('refundFullAmount').checked) {
                            url += '&amountIntroduced=null';
                        } else {
                            $('span').removeClass('hide-message-refund');
                            document.getElementById('jpmc-orbital-refund-input').style.borderColor = 'red';
                            skip = true;
                        }
                        if (!skip) {
                            $('#jpmc-orbital-refund').attr('action', url);
                            $('#jpmc-orbital-refund').submit();
                        }
                    } else {
                        url += '&amountIntroduced=null';
                        $('#jpmc-orbital-refund').attr('action', url);
                        $('#jpmc-orbital-refund').submit();
                    }
                }
            } else {
                $('span').removeClass('hide-message-refund');
                document.getElementById('jpmc-orbital-refund-input').style.borderColor = 'red';
            }
        });
        $('#jpmc-orbital-incremental-authorization-button').on('click', function () {
            var value = $('#jpmc-orbital-incremental-authorization-input')[0].value;
            var regex = new RegExp('^[\.0-9]*$');
            if (regex.test(value)) {
                if (Number($('#jpmc-orbital-incremental-authorization-input')[0].value) === 0 || value === '') {
                    $('span').removeClass('hide-message-incremental-authorization');
                    document.getElementById('jpmc-orbital-incremental-authorization-input').style.borderColor = 'red';
                } else {
                    document.getElementById('jpmc-orbital-incremental-authorization-input').style.borderColor = '';
                    document.getElementById('error-message-incremental-authorization').classList.add('hide-message-incremental-authorization');
                    var url = $('#jpmc-orbital-incremental-authorization').attr('action');
                    if ($('#jpmc-orbital-incremental-authorization-input')[0].value) {
                        url = url + '&amountIntroduced=' + $('#jpmc-orbital-incremental-authorization-input')[0].value;
                    } else {
                        url += '&amountIntroduced=null';
                    }
                    $('#jpmc-orbital-incremental-authorization').attr('action', url);
                    $('#jpmc-orbital-incremental-authorization').submit();
                }
            } else {
                $('span').removeClass('hide-message-incremental-authorization');
                document.getElementById('jpmc-orbital-incremental-authorization-input').style.borderColor = 'red';
            }
        });
    });
}(window.jQuery));
