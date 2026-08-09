const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const targetStr = `      unsubSubscribers = onSnapshot(qSubscribers, (snapshot) => {
        setSubscribers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setStats(prev => ({ ...prev, totalSubscribers: snapshot.size }));
      }, (error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); });
    }`;

const newStr = `      unsubSubscribers = onSnapshot(qSubscribers, (snapshot) => {
        setSubscribers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setStats(prev => ({ ...prev, totalSubscribers: snapshot.size }));
      }, (error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); });
      
      const qInquiries = query(collection(db, 'inquiries'));
      unsubInquiries = onSnapshot(qInquiries, (snapshot) => {
        setStats(prev => ({ ...prev, totalInquiries: snapshot.size }));
      }, (error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); });
    }`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
  console.log("Updated AdminPanel inquiries stats");
} else {
  console.log("Could not find targetStr");
}
