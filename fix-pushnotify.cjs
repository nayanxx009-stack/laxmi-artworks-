const fs = require('fs');
let code = fs.readFileSync('src/lib/pushNotify.ts', 'utf8');

code = code.replace("export const sendPushToUser = async (userId: string, title: string, body: string, url: string = '/') => {", "export const sendPushToUser = async (userId: string, title: string, body: string, url: string = '/', overrideDb?: any) => {\n  const firestoreDb = overrideDb || db;");
code = code.replace("const tokenDoc = await getDoc(doc(db, 'fcm_tokens', userId));", "const tokenDoc = await getDoc(doc(firestoreDb, 'fcm_tokens', userId));");

code = code.replace("export const sendPushToAdmins = async (title: string, body: string, url: string = '/') => {", "export const sendPushToAdmins = async (title: string, body: string, url: string = '/', overrideDb?: any) => {\n  const firestoreDb = overrideDb || db;");
code = code.replace("const adminQuery = query(collection(db, 'admins'));", "const adminQuery = query(collection(firestoreDb, 'admins'));");
code = code.replace("const fcmDocs = await getDocs(collection(db, 'fcm_tokens'));", "const fcmDocs = await getDocs(collection(firestoreDb, 'fcm_tokens'));");

fs.writeFileSync('src/lib/pushNotify.ts', code);
console.log("Fixed pushNotify.ts");
