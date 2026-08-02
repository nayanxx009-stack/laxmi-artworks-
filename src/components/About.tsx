import { motion } from 'motion/react';
import { Palette, Heart, CheckCircle } from 'lucide-react';
import { useSiteConfig } from '../lib/SiteContext';

export default function About() {
  const { aboutText } = useSiteConfig();
  
  const stats = [
    { label: "Artworks Delivered", value: "500+", icon: Palette },
    { label: "Happy Clients", value: "300+", icon: Heart },
    { label: "Years Experience", value: "5+", icon: CheckCircle },
  ];

  return (
    <section id="about" className="py-28 relative z-10 w-full overflow-hidden bg-[#050505]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="relative order-2 lg:order-1"
          >
            <div className="absolute -inset-4 bg-gradient-to-tr from-amber-600/20 to-orange-600/20 blur-3xl rounded-full pointer-events-none" />
            <div className="relative aspect-[4/5] rounded-[40px] overflow-hidden p-3 bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_0_40px_-10px_rgba(245,158,11,0.1)]">
              <div className="w-full h-full relative overflow-hidden group rounded-[32px]">
                <img 
                  src="https://images.unsplash.com/photo-1543857778-c4a1a3e0b2eb?q=80&w=1000&auto=format&fit=crop" 
                  alt="Artist in studio" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-80 mix-blend-luminosity group-hover:mix-blend-normal group-hover:scale-105 transition-all duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-transparent" />
                
                <div className="absolute bottom-6 left-6 right-6 border border-amber-500/30 bg-[#030303]/80 backdrop-blur-md p-4 flex items-center gap-4 rounded-full">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center">
                    <span className="text-amber-500 font-bold font-display text-xl">L</span>
                  </div>
                  <div>
                    <p className="text-white font-bold font-display leading-tight">Laxmi Artworks</p>
                    <p className="text-xs text-amber-400 uppercase tracking-wider mt-1">Lead Artist & Founder</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="order-1 lg:order-2"
          >
            <h2 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-amber-500"></span>
              The Artist
            </h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium mb-8 leading-tight">
              Mastering the <span className="text-gradient italic">Craft</span> of visual storytelling.
            </h3>
            
            <div className="space-y-6 text-neutral-400 text-lg font-light leading-relaxed mb-10 whitespace-pre-wrap">
              {aboutText}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-white/10">
              {stats.map((stat, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-3xl font-display text-amber-500 mb-1">{stat.value}</span>
                  <span className="text-xs text-neutral-400 uppercase tracking-widest font-semibold">{stat.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
