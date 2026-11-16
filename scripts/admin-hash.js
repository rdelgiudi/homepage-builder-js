#!/usr/bin/env node
/**
 * Prints an ADMIN_PASSWORD_HASH line for .env.
 *
 *   npm run admin:hash                         (asks for the password, hidden)
 *   printf '%s' 'my password' | npm run -s admin:hash   (reads it from stdin)
 *
 * Only the hash goes to stdout; everything else goes to stderr.
 */
const { hashPassword } = require('../src/lib/admin/password.js');

const MIN_LENGTH = 8;
const say = (text) => process.stderr.write(text);

/** Reads one line from the terminal without echoing it. */
function askHidden(prompt) {
  return new Promise((resolve) => {
    say(prompt);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          say('\n');
          return resolve(value);
        }
        if (ch === '\u0003') {
          // Ctrl+C
          stdin.setRawMode(false);
          say('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function readPiped() {
  let data = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, '');
}

(async () => {
  let password;
  if (process.stdin.isTTY) {
    password = await askHidden('New admin password: ');
    if ((await askHidden('Repeat it: ')) !== password) {
      say('The two entries differ. Nothing was generated.\n');
      process.exit(1);
    }
  } else {
    password = await readPiped();
  }

  if (password.length < MIN_LENGTH) {
    say(`Use at least ${MIN_LENGTH} characters. Nothing was generated.\n`);
    process.exit(1);
  }
  if (password.length < 14) {
    say('Note: a hash only protects a password that is hard to guess. Consider a longer one (14+ characters or a few random words).\n');
  }

  const hash = await hashPassword(password);
  say('\nPut this line in .env (and remove ADMIN_PASSWORD if it is there), then restart:\n\n');
  process.stdout.write(`ADMIN_PASSWORD_HASH=${hash}\n`);
})();
