// services/storage/serverEventStorage.js
class ServerEventStorage {
  constructor(db) {
    this.db = db;
  }

  /**
   * Log role events (create, update, delete)
   */
  logRoleCreate(role) {
    this.db.prepare(`
      INSERT INTO role_events (
        guild_id, role_id, event_type, role_name, color, permissions, position, mentionable, hoist, timestamp
      ) VALUES (?, ?, 'create', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      role.guild.id,
      role.id,
      role.name,
      role.hexColor,
      role.permissions.bitfield.toString(),
      role.position,
      role.mentionable ? 1 : 0,
      role.hoist ? 1 : 0,
      new Date().toISOString()
    );
  }

  logRoleUpdate(oldRole, newRole) {
    const changes = {};
    
    if (oldRole.name !== newRole.name) changes.name = { old: oldRole.name, new: newRole.name };
    if (oldRole.hexColor !== newRole.hexColor) changes.color = { old: oldRole.hexColor, new: newRole.hexColor };
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      changes.permissions = { old: oldRole.permissions.bitfield.toString(), new: newRole.permissions.bitfield.toString() };
    }
    if (oldRole.position !== newRole.position) changes.position = { old: oldRole.position, new: newRole.position };
    if (oldRole.mentionable !== newRole.mentionable) changes.mentionable = { old: oldRole.mentionable, new: newRole.mentionable };
    if (oldRole.hoist !== newRole.hoist) changes.hoist = { old: oldRole.hoist, new: newRole.hoist };

    if (Object.keys(changes).length > 0) {
      this.db.prepare(`
        INSERT INTO role_events (
          guild_id, role_id, event_type, role_name, color, permissions, position, mentionable, hoist, timestamp, old_values
        ) VALUES (?, ?, 'update', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newRole.guild.id,
        newRole.id,
        newRole.name,
        newRole.hexColor,
        newRole.permissions.bitfield.toString(),
        newRole.position,
        newRole.mentionable ? 1 : 0,
        newRole.hoist ? 1 : 0,
        new Date().toISOString(),
        JSON.stringify(changes)
      );
    }
  }

  logRoleDelete(role) {
    this.db.prepare(`
      INSERT INTO role_events (
        guild_id, role_id, event_type, role_name, color, permissions, position, mentionable, hoist, timestamp
      ) VALUES (?, ?, 'delete', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      role.guild.id,
      role.id,
      role.name,
      role.hexColor,
      role.permissions.bitfield.toString(),
      role.position,
      role.mentionable ? 1 : 0,
      role.hoist ? 1 : 0,
      new Date().toISOString()
    );
  }

  /**
   * Log channel events (create, update, delete)
   */
  logChannelCreate(channel) {
    if (!channel.guild) return; // Skip DM channels
    
    this.db.prepare(`
      INSERT INTO channel_events (
        guild_id, channel_id, event_type, channel_name, channel_type, parent_id, position, nsfw, topic, timestamp
      ) VALUES (?, ?, 'create', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      channel.guild.id,
      channel.id,
      channel.name,
      channel.type,
      channel.parentId ?? null,
      channel.position ?? null,
      channel.nsfw ? 1 : 0,
      channel.topic ?? null,
      new Date().toISOString()
    );
  }

  logChannelUpdate(oldChannel, newChannel) {
    if (!newChannel.guild) return; // Skip DM channels
    
    const changes = {};
    
    if (oldChannel.name !== newChannel.name) changes.name = { old: oldChannel.name, new: newChannel.name };
    if (oldChannel.type !== newChannel.type) changes.type = { old: oldChannel.type, new: newChannel.type };
    if (oldChannel.parentId !== newChannel.parentId) changes.parentId = { old: oldChannel.parentId, new: newChannel.parentId };
    if (oldChannel.position !== newChannel.position) changes.position = { old: oldChannel.position, new: newChannel.position };
    if (oldChannel.nsfw !== newChannel.nsfw) changes.nsfw = { old: oldChannel.nsfw, new: newChannel.nsfw };
    if (oldChannel.topic !== newChannel.topic) changes.topic = { old: oldChannel.topic, new: newChannel.topic };

    if (Object.keys(changes).length > 0) {
      this.db.prepare(`
        INSERT INTO channel_events (
          guild_id, channel_id, event_type, channel_name, channel_type, parent_id, position, nsfw, topic, timestamp, old_values
        ) VALUES (?, ?, 'update', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newChannel.guild.id,
        newChannel.id,
        newChannel.name,
        newChannel.type,
        newChannel.parentId ?? null,
        newChannel.position ?? null,
        newChannel.nsfw ? 1 : 0,
        newChannel.topic ?? null,
        new Date().toISOString(),
        JSON.stringify(changes)
      );
    }
  }

  logChannelDelete(channel) {
    if (!channel.guild) return; // Skip DM channels
    
    this.db.prepare(`
      INSERT INTO channel_events (
        guild_id, channel_id, event_type, channel_name, channel_type, parent_id, position, nsfw, topic, timestamp
      ) VALUES (?, ?, 'delete', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      channel.guild.id,
      channel.id,
      channel.name,
      channel.type,
      channel.parentId ?? null,
      channel.position ?? null,
      channel.nsfw ? 1 : 0,
      channel.topic ?? null,
      new Date().toISOString()
    );
  }

  /**
   * Log emoji events
   */
  logEmojiCreate(emoji) {
    this.db.prepare(`
      INSERT INTO emoji_events (guild_id, emoji_id, event_type, emoji_name, animated, timestamp)
      VALUES (?, ?, 'create', ?, ?, ?)
    `).run(
      emoji.guild.id,
      emoji.id,
      emoji.name,
      emoji.animated ? 1 : 0,
      new Date().toISOString()
    );
  }

  logEmojiUpdate(oldEmoji, newEmoji) {
    if (oldEmoji.name !== newEmoji.name) {
      this.db.prepare(`
        INSERT INTO emoji_events (guild_id, emoji_id, event_type, emoji_name, animated, timestamp)
        VALUES (?, ?, 'update', ?, ?, ?)
      `).run(
        newEmoji.guild.id,
        newEmoji.id,
        newEmoji.name,
        newEmoji.animated ? 1 : 0,
        new Date().toISOString()
      );
    }
  }

  logEmojiDelete(emoji) {
    this.db.prepare(`
      INSERT INTO emoji_events (guild_id, emoji_id, event_type, emoji_name, animated, timestamp)
      VALUES (?, ?, 'delete', ?, ?, ?)
    `).run(
      emoji.guild.id,
      emoji.id,
      emoji.name,
      emoji.animated ? 1 : 0,
      new Date().toISOString()
    );
  }

  /**
   * Log sticker events
   */
  logStickerCreate(sticker) {
    this.db.prepare(`
      INSERT INTO sticker_events (guild_id, sticker_id, event_type, sticker_name, description, timestamp)
      VALUES (?, ?, 'create', ?, ?, ?)
    `).run(
      sticker.guild.id,
      sticker.id,
      sticker.name,
      sticker.description ?? null,
      new Date().toISOString()
    );
  }

  logStickerUpdate(oldSticker, newSticker) {
    if (oldSticker.name !== newSticker.name || oldSticker.description !== newSticker.description) {
      this.db.prepare(`
        INSERT INTO sticker_events (guild_id, sticker_id, event_type, sticker_name, description, timestamp)
        VALUES (?, ?, 'update', ?, ?, ?)
      `).run(
        newSticker.guild.id,
        newSticker.id,
        newSticker.name,
        newSticker.description ?? null,
        new Date().toISOString()
      );
    }
  }

  logStickerDelete(sticker) {
    this.db.prepare(`
      INSERT INTO sticker_events (guild_id, sticker_id, event_type, sticker_name, description, timestamp)
      VALUES (?, ?, 'delete', ?, ?, ?)
    `).run(
      sticker.guild.id,
      sticker.id,
      sticker.name,
      sticker.description ?? null,
      new Date().toISOString()
    );
  }

  /**
   * Log guild update events
   */
  logGuildUpdate(oldGuild, newGuild) {
    const changes = [];
    
    if (oldGuild.name !== newGuild.name) {
      changes.push({ field: 'name', old: oldGuild.name, new: newGuild.name });
    }
    if (oldGuild.icon !== newGuild.icon) {
      changes.push({ field: 'icon', old: oldGuild.icon, new: newGuild.icon });
    }
    if (oldGuild.ownerId !== newGuild.ownerId) {
      changes.push({ field: 'owner', old: oldGuild.ownerId, new: newGuild.ownerId });
    }
    if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
      changes.push({ field: 'afk_channel', old: oldGuild.afkChannelId, new: newGuild.afkChannelId });
    }
    if (oldGuild.afkTimeout !== newGuild.afkTimeout) {
      changes.push({ field: 'afk_timeout', old: oldGuild.afkTimeout.toString(), new: newGuild.afkTimeout.toString() });
    }
    if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
      changes.push({ field: 'system_channel', old: oldGuild.systemChannelId, new: newGuild.systemChannelId });
    }
    if (oldGuild.rulesChannelId !== newGuild.rulesChannelId) {
      changes.push({ field: 'rules_channel', old: oldGuild.rulesChannelId, new: newGuild.rulesChannelId });
    }
    if (oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId) {
      changes.push({ field: 'public_updates_channel', old: oldGuild.publicUpdatesChannelId, new: newGuild.publicUpdatesChannelId });
    }
    if (oldGuild.premiumTier !== newGuild.premiumTier) {
      changes.push({ field: 'boost_level', old: oldGuild.premiumTier.toString(), new: newGuild.premiumTier.toString() });
    }
    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
      changes.push({ field: 'vanity_url', old: oldGuild.vanityURLCode, new: newGuild.vanityURLCode });
    }

    const stmt = this.db.prepare(`
      INSERT INTO guild_events (guild_id, event_type, field_name, old_value, new_value, timestamp)
      VALUES (?, 'update', ?, ?, ?, ?)
    `);

    const timestamp = new Date().toISOString();
    for (const change of changes) {
      stmt.run(
        newGuild.id,
        change.field,
        change.old,
        change.new,
        timestamp
      );
    }
  }

  /**
   * Log invite events
   */
  logInviteCreate(invite) {
    this.db.prepare(`
      INSERT INTO invite_events (
        guild_id, invite_code, channel_id, inviter_id, event_type, max_uses, max_age, temporary, uses, timestamp
      ) VALUES (?, ?, ?, ?, 'create', ?, ?, ?, ?, ?)
    `).run(
      invite.guild?.id ?? null,
      invite.code,
      invite.channel?.id ?? null,
      invite.inviter?.id ?? null,
      invite.maxUses ?? null,
      invite.maxAge ?? null,
      invite.temporary ? 1 : 0,
      invite.uses ?? 0,
      new Date().toISOString()
    );
  }

  logInviteDelete(invite) {
    this.db.prepare(`
      INSERT INTO invite_events (
        guild_id, invite_code, channel_id, inviter_id, event_type, max_uses, max_age, temporary, uses, timestamp
      ) VALUES (?, ?, ?, ?, 'delete', ?, ?, ?, ?, ?)
    `).run(
      invite.guild?.id ?? null,
      invite.code,
      invite.channel?.id ?? null,
      invite.inviter?.id ?? null,
      invite.maxUses ?? null,
      invite.maxAge ?? null,
      invite.temporary ? 1 : 0,
      invite.uses ?? 0,
      new Date().toISOString()
    );
  }

  /**
   * Log webhook events
   */
  logWebhookCreate(webhook) {
    this.db.prepare(`
      INSERT INTO webhook_events (guild_id, webhook_id, channel_id, event_type, webhook_name, avatar_url, timestamp)
      VALUES (?, ?, ?, 'create', ?, ?, ?)
    `).run(
      webhook.guildId ?? null,
      webhook.id,
      webhook.channelId ?? null,
      webhook.name,
      webhook.avatarURL() ?? null,
      new Date().toISOString()
    );
  }

  logWebhookUpdate(oldWebhook, newWebhook) {
    if (oldWebhook.name !== newWebhook.name || oldWebhook.avatar !== newWebhook.avatar) {
      this.db.prepare(`
        INSERT INTO webhook_events (guild_id, webhook_id, channel_id, event_type, webhook_name, avatar_url, timestamp)
        VALUES (?, ?, ?, 'update', ?, ?, ?)
      `).run(
        newWebhook.guildId ?? null,
        newWebhook.id,
        newWebhook.channelId ?? null,
        newWebhook.name,
        newWebhook.avatarURL() ?? null,
        new Date().toISOString()
      );
    }
  }

  logWebhookDelete(webhook) {
    this.db.prepare(`
      INSERT INTO webhook_events (guild_id, webhook_id, channel_id, event_type, webhook_name, avatar_url, timestamp)
      VALUES (?, ?, ?, 'delete', ?, ?, ?)
    `).run(
      webhook.guildId ?? null,
      webhook.id,
      webhook.channelId ?? null,
      webhook.name,
      webhook.avatarURL() ?? null,
      new Date().toISOString()
    );
  }

  /**
   * Query methods for analytics
   */
  getRoleHistory(roleId, guildId) {
    return this.db.prepare(`
      SELECT * FROM role_events
      WHERE role_id = ? AND guild_id = ?
      ORDER BY timestamp DESC
    `).all(roleId, guildId);
  }

  getChannelHistory(channelId, guildId) {
    return this.db.prepare(`
      SELECT * FROM channel_events
      WHERE channel_id = ? AND guild_id = ?
      ORDER BY timestamp DESC
    `).all(channelId, guildId);
  }

  getGuildHistory(guildId, limit = 50) {
    return this.db.prepare(`
      SELECT * FROM guild_events
      WHERE guild_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(guildId, limit);
  }

  getInviteStats(guildId) {
    return this.db.prepare(`
      SELECT 
        invite_code,
        SUM(CASE WHEN event_type = 'create' THEN 1 ELSE 0 END) as created,
        SUM(CASE WHEN event_type = 'delete' THEN 1 ELSE 0 END) as deleted,
        MAX(uses) as max_uses_seen
      FROM invite_events
      WHERE guild_id = ?
      GROUP BY invite_code
      ORDER BY max_uses_seen DESC
    `).all(guildId);
  }
}

module.exports = ServerEventStorage;
