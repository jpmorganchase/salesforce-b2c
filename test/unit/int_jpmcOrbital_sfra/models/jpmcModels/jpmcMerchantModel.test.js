
const assert = require('assert');
const proxyquire = require('proxyquire').noCallThru();

var stubObject = {
    preferenceHelperMock: require('../../../../mocks/preferenceHelperMocks.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

const MerchantModelPath = '../../../../mocks/jpmcModelsMocks/jpmcMerchantModelMock.test.js';
const MerchantModel = proxyquire(MerchantModelPath, {
    '*/cartridge/scripts/helpers/preferenceHelper': stubObject.preferenceHelperMock,
    '*/cartridge/scripts/helpers/jpmcOConstantsHelper': stubObject.jpmcOConstantsHelperMocks
});

describe('getMerchantObject', function () {
    it('should return a merchantObject with merchantID, bin, terminalID', function () {
        var result = new MerchantModel(MerchantModel.getMerchantObject());
        assert.equal(result.merchantID, '441759');
        assert.equal(result.bin, '000001');
        assert.equal(result.terminalID, '001');
    });
});
