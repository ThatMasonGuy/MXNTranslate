-- Add all message metadata tables and columns
-- Run this BEFORE the nuclear backfill

-- Add columns to messages table
ALTER TABLE messages ADD COLUMN webhook_id TEXT;
ALTER TABLE messages ADD COLUMN application_id TEXT;
ALTER TABLE messages ADD COLUMN flags INTEGER DEFAULT 0;

-- Mentions table (users, roles, channels)
CREATE TABLE IF NOT EXISTS message_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  mention_type TEXT NOT NULL, -- 'user', 'role', 'channel', 'everyone', 'here'
  mentioned_id TEXT, -- user/role/channel ID (NULL for everyone/here)
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_message_mentions_message_id ON message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_type ON message_mentions(mention_type);
CREATE INDEX IF NOT EXISTS idx_message_mentions_mentioned_id ON message_mentions(mentioned_id);

-- Interaction metadata (slash commands)
CREATE TABLE IF NOT EXISTS message_interactions (
  message_id TEXT PRIMARY KEY,
  interaction_id TEXT NOT NULL,
  interaction_type INTEGER,
  command_name TEXT,
  user_id TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_message_interactions_user ON message_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_interactions_command ON message_interactions(command_name);

-- Message embeds (keeping from before)
CREATE TABLE IF NOT EXISTS message_embeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  type TEXT DEFAULT 'rich',
  title TEXT,
  description TEXT,
  url TEXT,
  color INTEGER,
  timestamp TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  author_name TEXT,
  footer_text TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_message_embeds_message_id ON message_embeds(message_id);

-- Message stickers (keeping from before)
CREATE TABLE IF NOT EXISTS message_stickers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  sticker_id TEXT NOT NULL,
  name TEXT NOT NULL,
  format_type INTEGER,
  UNIQUE(message_id, sticker_id),
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_message_stickers_message_id ON message_stickers(message_id);

SELECT 'All tables and columns created successfully!' as status;