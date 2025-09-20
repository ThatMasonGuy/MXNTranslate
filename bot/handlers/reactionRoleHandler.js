// handlers/reactionRoleHandler.js (Enhanced with reaction removal for single mode)
class ReactionRoleHandler {
  constructor(storageService, client) {
    this.storageService = storageService;
    this.client = client;
  }

  async handleReactionAdd(reaction, user) {
    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      // Check if this message has reaction role config
      const config = this.storageService.reactionRoles.getConfigByMessage(reaction.message.id);
      if (!config) return;

      console.log('🔍 CONFIG DEBUG:', {
        messageId: reaction.message.id,
        configId: config.id,
        isSingleRole: config.is_single_role,
        isSingleRoleType: typeof config.is_single_role
      });

      // Get the role mapping for this emoji
      const mapping = this.storageService.reactionRoles.getMappingByEmoji(
        config.id,
        reaction.emoji.name,
        reaction.emoji.id
      );
      if (!mapping) return;

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
      console.log(`👤 User ${user.username} already has role ${role.name}?`, userAlreadyHasThisRole);

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
      console.log('🔍 SINGLE ROLE CHECK:', config.is_single_role, 'Truthy?', !!config.is_single_role);

      if (config.is_single_role) {
        console.log('⚡ SINGLE ROLE MODE ACTIVE');

        if (userAlreadyHasThisRole) {
          console.log('🔄 User already has this role - doing nothing (could optionally remove it)');
          return; // Don't do anything if they already have this role
        }

        // Get all role mappings for this config to find previous reactions
        const allMappings = this.storageService.reactionRoles.getRoleMappings(config.id);

        // Remove all OTHER existing assignments for this user (not including the one they're getting)
        const currentAssignments = this.storageService.reactionRoles.getUserAssignments(config.id, user.id);
        console.log('📋 Current assignments for user:', currentAssignments);

        for (const assignment of currentAssignments) {
          if (assignment.role_id !== role.id) { // Only remove OTHER roles
            const oldRole = guild.roles.cache.get(assignment.role_id);
            if (oldRole && member.roles.cache.has(oldRole.id)) {
              console.log(`🗑️ Removing OTHER role: ${oldRole.name} from ${user.username}`);
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
        console.log('✅ Cleared previous assignments (except current one)');
      } else {
        console.log('🔄 MULTIPLE ROLE MODE - Adding role without removing others');
      }

      // Add the new role (only if they don't already have it)
      if (!userAlreadyHasThisRole) {
        console.log(`➕ Adding role: ${role.name} to ${user.username}`);
        await member.roles.add(role);
      } else {
        console.log(`ℹ️ User already has role: ${role.name} - skipping`);
      }

      // Update nickname if prefix is set and bot has permission
      if (mapping.nickname_prefix && botMember.permissions.has('ManageNicknames')) {
        try {
          const currentNick = member.nickname || member.user.username;
          // Remove any existing prefixes first
          const cleanNick = currentNick.replace(/^\[.*?\]\s*/, '');
          const newNick = `[${mapping.nickname_prefix}] ${cleanNick}`;

          if (newNick.length <= 32) { // Discord nickname limit
            await member.setNickname(newNick);
          }
        } catch (nickError) {
          console.error('Failed to set nickname:', nickError.message);
          // Don't throw error, role assignment still succeeded
        }
      }

      // Record the assignment (only if it's a new role)
      if (!userAlreadyHasThisRole) {
        this.storageService.reactionRoles.addUserAssignment(config.id, user.id, role.id);
        console.log(`✅ Recorded assignment: ${user.username} -> ${role.name}`);
      }

    } catch (error) {
      console.error("Error handling reaction role add:", error);
    }
  }

  // NEW METHOD: Remove user's reaction from message
  async removeUserReaction(message, user, mapping) {
    try {
      // Find the reaction that corresponds to this mapping
      const targetReaction = message.reactions.cache.find(reaction => {
        if (mapping.emoji_id) {
          // Custom emoji - match by ID
          return reaction.emoji.id === mapping.emoji_id;
        } else {
          // Unicode emoji - match by name
          return reaction.emoji.name === mapping.emoji_name;
        }
      });

      if (targetReaction) {
        await targetReaction.users.remove(user.id);
        console.log(`🧹 Removed user's previous reaction: ${mapping.emoji_name} from ${user.username}`);
      }
    } catch (error) {
      console.error(`Failed to remove user's reaction ${mapping.emoji_name}:`, error.message);
      // Don't throw - this is not critical to the role assignment
    }
  }

  async handleReactionRemove(reaction, user) {
    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      console.log(`🔻 REACTION REMOVED: ${user.username} removed ${reaction.emoji.name} from message ${reaction.message.id}`);

      // Check if this message has reaction role config
      const config = this.storageService.reactionRoles.getConfigByMessage(reaction.message.id);
      if (!config) {
        console.log('❌ No reaction role config found for this message');
        return;
      }

      console.log('🔍 REMOVE CONFIG DEBUG:', {
        messageId: reaction.message.id,
        configId: config.id,
        isSingleRole: config.is_single_role,
        emojiBeingRemoved: reaction.emoji.name
      });

      // Get the role mapping for this emoji
      const mapping = this.storageService.reactionRoles.getMappingByEmoji(
        config.id,
        reaction.emoji.name,
        reaction.emoji.id
      );
      if (!mapping) {
        console.log('❌ No role mapping found for this emoji');
        return;
      }

      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        console.log('❌ Could not fetch member from guild');
        return;
      }

      const role = guild.roles.cache.get(mapping.role_id);
      if (!role) {
        console.log(`❌ Role ${mapping.role_id} not found in guild`);
        return;
      }

      console.log(`🎯 Processing role removal: ${role.name} for ${user.username}`);

      // Check if user actually has this role
      const userHasRole = member.roles.cache.has(role.id);
      console.log(`👤 User ${user.username} currently has role ${role.name}?`, userHasRole);

      // Remove the role
      if (userHasRole) {
        console.log(`🗑️ Removing role: ${role.name} from ${user.username}`);
        await member.roles.remove(role);
      } else {
        console.log(`ℹ️ User ${user.username} doesn't have role ${role.name} - nothing to remove`);
      }

      // Handle nickname removal if bot has permission
      if (mapping.nickname_prefix && guild.members.me.permissions.has('ManageNicknames')) {
        console.log(`🏷️ Processing nickname prefix removal: [${mapping.nickname_prefix}]`);
        try {
          const currentNick = member.nickname || member.user.username;
          console.log(`🔍 Current nickname: "${currentNick}"`);

          const prefixPattern = new RegExp(`^\\[${mapping.nickname_prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\s*`);

          if (prefixPattern.test(currentNick)) {
            const newNick = currentNick.replace(prefixPattern, '');
            console.log(`🔍 Setting new nickname: "${newNick}"`);
            await member.setNickname(newNick || null);
            console.log(`✅ Nickname prefix [${mapping.nickname_prefix}] removed successfully`);
          } else {
            console.log(`ℹ️ Nickname doesn't have prefix [${mapping.nickname_prefix}] - no change needed`);
          }
        } catch (nickError) {
          console.error('❌ Failed to remove nickname prefix:', nickError.message);
        }
      } else if (mapping.nickname_prefix) {
        console.log(`⚠️ Cannot remove nickname prefix - bot missing ManageNicknames permission`);
      }

      // Remove the assignment record
      console.log(`🗃️ Removing assignment record: ${user.username} -> ${role.name}`);
      this.storageService.reactionRoles.removeUserAssignment(config.id, user.id, role.id);

      console.log(`✅ REMOVAL COMPLETE: Removed role ${role.name} from ${user.username} via reaction`);

    } catch (error) {
      console.error("❌ Error handling reaction role remove:", error);
    }
  }
}

module.exports = ReactionRoleHandler;