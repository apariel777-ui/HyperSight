const https = require('https');

const data = JSON.stringify({ type: 'metaAndAssetCtxs' });

const options = {
  hostname: 'api.hyperliquid.xyz',
  port: 443,
  path: '/info',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      console.log(JSON.stringify(parsed[0].universe.slice(0, 5), null, 2));
    } catch (e) {
      console.error(e);
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
