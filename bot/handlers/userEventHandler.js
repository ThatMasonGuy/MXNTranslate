// handlers/userEventHandler.js
class UserEventHandler {
  constructor(storageService, config) {
    this.storage = storageService;
    this.config = config;
  }

  /**
   * Handle member join
   */
  async handleMemberAdd(member) {
    if (!this.config.storage.enabled || !this.config.storage.logUserEvents) return;

    try {
      // Store basic user info first
      await this.storage.users.store(member.user, member);
      
      // Log the join event
      this.storage.userEvents.logMemberJoin(member);
      
      console.log(`[USER EVENT] Member joined: ${member.user.tag} in ${member.guild.name}`);
    } catch (error) {
      console.error('Error logging member join:', error);
    }
  }

  /**
   * Handle member leave
   */
  async handleMemberRemove(member) {
    if (!this.config.storage.enabled || !this.config.storage.logUserEvents) return;

    try {
      this.storage.userEvents.logMemberLeave(member);
      console.log(`[USER EVENT] Member left: ${member.user.tag} from ${member.guild.name}`);
    } catch (error) {
      console.error('Error logging member leave:', error);
    }
  }

  /**
   * Handle member update (nickname, roles, etc.)
   */
  async handleMemberUpdate(oldMember, newMember) {
    console.log('[DEBUG] guildMemberUpdate event fired!', newMember.user.tag);
    
    if (!this.config.storage.enabled || !this.config.storage.logUserEvents) {
      console.log('[DEBUG] Skipped - storage disabled or logUserEvents disabled');
      return;
    }

    try {
      console.log('[DEBUG] About to log member update...');
      
      // Update user storage with latest info
      await this.storage.users.store(newMember.user, newMember);
      
      // Log the changes
      this.storage.userEvents.logMemberUpdate(oldMember, newMember);
      
      console.log(`[USER EVENT] Member updated: ${newMember.user.tag} in ${newMember.guild.name}`);
    } catch (error) {
      console.error('Error logging member update:', error);
    }
  }

  /**
   * Handle voice state update (join/leave/move/mute/etc.)
   */
  async handleVoiceStateUpdate(oldState, newState) {
    if (!this.config.storage.enabled || !this.config.storage.logUserEvents) return;

    try {
      this.storage.userEvents.logVoiceStateUpdate(oldState, newState);
      
      // Log human-readable event
      if (!oldState.channelId && newState.channelId) {
        console.log(`[VOICE] ${newState.member.user.tag} joined ${newState.channel.name}`);
      } else if (oldState.channelId && !newState.channelId) {
        console.log(`[VOICE] ${newState.member.user.tag} left ${oldState.channel.name}`);
      } else if (oldState.channelId !== newState.channelId) {
        console.log(`[VOICE] ${newState.member.user.tag} moved from ${oldState.channel.name} to ${newState.channel.name}`);
      }
    } catch (error) {
      console.error('Error logging voice state update:', error);
    }
  }

  /**
   * Handle ban add
   */
  async handleBanAdd(ban) {
    if (!this.config.storage.enabled || !this.config.storage.logUserEvents) return;

    try {
      this.storage.userEvents.logModerationEvent(
        ban.guild.id,
        ban.user.id,
        'ban',
        null, // Moderator ID will be filled from audit log if available
        ban.reason
      );
      
      console.log(`[MODERATION] User banned: ${ban.user.tag} from ${ban.guild.name}`);
    } catch (error) {
      console.error('Error logging ban:', error);
    }
  }

  /**
   * Handle ban remove
   */
  async handleBanRemove(ban) {
    if (!this.config.storage.enabled || !this.config.storage.logUserEvents) return;

    try {
      this.storage.userEvents.logModerationEvent(
        ban.guild.id,
        ban.user.id,
        'unban',
        null, // Moderator ID will be filled from audit log if available
        null
      );
      
      console.log(`[MODERATION] User unbanned: ${ban.user.tag} from ${ban.guild.name}`);
    } catch (error) {
      console.error('Error logging unban:', error);
    }
  }
}

module.exports = UserEventHandler;