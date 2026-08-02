const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const anchor = `  const addAdmin = async (e: FormEvent) => {`;

const funcs = `  const updateReviewStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'reviews', id), { status: newStatus });
      setReviews(reviews.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      await deleteDoc(doc(db, 'reviews', id));
      setReviews(reviews.filter(r => r.id !== id));
      setStats(prev => ({ ...prev, totalReviews: prev.totalReviews - 1 }));
    } catch (e) {
      console.error(e);
    }
  };

  const addAdmin = async (e: FormEvent) => {`;

code = code.replace(anchor, funcs);
fs.writeFileSync('src/components/AdminPanel.tsx', code);
