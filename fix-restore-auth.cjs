const fs = require('fs');
let code = fs.readFileSync('src/lib/auth.tsx', 'utf8');

const replLogout = `      // Remove only user-specific items, do not clear all storage
      Object.keys(localStorage).forEach(key => {
        if (key.includes('firebase:authUser:') && !key.includes('adminApp')) {
           localStorage.removeItem(key);
        }
      });
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('firebase:authUser:') && !key.includes('adminApp')) {
           sessionStorage.removeItem(key);
        }
      });`;

const origLogout = `      localStorage.clear();
      sessionStorage.clear();`;

if (code.includes(replLogout)) {
  code = code.replace(replLogout, origLogout);
  fs.writeFileSync('src/lib/auth.tsx', code);
  console.log("Restored auth.tsx");
} else {
  console.log("Did not find exact string to replace in auth.tsx");
}
