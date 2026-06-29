# Custom Homepage with Discord, Steam & Overwatch Status

A customizable Next.js homepage with Discord, Steam, Overwatch, and GitHub integration.

## Features

- Tab-based navigation
- Discord server widget showing member count
- Discord user presence via WebSocket (instant updates, no polling, mobile indicator)
- Steam integration showing recently played games and game library
- Overwatch 2 stats integration (ranks, hero stats, performance metrics)
- GitHub project cards (via public API, no key needed)
- Fully customizable sections (text, links, buttons, headers)
- Icon support using emoji or image URLs
- Responsive design with Tailwind CSS
- Light/dark mode support
- Easy to customize via JSON config files

## Getting Started

### Prerequisites

- Node.js 18+ installed

### Installation

```bash
npm install
npm run dev:full  # or "npm run dev" if discord presence bot is not needed
```

Open [http://localhost:3000](http://localhost:3000) to view your homepage.

## Configuration

### Homepage Settings (`src/config/homepage.json`)

```json
{
  "name": "Your Name",
  "tagline": "Your tagline or bio goes here",
  "favicon": "https://example.com/favicon.svg",
  "titleGradient": ["#60a5fa", "#a78bfa", "#f472b6", "#a78bfa", "#60a5fa"],
  "taglineGradient": [],
  "backgroundColor": {
    "light": "#f3f4f6",
    "dark": "#111827"
  },
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
      "label": "Projects",
      "icon": "📦",
      "sections": [
        { "type": "github", "icon": "⭐", "text": "Open Source", "repos": [
          { "owner": "user", "repo": "repo-name", "label": "My Project", "note": "A personal note" }
        ]}
      ]
    }
  ]
}
```

**Gradient & background customization:**
- `titleGradient` — Array of color stops for the animated title text gradient. Omit or empty = solid color.
- `taglineGradient` — Color stops for the tagline gradient. Leave empty or omit to inherit `titleGradient` colors.
- `backgroundColor` — Object `{ light: "#f3f4f6", dark: "#111827" }` for page background. Omit or set individual values to keep defaults.

### Section Types

| Type | Description |
|------|-------------|
| `header` | Big title with icon |
| `text` | Paragraph with icon |
| `links` | Row of link cards |
| `buttons` | Action buttons (primary/secondary) |
| `discord` | Discord server widget |
| `discord-user` | Discord user presence with activity, status, custom status, elapsed time, and mobile indicator |
| `steam` | Steam profile, recently played, and top games |
| `overwatch` | Overwatch 2 stats with competitive ranks, hero stats, and performance metrics |
| `markdown` | Renders a markdown file from `content/` directory |
| `meme` | Shows a random meme |
| `github` | GitHub project cards from public repos |

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
- **Mobile indicator** — phone icon replaces status dot when on mobile only, appends " · On Mobile"

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
   - Copy the **SteamID64** (64-bit ID) from the URL

**Features:**
- Steam profile with avatar and display name
- Online status indicator with animated pulse glow (blue for Online, green for In Game)
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

### GitHubProjects (`github`)

Displays GitHub project cards with stars, forks, language, license, and update time.

**Config:** no environment variables needed (uses GitHub's public API)

**Features:**
- Repo name (with optional custom label)
- Optional personal note below the title
- Description (2-line clamp)
- Language with colored dot (GitHub-matching colors)
- Star and fork counts
- License badge (SPDX ID)
- "Updated X ago" (shows years for 12+ month old repos)

**Config example in homepage.json:**
```json
{
  "type": "github",
  "icon": "⭐",
  "text": "Open Source Projects",
  "repos": [
    { "owner": "user", "repo": "my-project", "label": "My Project", "note": "A short personal note" }
  ]
}
```

---

### MemeWidget (`meme`)

Displays a random meme from an external API.

**Config:** no environment variables needed

**Features:**
- Random meme from r/memes subreddit
- Image display with title and subreddit source
- Refresh button for a new meme

---

## Data Flow

| API | Mechanism | Notes |
|-----|-----------|-------|
| Discord User | **WebSocket** (push) | Real-time presence updates via WebSocket with server-side enrichment, 5 min profile cache |
| Steam | **WebSocket** (push, 10s refresh) | Profile and game data pushed via WebSocket |
| Overwatch | **WebSocket** (push, 30s refresh) | Stats and ranks pushed via WebSocket |
| GitHub | **REST** (direct from browser) | Uses unauthenticated `api.github.com` requests in the browser |
| Visitor Counter | **REST** (server API) | SQLite-backed `/api/visitors` with hashed visitor IDs |

---

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── homepage.json            # All site config
│   │   └── homepage.example.json
│   ├── content/
│   │   ├── about.md
│   │   └── about-example.md
│   ├── app/
│   │   ├── api/
│   │   │   ├── markdown/route.ts    # Markdown API
│   │   │   ├── meme/route.ts        # Random meme
│   │   │   └── visitors/route.ts    # Visitor counter (SQLite)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── DiscordStatus.tsx        # Discord server widget
│   │   ├── DiscordUser.tsx          # Discord user presence
│   │   ├── SteamStatus.tsx          # Steam profile & games
│   │   ├── OverwatchStatus.tsx      # Overwatch stats
│   │   ├── MemeWidget.tsx           # Random meme
│   │   ├── MarkdownWidget.tsx       # Markdown renderer
│   │   ├── VisitorCounter.tsx       # Visitor count
│   │   ├── GitHubProjects.tsx       # GitHub repo cards
│   │   └── Tabs.tsx                 # Tab navigation
│   ├── hooks/
│   │   └── useWebSocket.ts          # WebSocket hook (singleton)
│   └── types/
├── discord-presence.js              # Discord.js bot
├── websocket-server.js              # Custom server + WebSocket
├── docker-entrypoint.sh
├── Dockerfile
├── docker-compose-example.yml
├── .env.example
└── next.config.ts
```

## Docker

```bash
npm run docker
```

Single container with:
- Discord presence bot (background)
- WebSocket server + Next.js (foreground)
- Named volume for `visitors.db` persistence
- Optional bind mounts for `src/config/` and `src/content/`

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Discord API** - User presence & server widget
- **Steam API** - Game library
- **OverFast API** - Overwatch 2 stats
- **GitHub API** - Repo data

## License

MIT
