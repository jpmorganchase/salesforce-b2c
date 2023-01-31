
const assert = require('assert');
const proxyquire = require('proxyquire').noCallThru();

var stubObject = {
    MerchantModel: require('../../../../mocks/jpmcModelsMocks/jpmcMerchantModelMock.test'),
    OrderModel: require('../../../../mocks/jpmcModelsMocks/jpmcOrderModelMock.test'),
    PaymentInstrumentModel: require('../../../../mocks/jpmcModelsMocks/jpmcPaymentInstrumentModelMock.test'),
    CardModel: require('../../../../mocks/jpmcModelsMocks/jpmcCardModelMock.test'),
    CardholderVerificationModel: require('../../../../mocks/jpmcModelsMocks/jpmcCardholderVerificationModelMock.test'),
    PageEncryptionModel: require('../../../../mocks/jpmcModelsMocks/jpmcPageEncryptionModelMock.test'),
    AVSModel: require('../../../../mocks/jpmcModelsMocks/jpmcAVSModelMock.test'),
    AdditionalAuthInfoModel: require('../../../../mocks/jpmcModelsMocks/jpmcAdditionalAuthInfoModelMock.test'),
    paymentModel: require('../../../../mocks/jpmcModelsMocks/paymentModelMock.test'),
    profileAddModelMock: require('../../../../mocks/jpmcModelsMocks/jpmcProfileAddModelMock.test'),
    preferenceHelper: require('../../../../mocks/preferenceHelperMocks.test'),
    servicesMock: require('../../../../mocks/jpmcOServicesMocks.test'),
    orbitalAPIHelperMock: require('../../../../mocks/orbitalAPIHelperMocks.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test'),
    jpmcCardPresentModelMocks: require('../../../../mocks/jpmcModelsMocks/jpmcCardPresentModelMock.test')
};
global.session = {
    forms: {
        billing: {
            encryptedData: {
                value: '["5454 5484 1325 5454","151","9d0796de91411205","4fbd283a"]'
            }
        }
    },
    privacy: {
        saveCustomerPaymentCheckbox: false
    }
};

var customerRefNum = 'testprofile01';
var paymentMethod;
var card = {
    cardNumber: { value: '5454545454545454' },
    expirationYear: { value: 2025 },
    expirationMonth: { value: 6 },
    securityCode: { value: '123' },
    cardType: { value: 'Master Card' }
};


var order = {
    currentOrderNo: '00004419',
    totalGrossPrice: { value: 99.74 },
    billingAddress: {
        address1: 'Address 1',
        address2: 'Address 2',
        city: 'Los Angeles',
        fullName: 'John Doe',
        phone: '5555555555',
        postalCode: '90001',
        stateCode: 'CA',
        countryCode: { value: 'US' }
    },
    customer: {
        registered: false,
        authentificated: false
    },
    paymentInstrument: {
        creditCardType: 'GOOGLE',
        custom: {
            jpmco_cardBrand: 'MC'
        }
    }
};

var googlePayToken = '{"signature":"MEUCIQDun06JUwKaCFMEzTWUbaSp1tH1mVeugrrQdYeVW+qwwwIgLLEBVpm/sXIubxAPMblwsRx42jY3Klmv63owpELgK6Y=","protocolVersion":"ECv1","signedMessage":{"encryptedMessage":"8oqsQj1iYcbkgNpDN0aTSfhbhOGdqT8/4JNgHuWwywvPMttOGhs8K8ERNCINw6IwOxOuwod4wH4RqnptDl0LQl2yqyl4ocekcSgibwonLXiQOTDmASr00rGtAYlS/SOW5SRCTRuNL3uzpo+GY8bgXN5GLKA/As7fAZ0FsYgVg5WKXNyFHi5X8m4uLZIh/LGKwa4h50Iry4a5WpHrcFJNQ8kb8HHzNisyPCHSDXBp5ozIiorcnPSY9OeBgNRZ5+O5GXdGI34Y9kGBo8exU35Okxf3JKjrv7kMEX77aipTAGUxYuStSw/VwgBzkRfBBOdbF40RdbNeaqTgF9dHLKlOB2ODS2u0fUUK69zlWbvYL2Z+OWHQDJpho0L/xqX/uB2XyVVr97dI5GGxQKryWZyrGVSAYI2FBun2Ppwcw86OqHCdifJAP5mNhbcGaa8oyZqHDg==","ephemeralPublicKey":"BBdD7Yc3esVqJbtVnsDJsnMUhlEy+SX2KQTDi0sZsrpTCXCtDw8SVmcO+9GrCULdD5ORjV0r8UJ39G6r3o+tWyo=","tag":"s9EnUmCNmPlnovUxRt1GqCeO0uxsWc5jIZyGQQ/IcPs="}}';
var visaPay = '{"partialShippingAddress":{"countryCode":"US","postalCode":"36703"},"paymentMethodType":"PAN","callid":"1445904038510104201","vInitRequest":{"apikey":"0M1HEVIXRILT3A9BI7QE21FvsRrndzozl0m9X1vKX3Terko4o","paymentRequest":{"currencyCode":"USD","subtotal":175.34},"browserLocale":"uk_UA","clientId":"c5151113-62c6-36ce-b217-10a44a30eb02","currencyFormat":"currencyCode ###,###,###.##","displayName":"Merchant","enableUserDataPrefill":false,"guestCheckout":false,"parentUrl":"https://zzrb-303.sandbox.us01.dx.commercecloud.salesforce.com/on/demandware.store/Sites-SFRA_V_6-Site/en_US/Checkout-Begin","settings":{"payment":{},"shipping":{"collectShipping":"true"},"widgetStyle":"OVERLAY"}}}';
var securityCode = '111';
describe('JPMC Orbital Payment Model Tests', function () {
    const PaymentModelPath = '../../../../mocks/jpmcModelsMocks/paymentModelMock.test.js';
    const PaymentModel = proxyquire(PaymentModelPath, {
        '*/cartridge/models/jpmcModels/jpmcMerchantModel': stubObject.MerchantModel,
        '*/cartridge/models/jpmcModels/jpmcOrderModel': stubObject.OrderModel,
        '*/cartridge/models/jpmcModels/jpmcPaymentInstrumentModel': stubObject.PaymentInstrumentModel,
        '*/cartridge/models/jpmcModels/jpmcCardholderVerificationModel': stubObject.CardholderVerificationModel,
        '*/cartridge/models/jpmcModels/jpmcPageEncryptionModel': stubObject.PageEncryptionModel,
        '*/cartridge/models/jpmcModels/jpmcAVSModel': stubObject.AVSModel,
        '*/cartridge/models/jpmcModels/jpmcAdditionalAuthInfoModel': stubObject.AdditionalAuthInfoModel,
        '*/cartridge/scripts/helpers/preferenceHelper': stubObject.preferenceHelper,
        '*/cartridge/models/jpmcModels/jpmcProfileAddModel': stubObject.profileAddModelMock,
        '*/cartridge/scripts/services/jpmcOServices.js': stubObject.servicesMock,
        '*/cartridge/scripts/helpers/orbitalAPIHelper': stubObject.orbitalAPIHelperMock,
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': stubObject.jpmcOConstantsHelperMocks,
        '*/cartridge/models/jpmcModels/jpmcCardPresentModel': stubObject.jpmcCardPresentModelMocks
    });
    paymentMethod = 'JPMC_ORBITAL_CC_METHOD';
    describe('getPaymentObjectForCardAuthorizationOnly', function () {
        it('should return a paymentObject with merchant, paymentInstrument, order, cardholderVerification, transType', function () {
            var result = new PaymentModel(PaymentModel.getPaymentObjectForCardAuthorizationOnly(order, card, paymentMethod));
            assert.equal(result.avsBilling.avsAddress1, 'Address 1');
            assert.equal(result.avsBilling.avsCity, 'Los Angeles');
            assert.equal(result.avsBilling.avsCountryCode, 'US');
            assert.equal(result.avsBilling.avsName, 'John Doe');
            assert.equal(result.avsBilling.avsPhone, '5555555555');
            assert.equal(result.avsBilling.avsState, 'CA');
            assert.equal(result.avsBilling.avsZip, '90001');
            assert.equal(result.cardholderVerification.ccCardVerifyNum, '123');
            assert.equal(result.merchant.bin, '000001');
            assert.equal(result.merchant.terminalID, '001');
            assert.equal(result.order.amount, '9974');
            assert.equal(result.order.orderID, '00004419');
            assert.equal(result.paymentInstrument.card.ccAccountNum, '5454545454545454');
            assert.equal(result.paymentInstrument.card.ccExp, '202506');
            assert.equal(result.transType, 'A');
            assert.equal(result.merchantInitiatedTransaction.mitMsgType, 'CEST');
            assert.equal(result.additionalAuthInfo.cardIndicators, 'Y');
        });
    });

    describe('getPaymentObjectForCardAuthorizationAndCapture', function () {
        it('should return a paymentObject with merchant, paymentInstrument, order, cardholderVerification, transType', function () {
            var result = new PaymentModel(PaymentModel.getPaymentObjectForCardAuthorizationAndCapture(order, card, paymentMethod));
            assert.equal(result.avsBilling.avsAddress1, 'Address 1');
            assert.equal(result.avsBilling.avsCity, 'Los Angeles');
            assert.equal(result.avsBilling.avsCountryCode, 'US');
            assert.equal(result.avsBilling.avsName, 'John Doe');
            assert.equal(result.avsBilling.avsPhone, '5555555555');
            assert.equal(result.avsBilling.avsState, 'CA');
            assert.equal(result.avsBilling.avsZip, '90001');
            assert.equal(result.cardholderVerification.ccCardVerifyNum, '123');
            assert.equal(result.merchant.bin, '000001');
            assert.equal(result.merchant.terminalID, '001');
            assert.equal(result.order.amount, '9974');
            assert.equal(result.order.orderID, '00004419');
            assert.equal(result.paymentInstrument.card.ccAccountNum, '5454545454545454');
            assert.equal(result.paymentInstrument.card.ccExp, '202506');
            assert.equal(result.transType, 'AC');
            assert.equal(result.merchantInitiatedTransaction.mitMsgType, 'CGEN');
            assert.equal(result.additionalAuthInfo.cardIndicators, 'Y');
        });
    });

    describe('getPaymentObjectForProfileAuthorizationOnly', function () {
        it('should return a paymentObject with avsBilling, merchant, paymentInstrument, order, debit, transType', function () {
            var result = new PaymentModel(PaymentModel.getPaymentObjectForProfileAuthorizationOnly(order, customerRefNum));
            assert.equal(result.avsBilling.avsAddress1, 'Address 1');
            assert.equal(result.avsBilling.avsCity, 'Los Angeles');
            assert.equal(result.avsBilling.avsCountryCode, 'US');
            assert.equal(result.avsBilling.avsName, 'John Doe');
            assert.equal(result.avsBilling.avsPhone, '5555555555');
            assert.equal(result.avsBilling.avsState, 'CA');
            assert.equal(result.avsBilling.avsZip, '90001');
            assert.equal(result.merchant.bin, '000001');
            assert.equal(result.merchant.terminalID, '001');
            assert.equal(result.paymentInstrument.useProfile.useCustomerRefNum, 'testprofile01');
            assert.equal(result.order.orderID, '00004419');
            assert.equal(result.order.amount, '9974');
            assert.equal(result.transType, 'A');
            assert.equal(result.merchantInitiatedTransaction.mitMsgType, 'CEST');
        });
    });

    describe('getPaymentObjectForProfileAuthorizationAndCapture', function () {
        it('should return a paymentObject with avsBilling, merchant, paymentInstrument, order, debit, transType', function () {
            var result = new PaymentModel(PaymentModel.getPaymentObjectForProfileAuthorizationAndCapture(order, customerRefNum));
            assert.equal(result.avsBilling.avsAddress1, 'Address 1');
            assert.equal(result.avsBilling.avsCity, 'Los Angeles');
            assert.equal(result.avsBilling.avsCountryCode, 'US');
            assert.equal(result.avsBilling.avsName, 'John Doe');
            assert.equal(result.avsBilling.avsPhone, '5555555555');
            assert.equal(result.avsBilling.avsState, 'CA');
            assert.equal(result.avsBilling.avsZip, '90001');
            assert.equal(result.merchant.bin, '000001');
            assert.equal(result.merchant.terminalID, '001');
            assert.equal(result.paymentInstrument.useProfile.useCustomerRefNum, 'testprofile01');
            assert.equal(result.order.orderID, '00004419');
            assert.equal(result.order.amount, '9974');
            assert.equal(result.transType, 'AC');
            assert.equal(result.merchantInitiatedTransaction.mitMsgType, 'CEST');
        });
    });

    describe('getPaymentObjectForCardZeroAuth', function () {
        it('should return a paymentObject with avsBilling, merchant, paymentInstrument, order, transType', function () {
            var result = new PaymentModel(PaymentModel.getPaymentObjectForCardZeroAuth(order, card));
            assert.equal(result.avsBilling.avsAddress1, 'Address 1');
            assert.equal(result.avsBilling.avsCity, 'Los Angeles');
            assert.equal(result.avsBilling.avsCountryCode, 'US');
            assert.equal(result.avsBilling.avsName, 'John Doe');
            assert.equal(result.avsBilling.avsPhone, '5555555555');
            assert.equal(result.avsBilling.avsState, 'CA');
            assert.equal(result.avsBilling.avsZip, '90001');
            assert.equal(result.cardholderVerification.ccCardVerifyNum, '123');
            assert.equal(result.merchant.bin, '000001');
            assert.equal(result.merchant.terminalID, '001');
            assert.equal(result.order.amount, '0');
            assert.equal(result.order.orderID, '00004419');
            assert.equal(result.paymentInstrument.card.ccAccountNum, '5454545454545454');
            assert.equal(result.paymentInstrument.card.ccExp, '202506');
            assert.equal(result.transType, 'A');
            assert.equal(result.merchantInitiatedTransaction.mitMsgType, 'CGEN');
            assert.equal(result.additionalAuthInfo.cardIndicators, 'Y');
        });
    });

    paymentMethod = 'JPMC_ORBITAL_GOOGLEPAY_METHOD';
    describe('getPaymentObjectForGooglePayAuthorizationOnly', function () {
        it('should return a paymentObject with merchant, paymentInstrument, order, cardholderVerification, transType', function () {
            var result = new PaymentModel(PaymentModel.getPaymentObjectForGooglePayAuthorizationOnly(order, googlePayToken, securityCode, paymentMethod));
            assert.equal(result.avsBilling.avsAddress1, 'Address 1');
            assert.equal(result.avsBilling.avsCity, 'Los Angeles');
            assert.equal(result.avsBilling.avsCountryCode, 'US');
            assert.equal(result.avsBilling.avsName, 'John Doe');
            assert.equal(result.avsBilling.avsPhone, '5555555555');
            assert.equal(result.avsBilling.avsState, 'CA');
            assert.equal(result.avsBilling.avsZip, '90001');
            assert.equal(result.merchant.bin, '000001');
            assert.equal(result.merchant.terminalID, '001');
            assert.equal(result.order.amount, '9974');
            assert.equal(result.order.orderID, '00004419');
            assert.equal(result.paymentInstrument.card.cardBrand, '');
            assert.equal(result.merchantInitiatedTransaction.mitMsgType, 'CEST');
            assert.equal(result.transType, 'A');
        });
    });

    describe('getPaymentObjectForGooglePayAuthorizationAndCapture', function () {
        it('should return a paymentObject with merchant, paymentInstrument, order, cardholderVerification, transType', function () {
            var result = new PaymentModel(PaymentModel.getPaymentObjectForGooglePayAuthorizationAndCapture(order, googlePayToken, securityCode, paymentMethod));
            assert.equal(result.avsBilling.avsAddress1, 'Address 1');
            assert.equal(result.avsBilling.avsCity, 'Los Angeles');
            assert.equal(result.avsBilling.avsCountryCode, 'US');
            assert.equal(result.avsBilling.avsName, 'John Doe');
            assert.equal(result.avsBilling.avsPhone, '5555555555');
            assert.equal(result.avsBilling.avsState, 'CA');
            assert.equal(result.avsBilling.avsZip, '90001');
            assert.equal(result.merchant.bin, '000001');
            assert.equal(result.merchant.terminalID, '001');
            assert.equal(result.order.amount, '9974');
            assert.equal(result.order.orderID, '00004419');
            assert.equal(result.paymentInstrument.card.cardBrand, '');
            assert.equal(result.merchantInitiatedTransaction.mitMsgType, 'CGEN');
            assert.equal(result.transType, 'AC');
        });
    });
    paymentMethod = 'JPMC_ORBITAL_VISA_CHECKOUT_METHOD';
    describe('getPaymentObjectForVisaPayAuthorizationOnly', function () {
        it('should return a paymentObject with merchant, paymentInstrument, order, cardholderVerification, transType', function () {
            var result = new PaymentModel(PaymentModel.getPaymentObjectForVisaPayAuthorizationOnly(order, visaPay, securityCode, paymentMethod));
            assert.equal(result.avsBilling.avsAddress1, 'Address 1');
            assert.equal(result.avsBilling.avsCity, 'Los Angeles');
            assert.equal(result.avsBilling.avsCountryCode, 'US');
            assert.equal(result.avsBilling.avsName, 'John Doe');
            assert.equal(result.avsBilling.avsPhone, '5555555555');
            assert.equal(result.avsBilling.avsState, 'CA');
            assert.equal(result.avsBilling.avsZip, '90001');
            assert.equal(result.merchant.bin, '000001');
            assert.equal(result.merchant.terminalID, '001');
            assert.equal(result.order.amount, '9974');
            assert.equal(result.order.orderID, '00004419');
            assert.equal(result.paymentInstrument.card.cardBrand, '');
            assert.equal(result.merchantInitiatedTransaction.mitMsgType, 'CEST');
            assert.equal(result.transType, 'A');
        });
    });

    describe('getPaymentObjectForVisaPayAuthorizationAndCapture', function () {
        it('should return a paymentObject with merchant, paymentInstrument, order, cardholderVerification, transType', function () {
            var result = new PaymentModel(PaymentModel.getPaymentObjectForVisaPayAuthorizationAndCapture(order, visaPay, securityCode, paymentMethod));
            assert.equal(result.avsBilling.avsAddress1, 'Address 1');
            assert.equal(result.avsBilling.avsCity, 'Los Angeles');
            assert.equal(result.avsBilling.avsCountryCode, 'US');
            assert.equal(result.avsBilling.avsName, 'John Doe');
            assert.equal(result.avsBilling.avsPhone, '5555555555');
            assert.equal(result.avsBilling.avsState, 'CA');
            assert.equal(result.avsBilling.avsZip, '90001');
            assert.equal(result.merchant.bin, '000001');
            assert.equal(result.merchant.terminalID, '001');
            assert.equal(result.order.amount, '9974');
            assert.equal(result.order.orderID, '00004419');
            assert.equal(result.paymentInstrument.card.cardBrand, '');
            assert.equal(result.merchantInitiatedTransaction.mitMsgType, 'CGEN');
            assert.equal(result.transType, 'AC');
        });
    });
});
