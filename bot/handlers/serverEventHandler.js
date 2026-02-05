// handlers/serverEventHandler.js
class ServerEventHandler {
  constructor(storageService, config) {
    this.storage = storageService;
    this.config = config;
  }

  /**
   * Handle role create
   */
  async handleRoleCreate(role) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logRoleCreate(role);
      console.log(`[SERVER EVENT] Role created: ${role.name} in ${role.guild.name}`);
    } catch (error) {
      console.error('Error logging role create:', error);
    }
  }

  /**
   * Handle role update
   */
  async handleRoleUpdate(oldRole, newRole) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logRoleUpdate(oldRole, newRole);
      console.log(`[SERVER EVENT] Role updated: ${newRole.name} in ${newRole.guild.name}`);
    } catch (error) {
      console.error('Error logging role update:', error);
    }
  }

  /**
   * Handle role delete
   */
  async handleRoleDelete(role) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logRoleDelete(role);
      console.log(`[SERVER EVENT] Role deleted: ${role.name} from ${role.guild.name}`);
    } catch (error) {
      console.error('Error logging role delete:', error);
    }
  }

  /**
   * Handle channel create
   */
  async handleChannelCreate(channel) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;
    if (!channel.guild) return; // Skip DM channels

    try {
      // Store channel in main channels table
      await this.storage.storeChannel(channel);
      
      // Log the event
      this.storage.serverEvents.logChannelCreate(channel);
      console.log(`[SERVER EVENT] Channel created: ${channel.name} in ${channel.guild.name}`);
    } catch (error) {
      console.error('Error logging channel create:', error);
    }
  }

  /**
   * Handle channel update
   */
  async handleChannelUpdate(oldChannel, newChannel) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;
    if (!newChannel.guild) return; // Skip DM channels

    try {
      // Update channel in main channels table
      await this.storage.storeChannel(newChannel);
      
      // Log the event
      this.storage.serverEvents.logChannelUpdate(oldChannel, newChannel);
      console.log(`[SERVER EVENT] Channel updated: ${newChannel.name} in ${newChannel.guild.name}`);
    } catch (error) {
      console.error('Error logging channel update:', error);
    }
  }

  /**
   * Handle channel delete
   */
  async handleChannelDelete(channel) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;
    if (!channel.guild) return; // Skip DM channels

    try {
      this.storage.serverEvents.logChannelDelete(channel);
      console.log(`[SERVER EVENT] Channel deleted: ${channel.name} from ${channel.guild.name}`);
    } catch (error) {
      console.error('Error logging channel delete:', error);
    }
  }

  /**
   * Handle emoji create
   */
  async handleEmojiCreate(emoji) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logEmojiCreate(emoji);
      console.log(`[SERVER EVENT] Emoji created: ${emoji.name} in ${emoji.guild.name}`);
    } catch (error) {
      console.error('Error logging emoji create:', error);
    }
  }

  /**
   * Handle emoji update
   */
  async handleEmojiUpdate(oldEmoji, newEmoji) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logEmojiUpdate(oldEmoji, newEmoji);
      console.log(`[SERVER EVENT] Emoji updated: ${newEmoji.name} in ${newEmoji.guild.name}`);
    } catch (error) {
      console.error('Error logging emoji update:', error);
    }
  }

  /**
   * Handle emoji delete
   */
  async handleEmojiDelete(emoji) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logEmojiDelete(emoji);
      console.log(`[SERVER EVENT] Emoji deleted: ${emoji.name} from ${emoji.guild.name}`);
    } catch (error) {
      console.error('Error logging emoji delete:', error);
    }
  }

  /**
   * Handle sticker create
   */
  async handleStickerCreate(sticker) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logStickerCreate(sticker);
      console.log(`[SERVER EVENT] Sticker created: ${sticker.name} in ${sticker.guild.name}`);
    } catch (error) {
      console.error('Error logging sticker create:', error);
    }
  }

  /**
   * Handle sticker update
   */
  async handleStickerUpdate(oldSticker, newSticker) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logStickerUpdate(oldSticker, newSticker);
      console.log(`[SERVER EVENT] Sticker updated: ${newSticker.name} in ${newSticker.guild.name}`);
    } catch (error) {
      console.error('Error logging sticker update:', error);
    }
  }

  /**
   * Handle sticker delete
   */
  async handleStickerDelete(sticker) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logStickerDelete(sticker);
      console.log(`[SERVER EVENT] Sticker deleted: ${sticker.name} from ${sticker.guild.name}`);
    } catch (error) {
      console.error('Error logging sticker delete:', error);
    }
  }

  /**
   * Handle guild update (name, icon, owner, etc.)
   */
  async handleGuildUpdate(oldGuild, newGuild) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      // Update guild in main guilds table
      await this.storage.guilds.store(newGuild);
      
      // Log the changes
      this.storage.serverEvents.logGuildUpdate(oldGuild, newGuild);
      console.log(`[SERVER EVENT] Guild updated: ${newGuild.name}`);
    } catch (error) {
      console.error('Error logging guild update:', error);
    }
  }

  /**
   * Handle invite create
   */
  async handleInviteCreate(invite) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logInviteCreate(invite);
      console.log(`[SERVER EVENT] Invite created: ${invite.code} in ${invite.guild?.name || 'Unknown'}`);
    } catch (error) {
      console.error('Error logging invite create:', error);
    }
  }

  /**
   * Handle invite delete
   */
  async handleInviteDelete(invite) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logInviteDelete(invite);
      console.log(`[SERVER EVENT] Invite deleted: ${invite.code} from ${invite.guild?.name || 'Unknown'}`);
    } catch (error) {
      console.error('Error logging invite delete:', error);
    }
  }

  /**
   * Handle webhook create
   */
  async handleWebhookCreate(webhook) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logWebhookCreate(webhook);
      console.log(`[SERVER EVENT] Webhook created: ${webhook.name}`);
    } catch (error) {
      console.error('Error logging webhook create:', error);
    }
  }

  /**
   * Handle webhook update
   */
  async handleWebhookUpdate(oldWebhook, newWebhook) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logWebhookUpdate(oldWebhook, newWebhook);
      console.log(`[SERVER EVENT] Webhook updated: ${newWebhook.name}`);
    } catch (error) {
      console.error('Error logging webhook update:', error);
    }
  }

  /**
   * Handle webhook delete
   */
  async handleWebhookDelete(webhook) {
    if (!this.config.storage.enabled || !this.config.storage.logServerEvents) return;

    try {
      this.storage.serverEvents.logWebhookDelete(webhook);
      console.log(`[SERVER EVENT] Webhook deleted: ${webhook.name}`);
    } catch (error) {
      console.error('Error logging webhook delete:', error);
    }
  }
}

module.exports = ServerEventHandler;
