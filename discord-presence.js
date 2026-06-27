const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const HOMEPAGE_URL = 'http://localhost:3000';

const configPath = path.join(__dirname, 'src/config/discord-user.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch {
  console.error('Could not read config at src/config/discord-user.json');
  process.exit(1);
}

let userId = config.userId;
const botToken = config.botToken;

if (!userId || !botToken || userId === 'YOUR_DISCORD_USER_ID') {
  console.error('Invalid config: userId and botToken are required');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
  ],
});

function emptyPresence() {
  return {
    status: 'offline',
    activities: [],
    customStatus: null,
    lastSeen: null,
    lastUpdated: null,
    nickname: null,
    trackedUserId: userId,
  };
}

let userPresence = emptyPresence();

function buildPresenceFromMember(member, previousNickname) {
  const customStatusActivity = member.presence?.activities.find(
    a => a.type === ActivityType.Custom
  );
  const filteredActivities = (member.presence?.activities || []).filter(
    a => a.type !== ActivityType.Custom
  );

  const isOnline = member.presence?.status && member.presence.status !== 'offline';
  const lastSeenTimestamp = isOnline || userPresence.lastSeen
    ? userPresence.lastSeen
    : new Date().toISOString();

  return {
    status: member.presence?.status || 'offline',
    activities: filteredActivities.map(a => ({
      type: a.type,
      name: a.name,
      state: a.state,
      details: a.details,
      application_id: a.applicationId || a.application_id || null,
      assets: a.assets ? {
        large_image: a.assets.largeImage || a.assets.large_image || null,
        small_image: a.assets.smallImage || a.assets.small_image || null,
        large_text: a.assets.largeText || a.assets.large_text || null,
        small_text: a.assets.smallText || a.assets.small_text || null,
      } : null,
      timestamps: a.timestamps?.start
        ? { start: a.timestamps.start.getTime(), end: a.timestamps.end?.getTime() }
        : undefined,
    })),
    customStatus: customStatusActivity
      ? {
          text: customStatusActivity.state || null,
          emoji: customStatusActivity.emoji?.name || null,
        }
      : null,
    lastSeen: lastSeenTimestamp,
    lastUpdated: new Date().toISOString(),
    nickname: member.nickname || previousNickname || null,
    trackedUserId: userId,
  };
}

async function fetchUserPresence() {
  for (const guild of client.guilds.cache.values()) {
    try {
      const member = await guild.members.fetch(userId);
      if (member) {
        userPresence = buildPresenceFromMember(member, userPresence.nickname);
        invalidateHomepageCache();
        return;
      }
    } catch (err) {
      console.error(`Could not fetch member: ${err.message}`);
    }
  }
  console.warn(`User ${userId} not found in any shared guild`);
}

function invalidateHomepageCache() {
  const req = http.request(`${HOMEPAGE_URL}/api/discord-user/invalidate`, { method: 'POST' }, (res) => {
    if (res.statusCode !== 200) {
      console.error('Failed to invalidate homepage cache:', res.statusCode);
    }
  });
  req.on('error', (err) => {
    console.error('Failed to invalidate homepage cache:', err.message);
  });
  req.end();
}

client.on('ready', async () => {
  await fetchUserPresence();

  setInterval(async () => {
    await fetchUserPresence();
  }, 10000);
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
  if (newPresence.userId === userId) {
    const guild = client.guilds.cache.get(newPresence.guildId);
    const member = guild?.members.cache.get(userId);
    if (member) {
      userPresence = buildPresenceFromMember(member, userPresence.nickname);
    }
  }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (newMember.userId === userId) {
    userPresence.nickname = newMember.nickname || null;
  }
});

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

function watchConfig() {
  try {
    fs.watch(configPath, { persistent: false }, async (eventType) => {
      if (eventType === 'change') {
        try {
          const newConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (newConfig.userId && newConfig.userId !== userId) {
            console.log(`userId changed: ${userId} -> ${newConfig.userId}`);
            userId = newConfig.userId;
            userPresence = emptyPresence();
            await fetchUserPresence();
          }
        } catch (err) {
          console.error('Error reading updated config:', err.message);
        }
      }
    });
  } catch (err) {
    console.error('Could not watch config file:', err.message);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/presence' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(userPresence));
  } else if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      connected: client.ws.status === 0,
      guilds: client.guilds.cache.size,
      trackedUserId: userId,
    }));
  } else if (req.url === '/debug' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      clientStatus: client.ws.status,
      guilds: client.guilds.cache.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount })),
      userPresence,
    }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Presence server running on http://localhost:${PORT}`);
  watchConfig();
});

client.login(botToken).catch(console.error);
