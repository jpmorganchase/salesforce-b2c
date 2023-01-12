'use strict';

var base = require('BaseCartridge/components/cleave');

base.handleCreditCardNumber = function (cardFieldSelector, cardTypeSelector) {
    var cleave = {
        cardFieldSelector: cardFieldSelector,
        getRawValue: function () {
            return document.querySelector(this.cardFieldSelector).value;
        },
        setRawValue: function (newValue) {
            document.querySelector(this.cardFieldSelector).value = newValue;
        }
    };

    $(cardFieldSelector).data('cleave', cleave);
    $(cardTypeSelector).val('Unknown');
};

module.exports = base;
