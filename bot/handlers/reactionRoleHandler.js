// handlers/reactionRoleHandler.js (Enhanced error handling and permission checks)
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
        // Remove all existing assignments for this user
        const currentAssignments = this.storageService.reactionRoles.getUserAssignments(config.id, user.id);
        
        for (const assignment of currentAssignments) {
          const oldRole = guild.roles.cache.get(assignment.role_id);
          if (oldRole && member.roles.cache.has(oldRole.id)) {
            await member.roles.remove(oldRole).catch(console.error);
          }
        }
        
        this.storageService.reactionRoles.removeAllUserAssignments(config.id, user.id);
      }

      // Add the new role
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
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

      // Record the assignment
      this.storageService.reactionRoles.addUserAssignment(config.id, user.id, role.id);

      console.log(`Added role ${role.name} to ${user.username} via reaction`);

    } catch (error) {
      console.error("Error handling reaction role add:", error);
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

      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      const role = guild.roles.cache.get(mapping.role_id);
      if (!role) return;

      // Remove the role
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
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

      console.log(`Removed role ${role.name} from ${user.username} via reaction`);

    } catch (error) {
      console.error("Error handling reaction role remove:", error);
    }
  }
}

module.exports = ReactionRoleHandler;
