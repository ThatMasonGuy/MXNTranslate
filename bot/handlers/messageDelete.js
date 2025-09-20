const db = require('../db');

function markDeleted(msg) {
  db.prepare(`UPDATE messages SET deleted = 1 WHERE id = ?`).run(msg.id);
}

module.exports = markDeleted;
