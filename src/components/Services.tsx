import { motion } from 'motion/react';
import { Pencil, User, Sparkles, MonitorPlay, Palette, Brush } from 'lucide-react';

export default function Services() {
  const services = [
    {
      title: "Pencil Sketches",
      description: "Hyper-realistic pencil sketches that capture true emotion, depth, and shadow play.",
      icon: Pencil,
      style: "border-neutral-700"
    },
    {
      title: "Portrait Art",
      description: "Custom portrait drawings perfect for gifting, memories, and personal collections.",
      icon: User,
      style: "border-amber-700/50"
    },
    {
      title: "Anime Art",
      description: "Vibrant and stylistic anime illustrations for fans, setups, and original characters.",
      icon: Sparkles,
      style: "border-orange-700/50"
    },
    {
      title: "Digital Illustration",
      description: "Premium digital artwork crafted for modern aesthetics, covers, and commercial use.",
      icon: MonitorPlay,
      style: "border-blue-700/50"
    },
    {
      title: "Custom Artwork",
      description: "Bespoke commissions tailored exactly to your vision, concept, and specific requirements.",
      icon: Palette,
      style: "border-emerald-700/50"
    },
    {
      title: "Aesthetic Paintings",
      description: "Handmade creative paintings on canvas using acrylics, oils, and mixed media.",
      icon: Brush,
      style: "border-rose-700/50"
    }
  ];

  return (
    <section id="services" className="py-28 relative z-10 bg-[#030303] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-amber-500"></span>
              Specialties
            </h2>
            <h3 className="text-4xl md:text-6xl font-display font-medium">
              Curated <span className="text-gradient italic">Services</span>
            </h3>
          </div>
          <p className="text-neutral-400 max-w-sm text-sm lg:text-base mb-2 font-light">
            A comprehensive suite of artistic capabilities, merging traditional techniques with modern digital tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="group relative h-full bg-gradient-glow"
            >
              <div className={`relative h-full glass-card p-10 flex flex-col items-start z-10 transition-all duration-500 border-l-2 ${service.style} border-y-white/5 border-r-white/5 rounded-3xl shadow-lg group-hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] group-hover:-translate-y-1`}>
                <div className="p-3 mb-6 bg-white/5 border border-white/10 text-amber-500 rounded-full">
                  <service.icon size={26} strokeWidth={1.5} />
                </div>
                <h4 className="text-2xl font-medium font-display mb-4 text-white">{service.title}</h4>
                <p className="text-neutral-400 font-light leading-relaxed text-sm">
                  {service.description}
                </p>
                <a href="#contact" className="mt-8 flex items-center text-xs font-bold uppercase tracking-widest text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity before:absolute before:inset-0">
                  Inquire Now <span className="ml-2">→</span>
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
