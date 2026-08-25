/**
 * JPMC Notifications helper.
 *
 * @module scripts/helpers/JPMCNotificationsHelper
 */

'use strict';

var Logger = require('dw/system/Logger').getLogger('jpmc-notifications', 'poll');

var NOTIFICATION_QUEUE_TYPE = 'JPMCDropInOrdersNotifications';
var STATUS_NEW        = 'NEW';
var STATUS_PROCESSING = 'PROCESSING';
var STATUS_SUCCESS    = 'SUCCESS';
var STATUS_FAILED     = 'FAILED';
var STATUS_ERROR      = 'ERROR';
var STATUS_ACK_FAILED = 'ACK_FAILED';

/**
 * Returns the base SFCC order number from a merchantOrderNumber that may contain
 * an epoch suffix
 *
 * @param {string} merchantOrderNumber - raw merchant order number from JPMC
 * @returns {string} base SFCC order number
 */
function getBaseOrderNo(merchantOrderNumber) {
    var value = String(merchantOrderNumber || '');
    if (!value) {
        return value;
    }

    var hyphenIndex = value.indexOf('-');
    if (hyphenIndex > 0) {
        return value.substring(0, hyphenIndex);
    }

    return value;
}

/**
 * Poll and Process job helper: persists a single notification message to a Custom Object.
 *
 * @param {Object} msg  - raw notification message envelope from the JPMC API
 * @param {Object} opts - optional context; opts.resolvedConfig passed through
 * @returns {{messageId: string, receiptHandle: string}|null} - message info object or null
 */
function storeNotification(msg, opts) {
    if (msg === null || typeof msg === 'undefined') {
        return null;
    }

    var Transaction     = require('dw/system/Transaction');
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');

    var messageInfo = msg.messageInfo || {};
    var messageId   = typeof messageInfo.messageId === 'string' && messageInfo.messageId !== ''
        ? messageInfo.messageId
        : null;

    if (messageId === null) {
        Logger.warn('storeNotification: missing messageInfo.messageId — skipping message');
        return null;
    }

    var merchantOrderNumber = typeof msg.merchantOrderNumber === 'string' ? msg.merchantOrderNumber : null;
    if (!merchantOrderNumber && msg.orderNotification && typeof msg.orderNotification.merchantOrderNumber === 'string') {
        merchantOrderNumber = msg.orderNotification.merchantOrderNumber;
    }
    if (!merchantOrderNumber && msg.tokenNotification && typeof msg.tokenNotification.merchantOrderNumber === 'string') {
        merchantOrderNumber = msg.tokenNotification.merchantOrderNumber;
    }
    if (!merchantOrderNumber && msg.profileNotification && typeof msg.profileNotification.merchantOrderNumber === 'string') {
        merchantOrderNumber = msg.profileNotification.merchantOrderNumber;
    }

    var existingCO = CustomObjectMgr.getCustomObject(NOTIFICATION_QUEUE_TYPE, messageId);
    if (existingCO !== null && typeof existingCO !== 'undefined') {
        Logger.info('storeNotification: messageId={0} already stored (duplicate — skipping create)', messageId);
        return {
            messageId:     messageId,
            receiptHandle: typeof messageInfo.receiptHandle === 'string' ? messageInfo.receiptHandle : ''
        };
    }

    try {
        Transaction.wrap(function () {
            var co = CustomObjectMgr.createCustomObject(NOTIFICATION_QUEUE_TYPE, messageId);
            co.custom.messageId           = messageId;
            co.custom.merchantOrderNumber = merchantOrderNumber !== null ? merchantOrderNumber : '';
            co.custom.status              = STATUS_NEW;
            co.custom.messagePayload      = JSON.stringify(msg);
            co.custom.createdAt           = new Date();
            co.custom.processedAt         = null;
            co.custom.errorMessage        = null;
        });
    } catch (txErr) {
        Logger.error('storeNotification: micro-transaction failed for messageId={0} order={1} — {2}',
            messageId, merchantOrderNumber || '(none)',
            txErr instanceof Error ? txErr.message : String(txErr));
        return null;
    }

    Logger.info('storeNotification: persisted messageId={0} order={1}', messageId, merchantOrderNumber || '(none)');
    return {
        messageId:     messageId,
        receiptHandle: typeof messageInfo.receiptHandle === 'string' ? messageInfo.receiptHandle : ''
    };
}

/**
 * Micro-transaction: updates a single CO's status and errorMessage.
 * Used to flag ACK_FAILED records and store the specific failure reason.
 *
 * @param {string} messageId    - CO key
 * @param {string} newStatus    - one of STATUS_* constants
 * @param {string} errorMessage - failure reason (sanitized, no PII)
 * @private
 */
function updateCOStatus(messageId, newStatus, errorMessage) {
    var Transaction     = require('dw/system/Transaction');
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');

    var co = CustomObjectMgr.getCustomObject(NOTIFICATION_QUEUE_TYPE, messageId);
    if (co === null || typeof co === 'undefined') {
        Logger.warn('updateCOStatus: CO not found for messageId={0}', messageId);
        return;
    }

    Transaction.wrap(function () {
        co.custom.status       = newStatus;
        co.custom.errorMessage = typeof errorMessage === 'string' ? errorMessage : String(errorMessage);
        co.custom.processedAt  = new Date();
    });
}

/**
 * JOB Process Notifications: Processes a queued notification from custom object.
 * Extracts transaction IDs, updates order and customer, then deletes CO on success.
 * Skips failed notifications (status != SUCCESS) - leaves CO for manual review.
 *
 * @param {Object} co - notification queue custom object
 * @returns {boolean} true if successfully processed and custom object deleted
 */
function processQueuedNotification(co) {
    if (!co) {
        return false;
    }

    var Transaction = require('dw/system/Transaction');
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');
    var messageId = co.custom.messageId;
    var msg = null;

    try {
        var payload = co.custom.messagePayload;
        if (!payload) {
            Logger.warn('processQueuedNotification: no messagePayload in CO {0}', messageId);
            try {
                Transaction.wrap(function () {
                    CustomObjectMgr.remove(co);
                });
            } catch (delErr) {
                Logger.warn('processQueuedNotification: failed to delete CO {0}: {1}',
                    messageId, delErr instanceof Error ? delErr.message : String(delErr));
            }
            return false;
        }
        msg = JSON.parse(payload);
    } catch (parseErr) {
        Logger.error('processQueuedNotification: failed to parse payload for {0}: {1}',
            messageId, parseErr instanceof Error ? parseErr.message : String(parseErr));
        try {
            Transaction.wrap(function () {
                CustomObjectMgr.remove(co);
            });
        } catch (delErr) {
            Logger.warn('processQueuedNotification: failed to delete CO {0}: {1}',
                messageId, delErr instanceof Error ? delErr.message : String(delErr));
        }
        return false;
    }

    var isFailed = false;
    if (msg.orderNotification && msg.orderNotification.status === 'STATUS_FAILURE') {
        isFailed = true;
        Logger.warn('processQueuedNotification: skipping FAILED orderNotification {0} (manual review)', messageId);
    }
    if (msg.tokenNotification && msg.tokenNotification.status === 'STATUS_FAILURE') {
        isFailed = true;
        Logger.warn('processQueuedNotification: skipping FAILED tokenNotification {0} (manual review)', messageId);
    }

    if (isFailed) {
        
        try {
            Transaction.wrap(function () {
                co.custom.status = STATUS_FAILED;
                co.custom.errorMessage = 'Notification status is FAILURE - manual review required';
                co.custom.processedAt = new Date();
            });
        } catch (e) {
            Logger.error('processQueuedNotification: failed to mark as FAILED {0}: {1}',
                messageId, e instanceof Error ? e.message : String(e));
        }
        return false;
    }

    
    try {
        Transaction.wrap(function () {
            co.custom.status = STATUS_PROCESSING;
        });
    } catch (e) {
        Logger.error('processQueuedNotification: failed to mark processing {0}: {1}',
            messageId, e instanceof Error ? e.message : String(e));
        return false;
    }

    
    var success = false;
    try {
        success = dispatch(msg);
    } catch (e) {
        Logger.error('processQueuedNotification: dispatch threw for {0}: {1}',
            messageId, e instanceof Error ? e.message : String(e));
        success = false;
    }

    // Update CO status and delete on success only
    try {
        Transaction.wrap(function () {
            if (success) {
                co.custom.status = STATUS_SUCCESS;
                co.custom.processedAt = new Date();
                Logger.info('processQueuedNotification: successfully processed {0}, removing CO', messageId);
                CustomObjectMgr.remove(co);
            } else {
                co.custom.status = STATUS_ERROR;
                co.custom.errorMessage = 'dispatch returned false';
                co.custom.processedAt = new Date();
                Logger.warn('processQueuedNotification: failed to process {0}, keeping CO for retry', messageId);
            }
        });
    } catch (e) {
        Logger.error('processQueuedNotification: failed to finalize {0}: {1}',
            messageId, e instanceof Error ? e.message : String(e));
        return false;
    }

    return success;
}

/**
 * Checks if a messageId has already been processed by scanning order notes.
 * This provides idempotency across multiple notification types (profile, payment, fraud).
 *
 * @param {dw.order.Order} order - SFCC order
 * @param {string} messageId - JPMC notification messageId
 * @returns {boolean} true if this messageId was already processed
 * @private
 */
function isMessageIdProcessed(order, messageId) {
    if (!order || !messageId || messageId === 'unknown') {
        return false;
    }
    
    var notes = order.getNotes().toArray();
    var searchString = 'Message ID: ' + messageId;
    
    for (var i = 0; i < notes.length; i++) {
        var note = notes[i];
        if (note.subject === 'JPMC Order Notification' && note.text && note.text.indexOf(searchString) !== -1) {
            return true; // This messageId was already processed
        }
    }
    
    return false;
}

/**
 * Updates an SFCC order's custom attributes from an order notification message.
 * Uses order notes as idempotency key to prevent duplicate processing.
 *
 * @param {Object} msg - notification message envelope
 * @returns {boolean} true if successfully processed
 * @private
 */
function processOrderNotification(msg) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');
    var Order = require('dw/order/Order');

    var data = (msg && msg.orderNotification) || msg || {};
    var merchantOrderNumber = data.merchantOrderNumber || data.orderNumber;
    var messageId = (msg.messageInfo && msg.messageInfo.messageId) || 'unknown';
    
    if (!merchantOrderNumber) {
        Logger.warn('processOrderNotification: no merchantOrderNumber in payload');
        return false;
    }

    var sfccOrderNo = getBaseOrderNo(merchantOrderNumber);

    var order = OrderMgr.getOrder(sfccOrderNo);
    if (!order) {
        Logger.warn('processOrderNotification: order {0} not found', sfccOrderNo);
        return false;
    }

    // ============ IDEMPOTENCY CHECK ============
    // Check if this exact messageId was already processed to prevent duplicate processing
    if (isMessageIdProcessed(order, messageId)) {
        Logger.info('processOrderNotification: messageId {0} already processed for order {1}, skipping duplicate',
            messageId, sfccOrderNo);
        return true; // Return success to delete the Custom Object
    }

    // Determine the outcome of this notification.
    // JPMC uses responseStatus=SUCCESS for confirmed payments and
    // fraudCheckStatus=FRAUD_CHECK_STATUS_DECLINED for fraud rejections.
    var paymentMethod = data.paymentMethod || {};
    var card = paymentMethod.card || {};
    var networkResponse = card.networkResponse || {};
    var responseStatus = data.responseStatus || data.status || '';
    var fraudCheckStatus = data.fraudCheckStatus || '';
    var isSuccess = responseStatus === 'SUCCESS' || responseStatus === 'STATUS_SUCCESS';
    var isDeclined = fraudCheckStatus === 'FRAUD_CHECK_STATUS_DECLINED'
        || responseStatus === 'ERROR'
        || responseStatus === 'STATUS_FAILED'
        || responseStatus === 'STATUS_FAILURE';

    try {
        Transaction.wrap(function () {
            // Extract transaction reference from orderNotification
            var mitTransactionReference = data.mitTransactionReference;
            var txRef = data.transactionReference;
            var authTimestamp = data.transactionTimestamp
                || (data.threeDomainSecureTransaction && data.threeDomainSecureTransaction.threeDSAuthenticationTimestamp)
                || msg.createdAt
                || null;
            if (txRef) {
                order.custom.jpmcGatewayTransactionId = txRef;
                var instruments = order.getPaymentInstruments().toArray();
                for (var i = 0; i < instruments.length; i++) {
                    var inst = instruments[i];
                    var pt = inst.getPaymentTransaction();
                    if (pt) {
                        pt.setTransactionID(txRef);
                        if (pt.custom) {
                            pt.custom.jpmcAuthorizationId = txRef;
                            if (authTimestamp) {
                                pt.custom.jpmcAuthTimestamp = authTimestamp;
                            }
                        }
                    }
                    if (inst.custom) {
                        inst.custom.jpmcTransactionId = txRef;
                    }
                }
            }
            if (mitTransactionReference) {
                order.custom.mitTransactionReference = mitTransactionReference;
            }

            // Patch billing address from notification if present
            var accountHolder = data.accountHolder || {};
            var notificationBillingAddr = accountHolder.billingAddress;
            if (notificationBillingAddr && typeof notificationBillingAddr === 'object') {
                var billingAddr = order.getBillingAddress();
                if (billingAddr) {
                    // Update billing address fields from notification
                    if (notificationBillingAddr.line1) {
                        billingAddr.setAddress1(notificationBillingAddr.line1);
                    }
                    if (notificationBillingAddr.line2) {
                        billingAddr.setAddress2(notificationBillingAddr.line2);
                    }
                    if (notificationBillingAddr.city) {
                        billingAddr.setCity(notificationBillingAddr.city);
                    }
                    if (notificationBillingAddr.state) {
                        billingAddr.setStateCode(notificationBillingAddr.state);
                    }
                    if (notificationBillingAddr.postalCode) {
                        billingAddr.setPostalCode(notificationBillingAddr.postalCode);
                    }
                    if (notificationBillingAddr.country) {
                        billingAddr.setCountryCode(notificationBillingAddr.country);
                    }
                    if (notificationBillingAddr.phone) {
                        billingAddr.setPhone(notificationBillingAddr.phone);
                    }
                    Logger.debug('processOrderNotification: patched billing address from notification for order {0}', sfccOrderNo);
                }
            }

            // Extract approval code
            var approvalCode = paymentMethod.approvalCode || data.approvalCode;
            if (approvalCode) {
                order.custom.jpmcApprovalCode = approvalCode;
            }

            // Extract AVS and CVV results from card network response
            if (networkResponse) {
                if (networkResponse.addressVerificationResultCode) {
                    order.custom.jpmcAvsResultCode = networkResponse.addressVerificationResultCode;
                    order.custom.jpmcAvsResult = networkResponse.addressVerificationResult || '';
                }
                if (networkResponse.cardVerificationResultCode) {
                    order.custom.jpmcCvvResultCode = networkResponse.cardVerificationResultCode;
                    order.custom.jpmcCvvResult = networkResponse.cardVerificationResult || '';
                }
            }

            // Extract masked PAN
            var maskedAccountNumber = paymentMethod.maskedAccountNumber || data.maskedAccountNumber;
            if (maskedAccountNumber) {
                order.custom.jpmcMaskedPan = maskedAccountNumber;
            }

            // Store 3DS status
            if (data.threeDomainSecureTransaction) {
                var tds = data.threeDomainSecureTransaction;
                if (tds.threeDSTransactionStatus) {
                    order.custom.threeDSTransactionStatus = tds.threeDSTransactionStatus;
                }
                if (tds.threeDSDirectoryServerTransactionId) {
                    order.custom.threeDSTransactionId = tds.threeDSDirectoryServerTransactionId;
                }
                if (tds.threeDomainSecureExemption && tds.threeDomainSecureExemption.authenticationExemptionReason) {
                    order.custom.jpmcThreeDSExemption = tds.threeDomainSecureExemption.authenticationExemptionReason;
                }
            }

            // ============ STATE TRANSITION LOGIC ============
            // Set payment status based on response - use state-aware checks to prevent duplicate actions
            if (isSuccess) {
                // Only update to PAID and call placeOrder if not already done
                var currentPaymentStatus = order.getPaymentStatus().value;
                var currentOrderStatus = order.getStatus().value;
                
                if (currentPaymentStatus !== Order.PAYMENT_STATUS_PAID) {
                    order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                    order.setExportStatus(Order.EXPORT_STATUS_READY);
                    order.custom.pending3DSAuthentication = false;
                    Logger.info('processOrderNotification: order {0} confirmed PAID, set READY for export', sfccOrderNo);
                } else {
                    Logger.debug('processOrderNotification: order {0} already PAID, skipping status update', sfccOrderNo);
                }
                
                // Only place order if still in CREATED state (not yet placed)
                // placeOrder() can only be called once per order - prevents duplicate inventory allocation
                if (currentOrderStatus === Order.ORDER_STATUS_CREATED) {
                    try {
                        OrderMgr.placeOrder(order);
                        Logger.info('processOrderNotification: order {0} placed successfully', sfccOrderNo);
                    } catch (placeErr) {
                        Logger.error('processOrderNotification: failed to place order {0}: {1}',
                            sfccOrderNo, placeErr instanceof Error ? placeErr.message : String(placeErr));
                        // Order remains in CREATED state for manual review
                    }
                } else {
                    Logger.debug('processOrderNotification: order {0} already placed (status={1}), skipping placeOrder',
                        sfccOrderNo, currentOrderStatus);
                }
                
            } else if (isDeclined) {
                // Only fail order if not already failed
                var currentStatus = order.getStatus().value;
                if (currentStatus !== Order.ORDER_STATUS_FAILED && currentStatus !== Order.ORDER_STATUS_CANCELLED) {
                    order.setPaymentStatus(Order.PAYMENT_STATUS_NOTPAID);
                    order.custom.pending3DSAuthentication = false;
                    Logger.warn('processOrderNotification: order {0} declined, failing order', sfccOrderNo);
                    OrderMgr.failOrder(order, true); // Release inventory
                } else {
                    Logger.debug('processOrderNotification: order {0} already failed/cancelled (status={1}), skipping failOrder',
                        sfccOrderNo, currentStatus);
                }
            }

            // Build multi-line order note with essential info
            // NOTE: Order notes serve as the idempotency audit trail - messageId prevents duplicate processing
            var noteLines = [];
            noteLines.push('JPMC Notification (Message ID: ' + messageId + ')');
            noteLines.push('Order: ' + sfccOrderNo + ' | Merchant Order: ' + merchantOrderNumber + ' | Request: ' + (msg.requestId || 'unknown'));
            noteLines.push('Response: ' + (data.responseCode || 'unknown') + ' | Status: ' + (data.status || 'unknown'));
            if (txRef) {
                noteLines.push('Transaction Ref: ' + txRef);
            }
            if (data.threeDomainSecureTransaction && data.threeDomainSecureTransaction.threeDomainSecureExemption) {
                var exemption = data.threeDomainSecureTransaction.threeDomainSecureExemption.authenticationExemptionReason;
                noteLines.push('3DS Exemption: ' + exemption);
            }
            if (order.custom.jpmcAvsResultCode && order.custom.jpmcCvvResultCode) {
                noteLines.push('AVS: ' + order.custom.jpmcAvsResultCode + ' | CVV: ' + order.custom.jpmcCvvResultCode);
            }
            var note = noteLines.join('\n');
            order.addNote('JPMC Order Notification', note);

            Logger.info('processOrderNotification: successfully processed messageId {0} for order {1}',
                messageId, sfccOrderNo);
        });
        return true;
    } catch (e) {
        Logger.error('processOrderNotification: failed for order {0}, messageId {1}: {2}',
            sfccOrderNo, messageId, e instanceof Error ? e.message : String(e));
        return false;
    }
}

/**
 * Logs a token notification. Saved-method updates are handled by the Account Updater
 *
 * SECURITY: Only logs safe metadata - never logs token data, PANs, or PII to comply with PCI-DSS
 *
 * @param {Object} msg - notification message envelope
 * @returns {boolean} true when handled (always true for this stub)
 * @private
 */
function processTokenNotification(msg) {
    var data = msg && msg.tokenNotification;
    if (!data) {
        Logger.info('processTokenNotification: received empty notification');
        return true;
    }
    
    // Log ONLY safe metadata - NO token data, PANs, expiration dates, or PII
    var safeLog = {
        status: data.status || 'unknown',
        tokenType: data.tokenType || 'unknown',
        merchantOrderNumber: data.merchantOrderNumber || 'unknown',
        messageId: (msg.messageInfo && msg.messageInfo.messageId) || 'unknown'
    };
    
    Logger.info('processTokenNotification: received token notification: {0}', JSON.stringify(safeLog));
    return true;
}

/**
 * Processes a profile notification from JPMC.
 * Extracts the profileId and stores it in the customer's profile custom attributes.
 * The profileId is used in subsequent checkout sessions to reference saved payment methods.
 *
 * @param {Object} msg - notification message envelope
 * @returns {boolean} true when successfully processed and stored
 * @private
 */
function processProfileNotification(msg) {
    if (!msg || !msg.profileNotification) {
        return false;
    }

    var profileNotif = msg.profileNotification;
    var profileId = profileNotif.profileId;
    var merchantOrderNumber = profileNotif.merchantOrderNumber;

    if (!profileId) {
        return false;
    }

    Logger.info('processProfileNotification: received profileId={0} for merchantOrderNumber={1}',
        profileId, merchantOrderNumber || 'unknown');

    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');

    var customer = null;
    if (merchantOrderNumber) {
        try {
            var sfccOrderNo = getBaseOrderNo(merchantOrderNumber);
            var order = OrderMgr.getOrder(sfccOrderNo);
            if (order && order.getCustomer && order.getCustomer()) {
                customer = order.getCustomer();
                Logger.debug('processProfileNotification: found customer via order {0} (merchantOrderNumber={1})', sfccOrderNo, merchantOrderNumber);
            }
        } catch (e) {
            Logger.debug('processProfileNotification: could not find customer via order {0}: {1}',
                merchantOrderNumber, e instanceof Error ? e.message : String(e));
        }
    }

    if (!customer) {
        Logger.warn('processProfileNotification: could not identify customer for profileId={0}', profileId);
        return false;
    }

    // Only store profile if notification status is SUCCESS
    var notificationStatus = profileNotif.status || '';
    if (notificationStatus !== 'STATUS_SUCCESS') {
        Logger.warn('processProfileNotification: skipping non-SUCCESS status={0} for profileId={1}',
            notificationStatus, profileId);
        return false;
    }

    try {
        Transaction.wrap(function () {
            if (customer.getProfile()) {
                customer.getProfile().custom.jpmcProfileId = profileId;
            }
        });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Dispatches a single notification message by type.
 *
 * @param {Object} msg - notification message envelope
 * @returns {boolean} true when handled
 * @private
 */
function dispatch(msg) {
    if (!msg) {
        return false;
    }
    if (msg.orderNotification) {
        return processOrderNotification(msg);
    }
    if (msg.tokenNotification) {
        return processTokenNotification(msg);
    }
    if (msg.profileNotification) {
        return processProfileNotification(msg);
    }
    var type = msg.type || msg.notificationType;
    if (type === 'orderNotification') {
        return processOrderNotification(msg);
    }
    if (type === 'tokenNotification') {
        return processTokenNotification(msg);
    }
    if (type === 'profileNotification') {
        return processProfileNotification(msg);
    }
    Logger.warn('dispatch: unknown notification type');
    return false;
}

/**
 * Polls notifications for the given window, persists each message
 * to a CO (one micro-transaction per record), then batch-ACKs the page.
 *
 * Guarantees:
 *   - Idempotent CO creation (getCustomObject check before createCustomObject).
 *   - Per-message micro-transactions.
 *   - Batch ACK per page (fewer HTTP calls).
 *   - Partial ACK failures flagged on individual COs as ACK_FAILED .
 *   - Transient HTTP errors (502/503/504) bubble up so the job exits immediately
 *
 * @param {Object} options - polling options
 * @param {Object} options.resolvedConfig - resolved merchant config
 * @param {string} options.periodStart    - ISO 8601 window start
 * @param {string} options.periodEnd      - ISO 8601 window end
 * @param {number} [options.maxIterations=50] - pagination safety cap
 * @returns {{
 *   success: boolean,
 *   transientError: boolean,
 *   stored: number,
 *   acked: number,
 *   ackFailed: number,
 *   skipped: number,
 *   storeErrors: number,
 *   pages: number,
 *   error: ?string
 * }} polling results summary
 * }}
 */
function pollAndProcess(options) {
    var JPMCNotificationsService = require('*/cartridge/scripts/services/JPMCNotificationsService');

    var opts = options !== null && typeof options === 'object' ? options : {};

    var resolvedConfig  = opts.resolvedConfig  !== null && typeof opts.resolvedConfig  !== 'undefined'  ? opts.resolvedConfig  : null;
    var periodStartIso  = typeof opts.periodStart === 'string' && opts.periodStart !== '' ? opts.periodStart : null;
    var periodEndIso    = typeof opts.periodEnd   === 'string' && opts.periodEnd   !== '' ? opts.periodEnd   : null;
    var maxIterations   = typeof opts.maxIterations === 'number' && opts.maxIterations > 0 ? opts.maxIterations : 50;

    var summary = {
        success:        false,
        transientError: false,
        stored:         0,
        acked:          0,
        ackFailed:      0,
        skipped:        0,
        storeErrors:    0,
        pages:          0,
        error:          null
    };

    if (periodStartIso === null || periodEndIso === null) {
        summary.error = 'pollAndProcess: periodStart and periodEnd are required';
        Logger.error(summary.error);
        return summary;
    }

    var pageToken = null;

    for (var pageIdx = 0; pageIdx < maxIterations; pageIdx++) {
        summary.pages++;

        var receiveOpts = {
            periodStart:    periodStartIso,
            periodEnd:      periodEndIso,
            resolvedConfig: resolvedConfig
        };
        if (pageToken !== null && typeof pageToken === 'string' && pageToken !== '') {
            receiveOpts.pageToken = pageToken;
        }

        var receiveResult = JPMCNotificationsService.receive(receiveOpts);

        if (receiveResult.transientError === true) {
            summary.transientError = true;
            summary.error = 'Transient HTTP error on receive (page ' + pageIdx + '): ' + (receiveResult.error || 'unknown');
            Logger.error('pollAndProcess: {0}', summary.error);
            return summary;
        }

        if (!receiveResult.success) {
            summary.error = 'receive() failed on page ' + pageIdx + ': ' + (receiveResult.error || 'unknown');
            Logger.error('pollAndProcess: {0}', summary.error);
            return summary;
        }

        var messages = Array.isArray(receiveResult.messages) ? receiveResult.messages : [];
        if (messages.length === 0) {
            Logger.info('pollAndProcess: empty page at index {0} — pagination complete', pageIdx);
            break;
        }

        Logger.info('pollAndProcess: page {0} — {1} messages received', pageIdx, messages.length);

      
        var pageMessageInfos = []; 

        for (var msgIdx = 0; msgIdx < messages.length; msgIdx++) {
            var msg = messages[msgIdx];
            if (msg === null || typeof msg === 'undefined') {
                summary.skipped++;
                Logger.warn('pollAndProcess: null/undefined message at page={0} idx={1} — skipping', pageIdx, msgIdx);
                continue;
            }

            var messageInfo = storeNotification(msg, { resolvedConfig: resolvedConfig });
            if (messageInfo !== null && typeof messageInfo !== 'undefined') {
                pageMessageInfos.push(messageInfo);
                summary.stored++;
            } else {
                summary.storeErrors++;
                Logger.warn('pollAndProcess: storeNotification failed at page={0} idx={1}', pageIdx, msgIdx);
            }
        }

       
        if (pageMessageInfos.length > 0) {
            var ackResult = JPMCNotificationsService.acknowledge(
                { messageInfos: pageMessageInfos },
                { resolvedConfig: resolvedConfig }
            );

        
            if (ackResult.transientError === true) {
                summary.transientError = true;
                summary.error = 'Transient HTTP error on acknowledge (page ' + pageIdx + '): ' + (ackResult.error || 'unknown');
                Logger.error('pollAndProcess: {0}', summary.error);
                return summary;
            }

            if (!ackResult.success) {
                summary.error = 'acknowledge() failed on page ' + pageIdx + ': ' + (ackResult.error || 'unknown');
                Logger.error('pollAndProcess: {0}', summary.error);
                return summary;
            }

           
            var ackFailedMessages = (ackResult.data !== null && typeof ackResult.data === 'object'
                && Array.isArray(ackResult.data.ackFailedMessages))
                ? ackResult.data.ackFailedMessages
                : [];

            if (ackFailedMessages.length > 0) {
                var failedIdSet = {};
                for (var fi = 0; fi < ackFailedMessages.length; fi++) {
                    var failedEntry = ackFailedMessages[fi];
                    if (failedEntry !== null && typeof failedEntry === 'object'
                            && typeof failedEntry.messageId === 'string') {
                        failedIdSet[failedEntry.messageId] = failedEntry.receiptHandle || '';
                    }
                }

                for (var pi = 0; pi < pageMessageInfos.length; pi++) {
                    var pInfo = pageMessageInfos[pi];
                    if (typeof failedIdSet[pInfo.messageId] !== 'undefined') {
                        updateCOStatus(
                            pInfo.messageId,
                            STATUS_ACK_FAILED,
                            'ACK rejected by JPMC API for receiptHandle=' + pInfo.receiptHandle
                        );
                        summary.ackFailed++;
                        Logger.warn('pollAndProcess: ACK_FAILED for messageId={0}', pInfo.messageId);
                    } else {
                        summary.acked++;
                    }
                }
            } else {
                summary.acked += pageMessageInfos.length;
            }

            Logger.info('pollAndProcess: page {0} complete — acked={1} ackFailed={2}',
                pageIdx, summary.acked, summary.ackFailed);
        } else {
            Logger.info('pollAndProcess: page {0} — no messages to ACK (all stores failed)', pageIdx);
        }

        // --- Advance to next page ---
        pageToken = typeof receiveResult.nextPageToken === 'string' && receiveResult.nextPageToken !== ''
            ? receiveResult.nextPageToken
            : null;

        if (pageToken === null) {
            Logger.info('pollAndProcess: no nextPageToken — pagination complete after {0} pages', pageIdx + 1);
            break;
        }
    }

    summary.success = true;
    Logger.info(
        'pollAndProcess: complete — pages={0} stored={1} acked={2} ackFailed={3} storeErrors={4} skipped={5}',
        summary.pages, summary.stored, summary.acked, summary.ackFailed, summary.storeErrors, summary.skipped
    );
    return summary;
}

module.exports = {
    storeNotification:         storeNotification,
    pollAndProcess:            pollAndProcess,
    processQueuedNotification: processQueuedNotification,
    dispatch:                  dispatch,
    NOTIFICATION_QUEUE_TYPE:   NOTIFICATION_QUEUE_TYPE,
    STATUS_NEW:                STATUS_NEW,
    STATUS_PROCESSING:         STATUS_PROCESSING,
    STATUS_SUCCESS:            STATUS_SUCCESS,
    STATUS_ERROR:              STATUS_ERROR,
    STATUS_FAILED:             STATUS_FAILED,
    STATUS_ACK_FAILED:         STATUS_ACK_FAILED
};
