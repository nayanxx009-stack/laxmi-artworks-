import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function GlobalPopup() {
  const [popupConfig, setPopupConfig] = useState<{ enabled: boolean; imageUrl: string } | null>(null);
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    // Read canonical settings/popup directly from Firestore
    const unsub = onSnapshot(
      doc(db, 'settings', 'popup'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const enabled = Boolean(data?.enabled);
          const imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl.trim() : '';
          setPopupConfig({ enabled, imageUrl });
        } else {
          setPopupConfig({ enabled: false, imageUrl: '' });
        }
      },
      (err) => {
        console.warn('[GlobalPopup] Notice reading settings/popup:', err);
      }
    );

    return () => unsub();
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsClosed(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Do not render if closed in this instance, or not enabled, or no imageUrl
  if (isClosed || !popupConfig || !popupConfig.enabled || !popupConfig.imageUrl) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {!isClosed && (
        <div
          id="global-popup-backdrop"
          onClick={() => setIsClosed(true)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity cursor-pointer"
        >
          <motion.div
            id="global-popup-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative max-w-md md:max-w-xl w-full flex flex-col items-center justify-center rounded-3xl overflow-hidden shadow-2xl bg-neutral-950 border border-white/10 cursor-default"
          >
            <button
              id="global-popup-close-button"
              type="button"
              onClick={() => setIsClosed(true)}
              aria-label="Close popup"
              className="absolute top-4 right-4 z-10 p-2.5 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors backdrop-blur-md focus:outline-none"
            >
              <X size={20} />
            </button>
            <img
              id="global-popup-image"
              src={popupConfig.imageUrl}
              alt="Announcement Popup"
              className="w-full object-contain max-h-[85vh] bg-black"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
