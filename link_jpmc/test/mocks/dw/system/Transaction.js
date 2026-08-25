'use strict';

/**
 * Mock for dw.system.Transaction
 */
var inTransaction = false;
var wrapSpy = null;

function Transaction() {}

// Allow wrap to be replaced with a spy while maintaining functionality
var originalWrap = function (callback) {
    inTransaction = true;
    try {
        var result = callback();
        inTransaction = false;
        return result;
    } catch (e) {
        inTransaction = false;
        throw e;
    }
};

Transaction.wrap = originalWrap;

Transaction.begin = function () {
    inTransaction = true;
};

Transaction.commit = function () {
    inTransaction = false;
};

Transaction.rollback = function () {
    inTransaction = false;
};

/**
 * Helper to check if in transaction
 */
Transaction.isInTransaction = function () {
    return inTransaction;
};

/**
 * Helper to reset transaction state
 */
Transaction.reset = function () {
    inTransaction = false;
    Transaction.wrap = originalWrap;
};

module.exports = Transaction;
