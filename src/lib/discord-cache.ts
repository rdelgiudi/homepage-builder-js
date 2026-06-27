export let lastPresenceUpdate = 0;

export function invalidateDiscordCache() {
  lastPresenceUpdate = Date.now();
}
