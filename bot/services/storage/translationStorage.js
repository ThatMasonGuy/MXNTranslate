// services/storage/translationStorage.js
class TranslationStorage {
  constructor(db) {
    this.db = db;
  }

  // Check if translation already exists
  getExistingTranslation(messageId, targetLang) {
    return this.db.prepare(`
      SELECT translated_text, requested_by, created_at 
      FROM translations 
      WHERE message_id = ? AND target_language = ?
    `).get(messageId, targetLang);
  }

  // Store new translation
  storeTranslation(messageId, targetLang, translatedText, requestedBy) {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO translations (message_id, target_language, translated_text, requested_by)
        VALUES (?, ?, ?, ?)
      `).run(messageId, targetLang, translatedText, requestedBy);
      return { success: true };
    } catch (error) {
      console.error('Failed to store translation:', error);
      return { success: false, error };
    }
  }

  // Get translation stats
  getStats() {
    return this.db.prepare(`
      SELECT 
        COUNT(*) as total_translations,
        COUNT(DISTINCT message_id) as unique_messages_translated,
        COUNT(DISTINCT target_language) as languages_used
      FROM translations
    `).get();
  }
}

module.exports = TranslationStorage;
