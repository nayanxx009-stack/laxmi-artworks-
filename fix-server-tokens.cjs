const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /\/\/ If token is invalid, we could optionally delete it from Firestore here[\s\S]*?console\.log\(\`\[Push API\] Token is invalid or expired\. Should remove token\.\`\);[\s\S]*?\}/,
  `// Remove invalid token from Firestore
      if (err.code === 'messaging/invalid-registration-token' || 
          err.code === 'messaging/registration-token-not-registered') {
        console.log(\`[Push API] Token is invalid or expired. Removing token: \${token}\`);
        try {
          // Find which document has this token and remove it
          const fcmTokensRef = collection(db, 'fcm_tokens');
          const snapshot = await getDocs(fcmTokensRef);
          snapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            if (data.tokens && data.tokens.includes(token)) {
               const newTokens = data.tokens.filter(t => t !== token);
               await updateDoc(doc(db, 'fcm_tokens', docSnap.id), { tokens: newTokens });
            } else if (data.token === token) {
               await deleteDoc(doc(db, 'fcm_tokens', docSnap.id));
            }
          });
        } catch(delErr) {
          console.error('[Push API] Failed to delete token:', delErr);
        }
      }`
);

fs.writeFileSync('server.ts', code);
