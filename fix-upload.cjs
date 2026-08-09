const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /const handlePopupImageUpload = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?setTimeout\(\(\) => \{\n        setPopupUploadState\('idle'\);\n        setPopupUploadMessage\(''\);\n      \}, 5000\);\n      \n    \} catch \(error: any\) \{[\s\S]*?\}\n  \};/,
  `const handlePopupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // File validation
    if (!file.type.startsWith('image/')) {
       setPopupUploadState('error');
       setPopupUploadMessage('❌ Unsupported image format.');
       return;
    }
    if (file.size > 5 * 1024 * 1024) {
       setPopupUploadState('error');
       setPopupUploadMessage('❌ File is too large (max 5MB).');
       return;
    }
    
    try {
      setPopupUploadState('uploading');
      setPopupUploadMessage('Uploading...');
      
      const fileRef = ref(storage, \`popup/\${Date.now()}_\${file.name}\`);
      
      // Upload with timeout to prevent hanging if bucket is missing
      const uploadTask = uploadBytes(fileRef, file);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Upload timed out. Check Firebase Storage configuration.")), 15000)
      );
      
      await Promise.race([uploadTask, timeoutPromise]);
      
      setPopupUploadState('processing');
      setPopupUploadMessage('Processing...');
      
      const url = await getDownloadURL(fileRef);
      
      setPopupUploadState('saving');
      setPopupUploadMessage('Saving...');
      
      const newConfig = { ...localSiteConfig, popupImage: url };
      await setDoc(doc(db, 'settings', 'site_config'), newConfig, { merge: true });
      setLocalSiteConfig(newConfig);
      
      setPopupUploadState('success');
      setPopupUploadMessage('✅ Popup image uploaded successfully');
      
      setTimeout(() => {
        setPopupUploadState('idle');
        setPopupUploadMessage('');
      }, 5000);
      
    } catch (error: any) {
      console.error("Popup upload error:", error);
      setPopupUploadState('error');
      setPopupUploadMessage('❌ Upload failed: ' + (error.message || 'Please try again.'));
      
      setTimeout(() => {
        setPopupUploadState('idle');
        setPopupUploadMessage('');
      }, 7000);
    }
  };`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
