// handlers/autoTranslateHandler.js
class AutoTranslateHandler {
  constructor(storageService, translationService, client) {
    this.storageService = storageService;
    this.translationService = translationService;
    this.client = client;
    this.webhookCache = new Map();
  }

  async handleMessage(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const channelId = message.channel.id;

    // Check 1: Is this message in an auto-translate channel?
    // If so, translate it back to English and send to source channel
    const autoTranslateConfig = this.storageService.autoTranslate.getByChannelId(channelId);
    if (autoTranslateConfig) {
      await this.handleMessageInAutoTranslateChannel(message, autoTranslateConfig);
      return;
    }

    // Check 2: Is this channel being watched by any auto-translate channels?
    // If so, translate to those languages and send to those channels
    const watchingConfigs = this.storageService.autoTranslate.getBySourceChannel(channelId);
    if (watchingConfigs && watchingConfigs.length > 0) {
      await this.handleMessageInWatchedChannel(message, watchingConfigs);
    }
  }

  // Handle a message sent in an auto-translate channel (translate back to English)
  async handleMessageInAutoTranslateChannel(message, config) {
    try {
      // Check if this message is already an auto-translation
      if (this.storageService.autoTranslate.isAutoTranslation(message.id)) {
        console.log(`Message ${message.id} is already an auto-translation, skipping`);
        return;
      }

      console.log(`📨 Auto-translating message from ${config.target_language} channel back to English`);

      // Show typing indicator
      await message.channel.sendTyping();

      // Translate to English
      const translatedText = await this.translationService.translateMessage(
        message.content,
        'en',
        {
          discordUserId: message.author.id,
          userName: message.author.username,
          guildId: message.guild.id,
          channelId: message.channel.id,
          guildName: message.guild.name,
          channelName: message.channel.name,
        }
      );

      if (!translatedText) {
        console.log('Translation returned empty, skipping');
        return;
      }

      // Get the source channel
      const sourceChannel = await this.client.channels.fetch(config.source_channel_id).catch(() => null);
      
      if (!sourceChannel) {
        console.log(`⚠️ Source channel ${config.source_channel_id} not found! Deactivating auto-translate config.`);
        this.storageService.autoTranslate.deactivate(message.channel.id);
        return;
      }

      // Send the translated message to the source channel as the original user
      const sentMessage = await this.sendAsUser(
        sourceChannel,
        translatedText,
        message.author,
        message.attachments
      );

      if (sentMessage) {
        // Track this translation to prevent loops
        this.storageService.autoTranslate.trackTranslation(
          message.id,
          sentMessage.id,
          message.channel.id,
          sourceChannel.id,
          config.id,
          true
        );
      }

      // Also send to other auto-translate channels watching the source
      const otherConfigs = this.storageService.autoTranslate.getBySourceChannel(config.source_channel_id);
      const activeOtherConfigs = [];
      
      for (const otherConfig of otherConfigs) {
        // Skip the current channel
        if (otherConfig.channel_id === message.channel.id) continue;

        // Check if channel still exists
        const channelExists = await this.client.channels.fetch(otherConfig.channel_id).catch(() => null);
        if (!channelExists) {
          console.log(`⚠️ Channel ${otherConfig.channel_id} not found! Deactivating.`);
          this.storageService.autoTranslate.deactivate(otherConfig.channel_id);
          continue;
        }

        activeOtherConfigs.push(otherConfig);
      }

      if (activeOtherConfigs.length > 0) {
        await this.broadcastToAutoTranslateChannels(message, activeOtherConfigs, true);
      }

    } catch (error) {
      console.error('Error handling message in auto-translate channel:', error);
    }
  }

  // Handle a message in a watched channel (translate to auto-translate channels)
  async handleMessageInWatchedChannel(message, watchingConfigs) {
    try {
      // Check if this message is already an auto-translation
      if (this.storageService.autoTranslate.isAutoTranslation(message.id)) {
        console.log(`Message ${message.id} is already an auto-translation, will forward to other auto-translate channels`);
      }

      console.log(`📡 Broadcasting message to ${watchingConfigs.length} auto-translate channel(s)`);

      // Filter out dead channels before broadcasting
      const activeConfigs = [];
      for (const config of watchingConfigs) {
        const channelExists = await this.client.channels.fetch(config.channel_id).catch(() => null);
        if (!channelExists) {
          console.log(`⚠️ Channel ${config.channel_id} not found! Deactivating.`);
          this.storageService.autoTranslate.deactivate(config.channel_id);
          continue;
        }
        activeConfigs.push(config);
      }

      if (activeConfigs.length === 0) {
        console.log('No active auto-translate channels found after cleanup');
        return;
      }

      await this.broadcastToAutoTranslateChannels(message, activeConfigs, false);

    } catch (error) {
      console.error('Error handling message in watched channel:', error);
    }
  }

  // Broadcast a message to multiple auto-translate channels
  async broadcastToAutoTranslateChannels(message, configs, isFromAutoChannel) {
    for (const config of configs) {
      // Skip if we've already translated this message to this channel
      if (this.storageService.autoTranslate.isMessageTranslated(message.id, config.channel_id)) {
        console.log(`Already translated message ${message.id} to channel ${config.channel_id}, skipping`);
        continue;
      }

      try {
        // Get the target channel first (we need it for typing indicator)
        const targetChannel = await this.client.channels.fetch(config.channel_id).catch(() => null);
        
        if (!targetChannel) {
          console.log(`⚠️ Target channel ${config.channel_id} not found! Deactivating.`);
          this.storageService.autoTranslate.deactivate(config.channel_id);
          continue;
        }

        // Show typing indicator in target channel
        await targetChannel.sendTyping();

        // Translate the message to the target language
        const translatedText = await this.translationService.translateMessage(
          message.content,
          config.target_language,
          {
            discordUserId: message.author.id,
            userName: message.author.username,
            guildId: message.guild.id,
            channelId: message.channel.id,
            guildName: message.guild.name,
            channelName: message.channel.name,
          }
        );

        if (!translatedText) {
          console.log(`Translation to ${config.target_language} returned empty, skipping`);
          continue;
        }

        // Send the message as the original user
        const sentMessage = await this.sendAsUser(
          targetChannel,
          translatedText,
          message.author,
          message.attachments,
          config.webhook_id,
          config.webhook_token
        );

        if (sentMessage) {
          // Track this translation
          this.storageService.autoTranslate.trackTranslation(
            message.id,
            sentMessage.id,
            message.channel.id,
            targetChannel.id,
            config.id,
            true
          );
        }

      } catch (error) {
        console.error(`Error broadcasting to channel ${config.channel_id}:`, error);
      }
    }
  }

  // Send a message as another user using webhooks
  async sendAsUser(channel, content, user, attachments = null, webhookId = null, webhookToken = null) {
    try {
      let webhook;

      // Try to get webhook from cache or provided credentials
      const cacheKey = webhookId || channel.id;
      
      if (this.webhookCache.has(cacheKey)) {
        webhook = this.webhookCache.get(cacheKey);
      } else if (webhookId && webhookToken) {
        // Use provided webhook credentials
        webhook = await this.client.fetchWebhook(webhookId, webhookToken).catch(() => null);
        
        if (!webhook) {
          console.log(`⚠️ Webhook ${webhookId} not found! Might have been deleted.`);
          return null;
        }
        
        this.webhookCache.set(cacheKey, webhook);
      } else {
        // Create a new webhook for this channel
        webhook = await channel.createWebhook({
          name: 'Auto-Translate',
          reason: 'Auto-translate temporary webhook'
        });
        
        this.webhookCache.set(cacheKey, webhook);
      }

      // Send the message via webhook
      const sentMessage = await webhook.send({
        content: content,
        username: user.username,
        avatarURL: user.displayAvatarURL(),
        allowedMentions: { parse: ['users', 'roles'] } // Keep mentions (as discussed)
      });

      return sentMessage;

    } catch (error) {
      console.error('Error sending message via webhook:', error);
      return null;
    }
  }

  // Clean up webhook for a channel
  async cleanupWebhook(channelId) {
    try {
      if (this.webhookCache.has(channelId)) {
        const webhook = this.webhookCache.get(channelId);
        await webhook.delete().catch(() => {});
        this.webhookCache.delete(channelId);
      }
    } catch (error) {
      console.error('Error cleaning up webhook:', error);
    }
  }

  // Cleanup all dead auto-translate channels for a guild
  async cleanupDeadChannels(guildId) {
    const configs = this.storageService.autoTranslate.getByGuildId(guildId);
    let removedCount = 0;

    for (const config of configs) {
      const channelExists = await this.client.channels.fetch(config.channel_id).catch(() => null);
      if (!channelExists) {
        console.log(`🧹 Removing dead channel config: ${config.channel_id}`);
        this.storageService.autoTranslate.deactivate(config.channel_id);
        removedCount++;
      }
    }

    return removedCount;
  }
}

module.exports = AutoTranslateHandler;