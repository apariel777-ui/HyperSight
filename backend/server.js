import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import TelegramBot from 'node-telegram-bot-api';
import WebSocket from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Use /app/data for persistence in Docker if available, otherwise fallback to local dir
const dbPath = process.env.NODE_ENV === 'production' && !process.env.DB_PATH_OVERRIDE 
  ? join('/app/data', 'database.sqlite')
  : join(__dirname, 'database.sqlite');

// Initialize DB
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to SQLite database');
});

// Create schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS history_auctions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      type TEXT NOT NULL,
      startTimeSeconds INTEGER,
      durationSeconds INTEGER,
      startGas REAL,
      endGas REAL,
      settlePrice REAL,
      clearedAt INTEGER
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS telegram_alerts (
      username TEXT PRIMARY KEY,
      chatId INTEGER,
      createdAt INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wallet_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      walletAddress TEXT,
      createdAt INTEGER,
      UNIQUE(username, walletAddress)
    )
  `);
});

// Initialize Telegram Bot
const token = process.env.TELEGRAM_BOT_TOKEN || '8540108737:AAG9EmRF2aNjeKSoceJjNRaKMRAob5m5Kcs';
const bot = new TelegramBot(token, { polling: true });

// Track which auctions we've already alerted for in this session
const notifiedAuctions = new Set();

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  if (!username) {
    bot.sendMessage(chatId, "❌ Please set a Telegram username first so I can link your account!");
    return;
  }

  db.run(
    `INSERT INTO telegram_alerts (username, chatId, createdAt) 
     VALUES (?, ?, ?) 
     ON CONFLICT(username) DO UPDATE SET chatId = excluded.chatId`,
    [username, chatId, Date.now()],
    (err) => {
      if (err) {
        bot.sendMessage(chatId, "❌ Error linking account. Try again later.");
      } else {
        bot.sendMessage(chatId, `✅ **HyperSight Linked!**\n\nYou will now receive real-time alerts for new auctions for @${username}.`, { parse_mode: 'Markdown' });
      }
    }
  );
});

const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz/info';

const fetchAuctionState = async (type) => {
  try {
    const res = await fetch(HYPERLIQUID_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    return await res.json();
  } catch (err) {
    console.error(`Error fetching ${type}:`, err);
    return null;
  }
};

const app = express();
app.use(cors());
app.use(express.json());

// Main polling loop to check for active->settled
const pollAuctions = async () => {
    const spot = await fetchAuctionState('spotPairDeployAuctionStatus');
    const perp = await fetchAuctionState('perpDeployAuctionStatus');

    const checkAndLog = (data, actType) => {
        if (!data) return;
        const liveAuctions = Array.isArray(data) ? data : (data.activeAuctions || [data]);
    
        // Check for new auctions to alert
        for (const auction of liveAuctions) {
          const asset = auction.coin || auction.name || 'Unknown';
          const auctionId = `${asset}-${auction.startTimeSeconds}`;
          
          if (auction.startTimeSeconds && !notifiedAuctions.has(auctionId)) {
            notifiedAuctions.add(auctionId);
            
            // Broadcast to all linked users
            db.all(`SELECT chatId FROM telegram_alerts WHERE chatId IS NOT NULL`, [], (err, rows) => {
              if (!err && rows.length > 0) {
                const message = `🚨 **New Auction Detected!**\n\n` +
                              `💎 Asset: **${asset}**\n` +
                              `💰 Start Price: $${parseFloat(auction.startGas || 0).toFixed(2)}\n` +
                              `📉 End Price: $${parseFloat(auction.endGas || 0).toFixed(2)}\n\n` +
                              `[View Dashboard](https://apariel777-ui-hypersight.hf.space)`;
                
                rows.forEach(row => {
                  bot.sendMessage(row.chatId, message, { parse_mode: 'Markdown' });
                });
              }
            });
          }

          // Existing settlement logic
          if (typeof auction.startTimeSeconds !== 'undefined') {
                 if (auction.startGas === auction.currentGas && auction.startGas % 100 === 0) continue;
                 const nowSec = Math.floor(Date.now() / 1000);
                 const hasEnded = nowSec >= (auction.startTimeSeconds + auction.durationSeconds);
                 
                 // If it has ended, we ensure it's in the history DB
                 if (hasEnded) {
                    const id = auction.coin || auction.name || `${auction.startTimeSeconds}`;
                    const token = auction.coin || auction.name || `${actType.split(' ')[0]} Asset`;
                    
                    db.get(`SELECT id FROM history_auctions WHERE id = ?`, [id], (err, row) => {
                        if (!row) {
                            // Insert as history
                            db.run(`
                               INSERT INTO history_auctions (id, token, type, startTimeSeconds, durationSeconds, startGas, endGas, settlePrice, clearedAt)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                id, token, actType, 
                                auction.startTimeSeconds, auction.durationSeconds, 
                                auction.startGas || 0, auction.endGas || 0,
                                auction.currentGas || 0, // Fallback for settle price logic
                                Date.now()
                            ]);
                            console.log(`[Indexer] Archived settled auction: ${token}`);
                        }
                    });
                 }
            }
        }
    };

    checkAndLog(spot, 'Spot Deploy');
    checkAndLog(perp, 'Perp Deploy');
};

setInterval(pollAuctions, 15000); 

// ENDPOINTS

app.get('/api/auctions/history', (req, res) => {
    db.all(`SELECT * FROM history_auctions ORDER BY clearedAt DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

app.post('/api/alerts/telegram', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    
    db.run(
      `INSERT OR IGNORE INTO telegram_alerts (username, createdAt) VALUES (?, ?)`,
      [username, Date.now()],
      function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, message: 'Alert configured' });
      }
    );
});

// Serve frontend in production
const distPath = join(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all: serve index.html for any request not handled by static files or API
app.use((req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

app.post('/api/alerts/wallet', (req, res) => {
    const { username, walletAddress } = req.body;
    if (!username || !walletAddress) return res.status(400).json({ error: 'Data required' });
    
    db.run(
      `INSERT OR IGNORE INTO wallet_alerts (username, walletAddress, createdAt) VALUES (?, ?, ?)`,
      [username, walletAddress.toLowerCase(), Date.now()],
      function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, message: 'Wallet tracking enabled' });
      }
    );
});

// --- WHALE TRADE MONITOR (BACKEND) ---
const monitorWs = new WebSocket('wss://api.hyperliquid.xyz/ws');
const WHALE_MIN = 60000;
const RADAR_COINS = ["BTC", "ETH", "SOL", "HYPE", "ARB", "AVAX", "DOGE", "SUI", "TIA", "OP"];

monitorWs.on('open', () => {
    console.log('Backend Radar Live (Whales & Liquidations)');
    RADAR_COINS.forEach(coin => {
        monitorWs.send(JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin } }));
        monitorWs.send(JSON.stringify({ method: "subscribe", subscription: { type: "liquidations", coin } }));
    });
});

const cascadeState = {}; // { coin: { count: 0, lastTime: 0 } }

monitorWs.on('message', (data) => {
    const msg = JSON.parse(data);
    
    // --- WHALE ALERTS ---
    if (msg.channel === 'trades' && msg.data) {
        msg.data.forEach(trade => {
            const val = parseFloat(trade.px) * parseFloat(trade.sz);
            if (val >= WHALE_MIN) {
                const addr = trade.hash.toLowerCase();
                db.all(`
                    SELECT t.chatId, w.walletAddress 
                    FROM telegram_alerts t
                    JOIN wallet_alerts w ON t.username = w.username
                    WHERE w.walletAddress = ? AND t.chatId IS NOT NULL
                `, [addr], (err, rows) => {
                    if (!err && rows.length > 0) {
                        const message = `🎯 **Target Spotted!**\n\n` +
                                      `👤 Wallet: \`${addr.slice(0,6)}...${addr.slice(-4)}\`\n` +
                                      `💎 Asset: **${trade.coin}**\n` +
                                      `💸 Value: **$${val.toLocaleString()}**\n` +
                                      `📈 Side: **${trade.side === 'B' ? 'BUY' : 'SELL'}**\n\n` +
                                      `[Track on HyperSight](https://apariel777-ui-hypersight.hf.space/track)`;
                        
                        rows.forEach(row => {
                            bot.sendMessage(row.chatId, message, { parse_mode: 'Markdown' });
                        });
                    }
                });
            }
        });
    }

    // --- LIQUIDATION CASCADES ---
    if (msg.channel === 'liquidations' && msg.data) {
        const liqs = Array.isArray(msg.data) ? msg.data : [msg.data];
        liqs.forEach(liq => {
            const val = parseFloat(liq.px) * parseFloat(liq.sz);
            
            // Cascade detection logic
            const now = Date.now();
            if (!cascadeState[liq.coin]) cascadeState[liq.coin] = { count: 0, lastTime: 0 };
            
            if (now - cascadeState[liq.coin].lastTime < 10000) {
                cascadeState[liq.coin].count++;
            } else {
                cascadeState[liq.coin].count = 1;
            }
            cascadeState[liq.coin].lastTime = now;

            // If 5 liquidations in 10s, alert everyone!
            if (cascadeState[liq.coin].count === 5) {
                const message = `🚨 **LIQUIDATION CASCADE DETECTED** 🚨\n\n` +
                              `💎 Asset: **${liq.coin}**\n` +
                              `💀 Event: Chain reaction of forced exits!\n` +
                              `📉 Current Price: **$${parseFloat(liq.px).toLocaleString()}**\n\n` +
                              `High volatility expected. Watch the heatmap.`;
                
                db.all(`SELECT chatId FROM telegram_alerts WHERE chatId IS NOT NULL`, (err, rows) => {
                    if (!err) rows.forEach(row => bot.sendMessage(row.chatId, message, { parse_mode: 'Markdown' }));
                });
            }
        });
    }
});

app.listen(process.env.PORT || 7860, () => {
  console.log(`HyperSight Production Server running on port ${process.env.PORT || 7860}`);
});
