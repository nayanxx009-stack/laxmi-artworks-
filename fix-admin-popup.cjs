const fs = require('fs');
let admin = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
admin = admin.replace(
  "onClick={async () => { setLoginError(''); try { await loginWithGoogle(true); } catch (e: any) { setLoginError(e.message || 'Google sign-in failed'); } }}",
  "onClick={async () => { setLoginError(''); try { await loginWithGoogle(true); } catch (e: any) { if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') { setLoginError('Sign-in popup was closed.'); } else { setLoginError(e.message || 'Google sign-in failed'); } } }}"
);
fs.writeFileSync('src/components/AdminPanel.tsx', admin);
console.log("Fixed AdminPanel error display");
