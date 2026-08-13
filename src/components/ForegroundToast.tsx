import React, { useState, useEffect } from 'react';
import { Bell, X, ExternalLink } from 'lucide-react';
import { onForegroundMessage } from '../lib/fcm';

interface ToastData {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export default function ForegroundToast() {
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    let cleanup: any = null;
    let isMounted = true;

    onForegroundMessage((payload: any) => {
      if (!isMounted) return;
      console.log('[ForegroundToast] Received foreground message:', payload);
      const title = payload.notification?.title || payload.data?.title || 'Laxmi Artworks';
      const body = payload.notification?.body || payload.data?.body || 'You have a new update.';
      const url = payload.data?.url || payload.fcmOptions?.link || '/';
      const icon = payload.notification?.icon || '/vite.svg';

      setToast({ title, body, url, icon });

      // Auto dismiss after 8 seconds
      const timer = setTimeout(() => setToast(null), 8000);
      return () => clearTimeout(timer);
    }).then(unsub => {
      cleanup = unsub;
    }).catch(err => {
      console.warn('[ForegroundToast] Listener notice:', err);
    });

    return () => {
      isMounted = false;
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, []);

  if (!toast) return null;

  const handleClick = () => {
    if (toast.url) {
      if (toast.url.includes('chat=open')) {
        window.dispatchEvent(new CustomEvent('open-live-chat'));
      } else {
        window.location.href = toast.url;
      }
    }
    setToast(null);
  };

  return (
    <div className="fixed top-20 right-6 z-50 max-w-sm w-[calc(100%-3rem)] bg-neutral-900 border border-amber-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-lg text-white transition-all animate-in fade-in slide-in-from-top-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5 border border-amber-500/30">
          <Bell size={18} />
        </div>
        <div className="flex-1 cursor-pointer" onClick={handleClick}>
          <h4 className="font-bold text-sm text-neutral-100 flex items-center justify-between">
            {toast.title}
            <ExternalLink size={12} className="text-amber-500/70" />
          </h4>
          <p className="text-xs text-neutral-300 mt-1 leading-relaxed line-clamp-2">
            {toast.body}
          </p>
        </div>
        <button
          onClick={() => setToast(null)}
          className="text-neutral-500 hover:text-white transition-colors p-1"
          aria-label="Dismiss toast"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
