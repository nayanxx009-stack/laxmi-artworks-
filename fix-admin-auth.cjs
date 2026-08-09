const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
  /<ProtectedRoute>\s*<AdminPanel \/>\s*<\/ProtectedRoute>/,
  '<AdminPanel />'
);
fs.writeFileSync('src/App.tsx', appCode);

let adminCode = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

// Add showSignOutConfirm state
adminCode = adminCode.replace(
  /const \[checkingAuth, setCheckingAuth\] = useState\(false\);/,
  `const [checkingAuth, setCheckingAuth] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);`
);

// Add role check block
adminCode = adminCode.replace(
  /if \(!user\) \{/,
  `if (user && role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white p-4">
        <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-white">Access Denied</h1>
          <p className="text-sm text-neutral-400 mb-6">You do not have administrator privileges.</p>
          <button 
            onClick={logout}
            className="w-full bg-red-500 text-white font-bold py-3 px-4 rounded-xl hover:bg-red-400 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }
  
  if (!user) {`
);

// Modify sign out button to show confirmation popup
adminCode = adminCode.replace(
  /<button \n\s*onClick=\{logout\}\n\s*className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-bold bg-white\/5 px-4 py-2 rounded-full border border-white\/10"\n\s*>\n\s*<LogOut size=\{16\} \/> Sign Out\n\s*<\/button>/,
  `<button 
                onClick={() => setShowSignOutConfirm(true)}
                className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-bold bg-white/5 px-4 py-2 rounded-full border border-white/10"
              >
                <LogOut size={16} /> Sign Out
              </button>`
);

// Add the signout confirmation popup somewhere near the end of the return statement
adminCode = adminCode.replace(
  /\{showPopupPreview && \(/,
  `{showSignOutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center">
            <LogOut className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Sign Out</h3>
            <p className="text-neutral-400 text-sm mb-6">Are you sure you want to sign out of the Admin Workspace?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 bg-neutral-800 text-white font-bold py-3 px-4 rounded-xl hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => { setShowSignOutConfirm(false); logout(); }}
                className="flex-1 bg-red-500 text-white font-bold py-3 px-4 rounded-xl hover:bg-red-400 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showPopupPreview && (`
);

fs.writeFileSync('src/components/AdminPanel.tsx', adminCode);
