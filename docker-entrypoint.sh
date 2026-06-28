#!/bin/sh
set -e

node /app/discord-presence.js &

exec node /app/websocket-server.js
