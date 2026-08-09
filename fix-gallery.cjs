const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /const addGalleryItem = async \(e: FormEvent\) => \{[\s\S]*?if \(\(!newGalleryItem\.img\.trim\(\) && !galleryFile\) \|\| !newGalleryItem\.title\.trim\(\)\) return;\n    \n    setUploadingGallery\(true\);\n    try \{[\s\S]*?let imageUrl = newGalleryItem\.img;\n\n      if \(galleryFile\) \{[\s\S]*?const fileRef = ref\(storage, \`gallery\/\$\{Date\.now\(\)\}_\$\{galleryFile\.name\}\`\);\n        await uploadBytes\(fileRef, galleryFile\);\n        imageUrl = await getDownloadURL\(fileRef\);\n      \}[\s\S]*?await setDoc\(doc\(collection\(db, 'gallery'\)\), \{[\s\S]*?\.\.\.newGalleryItem,\n        img: imageUrl,\n        createdAt: Date\.now\(\)\n      \}\);[\s\S]*?setNewGalleryItem\(\{ title: '', img: '', cat: 'Fine Art' \}\);\n      setGalleryFile\(null\);\n      if \(fileInputRef\.current\) fileInputRef\.current\.value = "";\n    \} catch \(e\) \{[\s\S]*?console\.error\(e\);\n      alert\("Failed to upload image\. Please try again\."\);\n    \} finally \{[\s\S]*?setUploadingGallery\(false\);\n    \}\n  \};/,
  `const addGalleryItem = async (e: FormEvent) => {
    e.preventDefault();
    if ((!newGalleryItem.img.trim() && !galleryFile) || !newGalleryItem.title.trim()) return;
    
    setUploadingGallery(true);
    try {
      let imageUrl = newGalleryItem.img;

      if (galleryFile) {
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
