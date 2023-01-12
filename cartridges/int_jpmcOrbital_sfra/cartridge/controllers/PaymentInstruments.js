'use strict';

var server = require('server');
server.extend(module.superModule);

var preferenceHelper = require('*/cartridge/scripts/helpers/preferenceHelper');
var Resource = require('dw/web/Resource');
var JPMCOrbitalConstants = require('*/cartridge/scripts/helpers/jpmcOConstantsHelper');

/**
 * PaymentInstruments-AddPayment : The endpoint PaymentInstruments-AddPayment endpoint renders the page that allows a shopper to save a payment instrument to their account
 * @name Base/PaymentInstruments-AddPayment
 * @function
 * @memberof PaymentInstruments
 * @param {middleware} - csrfProtection.generateToken
 * @param {middleware} - consentTracking.consent
 * @param {middleware} - userLoggedIn.validateLoggedIn
 * @param {category} - sensitive
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.append(
    'AddPayment',
    function (req, res, next) {
        var viewData = res.getViewData();

        var orbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
        var isGooglePayEnabled = preferenceHelper.isGooglePayEnabled();
        var isVisaPayEnabled = preferenceHelper.isVisaPayEnabled();
        var isApplePayEnabled = preferenceHelper.isApplePayEnabled();
        var PaymentMgr = require('dw/order/PaymentMgr');
        var isOrbitalAPIEnabled = preferenceHelper.isOrbitalAPIEnabled();
        if (!isOrbitalAPIEnabled) {
            return next();
        }
        orbitalAPIHelper.prepareBillingFormJPMC();
        viewData.isOrbitalAPIEnabled = isOrbitalAPIEnabled;
        var googlePayConfigurations = preferenceHelper.getGooglePayConfigurations();
        if (isGooglePayEnabled) {
            viewData.googlePayConfigurations = googlePayConfigurations;
        }
        var visaPayConfigurations = preferenceHelper.getVisaPayConfigurations();
        if (isVisaPayEnabled) {
            viewData.visaPayConfigurations = visaPayConfigurations;
        }
        var jpmcOCreditForm = server.forms.getForm('billing').jpmcOCreditForm;
        var paymentMethods = PaymentMgr.getActivePaymentMethods();
        var customerNo = req.currentCustomer.profile.customerNo;
        viewData.customerNo = customerNo;
        if (jpmcOCreditForm) {
            viewData.jpmcOCreditForm = jpmcOCreditForm;
        }
        var currentYear = new Date().getFullYear();
        var creditCardExpirationYears = [];

        for (var j = 0; j < 10; j++) {
            creditCardExpirationYears.push((currentYear + j));
        }
        var jpmcOElectronicCheckForm = server.forms.getForm('billing').jpmcOElectronicCheckForm;

        if (jpmcOElectronicCheckForm) {
            viewData.jpmcOElectronicCheckForm = jpmcOElectronicCheckForm;
        }
        var jpmcOGooglePayForm = server.forms.getForm('billing').jpmcOGooglePayForm;

        if (jpmcOGooglePayForm && isGooglePayEnabled) {
            viewData.jpmcOGooglePayForm = jpmcOGooglePayForm;
        }

        var jpmcOVisaPayForm = server.forms.getForm('billing').jpmcOVisaPayForm;

        if (jpmcOVisaPayForm && isVisaPayEnabled) {
            viewData.jpmcOVisaPayForm = jpmcOVisaPayForm;
        }

        var jpmcOApplePayForm = server.forms.getForm('billing').jpmcOApplePayForm;

        if (jpmcOApplePayForm && isApplePayEnabled) {
            viewData.jpmcOApplePayForm = jpmcOApplePayForm;
        }

        viewData.expirationYears = creditCardExpirationYears;
        viewData.paymentMethods = paymentMethods;
        var disableProfileCheckbox = false;
        var disableEC = false;
        var hideSecurityCode = true;
        var hideSecurityCodeGoogle = true;
        var hideSecurityCodeApple = true;
        var hideSecurityCodeVisa = true;
        if (preferenceHelper.isPageEncryptionEnabled() && preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken) {
            viewData.encryptedData = server.forms.getForm('billing').encryptedData;
            hideSecurityCode = false;
        }

        if (preferenceHelper.getPaymentPlatformMode() === JPMCOrbitalConstants.tandem) {
            disableEC = true;
        }
        var showCreditCardForm = false;
        if (disableEC && disableProfileCheckbox) {
            showCreditCardForm = true;
        }
        viewData.hideSecurityCodeGoogle = hideSecurityCodeGoogle;
        viewData.hideSecurityCodeApple = hideSecurityCodeApple;
        viewData.hideSecurityCodeVisa = hideSecurityCodeVisa;
        viewData.hideSecurityCode = hideSecurityCode;
        viewData.disableEC = disableEC;
        viewData.disableProfileCheckbox = disableProfileCheckbox;
        viewData.showCreditCardForm = showCreditCardForm;
        viewData.showGooglePayForm = preferenceHelper.isGooglePayEnabled();
        viewData.JPMC_ORBITAL_CC_METHOD = JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD;
        viewData.JPMC_ORBITAL_GOOGLEPAY_METHOD = JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD;
        viewData.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD = JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD;
        viewData.JPMC_ORBITAL_VISA_CHECKOUT_METHOD = JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD;
        viewData.JPMC_ORBITAL_APPLEPAY_METHOD = JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD;
        viewData.showVisaPayForm = preferenceHelper.isVisaPayEnabled();
        viewData.showApplePayForm = preferenceHelper.isApplePayEnabled();
        res.setViewData(viewData);
        return next();
    });

/**
 * PaymentInstruments-SavePayment : The PaymentInstruments-SavePayment endpoint is the endpoit responsible for saving a shopper's payment to their account
 * @name Base/PaymentInstruments-SavePayment
 * @function
 * @memberof PaymentInstruments
 * @param {middleware} - csrfProtection.validateAjaxRequest
 * @param {httpparameter} - csrf_token - hidden input field CSRF token
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.append('SavePayment', function (req, res, next) {
    if (!preferenceHelper.isOrbitalAPIEnabled()) {
        return next();
    }

    var CustomerMgr = require('dw/customer/CustomerMgr');
    var OrbitalAPIHelper = require('*/cartridge/scripts/helpers/orbitalAPIHelper');
    var URLUtils = require('dw/web/URLUtils');
    var params = request.httpParameterMap;
    var customer = CustomerMgr.getCustomerByCustomerNumber(params.customerNo);
    var paymentOption = params.paymentOption.value;
    var profileAddModel = require('*/cartridge/models/jpmcModels/jpmcProfileAddModel');
    var jpmcOCreditForm = server.forms.getForm('billing').jpmcOCreditForm;
    var jpmcOElectronicCheckForm = server.forms.getForm('billing').jpmcOElectronicCheckForm;
    var jpmcOGooglePayForm = server.forms.getForm('billing').jpmcOGooglePayForm;
    var jpmcOVisaPayForm = server.forms.getForm('billing').jpmcOVisaPayForm;
    var jpmcOApplePayForm = server.forms.getForm('billing').jpmcOApplePayForm;
    var isGooglePayEnabled = preferenceHelper.isGooglePayEnabled();
    var isVisaPayEnabled = preferenceHelper.isVisaPayEnabled();
    var isApplePayEnabled = preferenceHelper.isApplePayEnabled();
    var currencyCode = req.session.currency.currencyCode;
    var cardType = OrbitalAPIHelper.creditCardType(jpmcOCreditForm.cardNumber.value);
    jpmcOCreditForm.cardType.value = cardType;
    var currentMonth = (new Date().getMonth() + 1);
    var currentYear = new Date().getFullYear();
    var formDataGooglePay;
    var formDataVisaPay;
    var formDataApplePay;
    var profileAddObject;
    if (isGooglePayEnabled && paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
        var debundlePaymentObjectGoogle = OrbitalAPIHelper.prepareDebundlePaymentObjectForGooglePay(jpmcOGooglePayForm.googlepay.value);
        var debundlePaymentInfoGoogle = OrbitalAPIHelper.debundlePaymentInfoForGooglePay(debundlePaymentObjectGoogle);
        formDataGooglePay = {
            expirationMonth: { value: debundlePaymentInfoGoogle.TokenData.expirationMonth },
            expirationYear: { value: debundlePaymentInfoGoogle.TokenData.expirationYear },
            cardNumber: { value: debundlePaymentInfoGoogle.TokenData.pan },
            cardType: { value: JPMCOrbitalConstants.GOOGLE },
            googlePayToken: jpmcOGooglePayForm.googlepay.value
        };
    } else if (isVisaPayEnabled && paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
        var debundlePaymentObjectVisaPay = OrbitalAPIHelper.prepareDebundlePaymentObjectForVisaPay(jpmcOVisaPayForm.visaPay.value);
        var debundlePaymentInfoVisaPay = OrbitalAPIHelper.debundlePaymentInfoForVisaPay(debundlePaymentObjectVisaPay);
        formDataVisaPay = {
            expirationMonth: { value: debundlePaymentInfoVisaPay.TokenData.expirationMonth },
            expirationYear: { value: debundlePaymentInfoVisaPay.TokenData.expirationYear },
            cardNumber: { value: debundlePaymentInfoVisaPay.TokenData.accountNumber },
            cardType: { value: JPMCOrbitalConstants.VISA_CHECKOUT },
            visaPay: jpmcOVisaPayForm.visaPay.value
        };
    } else if (isApplePayEnabled && paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
        var debundlePaymentObjectApple = OrbitalAPIHelper.prepareDebundlePaymentObjectForApplePay(jpmcOApplePayForm.applepay.value);
        var debundlePaymentInfoApple = OrbitalAPIHelper.debundlePaymentInfoForApplePay(debundlePaymentObjectApple);
        formDataApplePay = {
            expirationMonth: { value: debundlePaymentInfoApple.TokenData.applicationExpirationDate.slice(2, 4) },
            expirationYear: { value: JPMCOrbitalConstants.n_20 + debundlePaymentInfoApple.TokenData.applicationExpirationDate.slice(0, 2) },
            cardNumber: { value: debundlePaymentInfoApple.TokenData.applicationPrimaryAccountNumber },
            cardType: { value: JPMCOrbitalConstants.APPLE },
            applePayToken: jpmcOApplePayForm.applepay.value
        };
    }

    if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD || preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.orbitalProfile) {
        if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
            if ((jpmcOCreditForm.expirationMonth.value <= currentMonth) && (jpmcOCreditForm.expirationYear.value <= currentYear)) {
                res.json({
                    success: false,
                    errorMessage: Resource.msg('error.expired.credit.card', 'creditCard', null)
                });

                return next();
            }
            if (cardType === JPMCOrbitalConstants.Discover && (currencyCode === JPMCOrbitalConstants.GBP || currencyCode === JPMCOrbitalConstants.EUR)) {
                res.json({
                    success: false,
                    errorMessage: Resource.msgf('card.error.message', 'payment', null, cardType)
                });
                return next();
            }
            profileAddObject = profileAddModel.getProfileAddObjectFromAccount(jpmcOCreditForm, customer.profile, JPMCOrbitalConstants.CC);
        } else if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
            profileAddObject = profileAddModel.getProfileAddObjectFromAccount(jpmcOElectronicCheckForm, customer.profile, JPMCOrbitalConstants.EC);
        } else if (isGooglePayEnabled && paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
            profileAddObject = profileAddModel.getProfileAddObjectFromAccount(formDataGooglePay, customer.profile, JPMCOrbitalConstants.CC);
        } else if (isVisaPayEnabled && paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
            profileAddObject = profileAddModel.getProfileAddObjectFromAccount(formDataVisaPay, customer.profile, JPMCOrbitalConstants.CC);
        } else if (isApplePayEnabled && paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
            profileAddObject = profileAddModel.getProfileAddObjectFromAccount(formDataApplePay, customer.profile, JPMCOrbitalConstants.CC);
        }
        var JPMCOProfileServices = require('*/cartridge/scripts/services/jpmcOServices.js');
        var profileServices = new JPMCOProfileServices();
        var profileAddResponse = profileServices.addProfile(profileAddObject);

        if (profileAddResponse.status === JPMCOrbitalConstants.OK) {
            if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
                OrbitalAPIHelper.saveCustomerPayment(params.customerNo, JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD, profileAddResponse.responseBody.profile.customerRefNum, jpmcOCreditForm);
            } else if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD) {
                OrbitalAPIHelper.saveCustomerPayment(params.customerNo, JPMCOrbitalConstants.JPMC_ORBITAL_ELECTRONIC_CHECK_METHOD, profileAddResponse.responseBody.profile.customerRefNum, jpmcOElectronicCheckForm);
            } else if (isGooglePayEnabled && paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
                OrbitalAPIHelper.saveCustomerPayment(params.customerNo, JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD, profileAddResponse.responseBody.profile.customerRefNum, formDataGooglePay);
            } else if (isVisaPayEnabled && paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
                OrbitalAPIHelper.saveCustomerPayment(params.customerNo, JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD, profileAddResponse.responseBody.profile.customerRefNum, formDataVisaPay);
            } else if (isApplePayEnabled && paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
                OrbitalAPIHelper.saveCustomerPayment(params.customerNo, JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD, profileAddResponse.responseBody.profile.customerRefNum, formDataApplePay);
            }
            res.json({
                success: true,
                redirectUrl: URLUtils.url('PaymentInstruments-List').toString()
            });
        } else {
            var profileErrorMessage = JSON.parse(profileAddResponse.errorMessage).procStatusMessage;
            res.json({
                success: false,
                errorMessage: profileErrorMessage
            });
        }
    } else if (preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken) {
        var tokenModel = require('*/cartridge/models/jpmcModels/jpmcTokenModel');
        var tokenObject;
        if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD) {
            if ((jpmcOCreditForm.expirationMonth.value <= currentMonth) && (jpmcOCreditForm.expirationYear.value <= currentYear)) {
                res.json({
                    success: false,
                    errorMessage: Resource.msg('error.expired.credit.card', 'creditCard', null)
                });
                return next();
            }
            if (cardType === JPMCOrbitalConstants.DI && (currencyCode === JPMCOrbitalConstants.GBP || currencyCode === JPMCOrbitalConstants.EUR)) {
                res.json({
                    success: false,
                    errorMessage: Resource.msgf('card.error.message', 'payment', null, cardType)
                });
                return next();
            }
            tokenObject = tokenModel.getTokenObjectFromAccount(jpmcOCreditForm, JPMCOrbitalConstants.CC);
        }
        if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
            tokenObject = tokenModel.getTokenObjectFromAccountGooglePay(jpmcOGooglePayForm.googlepay.value);
        } else if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
            tokenObject = tokenModel.getTokenObjectFromAccountVisaPay(jpmcOVisaPayForm.visaPay.value);
        } else if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
            tokenObject = tokenModel.getTokenObjectFromAccountApplePay(jpmcOApplePayForm.applepay.value);
        }
        var JPMCOTokenServices = require('*/cartridge/scripts/services/jpmcOServices.js');
        var tokenServices = new JPMCOTokenServices();
        var tokenResponse = tokenServices.getToken(tokenObject);
        if (tokenResponse.status === JPMCOrbitalConstants.OK) {
            if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_GOOGLEPAY_METHOD) {
                OrbitalAPIHelper.saveCustomerPayment(params.customerNo, paymentOption, tokenResponse.responseBody.paymentInstrument.card.ccAccountNum, formDataGooglePay, tokenResponse.responseBody.paymentInstrument.card.cardBrand);
            } else if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_VISA_CHECKOUT_METHOD) {
                OrbitalAPIHelper.saveCustomerPayment(params.customerNo, paymentOption, tokenResponse.responseBody.paymentInstrument.card.ccAccountNum, formDataVisaPay, tokenResponse.responseBody.paymentInstrument.card.cardBrand);
            } else if (paymentOption === JPMCOrbitalConstants.JPMC_ORBITAL_APPLEPAY_METHOD) {
                OrbitalAPIHelper.saveCustomerPayment(params.customerNo, paymentOption, tokenResponse.responseBody.paymentInstrument.card.ccAccountNum, formDataApplePay, tokenResponse.responseBody.paymentInstrument.card.cardBrand);
            } else {
                OrbitalAPIHelper.saveCustomerPayment(params.customerNo, JPMCOrbitalConstants.JPMC_ORBITAL_CC_METHOD, tokenResponse.responseBody.paymentInstrument.card.ccAccountNum, jpmcOCreditForm);
            }
            res.json({
                success: true,
                redirectUrl: URLUtils.url('PaymentInstruments-List').toString()
            });
        } else {
            var errorMessage = JSON.parse(tokenResponse.errorMessage).procStatusMessage;
            res.json({
                success: false,
                errorMessage: errorMessage
            });
        }
    }
    return next();
});

/**
 * PaymentInstruments-List : The endpoint PaymentInstruments-List is the endpoint that renders a list of shopper saved payment instruments. The rendered list displays the masked card number expiration data and payemnt instrument type
 * @name Base/PaymentInstruments-List
 * @function
 * @memberof PaymentInstruments
 * @param {category} - sensitive
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.append('List', function (req, res, next) {
    var viewData = res.getViewData();
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var isOrbitalAPIEnabled = preferenceHelper.isOrbitalAPIEnabled();
    var isGooglePayEnabled = preferenceHelper.isGooglePayEnabled();
    var isVisaPayEnabled = preferenceHelper.isVisaPayEnabled();
    var customer = CustomerMgr.getCustomerByCustomerNumber(req.currentCustomer.profile.customerNo);
    var wallet = customer.getProfile().getWallet();
    var paymentInstruments = [];
    var savedPaymentInstruments = wallet.paymentInstruments;
    var savedPaymentInstrumentsKeys = Object.keys(savedPaymentInstruments);
    viewData.isOrbitalAPIEnabled = isOrbitalAPIEnabled;
    savedPaymentInstrumentsKeys.forEach(function (index) {
        var savedPaymentInstrument = savedPaymentInstruments[index];
        var skip = false;
        if (!isOrbitalAPIEnabled) {
            if (savedPaymentInstrument.paymentMethod.slice(0, 4) === JPMCOrbitalConstants.JPMC) {
                skip = true;
            } else {
                paymentInstruments.push(savedPaymentInstrument);
            }
        }
        if (savedPaymentInstrument.creditCardType === JPMCOrbitalConstants.EC && preferenceHelper.getPaymentPlatformMode() === JPMCOrbitalConstants.tandem) {
            skip = true;
        }
        if (!isGooglePayEnabled && (savedPaymentInstrument.creditCardType && (savedPaymentInstrument.creditCardType === JPMCOrbitalConstants.GOOGLE || (savedPaymentInstrument.creditCardType.split('_').length > 1 && savedPaymentInstrument.creditCardType.split('_')[1] === JPMCOrbitalConstants.GOOGLE)))) {
            skip = true;
        }
        if (!isVisaPayEnabled && (savedPaymentInstrument.creditCardType && (savedPaymentInstrument.creditCardType === JPMCOrbitalConstants.VISA_CHECKOUT || (savedPaymentInstrument.creditCardType.split('_').length > 1 && savedPaymentInstrument.creditCardType.split('_')[1] === JPMCOrbitalConstants.VISA_CHECKOUT)))) {
            skip = true;
        }
        if (!skip) {
            if (savedPaymentInstrument.creditCardType === JPMCOrbitalConstants.EC || (preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.orbitalProfile && savedPaymentInstrument.custom.jpmcOIsProfile)) {
                if (savedPaymentInstrument.custom.jpmcOAccountID === preferenceHelper.getMerchantId()) {
                    paymentInstruments.push(savedPaymentInstrument);
                }
            } else if (preferenceHelper.getCustomerSavedPaymentType() === JPMCOrbitalConstants.safetechToken && savedPaymentInstrument.custom.jpmcOIsSafetech) {
                if (savedPaymentInstrument.custom.jpmcOAccountID === preferenceHelper.getPageEncryptionConfigurations().pieSubscriberID) {
                    paymentInstruments.push(savedPaymentInstrument);
                }
            }
        }
    });
    viewData.paymentInstruments = paymentInstruments;
    viewData.customerNo = req.currentCustomer.profile.customerNo;
    res.setViewData(viewData);
    return next();
});

/**
 * PaymentInstruments-DeletePayment : The PaymentInstruments-DeletePayment is the endpoint responsible for deleting a shopper's saved payment instrument from their account
 * @name Base/PaymentInstruments-DeletePayment
 * @function
 * @memberof PaymentInstruments
 * @param {middleware} - userLoggedIn.validateLoggedInAjax
 * @param {querystringparameter} - UUID - the universally unique identifier of the payment instrument to be removed from the shopper's account
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.append('DeletePayment', function (req, res, next) {
    var viewData = res.getViewData();
    var paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
    var UUID = req.querystring.UUID;
    var array = require('*/cartridge/scripts/util/array');
    var paymentToDelete = array.find(paymentInstruments, function (item) {
        return UUID === item.UUID;
    });
    if (paymentToDelete && paymentToDelete.raw.creditCardToken && preferenceHelper.getCustomerSavedPaymentType() !== JPMCOrbitalConstants.safetechToken) {
        var profileDeleteModel = require('*/cartridge/models/jpmcModels/jpmcProfileDeleteModel');
        var profileDeleteObject = profileDeleteModel.getProfileDeleteObject(paymentToDelete.raw.creditCardToken);

        var JPMCOProfileServices = require('*/cartridge/scripts/services/jpmcOServices.js');
        var profileServices = new JPMCOProfileServices();
        profileServices.deleteProfile(profileDeleteObject);
    }
    res.setViewData(viewData);
    return next();
});
module.exports = server.exports();
