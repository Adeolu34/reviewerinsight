const Book = require('../models/Book');

let currentIssueNumber = 48; // Starting from existing data

/**
 * Get the current issue string.
 */
function getCurrentIssue() {
  return `No. ${String(currentIssueNumber).padStart(3, '0')}`;
}

/**
 * Increment issue number (call weekly).
 */
function nextIssue() {
  currentIssueNumber += 1;
  return getCurrentIssue();
}

/**
 * Initialize issue tracker from the database.
 */
async function initIssueTracker() {
  const latest = await Book.findOne({ issue: { $exists: true } })
    .sort({ createdAt: -1 })
    .select('issue')
    .lean();

  if (latest?.issue) {
    const match = latest.issue.match(/(\d+)/);
    if (match) currentIssueNumber = parseInt(match[1], 10);
  }
}

module.exports = { getCurrentIssue, nextIssue, initIssueTracker };
