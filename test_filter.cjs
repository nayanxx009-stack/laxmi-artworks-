const fs = require('fs');
let code = fs.readFileSync('src/components/Testimonials.tsx', 'utf8');

const oldFetch = `      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Review);
      });
      data.sort((a, b) => b.createdAt - a.createdAt);
      setReviews(data);`;

const newFetch = `      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Review);
      });
      data.sort((a, b) => b.createdAt - a.createdAt);
      setReviews(data.filter(r => r.status === 'Approved'));`;

code = code.replace(oldFetch, newFetch);
fs.writeFileSync('src/components/Testimonials.tsx', code);
