// services/storage/userEventStorage.js
class UserEventStorage {
  constructor(db) {
    this.db = db;
  }

  /**
   * Log a member join event
   */
  logMemberJoin(member, invite = null) {
    this.db.prepare(`
      INSERT INTO member_events (guild_id, user_id, event_type, timestamp, invite_code, inviter_id)
      VALUES (?, ?, 'join', ?, ?, ?)
    `).run(
      member.guild.id,
      member.user.id,
      new Date().toISOString(),
      invite?.code ?? null,
      invite?.inviter?.id ?? null
    );
  }

  /**
   * Log a member leave event
   */
  logMemberLeave(member) {
    this.db.prepare(`
      INSERT INTO member_events (guild_id, user_id, event_type, timestamp)
      VALUES (?, ?, 'leave', ?)
    `).run(
      member.guild.id,
      member.user.id,
      new Date().toISOString()
    );
  }

  /**
   * Log a member removal (kick/ban)
   */
  logMemberRemove(guildId, userId) {
    this.db.prepare(`
      INSERT INTO member_events (guild_id, user_id, event_type, timestamp)
      VALUES (?, ?, 'remove', ?)
    `).run(
      guildId,
      userId,
      new Date().toISOString()
    );
  }

  /**
   * Log member update (nickname, roles, etc.)
   */
  logMemberUpdate(oldMember, newMember) {
    const updates = [];
    
    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      updates.push({
        type: 'nickname',
        old: oldMember.nickname,
        new: newMember.nickname
      });
    }

    // Avatar change
    if (oldMember.avatar !== newMember.avatar) {
      updates.push({
        type: 'avatar',
        old: oldMember.avatar,
        new: newMember.avatar
      });
    }

    // Timeout change
    if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
      updates.push({
        type: 'timeout',
        old: oldMember.communicationDisabledUntil?.toISOString() ?? null,
        new: newMember.communicationDisabledUntil?.toISOString() ?? null
      });
    }

    // Boost status change
    if (oldMember.premiumSince !== newMember.premiumSince) {
      updates.push({
        type: 'boost',
        old: oldMember.premiumSince?.toISOString() ?? null,
        new: newMember.premiumSince?.toISOString() ?? null
      });
    }

    // Pending member status change
    if (oldMember.pending !== newMember.pending) {
      updates.push({
        type: 'pending',
        old: oldMember.pending ? '1' : '0',
        new: newMember.pending ? '1' : '0'
      });
    }

    // Role changes
    const oldRoles = oldMember.roles.cache.map(r => r.id).sort();
    const newRoles = newMember.roles.cache.map(r => r.id).sort();
    if (JSON.stringify(oldRoles) !== JSON.stringify(newRoles)) {
      const added = newRoles.filter(r => !oldRoles.includes(r));
      const removed = oldRoles.filter(r => !newRoles.includes(r));
      
      updates.push({
        type: 'roles',
        old: JSON.stringify({ roles: oldRoles, removed }),
        new: JSON.stringify({ roles: newRoles, added })
      });
    }

    // Insert all updates
    const stmt = this.db.prepare(`
      INSERT INTO member_updates (guild_id, user_id, update_type, old_value, new_value, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const timestamp = new Date().toISOString();
    for (const update of updates) {
      stmt.run(
        newMember.guild.id,
        newMember.user.id,
        update.type,
        update.old,
        update.new,
        timestamp
      );
    }
  }

  /**
   * Log voice state change
   */
  logVoiceStateUpdate(oldState, newState) {
    const events = [];
    
    // Determine event type
    if (!oldState.channelId && newState.channelId) {
      // Joined a voice channel
      events.push({
        type: 'join',
        channelId: newState.channelId,
        oldChannelId: null
      });
    } else if (oldState.channelId && !newState.channelId) {
      // Left a voice channel
      events.push({
        type: 'leave',
        channelId: null,
        oldChannelId: oldState.channelId
      });
    } else if (oldState.channelId !== newState.channelId) {
      // Moved between channels
      events.push({
        type: 'move',
        channelId: newState.channelId,
        oldChannelId: oldState.channelId
      });
    }

    // Mute/unmute
    if (oldState.mute !== newState.mute) {
      events.push({
        type: newState.mute ? 'mute' : 'unmute',
        channelId: newState.channelId,
        oldChannelId: oldState.channelId
      });
    }

    // Deafen/undeafen
    if (oldState.deaf !== newState.deaf) {
      events.push({
        type: newState.deaf ? 'deafen' : 'undeafen',
        channelId: newState.channelId,
        oldChannelId: oldState.channelId
      });
    }

    // Streaming
    if (oldState.streaming !== newState.streaming) {
      events.push({
        type: newState.streaming ? 'stream_start' : 'stream_stop',
        channelId: newState.channelId,
        oldChannelId: oldState.channelId
      });
    }

    // Insert all events
    const stmt = this.db.prepare(`
      INSERT INTO voice_events (
        guild_id, user_id, channel_id, event_type, old_channel_id, timestamp,
        self_mute, self_deaf, server_mute, server_deaf, streaming, video
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const timestamp = new Date().toISOString();
    for (const event of events) {
      stmt.run(
        newState.guild.id,
        newState.member.user.id,
        event.channelId,
        event.type,
        event.oldChannelId,
        timestamp,
        newState.selfMute ? 1 : 0,
        newState.selfDeaf ? 1 : 0,
        newState.serverMute ? 1 : 0,
        newState.serverDeaf ? 1 : 0,
        newState.streaming ? 1 : 0,
        newState.selfVideo ? 1 : 0
      );
    }
  }

  /**
   * Log moderation event (ban, unban, kick, timeout)
   */
  logModerationEvent(guildId, targetUserId, actionType, moderatorId = null, reason = null, duration = null) {
    this.db.prepare(`
      INSERT INTO moderation_events (guild_id, target_user_id, moderator_id, action_type, reason, duration, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      guildId,
      targetUserId,
      moderatorId,
      actionType,
      reason,
      duration,
      new Date().toISOString()
    );
  }

  /**
   * Get member join/leave history for a user
   */
  getMemberHistory(userId, guildId = null) {
    if (guildId) {
      return this.db.prepare(`
        SELECT * FROM member_events
        WHERE user_id = ? AND guild_id = ?
        ORDER BY timestamp DESC
      `).all(userId, guildId);
    }
    return this.db.prepare(`
      SELECT * FROM member_events
      WHERE user_id = ?
      ORDER BY timestamp DESC
    `).all(userId);
  }

  /**
   * Get all members who joined within a time range
   */
  getMembersJoinedBetween(guildId, startDate, endDate) {
    return this.db.prepare(`
      SELECT * FROM member_events
      WHERE guild_id = ?
        AND event_type = 'join'
        AND timestamp >= ?
        AND timestamp <= ?
      ORDER BY timestamp ASC
    `).all(guildId, startDate, endDate);
  }

  /**
   * Get voice activity for a user
   */
  getVoiceActivity(userId, guildId = null, limit = 50) {
    if (guildId) {
      return this.db.prepare(`
        SELECT * FROM voice_events
        WHERE user_id = ? AND guild_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(userId, guildId, limit);
    }
    return this.db.prepare(`
      SELECT * FROM voice_events
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(userId, limit);
  }

  /**
   * Get moderation history for a user
   */
  getModerationHistory(userId, guildId = null) {
    if (guildId) {
      return this.db.prepare(`
        SELECT * FROM moderation_events
        WHERE target_user_id = ? AND guild_id = ?
        ORDER BY timestamp DESC
      `).all(userId, guildId);
    }
    return this.db.prepare(`
      SELECT * FROM moderation_events
      WHERE target_user_id = ?
      ORDER BY timestamp DESC
    `).all(userId);
  }
}

module.exports = UserEventStorage;
