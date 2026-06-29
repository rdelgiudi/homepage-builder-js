const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const PORT = parseInt(process.env.PRESENCE_PORT, 10) || 3001;

let userId = process.env.DISCORD_USER_ID || '';
const botToken = process.env.DISCORD_BOT_TOKEN || '';

if (!userId || !botToken || userId === 'YOUR_DISCORD_USER_ID') {
  console.error(`[${new Date().toISOString()}] Invalid config: set DISCORD_USER_ID and DISCORD_BOT_TOKEN env vars`);
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
let wss = null;

function buildPresenceFromMember(member, previousNickname) {
  const customStatusActivity = member.presence?.activities.find(
    a => a.type === ActivityType.Custom
  );
  const filteredActivities = (member.presence?.activities || []).filter(
    a => a.type !== ActivityType.Custom
  );

  const isOnline = member.presence?.status && member.presence.status !== 'offline';
  const lastSeenTimestamp = isOnline ? null : (userPresence.lastSeen || new Date().toISOString());

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
    clientStatus: member.presence?.clientStatus || null,
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
        console.log(`[${new Date().toISOString()}] [Discord Presence] Fetched initial presence`);
        broadcastPresence();
        return;
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Could not fetch member: ${err.message}`);
    }
  }
  console.warn(`[${new Date().toISOString()}] User ${userId} not found in any shared guild`);
}

function broadcastPresence() {
  if (!wss) return;
  const message = JSON.stringify({ type: 'presence', data: userPresence });
  let count = 0;
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(message);
      count++;
    }
  });
  console.log(`[${new Date().toISOString()}] [Discord Presence] Relayed to ${count} server(s)`);
}

client.on('clientReady', async () => {
  console.log(`[${new Date().toISOString()}] Discord bot logged in as ${client.user.tag}`);

  wss = new WebSocketServer({ port: PORT });
  console.log(`[${new Date().toISOString()}] Presence WebSocket server running on port ${PORT}`);

  wss.on('connection', (ws) => {
    console.log(`[${new Date().toISOString()}] [Discord Presence] Server connected (${wss.clients.size} total)`);
    if (userPresence.lastUpdated) {
      ws.send(JSON.stringify({ type: 'presence', data: userPresence }));
    }
    ws.on('close', () => {
      console.log(`[${new Date().toISOString()}] [Discord Presence] Server disconnected (${wss.clients.size} remaining)`);
    });
  });

  await fetchUserPresence();

  setInterval(async () => {
    await fetchUserPresence();
  }, 30000);
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
  if (newPresence.userId === userId) {
    const member = newPresence.member;
    if (member) {
      userPresence = buildPresenceFromMember(member, userPresence.nickname);
      broadcastPresence();
    }
  }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (newMember.userId === userId) {
    userPresence.nickname = newMember.nickname || null;
    broadcastPresence();
  }
});

client.on('error', (error) => {
  console.error(`[${new Date().toISOString()}] Discord client error:`, error);
});

client.login(botToken).catch(console.error);
