const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx}');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes("(import.meta.env.VITE_API_URL || '') + '/api/")) {
    content = content.replace(/\(import\.meta\.env\.VITE_API_URL\s*\|\|\s*''\)\s*\+\s*'/g, "'");
    fs.writeFileSync(file, content);
    console.log("Fixed VITE_API_URL in", file);
  }
});
