'use strict';

var server = require('server');

server.extend(module.superModule);
var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 * Checkout-Begin : The Checkout-Begin endpoint will render the checkout shipping page for both guest shopper and returning shopper
 * @name Base/Checkout-Begin
 * @function
 * @memberof Checkout
 * @param {middleware} - csrfProtection.generateToken
 * @param {category} - sensitive
 * @param {serverfunction} - get
 */

server.append('Begin', function (req, res, next) {
    var URLUtils = require('dw/web/URLUtils');
    var AccountModel = require('*/cartridge/models/account');
    var accountModel = new AccountModel(req.currentCustomer);
    var viewData = res.getViewData();
    var isOrbitalAPIEnabled = preferenceHelper.isOrbitalAPIEnabled();
    var isIncrementalAuthorizationEnabled = preferenceHelper.isIncrementalAuthorizationEnabled();
    viewData.isIncrementalAuthorizationEnabled = isIncrementalAuthorizationEnabled;
    var isGooglePayEnabled = preferenceHelper.isGooglePayEnabled();
    viewData.isGooglePayEnabled = isGooglePayEnabled;
    var isVisaPayEnabled = preferenceHelper.isVisaPayEnabled();
    viewData.isVisaPayEnabled = isVisaPayEnabled;
    var isApplePayEnabled = preferenceHelper.isApplePayEnabled();
    viewData.isApplePayEnabled = isApplePayEnabled;
    viewData.isOrbitalAPIEnabled = isOrbitalAPIEnabled;
    if (!isOrbitalAPIEnabled && accountModel.registeredUser) {
        var wallet = customer.getProfile().getWallet();
        var savedPaymentInstruments = wallet.paymentInstruments;
        var savedPaymentInstrumentsKeys = Object.keys(savedPaymentInstruments);
        var paymentInstruments = [];
        savedPaymentInstrumentsKeys.forEach(function (index) {
            var savedPaymentInstrument = savedPaymentInstruments[index];
            if (!preferenceHelper.isOrbitalAPIEnabled()) {
                if (savedPaymentInstrument.paymentMethod.slice(0, 4) !== JPMCOrbitalConstants.JPMC) {
                    var paymentInstrument = {
                        creditCardHolder: savedPaymentInstrument.creditCardHolder,
                        creditCardType: savedPaymentInstrument.creditCardType,
                        maskedCreditCardNumber: savedPaymentInstrument.maskedCreditCardNumber,
                        UUID: savedPaymentInstrument.UUID,
                        creditCardExpirationMonth: savedPaymentInstrument.creditCardExpirationMonth ? savedPaymentInstrument.creditCardExpirationMonth : '',
                        creditCardExpirationYear: savedPaymentInstrument.creditCardExpirationYear ? savedPaymentInstrument.creditCardExpirationYear : ''
                    };
                    if (savedPaymentInstrument.creditCardType) {
                        paymentInstrument.cardTypeImage = {
                            src: URLUtils.staticURL('/images/' + savedPaymentInstrument.creditCardType.toLowerCase().replace(/\s/g, '') + '-dark.svg'),
                            alt: savedPaymentInstrument.creditCardType
                        };
                    }
                    paymentInstruments.push(paymentInstrument);
                }
            }
        });
        viewData.customer.customerPaymentInstruments = paymentInstruments;
        res.setViewData(viewData);
        return next();
    }
    orbitalAPIHelper.prepareBillingFormJPMC();
    var activeProfilePayments;
    if (req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered) {
        var customerNo = req.currentCustomer.profile.customerNo;
        activeProfilePayments = orbitalAPIHelper.activeProfilePayments(customerNo);
        viewData.activeProfilePayments = activeProfilePayments;
    }

    var jpmcOCreditForm = server.forms.getForm('billing').jpmcOCreditForm;
    var jpmcOGooglePayForm = server.forms.getForm('billing').jpmcOGooglePayForm;
    var googlePayConfigurations = preferenceHelper.getGooglePayConfigurations();
    var jpmcOVisaPayForm = server.forms.getForm('billing').jpmcOVisaPayForm;
    var jpmcOApplePayForm = server.forms.getForm('billing').jpmcOApplePayForm;
    var visaPayConfigurations = preferenceHelper.getVisaPayConfigurations();
    var jpmcOProfileForm;
    if (!empty(activeProfilePayments)) {
        jpmcOProfileForm = server.forms.getForm('billing').jpmcOProfileForm;
    }
    var jpmcOElectronicCheckForm = server.forms.getForm('billing').jpmcOElectronicCheckForm;

    var disableProfileCheckbox = false;
    if (preferenceHelper.isPageEncryptionEnabled() && preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.orbitalProfile) {
        disableProfileCheckbox = true;
    }
    viewData.disableProfileCheckbox = disableProfileCheckbox;
    if (jpmcOCreditForm) {
        viewData.jpmcOCreditForm = jpmcOCreditForm;
    }
    if (!empty(jpmcOProfileForm)) {
        viewData.jpmcOProfileForm = jpmcOProfileForm;
    }
    if (jpmcOGooglePayForm) {
        viewData.jpmcOGooglePayForm = jpmcOGooglePayForm;
    }
    viewData.googlePayConfigurations = googlePayConfigurations;
    if (jpmcOApplePayForm) {
        viewData.jpmcOApplePayForm = jpmcOApplePayForm;
    }
    if (jpmcOElectronicCheckForm) {
        viewData.jpmcOElectronicCheckForm = jpmcOElectronicCheckForm;
    }
    if (jpmcOVisaPayForm) {
        viewData.jpmcOVisaPayForm = jpmcOVisaPayForm;
    }
    viewData.visaPayConfigurations = visaPayConfigurations;
    res.setViewData(viewData);
    return next();
});

module.exports = server.exports();
