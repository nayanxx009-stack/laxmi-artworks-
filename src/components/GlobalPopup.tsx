import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useSiteConfig } from '../lib/SiteContext';

export default function GlobalPopup() {
  const config = useSiteConfig();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (config.popupEnabled && config.popupImage) {
      const freq = config.popupFrequency || 'session';
      let shouldShow = false;

      if (freq === 'always') {
        shouldShow = true;
      } else if (freq === 'session') {
        if (!sessionStorage.getItem('popup_closed')) {
          shouldShow = true;
        }
      } else if (freq === 'daily') {
        const lastShown = localStorage.getItem('popup_last_shown');
        if (!lastShown) {
          shouldShow = true;
        } else {
          const lastDate = new Date(parseInt(lastShown)).toDateString();
          const today = new Date().toDateString();
          if (lastDate !== today) shouldShow = true;
        }
      } else if (freq === 'once') {
        if (!localStorage.getItem('popup_shown_once')) {
          shouldShow = true;
        }
      }

      if (shouldShow) {
        setIsVisible(true);
        if (freq === 'daily') localStorage.setItem('popup_last_shown', Date.now().toString());
        if (freq === 'once') localStorage.setItem('popup_shown_once', 'true');
      }
    } else {
      setIsVisible(false);
    }
  }, [config.popupEnabled, config.popupImage, config.popupFrequency]);

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem('popup_closed', 'true');
  };

  if (!config.popupEnabled || !config.popupImage) return null;

  return (
    <AnimatePresence>
      {isVisible && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative max-w-md md:max-w-xl w-full flex flex-col items-center justify-center rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            <button 
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-md"
            >
              <X size={20} />
            </button>
            <img 
              src={config.popupImage} 
              alt="Announcement" 
              className="w-full object-contain max-h-[85vh] bg-black"
            />
          </motion.div>
        </div>,
        document.body
      )}
    </AnimatePresence>
  );
}
