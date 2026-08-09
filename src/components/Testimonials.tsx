import { motion, AnimatePresence } from 'motion/react';
import { Quote, Star, Plus, X, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface Review {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  rating: number;
  comment: string;
  createdAt: number;
  status: string;
  adminReply?: string;
}

export default function Testimonials() {
  const { user, loginWithGoogle } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  

  const [guestName, setGuestName] = useState("");
  
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
      

    const q = query(
      collection(db, 'reviews'),
      limit(30)
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: Review[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Review);
      });
      data.sort((a, b) => b.createdAt - a.createdAt);
      setReviews(data.filter(r => r.status?.toLowerCase() === 'approved'));
      setLoading(false);
    }, (err) => {
      console.error("Failed to fetch reviews via snapshot", err);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const finalName = user?.displayName || guestName.trim() || "Art Collector";
    
    setIsSubmitting(true);
    const isGuest = !user;
    const reviewStatus = isGuest ? "pending" : "approved";
    
    try {
      await addDoc(collection(db, 'reviews'), {
        userId: user?.uid || "guest_" + Date.now(),
        userName: finalName,
        userImage: user?.photoURL || null,
        rating: formRating,
        comment: formComment,
        status: reviewStatus,
        createdAt: Date.now()
      });
    } catch(err) {
      console.error("Failed to submit review to firestore", err);
    }

    setIsSubmitting(false);
    setShowReviewForm(false);
    setFormComment("");
    setGuestName("");
    setFormRating(5);
    setToastMessage(isGuest ? "Your review has been submitted and is pending approval." : "Your review has been submitted and is live.");
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 5000);
  };

  // Combine fetched firestore reviews + local guest reviews + default testimonials without duplicates
  const allCombined = reviews;
  const uniqueLive = allCombined.filter((rev, idx, arr) => rev.status === "Approved" && arr.findIndex(r => r.comment === rev.comment && r.userName === rev.userName) === idx);
  
  const displayReviews = uniqueLive;

  return (
    <section className="py-28 relative z-10 w-full overflow-hidden bg-[#0a0a0a]">
      {/* Live Toast Banner */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500 text-neutral-950 font-bold px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 text-sm border border-emerald-300"
          >
            <CheckCircle2 size={18} /> Thank you! {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Review Form Modal */}
      <AnimatePresence>
        {showReviewForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowReviewForm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#050505] border border-white/10 p-8 rounded-3xl shadow-[0_0_40px_-10px_rgba(245,158,11,0.1)] max-w-lg w-full relative border-amber-500/20"
            >
              <button 
                onClick={() => setShowReviewForm(false)}
                className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-2xl font-display font-medium text-white mb-2">Write a Review</h3>
              <p className="text-neutral-400 font-light text-sm mb-6">Share your experience with Laxmi Artworks.</p>
              
              <form onSubmit={handleReviewSubmit}>
                {!user ? (
                  <div className="text-center py-6">
                    <p className="text-neutral-400 mb-6">You must be logged in to write a review.</p>
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="px-8 py-3 bg-white text-black font-bold uppercase tracking-widest text-sm hover:bg-neutral-200 transition-colors rounded-full"
                    >
                      Login to Continue
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFormRating(star)}
                            className={`focus:outline-none transition-colors ${formRating >= star ? 'text-amber-500' : 'text-neutral-600 hover:text-neutral-400'}`}
                          >
                            <Star size={28} fill="currentColor" />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Your Experience *</label>
                      <textarea 
                        required
                        rows={4}
                        value={formComment}
                        onChange={(e) => setFormComment(e.target.value)}
                        placeholder="Tell us what you loved..."
                        className="w-full bg-neutral-900 border border-white/10 p-6 rounded-3xl text-white focus:outline-none focus:border-amber-500 transition-colors resize-none"
                      />
                    </div>
                    
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full py-4 text-neutral-950 bg-amber-500 font-bold uppercase tracking-widest text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 rounded-full cursor-pointer shadow-md"
                    >
                      {isSubmitting ? 'Posting Review...' : 'Post Verified Review'}
                    </button>
                  </>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6 border-b border-white/5 pb-8">
          <div>
            <h2 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-amber-500"></span> Recognition
            </h2>
            <h3 className="text-4xl md:text-5xl font-display font-medium mb-4">
              Client <span className="text-gradient italic">Testimonials</span>
            </h3>
            <div className="flex gap-1 text-amber-500">
               <Star fill="currentColor" size={18} />
               <Star fill="currentColor" size={18} />
               <Star fill="currentColor" size={18} />
               <Star fill="currentColor" size={18} />
               <Star fill="currentColor" size={18} />
               <span className="text-neutral-400 text-sm ml-3 font-light">Based on authentic collector experiences</span>
            </div>
          </div>
          
          <button 
            onClick={() => setShowReviewForm(true)}
            className="group flex items-center gap-2 px-6 py-3 border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all outline-none rounded-full text-xs font-bold uppercase tracking-widest text-white shadow-sm hover:shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]"
          >
            <Plus size={16} className="text-amber-500 group-hover:rotate-90 transition-transform duration-300" /> Write a Review
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayReviews.map((test, i) => (
            <motion.div
              key={test.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="bg-[#050505] border border-white/5 p-10 relative group hover:border-amber-500/20 transition-all duration-500 flex flex-col rounded-3xl shadow-lg hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.1)] hover:-translate-y-1"
            >
              <Quote size={48} fill="currentColor" strokeWidth={0} className="absolute top-8 right-8 text-white/5 group-hover:text-amber-500/5 transition-colors duration-500" />
              
              <div className="flex gap-1 mb-6 text-amber-500">
                 {[...Array(Math.max(0, Math.min(5, Number(test.rating) || 0)))].map((_, idx) => (
                   <Star key={idx} size={14} fill="currentColor" />
                 ))}
                 {[...Array(Math.max(0, 5 - Math.max(0, Math.min(5, Number(test.rating) || 0))))].map((_, idx) => (
                   <Star key={`empty-${idx}`} size={14} className="text-neutral-800" fill="currentColor" />
                 ))}
              </div>

              <p className="text-neutral-300 font-light leading-relaxed italic mb-4 flex-grow">
                "{test.comment}"
              </p>
              {test.adminReply && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-6">
                  <p className="text-amber-500 font-bold text-xs uppercase tracking-widest mb-1">Reply from Laxmi Artworks</p>
                  <p className="text-amber-100/80 text-sm font-light">"{test.adminReply}"</p>
                </div>
              )}

              <div className="flex items-center gap-4 pt-6 border-t border-white/5">
                <div className="w-12 h-12 bg-neutral-900 border border-white/10 flex items-center justify-center text-amber-500 font-display text-xl rounded-full overflow-hidden">
                  {test.userImage ? (
                    <img src={test.userImage} alt={test.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (test.userName || 'A').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{test.userName}</h4>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mt-1">Verified Client</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
