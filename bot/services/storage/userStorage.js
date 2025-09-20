// services/storage/userStorage.js
class UserStorage {
  constructor(db) {
    this.db = db;
  }

  async store(user, guildMember = null) {
    // Store user/author
    this.db.prepare(`
      INSERT OR REPLACE INTO authors
        (id, name, nickname, discriminator, color, is_bot, avatar_url, created_at, joined_at, is_webhook)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.username,
      guildMember?.nickname ?? null,
      user.discriminator ?? null,
      guildMember?.displayHexColor ?? null,
      user.bot ? 1 : 0,
      user.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null,
      user.createdAt?.toISOString?.() ?? null,
      guildMember?.joinedAt?.toISOString?.() ?? null,
      user.isWebhook ? 1 : 0
    );

    // Store roles if member info available
    if (guildMember && guildMember.roles) {
      for (const [roleId, role] of guildMember.roles.cache) {
        this.db.prepare(`
          INSERT OR REPLACE INTO roles (id, name, color, position)
          VALUES (?, ?, ?, ?)
        `).run(roleId, role.name, role.hexColor, role.position);
        
        this.db.prepare(`
          INSERT OR IGNORE INTO author_roles (author_id, role_id)
          VALUES (?, ?)
        `).run(user.id, roleId);
      }
    }
  }
}

module.exports = UserStorage;
