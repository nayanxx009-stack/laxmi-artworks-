import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { Expand, Loader2 } from 'lucide-react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';



export default function Gallery() {
  const [filter, setFilter] = useState('All');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const categories = ['All', 'Fine Art', 'Sketches', 'Anime', 'Digital'];

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
        const q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setItems([]);
      } else {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setLoading(false);
    }, (err) => {
      if (err.code !== 'unavailable' && !err.message?.includes('offline')) {
        console.error("Error fetching gallery:", err);
      }
      setItems([]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredItems = filter === 'All' ? items : items.filter(item => item.cat === filter);

  return (
    <section id="gallery" className="py-28 relative z-10 w-full overflow-hidden bg-[#030303]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
           <h2 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-4 flex items-center justify-center gap-3">
             <span className="w-8 h-px bg-amber-500"></span> Exhibition <span className="w-8 h-px bg-amber-500"></span>
           </h2>
           <h3 className="text-4xl md:text-6xl font-display font-medium">
             Selected <span className="text-gradient italic">Masterpieces</span>
           </h3>
        </div>

        <motion.div
           initial={{ opacity: 0, y: 10 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           className="flex flex-wrap justify-center gap-4 mb-16"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-6 py-2.5 text-xs uppercase tracking-widest font-bold transition-all duration-300 border rounded-full ${
                filter === cat 
                  ? 'bg-amber-500 text-black border-amber-500' 
                  : 'bg-transparent text-neutral-400 border-white/10 hover:border-amber-500/50 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {loading ? (
          <div className="py-20 flex justify-center text-amber-500">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[350px]">
            <AnimatePresence>
              {filteredItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className={`group relative overflow-hidden cursor-pointer rounded-3xl shadow-lg border border-white/5 ${
                    index === 1 || index === 4 ? 'md:col-span-2 lg:col-span-1' : ''
                  }`}
                  onClick={() => setSelectedImage(item.img)}
                >
                  <div className="absolute inset-0 border border-white/10 z-20 pointer-events-none group-hover:border-amber-500/50 transition-colors duration-500 rounded-3xl" />
                  <img 
                    src={item.img} 
                    alt={item.title} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale-[30%] group-hover:grayscale-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8 z-10">
                    <span className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                       <span className="w-4 h-px bg-amber-500"></span> {item.cat}
                    </span>
                    <h4 className="text-2xl font-display font-medium text-white flex items-center justify-between">
                      {item.title}
                      <Expand size={20} className="text-white/50 group-hover:text-amber-500 transition-colors" />
                    </h4>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] bg-[#030303]/95 backdrop-blur-xl flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.img 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              src={selectedImage} 
              alt="Expanded view" 
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[90vh] object-contain shadow-2xl border border-white/5 pointer-events-auto rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-8 right-8 text-neutral-400 hover:text-amber-500 bg-white/5 p-3 rounded-full backdrop-blur-md border border-white/10 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
