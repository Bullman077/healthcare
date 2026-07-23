#!/bin/sh
set -e

# Start Nginx in background
nginx -g "daemon on;"

# Start Node.js API
cd /app/backend
exec node server.js
