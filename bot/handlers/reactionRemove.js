const db = require('../db');

module.exports = async function removeReaction(reaction, user) {
  // Fetch full info if partial
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  // Find the reaction id (matching message/emoji)
  const reactionRow = db.prepare(`
    SELECT id, count FROM reactions
    WHERE message_id = ? AND emoji_name = ? AND (emoji_id IS ? OR emoji_id IS NULL)
    ORDER BY id DESC LIMIT 1
  `).get(
    reaction.message.id,
    reaction.emoji.name,
    reaction.emoji.id ?? null
  );

  if (reactionRow) {
    // Only soft-delete: remove user from reaction_users, update count (but never delete the row)
    db.prepare(`
      DELETE FROM reaction_users WHERE reaction_id = ? AND user_id = ?
    `).run(reactionRow.id, user.id);

    // Prevent negative counts
    const newCount = Math.max((reactionRow.count ?? 1) - 1, 0);
    db.prepare(`UPDATE reactions SET count = ? WHERE id = ?`).run(newCount, reactionRow.id);
  }
};
