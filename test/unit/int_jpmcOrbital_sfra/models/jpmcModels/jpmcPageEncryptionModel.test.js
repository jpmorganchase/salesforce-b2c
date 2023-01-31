'use strict';

const assert = require('assert');
const proxyquire = require('proxyquire').noCallThru();
var proxyquireStubs = {
    preferenceHelperMock: require('../../../../mocks/preferenceHelperMocks.test'),
    jpmcOConstantsHelperMocks: require('../../../../mocks/jpmcOConstantsHelperMocks.test')
};

var PageEncryptionModelPath = '../../../../mocks/jpmcModelsMocks/jpmcPageEncryptionModelMock.test.js';
var encryptedData = '["5454 5484 1325 5454","151","9d0796de91411205","4fbd283a", "1"]';
const PageEncryptionModel = proxyquire(PageEncryptionModelPath, {
    '*/cartridge/scripts/helpers/preferenceHelper': proxyquireStubs.preferenceHelperMock,
    '*/cartridge/scripts/helpers/jpmcOConstantsHelper': proxyquireStubs.jpmcOConstantsHelperMocks
});
describe('getPageEncryptionObject', function () {
    it('should return a getPageEncryptionObject with pieSubscriberID ,pieFormatID, pieIntegrityCheck, pieKeyID, piePhaseID, pieMode', function () {
        var result = new PageEncryptionModel(encryptedData);

        assert.equal(result.pieSubscriberID, '100000000005');
        assert.equal(result.pieFormatID, '64');
        assert.equal(result.pieIntegrityCheck, '9d0796de91411205');
        assert.equal(result.pieKeyID, '4fbd283a');
        assert.equal(result.piePhaseID, '1');
        assert.equal(result.pieMode, 'FPE');
    });
});
