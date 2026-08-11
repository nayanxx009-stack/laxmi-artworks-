const fs = require('fs');
let code = fs.readFileSync('src/components/AdminChat.tsx', 'utf8');

code = code.replace("sendPushToUser(activeChat.id, 'New Message from Laxmi Artworks', msg, '/?chat=open');", "sendPushToUser(activeChat.id, 'New Message from Laxmi Artworks', msg, '/?chat=open', db);");
code = code.replace("sendPushToUser(activeChat.id, 'Invoice Received', 'You have received a new invoice from Laxmi Artworks', '/?chat=open');", "sendPushToUser(activeChat.id, 'Invoice Received', 'You have received a new invoice from Laxmi Artworks', '/?chat=open', db);");

fs.writeFileSync('src/components/AdminChat.tsx', code);
console.log("Fixed AdminChat.tsx");
