'use strict';
/**
 *
 *
 * @param {*} electronicCheckObject electronicCheckObject
 */
function ElectronicCheckModel(electronicCheckObject) {
    this.ecpCheckRT = electronicCheckObject.ecpCheckRT;
    this.ecpCheckDDA = electronicCheckObject.ecpCheckDDA;
    this.ecpBankAcctType = electronicCheckObject.ecpBankAcctType;
}
// Model gets electronicCheck object as electronicCheckData
ElectronicCheckModel.getElectronicCheckObject = function (electronicCheck) {
    var electronicCheckObject = {};
    electronicCheckObject.ecpCheckRT = electronicCheck.ecpCheckRT.value || '';
    electronicCheckObject.ecpCheckDDA = electronicCheck.ecpCheckDDA.value || '';
    electronicCheckObject.ecpBankAcctType = electronicCheck.ecpBankAcctType.value || '';
    return electronicCheckObject;
};

module.exports = ElectronicCheckModel;
