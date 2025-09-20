// services/storage/reactionRoleStorage.js (Updated with edit methods)
class ReactionRoleStorage {
  constructor(db) {
    this.db = db;
  }

  // Create new reaction role config
  createConfig(guildId, channelId, messageContent, isSingleRole, createdBy) {
    const result = this.db.prepare(`
      INSERT INTO reaction_role_configs (guild_id, channel_id, message_content, is_single_role, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(guildId, channelId, messageContent, isSingleRole ? 1 : 0, createdBy);

    return result.lastInsertRowid;
  }

  // Update config with message ID after posting
  updateConfigMessageId(configId, messageId) {
    this.db.prepare(`
      UPDATE reaction_role_configs SET message_id = ? WHERE id = ?
    `).run(messageId, configId);
  }

  // Add role mapping to config
  addRoleMapping(configId, emojiName, emojiId, roleId, nicknamePrefix) {
    this.db.prepare(`
      INSERT INTO reaction_role_mappings (config_id, emoji_name, emoji_id, role_id, nickname_prefix)
      VALUES (?, ?, ?, ?, ?)
    `).run(configId, emojiName, emojiId, roleId, nicknamePrefix);
  }

  // Get config by message ID
  getConfigByMessage(messageId) {
    return this.db.prepare(`
      SELECT * FROM reaction_role_configs WHERE message_id = ? AND is_active = 1
    `).get(messageId);
  }

  // Get role mappings for config
  getRoleMappings(configId) {
    return this.db.prepare(`
      SELECT * FROM reaction_role_mappings WHERE config_id = ?
    `).all(configId);
  }

  // Get mapping by emoji
  getMappingByEmoji(configId, emojiName, emojiId) {
    return this.db.prepare(`
      SELECT * FROM reaction_role_mappings 
      WHERE config_id = ? AND emoji_name = ? AND (emoji_id IS ? OR emoji_id IS NULL)
    `).get(configId, emojiName, emojiId);
  }

  // Add user assignment
  addUserAssignment(configId, userId, roleId) {
    this.db.prepare(`
      INSERT OR IGNORE INTO reaction_role_assignments (config_id, user_id, role_id)
      VALUES (?, ?, ?)
    `).run(configId, userId, roleId);
  }

  // Remove user assignment
  removeUserAssignment(configId, userId, roleId) {
    this.db.prepare(`
      DELETE FROM reaction_role_assignments 
      WHERE config_id = ? AND user_id = ? AND role_id = ?
    `).run(configId, userId, roleId);
  }

  // Get user's current assignments for config
  getUserAssignments(configId, userId) {
    return this.db.prepare(`
      SELECT * FROM reaction_role_assignments 
      WHERE config_id = ? AND user_id = ?
    `).all(configId, userId);
  }

  // Remove all user assignments for config (for single role mode)
  removeAllUserAssignments(configId, userId) {
    this.db.prepare(`
      DELETE FROM reaction_role_assignments 
      WHERE config_id = ? AND user_id = ?
    `).run(configId, userId);
  }

  // Get all configs for guild
  getGuildConfigs(guildId) {
    return this.db.prepare(`
      SELECT * FROM reaction_role_configs 
      WHERE guild_id = ? AND is_active = 1 
      ORDER BY created_at DESC
    `).all(guildId);
  }

  // ===== NEW METHODS FOR EDITING =====

  // Get configs created by specific user
  getUserConfigs(guildId, userId) {
    return this.db.prepare(`
      SELECT * FROM reaction_role_configs 
      WHERE guild_id = ? AND created_by = ? AND is_active = 1 
      ORDER BY created_at DESC
    `).all(guildId, userId);
  }

  // Get full config with mappings by ID
  getConfigById(configId) {
    const config = this.db.prepare(`
      SELECT * FROM reaction_role_configs WHERE id = ? AND is_active = 1
    `).get(configId);

    if (config) {
      config.mappings = this.getRoleMappings(configId);
    }

    return config;
  }

  // Update config content
  updateConfigContent(configId, messageContent, isSingleRole) {
    this.db.prepare(`
      UPDATE reaction_role_configs 
      SET message_content = ?, is_single_role = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(messageContent, isSingleRole ? 1 : 0, configId);
  }

  // Delete all role mappings for config (when editing)
  clearRoleMappings(configId) {
    this.db.prepare(`
      DELETE FROM reaction_role_mappings WHERE config_id = ?
    `).run(configId);
  }

  // Update config mode only
  updateConfigMode(configId, isSingleRole) {
    this.db.prepare(`
      UPDATE reaction_role_configs 
      SET is_single_role = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(isSingleRole ? 1 : 0, configId);
  }

  // Check if user owns config
  isConfigOwner(configId, userId) {
    const result = this.db.prepare(`
      SELECT created_by FROM reaction_role_configs WHERE id = ? AND is_active = 1
    `).get(configId);

    return result && result.created_by === userId;
  }

  // Get mapping by role ID
  getMappingByRole(configId, roleId) {
    return this.db.prepare(`
      SELECT * FROM reaction_role_mappings 
      WHERE config_id = ? AND role_id = ?
    `).get(configId, roleId);
  }

  // Deactivate config
  deactivateConfig(configId) {
    this.db.prepare(`
      UPDATE reaction_role_configs SET is_active = 0 WHERE id = ?
    `).run(configId);
  }
}

module.exports = ReactionRoleStorage;