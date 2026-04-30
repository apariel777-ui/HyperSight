---
title: HyperSight
emoji: 📊
colorFrom: indigo
colorTo: blue
sdk: docker
pinned: false
---

# HyperSight Auction Aggregator

HyperSight is a professional-grade, multi-asset trading terminal and auction aggregator for Hyperliquid.

## Features
- **Real-time Auction Dashboard:** Track live auctions with decaying price progress bars.
- **Persistent History:** Automatically archives settled auctions into a local SQLite database.
- **Telegram Alerts:** Register your @username on the site and link with the bot for instant 🚨 notifications.
- **High-Volume Live Feed:** Monitors high-activity perpetual markets (BTC, ETH, SOL, HYPE, etc.) to ensure a constant flow of market data.

## Tech Stack
- **Frontend:** React (Vite), Tailwind CSS, Framer Motion, Lightweight Charts.
- **Backend:** Node.js (Express), SQLite3.
- **Infrastructure:** Docker-ready for 24/7 hosting on Hugging Face Spaces.

## Deployment
This project is designed to run on Hugging Face Spaces using Docker.
1. Connect your GitHub repo to a Hugging Face Space.
2. Select the **Docker** SDK.
3. Add your `TELEGRAM_BOT_TOKEN` to the Space Secrets.
