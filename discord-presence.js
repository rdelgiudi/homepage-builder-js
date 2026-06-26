const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

const configPath = path.join(__dirname, 'src/config/discord-user.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch {
  console.error('Could not read config at src/config/discord-user.json');
  process.exit(1);
}

const { userId, botToken } = config;

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

let userPresence = {
  status: 'offline',
  activities: [],
  customStatus: null,
  lastSeen: null,
  lastUpdated: null,
  nickname: null,
};

async function fetchUserPresence() {
  for (const guild of client.guilds.cache.values()) {
    try {
      const member = await guild.members.fetch(userId);
      if (member) {
        if (member.nickname) {
          userPresence.nickname = member.nickname;
        }
        console.log(`Found member, nickname: ${userPresence.nickname || 'none'}`);
        if (member.presence) {
          const customStatusActivity = member.presence.activities.find(
            a => a.type === ActivityType.Custom
          );
          const filteredActivities = member.presence.activities.filter(
            a => a.type !== ActivityType.Custom
          );

          const isOnline = member.presence.status && member.presence.status !== 'offline';
          const lastSeenTimestamp = isOnline
            ? userPresence.lastSeen
            : new Date().toISOString();

          userPresence = {
            status: member.presence.status || 'offline',
            activities: filteredActivities.map(a => ({
              type: a.type,
              name: a.name,
              state: a.state,
              details: a.details,
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
            nickname: userPresence.nickname,
          };
          console.log(`Presence: ${userPresence.status}, Custom: ${userPresence.customStatus?.text || 'none'}`);
        }
        return;
      }
    } catch (err) {
      console.log(`Could not fetch member: ${err.message}`);
    }
  }
}

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Guilds: ${client.guilds.cache.size}`);
  await fetchUserPresence();

  setInterval(async () => {
    console.log('Refreshing member data...');
    await fetchUserPresence();
  }, 60000);
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
  if (newPresence.userId === userId) {
    const guild = client.guilds.cache.get(newPresence.guildId);
    const nickname = guild?.members.cache.get(userId)?.nickname || null;
    const customStatusActivity = newPresence.activities.find(
      a => a.type === ActivityType.Custom
    );
    const filteredActivities = newPresence.activities.filter(
      a => a.type !== ActivityType.Custom
    );

    const isOnline = newPresence.status && newPresence.status !== 'offline';
    const lastSeenTimestamp = isOnline
      ? userPresence.lastSeen
      : new Date().toISOString();

    userPresence = {
      status: newPresence.status || 'offline',
      activities: filteredActivities.map(a => ({
        type: a.type,
        name: a.name,
        state: a.state,
        details: a.details,
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
      nickname,
    };
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
});

client.login(botToken).catch(console.error);
