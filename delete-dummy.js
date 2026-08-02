import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "laxmi-artworks",
  "appId": "1:598865578283:web:edb8d8eb2eef1c9129dd6e",
  "apiKey": "AIzaSyCY2OXKl8QB-4-YqHNiLWRVcLXwn-xP-mY",
  "authDomain": "laxmi-artworks.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-laxmiartworks-323eeacf-ef7f-4ebf-be48-501590306148"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snapshot = await getDocs(collection(db, 'orders'));
  console.log(`Found ${snapshot.docs.length} total orders`);
  for (const d of snapshot.docs) {
    const data = d.data();
    if (data.status === 'Pending Payment' || data.paymentStatus === 'Pending Payment') {
       console.log("Deleting dummy order:", d.id);
       await deleteDoc(d.ref);
    }
  }
  process.exit(0);
}
run().catch(console.error);
