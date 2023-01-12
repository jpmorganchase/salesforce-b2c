if (window.dw && window.dw.applepay) {
    $(window).on('popstate', function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    });

    var popstateEvents = $._data(window).events['popstate'];
    popstateEvents.unshift(popstateEvents.pop());

    var actions = window.dw.applepay.action;
    var request;
    var getRequest = async () => {
        const response = await fetch(actions.getRequest);
        const json = await response.json();
        return json
    }

    getRequest().then((res) => {
        request = res.request
    });

    $('#applePayButton').off()
    $('#applePayButton').on('click', function() {
        onApplePayButtonClicked(request)
    })

    if (window.ApplePaySession && window.ApplePaySession.canMakePayments) {
        $('.js-applepay-payment-row').css('display', 'block');
        window.ApplePaySession.canMakePayments = function () {
            return false;
        }
    }

    function onApplePayButtonClicked(req) {
        window.applePayClick = true;

        if (!window.ApplePaySession) {
            return;
        }

        if ($('.apple-pay-tab').length) {
            $('.apple-pay-tab').click();
        }
        if ($('#paymentOption-ap').length) {
            $('#paymentOption-ap').click();
        }
        
        const request = req;

        // Create ApplePaySession
        const session = new ApplePaySession(3, request);
        
        async function validateMerchant(validationUrl) {
            let data = {
                    isTrusted: true,
                    validationURL: validationUrl,
                    hostname: window.location.host
                };
            const response = await fetch(actions.onvalidatemerchant, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            const validationJSON = await response.json();
            return validationJSON.session;
        }

        session.onvalidatemerchant = async event => {
            // Call your own server to request a new merchant session.
            const merchantSession = await validateMerchant(event.validationURL);
            session.completeMerchantValidation(merchantSession);
        };


        async function updatePayment() {
            const data = {
                isTrusted: true,
                paymentMethod: {
                    type: 'credit'
                }
            }
            const response = await fetch(actions.onpaymentmethodselected, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            const json = await response.json();
            return json;
        }
        session.onpaymentmethodselected = async event => {
            // Define ApplePayPaymentMethodUpdate based on the selected payment method.
            // No updates or errors are needed, pass an empty object.
            const total = {};

            const response = await updatePayment();
            total.newTotal = response.total;
            total.newLineItems = response.lineItems ? response.lineItems : []

            session.completePaymentMethodSelection(total);
        };
        
        session.onshippingmethodselected = event => {
            // Define ApplePayShippingMethodUpdate based on the selected shipping method.
            // No updates or errors are needed, pass an empty object. 
            const update = {};
            session.completeShippingMethodSelection(update);
        };
        
        session.onshippingcontactselected = event => {
            // Define ApplePayShippingContactUpdate based on the selected shipping contact.
            const update = {};
            session.completeShippingContactSelection(update);
        };
        
        session.onpaymentauthorized = event => {
            // Define ApplePayPaymentAuthorizationResult
            const result = {
                "status": ApplePaySession.STATUS_SUCCESS
            };
            $('#applePayToken').val(JSON.stringify(event.payment.token.paymentData));
            session.completePayment(result);
        };
        
        session.oncouponcodechanged = event => {
            // Define ApplePayCouponCodeUpdate
            const newTotal = calculateNewTotal(event.couponCode);
            const newLineItems = calculateNewLineItems(event.couponCode);
            const newShippingMethods = calculateNewShippingMethods(event.couponCode);
            const errors = calculateErrors(event.couponCode);
            
            session.completeCouponCodeChange({
                newTotal: newTotal,
                newLineItems: newLineItems,
                newShippingMethods: newShippingMethods,
                errors: errors,
            });
        };
        
        session.oncancel = event => {
            // Payment cancelled by WebKit
        };
        
        session.begin();
    }
}