# Custom Homepage with Discord, Steam & Overwatch Status

A customizable Next.js homepage with Discord, Steam, and Overwatch integration.

## Features

- Tab-based navigation
- Discord server widget showing member count
- Discord user presence (activity, status, custom status)
- Steam integration showing recently played games and game library
- Overwatch 2 stats integration (ranks, hero stats, performance metrics)
- Fully customizable sections (text, links, buttons, headers)
- Icon support using emoji
- Responsive design with Tailwind CSS
- Light/dark mode support
- Easy to customize via JSON config files

## Getting Started

### Prerequisites

- Node.js 18+ installed

### Installation

```bash
npm install
npm run dev:full  #or "npm run dev" if discord presence bot is not needed
```

Open [http://localhost:3000](http://localhost:3000) to view your homepage.

## Configuration

### Homepage Settings (`src/config/homepage.json`)

```json
{
  "name": "Your Name",
  "tagline": "Your tagline or bio goes here",
  "tabs": [
    {
      "label": "Home",
      "icon": "🏠",
      "sections": [
        { "type": "header", "title": "Welcome", "icon": "👋" },
        { "type": "text", "content": "Your bio here.", "icon": "📝" }
      ]
    },
    {
      "label": "Gaming",
      "icon": "🎮",
      "sections": [
        { "type": "steam", "icon": "🎮", "text": "Find me on Steam!" },
        { "type": "discord-user", "icon": "👤", "text": "My Discord Status" },
        { "type": "overwatch", "icon": "🎮", "text": "My Overwatch Stats" }
      ]
    },
    {
      "label": "Links",
      "icon": "🔗",
      "sections": [
        { "type": "links", "items": [{ "label": "GitHub", "url": "https://github.com/user", "icon": "🐙" }] },
        { "type": "buttons", "items": [{ "label": "Download", "url": "https://file.pdf", "icon": "📄", "style": "primary" }] }
      ]
    }
  ]
}
```

### Section Types

| Type | Description |
|------|-------------|
| `header` | Big title with icon |
| `text` | Paragraph with icon |
| `links` | Row of link cards |
| `buttons` | Action buttons (primary/secondary) |
| `discord` | Discord server widget |
| `discord-user` | Discord user presence with activity, status, custom status, and elapsed time |
| `steam` | Steam profile, recently played, and top games |
| `overwatch` | Overwatch 2 stats with competitive ranks, hero stats, and performance metrics |
| `markdown` | Renders a markdown file from `content/` directory |
| `meme` | Shows a random meme |

## Components Reference

### DiscordStatus (`discord`)

Displays a Discord server widget showing member count and online presence.

**Config file:** `src/config/discord.json`

```json
{
  "serverId": "YOUR_DISCORD_SERVER_ID"
}
```

**Setup:**
1. Open Discord and go to your server
2. Go to **Server Settings > Widget** (or Engagement)
3. Enable "Enable Server Widget"
4. Copy the **Server ID**

**Features:**
- Member count display
- Online/Offline member counts
- Server name and icon
- Invite link button

---

### DiscordUser (`discord-user`)

Displays detailed Discord user presence including online status, current activity, custom status, and elapsed time.

**Config file:** `src/config/discord-user.json`

```json
{
  "userId": "123456789012345678",
  "botToken": "YOUR_BOT_TOKEN"
}
```

**Setup:**
1. Enable **Developer Mode** in Discord (User Settings > Advanced > Developer Mode)
2. Right-click your username and select **Copy User ID**
3. Create a Discord bot and get its token:
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to **Bot** section
   - Enable **Presence Intent** and **Server Members Intent**
   - Click **Reset Token** and copy the token
4. The bot must be a member of a shared server with your user

**Features:**
- Avatar with Discord-style status dot (online, idle, DND, offline)
- Banner background (from avatar color extraction or user banner)
- Current activity display (game, music, streaming)
- Custom status with emoji
- Elapsed time for current activity
- "Last seen" timestamp when offline
- Music track info with album art (Spotify, YouTube Music)

**Caching:**
- API caches data for 10 seconds
- Changing `userId` in config automatically clears cached data
- The presence bot watches for config changes and re-initializes automatically

**Banner color extraction:**
- Extracts the dominant color using Discord's own algorithm (reverse-engineered by [Vendicated](https://gist.github.com/Vendicated/ad803e9341e9c1110639361f17b58b5b))
- Full-resolution sampling with MMCQ median-cut quantization to 5 colors
- Falls back to Discord's `banner_color` API value or default blurple `#5865F2`

---

### SteamStatus (`steam`)

Displays Steam profile, recently played games, and top games by playtime.

**Config file:** `src/config/steam.json`

```json
{
  "apiKey": "YOUR_STEAM_API_KEY",
  "steamId": "YOUR_STEAM_64_BIT_ID"
}
```

**Setup:**
1. Get a Steam API key: https://steamcommunity.com/dev/apikey
   - Sign in with Steam
   - Register a domain (any domain works for personal use, e.g., `localhost`)
   - Copy the API key
2. Find your Steam 64-bit ID:
   - Go to https://steamcommunity.com/
   - Find your profile name, expand options and copy click **View my profile**
   - Copy the **SteamID64** (64-bit ID) from the URL: https<nolink>://steamcommunity.com/profiles/<Your SteamID64\>/

**Features:**
- Steam profile with avatar and display name
- Online status indicator (Online, In Game, Away, Offline)
- Recently played games (last 2 weeks)
- Top games by total playtime
- Game cards with box art, playtime, and direct Steam store links
- Current game being played with elapsed time

**Caching:**
- API caches data for 10 seconds
- Game box art is fetched from Steam CDN

---

### OverwatchStatus (`overwatch`)

Displays Overwatch competitive ranks, hero statistics, and performance metrics.

**Config file:** `src/config/overwatch.json`

```json
{
  "battleTag": "Username-12345"
}
```

**Setup:**
1. Enter your BattleTag in format `Username-12345` (case-sensitive)
2. Your Overwatch profile must be set to **Public** to display stats

**Features:**
- Competitive ranks for all three roles (Tank, Damage, Support)
- Rank icons with division badges
- Most played heroes (12 heroes by default)
- Per-hero statistics: playtime, winrate, KDA, damage, healing
- Hero portraits and role icons
- General stats summary with eliminations, deaths, healing, damage
- Win/Loss record and overall winrate
- Last updated timestamp

**Role Colors:**
- Tank: `#4785ff` (blue)
- Damage: `#fa9c1e` (orange)
- Support: `#2daf3f` (green)

**Rank Colors:**
- Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Champion

**Caching:**
- API caches data for **24 hours**
- Refreshes automatically around 6 AM local time
- Stats older than 24 hours are considered stale

**API Source:**
- Uses the OverFast API (https://overfast-api.tekrop.fr)

---

### MemeWidget (`meme`)

Displays a random meme from a SQLite database.

**Features:**
- Random meme selection
- Image display with caption
- Reaction buttons (optional)

**Database:**
- Meme data stored in a SQLite database
- Requires `better-sqlite3` package

---

## API Caching

| API | Cache Duration | Notes |
|-----|---------------|-------|
| Discord User | 10 seconds | Clears automatically on userId change |
| Steam | 10 seconds | Game data cached briefly |
| Overwatch | 24 hours | Stats refresh around 6 AM local time |

---

## Customization

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── discord.json          # Discord Server ID (for widget)
│   │   ├── discord-user.json     # Discord User ID & Bot Token (for presence)
│   │   ├── homepage.json         # Homepage content
│   │   ├── homepage.example.json
│   │   ├── steam.json            # Steam API key & ID
│   │   ├── overwatch.json       # BattleTag for Overwatch
│   │   └── *.example.json        # Example configs for reference
│   ├── content/
│   │   └── about.md              # Example markdown file
│   ├── app/
│   │   ├── api/
│   │   │   ├── discord-user/     # Discord presence API (uses presence bot)
│   │   │   ├── discord-server/   # Discord server widget API
│   │   │   ├── steam/            # Steam stats API
│   │   │   └── overwatch/        # Overwatch stats API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── components/
│       ├── DiscordStatus.tsx      # Discord server widget
│       ├── DiscordUser.tsx        # Discord user presence
│       ├── SteamStatus.tsx        # Steam profile & games
│       ├── OverwatchStatus.tsx       # Overwatch stats
│       ├── MemeWidget.tsx         # Random meme display
│       └── Tabs.tsx               # Tab navigation
├── discord-presence.js        # Discord bot for presence updates
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Background Services

### Discord Presence Bot

For Discord user status tracking, run the presence bot:

```bash
npm run presence
```

Or run both homepage and presence bot together:

```bash
npm run dev:full
```

The bot:
- Tracks Discord presence (online, idle, DND, offline)
- Monitors current activity and custom status
- Records "last seen" timestamp when you go offline
- Watches `src/config/discord-user.json` for user ID changes and automatically re-initializes
- Serves data on `http://localhost:3001/presence`

**Hot Reload:**
When you change the `userId` in `discord-user.json`, the bot detects the change and:
1. Resets all cached presence data
2. Immediately starts tracking the new user
3. No restart required

## Customization

### Changing Colors

Edit the gradient in `src/app/page.tsx`:

```tsx
className="bg-gradient-to-br from-gray-900 to-gray-800"
```

### Adding More Tabs

Add more entries to the `tabs` array in `homepage.json`.

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Discord Widget API** - Server info
- **Steam API** - Game library
- **OverFast API** - Overwatch 2 stats

## License

MIT
