# Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Run type check and tests
RUN npm run type-check
RUN npm run lint
RUN npm run test:run

# Build the application
RUN npm run build


FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy only what we need for production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Install only production dependencies
RUN npm ci --omit=dev

# Create non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server.js"]