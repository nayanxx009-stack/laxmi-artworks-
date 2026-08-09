const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

code = code.replace(
  /const uploadTask = uploadBytes\(fileRef, file\);\n\s*const timeoutPromise = new Promise\(\(_, reject\) => setTimeout\(\(\) => reject\(new Error\("Upload timeout"\)\), 15000\)\);\n\s*await Promise\.race\(\[uploadTask, timeoutPromise\]\);/g,
  `// Allow more time for upload, or just rely on Firebase's internal timeout
      await uploadBytes(fileRef, file);`
);

code = code.replace(
  /const urlTask = getDownloadURL\(fileRef\);\n\s*const url = await Promise\.race\(\[urlTask, timeoutPromise\]\) as string;/g,
  `const url = await getDownloadURL(fileRef);`
);

fs.writeFileSync('src/components/AdminPanel.tsx', code);
