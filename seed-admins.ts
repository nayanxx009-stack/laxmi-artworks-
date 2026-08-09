import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
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
    process.exit(0);
}
run();
