const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const compressImageFn = `
const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Force jpeg for compression
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
`;

code = code.replace(
  /const MASTER_ADMINS = \["gargsubhalaxmi@gmail\.com", "nayanxx009@gmail\.com", "admin@example\.com"\];/,
  `const MASTER_ADMINS = ["gargsubhalaxmi@gmail.com", "nayanxx009@gmail.com", "admin@example.com"];\n${compressImageFn}`
);

// Popup Image
code = code.replace(
  /const handlePopupImageUpload = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?\}\n  \};/,
  `const handlePopupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };`
);

// Gallery Image
code = code.replace(
  /const handleAddGallery = async \(e: React\.FormEvent\) => \{[\s\S]*?try \{[\s\S]*?let imageUrl = newGalleryItem\.img;\n      if \(galleryFile\) \{[\s\S]*?const fileRef = ref\(storage, \`gallery\/\$\{Date\.now\(\)\}_\$\{galleryFile\.name\}\`\);\n        await uploadBytes\(fileRef, galleryFile\);\n        imageUrl = await getDownloadURL\(fileRef\);\n      \}[\s\S]*?await setDoc\(doc\(collection\(db, 'gallery'\)\), \{[\s\S]*?\.\.\.newGalleryItem,\n        img: imageUrl,\n        createdAt: Date\.now\(\)\n      \}\);[\s\S]*?setNewGalleryItem\(\{ title: '', img: '', cat: 'Fine Art' \}\);\n      setGalleryFile\(null\);\n      if \(fileInputRef\.current\) fileInputRef\.current\.value = "";\n    \} catch \(e\) \{[\s\S]*?console\.error\(e\);\n      alert\("Failed to upload image\. Please try again\."\);\n    \} finally \{[\s\S]*?setUploadingGallery\(false\);\n    \}\n  \};/,
  `const handleAddGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGalleryItem.title || (!newGalleryItem.img && !galleryFile)) return;
    setUploadingGallery(true);
    try {
      let imageUrl = newGalleryItem.img;
      if (galleryFile) {
        // Compress and convert to base64 directly
        imageUrl = await compressImage(galleryFile, 1200, 1200, 0.7);
        const sizeInBytes = imageUrl.length * 0.75;
        if (sizeInBytes > 900000) {
            alert("Image is too large even after compression. Please use a smaller image to fit in database.");
            setUploadingGallery(false);
            return;
        }
      }
      await setDoc(doc(collection(db, 'gallery')), {
        ...newGalleryItem,
        img: imageUrl,
        createdAt: Date.now()
      });
      
      setNewGalleryItem({ title: '', img: '', cat: 'Fine Art' });
      setGalleryFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      console.error(e);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploadingGallery(false);
    }
  };`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
