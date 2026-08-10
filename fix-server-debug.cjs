const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const debugRoute = `
  app.get("/api/debug-env", (req, res) => {
    res.json({
      hasUser: !!process.env.GMAIL_USER,
      hasPass: !!process.env.GMAIL_APP_PASSWORD,
      userVal: process.env.GMAIL_USER ? process.env.GMAIL_USER.substring(0, 3) + '...' : 'none'
    });
  });
`;

if (!code.includes('/api/debug-env')) {
  code = code.replace('app.get("/api/health"', debugRoute + '\n  app.get("/api/health"');
  fs.writeFileSync('server.ts', code);
  console.log("Added debug route");
}
