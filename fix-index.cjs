const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

if (!code.includes('manifest.json')) {
  code = code.replace(
    /<\/head>/,
    `  <link rel="manifest" href="/manifest.json" />\n  </head>`
  );
  fs.writeFileSync('index.html', code);
}
