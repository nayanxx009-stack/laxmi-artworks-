const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const orig = `const processUpload = async () => {
        // Compress more aggressively for base64 storage
        const base64Url = await compressImage(file, 600, 600, 0.6);
        
        const sizeInBytes = base64Url.length * 0.75;
        if (sizeInBytes > 900000) {
            throw new Error('Image is too complex/large. Please try a simpler image.');
        }
        
        setPopupUploadState('saving');
        setPopupUploadMessage('Saving to database...');
        
        const newConfig = { ...localSiteConfig, popupImage: base64Url };
        await setDoc(doc(db, 'settings', 'site_config'), newConfig, { merge: true });
        setLocalSiteConfig(newConfig);
      };`;

const repl = `const processUpload = async () => {
        // Compress extremely aggressively for base64 storage to avoid any issues
        const base64Url = await compressImage(file, 400, 400, 0.4);
        
        const sizeInBytes = base64Url.length * 0.75;
        if (sizeInBytes > 1000000) {
            throw new Error('Image is too complex. Please try a smaller image.');
        }
        
        setPopupUploadState('saving');
        setPopupUploadMessage('Saving to database...');
        
        const newConfig = { ...localSiteConfig, popupImage: base64Url };
        await setDoc(doc(db, 'settings', 'site_config'), newConfig, { merge: true });
        setLocalSiteConfig(newConfig);
      };`;

if (code.includes(orig)) {
   code = code.replace(orig, repl);
   fs.writeFileSync('src/components/AdminPanel.tsx', code);
   console.log('Fixed processUpload');
} else {
   console.log('Could not find processUpload');
}
