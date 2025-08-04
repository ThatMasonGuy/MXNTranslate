const db = require('../db');

function insertMessage(msg) {
  // Insert/replace author
  db.prepare(`
    INSERT OR REPLACE INTO authors (id, name, nickname, discriminator, color, is_bot, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    msg.author.id,
    msg.author.username,
    msg.member?.nickname ?? null,
    msg.author.discriminator,
    msg.member?.displayHexColor ?? null,
    msg.author.bot ? 1 : 0,
    msg.author.displayAvatarURL({ extension: "png", size: 128 })
  );

  // Insert/replace author_roles
  if (msg.member) {
    for (const [roleId, role] of msg.member.roles.cache) {
      db.prepare(`
        INSERT OR REPLACE INTO roles (id, name, color, position)
        VALUES (?, ?, ?, ?)
      `).run(
        roleId, role.name, role.hexColor, role.position
      );
      db.prepare(`
        INSERT OR IGNORE INTO author_roles (author_id, role_id)
        VALUES (?, ?)
      `).run(msg.author.id, roleId);
    }
  }

  // Channel & Threads
  db.prepare(`
    INSERT OR REPLACE INTO channels (id, name, type, position, topic, nsfw, last_message_id, parent_id, archived, auto_archive_duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    msg.channel.id,
    msg.channel.name ?? null,
    msg.channel.type,
    msg.channel.position ?? null,
    msg.channel.topic ?? null,
    msg.channel.nsfw ? 1 : 0,
    msg.channel.lastMessageId ?? null,
    msg.channel.parentId ?? null,
    msg.channel.archived === undefined ? null : (msg.channel.archived ? 1 : 0),
    msg.channel.autoArchiveDuration ?? null
  );

  // Guild
  db.prepare(`
    INSERT OR REPLACE INTO guilds (id, name, icon, owner_id, region, afk_channel_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    msg.guild.id,
    msg.guild.name,
    msg.guild.icon ?? null,
    msg.guild.ownerId ?? null,
    null,
    msg.guild.afkChannelId ?? null
  );

  // Message
  db.prepare(`
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

  // ---- ATTACHMENTS LOGGING ----
  if (msg.attachments && msg.attachments.size > 0) {
    for (const [, att] of msg.attachments) {
      db.prepare(`
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

module.exports = insertMessage;
