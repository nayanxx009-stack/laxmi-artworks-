const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const origUpload = `  const handlePopupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      setPopupUploadState('processing');`;

const replUpload = `  const handlePopupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (file.size > 15 * 1024 * 1024) {
       setPopupUploadState('error');
       setPopupUploadMessage('❌ File is too large. Please select a smaller image.');
       setTimeout(() => { setPopupUploadState('idle'); setPopupUploadMessage(''); }, 5000);
       return;
    }
    
    try {
      setPopupUploadState('processing');`;

code = code.replace(origUpload, replUpload);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
console.log('Fixed upload type check');
