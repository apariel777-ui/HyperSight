const https = require('https');

const data = JSON.stringify({ 
  type: 'webData2', 
  user: '0x0000000000000000000000000000000000000000' 
});

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
      // Look for auctions in the response
      console.log('Keys:', Object.keys(parsed));
      if (parsed.spotDeployAuctions) console.log('Spot Auctions:', parsed.spotDeployAuctions);
      if (parsed.perpDeployAuctions) console.log('Perp Auctions:', parsed.perpDeployAuctions);
    } catch (e) {
      console.error(e);
    }
  });
});

req.write(data);
req.end();
