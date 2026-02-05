// services/storage/guildStorage.js
class GuildStorage {
  constructor(db) {
    this.db = db;
  }

  async store(guild) {
    if (!guild) return;
    
    // FIXED: Use INSERT ... ON CONFLICT DO UPDATE instead of INSERT OR REPLACE
    // This prevents ON DELETE CASCADE from triggering and deleting related records
    this.db.prepare(`
      INSERT INTO guilds (id, name, icon, owner_id, region, afk_channel_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        icon = excluded.icon,
        owner_id = excluded.owner_id,
        region = excluded.region,
        afk_channel_id = excluded.afk_channel_id
    `).run(
      guild.id,
      guild.name,
      guild.icon ?? null,
      guild.ownerId ?? null,
      null,
      guild.afkChannelId ?? null
    );
  }
}

module.exports = GuildStorage;