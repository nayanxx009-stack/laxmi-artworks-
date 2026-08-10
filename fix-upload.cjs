const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const origUpload = `  const handlePopupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // File validation
    if (!file.type.startsWith('image/')) {
       setPopupUploadState('error');
       setPopupUploadMessage('❌ Unsupported image format.');
       return;
    }
    
    try {
      setPopupUploadState('processing');
      setPopupUploadMessage('Optimizing image...');
      
      // Compress and convert to base64 directly (to avoid Firebase Storage)
      const base64Url = await compressImage(file, 800, 800, 0.7);
      
      // Check size roughly (Firestore limit is 1MB, our base64 string should be < ~900KB)
      // A base64 string length * 0.75 gives roughly the size in bytes
      const sizeInBytes = base64Url.length * 0.75;
      if (sizeInBytes > 900000) {
          setPopupUploadState('error');
          setPopupUploadMessage('❌ Image is too complex. Please try a simpler image.');
          setTimeout(() => {
            setPopupUploadState('idle');
            setPopupUploadMessage('');
          }, 5000);
          return;
      }
      
      setPopupUploadState('saving');
      setPopupUploadMessage('Saving to database...');
      
      const newConfig = { ...localSiteConfig, popupImage: base64Url };
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
  };`;

const replUpload = `  const handlePopupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      setPopupUploadState('processing');
      setPopupUploadMessage('Optimizing image...');
      
      const processUpload = async () => {
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
      };

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timed out. Please try again.')), 15000)
      );

      await Promise.race([processUpload(), timeoutPromise]);
      
      setPopupUploadState('success');
      setPopupUploadMessage('✅ Popup image uploaded successfully');
      
      setTimeout(() => {
        setPopupUploadState('idle');
        setPopupUploadMessage('');
      }, 5000);
      
    } catch (error: any) {
      console.error("Popup upload error:", error);
      setPopupUploadState('error');
      setPopupUploadMessage('❌ ' + (error.message || 'Upload failed.'));
      
      setTimeout(() => {
        setPopupUploadState('idle');
        setPopupUploadMessage('');
      }, 7000);
    } finally {
      if (e.target) e.target.value = '';
    }
  };`;

code = code.replace(origUpload, replUpload);

const origCompress = `        // Force jpeg for compression
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (error) => reject(error);`;

const replCompress = `        // Prefer webp if supported, otherwise jpeg
        const type = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0 ? 'image/webp' : 'image/jpeg';
        resolve(canvas.toDataURL(type, quality));
      };
      img.onerror = (error) => reject(new Error('Failed to load image. It may be corrupt or an unsupported format.'));`;

code = code.replace(origCompress, replCompress);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
