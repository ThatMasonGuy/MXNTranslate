const insertMessage = require('../handlers/messageCreate');
const db = require('../db');

function getLastLoggedMessageId(channelId) {
  const row = db.prepare(
    "SELECT id FROM messages WHERE channel_id = ? ORDER BY timestamp DESC LIMIT 1"
  ).get(channelId);
  return row ? row.id : null;
}

// Batched insert for messages, reactions, and authors
function batchInsertMessages(messages) {
  const insertMsg = db.prepare("SELECT 1 FROM messages WHERE id = ?");
  const insertReaction = db.prepare(`
    INSERT INTO reactions (message_id, emoji_name, emoji_id, count)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(message_id, emoji_name, emoji_id) DO UPDATE SET count = excluded.count
  `);
  const selectReactionId = db.prepare(`
    SELECT id FROM reactions
    WHERE message_id = ? AND emoji_name = ? AND emoji_id IS ?
    ORDER BY id DESC LIMIT 1
  `);
  const insertAuthor = db.prepare(`
    INSERT OR REPLACE INTO authors (id, name, nickname, discriminator, color, is_bot, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertReactionUser = db.prepare(`
    INSERT OR IGNORE INTO reaction_users (reaction_id, user_id)
    VALUES (?, ?)
  `);

  db.transaction((batch) => {
    for (const { msg, reactionsData } of batch) {
      if (!insertMsg.get(msg.id)) {
        try {
          insertMessage(msg); // Your custom handler
          for (const r of reactionsData) {
            insertReaction.run(msg.id, r.emoji_name, r.emoji_id, r.count);
            const reactionIdRow = selectReactionId.get(msg.id, r.emoji_name, r.emoji_id);
            const reactionId = reactionIdRow?.id;

            if (reactionId && r.userList) {
              for (const user of r.userList) {
                try {
                  insertAuthor.run(
                    user.id,
                    user.username,
                    user.username, // No nick from here
                    user.discriminator ?? null,
                    null,
                    user.bot ? 1 : 0,
                    user.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null
                  );
                  insertReactionUser.run(reactionId, user.id);
                } catch (err) {
                  console.error(`Failed to insert reaction user ${user.id}:`, err.message);
                }
              }
            }
          }
        } catch (err) {
          console.error(`Failed to insert message ${msg.id}:`, err.message);
        }
      }
    }
  })(messages);
}

async function backfillChannel(channel, throttleMs = 50) {
  let afterId = getLastLoggedMessageId(channel.id);
  let keepGoing = true;
  let fetchCount = 0;
  let totalAdded = 0;

  while (keepGoing) {
    let options = { limit: 100 };
    if (afterId) options.after = afterId;

    let messages;
    try {
      messages = await channel.messages.fetch(options);
      fetchCount++;
    } catch (err) {
      console.error(`Backfill fetch error in ${channel.name}:`, err);
      break;
    }

    if (!messages || messages.size === 0) break;

    const sorted = Array.from(messages.values()).sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp
    );

    // Prepare for batching
    const batchData = [];
    for (const msg of sorted) {
      // Prepare reaction meta only
      const reactionsData = [];
      if (msg.reactions.cache.size > 0) {
        for (const reaction of msg.reactions.cache.values()) {
          try {
            const userList = await reaction.users.fetch();
            reactionsData.push({
              emoji_name: reaction.emoji.name,
              emoji_id: reaction.emoji.id ?? null,
              count: reaction.count,
              userList: Array.from(userList.values())
            });
          } catch (err) {
            console.error(`Failed to fetch reaction users for ${msg.id}:`, err);
            reactionsData.push({
              emoji_name: reaction.emoji.name,
              emoji_id: reaction.emoji.id ?? null,
              count: reaction.count,
              userList: []
            });
          }
        }
      }
      batchData.push({ msg, reactionsData });
      totalAdded++;
      afterId = msg.id;
    }

    // Batched DB writes
    try {
      batchInsertMessages(batchData);
    } catch (err) {
      console.error(`Batch insert failed for channel ${channel.name}:`, err);
    }

    if (throttleMs > 0) await new Promise(res => setTimeout(res, throttleMs));
    if (sorted.length < 100) break;
  }

  if (totalAdded > 0)
    console.log(`Channel ${channel.name}: Backfilled ${totalAdded} messages in ${fetchCount} fetches.`);
  return totalAdded;
}

// Thread support
async function backfillAllThreads(parentChannel) {
  let threadCount = 0;
  let threadMessageCount = 0;

  if (!parentChannel.threads || typeof parentChannel.threads.fetchActive !== 'function') 
    return { threadCount, threadMessageCount };

  // 1. Fetch all active threads
  try {
    const active = await parentChannel.threads.fetchActive();
    for (const thread of active.threads.values()) {
      threadCount++;
      const before = threadMessageCount;
      const count = await backfillChannel(thread);
      threadMessageCount += count || 0;
      console.log(`  ↳ Thread '${thread.name}': Backfilled ${threadMessageCount - before} messages.`);
    }
  } catch (err) {
    console.warn(`Failed to fetch active threads for ${parentChannel.name}:`, err);
  }

  // 2. Fetch archived public threads
  try {
    const archived = await parentChannel.threads.fetchArchived({ limit: 100 });
    for (const thread of archived.threads.values()) {
      threadCount++;
      const before = threadMessageCount;
      const count = await backfillChannel(thread);
      threadMessageCount += count || 0;
      console.log(`  ↳ Archived thread '${thread.name}': Backfilled ${threadMessageCount - before} messages.`);
    }
  } catch (err) {
    console.warn(`Failed to fetch archived threads for ${parentChannel.name}:`, err);
  }

  // 3. Fetch archived private threads
  if (typeof parentChannel.threads.fetchPrivateArchived === "function") {
    try {
      const privArchived = await parentChannel.threads.fetchPrivateArchived({ limit: 100 });
      for (const thread of privArchived.threads.values()) {
        threadCount++;
        const before = threadMessageCount;
        const count = await backfillChannel(thread);
        threadMessageCount += count || 0;
        console.log(`  ↳ Private archived thread '${thread.name}': Backfilled ${threadMessageCount - before} messages.`);
      }
    } catch (err) {
      console.warn(`Failed to fetch private archived threads for ${parentChannel.name}:`, err);
    }
  }

  return { threadCount, threadMessageCount };
}

// Main syncBackfill function
async function syncBackfill(client) {
  const textChannels = [];
  let grandThreadCount = 0;
  let grandThreadMessageCount = 0;
  
  client.guilds.cache.forEach(guild => {
    guild.channels.cache.forEach(channel => {
      if (
        channel.isTextBased() &&
        channel.viewable &&
        (channel.type === 0 || channel.type === 5)
      ) {
        textChannels.push(channel);
      }
    });
  });

  for (const channel of textChannels) {
    try {
      console.log(`Backfilling channel: ${channel.name} (${channel.id})`);
      await backfillChannel(channel);

      // Backfill all threads for this channel
      const { threadCount, threadMessageCount } = await backfillAllThreads(channel);
      if (threadCount > 0)
        console.log(`  ↳ ${threadCount} threads backfilled in ${channel.name} (${threadMessageCount} messages)`);
      grandThreadCount += threadCount;
      grandThreadMessageCount += threadMessageCount;
    } catch (e) {
      console.error(`Error backfilling ${channel.name}:`, e);
    }
  }

  console.log(`Backfill complete. ${grandThreadCount} threads and ${grandThreadMessageCount} thread messages backfilled.`);
}

module.exports = syncBackfill;
