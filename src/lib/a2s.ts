/**
 * Valve's A2S_INFO server query over UDP (Source / GoldSrc engine games and the many
 * others that speak it: CS2, TF2, Garry's Mod, Rust, Valheim, ARK, …).
 * https://developer.valvesoftware.com/wiki/Server_queries
 *
 * Only A2S_INFO is used: it fits in one packet. Modern servers first answer with a
 * 4-byte challenge (0x41) that has to be sent back with the request.
 */
import dgram from "node:dgram";
import dns from "node:dns/promises";

const SINGLE_PACKET = 0xffffffff;
const PAYLOAD = Buffer.from("Source Engine Query\0", "latin1");

export interface A2SInfo {
  name: string;
  map: string;
  folder: string;
  game: string;
  appId: number;
  players: number;
  maxPlayers: number;
  bots: number;
  /** `d` dedicated, `l` listen, `p` SourceTV relay. */
  serverType: string;
  /** `l` Linux, `w` Windows, `m`/`o` macOS. */
  environment: string;
  passworded: boolean;
  vac: boolean;
  version: string;
}

export type A2SReply = { kind: "info"; info: A2SInfo } | { kind: "challenge"; challenge: Buffer };

export function infoRequest(challenge?: Buffer): Buffer {
  const header = Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]);
  return Buffer.concat(challenge ? [header, PAYLOAD, challenge] : [header, PAYLOAD]);
}

/** Parses one reply packet. Returns null for anything that isn't a complete single-packet answer. */
export function parseA2SReply(buf: Buffer): A2SReply | null {
  let pos = 0;
  const need = (n: number) => {
    if (pos + n > buf.length) throw new RangeError("short packet");
  };
  const byte = () => {
    need(1);
    return buf[pos++];
  };
  const string = () => {
    const end = buf.indexOf(0, pos);
    if (end === -1) throw new RangeError("unterminated string");
    const s = buf.toString("utf8", pos, end);
    pos = end + 1;
    return s;
  };
  try {
    need(5);
    if (buf.readUInt32LE(0) !== SINGLE_PACKET) return null;
    pos = 4;
    const type = byte();
    if (type === 0x41) {
      need(4);
      return { kind: "challenge", challenge: Buffer.from(buf.subarray(pos, pos + 4)) };
    }
    if (type !== 0x49) return null;
    byte(); // protocol version
    const name = string();
    const map = string();
    const folder = string();
    const game = string();
    need(2);
    const appId = buf.readUInt16LE(pos);
    pos += 2;
    const players = byte();
    const maxPlayers = byte();
    const bots = byte();
    const serverType = String.fromCharCode(byte());
    const environment = String.fromCharCode(byte());
    const passworded = byte() === 1;
    const vac = byte() === 1;
    if (appId === 2400) pos += 3; // The Ship: mode, witnesses, duration
    const version = pos < buf.length ? string() : "";
    return { kind: "info", info: { name, map, folder, game, appId, players, maxPlayers, bots, serverType, environment, passworded, vac, version } };
  } catch {
    return null;
  }
}

/** Splits "host:port" (port defaults to 27015). Returns null when it isn't a plain host name or IPv4 address. */
export function parseServerAddress(address: string, defaultPort: number): { host: string; port: number } | null {
  const m = /^([A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?)(?::(\d{1,5}))?$/.exec(address.trim());
  if (!m) return null;
  const port = m[2] ? Number(m[2]) : defaultPort;
  if (port < 1 || port > 65535) return null;
  return { host: m[1], port };
}

/** Sends A2S_INFO and resolves with the answer and the round-trip time. Rejects on timeout. */
export async function queryA2S(host: string, port: number, timeoutMs = 3000): Promise<{ info: A2SInfo; ms: number }> {
  const { address, family } = await dns.lookup(host);
  const socket = dgram.createSocket(family === 6 ? "udp6" : "udp4");
  const start = performance.now();
  try {
    return await new Promise((resolve, reject) => {
      let challenges = 0;
      const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      const send = (packet: Buffer) => socket.send(packet, port, address, (err) => err && reject(err));
      socket.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      socket.on("message", (msg) => {
        const reply = parseA2SReply(msg);
        if (!reply) return;
        if (reply.kind === "challenge") {
          if (++challenges > 2) return;
          send(infoRequest(reply.challenge));
          return;
        }
        clearTimeout(timer);
        resolve({ info: reply.info, ms: Math.round(performance.now() - start) });
      });
      send(infoRequest());
    });
  } finally {
    socket.close();
  }
}
