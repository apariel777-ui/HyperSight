#!/bin/bash
set -e

echo "Starting HyperSight VPS Deployment..."

# 1. Update system and install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git

# 2. Install Node.js (v20)
if ! command -v node &> /dev/null
then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# 3. Install PM2 globally
if ! command -v pm2 &> /dev/null
then
    sudo npm install -g pm2
fi

# 4. Install local dependencies
echo "Installing project dependencies..."
npm install

# 5. Build the frontend for production
echo "Building React frontend..."
npm run build

# 6. Start the server with PM2
echo "Starting PM2 Daemon..."
# Stop existing if it exists
pm2 stop hypersight || true
pm2 delete hypersight || true

# Start new process
pm2 start npm --name "hypersight" -- run start:prod

# 7. Setup PM2 to run on startup
pm2 save
sudo pm2 startup systemd -u $USER --hp $HOME || true

echo "================================================="
echo "Deployment Complete!"
echo "HyperSight is now running on port 3001 in the background."
echo "================================================="
