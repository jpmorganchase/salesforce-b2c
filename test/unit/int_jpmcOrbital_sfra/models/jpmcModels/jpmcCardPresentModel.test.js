const assert = require('chai').assert;
const proxyquire = require('proxyquire').noCallThru();

var stubObject = {
    MerchantModel: require('../../../../mocks/jpmcModelsMocks/jpmcMerchantModelMock.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

var bin = '000001';

describe('JPMC CardPresent Model Tests', function () {
    const CardPresentModelPath = '../../../../mocks/jpmcModelsMocks/jpmcCardPresentModelMock.test';
    const CardPresentModel = proxyquire(CardPresentModelPath, {
        '*/cartridge/models/jpmcModels/jpmcMerchantModel': stubObject.MerchantModel,
        '*/cartridge/scripts/helpers/jpmcOConstantsHelper': stubObject.jpmcOConstantsHelperMocks
    });

    describe('getCardPresentObject', function () {
        it('should return a cardPresentObject', function () {
            var result = new CardPresentModel(CardPresentModel.getCardPresentObject(bin));
            assert.equal(result.vendorID, 'G022');
            assert.equal(result.softwareID, 'O023');
        });
    });
});

