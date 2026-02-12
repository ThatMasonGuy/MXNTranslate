// services/storage/reactionStorage.js - FIXED column count for message insert
class ReactionStorage {
  constructor(db) {
    this.db = db;
  }

  async store(reaction, user) {
    // Ensure message exists in database first (fix for foreign key error)
    const messageExists = this.db.prepare(`
      SELECT 1 FROM messages WHERE id = ?
    `).get(reaction.message.id);

    if (!messageExists) {
      // Insert basic message record to satisfy foreign key constraint
      // 14 columns = 14 values (type and deleted are hardcoded 0s in the SQL)
      try {
        this.db.prepare(`
          INSERT OR IGNORE INTO messages (id, channel_id, guild_id, author_id, content, timestamp, edited_timestamp, is_pinned, type, deleted, referenced_message_id, webhook_id, application_id, flags)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        `).run(
          reaction.message.id,
          reaction.message.channel.id,
          reaction.message.guild?.id || null,
          reaction.message.author?.id || null,
          reaction.message.content || '',
          reaction.message.createdAt?.toISOString() || new Date().toISOString(),
          null,
          reaction.message.pinned ? 1 : 0,
          reaction.message.type || 0,
          // deleted = 0 is hardcoded in SQL
          null,
          null,
          null,
          0
        );
      } catch (error) {
        console.error('Failed to insert message for reaction storage:', error);
      }
    }

    // Find existing reaction
    const reactionRow = this.db.prepare(`
      SELECT id FROM reactions
      WHERE message_id = ? AND emoji_name = ? AND (emoji_id IS ? OR emoji_id IS NULL)
      ORDER BY id DESC LIMIT 1
    `).get(
      reaction.message.id,
      reaction.emoji.name,
      reaction.emoji.id ?? null
    );

    let reactionId;
    if (reactionRow) {
      // Update existing reaction
      this.db.prepare(`
        UPDATE reactions SET count = ? WHERE id = ?
      `).run(reaction.count, reactionRow.id);
      reactionId = reactionRow.id;
    } else {
      // Create new reaction
      this.db.prepare(`
        INSERT INTO reactions (message_id, emoji_name, emoji_id, count, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        reaction.message.id,
        reaction.emoji.name,
        reaction.emoji.id ?? null,
        reaction.count,
        new Date().toISOString()
      );
      
      reactionId = this.db.prepare(`
        SELECT id FROM reactions
        WHERE message_id = ? AND emoji_name = ? AND (emoji_id IS ? OR emoji_id IS NULL)
        ORDER BY id DESC LIMIT 1
      `).get(
        reaction.message.id,
        reaction.emoji.name,
        reaction.emoji.id ?? null
      )?.id;
    }

    // Link user to reaction
    if (reactionId) {
      this.db.prepare(`
        INSERT OR IGNORE INTO reaction_users (reaction_id, user_id)
        VALUES (?, ?)
      `).run(reactionId, user.id);
    }

    return { reactionId };
  }

  async remove(reaction, user) {
    const reactionRow = this.db.prepare(`
      SELECT id, count FROM reactions
      WHERE message_id = ? AND emoji_name = ? AND (emoji_id IS ? OR emoji_id IS NULL)
      ORDER BY id DESC LIMIT 1
    `).get(
      reaction.message.id,
      reaction.emoji.name,
      reaction.emoji.id ?? null
    );

    if (reactionRow) {
      // Remove user from reaction
      this.db.prepare(`
        DELETE FROM reaction_users WHERE reaction_id = ? AND user_id = ?
      `).run(reactionRow.id, user.id);

      // Update count
      const newCount = Math.max((reactionRow.count ?? 1) - 1, 0);
      this.db.prepare(`UPDATE reactions SET count = ? WHERE id = ?`).run(newCount, reactionRow.id);
    }
  }
}

module.exports = ReactionStorage;