'use strict';
/**
 * @param {*} ElectronicCheckObject ElectronicCheckObject
 */
function ElectronicCheckModel(ElectronicCheckObject) {
    this.ecpCheckRT = ElectronicCheckObject.ecpCheckRT;
    this.ecpCheckDDA = ElectronicCheckObject.ecpCheckDDA;
    this.ecpBankAcctType = ElectronicCheckObject.ecpBankAcctType;
}

// Model gets card object as cardData
ElectronicCheckModel.getElectronicCheckObject = function (ElectronicCheck) {
    var ElectronicCheckObject = {};
    ElectronicCheckObject.ecpCheckRT = ElectronicCheck.ecpCheckRT.value || '';
    ElectronicCheckObject.ecpCheckDDA = ElectronicCheck.ecpCheckDDA.value || '';
    ElectronicCheckObject.ecpBankAcctType = ElectronicCheck.ecpBankAcctType.value || '';
    return ElectronicCheckObject;
};

module.exports = ElectronicCheckModel;
