'use strict';

(function () {
    var AMOUNT_REGEX = /^(\d+(\.\d{1,2})?|\.\d{1,2})$/;

    /**
     * Parse an amount string to a float.
     * @param {string} val - amount string
     * @returns {number} parsed amount
     */
    function parseAmount(val) {
        var n = parseFloat(val);
        return Number.isNaN(n) ? 0 : n;
    }

    /**
     * Extract max amount from placeholder text.
     * @param {HTMLInputElement} input - amount input element
     * @returns {number} max amount from placeholder
     */
    function getMaxFromPlaceholder(input) {
        var placeholder = input.getAttribute('placeholder') || '';
        return parseAmount(placeholder.replace(/[^0-9.]/g, ''));
    }

    /**
     * Formats amount with dynamic currency
     * @param {HTMLInputElement} input - amount input element
     * @param {number} amount - numeric amount
     * @returns {string} formatted amount label
     */
    function formatAmountWithCurrency(input, amount) {
        var currency = (input.getAttribute('data-currency') || '').trim();
        return currency ? (currency + ' ' + amount.toFixed(2)) : amount.toFixed(2);
    }

    /**
     * Display inline error message with visual indicator.
     * @param {HTMLInputElement} input - input element to highlight
     * @param {HTMLElement} errorEl - error message container
     * @param {string} msg - error message text
     */
    function showError(input, errorEl, msg) {
        input.style.borderColor = 'red';
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }

    /**
     * Clear inline error message and visual indicator.
     * @param {HTMLInputElement} input - input element to clear
     * @param {HTMLElement} errorEl - error message container
     */
    function clearError(input, errorEl) {
        input.style.borderColor = '';
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }

    /**
     * Validate amount form input: format, positive, within max.
     * @param {HTMLFormElement} form - form containing the amount input
     * @param {string} inputId - ID of the amount input field
     * @param {string} errorId - ID of the error display element
     * @param {string} checkboxId - ID of the full-amount checkbox
     * @param {string} exceedsLabel - error message when amount exceeds maximum
     * @returns {boolean} true if valid
     */
    function validateAmountForm(form, inputId, errorId, checkboxId, exceedsLabel) {
        var input = form.querySelector('#' + inputId);
        var errorEl = form.querySelector('#' + errorId);
        var checkbox = form.querySelector('#' + checkboxId);

        if (!input || !errorEl) return true;

        clearError(input, errorEl);

        if (checkbox && checkbox.checked) {
            input.value = '';
            return true;
        }

        var value = (input.value || '').trim();

        if (!value || !AMOUNT_REGEX.test(value)) {
            showError(input, errorEl, 'Enter a valid amount (e.g. 10.00).');
            return false;
        }

        var dollars = parseAmount(value);
        if (dollars <= 0) {
            showError(input, errorEl, 'Amount must be greater than zero.');
            return false;
        }

        var maxAmount = getMaxFromPlaceholder(input);
        if (maxAmount > 0 && dollars > maxAmount) {
            showError(input, errorEl, exceedsLabel + ' (' + formatAmountWithCurrency(input, maxAmount) + ').');
            return false;
        }

        return true;
    }

    /**
     * Wire full-amount checkbox to toggle amount input enabled state.
     * @param {string} checkboxId - ID of the full-amount checkbox
     * @param {string} inputId - ID of the amount input field
     * @param {string} errorId - ID of the error display element
     */
    function wireCheckbox(checkboxId, inputId, errorId) {
        var checkbox = document.getElementById(checkboxId);
        var input = document.getElementById(inputId);
        var errorEl = document.getElementById(errorId);

        if (!checkbox || !input) return;

        checkbox.addEventListener('change', function () {
            if (checkbox.checked) {
                input.value = '';
                input.disabled = true;
                if (errorEl) clearError(input, errorEl);
            } else {
                input.disabled = false;
            }
        });
    }

    /**
     * Disable submit button to prevent double-submit after validation.
     * @param {HTMLFormElement} form - form containing the submit button
     */
    function preventDoubleSubmit(form) {
        var btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent += '...';
        }
    }

    /**
     * Wire full-amount checkbox to auto-check final-capture checkbox.
     * @param {HTMLElement} fullCb - full-amount checkbox element
     * @param {HTMLElement} finalCb - final-capture checkbox element
     */
    function wireFullAmountToFinalCapture(fullCb, finalCb) {
        if (!fullCb || !finalCb) return;

        fullCb.addEventListener('change', function () {
            if (fullCb.checked) {
                finalCb.checked = true;
                finalCb.disabled = true;
            } else {
                finalCb.disabled = false;
            }
        });
    }

    var captureForm = document.getElementById('jpmc-capture-form');
    if (captureForm) {
        var finalCaptureCheckbox = document.getElementById('isFinalCapture');

        captureForm.addEventListener('submit', function (e) {
            var isValid = validateAmountForm(
                captureForm,
                'captureAmount',
                'captureError',
                'captureFullAmount',
                'Amount exceeds remaining authorized amount'
            );
            if (!isValid) {
                e.preventDefault();
                return;
            }

            var fullAmountCb = document.getElementById('captureFullAmount');
            if (fullAmountCb && fullAmountCb.checked && finalCaptureCheckbox) {
                finalCaptureCheckbox.checked = true;
            }

            preventDoubleSubmit(captureForm);
        });

        wireCheckbox('captureFullAmount', 'captureAmount', 'captureError');
        wireFullAmountToFinalCapture(
            document.getElementById('captureFullAmount'),
            finalCaptureCheckbox
        );
    }

    var refundForm = document.getElementById('jpmc-refund-form');
    if (refundForm) {
        refundForm.addEventListener('submit', function (e) {
            var isValid = validateAmountForm(
                refundForm,
                'refundAmount',
                'refundError',
                'refundFullAmount',
                'Amount exceeds remaining refundable amount'
            );
            if (!isValid) {
                e.preventDefault();
                return;
            }
            preventDoubleSubmit(refundForm);
        });

        wireCheckbox('refundFullAmount', 'refundAmount', 'refundError');
    }

    /**
     * Validate per-capture refund amount.
     * @param {string} value - amount string to validate
     * @param {HTMLElement} input - amount input element
     * @param {HTMLElement} errorEl - error message container
     * @param {string} maxStr - maximum refundable amount string
     * @returns {boolean} true if valid
     */
    function validateCaptureRefundAmount(value, input, errorEl, maxStr) {
        value = (value || '').trim();

        if (!value) {
            showError(input, errorEl, 'Enter a valid amount.');
            return false;
        }

        if (!AMOUNT_REGEX.test(value)) {
            showError(input, errorEl, 'Enter a valid amount (e.g. 10.00).');
            return false;
        }

        var dollars = parseAmount(value);
        if (dollars <= 0) {
            showError(input, errorEl, 'Amount must be greater than zero.');
            return false;
        }

        var maxAmount = parseAmount(maxStr);
        if (maxAmount > 0 && dollars > maxAmount) {
            showError(input, errorEl, 'Exceeds refundable (' + formatAmountWithCurrency(input, maxAmount) + ').');
            return false;
        }

        return true;
    }

    var captureRefundForms = document.querySelectorAll('.csc-capture-refund-form');
    for (var idx = 0; idx < captureRefundForms.length; idx++) {
        (function (form) {
            var input = form.querySelector('input[name="amountIntroduced"]');
            var errorEl = form.querySelector('.csc-capture-refund-form__error');
            var fullCb = form.querySelector('.csc-capture-refund-form__full-refund');

            if (fullCb && input) {
                fullCb.addEventListener('change', function () {
                    if (fullCb.checked) {
                        input.value = '';
                        input.disabled = true;
                        if (errorEl) clearError(input, errorEl);
                    } else {
                        input.disabled = false;
                    }
                });
            }

            form.addEventListener('submit', function (e) {
                if (!input || !errorEl) return;

                clearError(input, errorEl);

                if (fullCb && fullCb.checked) {
                    input.value = '';
                    preventDoubleSubmit(form);
                    return;
                }

                var maxStr = input.getAttribute('placeholder') || '';
                if (!validateCaptureRefundAmount(input.value, input, errorEl, maxStr)) {
                    e.preventDefault();
                    return;
                }

                preventDoubleSubmit(form);
            });
        }(captureRefundForms[idx]));
    }

    var voidForm = document.getElementById('jpmc-void-form');
    if (voidForm) {
        voidForm.addEventListener('submit', function (e) {
            var confirmed = window.confirm(
                'Are you sure you want to void the remaining authorization? This action cannot be undone.'
            );
            if (!confirmed) {
                e.preventDefault();
                return;
            }
            preventDoubleSubmit(voidForm);
        });
    }
}());
