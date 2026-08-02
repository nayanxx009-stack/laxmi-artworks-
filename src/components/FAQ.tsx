import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Do you accept international art commissions?",
      answer: "Yes, I create digital art for clients worldwide. Physical paintings and sketches can also be shipped internationally using insured art couriers, though shipping costs and times will vary based on your location and painting size."
    },
    {
      question: "What is the typical turnaround time for a custom portrait?",
      answer: "Depending on the complexity, detail level, and medium (graphite, digital, canvas painting), a custom portrait typically takes anywhere from 1 to 3 weeks. An exact timeline is provided during our initial consultation."
    },
    {
      question: "Do you require a deposit before starting work?",
      answer: "Yes, I require a standard 50% non-refundable deposit to secure your slot in my schedule and cover initial material costs. The remaining 50% is due upon completion and your final approval, prior to shipping."
    },
    {
      question: "Can you restore or recreate a damaged vintage photograph?",
      answer: "Absolutely. I can reference an old, torn, or faded photograph and translate it into a stunning, high-contrast graphite portrait or a hyper-detailed digital reconstruction that preserves the original emotion."
    }
  ];

  return (
    <section className="py-28 relative z-10 w-full bg-[#030303]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-4 flex items-center justify-center gap-3">
             <span className="w-8 h-px bg-amber-500"></span> Information <span className="w-8 h-px bg-amber-500"></span>
          </h2>
          <h3 className="text-4xl md:text-5xl font-display font-medium">
            Common <span className="text-gradient italic">Inquiries</span>
          </h3>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="border border-white/10 bg-[#080808] transition-colors hover:border-white/20 rounded-3xl overflow-hidden shadow-sm"
            >
              <button
                className="w-full px-6 py-6 text-left flex justify-between items-center bg-transparent"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className={`font-medium text-lg ${openIndex === index ? 'text-amber-500' : 'text-neutral-200'}`}>
                  {faq.question}
                </span>
                <span className="text-neutral-500 ml-4 flex-shrink-0">
                   {openIndex === index ? <Minus size={20} /> : <Plus size={20} />}
                </span>
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <div className="px-6 pb-6 text-neutral-400 font-light leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
