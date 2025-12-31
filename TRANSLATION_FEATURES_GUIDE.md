# Translation Features - User Guide

## 🚀 Setup Instructions

### 1. Run the Database Migration

Before using the new features, you need to add the new database tables:

```bash
node bot/scripts/migrate-translation-features.js
```

This will create the following tables:
- `translation_config` - Guild-level translation settings
- `blocked_translation_channels` - Channels where translation is disabled
- `announcement_translation_channels` - Channel routing for translations
- `auto_translate_channels` - Auto-translate channel configurations
- `translated_messages` - Tracks all auto-translations

### 2. Deploy the New Commands

Update your slash commands to include the new features:

```bash
npm run deploy
# or for global commands:
npm run deploy:global
```

This will register:
- `/translate config` - Admin configuration commands
- `/translate auto` - Auto-translate channel management

---

## ✨ Feature 1: Translation Configuration

### Overview
Admins can now control where and how translations work in their server.

### Commands

#### Block/Unblock Channels
Prevent translation reactions from working in specific channels:

```
/translate config block-channel #channel
/translate config unblock-channel #channel
```

**Use cases:**
- Prevent spam in high-traffic channels
- Disable translation in meme channels
- Keep certain channels English-only

#### Announcement Channel Routing
Route translations from one channel to another:

```
/translate config set-announcement source:#general announcement:#translations
/translate config remove-announcement source:#general
```

**How it works:**
- When someone reacts with a flag emoji in the source channel
- The translation is posted in the announcement channel instead
- The user who reacted is mentioned in the announcement channel
- Original message link is included

**Use cases:**
- Keep main channels clean by routing translations elsewhere
- Create a dedicated translations channel
- Better organization for multilingual communities

#### View Configuration
See all translation settings:

```
/translate config view
```

Shows:
- All blocked channels
- All announcement channel routings

---

## 🌐 Feature 2: Auto-Translate Channels

### Overview
Create channels that automatically translate messages to/from other languages in real-time.

### How It Works

1. **Source → Auto-Translate**
   - Messages in the source channel are automatically translated
   - Translations appear in the auto-translate channel
   - Messages appear as if sent by the original user (via webhooks)

2. **Auto-Translate → Source**
   - Messages sent in the auto-translate channel are translated back to English
   - Translations appear in the source channel
   - Messages appear as if sent by the original user (via webhooks)

3. **Multi-Channel Sync**
   - Multiple auto-translate channels can watch the same source
   - All channels see all messages, each in their own language
   - No circular translation loops (smart tracking prevents re-translating)

### Commands

#### Create Auto-Translate Channel

```
/translate auto create source:#general language:es name:general-español
```

**Parameters:**
- `source` - The channel to watch and translate from
- `language` - Target language (25 languages supported)
- `name` - (Optional) Custom name for the new channel

**What happens:**
- Creates a new channel in the same category as the source
- Sets up a webhook for natural-looking messages
- Starts auto-translating immediately
- Stores configuration in database

**Supported languages:**
Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, Russian, Arabic, Hindi, Turkish, Dutch, Swedish, Norwegian, Danish, Finnish, Polish, Czech, Hungarian, Greek, Hebrew, Thai, Vietnamese, Indonesian

#### Delete Auto-Translate Channel

```
/translate auto delete channel:#general-español
```

**What happens:**
- Removes the auto-translate configuration
- Cleans up the webhook
- Channel itself remains (delete manually if desired)

#### List Auto-Translate Channels

```
/translate auto list
```

Shows all auto-translate channels configured in your server.

### Example Use Cases

#### 1. Bilingual Community
```
Source: #general (English)
Auto-translate: #general-español (Spanish)
```
- English speakers use #general
- Spanish speakers use #general-español
- Both see all messages in their language
- Everyone can participate naturally

#### 2. Multilingual Community
```
Source: #announcements (English)
Auto-translate: #announcements-ja (Japanese)
Auto-translate: #announcements-ko (Korean)
Auto-translate: #announcements-zh (Chinese)
```
- Post once in English
- Automatically appears in all language channels
- Each community sees announcements in their language

#### 3. International Team
```
Source: #team-chat (English)
Auto-translate: #team-chat-fr (French)
Auto-translate: #team-chat-de (German)
```
- Team members use their preferred language channel
- All messages sync across channels
- Natural conversation flow maintained

---

## 🔧 Technical Details

### Message Tracking
The bot tracks translated messages to prevent:
- Duplicate translations
- Circular translation loops
- Re-translating already translated content

### Webhook System
Auto-translate channels use webhooks to:
- Display messages as if sent by the original user
- Maintain natural conversation feel
- Show correct avatars and usernames
- Preserve Discord's threading and reply features

### Performance
- Translations are processed asynchronously
- Multiple auto-translate channels process in parallel
- Database queries are optimized with indexes
- Webhook credentials are cached

### Permissions Required

**For Configuration Commands:**
- `Manage Server` - Required for `/translate config`
- `Manage Channels` - Required for `/translate auto`

**For Bot Operation:**
- `Manage Webhooks` - Required to create webhooks for auto-translate channels
- `Manage Messages` - Required for announcement channel routing
- `Read Message History` - Required to fetch partial messages

---

## 📝 Best Practices

### Translation Configuration
1. Test with announcement channels in a low-traffic area first
2. Clearly communicate blocked channels to your community
3. Consider creating a dedicated #translations channel

### Auto-Translate Channels
1. Name channels clearly (e.g., `general-español`, `announcements-日本語`)
2. Set channel topics to explain the auto-translate feature
3. Use category organization to group language variants together
4. Monitor translation quality and adjust if needed

### Community Guidelines
1. Inform users about auto-translate channels
2. Encourage native language use in auto-translate channels
3. Have moderators familiar with the feature
4. Provide a way to report translation issues

---

## 🐛 Troubleshooting

### Translations Not Appearing
1. Check if the channel is blocked: `/translate config view`
2. Verify bot has permission to send messages
3. Check if webhook still exists (for auto-translate)
4. Review bot logs for errors

### Circular Translation Detected
- This is normal and expected
- The bot automatically prevents circular loops
- Check database for `is_auto_translation` flag

### Webhook Issues
1. Ensure bot has `Manage Webhooks` permission
2. Webhook may have been manually deleted
3. Use `/translate auto delete` and recreate the channel

### Database Issues
- Run migration script if tables don't exist
- Check database file permissions
- Verify database path in `bot/db.js`

---

## 🎯 Future Enhancements (Ideas)

- Web dashboard for configuration
- Per-user language preferences
- Translation quality voting
- Custom translation prompts
- Language detection improvements
- Translation history/logs
- Rate limiting per channel
- Custom webhook avatars
- Translation caching improvements
- Analytics and usage stats

---

## 📞 Support

For issues or questions:
1. Check bot logs: `tail -f /path/to/bot.log`
2. Review database: Use SQLite browser to inspect tables
3. Test permissions: Use Discord's permission calculator
4. Check webhook status: Discord Developer Portal

---

## 🔄 Version History

**v2.0.0** - Translation Features Release
- Added translation configuration commands
- Implemented blocked channels
- Added announcement channel routing
- Created auto-translate channel system
- Built webhook management
- Implemented circular translation prevention
- Added comprehensive database tracking
