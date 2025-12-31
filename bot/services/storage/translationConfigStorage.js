// services/storage/translationConfigStorage.js
class TranslationConfigStorage {
  constructor(db) {
    this.db = db;
  }

  // Get or create guild config
  getGuildConfig(guildId) {
    let config = this.db.prepare(`
      SELECT * FROM translation_config WHERE guild_id = ?
    `).get(guildId);

    if (!config) {
      this.db.prepare(`
        INSERT INTO translation_config (guild_id, enabled)
        VALUES (?, 1)
      `).run(guildId);
      
      config = { guild_id: guildId, enabled: 1 };
    }

    return config;
  }

  // Block a channel from translation
  blockChannel(guildId, channelId) {
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO blocked_translation_channels (guild_id, channel_id)
        VALUES (?, ?)
      `).run(guildId, channelId);
      return { success: true };
    } catch (error) {
      console.error('Failed to block channel:', error);
      return { success: false, error };
    }
  }

  // Unblock a channel
  unblockChannel(guildId, channelId) {
    try {
      this.db.prepare(`
        DELETE FROM blocked_translation_channels
        WHERE guild_id = ? AND channel_id = ?
      `).run(guildId, channelId);
      return { success: true };
    } catch (error) {
      console.error('Failed to unblock channel:', error);
      return { success: false, error };
    }
  }

  // Check if channel is blocked
  isChannelBlocked(guildId, channelId) {
    const result = this.db.prepare(`
      SELECT 1 FROM blocked_translation_channels
      WHERE guild_id = ? AND channel_id = ?
    `).get(guildId, channelId);
    
    return !!result;
  }

  // Get all blocked channels for a guild
  getBlockedChannels(guildId) {
    return this.db.prepare(`
      SELECT channel_id FROM blocked_translation_channels
      WHERE guild_id = ?
    `).all(guildId);
  }

  // Set announcement channel routing
  setAnnouncementChannel(guildId, sourceChannelId, announcementChannelId) {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO announcement_translation_channels 
        (guild_id, source_channel_id, announcement_channel_id)
        VALUES (?, ?, ?)
      `).run(guildId, sourceChannelId, announcementChannelId);
      return { success: true };
    } catch (error) {
      console.error('Failed to set announcement channel:', error);
      return { success: false, error };
    }
  }

  // Remove announcement channel routing
  removeAnnouncementChannel(guildId, sourceChannelId) {
    try {
      this.db.prepare(`
        DELETE FROM announcement_translation_channels
        WHERE guild_id = ? AND source_channel_id = ?
      `).run(guildId, sourceChannelId);
      return { success: true };
    } catch (error) {
      console.error('Failed to remove announcement channel:', error);
      return { success: false, error };
    }
  }

  // Get announcement channel for a source channel
  getAnnouncementChannel(guildId, sourceChannelId) {
    const result = this.db.prepare(`
      SELECT announcement_channel_id FROM announcement_translation_channels
      WHERE guild_id = ? AND source_channel_id = ?
    `).get(guildId, sourceChannelId);
    
    return result ? result.announcement_channel_id : null;
  }

  // Get all announcement channel mappings for a guild
  getAnnouncementChannels(guildId) {
    return this.db.prepare(`
      SELECT source_channel_id, announcement_channel_id 
      FROM announcement_translation_channels
      WHERE guild_id = ?
    `).all(guildId);
  }

  // Get full config for a guild (blocked + announcements)
  getFullGuildConfig(guildId) {
    const config = this.getGuildConfig(guildId);
    const blockedChannels = this.getBlockedChannels(guildId);
    const announcementChannels = this.getAnnouncementChannels(guildId);

    return {
      ...config,
      blockedChannels: blockedChannels.map(c => c.channel_id),
      announcementChannels
    };
  }
}

module.exports = TranslationConfigStorage;
