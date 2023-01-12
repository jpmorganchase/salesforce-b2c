'use strict';

var ISML = require('dw/template/ISML');
var Logger = require('dw/system/Logger');

/**
 * @param {Object} params Parameters from the template
 */
function htmlHead(params) {
    var templateName = 'hooks/afterHead';
    try {
        ISML.renderTemplate(templateName, params);
    } catch (e) {
        Logger.error('Error while rendering template ' + templateName);
    }
}

exports.htmlHead = htmlHead;
