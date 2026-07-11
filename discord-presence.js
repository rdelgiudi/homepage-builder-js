const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
require('dotenv').config();

let userId = process.env.DISCORD_USER_ID || '';
const botToken = process.env.DISCORD_BOT_TOKEN || '';

const presenceCallbacks = new Set();
let client = null;
let userPresence = null;
let fetchInterval = null;
let healthCheckInterval = null;

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

function buildPresenceFromMember(member, previousNickname) {
  const customStatusActivity = member.presence?.activities.find(
    a => a.type === ActivityType.Custom
  );
  const filteredActivities = (member.presence?.activities || []).filter(
    a => a.type !== ActivityType.Custom
  );

  const isOnline = member.presence?.status && member.presence.status !== 'offline';
  const lastSeenTimestamp = isOnline ? null : (userPresence?.lastSeen || new Date().toISOString());

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

function emitPresence() {
  if (!userPresence) return;
  for (const cb of presenceCallbacks) {
    try {
      cb(userPresence);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] Presence callback error:`, e);
    }
  }
}

async function fetchUserPresence() {
  if (!client) return;
  for (const guild of client.guilds.cache.values()) {
    try {
      const member = await guild.members.fetch(userId);
      if (member) {
        userPresence = buildPresenceFromMember(member, userPresence?.nickname);
        console.log(`[${new Date().toISOString()}] [Discord Presence] Fetched initial presence`);
        emitPresence();
        return;
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Could not fetch member: ${err.message}`);
    }
  }
  console.warn(`[${new Date().toISOString()}] User ${userId} not found in any shared guild`);
}

function onPresenceUpdate(callback) {
  presenceCallbacks.add(callback);
  return () => presenceCallbacks.delete(callback);
}

function getCurrentPresence() {
  return userPresence;
}

function clearIntervals() {
  if (fetchInterval) { clearInterval(fetchInterval); fetchInterval = null; }
  if (healthCheckInterval) { clearInterval(healthCheckInterval); healthCheckInterval = null; }
}

function scheduleRestart(delayMs = 5000) {
  clearIntervals();
  if (client) {
    try { client.destroy(); } catch {}
    client = null;
  }
  userPresence = emptyPresence();
  console.log(`[${new Date().toISOString()}] [Discord Presence] Scheduling restart in ${delayMs}ms`);
  setTimeout(() => start().catch(e => {
    console.error(`[${new Date().toISOString()}] [Discord Presence] Restart failed:`, e);
  }), delayMs);
}

function startHealthCheck() {
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  healthCheckInterval = setInterval(() => {
    if (!client) return;
    if (!client.isReady()) {
      console.warn(`[${new Date().toISOString()}] [Discord Presence] Health check: client not ready, restarting`);
      scheduleRestart();
    }
  }, 60000);
}

async function start() {
  if (!userId || !botToken || userId === 'YOUR_DISCORD_USER_ID') {
    console.warn(`[${new Date().toISOString()}] [Discord Presence] DISCORD_USER_ID or DISCORD_BOT_TOKEN not set; presence tracking disabled`);
    return;
  }

  if (client) {
    try { await client.destroy(); } catch {}
    client = null;
  }

  clearIntervals();
  userPresence = emptyPresence();

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.on('clientReady', async () => {
    console.log(`[${new Date().toISOString()}] Discord bot logged in as ${client.user.tag}`);
    await fetchUserPresence();
    if (fetchInterval) clearInterval(fetchInterval);
    fetchInterval = setInterval(fetchUserPresence, 30000);
    startHealthCheck();
  });

  client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (newPresence.userId === userId) {
      const member = newPresence.member;
      if (member && userPresence) {
        userPresence = buildPresenceFromMember(member, userPresence.nickname);
        emitPresence();
      }
    }
  });

  client.on('guildMemberUpdate', (oldMember, newMember) => {
    if (newMember.userId === userId && userPresence) {
      userPresence.nickname = newMember.nickname || null;
      emitPresence();
    }
  });

  client.on('shardDisconnect', (closeEvent) => {
    console.warn(`[${new Date().toISOString()}] [Discord Presence] Shard disconnected (code: ${closeEvent?.code})`);
  });

  client.on('shardReconnecting', () => {
    console.log(`[${new Date().toISOString()}] [Discord Presence] Shard reconnecting...`);
  });

  client.on('shardReady', async () => {
    console.log(`[${new Date().toISOString()}] [Discord Presence] Shard ready, re-fetching presence`);
    await fetchUserPresence();
  });

  client.on('invalidated', () => {
    console.error(`[${new Date().toISOString()}] [Discord Presence] Session invalidated, restarting`);
    scheduleRestart();
  });

  client.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] [Discord Presence] Client error:`, error);
  });

  try {
    await client.login(botToken);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Discord Presence] Login failed, retrying in 30s:`, err.message);
    setTimeout(() => start().catch(() => {}), 30000);
  }
}

async function stop() {
  clearIntervals();
  if (client) {
    try {
      await client.destroy();
    } catch {}
    client = null;
  }
  presenceCallbacks.clear();
  userPresence = null;
}

module.exports = { start, stop, onPresenceUpdate, getCurrentPresence };

if (require.main === module) {
  start().catch((e) => {
    console.error(`[${new Date().toISOString()}] [Discord Presence] Start error:`, e);
  });
}
