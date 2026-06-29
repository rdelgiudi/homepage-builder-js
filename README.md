# Custom Homepage with Discord, Steam & Overwatch Status

A customizable Next.js homepage with Discord, Steam, and Overwatch integration.

## Features

- Tab-based navigation
- Discord server widget showing member count
- Discord user presence via WebSocket (instant updates, no polling)
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
  "favicon": "https://example.com/favicon.svg",
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

**Config:** `DISCORD_SERVER_ID` environment variable

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

**Config:** `DISCORD_USER_ID` and `DISCORD_BOT_TOKEN` environment variables

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

**Real-time updates:**
- Presence data pushed via WebSocket — instant updates, no polling
- Profile data cached on server for 5 minutes
- Changing `userId` in config automatically re-initializes the presence bot

**Banner color extraction:**
- Extracts the dominant color using Discord's own algorithm (reverse-engineered by [Vendicated](https://gist.github.com/Vendicated/ad803e9341e9c1110639361f17b58b5b))
- Full-resolution sampling with MMCQ median-cut quantization to 5 colors
- Falls back to Discord's `banner_color` API value or default blurple `#5865F2`

---

### SteamStatus (`steam`)

Displays Steam profile, recently played games, and top games by playtime.

**Config:** `STEAM_API_KEY` and `STEAM_ID` environment variables

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

**Config:** `OVERWATCH_BATTLE_TAG` environment variable

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

## Data Flow

| API | Mechanism | Notes |
|-----|-----------|-------|
| Discord User | **WebSocket** (push) | Real-time presence updates via WebSocket with server-side enrichment, 5 min profile cache |
| Steam | **WebSocket** (push, 10s refresh) | Profile and game data pushed via WebSocket |
| Overwatch | **WebSocket** (push, 30s refresh) | Stats and ranks pushed via WebSocket |

---

## Customization

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── homepage.json         # Homepage content (name, tagline, favicon, tabs)
│   │   └── homepage.example.json
│   ├── content/
│   │   ├── about.md              # Example markdown file
│   │   └── about-example.md
│   ├── app/
│   │   ├── api/
│   │   │   ├── discord-server/   # Discord server widget API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── DiscordStatus.tsx      # Discord server widget
│   │   ├── DiscordUser.tsx        # Discord user presence
│   │   ├── SteamStatus.tsx        # Steam profile & games
│   │   ├── OverwatchStatus.tsx       # Overwatch stats
│   │   ├── MemeWidget.tsx         # Random meme display
│   │   └── Tabs.tsx               # Tab navigation
│   ├── hooks/
│   │   └── useWebSocket.ts        # WebSocket connection hook
│   └── types/
│       ├── gray-matter.d.ts
│       └── quantize.d.ts          # Type declaration for quantize
├── discord-presence.js        # Discord bot for presence updates
├── websocket-server.js           # Custom Next.js server with WebSocket
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Background Services

### WebSocket Server

The homepage runs on a custom Next.js server (`websocket-server.js`) with WebSocket support on the same port.

The `dev` script automatically starts the WebSocket server alongside Next.js.

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
- Pushes presence data to the homepage server via **WebSocket** (no polling, no extra ports)
- Watches `DISCORD_USER_ID` env var for user ID changes and automatically re-initializes

**Hot Reload:**
When you change `DISCORD_USER_ID` in `.env`, the bot detects the change and:
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
