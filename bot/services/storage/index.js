// services/storage/index.js (Updated to include reaction roles and event tracking)
const MessageStorage = require('./messageStorage');
const ReactionStorage = require('./reactionStorage');
const UserStorage = require('./userStorage');
const GuildStorage = require('./guildStorage');
const TranslationStorage = require('./translationStorage');
const ReactionRoleStorage = require('./reactionRoleStorage');
const TranslationConfigStorage = require('./translationConfigStorage');
const AutoTranslateStorage = require('./autoTranslateStorage');
const UserEventStorage = require('./userEventStorage');
const ServerEventStorage = require('./serverEventStorage');

class StorageService {
  constructor(db, config) {
    this.db = db;
    this.config = config;
    this.messages = new MessageStorage(db);
    this.reactions = new ReactionStorage(db);
    this.users = new UserStorage(db);
    this.guilds = new GuildStorage(db);
    this.translations = new TranslationStorage(db);
    this.reactionRoles = new ReactionRoleStorage(db);
    this.translationConfig = new TranslationConfigStorage(db);
    this.autoTranslate = new AutoTranslateStorage(db);
    this.userEvents = new UserEventStorage(db);
    this.serverEvents = new ServerEventStorage(db);
  }

  async storeMessage(msg) {
    if (!this.config.storage.enabled || !this.config.storage.logMessages) return;
    
    try {
      await this.users.store(msg.author, msg.member);
      await this.guilds.store(msg.guild);
      await this.storeChannel(msg.channel);
      await this.messages.store(msg);
      
      return { success: true };
    } catch (error) {
      console.error('Storage error:', error);
      return { success: false, error };
    }
  }

  async storeReaction(reaction, user, guildMember = null) {
    if (!this.config.storage.enabled || !this.config.storage.logReactions) return;
    
    try {
      await this.users.store(user, guildMember);
      const result = await this.reactions.store(reaction, user);
      return { success: true, reactionId: result.reactionId };
    } catch (error) {
      console.error('Reaction storage error:', error);
      return { success: false, error };
    }
  }

  async updateMessage(oldMsg, newMsg) {
    if (!this.config.storage.enabled || !this.config.storage.logEdits) return;
    return this.messages.logEdit(oldMsg, newMsg);
  }

  async markMessageDeleted(msg) {
    if (!this.config.storage.enabled || !this.config.storage.logDeletes) return;
    return this.messages.markDeleted(msg);
  }

  async removeReaction(reaction, user) {
    if (!this.config.storage.enabled) return;
    return this.reactions.remove(reaction, user);
  }

  async storeChannel(channel) {
    this.db.prepare(`
      INSERT OR REPLACE INTO channels (id, name, type, position, topic, nsfw, last_message_id, parent_id, archived, auto_archive_duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      channel.id,
      channel.name ?? null,
      channel.type,
      channel.position ?? null,
      channel.topic ?? null,
      channel.nsfw ? 1 : 0,
      channel.lastMessageId ?? null,
      channel.parentId ?? null,
      channel.archived === undefined ? null : (channel.archived ? 1 : 0),
      channel.autoArchiveDuration ?? null
    );
  }

  getStats() {
    try {
      const basicStats = this.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM guilds) AS guildCount,
          (SELECT COUNT(*) FROM authors) AS authorCount,
          (SELECT COUNT(*) FROM messages) AS messageCount,
          (SELECT COUNT(*) FROM reactions) AS reactionCount
      `).get();

      const translationStats = this.translations.getStats();
      
      // Add reaction role stats if table exists
      let reactionRoleStats = {};
      try {
        reactionRoleStats = this.db.prepare(`
          SELECT
            (SELECT COUNT(*) FROM reaction_role_configs WHERE is_active = 1) AS activeReactionRoleConfigs,
            (SELECT COUNT(*) FROM reaction_role_assignments) AS totalReactionRoleAssignments
        `).get() || {};
      } catch (error) {
        // Table doesn't exist yet
      }
      
      return { ...basicStats, ...translationStats, ...reactionRoleStats };
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = StorageService;