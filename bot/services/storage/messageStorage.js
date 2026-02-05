// services/storage/messageStorage.js - UPDATED WITH ALL METADATA
class MessageStorage {
  constructor(db) {
    this.db = db;
  }

  async store(msg) {
    // Store message with ALL metadata (matching nuclear/startup backfill schema)
    this.db.prepare(`
      INSERT OR IGNORE INTO messages
        (id, channel_id, guild_id, author_id, content, timestamp, edited_timestamp, is_pinned, type, deleted, referenced_message_id, webhook_id, application_id, flags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
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
      msg.reference?.messageId ?? null,
      msg.webhookId ?? null,
      msg.applicationId ?? null,
      msg.flags?.bitfield ?? 0
    );

    // Store attachments
    if (msg.attachments && msg.attachments.size > 0) {
      for (const [, att] of msg.attachments) {
        this.db.prepare(`
          INSERT OR IGNORE INTO message_attachments (message_id, url, filename, size, content_type)
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

    // Store embeds
    if (msg.embeds && msg.embeds.length > 0) {
      for (const embed of msg.embeds) {
        this.db.prepare(`
          INSERT OR IGNORE INTO message_embeds (message_id, type, title, description, url, color, timestamp, image_url, thumbnail_url, video_url, author_name, footer_text)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          msg.id,
          embed.type ?? 'rich',
          embed.title ?? null,
          embed.description ?? null,
          embed.url ?? null,
          embed.color ?? null,
          embed.timestamp ?? null,
          embed.image?.url ?? null,
          embed.thumbnail?.url ?? null,
          embed.video?.url ?? null,
          embed.author?.name ?? null,
          embed.footer?.text ?? null
        );
      }
    }

    // Store stickers
    if (msg.stickers && msg.stickers.size > 0) {
      for (const [, sticker] of msg.stickers) {
        this.db.prepare(`
          INSERT OR IGNORE INTO message_stickers (message_id, sticker_id, name, format_type)
          VALUES (?, ?, ?, ?)
        `).run(
          msg.id,
          sticker.id,
          sticker.name,
          sticker.format
        );
      }
    }

    // Store mentions
    if (msg.mentions) {
      // User mentions
      if (msg.mentions.users && msg.mentions.users.size > 0) {
        const insertMention = this.db.prepare(`
          INSERT OR IGNORE INTO message_mentions (message_id, mention_type, mentioned_id)
          VALUES (?, ?, ?)
        `);
        for (const [userId] of msg.mentions.users) {
          insertMention.run(msg.id, 'user', userId);
        }
      }
      
      // Role mentions
      if (msg.mentions.roles && msg.mentions.roles.size > 0) {
        const insertMention = this.db.prepare(`
          INSERT OR IGNORE INTO message_mentions (message_id, mention_type, mentioned_id)
          VALUES (?, ?, ?)
        `);
        for (const [roleId] of msg.mentions.roles) {
          insertMention.run(msg.id, 'role', roleId);
        }
      }
      
      // Channel mentions
      if (msg.mentions.channels && msg.mentions.channels.size > 0) {
        const insertMention = this.db.prepare(`
          INSERT OR IGNORE INTO message_mentions (message_id, mention_type, mentioned_id)
          VALUES (?, ?, ?)
        `);
        for (const [channelId] of msg.mentions.channels) {
          insertMention.run(msg.id, 'channel', channelId);
        }
      }
      
      // @everyone or @here
      if (msg.mentions.everyone) {
        this.db.prepare(`
          INSERT OR IGNORE INTO message_mentions (message_id, mention_type, mentioned_id)
          VALUES (?, ?, ?)
        `).run(msg.id, 'everyone', null);
      }
    }

    // Store interaction metadata (slash commands)
    if (msg.interaction) {
      this.db.prepare(`
        INSERT OR IGNORE INTO message_interactions (message_id, interaction_id, interaction_type, command_name, user_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        msg.id,
        msg.interaction.id,
        msg.interaction.type ?? null,
        msg.interaction.commandName ?? null,
        msg.interaction.user?.id ?? null
      );
    }
  }

  async logEdit(oldMsg, newMsg) {
    if (!oldMsg.content || oldMsg.content === newMsg.content) return;
  
    // Check if message exists in database first
    const messageExists = this.db.prepare("SELECT 1 FROM messages WHERE id = ?").get(newMsg.id);
    
    if (!messageExists) {
      // Message not in DB - skip edit logging
      return;
    }
  
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