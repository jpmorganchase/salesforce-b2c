const assert = require('assert');

var eCheck = {
    ecpCheckRT: { value: '122000247' },
    ecpCheckDDA: { value: '0888271156' },
    ecpBankAcctType: { value: 'c' }
};


var ElectronicCheck = require('../../../../mocks/jpmcModelsMocks/jpmcElectronicCheckModelMock.test');

describe('getElectronicCheckObjectForCredit', function () {
    it('should return a ElectronicCheckObject', function () {
        var result = new ElectronicCheck(ElectronicCheck.getElectronicCheckObject(eCheck));
        assert.equal(result.ecpCheckRT, '122000247');
        assert.equal(result.ecpCheckDDA, '0888271156');
        assert.equal(result.ecpBankAcctType, 'c');
    });
});

