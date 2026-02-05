#!/usr/bin/env node
// scripts/query-events.js
// Quick CLI tool for querying event data
// Usage: node scripts/query-events.js <command> [args]

const path = require('path');
require("dotenv").config({ path: path.join(__dirname, '../.env') });
const Database = require('better-sqlite3');

const dbPath = '/home/mason/discord_data/discord_tracker.db';
const db = new Database(dbPath, { fileMustExist: true, readonly: true });

const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

function formatDate(isoString) {
  return new Date(isoString).toLocaleString();
}

function printTable(rows, title) {
  if (!rows || rows.length === 0) {
    console.log(`\n${title}: No results found\n`);
    return;
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(title);
  console.log('='.repeat(80));
  console.table(rows);
  console.log(`Total: ${rows.length} rows\n`);
}

const commands = {
  // Member events
  'recent-joins': (guildId, days = 7) => {
    const results = db.prepare(`
      SELECT 
        me.timestamp,
        a.name as username,
        me.invite_code,
        inv.name as inviter
      FROM member_events me
      JOIN authors a ON a.id = me.user_id
      LEFT JOIN authors inv ON inv.id = me.inviter_id
      WHERE me.guild_id = ?
        AND me.event_type = 'join'
        AND datetime(me.timestamp) > datetime('now', '-${days} days')
      ORDER BY me.timestamp DESC
    `).all(guildId);
    
    printTable(results, `Recent Member Joins (Last ${days} Days)`);
  },

  'recent-leaves': (guildId, days = 7) => {
    const results = db.prepare(`
      SELECT 
        me.timestamp,
        a.name as username
      FROM member_events me
      JOIN authors a ON a.id = me.user_id
      WHERE me.guild_id = ?
        AND me.event_type = 'leave'
        AND datetime(me.timestamp) > datetime('now', '-${days} days')
      ORDER BY me.timestamp DESC
    `).all(guildId);
    
    printTable(results, `Recent Member Leaves (Last ${days} Days)`);
  },

  'member-churn': (guildId, days = 30) => {
    const results = db.prepare(`
      SELECT 
        DATE(timestamp) as date,
        SUM(CASE WHEN event_type = 'join' THEN 1 ELSE 0 END) as joins,
        SUM(CASE WHEN event_type = 'leave' THEN 1 ELSE 0 END) as leaves,
        SUM(CASE WHEN event_type = 'join' THEN 1 ELSE -1 END) as net_change
      FROM member_events
      WHERE guild_id = ?
        AND datetime(timestamp) > datetime('now', '-${days} days')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `).all(guildId);
    
    printTable(results, `Member Churn (Last ${days} Days)`);
  },

  'user-history': (userId, guildId) => {
    const joins = db.prepare(`
      SELECT timestamp, event_type, invite_code
      FROM member_events
      WHERE user_id = ? AND guild_id = ?
      ORDER BY timestamp DESC
    `).all(userId, guildId);
    
    const updates = db.prepare(`
      SELECT timestamp, update_type, old_value, new_value
      FROM member_updates
      WHERE user_id = ? AND guild_id = ?
      ORDER BY timestamp DESC
      LIMIT 20
    `).all(userId, guildId);
    
    const moderation = db.prepare(`
      SELECT timestamp, action_type, reason
      FROM moderation_events
      WHERE target_user_id = ? AND guild_id = ?
      ORDER BY timestamp DESC
    `).all(userId, guildId);
    
    printTable(joins, 'Member Events');
    printTable(updates, 'Recent Updates');
    printTable(moderation, 'Moderation History');
  },

  // Voice events
  'voice-activity': (guildId, days = 7) => {
    const results = db.prepare(`
      SELECT 
        a.name as username,
        COUNT(*) as total_events,
        SUM(CASE WHEN event_type = 'join' THEN 1 ELSE 0 END) as joins,
        SUM(CASE WHEN streaming = 1 THEN 1 ELSE 0 END) as stream_sessions
      FROM voice_events ve
      JOIN authors a ON a.id = ve.user_id
      WHERE ve.guild_id = ?
        AND datetime(ve.timestamp) > datetime('now', '-${days} days')
      GROUP BY ve.user_id
      ORDER BY total_events DESC
      LIMIT 20
    `).all(guildId);
    
    printTable(results, `Top Voice Users (Last ${days} Days)`);
  },

  'user-voice': (userId, guildId) => {
    const results = db.prepare(`
      SELECT 
        timestamp,
        event_type,
        c.name as channel
      FROM voice_events ve
      LEFT JOIN channels c ON c.id = ve.channel_id
      WHERE ve.user_id = ? AND ve.guild_id = ?
      ORDER BY timestamp DESC
      LIMIT 50
    `).all(userId, guildId);
    
    printTable(results, 'Recent Voice Activity');
  },

  // Server events
  'recent-roles': (guildId) => {
    const results = db.prepare(`
      SELECT timestamp, event_type, role_name, color
      FROM role_events
      WHERE guild_id = ?
      ORDER BY timestamp DESC
      LIMIT 20
    `).all(guildId);
    
    printTable(results, 'Recent Role Events');
  },

  'recent-channels': (guildId) => {
    const results = db.prepare(`
      SELECT timestamp, event_type, channel_name
      FROM channel_events
      WHERE guild_id = ?
      ORDER BY timestamp DESC
      LIMIT 20
    `).all(guildId);
    
    printTable(results, 'Recent Channel Events');
  },

  'guild-history': (guildId) => {
    const results = db.prepare(`
      SELECT timestamp, field_name, old_value, new_value
      FROM guild_events
      WHERE guild_id = ?
      ORDER BY timestamp DESC
      LIMIT 30
    `).all(guildId);
    
    printTable(results, 'Guild Update History');
  },

  'invite-stats': (guildId) => {
    const results = db.prepare(`
      SELECT 
        invite_code,
        MAX(uses) as total_uses,
        MAX(max_uses) as max_uses,
        MIN(timestamp) as created_at
      FROM invite_events
      WHERE guild_id = ? AND event_type = 'create'
      GROUP BY invite_code
      ORDER BY total_uses DESC
      LIMIT 20
    `).all(guildId);
    
    printTable(results, 'Top Invites');
  },

  // Moderation
  'recent-bans': (guildId, days = 30) => {
    const results = db.prepare(`
      SELECT 
        me.timestamp,
        a.name as target,
        m.name as moderator,
        me.reason
      FROM moderation_events me
      JOIN authors a ON a.id = me.target_user_id
      LEFT JOIN authors m ON m.id = me.moderator_id
      WHERE me.guild_id = ?
        AND me.action_type = 'ban'
        AND datetime(me.timestamp) > datetime('now', '-${days} days')
      ORDER BY me.timestamp DESC
    `).all(guildId);
    
    printTable(results, `Recent Bans (Last ${days} Days)`);
  },

  'help': () => {
    console.log(`
Event Tracking Query Tool
=========================

Usage: node scripts/query-events.js <command> [guildId] [args]

MEMBER COMMANDS:
  recent-joins <guildId> [days]     - Recent member joins (default: 7 days)
  recent-leaves <guildId> [days]    - Recent member leaves (default: 7 days)
  member-churn <guildId> [days]     - Daily join/leave stats (default: 30 days)
  user-history <userId> <guildId>   - Complete history for a user

VOICE COMMANDS:
  voice-activity <guildId> [days]   - Top voice users (default: 7 days)
  user-voice <userId> <guildId>     - Voice activity for a specific user

SERVER COMMANDS:
  recent-roles <guildId>            - Recent role create/update/delete
  recent-channels <guildId>         - Recent channel events
  guild-history <guildId>           - Server configuration changes
  invite-stats <guildId>            - Invite usage statistics

MODERATION COMMANDS:
  recent-bans <guildId> [days]      - Recent bans (default: 30 days)

Examples:
  node scripts/query-events.js recent-joins 123456789
  node scripts/query-events.js voice-activity 123456789 14
  node scripts/query-events.js user-history 987654321 123456789
    `);
  }
};

// Execute command
if (!command || command === 'help' || !commands[command]) {
  commands.help();
} else {
  try {
    commands[command](arg1, arg2);
  } catch (error) {
    console.error(`Error executing command: ${error.message}`);
    console.log('\nRun "node scripts/query-events.js help" for usage information');
  }
}

db.close();