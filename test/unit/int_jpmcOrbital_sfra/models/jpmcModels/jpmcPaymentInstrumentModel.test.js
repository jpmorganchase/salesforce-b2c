
const assert = require('assert');
const proxyquire = require('proxyquire').noCallThru();

var card = {
    cardNumber: { value: '5454545454545454' },
    expirationYear: { value: 2025 },
    expirationMonth: { value: 6 },
    securityCode: { value: '123' },
    cardType: { value: 'Visa' }
};


var customerRefNum = 'testprofile01';

var eCheck = {
    ecpBankAcctType: { value: 'C' },
    ecpCheckDDA: { value: '0888271156' },
    ecpCheckRT: { value: '122000247' }
};

var stubObject = {
    CardModel: require('../../../../mocks/jpmcModelsMocks/jpmcCardModelMock.test'),
    ProfileModel: require('../../../../mocks/jpmcModelsMocks/jpmcProfileModelMock.test'),
    ElectronicCheckModel: require('../../../../mocks/jpmcModelsMocks/jpmcElectronicCheckModelMock.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};


const PaymentInstrumentModelPath = '../../../../mocks/jpmcModelsMocks/jpmcPaymentInstrumentModelMock.test.js';
const PaymentInstrumentModel = proxyquire(PaymentInstrumentModelPath, {
    '*/cartridge/models/jpmcModels/jpmcCardModel': stubObject.CardModel,
    '*/cartridge/models/jpmcModels/jpmcProfileModel': stubObject.ProfileModel,
    '*/cartridge/models/jpmcModels/jpmcElectronicCheckModel': stubObject.ElectronicCheckModel,
    '*/cartridge/scripts/helpers/jpmcOConstantsHelper': stubObject.jpmcOConstantsHelperMocks
});

describe('getPaymentInstrumentObjectForCredit', function () {
    it('should return a getPaymentInstrumentObject with ccAcountNum and ccExp', function () {
        var result = new PaymentInstrumentModel(PaymentInstrumentModel.getPaymentInstrumentObjectForCredit(card));
        assert.equal(result.card.ccAccountNum, '5454545454545454');
        assert.equal(result.card.ccExp, '202506');
    });
});

describe('getPaymentInstrumentObjectForProfile', function () {
    it('should return a getPaymentInstrumentObjectForProfile with useProfile', function () {
        var result = new PaymentInstrumentModel(PaymentInstrumentModel.getPaymentInstrumentObjectForProfile(customerRefNum));
        assert.equal(result.useProfile.useCustomerRefNum, 'testprofile01');
    });
});


describe('getPaymentInstrumentObjectForElectronicCheck', function () {
    it('should return a getPaymentInstrumentObjectForElectronicCheck with eCheck', function () {
        var result = new PaymentInstrumentModel(PaymentInstrumentModel.getPaymentInstrumentObjectForElectronicCheck(eCheck));
        assert.equal(result.electronicCheck.ecpBankAcctType, 'C');
        assert.equal(result.electronicCheck.ecpCheckDDA, '0888271156');
        assert.equal(result.electronicCheck.ecpCheckRT, '122000247');
    });
});
