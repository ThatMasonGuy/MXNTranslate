-- Add embeds and stickers tables
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

SELECT 'Tables created successfully!' as status;