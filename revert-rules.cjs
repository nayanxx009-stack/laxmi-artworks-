const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');
rules = rules.replace(/match \/admins\/\{adminId\} \{\n\s*allow read: if true;\n\s*allow write: if true;/g, `match /admins/{adminId} {\n      allow read: if isAdmin() || (isSignedIn() && request.auth.token.email == adminId);\n      allow write: if isAdmin();`);
fs.writeFileSync('firestore.rules', rules);
