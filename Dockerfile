# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy built frontend and backend code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --production && \
    npm install sqlite3

# Create directory for SQLite database
RUN mkdir -p /app/data && chmod 777 /app/data

# Environment variables
ENV PORT=7860
ENV NODE_ENV=production

# Expose the port HF expects
EXPOSE 7860

# Start the server
CMD ["node", "backend/server.js"]
