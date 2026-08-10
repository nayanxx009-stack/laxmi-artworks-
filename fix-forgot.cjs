const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const orig = `  const handleForgotPassword = async () => {
    // If they forget the password, we clear it and force them to re-authenticate with Google.
    // They must own the Google account to sign back in.
    if (!window.confirm("This will sign you out and reset your password. You must sign in with Google again to set a new password. Continue?")) return;
    try {
      await updateDoc(doc(db, 'admins', user!.email!), { password: '' });
      await logout();
    } catch (e) {
      console.error(e);
    }
  };`;

const repl = `  const handleForgotPassword = async () => {
    if (!window.confirm("This will sign you out and reset your password. You must sign in with Google again to set a new password. Continue?")) return;
    try {
      await updateDoc(doc(db, 'admins', user!.email!), { password: '' });
      await logout();
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      alert("Failed to reset password. " + e.message);
    }
  };`;

code = code.replace(orig, repl);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
