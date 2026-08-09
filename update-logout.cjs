const fs = require('fs');
let code = fs.readFileSync('src/lib/auth.tsx', 'utf8');

const targetStr = `  const logout = async () => {
    try {
      await signOut(auth);
      setAccessToken(null);
      setRole(null);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };`;

const newStr = `  const logout = async () => {
    try {
      await signOut(auth);
      setAccessToken(null);
      setRole(null);
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  fs.writeFileSync('src/lib/auth.tsx', code);
  console.log("Updated logout");
} else {
  console.log("Could not find targetStr");
}
