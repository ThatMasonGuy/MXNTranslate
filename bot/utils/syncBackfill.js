// utils/syncBackfill.js - Fast incremental backfill for bot restarts
// Only fetches messages AFTER the latest logged message (forward in time)
// Use this on every bot startup to catch messages missed during downtime

const db = require('../db');

function getLastLoggedMessageId(channelId) {
  const row = db.prepare(
    "SELECT id FROM messages WHERE channel_id = ? ORDER BY timestamp DESC LIMIT 1"
  ).get(channelId);
  return row ? row.id : null;
}

// Safe batched insert (preserves edit/delete history)
function batchInsertMessages(messages) {
  const checkMsg = db.prepare("SELECT deleted, edited_timestamp FROM messages WHERE id = ?");
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
  const safeInsertMessage = db.prepare(`
    INSERT OR IGNORE INTO messages
      (id, channel_id, guild_id, author_id, content, timestamp, edited_timestamp, is_pinned, type, deleted, referenced_message_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);
  const insertChannel = db.prepare(`
    INSERT OR REPLACE INTO channels (id, name, type, position, topic, nsfw, last_message_id, parent_id, archived, auto_archive_duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertGuild = db.prepare(`
    INSERT OR REPLACE INTO guilds (id, name, icon, owner_id, region, afk_channel_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAttachment = db.prepare(`
    INSERT OR IGNORE INTO message_attachments (message_id, url, filename, size, content_type)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.transaction((batch) => {
    for (const { msg, reactionsData } of batch) {
      const existing = checkMsg.get(msg.id);
      
      if (!existing) {
        try {
          insertAuthor.run(
            msg.author.id,
            msg.author.username,
            msg.member?.nickname ?? msg.author.username,
            msg.author.discriminator ?? null,
            msg.member?.displayHexColor ?? null,
            msg.author.bot ? 1 : 0,
            msg.author.displayAvatarURL?.({ extension: "png", size: 128 }) ?? null
          );

          insertChannel.run(
            msg.channel.id,
            msg.channel.name ?? null,
            msg.channel.type,
            msg.channel.position ?? null,
            msg.channel.topic ?? null,
            msg.channel.nsfw ? 1 : 0,
            msg.channel.lastMessageId ?? null,
            msg.channel.parentId ?? null,
            msg.channel.archived === undefined ? null : (msg.channel.archived ? 1 : 0),
            msg.channel.autoArchiveDuration ?? null
          );

          insertGuild.run(
            msg.guild.id,
            msg.guild.name,
            msg.guild.icon ?? null,
            msg.guild.ownerId ?? null,
            null,
            msg.guild.afkChannelId ?? null
          );

          safeInsertMessage.run(
            msg.id,
            msg.channel.id,
            msg.guild.id,
            msg.author.id,
            msg.content,
            msg.createdAt.toISOString(),
            null,
            msg.pinned ? 1 : 0,
            msg.type,
            msg.reference?.messageId ?? null
          );

          if (msg.attachments && msg.attachments.size > 0) {
            for (const [, att] of msg.attachments) {
              insertAttachment.run(
                msg.id,
                att.url,
                att.name,
                att.size,
                att.contentType ?? null
              );
            }
          }

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
                    user.username,
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

// Fast forward-only backfill for a single channel using a SNAPSHOTTED last message ID
// This prevents race conditions where real-time logging updates the DB during backfill
async function backfillChannelForwardFromSnapshot(channel, snapshotLastMessageId, throttleMs = 50) {
  let afterId = snapshotLastMessageId;
  let totalAdded = 0;
  let fetchCount = 0;

  // If no messages logged, skip (this is a new channel - handle separately)
  if (!afterId) {
    return 0;
  }

  while (true) {
    let messages;
    try {
      messages = await channel.messages.fetch({ limit: 100, after: afterId });
      fetchCount++;
    } catch (err) {
      console.error(`  ✗ ${channel.name}: Fetch error:`, err.message);
      break;
    }

    if (!messages || messages.size === 0) break;

    const sorted = Array.from(messages.values()).sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp
    );

    const batchData = [];
    for (const msg of sorted) {
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
      afterId = msg.id;
    }

    try {
      batchInsertMessages(batchData);
      totalAdded += batchData.length;
    } catch (err) {
      console.error(`  ✗ ${channel.name}: Batch insert failed:`, err.message);
    }

    if (throttleMs > 0) await new Promise(res => setTimeout(res, throttleMs));
    if (sorted.length < 100) break;
  }

  return totalAdded;
}

// Fast thread backfill (forward only)
async function backfillThreadsForward(parentChannel, throttleMs = 50) {
  let threadCount = 0;
  let threadMessageCount = 0;

  if (!parentChannel.threads || typeof parentChannel.threads.fetchActive !== 'function') {
    return { threadCount, threadMessageCount };
  }

  try {
    const active = await parentChannel.threads.fetchActive();
    for (const thread of active.threads.values()) {
      threadCount++;
      // For threads, snapshot the ID right before processing (small race condition window)
      const threadSnapshotId = getLastLoggedMessageId(thread.id);
      const count = await backfillChannelForwardFromSnapshot(thread, threadSnapshotId, throttleMs);
      threadMessageCount += count;
    }
  } catch (err) {
    console.warn(`  ⚠️  Failed to fetch active threads:`, err.message);
  }

  return { threadCount, threadMessageCount };
}

// Main startup backfill - fast and incremental
async function startupBackfill(client, options = {}) {
  const { throttleMs = 50 } = options;

  console.log('\n' + '='.repeat(70));
  console.log('🚀 STARTUP BACKFILL - Catching up on missed messages');
  console.log('='.repeat(70));

  const guildChannels = new Map(); // guild.name -> [channels]
  const channelSnapshots = new Map(); // channel.id -> last_message_id (SNAPSHOT)
  let totalMessages = 0;
  let totalThreadMessages = 0;
  let channelsWithUpdates = 0;
  let channelsSkipped = 0;

  // Group channels by guild AND snapshot their last message IDs
  // This prevents race condition where real-time logging updates the "last message"
  // while we're still processing earlier channels
  client.guilds.cache.forEach(guild => {
    const channels = [];
    guild.channels.cache.forEach(channel => {
      if (
        channel.isTextBased() &&
        channel.viewable &&
        (channel.type === 0 || channel.type === 5)
      ) {
        channels.push(channel);
        // Snapshot the last logged message ID NOW, before processing
        const lastId = getLastLoggedMessageId(channel.id);
        channelSnapshots.set(channel.id, lastId);
      }
    });
    if (channels.length > 0) {
      guildChannels.set(guild.name, channels);
    }
  });

  const totalChannels = Array.from(guildChannels.values()).reduce((sum, channels) => sum + channels.length, 0);
  console.log(`Checking ${totalChannels} channels across ${guildChannels.size} guilds`);
  console.log(`📸 Snapshotted last message IDs at: ${new Date().toISOString()}\n`);

  // Process each guild
  for (const [guildName, channels] of guildChannels) {
    console.log(`\n📋 ${guildName} (${channels.length} channels)`);
    console.log('─'.repeat(70));
    
    let guildMessages = 0;
    let guildThreadMessages = 0;
    let guildChannelsUpdated = 0;

    for (const channel of channels) {
      try {
        // Use the SNAPSHOTTED last message ID, not the current one
        const snapshotId = channelSnapshots.get(channel.id);
        const count = await backfillChannelForwardFromSnapshot(channel, snapshotId, throttleMs);
        
        if (count > 0) {
          guildChannelsUpdated++;
          channelsWithUpdates++;
          guildMessages += count;
          totalMessages += count;
          console.log(`  ✓ #${channel.name}: Caught up ${count} message${count === 1 ? '' : 's'}`);
        } else {
          if (!snapshotId) {
            channelsSkipped++;
          }
        }

        // Quick thread check
        const { threadMessageCount } = await backfillThreadsForward(channel, throttleMs);
        if (threadMessageCount > 0) {
          guildThreadMessages += threadMessageCount;
          totalThreadMessages += threadMessageCount;
          console.log(`  🧵 #${channel.name} threads: Caught up ${threadMessageCount} message${threadMessageCount === 1 ? '' : 's'}`);
        }

      } catch (e) {
        console.error(`  ✗ #${channel.name}: Error: ${e.message}`);
      }
    }

    // Guild summary
    if (guildMessages > 0 || guildThreadMessages > 0) {
      console.log(`  └─ ${guildName}: ${guildMessages} messages, ${guildThreadMessages} thread messages`);
    } else {
      console.log(`  └─ No new messages`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ STARTUP BACKFILL COMPLETE');
  console.log('='.repeat(70));
  console.log(`📊 Total channels checked: ${totalChannels}`);
  console.log(`📥 Channels with new messages: ${channelsWithUpdates}`);
  console.log(`⏭️  Channels skipped (no history): ${channelsSkipped}`);
  console.log(`💬 New messages caught up: ${totalMessages}`);
  console.log(`🧵 New thread messages: ${totalThreadMessages}`);
  console.log('='.repeat(70) + '\n');

  return { totalMessages, totalThreadMessages, channelsUpdated: channelsWithUpdates };
}

module.exports = startupBackfill;