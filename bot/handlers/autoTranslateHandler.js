// handlers/autoTranslateHandler.js
class AutoTranslateHandler {
  constructor(storageService, translationService, client) {
    this.storageService = storageService;
    this.translationService = translationService;
    this.client = client;
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
      const sourceChannel = await this.client.channels.fetch(config.source_channel_id);
      if (!sourceChannel) {
        console.error(`Source channel ${config.source_channel_id} not found`);
        return;
      }

      // Send the translated message to the source channel using webhook
      const sentMessage = await this.sendViaWebhook(
        sourceChannel,
        message.author,
        translatedText,
        config.target_language
      );

      if (sentMessage) {
        // Track this translation
        this.storageService.autoTranslate.trackTranslation(
          message.id,
          sentMessage.id,
          config.channel_id,
          config.source_channel_id,
          config.id,
          true
        );

        console.log(`✅ Auto-translated message from ${config.target_language} to English in source channel`);
      }

    } catch (error) {
      console.error('Error auto-translating message to English:', error);
    }
  }

  // Handle a message in a watched channel (translate to all watching auto-translate channels)
  async handleMessageInWatchedChannel(message, watchingConfigs) {
    try {
      // Check if this message is already an auto-translation
      if (this.storageService.autoTranslate.isAutoTranslation(message.id)) {
        console.log(`Message ${message.id} is already an auto-translation, will forward to other auto-translate channels`);
      }

      console.log(`📡 Broadcasting message to ${watchingConfigs.length} auto-translate channel(s)`);

      for (const config of watchingConfigs) {
        // Skip if we've already translated this message to this channel
        if (this.storageService.autoTranslate.isMessageTranslated(message.id, config.channel_id)) {
          console.log(`Already translated message ${message.id} to channel ${config.channel_id}, skipping`);
          continue;
        }

        try {
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

          // Get the auto-translate channel
          const autoTranslateChannel = await this.client.channels.fetch(config.channel_id);
          if (!autoTranslateChannel) {
            console.error(`Auto-translate channel ${config.channel_id} not found`);
            continue;
          }

          // Send the translated message using webhook
          const sentMessage = await this.sendViaWebhook(
            autoTranslateChannel,
            message.author,
            translatedText,
            config.target_language,
            config.webhook_id,
            config.webhook_token
          );

          if (sentMessage) {
            // Track this translation
            this.storageService.autoTranslate.trackTranslation(
              message.id,
              sentMessage.id,
              message.channel.id,
              config.channel_id,
              config.id,
              true
            );

            console.log(`✅ Auto-translated message to ${config.target_language} in channel ${config.channel_id}`);
          }

        } catch (error) {
          console.error(`Error translating to ${config.target_language}:`, error);
        }
      }

    } catch (error) {
      console.error('Error auto-translating message to watching channels:', error);
    }
  }

  // Send a message via webhook to appear as the original user
  async sendViaWebhook(channel, author, content, languageCode, webhookId = null, webhookToken = null) {
    try {
      let webhook;

      if (webhookId && webhookToken) {
        // Use existing webhook
        try {
          webhook = await this.client.fetchWebhook(webhookId, webhookToken);
        } catch (error) {
          console.log('Existing webhook not found, creating new one');
          webhook = null;
        }
      }

      // Create webhook if needed
      if (!webhook) {
        webhook = await channel.createWebhook({
          name: `Auto-Translate (${languageCode.toUpperCase()})`,
          reason: 'Auto-translate channel webhook'
        });

        console.log(`Created new webhook for channel ${channel.id}`);

        // Store webhook credentials if this is for an auto-translate channel
        const autoTranslateConfig = this.storageService.autoTranslate.getByChannelId(channel.id);
        if (autoTranslateConfig) {
          this.storageService.autoTranslate.updateWebhook(
            channel.id,
            webhook.id,
            webhook.token
          );
        }
      }

      // Send message as the original user
      const sentMessage = await webhook.send({
        content: content,
        username: author.username,
        avatarURL: author.displayAvatarURL({ extension: 'png' })
      });

      return sentMessage;

    } catch (error) {
      console.error('Error sending via webhook:', error);
      
      // Fallback: send as bot with author mention
      try {
        return await channel.send({
          content: `**${author.username}:** ${content}`
        });
      } catch (fallbackError) {
        console.error('Fallback send also failed:', fallbackError);
        return null;
      }
    }
  }

  // Clean up webhook when auto-translate channel is deleted
  async cleanupWebhook(channelId) {
    try {
      const config = this.storageService.autoTranslate.getByChannelId(channelId);
      if (!config || !config.webhook_id) return;

      const webhook = await this.client.fetchWebhook(config.webhook_id, config.webhook_token).catch(() => null);
      if (webhook) {
        await webhook.delete('Auto-translate channel removed');
        console.log(`Cleaned up webhook for channel ${channelId}`);
      }
    } catch (error) {
      console.error('Error cleaning up webhook:', error);
    }
  }
}

module.exports = AutoTranslateHandler;
