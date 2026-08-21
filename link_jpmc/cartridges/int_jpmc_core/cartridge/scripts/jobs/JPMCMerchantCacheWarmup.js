'use strict';

var Status = require('dw/system/Status');

/**
 * Job step entry point.
 *
 * @param {Object} parameters    - BM job step parameters
 * @param {dw.job.JobStepExecution} stepExecution - Execution context
 * @returns {dw.system.Status} result
 */
exports.execute = function (parameters, stepExecution) { // eslint-disable-line no-unused-vars
    try {
        var Site = require('dw/system/Site');
        var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

        var site = Site.getCurrent();
        var siteId = site.getID();
        var allowedLocales = site.getAllowedLocales();

        var localeCount = allowedLocales ? allowedLocales.size() : 0;

        var warmedLocales = 0;
        var errors = 0;

        if (localeCount > 0) {
            for (var i = 0; i < localeCount; i++) {
                var locale = allowedLocales[i];
                try {
                    JPMCMerchantResolver.resolve({ siteId: siteId, locale: locale });
                    warmedLocales++;
                } catch (localeErr) {
                    errors++;
                }
            }
        }

        try {
            JPMCMerchantResolver.resolve({ siteId: siteId, locale: '' });
        } catch (defaultErr) {
            errors++;
        }

        if (errors > 0 && warmedLocales === 0) {
            return new Status(Status.ERROR, 'ERROR', 'All cache warmup attempts failed for site ' + siteId);
        }

        return new Status(Status.OK, 'OK',
            'Cache warmed for ' + warmedLocales + ' locale(s) on site ' + siteId
        );

    } catch (e) {
        return new Status(Status.ERROR, 'ERROR', e.message || String(e));
    }
};
