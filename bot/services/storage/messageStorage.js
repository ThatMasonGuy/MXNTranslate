// services/storage/messageStorage.js
class MessageStorage {
  constructor(db) {
    this.db = db;
  }

  async store(msg) {
    // Store message
    this.db.prepare(`
      INSERT OR REPLACE INTO messages
        (id, channel_id, guild_id, author_id, content, timestamp, edited_timestamp, is_pinned, type, deleted, referenced_message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      msg.id,
      msg.channel.id,
      msg.guild.id,
      msg.author.id,
      msg.content,
      msg.createdAt.toISOString(),
      null,
      msg.pinned ? 1 : 0,
      msg.type,
      msg.reference?.messageId ?? null
    );

    // Store attachments
    if (msg.attachments && msg.attachments.size > 0) {
      for (const [, att] of msg.attachments) {
        this.db.prepare(`
          INSERT INTO message_attachments (message_id, url, filename, size, content_type)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          msg.id,
          att.url,
          att.name,
          att.size,
          att.contentType ?? null
        );
      }
    }
  }

  async logEdit(oldMsg, newMsg) {
    if (!oldMsg.content || oldMsg.content === newMsg.content) return;

    // Insert edit history
    this.db.prepare(`
      INSERT INTO message_edits (message_id, old_content, new_content, edited_timestamp)
      VALUES (?, ?, ?, ?)
    `).run(
      newMsg.id,
      oldMsg.content,
      newMsg.content,
      new Date().toISOString()
    );

    // Update messages table with latest
    this.db.prepare(`
      UPDATE messages SET content = ?, edited_timestamp = ?
      WHERE id = ?
    `).run(
      newMsg.content,
      new Date().toISOString(),
      newMsg.id
    );
  }

  async markDeleted(msg) {
    this.db.prepare(`UPDATE messages SET deleted = 1 WHERE id = ?`).run(msg.id);
  }
}

module.exports = MessageStorage;
