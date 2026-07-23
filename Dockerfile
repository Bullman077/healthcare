# ============================================
# UHS Healthcare — Production Docker Image
# Multi-stage: Nginx (frontend) + Node (backend)
# ============================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS build

WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy backend
COPY backend/package.json backend/
RUN cd backend && npm ci --only=production

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

RUN apk add --no-cache nginx

# Create necessary directories
RUN mkdir -p /var/www/uhshealthcare /var/log/nginx /var/lib/nginx/tmp

# Copy frontend static files
COPY . /var/www/uhshealthcare/

# Remove backend source from frontend serving directory
RUN rm -rf /var/www/uhshealthcare/backend /var/www/uhshealthcare/Dockerfile /var/www/uhshealthcare/.dockerignore

# Copy backend node_modules from build stage
COPY --from=build /app/backend /app/backend

# Copy backend source (excluding node_modules which came from build)
COPY backend /app/backend
RUN rm -rf /app/backend/node_modules
COPY --from=build /app/backend/node_modules /app/backend/node_modules

# Copy Nginx config
COPY deploy/nginx.conf /etc/nginx/http.d/default.conf

# Environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 80
EXPOSE 443

# Start Nginx + Node
COPY deploy/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
