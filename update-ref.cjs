const fs = require('fs');
let code = fs.readFileSync('src/components/Contact.tsx', 'utf8');

code = code.replace(/const \[firebaseDocId, setFirebaseDocId\] = useState<string \| null>\(null\);/, `const [firebaseDocId, setFirebaseDocId] = useState<string | null>(null);\n  const firebaseDocIdRef = useRef<string | null>(null);`);

code = code.replace(/setFirebaseDocId\(newDocRef\.id\);/, `setFirebaseDocId(newDocRef.id);\n    firebaseDocIdRef.current = newDocRef.id;`);

code = code.replace(/if \(firebaseDocId\) \{/g, `const currentDocId = firebaseDocId || firebaseDocIdRef.current;\n      if (currentDocId) {`);

code = code.replace(/await updateDoc\(doc\(db, 'orders', firebaseDocId\), \{/g, `await updateDoc(doc(db, 'orders', currentDocId), {`);

code = code.replace(/import \{ useState, useEffect, FormEvent/g, `import { useState, useEffect, FormEvent, useRef`);

fs.writeFileSync('src/components/Contact.tsx', code);
