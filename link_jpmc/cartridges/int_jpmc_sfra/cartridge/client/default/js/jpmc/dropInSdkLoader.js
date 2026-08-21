'use strict';

var sdkLoadPromise = null;

/**
 * Loads the Drop-in UI SDK script and resolves with the DropInUI constructor.
 * @param {string} url - Drop-in UI script URL
 * @returns {Promise<Function>} resolves to DropInUI constructor
 */
function loadSdk(url) {
    if (sdkLoadPromise) {
        return sdkLoadPromise;
    }
    sdkLoadPromise = new Promise(function (resolve, reject) {
        if (window.DropInUI) {
            resolve(window.DropInUI);
            return;
        }
        var script = document.createElement('script');
        script.type = 'module';
        script.src = url;
        script.onload = function () {
            var tries = 0;
            (function waitForGlobal() {
                if (window.DropInUI) {
                    resolve(window.DropInUI);
                    return;
                }
                tries++;
                if (tries > 50) {
                    reject(new Error('DropInUI global was not registered'));
                    return;
                }
                setTimeout(waitForGlobal, 100);
            }());
        };
        script.onerror = function () {
            reject(new Error('Failed to load Drop-in UI script: ' + url));
        };
        document.head.appendChild(script);
    });
    return sdkLoadPromise;
}

module.exports = { loadSdk: loadSdk };
