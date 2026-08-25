'use strict';

var base = require('base/components/cleave');
var Cleave = require('cleave.js').default;

base.handleCreditCardNumber = function (cardFieldSelector, cardTypeSelector) {
    var cardFieldElement = typeof cardFieldSelector === 'string'
        ? document.querySelector(cardFieldSelector)
        : cardFieldSelector;
    if (!cardFieldElement) {
        return;
    }

    var cleave = new Cleave(cardFieldElement, {
        creditCard: true,
        onCreditCardTypeChanged: function (type) {
            var creditCardTypes = {
                visa: 'Visa',
                mastercard: 'Master Card',
                amex: 'Amex',
                discover: 'Discover',
                diners: 'DinersClub',
                jcb: 'JCB',
                unionPay: 'China UnionPay',
                unknown: 'Unknown'
            };

            var cardType = creditCardTypes[Object.keys(creditCardTypes).indexOf(type) > -1
                ? type
                : 'unknown'];
            if (cardTypeSelector) {
                $(cardTypeSelector).val(cardType);
            }
            $('.card-number-wrapper').attr('data-type', type);
            if (type === 'visa' || type === 'mastercard' || type === 'discover' || type === 'diners' || type === 'jcb' || type === 'unionPay') {
                $('#securityCode').attr('maxlength', 3);
            } else {
                $('#securityCode').attr('maxlength', 4);
            }
        }
    });

    $(cardFieldElement).data('cleave', cleave);
};

module.exports = base;
