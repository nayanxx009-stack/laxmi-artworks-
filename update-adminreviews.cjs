const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');

const targetFunction = `  const updateReviewStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'reviews', id), { status: newStatus });
      alert('Review status updated successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to update review status');
    }
  };`;

const newFunction = `  const updateReviewStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'reviews', id), { status: newStatus });
      alert('Review status updated successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to update review status');
    }
  };
  
  const replyReview = async (id: string) => {
    const reply = prompt("Enter your reply for this review:");
    if (reply === null) return;
    try {
      await updateDoc(doc(db, 'reviews', id), { adminReply: reply.trim() });
      alert('Reply added successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to add reply');
    }
  };`;

const targetButton = `                                <button onClick={() => deleteReview(r.id)} className="text-red-400 hover:text-red-300">
                                  <Trash2 size={16} />
                                </button>`;

const newButton = `                                <button onClick={() => replyReview(r.id)} className="text-amber-500 hover:text-amber-400 mr-3" title="Reply to review">
                                  Reply
                                </button>
                                <button onClick={() => deleteReview(r.id)} className="text-red-400 hover:text-red-300" title="Delete review">
                                  <Trash2 size={16} />
                                </button>`;

if (code.includes(targetFunction) && code.includes(targetButton)) {
  code = code.replace(targetFunction, newFunction);
  code = code.replace(targetButton, newButton);
  fs.writeFileSync('src/components/AdminPanel.tsx', code);
  console.log("Updated AdminPanel reviews");
} else {
  console.log("Could not find targets in AdminPanel.tsx");
}
