'use strict';

var Status      = require('dw/system/Status');
var Logger      = require('dw/system/Logger').getLogger('jpmc-notifications', 'poll');
var Site        = require('dw/system/Site');
var Transaction = require('dw/system/Transaction');


var DEFAULT_FIRST_RUN_HOURS       = 24; // How far back to look on first run
var DEFAULT_OVERLAP_MINUTES       = 5;  // Overlap subtracted from lastSync to handle latency
var DEFAULT_SAFETY_BUFFER_MINUTES = 0;  // Minimum gap between periodEnd and now (0 = immediate coverage)
var DEFAULT_MAX_ITERATIONS        = 50; // Pagination safety cap to avoid infinite loops in case of a bug on JPMC's side

/**
 * Formats a JS Date to strict ISO-8601 UTC.
 * Output example: '2023-04-05T00:00:00.000Z'
 *
 * @param {Date} date - native JS Date
 * @returns {string} ISO-8601 UTC string
 */
function toISO8601UTC(date) {
    try {
        if (!date) { return String(date); }
        var d = (date instanceof Date) ? date : new Date(date);
        if (isNaN(d.getTime())) { return String(date); }
        return d.toISOString();
    } catch (e) {
        return String(date);
    }
}

/**
 * Calculates the notification polling window.
 *
 * @param {Object} options - window calculation options
 * @param {Date} options.now - current server time
 * @param {Date} [options.lastSync] - last sync cursor (null on first run)
 * @param {number} [options.firstRunHours=24] - hours to look back on first run
 * @param {number} [options.overlapMinutes=5] - overlap to apply to lastSync
 * @param {number} [options.safetyBufferMinutes=0] - gap before now (0 = immediate coverage)
 * @returns {{startStr: string, endStr: string, actualEndDate: Date} | null}
 *   Returns null if window is invalid (endDate <= startDate)
 */
function calculateSyncWindow(options) {
    var opts = options || {};
    var now = opts.now instanceof Date ? opts.now : new Date();
    var lastSync = opts.lastSync instanceof Date ? opts.lastSync : null;
    var firstRunHours = typeof opts.firstRunHours === 'number' ? opts.firstRunHours : DEFAULT_FIRST_RUN_HOURS;
    var overlapMinutes = typeof opts.overlapMinutes === 'number' ? opts.overlapMinutes : DEFAULT_OVERLAP_MINUTES;
    var safetyBufferMinutes = typeof opts.safetyBufferMinutes === 'number' ? opts.safetyBufferMinutes : DEFAULT_SAFETY_BUFFER_MINUTES;

    var periodStartDate;
    if (lastSync === null || typeof lastSync === 'undefined') {
        periodStartDate = new Date(now.getTime() - (firstRunHours * 60 * 60 * 1000));
        Logger.info('calculateSyncWindow: first run — periodStart set to {0}h ago = {1}', firstRunHours, toISO8601UTC(periodStartDate));
    } else {
        periodStartDate = new Date(lastSync.getTime() - (overlapMinutes * 60 * 1000));
        Logger.info('calculateSyncWindow: window overlap={0}min applied — periodStart={1}', overlapMinutes, toISO8601UTC(periodStartDate));
    }

    var periodEndDate = new Date(now.getTime() - (safetyBufferMinutes * 60 * 1000));

    Logger.info('calculateSyncWindow: periodEnd = now - {0}min = {1}', safetyBufferMinutes, toISO8601UTC(periodEndDate));

    if (periodEndDate.getTime() <= periodStartDate.getTime()) {
        Logger.info('calculateSyncWindow: invalid window — endDate <= startDate. Job ran too recently.');
        return null;
    }

    var startStr = toISO8601UTC(periodStartDate);
    var endStr = toISO8601UTC(periodEndDate);

    Logger.info('calculateSyncWindow: final window — start={0} end={1} (duration ~{2}min)', 
        startStr, endStr, Math.round((periodEndDate.getTime() - periodStartDate.getTime()) / 60000));

    return {
        startStr: startStr,
        endStr: endStr,
        actualEndDate: periodEndDate
    };
}




/**
 * Job step entry point
 *
 * @param {Object} parameters - job parameters from BM configuration
 * @returns {dw.system.Status} job step outcome
 */
exports.execute = function (parameters) {
    var JPMCNotificationsHelper = require('*/cartridge/scripts/helpers/JPMCNotificationsHelper');
    var JPMCMerchantResolver = require('*/cartridge/scripts/helpers/JPMCMerchantResolver');

    var overlapMinutes       = DEFAULT_OVERLAP_MINUTES;
    var safetyBufferMinutes  = DEFAULT_SAFETY_BUFFER_MINUTES;
    var maxIterations        = DEFAULT_MAX_ITERATIONS;
    var firstRunHours        = DEFAULT_FIRST_RUN_HOURS;

    Logger.info(
        'JPMCNotificationsPoll: starting — overlap={0}min buffer={1}min maxPages={2} firstRun={3}h',
        overlapMinutes, safetyBufferMinutes, maxIterations, firstRunHours
    );

    try {
        // Merchant config will be resolved per-locale later; no global resolve needed here.

        var site = Site.getCurrent();
        var now  = new Date();

        Logger.info('JPMCNotificationsPoll: now={0}', toISO8601UTC(now));

        var lastSync = site.getCustomPreferenceValue('JPMC_LastSyncPeriodEnd');

        // Log lastSync in ISO format for diagnostics (not just toString() which shows local time)
        if (lastSync !== null && typeof lastSync !== 'undefined') {
            Logger.info('JPMCNotificationsPoll: lastSync (JPMC_LastSyncPeriodEnd) retrieved as ISO={0}', toISO8601UTC(lastSync));
        }

        if (lastSync instanceof Date && lastSync.getTime() > now.getTime()) {
            Logger.warn(
                'JPMCNotificationsPoll: JPMC_LastSyncPeriodEnd ({0}) is in the future — resetting to null',
                toISO8601UTC(lastSync)
            );
            lastSync = null;
        }

        // Calculate the polling window (simplified: no chunking, immediate to-now coverage)
        var windowResult = calculateSyncWindow({
            now: now,
            lastSync: lastSync,
            firstRunHours: firstRunHours,
            overlapMinutes: overlapMinutes,
            safetyBufferMinutes: safetyBufferMinutes
        });

        if (windowResult === null) {
            var skipMsg = 'JPMCNotificationsPoll: no polling window — job ran too recently. Retry on next cycle.';
            Logger.info(skipMsg);
            return new Status(Status.OK, 'OK', skipMsg);
        }

        var periodStartIso = windowResult.startStr;
        var periodEndIso   = windowResult.endStr;
        var periodEndDate  = windowResult.actualEndDate;

        var aggregated = {
            stored: 0,
            acked: 0,
            ackFailed: 0,
            skipped: 0,
            storeErrors: 0,
            pages: 0,
            success: true,
            transientError: false,
            error: null
        };
        var localesToCheck = [];
        try {
            var allowed = site.getAllowedLocales ? site.getAllowedLocales() : null;
            if (allowed && typeof allowed.iterator === 'function') {
                var it = allowed.iterator();
                while (it.hasNext()) {
                    var loc = it.next();
                    try { localesToCheck.push(String(loc)); } catch (e) { /* ignore */ }
                }
            }
        } catch (e) {
            localesToCheck = [];
        }
        if (!localesToCheck || localesToCheck.length === 0) { localesToCheck = [null]; }

        localesToCheck.forEach(function (locale) {
            if (aggregated.transientError === true) { return; }

            var cfg = null;
            try {
                cfg = locale ? JPMCMerchantResolver.resolve({ locale: locale }) : JPMCMerchantResolver.resolve();
            } catch (e) {
                Logger.warn('JPMCNotificationsPoll: failed to resolve merchant config for locale {0}: {1}', locale || '(default)',
                    e instanceof Error ? e.message : String(e));
                return;
            }

            if (!cfg) {
                Logger.info('JPMCNotificationsPoll: no merchant config for locale {0} — skipping', locale || '(default)');
                return;
            }

            var checkoutMode = cfg && (cfg.checkoutMode || (typeof cfg.getCheckoutMode === 'function' ? cfg.getCheckoutMode() : null));
            if (!checkoutMode || String(checkoutMode).toUpperCase() !== 'DROP_IN') {
                Logger.info('JPMCNotificationsPoll: locale {0} is not Drop-in (mode={1}) — skipping', locale || '(default)', checkoutMode);
                return;
            }

            Logger.info('JPMCNotificationsPoll: polling notifications for locale {0}', locale || '(default)');

            var summary = JPMCNotificationsHelper.pollAndProcess({
                resolvedConfig: cfg,
                periodStart:    periodStartIso,
                periodEnd:      periodEndIso,
                maxIterations:  maxIterations
            });

            if (!summary) { return; }

            aggregated.stored += summary.stored || 0;
            aggregated.acked += summary.acked || 0;
            aggregated.ackFailed += summary.ackFailed || 0;
            aggregated.skipped += summary.skipped || 0;
            aggregated.storeErrors += summary.storeErrors || 0;
            aggregated.pages += summary.pages || 0;

            if (summary.transientError === true) {
                aggregated.transientError = true;
                aggregated.error = summary.error || 'transient';
                aggregated.success = false;
            }
            if (summary.success !== true) {
                aggregated.success = false;
                aggregated.error = aggregated.error || summary.error || 'partial-failure';
            }
        });

        var statusMsg = 'JPMCNotificationsPoll: aggregated stored=' + aggregated.stored
            + ' acked=' + aggregated.acked
            + ' ackFailed=' + aggregated.ackFailed
            + ' skipped=' + aggregated.skipped
            + ' storeErrors=' + aggregated.storeErrors
            + ' pages=' + aggregated.pages
            + ' window=[' + periodStartIso + ',' + periodEndIso + ']';

        if (aggregated.transientError === true) {
            // Transient HTTP error (502/503/504): do NOT advance state cursor.
            // Let the platform scheduler retry on the next cron tick.
            Logger.error('JPMCNotificationsPoll: transient service error — {0}', aggregated.error);
            return new Status(Status.ERROR, 'TRANSIENT_ERROR', statusMsg + ', transientError=' + aggregated.error);
        }

        if (aggregated.success !== true) {
            Logger.error('JPMCNotificationsPoll: poll failed — {0}', aggregated.error || 'unknown');
            return new Status(Status.ERROR, 'ERROR', statusMsg + ', error=' + (aggregated.error || 'unknown'));
        }

        // Advance state cursor ONLY after full success (fetch + persist + ACK all pages)
        Transaction.wrap(function () {
            site.setCustomPreferenceValue('JPMC_LastSyncPeriodEnd', periodEndDate);
        });

        Logger.info('JPMCNotificationsPoll: cursor ADVANCED to {0}', toISO8601UTC(periodEndDate));
        Logger.info('JPMCNotificationsPoll: COMPLETE — {0}', statusMsg);
        return new Status(Status.OK, 'OK', statusMsg);

    } catch (e) {
        var errMsg = e instanceof Error ? e.message : String(e);
        Logger.error('JPMCNotificationsPoll: unhandled exception — {0}', errMsg);
        return new Status(Status.ERROR, 'ERROR', 'Unhandled exception: ' + errMsg);
    }
};
