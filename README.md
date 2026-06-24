# Custom Homepage with Discord & Steam Status

A customizable Next.js homepage with Discord server widget and Steam integration.

## Features

- Tab-based navigation
- Discord server widget showing member count
- Steam integration showing recently played games
- Fully customizable sections (text, links, buttons, headers)
- Icon support using emoji
- Responsive design with Tailwind CSS
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
        { "type": "discord", "icon": "💬" },
        { "type": "steam", "icon": "🎮" }
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
| `steam` | Steam profile & recently played games |

## Project Structure

```
├── src/
│   ├── config/
│   │   ├── discord.json      # Discord Server ID
│   │   ├── homepage.json     # Homepage content
│   │   ├── homepage.example.json
│   │   └── steam.json        # Steam API key & ID
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── components/
│       ├── DiscordStatus.tsx
│       ├── SteamStatus.tsx
│       └── Tabs.tsx
├── next.config.ts
├── package.json
└── tsconfig.json
```

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

## License

MIT
