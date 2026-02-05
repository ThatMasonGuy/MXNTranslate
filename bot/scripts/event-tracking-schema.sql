-- ============================================================
-- USER EVENTS SCHEMA
-- ============================================================

-- Member Join/Leave Events
CREATE TABLE IF NOT EXISTS member_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'join', 'leave', 'remove' (kick/ban)
  timestamp TEXT NOT NULL,
  invite_code TEXT, -- if available on join
  inviter_id TEXT, -- who created the invite
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES authors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_member_events_guild ON member_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_member_events_user ON member_events(user_id);
CREATE INDEX IF NOT EXISTS idx_member_events_timestamp ON member_events(timestamp);

-- Member Update Events (nickname, avatar, role changes, etc.)
CREATE TABLE IF NOT EXISTS member_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  update_type TEXT NOT NULL, -- 'nickname', 'avatar', 'roles', 'timeout', 'boost', 'pending'
  old_value TEXT, -- JSON or string of old value
  new_value TEXT, -- JSON or string of new value
  timestamp TEXT NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES authors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_member_updates_guild ON member_updates(guild_id);
CREATE INDEX IF NOT EXISTS idx_member_updates_user ON member_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_member_updates_type ON member_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_member_updates_timestamp ON member_updates(timestamp);

-- Voice State Changes
CREATE TABLE IF NOT EXISTS voice_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel_id TEXT, -- NULL if disconnecting
  event_type TEXT NOT NULL, -- 'join', 'leave', 'move', 'mute', 'unmute', 'deafen', 'undeafen', 'stream_start', 'stream_stop'
  old_channel_id TEXT, -- for moves
  timestamp TEXT NOT NULL,
  self_mute INTEGER DEFAULT 0,
  self_deaf INTEGER DEFAULT 0,
  server_mute INTEGER DEFAULT 0,
  server_deaf INTEGER DEFAULT 0,
  streaming INTEGER DEFAULT 0,
  video INTEGER DEFAULT 0,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES authors(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_voice_events_guild ON voice_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_voice_events_user ON voice_events(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_events_channel ON voice_events(channel_id);
CREATE INDEX IF NOT EXISTS idx_voice_events_timestamp ON voice_events(timestamp);

-- Moderation Events (bans, timeouts, kicks - from audit log)
CREATE TABLE IF NOT EXISTS moderation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  moderator_id TEXT, -- who performed the action
  action_type TEXT NOT NULL, -- 'ban', 'unban', 'kick', 'timeout', 'timeout_remove'
  reason TEXT,
  duration INTEGER, -- timeout duration in seconds
  timestamp TEXT NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES authors(id) ON DELETE CASCADE,
  FOREIGN KEY (moderator_id) REFERENCES authors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_events_guild ON moderation_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_moderation_events_target ON moderation_events(target_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_events_moderator ON moderation_events(moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_events_timestamp ON moderation_events(timestamp);

-- ============================================================
-- SERVER EVENTS SCHEMA
-- ============================================================

-- Role Events (create, update, delete)
CREATE TABLE IF NOT EXISTS role_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  role_name TEXT,
  color TEXT, -- hex color
  permissions TEXT, -- permissions bitfield as string
  position INTEGER,
  mentionable INTEGER,
  hoist INTEGER,
  timestamp TEXT NOT NULL,
  old_values TEXT, -- JSON of changed fields for updates
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_role_events_guild ON role_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_role_events_role ON role_events(role_id);
CREATE INDEX IF NOT EXISTS idx_role_events_timestamp ON role_events(timestamp);

-- Channel Events (create, update, delete)
CREATE TABLE IF NOT EXISTS channel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  channel_name TEXT,
  channel_type INTEGER,
  parent_id TEXT,
  position INTEGER,
  nsfw INTEGER,
  topic TEXT,
  timestamp TEXT NOT NULL,
  old_values TEXT, -- JSON of changed fields for updates
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_channel_events_guild ON channel_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_channel_events_channel ON channel_events(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_events_timestamp ON channel_events(timestamp);

-- Emoji/Sticker Events
CREATE TABLE IF NOT EXISTS emoji_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  emoji_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  emoji_name TEXT,
  animated INTEGER,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_emoji_events_guild ON emoji_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_emoji_events_timestamp ON emoji_events(timestamp);

CREATE TABLE IF NOT EXISTS sticker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  sticker_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  sticker_name TEXT,
  description TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sticker_events_guild ON sticker_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_sticker_events_timestamp ON sticker_events(timestamp);

-- Guild Update Events (name, icon, owner changes, etc.)
CREATE TABLE IF NOT EXISTS guild_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'update', 'boost_level_change', 'vanity_update'
  field_name TEXT, -- what changed: 'name', 'icon', 'owner', 'features', etc.
  old_value TEXT,
  new_value TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guild_events_guild ON guild_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_events_type ON guild_events(event_type);
CREATE INDEX IF NOT EXISTS idx_guild_events_timestamp ON guild_events(timestamp);

-- Invite Events
CREATE TABLE IF NOT EXISTS invite_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  channel_id TEXT,
  inviter_id TEXT,
  event_type TEXT NOT NULL, -- 'create', 'delete'
  max_uses INTEGER,
  max_age INTEGER, -- seconds
  temporary INTEGER,
  uses INTEGER, -- current uses at time of event
  timestamp TEXT NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL,
  FOREIGN KEY (inviter_id) REFERENCES authors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invite_events_guild ON invite_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_invite_events_code ON invite_events(invite_code);
CREATE INDEX IF NOT EXISTS idx_invite_events_timestamp ON invite_events(timestamp);

-- Webhook Events
CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL,
  channel_id TEXT,
  event_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  webhook_name TEXT,
  avatar_url TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_guild ON webhook_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_timestamp ON webhook_events(timestamp);
