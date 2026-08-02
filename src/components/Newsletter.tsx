import { motion } from 'motion/react';
import { FormEvent, useState } from 'react';
import { collection, addDoc, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Newsletter() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    
    try {
      
      await setDoc(doc(db, 'subscribers', email.toLowerCase()), {
        email: email,
        createdAt: Date.now(),
        status: 'active'
      }, { merge: true });
      setStatus("success");
      form.reset();

    } catch (err: any) {
      console.error("Firebase save subscriber failed:", err);
      setErrorMessage(err.message || "Failed to subscribe. Please try again.");
      setStatus("error");
    }
    
    setTimeout(() => {
      setStatus('idle');
      setErrorMessage(null);
    }, 5000);
  };

  return (
    <section className="py-24 relative z-10 w-full overflow-hidden bg-[#050505] border-y border-white/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-[url('https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center rounded-[40px] overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-[#030303]/90 backdrop-blur-sm mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 to-orange-900/10" />
          
          <div className="relative z-10 p-10 md:p-16 text-center flex flex-col items-center">
            <h3 className="text-3xl md:text-5xl font-display font-medium mb-4 text-white">
              The <span className="text-gradient italic">Collector's</span> List
            </h3>
            <p className="text-neutral-300 max-w-lg mx-auto mb-8 font-light">
              Subscribe for exclusive previews of upcoming collections, rare commission openings, and insights from the studio.
            </p>
            
            <form className="w-full max-w-md flex flex-col gap-4 shadow-2xl items-center" onSubmit={handleSubmit}>
              
              
              
              <div className="w-full flex flex-col sm:flex-row gap-3">
                <input 
                  type="email" 
                  name="email"
                  placeholder="Enter your email address" 
                  required
                  className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-4 rounded-full text-white placeholder-neutral-400 focus:outline-none focus:border-amber-500 transition-all min-w-0"
                />
                <button 
                  type="submit" 
                  disabled={status === 'sending'}
                  className="px-8 py-4 bg-amber-500 text-black text-sm font-bold rounded-full uppercase tracking-widest hover:bg-amber-400 transition-colors whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {status === 'sending' ? 'Joining...' : status === 'success' ? 'Added' : 'Join'}
                </button>
              </div>
              
            </form>
            {errorMessage && (
              <p className="text-red-500 text-xs font-bold uppercase tracking-widest mt-4">
                {errorMessage}
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
