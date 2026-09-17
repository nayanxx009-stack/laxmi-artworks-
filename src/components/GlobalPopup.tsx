import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { PopupConfig } from '../types';

// Safe storage utilities for browser environment
function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function safeGetSessionStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetSessionStorage(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

// Generate unique, deterministic storage key per image URL to auto-reset limits when image changes
function getPopupStorageKey(url: string): string {
  if (!url) return 'none';
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  const clean = url.split('?')[0].split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16) || 'img';
  return `${clean}_${Math.abs(hash)}`;
}

export default function GlobalPopup() {
  const [popupConfig, setPopupConfig] = useState<PopupConfig | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  const activeImageRef = useRef<string>('');
  const hasRecordedShowRef = useRef<string>('');

  // 1. Read canonical settings/popup directly from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'popup'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const enabled = Boolean(data?.enabled);
          const imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl.trim() : '';
          const startAt = data?.startAt || null;
          const endAt = data?.endAt || null;
          const maxShows = data?.maxShows !== undefined && data?.maxShows !== null ? Number(data.maxShows) : 0;
          const frequency = data?.frequency || 'every_visit';

          setPopupConfig({
            enabled,
            imageUrl,
            startAt,
            endAt,
            maxShows,
            frequency
          });
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

  // 2. Reset closed and recorded state if imageUrl changes
  useEffect(() => {
    if (popupConfig?.imageUrl && popupConfig.imageUrl !== activeImageRef.current) {
      activeImageRef.current = popupConfig.imageUrl;
      setIsClosed(false);
      hasRecordedShowRef.current = '';
    }
  }, [popupConfig?.imageUrl]);

  // 3. Evaluate display rules in strict order:
  // (1) Enabled -> (2) Schedule -> (3) Image -> (4) Frequency -> (5) Max Shows
  useEffect(() => {
    if (isClosed) {
      setShouldShow(false);
      return;
    }

    if (!popupConfig) {
      setShouldShow(false);
      return;
    }

    // Rule 1: Enabled Check
    if (!popupConfig.enabled) {
      setShouldShow(false);
      return;
    }

    // Rule 2: Schedule Check (Start & End Date/Time)
    const now = Date.now();
    if (popupConfig.startAt) {
      const startMs = new Date(popupConfig.startAt).getTime();
      if (!isNaN(startMs) && now < startMs) {
        setShouldShow(false);
        return;
      }
    }
    if (popupConfig.endAt) {
      const endMs = new Date(popupConfig.endAt).getTime();
      if (!isNaN(endMs) && now > endMs) {
        setShouldShow(false);
        return;
      }
    }

    // Rule 3: Image Check
    if (!popupConfig.imageUrl) {
      setShouldShow(false);
      return;
    }

    const key = getPopupStorageKey(popupConfig.imageUrl);

    // Rule 4: Frequency Check
    const frequency = popupConfig.frequency || 'every_visit';
    if (frequency === 'once_per_session') {
      const sessionShown = safeGetSessionStorage(`popup_session_shown_${key}`);
      if (sessionShown === '1') {
        setShouldShow(false);
        return;
      }
    } else if (frequency === 'once_per_day') {
      const lastShownRaw = safeGetLocalStorage(`popup_last_shown_${key}`);
      if (lastShownRaw) {
        const lastShown = Number(lastShownRaw);
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        if (!isNaN(lastShown) && (now - lastShown) < ONE_DAY_MS) {
          setShouldShow(false);
          return;
        }
      }
    }

    // Rule 5: Max Show Count Check (0 = unlimited)
    const maxShows = Number(popupConfig.maxShows) || 0;
    if (maxShows > 0) {
      const countRaw = safeGetLocalStorage(`popup_show_count_${key}`);
      const count = countRaw ? Number(countRaw) : 0;
      if (!isNaN(count) && count >= maxShows) {
        setShouldShow(false);
        return;
      }
    }

    // All checks passed! Popup is eligible to show.
    setShouldShow(true);
  }, [popupConfig, isClosed]);

  // 4. Show Action: Record display count & timestamps ONLY when actually shown
  useEffect(() => {
    if (shouldShow && popupConfig?.imageUrl && !isClosed) {
      const key = getPopupStorageKey(popupConfig.imageUrl);
      if (hasRecordedShowRef.current === key) return;
      hasRecordedShowRef.current = key;

      const currentCount = Number(safeGetLocalStorage(`popup_show_count_${key}`)) || 0;
      safeSetLocalStorage(`popup_show_count_${key}`, String(currentCount + 1));
      safeSetLocalStorage(`popup_last_shown_${key}`, String(Date.now()));
      safeSetSessionStorage(`popup_session_shown_${key}`, '1');
    }
  }, [shouldShow, popupConfig?.imageUrl, isClosed]);

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

  if (!shouldShow || isClosed || !popupConfig?.imageUrl) {
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
