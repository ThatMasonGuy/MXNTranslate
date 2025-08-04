// syncBackfill.js
const insertMessage = require('../handlers/messageCreate');
const db = require('../db');

// Helper: Get the most recent logged message (by timestamp) for a channel
function getLastLoggedMessageId(channelId) {
  const row = db.prepare(
    "SELECT id FROM messages WHERE channel_id = ? ORDER BY timestamp DESC LIMIT 1"
  ).get(channelId);
  return row ? row.id : null;
}

async function backfillChannel(channel, throttleMs = 750) {
  // Find the most recent message in DB
  let afterId = getLastLoggedMessageId(channel.id);
  let keepGoing = true;
  let fetchCount = 0;
  let totalAdded = 0;

  while (keepGoing) {
    let options = { limit: 100 };
    if (afterId) options.after = afterId;

    // Fetch messages newer than afterId (up to 100)
    let messages;
    try {
      messages = await channel.messages.fetch(options);
      fetchCount++;
    } catch (err) {
      console.error(`Backfill fetch error in ${channel.name}:`, err);
      break;
    }

    // If no new messages, break out
    if (!messages || messages.size === 0) break;

    // Discord.js sorts from newest -> oldest, so reverse
    const sorted = Array.from(messages.values()).sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp
    );

    // Insert any missing messages (should all be new, but safe to check)
    for (const msg of sorted) {
      const exists = db.prepare("SELECT 1 FROM messages WHERE id = ?").get(msg.id);
      if (!exists) {
        insertMessage(msg);
        totalAdded++;

        // ---- PATCH: Backfill reactions & users ----
        if (msg.reactions.cache.size > 0) {
          for (const reaction of msg.reactions.cache.values()) {
            // Insert or update the reaction row
            db.prepare(`
              INSERT INTO reactions (message_id, emoji_name, emoji_id, count)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(message_id, emoji_name, emoji_id) DO UPDATE SET count = excluded.count
            `).run(
              msg.id,
              reaction.emoji.name,
              reaction.emoji.id ?? null,
              reaction.count
            );

            // Get the reaction row ID (for reaction_users)
            const reactionIdRow = db.prepare(`
              SELECT id FROM reactions
              WHERE message_id = ? AND emoji_name = ? AND emoji_id IS ?
              ORDER BY id DESC LIMIT 1
            `).get(
              msg.id,
              reaction.emoji.name,
              reaction.emoji.id ?? null
            );
            const reactionId = reactionIdRow?.id;

            // Now fetch users for this reaction
            if (reactionId) {
              let users;
              try {
                users = await reaction.users.fetch();
              } catch (err) {
                console.warn(`Failed to fetch users for reaction on message ${msg.id}:`, err);
                continue;
              }
              for (const user of users.values()) {
                // Upsert author row if necessary
                db.prepare(`
                  INSERT OR REPLACE INTO authors (id, name, nickname, discriminator, color, is_bot, avatar_url)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                  user.id,
                  user.username,
                  user.username, // no nick from here
                  user.discriminator ?? null,
                  null,
                  user.bot ? 1 : 0,
                  user.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null
                );

                db.prepare(`
                  INSERT OR IGNORE INTO reaction_users (reaction_id, user_id)
                  VALUES (?, ?)
                `).run(reactionId, user.id);
              }
            }
          }
        }
        // ---- END PATCH ----
      }
      afterId = msg.id; // advance afterId for next fetch
    }

    // Rate limit: Discord hard rate limit is 50 requests per second, but let's throttle to be safe
    if (throttleMs > 0) await new Promise(res => setTimeout(res, throttleMs));

    // If less than 100 messages, we're done
    if (sorted.length < 100) break;
  }

  if (totalAdded > 0)
    console.log(`Channel ${channel.name}: Backfilled ${totalAdded} messages in ${fetchCount} fetches.`);
  return totalAdded;
}

// --------- THREAD SUPPORT ADDED HERE ---------

async function backfillAllThreads(parentChannel) {
  let threadCount = 0;
  let threadMessageCount = 0;

  if (!parentChannel.threads || typeof parentChannel.threads.fetchActive !== 'function') return { threadCount, threadMessageCount };

  // 1. Fetch all active threads (open/unarchived)
  let active;
  try {
    active = await parentChannel.threads.fetchActive();
  } catch (err) {
    console.warn(`Failed to fetch active threads for ${parentChannel.name}:`, err);
    active = { threads: [] };
  }
  for (const thread of active.threads.values()) {
    threadCount++;
    const before = threadMessageCount;
    const count = await backfillChannel(thread);
    threadMessageCount += count || 0;
    console.log(`  ↳ Thread '${thread.name}': Backfilled ${threadMessageCount - before} messages.`);
  }

  // 2. Fetch archived public threads (including locked)
  let archived;
  try {
    archived = await parentChannel.threads.fetchArchived({ limit: 100 });
  } catch (err) {
    archived = { threads: [] };
  }
  for (const thread of archived.threads.values()) {
    threadCount++;
    const before = threadMessageCount;
    const count = await backfillChannel(thread);
    threadMessageCount += count || 0;
    console.log(`  ↳ Archived thread '${thread.name}': Backfilled ${threadMessageCount - before} messages.`);
  }

  // 3. Fetch archived private threads (if you have permissions)
  if (typeof parentChannel.threads.fetchPrivateArchived === "function") {
    let privArchived;
    try {
      privArchived = await parentChannel.threads.fetchPrivateArchived({ limit: 100 });
    } catch (err) {
      privArchived = { threads: [] };
    }
    for (const thread of privArchived.threads.values()) {
      threadCount++;
      const before = threadMessageCount;
      const count = await backfillChannel(thread);
      threadMessageCount += count || 0;
      console.log(`  ↳ Private archived thread '${thread.name}': Backfilled ${threadMessageCount - before} messages.`);
    }
  }

  return { threadCount, threadMessageCount };
}

// --------- END THREAD SUPPORT ---------

// Main syncBackfill to aggregate thread stats:
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

      // Backfill all threads for this channel and tally up
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
