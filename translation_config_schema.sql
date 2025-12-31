-- Translation Configuration Schema
-- Run this to add the new tables to your existing database

-- Guild-level translation configuration
CREATE TABLE IF NOT EXISTS translation_config (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Blocked channels (where translation reactions are ignored)
CREATE TABLE IF NOT EXISTS blocked_translation_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, channel_id),
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_blocked_channels_guild ON blocked_translation_channels(guild_id);
CREATE INDEX IF NOT EXISTS idx_blocked_channels_channel ON blocked_translation_channels(channel_id);

-- Announcement channel routing (source_channel -> announcement_channel)
CREATE TABLE IF NOT EXISTS announcement_translation_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    source_channel_id TEXT NOT NULL,
    announcement_channel_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, source_channel_id),
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_announcement_channels_guild ON announcement_translation_channels(guild_id);
CREATE INDEX IF NOT EXISTS idx_announcement_channels_source ON announcement_translation_channels(source_channel_id);

-- Auto-translate channel configurations
CREATE TABLE IF NOT EXISTS auto_translate_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE, -- The auto-translate channel
    source_channel_id TEXT NOT NULL, -- The channel being watched
    target_language TEXT NOT NULL, -- Language code (en, es, ja, etc.)
    webhook_id TEXT, -- Discord webhook ID for sending messages
    webhook_token TEXT, -- Discord webhook token
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auto_translate_guild ON auto_translate_channels(guild_id);
CREATE INDEX IF NOT EXISTS idx_auto_translate_channel ON auto_translate_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_auto_translate_source ON auto_translate_channels(source_channel_id);

-- Track translated messages to prevent circular translations
CREATE TABLE IF NOT EXISTS translated_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_message_id TEXT NOT NULL,
    translated_message_id TEXT NOT NULL,
    source_channel_id TEXT NOT NULL,
    target_channel_id TEXT NOT NULL,
    auto_translate_config_id INTEGER,
    is_auto_translation INTEGER DEFAULT 0, -- 1 if from auto-translate, 0 if from reaction
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auto_translate_config_id) REFERENCES auto_translate_channels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_translated_messages_original ON translated_messages(original_message_id);
CREATE INDEX IF NOT EXISTS idx_translated_messages_translated ON translated_messages(translated_message_id);
CREATE INDEX IF NOT EXISTS idx_translated_messages_source ON translated_messages(source_channel_id);
CREATE INDEX IF NOT EXISTS idx_translated_messages_target ON translated_messages(target_channel_id);
