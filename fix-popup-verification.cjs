const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const origUpload = `const processUpload = async () => {
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

const replUpload = `const processUpload = async () => {
        setPopupUploadState('processing');
        setPopupUploadMessage('📷 Reading & Optimizing image...');
        // Compress extremely aggressively for base64 storage to avoid any issues
        const base64Url = await compressImage(file, 400, 400, 0.4);
        
        const sizeInBytes = base64Url.length * 0.75;
        if (sizeInBytes > 1000000) {
            throw new Error('Image is too complex. Please try a smaller image.');
        }
        
        setPopupUploadState('saving');
        setPopupUploadMessage('💾 Saving popup to database...');
        
        const newConfig = { ...localSiteConfig, popupImage: base64Url };
        await setDoc(doc(db, 'settings', 'site_config'), newConfig, { merge: true });
        
        setPopupUploadMessage('🔍 Verifying saved popup...');
        const docSnap = await getDoc(doc(db, 'settings', 'site_config'));
        if (!docSnap.exists() || !docSnap.data().popupImage) {
            throw new Error('Verification failed. Data was not saved properly.');
        }
        
        setLocalSiteConfig(newConfig);
      };`;

if (code.includes(origUpload)) {
  code = code.replace(origUpload, replUpload);
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
  console.log('Fixed popup upload');
} else {
  console.log('Popup upload not found');
}
