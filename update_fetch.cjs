const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const oldFetch = `      const qReviews = query(collection(db, 'reviews'));
      const revSnap = await getDocs(qReviews);
      
      const qSubscribers = query(collection(db, 'subscribers'));
      const subSnap = await getDocs(qSubscribers);

      setStats({
        totalUsers: uniqueEmails.size,
        totalReviews: revSnap.size,
        totalSubscribers: subSnap.size,
        revenue: ordersData.length * 100 // Advance calculation
      });`;

const newFetch = `      const qReviews = query(collection(db, 'reviews'));
      const revSnap = await getDocs(qReviews);
      setReviews(revSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const qSubscribers = query(collection(db, 'subscribers'), orderBy('createdAt', 'desc'));
      const subSnap = await getDocs(qSubscribers);
      setSubscribers(subSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      setUsersList(Array.from(uniqueEmails).map(email => ({ email })));

      setStats({
        totalUsers: uniqueEmails.size,
        totalReviews: revSnap.size,
        totalSubscribers: subSnap.size,
        revenue: ordersData.length * 100 // Advance calculation
      });`;

code = code.replace(oldFetch, newFetch);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
