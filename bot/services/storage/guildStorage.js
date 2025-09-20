// services/storage/guildStorage.js
class GuildStorage {
  constructor(db) {
    this.db = db;
  }

  async store(guild) {
    if (!guild) return;
    
    this.db.prepare(`
      INSERT OR REPLACE INTO guilds (id, name, icon, owner_id, region, afk_channel_id)
      VALUES (?, ?, ?, ?, ?, ?)
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
