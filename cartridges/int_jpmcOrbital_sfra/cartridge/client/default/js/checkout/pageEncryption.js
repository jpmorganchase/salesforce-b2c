/* eslint-disable new-cap */
/* eslint-disable no-undef */
'use strict';

/**
 * @function updateEncryptedData
 */
function updateEncryptedData() {
    var cardNumber = $('.cardNumber:enabled').val().replace(/ /g, '');
    var securityCode = $('.securityCode:enabled').val();

    if (cardNumber && securityCode && ValidatePANChecksum(cardNumber)) {
        var encryptedData = ProtectPANandCVV(cardNumber, securityCode, true);

        if (encryptedData) {
            encryptedData.push(PIE.key_id);
            encryptedData.push(PIE.phase);
            $('.encryptedData:enabled').val(JSON.stringify(encryptedData));
        }
    }
}

/**
 * @function pageEncryption
 */
function pageEncryption() {
    if ($('.encryptedData').length !== 0) {
        $('.cardNumber').on('change', function () {
            updateEncryptedData();
        });
        $('.securityCode').on('change', function () {
            updateEncryptedData();
        });
    }
}

module.exports.pageEncryption = pageEncryption;
