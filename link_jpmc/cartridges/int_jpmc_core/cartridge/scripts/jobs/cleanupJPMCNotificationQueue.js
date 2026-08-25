/**
 * Job: purge stale JPMC notification queue records that retain sensitive payloads.
 *
 * FAILED/ERROR/ACK_FAILED notifications are intentionally retained (for manual
 * review or retry), so their raw `messagePayload` — which can hold an acquirer
 * token, card expiry, and cardholder PII — lingers at rest. This job removes those
 * records once they are older than the configured retention window (LOW-01
 * remediation). SUCCESS records are already deleted by the queue processor.
 *
 * @module scripts/jobs/cleanupJPMCNotificationQueue
 */

'use strict';

var Logger = require('dw/system/Logger').getLogger('jpmc-notifications', 'cleanup');
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var JPMCNotificationsHelper = require('*/cartridge/scripts/helpers/JPMCNotificationsHelper');

var DEFAULT_RETENTION_DAYS = 30;
var MS_PER_DAY = 24 * 60 * 60 * 1000;
var MAX_REMOVALS_PER_RUN = 1000; // safety cap to bound a single job run

/**
 * Resolves the retention window (days) from job parameters, tolerating both the
 * HashMap the scheduler passes and a plain object, and falling back to the default.
 *
 * @param {Object} parameters - job parameters
 * @returns {number} retention window in whole days (>= 0)
 */
function resolveRetentionDays(parameters) {
    var raw = null;
    if (parameters) {
        if (typeof parameters.get === 'function') {
            raw = parameters.get('retentionDays');
        } else if (typeof parameters.retentionDays !== 'undefined') {
            raw = parameters.retentionDays;
        }
    }

    if (raw === null || typeof raw === 'undefined' || raw === '') {
        return DEFAULT_RETENTION_DAYS;
    }

    var parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 0) {
        Logger.warn('cleanupNotificationQueue: invalid retentionDays "{0}" — using default {1}',
            String(raw), DEFAULT_RETENTION_DAYS);
        return DEFAULT_RETENTION_DAYS;
    }
    return parsed;
}

/**
 * Removes FAILED/ERROR/ACK_FAILED notification records older than the retention window.
 *
 * @param {Object} parameters - job parameters (retentionDays)
 * @returns {dw.system.Status} job completion status
 */
function cleanupNotificationQueue(parameters) {
    var QUEUE_TYPE        = JPMCNotificationsHelper.NOTIFICATION_QUEUE_TYPE;
    var STATUS_FAILED     = JPMCNotificationsHelper.STATUS_FAILED;
    var STATUS_ERROR      = JPMCNotificationsHelper.STATUS_ERROR;
    var STATUS_ACK_FAILED = JPMCNotificationsHelper.STATUS_ACK_FAILED;

    var retentionDays = resolveRetentionDays(parameters);
    var cutoff = new Date(Date.now() - (retentionDays * MS_PER_DAY));

    var summary = {
        retentionDays: retentionDays,
        cutoff:        cutoff.toISOString(),
        queried:       0,
        removed:       0,
        failed:        0,
        error:         null
    };

    // Collect keys first, then delete — removing objects mid-iteration can
    // invalidate the query result set.
    var staleIds = [];
    var query = null;
    try {
        var queryString = '(custom.status = {0} OR custom.status = {1} OR custom.status = {2}) AND creationDate < {3}';
        query = CustomObjectMgr.queryCustomObjects(
            QUEUE_TYPE, queryString, 'creationDate asc',
            STATUS_FAILED, STATUS_ERROR, STATUS_ACK_FAILED, cutoff
        );
        summary.queried = query.getCount();
        Logger.info('cleanupNotificationQueue: {0} stale COs (FAILED/ERROR/ACK_FAILED older than {1}d, cutoff {2})',
            summary.queried, retentionDays, summary.cutoff);

        while (query.hasNext() && staleIds.length < MAX_REMOVALS_PER_RUN) {
            staleIds.push(query.next().custom.messageId);
        }
    } catch (e) {
        summary.error = e instanceof Error ? e.message : String(e);
        Logger.error('cleanupNotificationQueue: query failed — {0}', summary.error);
        return new Status(Status.ERROR, 'ERROR', JSON.stringify(summary));
    } finally {
        // CRITICAL: always close the iterator to prevent quota violations.
        if (query !== null && typeof query.close === 'function') {
            try {
                query.close();
            } catch (closeErr) {
                Logger.warn('cleanupNotificationQueue: failed to close iterator: {0}',
                    closeErr instanceof Error ? closeErr.message : String(closeErr));
            }
        }
    }

    staleIds.forEach(function (messageId) {
        try {
            Transaction.wrap(function () {
                var co = CustomObjectMgr.getCustomObject(QUEUE_TYPE, messageId);
                if (co !== null && typeof co !== 'undefined') {
                    CustomObjectMgr.remove(co);
                }
            });
            summary.removed++;
        } catch (rmErr) {
            summary.failed++;
            Logger.error('cleanupNotificationQueue: failed to remove CO {0}: {1}',
                messageId, rmErr instanceof Error ? rmErr.message : String(rmErr));
        }
    });

    Logger.info('cleanupNotificationQueue: done — queried={0} removed={1} failed={2}',
        summary.queried, summary.removed, summary.failed);
    return new Status(Status.OK, 'OK', JSON.stringify(summary));
}

/**
 * Entry point for the SFCC job scheduler.
 *
 * @param {Object} parameters - job parameters
 * @returns {dw.system.Status} job completion status
 */
exports.execute = function (parameters) {
    return cleanupNotificationQueue(parameters);
};

module.exports = {
    execute: exports.execute,
    cleanupNotificationQueue: cleanupNotificationQueue
};
