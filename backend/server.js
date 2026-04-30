import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
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
  );
  
  CREATE TABLE IF NOT EXISTS telegram_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    createdAt INTEGER
  );
`);

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

    const checkAndLog = (payload, actType) => {
        if (!payload) return;
        const items = Array.isArray(payload) ? payload : [payload];
        items.forEach(item => {
            if (typeof item.startTimeSeconds !== 'undefined') {
                 // Ignore standard zeros
                 if (item.startGas === item.currentGas && item.startGas % 100 === 0) return;
                 const nowSec = Math.floor(Date.now() / 1000);
                 const hasEnded = nowSec >= (item.startTimeSeconds + item.durationSeconds);
                 
                 // If it has ended, we ensure it's in the history DB
                 if (hasEnded) {
                    const id = item.coin || item.name || `${item.startTimeSeconds}`;
                    const token = item.coin || item.name || `${actType.split(' ')[0]} Asset`;
                    
                    db.get(`SELECT id FROM history_auctions WHERE id = ?`, [id], (err, row) => {
                        if (!row) {
                            // Insert as history
                            db.run(`
                               INSERT INTO history_auctions (id, token, type, startTimeSeconds, durationSeconds, startGas, endGas, settlePrice, clearedAt)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                id, token, actType, 
                                item.startTimeSeconds, item.durationSeconds, 
                                item.startGas || 0, item.endGas || 0,
                                item.currentGas || 0, // Fallback for settle price logic
                                Date.now()
                            ]);
                            console.log(`[Indexer] Archived settled auction: ${token}`);
                        }
                    });
                 }
            }
        });
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

// Catch-all route for React Router
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(process.env.PORT || 7860, () => {
  console.log(`HyperSight Production Server running on port ${process.env.PORT || 7860}`);
});
