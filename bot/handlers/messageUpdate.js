const db = require('../db');

function logEdit(oldMsg, newMsg) {
  // Only log if content actually changed and was previously cached
  if (!oldMsg.content || oldMsg.content === newMsg.content) return;

  // Insert edit history
  db.prepare(`
    INSERT INTO message_edits (message_id, old_content, new_content, edited_timestamp)
    VALUES (?, ?, ?, ?)
  `).run(
    newMsg.id,
    oldMsg.content,
    newMsg.content,
    new Date().toISOString()
  );

  // Update messages table with latest
  db.prepare(`
    UPDATE messages SET content = ?, edited_timestamp = ?
    WHERE id = ?
  `).run(
    newMsg.content,
    new Date().toISOString(),
    newMsg.id
  );
}

module.exports = logEdit;
