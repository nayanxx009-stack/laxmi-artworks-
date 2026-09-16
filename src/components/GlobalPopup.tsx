import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Terminal, RefreshCw, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useSiteConfig } from '../lib/SiteContext';
import { useAuth } from '../lib/auth';

export default function GlobalPopup() {
  const config = useSiteConfig();
  const { user, role } = useAuth();

  const [isVisible, setIsVisible] = useState(false);
  const [suppressionReason, setSuppressionReason] = useState<string>('');
  const [storageTick, setStorageTick] = useState(0);
  const [isDebugExpanded, setIsDebugExpanded] = useState(false);

  // Read the canonical target image from settings/popup via SiteContext
  const targetImg = (config.imageUrl || config.popupImage || '').trim();
  const isEnabled = Boolean(config.popupEnabled);
  const frequency = config.popupFrequency || 'session';

  // Determine if debug panel should be shown (admins, development mode, or ?debug=1 URL query)
  const isDev = Boolean(
    import.meta.env.DEV || 
    (typeof window !== 'undefined' && window.location.search.includes('debug'))
  );
  const isAdmin = role === 'admin' || (user?.email && ['gargsubhalaxmi@gmail.com', 'nayanxx009@gmail.com'].includes(user.email.toLowerCase()));
  const showDebug = isDev || Boolean(isAdmin);

  // Evaluate popup display conditions whenever config or storage updates
  useEffect(() => {
    try {
      // 1. Check enabled condition
      if (!isEnabled) {
        setIsVisible(false);
        setSuppressionReason('Popup disabled in Firestore settings/popup (enabled: false)');
        return;
      }

      // 2. Check image presence
      if (!targetImg) {
        setIsVisible(false);
        setSuppressionReason('No image URL configured in settings/popup');
        return;
      }

      // 3. Check frequency and storage suppression
      // Requirement 6: If the Firestore imageUrl changes to a new Cloudinary URL,
      // the previous "already shown" state MUST NOT block the new image.
      const currentDismissedUrl = typeof window !== 'undefined' ? sessionStorage.getItem('popup_dismissed_url') : null;
      const legacySessionClosed = typeof window !== 'undefined' ? sessionStorage.getItem('popup_closed') : null;

      // Invalidate legacy session flag if the image has changed or was never bound to this URL
      if (legacySessionClosed && currentDismissedUrl !== targetImg) {
        sessionStorage.removeItem('popup_closed');
        sessionStorage.removeItem('popup_dismissed_url');
      }

      let shouldShow = false;
      let reason = '';

      if (frequency === 'always') {
        shouldShow = true;
        reason = 'Frequency is "always" (eligible on every page visit)';
      } else if (frequency === 'session') {
        const dismissedUrl = sessionStorage.getItem('popup_dismissed_url');
        if (dismissedUrl === targetImg) {
          shouldShow = false;
          reason = `Dismissed in current browser session for this image (sessionStorage: popup_dismissed_url matches current URL)`;
        } else {
          shouldShow = true;
          reason = 'Eligible (new image or first visit in this session)';
        }
      } else if (frequency === 'daily') {
        const dailyUrl = localStorage.getItem('popup_daily_url');
        const dailyDate = localStorage.getItem('popup_daily_date');
        const today = new Date().toDateString();

        if (dailyUrl === targetImg && dailyDate === today) {
          shouldShow = false;
          reason = `Already displayed today (${today}) for this image (localStorage: popup_daily_date)`;
        } else {
          shouldShow = true;
          reason = 'Eligible (new image or first visit of the day)';
        }
      } else if (frequency === 'once') {
        const onceUrl = localStorage.getItem('popup_once_url');
        if (onceUrl === targetImg) {
          shouldShow = false;
          reason = 'Already displayed once for this image (localStorage: popup_once_url)';
        } else {
          shouldShow = true;
          reason = 'Eligible (new image or first-ever visit)';
        }
      }

      setSuppressionReason(reason);

      if (shouldShow) {
        setIsVisible(true);
        // Mark display time for daily and once
        try {
          if (frequency === 'daily') {
            localStorage.setItem('popup_daily_url', targetImg);
            localStorage.setItem('popup_daily_date', new Date().toDateString());
            localStorage.setItem('popup_last_shown', Date.now().toString());
          } else if (frequency === 'once') {
            localStorage.setItem('popup_once_url', targetImg);
            localStorage.setItem('popup_shown_once', 'true');
          }
        } catch (e) {
          console.warn('[GlobalPopup] Storage write notice:', e);
        }
      } else {
        setIsVisible(false);
      }
    } catch (e) {
      console.warn('[GlobalPopup] Frequency check fallback:', e);
    }
  }, [isEnabled, targetImg, frequency, storageTick]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, targetImg]);

  const handleClose = () => {
    setIsVisible(false);
    try {
      if (targetImg) {
        sessionStorage.setItem('popup_dismissed_url', targetImg);
        sessionStorage.setItem('popup_closed', 'true');
      }
      setSuppressionReason('Dismissed by user in current session (sessionStorage: popup_dismissed_url)');
      setStorageTick(t => t + 1);
    } catch (e) {
      console.warn('[GlobalPopup] Error saving session dismissal:', e);
    }
  };

  const handleResetSuppression = () => {
    try {
      sessionStorage.removeItem('popup_dismissed_url');
      sessionStorage.removeItem('popup_closed');
      localStorage.removeItem('popup_once_url');
      localStorage.removeItem('popup_shown_once');
      localStorage.removeItem('popup_daily_url');
      localStorage.removeItem('popup_daily_date');
      localStorage.removeItem('popup_last_shown');
      setStorageTick(t => t + 1);
    } catch (e) {
      console.warn('[GlobalPopup] Error resetting flags:', e);
    }
  };

  const isEligible = Boolean(isEnabled && targetImg);

  // Storage summaries for diagnostic view
  const localStorageSummary = typeof window !== 'undefined' ? (
    [
      localStorage.getItem('popup_once_url') ? `once_url: ${localStorage.getItem('popup_once_url')}` : null,
      localStorage.getItem('popup_daily_date') ? `daily_date: ${localStorage.getItem('popup_daily_date')}` : null,
      localStorage.getItem('popup_shown_once') ? `legacy_once: ${localStorage.getItem('popup_shown_once')}` : null,
      localStorage.getItem('popup_last_shown') ? `legacy_last: ${localStorage.getItem('popup_last_shown')}` : null
    ].filter(Boolean).join(' | ') || '(None)'
  ) : '(None)';

  const sessionStorageSummary = typeof window !== 'undefined' ? (
    [
      sessionStorage.getItem('popup_dismissed_url') ? `dismissed_url: ${sessionStorage.getItem('popup_dismissed_url')}` : null,
      sessionStorage.getItem('popup_closed') ? `legacy_closed: ${sessionStorage.getItem('popup_closed')}` : null
    ].filter(Boolean).join(' | ') || '(None)'
  ) : '(None)';

  return (
    <>
      {/* 1. ACTUAL GLOBAL IMAGE POPUP MODAL */}
      <AnimatePresence>
        {isVisible && isEligible && typeof document !== 'undefined' && createPortal(
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose();
            }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative max-w-md md:max-w-xl w-full flex flex-col items-center justify-center rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] cursor-default"
            >
              <button 
                onClick={handleClose}
                aria-label="Close popup"
                className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors backdrop-blur-md focus:outline-none"
              >
                <X size={20} />
              </button>
              <img 
                src={targetImg} 
                alt="Announcement" 
                onError={() => {
                  console.warn('[GlobalPopup] Image failed to load, dismissing popup to prevent blocking UI.');
                  setIsVisible(false);
                  setSuppressionReason('Image URL failed to load in browser (network error or invalid URL)');
                }}
                className="w-full object-contain max-h-[85vh] bg-black"
              />
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* 2. TEMPORARY DEBUG DIAGNOSTIC SECTION (Visible to admins and dev mode) */}
      {showDebug && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-4 left-4 z-[99999] max-w-sm sm:max-w-md w-full pointer-events-auto">
          <div className="bg-neutral-950/95 text-neutral-200 border border-amber-500/40 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden text-xs">
            {/* Header bar */}
            <div 
              onClick={() => setIsDebugExpanded(!isDebugExpanded)}
              className="px-3.5 py-2.5 bg-neutral-900/90 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-neutral-800/80 transition-colors"
            >
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-amber-400">
                <Terminal size={14} className="text-amber-400" />
                <span>POPUP DIAGNOSTICS</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  isVisible ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {isVisible ? 'DISPLAYING ✓' : 'HIDDEN'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-neutral-400 hover:text-white">
                <span className="text-[10px] font-mono">{isDebugExpanded ? 'Collapse' : 'Expand'}</span>
                {isDebugExpanded ? <EyeOff size={13} /> : <Eye size={13} />}
              </div>
            </div>

            {/* Expandable Body */}
            {isDebugExpanded && (
              <div className="p-3.5 space-y-2.5 font-mono text-[10.5px]">
                <div className="space-y-1.5 border-b border-white/5 pb-2.5">
                  <div className="flex flex-col">
                    <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">POPUP FIRESTORE IMAGE URL:</span>
                    <span className="text-amber-300 font-semibold break-all select-all">{config.imageUrl || config.popupImage || '(None)'}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">POPUP ENABLED:</span>
                      <div className="flex items-center gap-1">
                        {isEnabled ? <CheckCircle2 size={12} className="text-green-400" /> : <AlertTriangle size={12} className="text-red-400" />}
                        <span className={isEnabled ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{String(isEnabled)}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">POPUP FREQUENCY:</span>
                      <span className="text-white font-bold capitalize">{frequency}</span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">POPUP READ SOURCE:</span>
                    <span className="text-cyan-300 block">{config.popupReadSource || 'Firestore server read (getDocFromServer)'}</span>
                  </div>

                  <div className="pt-1">
                    <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">POPUP DISPLAY ELIGIBLE:</span>
                    <span className={isEligible ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {isEligible ? 'YES (enabled=true, valid image)' : `NO (${!isEnabled ? 'enabled=false' : 'no image'})`}
                    </span>
                  </div>

                  <div className="pt-1">
                    <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">GLOBALPOPUP IMAGE URL:</span>
                    <span className="text-green-300 break-all block select-all">{targetImg || '(None)'}</span>
                  </div>
                </div>

                {/* Storage & Frequency Flags */}
                <div className="space-y-1.5 border-b border-white/5 pb-2.5 text-[10px]">
                  <div>
                    <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">LOCAL STORAGE POPUP FLAG:</span>
                    <span className="text-neutral-300 block truncate" title={localStorageSummary}>{localStorageSummary}</span>
                  </div>

                  <div>
                    <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">SESSION STORAGE POPUP FLAG:</span>
                    <span className="text-neutral-300 block truncate" title={sessionStorageSummary}>{sessionStorageSummary}</span>
                  </div>

                  <div>
                    <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">SUPPRESSION STATUS:</span>
                    <span className={isVisible ? 'text-emerald-400 font-semibold block' : 'text-amber-300 font-semibold block'}>
                      {isVisible ? 'Popup is actively rendered on screen ✓' : `Hidden: ${suppressionReason || 'Suppressed by rule'}`}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-1 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleResetSuppression}
                    className="flex-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg transition-colors font-sans text-[11px] font-semibold flex items-center justify-center gap-1"
                    title="Clears sessionStorage and localStorage popup flags"
                  >
                    <RefreshCw size={12} /> Clear Flags & Recheck
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVisible(true);
                      setSuppressionReason('Manually forced open via diagnostics');
                    }}
                    className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg transition-colors font-sans text-[11px] font-semibold flex items-center gap-1"
                  >
                    Force Show
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
