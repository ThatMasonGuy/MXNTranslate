// handlers/reactionProtectionHandler.js (NEW FILE - handles auto-removal of unauthorized reactions)
class ReactionProtectionHandler {
  constructor(storageService, client) {
    this.storageService = storageService;
    this.client = client;
  }

  async handleUnauthorizedReaction(reaction, user) {
    if (user.bot) return; // Don't remove bot reactions
    
    // Check if this message has reaction role protection
    if (!this.client.reactionRoleProtection) return;
    
    const allowedReactions = this.client.reactionRoleProtection.get(reaction.message.id);
    if (!allowedReactions) return;

    // Check if this emoji is allowed
    const isAllowed = allowedReactions.some(allowed => {
      if (allowed.id) {
        // Custom emoji - match by ID
        return reaction.emoji.id === allowed.id;
      } else {
        // Unicode emoji - match by name
        return reaction.emoji.name === allowed.name;
      }
    });

    if (!isAllowed) {
      try {
        // Remove the unauthorized reaction
        await reaction.users.remove(user.id);
        console.log(`Removed unauthorized reaction ${reaction.emoji.name} from ${user.username} on protected message ${reaction.message.id}`);
      } catch (error) {
        console.error('Failed to remove unauthorized reaction:', error);
      }
    }
  }

  // Load protection data from database on bot startup
  async loadProtectionData() {
    try {
      const configs = this.storageService.db.prepare(`
        SELECT rrc.message_id, rrm.emoji_name, rrm.emoji_id
        FROM reaction_role_configs rrc
        JOIN reaction_role_mappings rrm ON rrc.id = rrm.config_id
        WHERE rrc.is_active = 1 AND rrc.message_id IS NOT NULL
      `).all();

      if (!this.client.reactionRoleProtection) {
        this.client.reactionRoleProtection = new Map();
      }

      // Group by message ID
      const messageGroups = {};
      for (const config of configs) {
        if (!messageGroups[config.message_id]) {
          messageGroups[config.message_id] = [];
        }
        messageGroups[config.message_id].push({
          name: config.emoji_name,
          id: config.emoji_id,
          full: config.emoji_id ? `<:${config.emoji_name}:${config.emoji_id}>` : config.emoji_name
        });
      }

      // Set protection for each message
      for (const [messageId, allowedEmojis] of Object.entries(messageGroups)) {
        this.client.reactionRoleProtection.set(messageId, allowedEmojis);
      }

      console.log(`Loaded reaction role protection for ${Object.keys(messageGroups).length} messages`);
    } catch (error) {
      console.error('Failed to load reaction role protection data:', error);
    }
  }
}

module.exports = ReactionProtectionHandler;
