const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

if (!code.includes('saveSuccessMessage')) {
  // Add state for generic toast
  code = code.replace(
    /const \[showSignOutConfirm, setShowSignOutConfirm\] = useState\(false\);/,
    `const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');`
  );

  // Update saveSiteConfig to use the toast instead of alert
  code = code.replace(
    /const saveSiteConfig = async \(\) => \{[\s\S]*?alert\("Site settings saved successfully!"\);[\s\S]*?alert\("Error saving settings\."\);[\s\S]*?setSavingSite\(false\);\n  \};/,
    `const saveSiteConfig = async () => {
    setSavingSite(true);
    try {
      await setDoc(doc(db, 'settings', 'site_config'), localSiteConfig, { merge: true });
      setSaveSuccessMessage("✅ Site settings saved successfully!");
      setTimeout(() => setSaveSuccessMessage(''), 4000);
    } catch (e) {
      console.error(e);
      setSaveSuccessMessage("❌ Error saving settings.");
      setTimeout(() => setSaveSuccessMessage(''), 4000);
    }
    setSavingSite(false);
  };`
  );
  
  // Also add toast element near the bottom of return statement
  code = code.replace(
    /\{showSignOutConfirm && \(/,
    `
      <AnimatePresence>
        {saveSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-[200] bg-neutral-900 border border-white/10 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3"
          >
            {saveSuccessMessage}
          </motion.div>
        )}
      </AnimatePresence>
      
      {showSignOutConfirm && (`
  );
  
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
}
