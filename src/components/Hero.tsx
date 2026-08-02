import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Star } from 'lucide-react';
import { useRef } from 'react';
import { useSiteConfig } from '../lib/SiteContext';
import { useLanguage } from '../lib/LanguageContext';

export default function Hero() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  const { heroTitle, heroSubtitle } = useSiteConfig();

  return (
    <section 
      id="home" 
      ref={containerRef}
      className="relative min-h-[calc(100vh-80px)] flex items-center justify-center pt-10 pb-20 overflow-hidden"
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[150px] mix-blend-screen" />
        <div className="absolute bottom-[20%] right-[20%] w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[150px] mix-blend-screen" />
        <motion.div 
          style={{ y, opacity }}
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.08] mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/50 via-[#030303] to-[#030303]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center min-h-[80vh] text-center">
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex items-center gap-2 border border-amber-500/20 bg-amber-500/5 px-5 py-2 rounded-full mb-8 backdrop-blur-sm"
        >
          <span className="flex text-amber-500 block"><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /></span>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Award-Winning Studio</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="text-4xl md:text-5xl lg:text-6xl font-display font-medium tracking-tight mb-6 leading-tight whitespace-pre-wrap"
        >
          {heroTitle}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="max-w-2xl text-lg md:text-xl text-neutral-400 mb-12 font-light whitespace-pre-wrap"
        >
          {heroSubtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-5 items-center justify-center w-full sm:w-auto"
        >
          <a
            href="#gallery"
            className="group w-full sm:w-auto px-8 py-4 text-sm font-bold uppercase tracking-widest bg-amber-500 text-neutral-950 hover:bg-amber-400 transition-colors flex items-center justify-center gap-3 rounded-full"
          >
            View Portfolio
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href="#contact"
            className="group w-full sm:w-auto px-8 py-4 text-sm font-bold uppercase tracking-widest text-neutral-100 border border-white/20 hover:border-amber-500 hover:text-amber-500 transition-colors flex items-center justify-center rounded-full bg-white/5 backdrop-blur-sm"
          >
            Commission Inquiry
          </a>
        </motion.div>

        <motion.div 
           initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1 }}
           className="mt-20 pt-10 border-t border-white/5 w-full max-w-4xl flex flex-col items-center"
        >
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-6 font-semibold">Trusted By & Featured In</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
             <span className="text-xl md:text-2xl font-display font-medium tracking-widest text-[#d4af37]">THE GALLERY</span>
             <span className="text-xl md:text-2xl font-display font-bold italic tracking-wide text-white">Artisan</span>
             <span className="text-xl md:text-2xl font-display uppercase tracking-widest text-neutral-300">Vougue Art</span>
             <span className="text-xl md:text-2xl font-display font-semibold tracking-wider text-[#e6c27a]">STUDIO 99</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
