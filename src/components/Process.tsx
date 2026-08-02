import { motion } from 'motion/react';
import { MessageSquare, PenTool, Image as ImageIcon, PackageCheck } from 'lucide-react';

export default function Process() {
  const steps = [
    {
      title: "Consultation",
      description: "We align on vision, references, dimensions, and medium.",
      icon: MessageSquare
    },
    {
      title: "Concept Art",
      description: "A preliminary sketch to ensure the composition captures the idea.",
      icon: PenTool
    },
    {
      title: "Realization",
      description: "Careful rendering and detailing with process updates.",
      icon: ImageIcon
    },
    {
      title: "Delivery",
      description: "Secure packaging and global dispatch of your masterpiece.",
      icon: PackageCheck
    }
  ];

  return (
    <section id="process" className="py-28 relative z-10 w-full overflow-hidden bg-[#080808] border-y border-white/5">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-amber-500/5 blur-[100px] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-20">
          <h2 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-4 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-amber-500"></span> Workflow <span className="w-8 h-px bg-amber-500"></span>
          </h2>
          <h3 className="text-4xl md:text-5xl font-display font-medium">
            How The <span className="text-gradient italic">Magic</span> Happens
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
             <motion.div 
               key={i}
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ delay: i * 0.15 }}
               className="relative"
             >
               {i < 3 && <div className="hidden lg:block absolute top-[28px] left-[60%] w-[80%] h-px bg-white/10" />}
               <div className="relative mb-8 inline-flex items-center justify-center">
                 <span className="absolute -inset-4 border border-amber-500/20 rounded-full scale-0 group-hover:scale-100 transition-transform duration-500"></span>
                 <div className="relative w-14 h-14 bg-[#050505] border border-amber-500/40 rounded-full flex items-center justify-center text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)] z-10">
                    <span className="absolute -top-2 -left-2 text-[10px] bg-amber-500 text-black w-5 h-5 flex items-center justify-center rounded-full font-bold">
                        {i + 1}
                    </span>
                    <step.icon size={22} strokeWidth={1.5} />
                 </div>
               </div>
               <h4 className="text-xl font-medium font-display mb-3 text-neutral-50">{step.title}</h4>
               <p className="text-neutral-400 text-sm leading-relaxed font-light">{step.description}</p>
             </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
