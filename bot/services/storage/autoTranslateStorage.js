// services/storage/autoTranslateStorage.js (WITH DEBUG LOGGING)
class AutoTranslateStorage {
  constructor(db) {
    this.db = db;
  }

  // Create a new auto-translate channel config
  createAutoTranslate(guildId, channelId, sourceChannelId, targetLanguage, webhookId, webhookToken) {
    try {
      const result = this.db.prepare(`
        INSERT INTO auto_translate_channels 
        (guild_id, channel_id, source_channel_id, target_language, webhook_id, webhook_token, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(guildId, channelId, sourceChannelId, targetLanguage, webhookId, webhookToken);
      
      // Immediately verify the insert worked
      const verification = this.db.prepare(`
        SELECT * FROM auto_translate_channels WHERE id = ?
      `).get(result.lastInsertRowid);
      
      // Also check by channel_id
      const byChannel = this.db.prepare(`
        SELECT * FROM auto_translate_channels WHERE channel_id = ?
      `).get(channelId);
      
      // Check by guild_id
      const byGuild = this.db.prepare(`
        SELECT * FROM auto_translate_channels WHERE guild_id = ?
      `).all(guildId);
      
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      console.error('❌ Failed to create auto-translate config:', error);
      return { success: false, error };
    }
  }

  // Get auto-translate config by channel ID
  getByChannelId(channelId) {
    const result = this.db.prepare(`
      SELECT * FROM auto_translate_channels
      WHERE channel_id = ? AND is_active = 1
    `).get(channelId);
    return result;
  }

  // Get all auto-translate configs watching a source channel
  getBySourceChannel(sourceChannelId) {
    const results = this.db.prepare(`
      SELECT * FROM auto_translate_channels
      WHERE source_channel_id = ? AND is_active = 1
    `).all(sourceChannelId);
    return results;
  }

  // Get all auto-translate channels for a guild
  getByGuildId(guildId) {
    
    // First, check ALL rows regardless of is_active
    const allRows = this.db.prepare(`
      SELECT * FROM auto_translate_channels WHERE guild_id = ?
    `).all(guildId);
    
    // Then check active only
    const activeRows = this.db.prepare(`
      SELECT * FROM auto_translate_channels
      WHERE guild_id = ? AND is_active = 1
    `).all(guildId);
    
    return activeRows;
  }

  // Update webhook credentials
  updateWebhook(channelId, webhookId, webhookToken) {
    try {
      this.db.prepare(`
        UPDATE auto_translate_channels
        SET webhook_id = ?, webhook_token = ?, updated_at = CURRENT_TIMESTAMP
        WHERE channel_id = ?
      `).run(webhookId, webhookToken, channelId);
      return { success: true };
    } catch (error) {
      console.error('Failed to update webhook:', error);
      return { success: false, error };
    }
  }

  // Deactivate (soft delete) an auto-translate channel
  deactivate(channelId) {
    try {
      this.db.prepare(`
        UPDATE auto_translate_channels
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE channel_id = ?
      `).run(channelId);
      return { success: true };
    } catch (error) {
      console.error('Failed to deactivate auto-translate:', error);
      return { success: false, error };
    }
  }

  // Delete an auto-translate config completely
  delete(channelId) {
    try {
      this.db.prepare(`
        DELETE FROM auto_translate_channels
        WHERE channel_id = ?
      `).run(channelId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete auto-translate:', error);
      return { success: false, error };
    }
  }

  // Track a translated message
  trackTranslation(originalMessageId, translatedMessageId, sourceChannelId, targetChannelId, autoTranslateConfigId, isAutoTranslation = true) {
    try {
      this.db.prepare(`
        INSERT INTO translated_messages 
        (original_message_id, translated_message_id, source_channel_id, target_channel_id, auto_translate_config_id, is_auto_translation)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(originalMessageId, translatedMessageId, sourceChannelId, targetChannelId, autoTranslateConfigId, isAutoTranslation ? 1 : 0);
      return { success: true };
    } catch (error) {
      console.error('Failed to track translation:', error);
      return { success: false, error };
    }
  }

  // Check if a message was already auto-translated
  isMessageTranslated(messageId, targetChannelId) {
    const result = this.db.prepare(`
      SELECT 1 FROM translated_messages
      WHERE original_message_id = ? AND target_channel_id = ?
    `).get(messageId, targetChannelId);
    
    return !!result;
  }

  // Get the original message ID for a translated message
  getOriginalMessageId(translatedMessageId) {
    const result = this.db.prepare(`
      SELECT original_message_id, source_channel_id FROM translated_messages
      WHERE translated_message_id = ?
    `).get(translatedMessageId);
    
    return result;
  }

  // Check if this message is an auto-translation (to prevent re-translating)
  isAutoTranslation(messageId) {
    const result = this.db.prepare(`
      SELECT is_auto_translation FROM translated_messages
      WHERE translated_message_id = ?
    `).get(messageId);
    
    return result ? !!result.is_auto_translation : false;
  }

  // Get all translations of a specific message
  getMessageTranslations(originalMessageId) {
    return this.db.prepare(`
      SELECT * FROM translated_messages
      WHERE original_message_id = ?
    `).all(originalMessageId);
  }
}

module.exports = AutoTranslateStorage;