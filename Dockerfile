# Build stage
FROM node:20-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies with memory limit
RUN NODE_OPTIONS="--max-old-space-size=4096" npm install

# Copy all files
COPY . .

# Build the frontend with memory limit
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Production stage
FROM node:20-bookworm

WORKDIR /app

# Install build dependencies for native modules (sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy built frontend and backend code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/package*.json ./

# Install only production dependencies - build sqlite3 from source
RUN npm install --production --build-from-source=sqlite3

# Create directory for SQLite database
RUN mkdir -p /app/data && chmod 777 /app/data

# Environment variables
ENV PORT=7860
ENV NODE_ENV=production

# Expose the port HF expects
EXPOSE 7860

# Start the server
CMD ["node", "backend/server.js"]
