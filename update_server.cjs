const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'import { createServer as createViteServer } from "vite";',
  'import { createServer as createViteServer } from "vite";\nimport { ImapFlow } from "imapflow";\nimport { simpleParser } from "mailparser";'
);

code = code.replace(
  /app\.get\("\/api\/gmail\/status", \(req, res\) => \{[\s\S]*?\}\);/,
  `app.get("/api/gmail/status", (req, res) => {
    const isConfigured = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
    res.json({ configured: isConfigured });
  });`
);

const searchCode = `
  app.get("/api/gmail/search", async (req, res) => {
    try {
      const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
      if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
        return res.status(400).json({ error: "Gmail credentials not configured" });
      }

      const q = req.query.q as string;
      if (!q) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD
        },
        logger: false // Disable logging
      });

      await client.connect();

      const messages = [];
      let lock = await client.getMailboxLock('INBOX');
      try {
        // Find UIDs matching the query in text
        const uids = await client.search({ text: q });
        
        if (uids && uids.length > 0) {
          // Fetch the matching emails
          // Limit to recent 5 if there are many
          const fetchUids = uids.slice(-5);
          for await (let message of client.fetch(fetchUids, { source: true })) {
            const parsed = await simpleParser(message.source);
            messages.push({
              id: message.uid.toString(),
              snippet: parsed.text ? parsed.text.substring(0, 200) : "",
              body: parsed.text || ""
            });
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
      res.json({ messages });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
`;

code = code.replace(
  /app\.get\("\/api\/gmail\/search", async \(req, res\) => \{[\s\S]*?\}\);/,
  searchCode.trim()
);

fs.writeFileSync('server.ts', code);

