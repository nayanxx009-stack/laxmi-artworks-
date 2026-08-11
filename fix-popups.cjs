const fs = require('fs');

let signup = fs.readFileSync('src/pages/SignupPage.tsx', 'utf8');
signup = signup.replace(
  "if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('cross-origin')) {",
  "if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request' || err.message?.includes('cross-origin')) {"
);
fs.writeFileSync('src/pages/SignupPage.tsx', signup);

let admin = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
admin = admin.replace(
  "onClick={() => { setLoginError(''); loginWithGoogle(); }}",
  "onClick={async () => { setLoginError(''); try { await loginWithGoogle(true); } catch (e: any) { setLoginError(e.message || 'Google sign-in failed'); } }}"
);
fs.writeFileSync('src/components/AdminPanel.tsx', admin);
console.log("Fixed popups");
