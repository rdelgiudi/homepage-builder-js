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
npm run dev
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
        { "type": "battle-net", "icon": "🎮", "text": "My Overwatch Stats" }
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

### Discord Settings (`src/config/discord.json`)

1. Open Discord
2. Go to **Server Settings > Widget** (or Engagement)
3. Enable "Enable Server Widget"
4. Copy the **Server ID**

```json
{
  "serverId": "YOUR_DISCORD_SERVER_ID"
}
```

### Steam Settings (`src/config/steam.json`)

1. Get a free Steam API key: https://steamcommunity.com/dev/apikey
2. Find your Steam 64-bit ID: https://steamid.io/ (enter your profile URL)

```json
{
  "apiKey": "YOUR_STEAM_API_KEY",
  "steamId": "YOUR_STEAM_64_BIT_ID"
}
```

### Overwatch Settings (`src/config/battle-net.json`)

1. Enter your BattleTag in format `Username-1234`

```json
{
  "battleTag": "YourTag-12345",
  "platform": "pc",
  "region": "us"
}
```

**Note:** Your Overwatch profile must be set to public to display stats.

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
| `battle-net` | Overwatch 2 stats with competitive ranks, hero stats, and performance metrics |
| `markdown` | Renders a markdown file from `content/` directory |
| `meme` | Shows a random meme |

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── discord.json      # Discord Server ID
│   │   ├── homepage.json     # Homepage content
│   │   ├── homepage.example.json
│   │   ├── steam.json        # Steam API key & ID
│   │   └── battle-net.json   # BattleTag for Overwatch
│   ├── content/
│   │   └── about.md          # Example markdown file
│   ├── app/
│   │   ├── api/
│   │   │   ├── discord-user/  # Discord presence API
│   │   │   ├── steam/         # Steam stats API
│   │   │   └── battle-net/    # Overwatch stats API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── components/
│       ├── DiscordStatus.tsx
│       ├── DiscordUser.tsx
│       ├── SteamStatus.tsx
│       ├── BattleStatus.tsx
│       └── Tabs.tsx
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

This starts a local server on port 3001 that tracks Discord presence and activity.

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
