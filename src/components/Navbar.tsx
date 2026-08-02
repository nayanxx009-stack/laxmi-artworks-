import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, User as UserIcon, LogOut, Clock, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import InquiryStatusModal from './InquiryStatusModal';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const { user, loginWithGoogle, logout } = useAuth();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    const handleOpenStatus = () => setIsStatusModalOpen(true);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('open-status-modal', handleOpenStatus);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('open-status-modal', handleOpenStatus);
    };
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'About', href: '#about' },
    { name: 'Services', href: '#services' },
    { name: 'Portfolio', href: '#gallery' },
    { name: 'Process', href: '#process' },
  ];

  return (
    <>
    <nav
      className={`sticky top-0 left-0 w-full z-50 transition-all duration-500 ${
        isScrolled ? 'glass py-4' : 'bg-[#030303] py-4 sm:py-6 border-b border-white/5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <a href="#home" className="text-2xl font-display font-bold tracking-widest uppercase flex items-center gap-2">
          Laxmi <span className="text-gradient">Artworks</span>
        </a>

        <div className="hidden lg:flex items-center space-x-8 xl:space-x-10">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-xs font-semibold uppercase tracking-widest text-neutral-400 hover:text-amber-400 transition-colors"
            >
              {link.name}
            </a>
          ))}
          
          <button 
            onClick={() => setIsStatusModalOpen(true)}
            className="text-xs font-semibold uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-2"
          >
            <Clock size={14} /> Status
          </button>

          {user ? (
            <div className="relative">
              <button 
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="w-10 h-10 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center overflow-hidden hover:border-amber-500/50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon size={18} className="text-neutral-400" />
                )}
              </button>
              
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-xs font-bold text-white truncate">{user.displayName}</p>
                    <p className="text-[10px] text-neutral-500 truncate mt-0.5">{user.email}</p>
                  </div>
                  <button 
                    onClick={() => {
                      logout();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={() => window.location.href = "/login"}
              className="text-xs font-semibold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <UserIcon size={14} /> Login
            </button>
          )}

          <a
            href="#contact"
            className="group relative px-6 py-2.5 text-xs font-bold uppercase tracking-widest"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-orange-600 rounded-full blur-sm opacity-50 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative bg-[#030303] px-6 py-2.5 border border-amber-500/30 hover:bg-neutral-900 transition flex items-center justify-center w-full h-full rounded-full text-neutral-100">
              Hire Me
            </div>
          </a>
          <button
             onClick={() => window.dispatchEvent(new Event('open-live-chat'))}
             className="text-xs font-semibold uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-2 ml-4"
          >
            <MessageSquare size={14} /> Contact Us
          </button>
        </div>

        <button
          className="lg:hidden text-neutral-300 hover:text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      <AnimatePresence>
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="lg:hidden glass border-t border-white/5 absolute top-full left-0 w-full overflow-hidden shadow-2xl"
        >
          <div className="px-4 py-8 flex flex-col space-y-6 text-center">
            {user && (
               <div className="flex flex-col items-center justify-center space-y-2 mb-4 pb-4 border-b border-white/5">
                 <img src={user.photoURL || ""} alt={user.displayName || "User"} referrerPolicy="no-referrer" className="w-12 h-12 rounded-full border border-white/10" />
                 <p className="text-sm font-bold text-white">{user.displayName}</p>
                 <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="text-xs text-red-400 font-bold uppercase tracking-widest mt-2">Sign Out</button>
               </div>
            )}
            
            <button 
              onClick={() => {
                setIsStatusModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="text-lg font-display tracking-wider text-amber-500 flex items-center justify-center gap-2"
            >
              <Clock size={18} /> INQUIRY STATUS
            </button>
            
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-display tracking-wider text-neutral-300 hover:text-amber-400"
              >
                {link.name}
              </a>
            ))}
            
            {!user && (
               <button 
                 onClick={() => { window.location.href = "/login"; setMobileMenuOpen(false); }}
                 className="text-lg font-display tracking-wider text-neutral-300 hover:text-white"
               >
                 LOGIN
               </button>
            )}
            
            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-display tracking-wider text-amber-500 mt-4"
            >
              HIRE ME
            </a>
            
            <button
               onClick={() => {
                 window.dispatchEvent(new Event('open-live-chat'));
                 setMobileMenuOpen(false);
               }}
               className="text-lg font-display tracking-wider text-amber-500 flex items-center justify-center gap-2 mt-4"
            >
              <MessageSquare size={18} /> CONTACT US
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </nav>
    <InquiryStatusModal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} />
    </>
  );
}
