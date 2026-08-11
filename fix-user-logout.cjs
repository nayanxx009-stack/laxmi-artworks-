const fs = require('fs');
let code = fs.readFileSync('src/lib/auth.tsx', 'utf8');

const origLogout = `      localStorage.clear();
      sessionStorage.clear();`;

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

if (code.includes(origLogout)) {
  code = code.replace(origLogout, replLogout);
  fs.writeFileSync('src/lib/auth.tsx', code);
  console.log("Fixed user logout storage clearing");
} else {
  console.log("Did not find exact string to replace");
}
