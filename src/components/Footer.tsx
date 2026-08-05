import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Footer() {
  const [clickCount, setClickCount] = useState(0);
  const navigate = useNavigate();

  const handleSecretClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount === 5) {
      navigate('/secret-admin');
    }
  };

  return (
    <footer className="bg-[#030303] pt-16 pb-8 relative z-50 w-full border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
          <div>
            <h4 className="text-xl font-display font-bold text-white mb-4">Laxmi Artworks</h4>
            <p className="text-sm text-neutral-400 font-light leading-relaxed max-w-sm">
              Dedicated to crafting extraordinary custom artwork with passion and precision. Every piece is a journey from concept to a masterpiece, reflecting your unique vision.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-4">Legal & Policies</h4>
            <ul className="space-y-2 text-sm text-neutral-400 font-light">
              <li className="hover:text-white transition-colors cursor-pointer">Privacy Policy</li>
              <li className="hover:text-white transition-colors cursor-pointer">Terms of Service</li>
              <li className="hover:text-white transition-colors cursor-pointer">Shipping & Delivery</li>
              <li className="hover:text-white transition-colors cursor-pointer">Refund Policy</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-500 font-light">
            © 2026 Laxmi Artworks. All Rights Reserved.
          </p>
          <button 
            onClick={handleSecretClick} 
            className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-widest text-neutral-800 hover:text-neutral-600 transition-colors bg-transparent border-none p-4"
            aria-label="Secret Admin Access"
          >
            2026 Laxmi artworks
          </button>
        </div>
      </div>
    </footer>
  );
}
