// services/storage/userPreferenceStorage.js
class UserPreferenceStorage {
  constructor(db) {
    this.db = db;
    this.ensureTable();
  }

  ensureTable() {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS user_language_preferences (
        user_id TEXT PRIMARY KEY,
        language_code TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
  }

  getPreferredLanguage(userId) {
    const result = this.db.prepare(`
      SELECT language_code FROM user_language_preferences WHERE user_id = ?
    `).get(userId);
    return result ? result.language_code : null;
  }

  setPreferredLanguage(userId, languageCode) {
    try {
      this.db.prepare(`
        INSERT INTO user_language_preferences (user_id, language_code, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          language_code = excluded.language_code,
          updated_at = excluded.updated_at
      `).run(userId, languageCode);
      return { success: true };
    } catch (error) {
      console.error('Failed to set language preference:', error);
      return { success: false, error };
    }
  }

  clearPreferredLanguage(userId) {
    try {
      this.db.prepare(`
        DELETE FROM user_language_preferences WHERE user_id = ?
      `).run(userId);
      return { success: true };
    } catch (error) {
      console.error('Failed to clear language preference:', error);
      return { success: false, error };
    }
  }
}

module.exports = UserPreferenceStorage;
