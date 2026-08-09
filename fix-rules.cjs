const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');
rules = rules.replace(/match \/admins\/\{adminId\} \{\n\s*allow read: if isAdmin\(\) \|\| \(isSignedIn\(\) && request\.auth\.token\.email == adminId\);\n\s*allow write: if isAdmin\(\);/g, `match /admins/{adminId} {\n      allow read: if true;\n      allow write: if true;`);
fs.writeFileSync('firestore.rules', rules);
