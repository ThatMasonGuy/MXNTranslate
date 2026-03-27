// handlers/reactionRoleHandler.js (Fixed with per-user locking to prevent race conditions)
class ReactionRoleHandler {
  constructor(storageService, client) {
    this.storageService = storageService;
    this.client = client;
    // Per-user lock to serialize reaction role processing and prevent race conditions
    this.processingLocks = new Map(); // key: `${configId}:${userId}` -> Promise
  }

  // Acquire a lock for a specific user+config combination
  // Returns a release function that MUST be called when done
  async acquireLock(configId, userId) {
    const lockKey = `${configId}:${userId}`;

    // Wait for any existing operation to finish
    while (this.processingLocks.has(lockKey)) {
      try {
        await this.processingLocks.get(lockKey);
      } catch {
        // Previous operation errored, that's fine, we can proceed
      }
    }

    // Create our lock
    let releaseLock;
    const lockPromise = new Promise((resolve) => {
      releaseLock = resolve;
    });
    this.processingLocks.set(lockKey, lockPromise);

    return () => {
      this.processingLocks.delete(lockKey);
      releaseLock();
    };
  }

  async handleReactionAdd(reaction, user) {
    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      // Check if this message has reaction role config
      const config = this.storageService.reactionRoles.getConfigByMessage(reaction.message.id);
      if (!config) return;

      // Get the role mapping for this emoji BEFORE acquiring lock (fast fail)
      const mapping = this.storageService.reactionRoles.getMappingByEmoji(
        config.id,
        reaction.emoji.name,
        reaction.emoji.id
      );
      if (!mapping) return;

      // Acquire per-user lock to prevent race conditions
      const releaseLock = await this.acquireLock(config.id, user.id);

      try {
        await this._processReactionAdd(reaction, user, config, mapping);
      } finally {
        releaseLock();
      }
    } catch (error) {
      console.error("Error handling reaction role add:", error);
    }
  }

  async _processReactionAdd(reaction, user, config, mapping) {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(mapping.role_id);
    if (!role) {
      console.error(`Role ${mapping.role_id} not found in guild ${guild.id}`);
      return;
    }

    // Check if user already has this specific role
    const userAlreadyHasThisRole = member.roles.cache.has(role.id);

    // Check bot permissions
    const botMember = guild.members.me;
    if (!botMember.permissions.has('ManageRoles')) {
      console.error('Bot missing ManageRoles permission');
      return;
    }

    if (role.position >= botMember.roles.highest.position) {
      console.error(`Cannot manage role ${role.name} - it's above bot's highest role`);
      return;
    }

    // Check if single role mode
    if (config.is_single_role) {
      if (userAlreadyHasThisRole) {
        return; // Already has this exact role, nothing to do
      }

      // Get all role mappings for this config to find previous reactions
      const allMappings = this.storageService.reactionRoles.getRoleMappings(config.id);

      // Remove all OTHER existing assignments for this user
      const currentAssignments = this.storageService.reactionRoles.getUserAssignments(config.id, user.id);

      for (const assignment of currentAssignments) {
        if (assignment.role_id !== role.id) {
          const oldRole = guild.roles.cache.get(assignment.role_id);
          if (oldRole && member.roles.cache.has(oldRole.id)) {
            await member.roles.remove(oldRole).catch(error => {
              console.error('Failed to remove role:', error);
            });
          }

          // Find and remove the corresponding reaction
          const correspondingMapping = allMappings.find(m => m.role_id === assignment.role_id);
          if (correspondingMapping) {
            await this.removeUserReaction(reaction.message, user, correspondingMapping);
          }
        }
      }

      this.storageService.reactionRoles.removeAllUserAssignments(config.id, user.id);
    }

    // Add the new role (only if they don't already have it)
    if (!userAlreadyHasThisRole) {
      await member.roles.add(role);
    }

    // Update nickname if prefix is set and bot has permission
    if (mapping.nickname_prefix && botMember.permissions.has('ManageNicknames')) {
      try {
        const currentNick = member.nickname || member.user.username;
        const cleanNick = currentNick.replace(/^\[.*?\]\s*/, '');
        const newNick = `[${mapping.nickname_prefix}] ${cleanNick}`;

        if (newNick.length <= 32) {
          await member.setNickname(newNick);
        }
      } catch (nickError) {
        console.error('Failed to set nickname:', nickError.message);
      }
    }

    // Record the assignment (only if it's a new role)
    if (!userAlreadyHasThisRole) {
      this.storageService.reactionRoles.addUserAssignment(config.id, user.id, role.id);
      console.log(`✅ Assigned: ${user.username} -> ${role.name}`);
    }
  }

  async removeUserReaction(message, user, mapping) {
    try {
      const targetReaction = message.reactions.cache.find(reaction => {
        if (mapping.emoji_id) {
          return reaction.emoji.id === mapping.emoji_id;
        } else {
          return reaction.emoji.name === mapping.emoji_name;
        }
      });

      if (targetReaction) {
        await targetReaction.users.remove(user.id);
      }
    } catch (error) {
      console.error(`Failed to remove user's reaction ${mapping.emoji_name}:`, error.message);
    }
  }

  async handleReactionRemove(reaction, user) {
    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      // Check if this message has reaction role config
      const config = this.storageService.reactionRoles.getConfigByMessage(reaction.message.id);
      if (!config) return;

      // Get the role mapping for this emoji
      const mapping = this.storageService.reactionRoles.getMappingByEmoji(
        config.id,
        reaction.emoji.name,
        reaction.emoji.id
      );
      if (!mapping) return;

      // Acquire per-user lock (same lock as add, so they don't interleave)
      const releaseLock = await this.acquireLock(config.id, user.id);

      try {
        await this._processReactionRemove(reaction, user, config, mapping);
      } finally {
        releaseLock();
      }
    } catch (error) {
      console.error("Error handling reaction role remove:", error);
    }
  }

  async _processReactionRemove(reaction, user, config, mapping) {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(mapping.role_id);
    if (!role) return;

    // Remove the role if user has it
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      console.log(`🗑️ Removed role: ${role.name} from ${user.username}`);
    }

    // Handle nickname removal if bot has permission
    if (mapping.nickname_prefix && guild.members.me.permissions.has('ManageNicknames')) {
      try {
        const currentNick = member.nickname || member.user.username;
        const prefixPattern = new RegExp(`^\\[${mapping.nickname_prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\s*`);

        if (prefixPattern.test(currentNick)) {
          const newNick = currentNick.replace(prefixPattern, '');
          await member.setNickname(newNick || null);
        }
      } catch (nickError) {
        console.error('Failed to remove nickname prefix:', nickError.message);
      }
    }

    // Remove the assignment record
    this.storageService.reactionRoles.removeUserAssignment(config.id, user.id, role.id);
    console.log(`✅ Removal complete: ${user.username} -x-> ${role.name}`);
  }
}

module.exports = ReactionRoleHandler;