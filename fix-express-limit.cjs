const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (code.includes('app.use(express.json());')) {
  code = code.replace('app.use(express.json());', 'app.use(express.json({ limit: "50mb" }));\\n  app.use(express.urlencoded({ limit: "50mb", extended: true }));');
  fs.writeFileSync('server.ts', code);
  console.log("Fixed express json limit");
}
