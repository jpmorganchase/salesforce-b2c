/**
 * Job to process queued JPMC notifications from custom objects.
 * Intended to run every few minutes to asynchronously update orders
 * with payment confirmation data from JPMC.
 *
 * @module scripts/jobs/processJPMCNotificationQueue
 */

'use strict';

var Logger = require('dw/system/Logger').getLogger('jpmc-notifications', 'queue');
var Status = require('dw/system/Status');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var JPMCNotificationsHelper = require('*/cartridge/scripts/helpers/JPMCNotificationsHelper');

/**
 * Process queued notifications from custom objects.
 * @param {Object} params - job parameters (unused)
 * @returns {dw.system.Status} job completion status
 */
function processNotificationQueue(params) {
    var QUEUE_TYPE     = JPMCNotificationsHelper.NOTIFICATION_QUEUE_TYPE;
    var STATUS_NEW     = JPMCNotificationsHelper.STATUS_NEW;
    var STATUS_ERROR   = JPMCNotificationsHelper.STATUS_ERROR;
    var STATUS_ACK_FAILED = JPMCNotificationsHelper.STATUS_ACK_FAILED;

    var summary = {
        queried:    0,
        processed:  0,
        successful: 0,
        failed:     0,
        error:      null
    };

    var query = null;
    try {
        // Query for NEW, ERROR, and ACK_FAILED notifications ordered by creation date (oldest first)
        // ACK_FAILED are retried in case the API becomes available again
        var queryString = '(custom.status = {0} OR custom.status = {1} OR custom.status = {2})';
        var sortString = 'creationDate asc';
        query = CustomObjectMgr.queryCustomObjects(
            QUEUE_TYPE, queryString, sortString,
            STATUS_NEW, STATUS_ERROR, STATUS_ACK_FAILED
        );

        summary.queried = query.getCount();
        Logger.info('processNotificationQueue: found {0} pending COs (NEW + ERROR + ACK_FAILED)', summary.queried);

        while (query.hasNext()) {
            var co = query.next();
            summary.processed++;
            try {
                var success = JPMCNotificationsHelper.processQueuedNotification(co);
                if (success) {
                    summary.successful++;
                } else {
                    summary.failed++;
                }
            } catch (coErr) {
                Logger.error('processNotificationQueue: unhandled error on CO — {0}',
                    coErr instanceof Error ? coErr.message : String(coErr));
                summary.failed++;
            }
        }

        Logger.info('processNotificationQueue: done — queried={0} successful={1} failed={2}',
            summary.processed, summary.successful, summary.failed);
        return new Status(Status.OK, 'OK', JSON.stringify(summary));

    } catch (e) {
        summary.error = e instanceof Error ? e.message : String(e);
        Logger.error('processNotificationQueue: job failed — {0}', summary.error);
        return new Status(Status.ERROR, 'ERROR', JSON.stringify(summary));

    } finally {
        // CRITICAL: Always close the iterator to prevent quota violations
        if (query !== null && typeof query.close === 'function') {
            try {
                query.close();
                Logger.debug('processNotificationQueue: iterator closed successfully');
            } catch (closeErr) {
                Logger.warn('processNotificationQueue: failed to close iterator: {0}',
                    closeErr instanceof Error ? closeErr.message : String(closeErr));
            }
        }
    }
}

/**
 * Entry point for SFCC job scheduler.
 * @param {Object} parameters - job parameters (currently unused)
 * @returns {dw.system.Status} job completion status
 */
exports.execute = function (parameters) {
    return processNotificationQueue(parameters);
};

module.exports = {
    execute: exports.execute,
    processNotificationQueue: processNotificationQueue
};
