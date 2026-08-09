import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "laxmi-artworks",
  "appId": "1:598865578283:web:edb8d8eb2eef1c9129dd6e",
  "apiKey": "AIzaSyCY2OXKl8QB-4-YqHNiLWRVcLXwn-xP-mY",
  "authDomain": "laxmi-artworks.firebaseapp.com",
  "storageBucket": "laxmi-artworks.firebasestorage.app",
  "messagingSenderId": "598865578283"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-laxmiartworks-323eeacf-ef7f-4ebf-be48-501590306148");

async function run() {
    try {
        const admins = [
            { email: 'nayanxx009@gmail.com', pass: 'nayan' },
            { email: 'gargsubhalaxmi@gmail.com', pass: 'subh' },
            { email: 'bolt36520@gmail.com', pass: 'bolt' }
        ];
        for (const a of admins) {
            await setDoc(doc(db, 'admins', a.email), {
                email: a.email,
                password: a.pass,
                role: 'admin',
                updatedAt: Date.now()
            }, { merge: true });
            console.log('Set', a.email);
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
