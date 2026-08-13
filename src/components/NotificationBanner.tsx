import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Sparkles, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { requestFCMToken } from '../lib/fcm';

export default function NotificationBanner() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [isVisible, setIsVisible] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const dismissedTime = localStorage.getItem('fcm_banner_dismissed');
    const isDismissedRecently = dismissedTime && Date.now() - parseInt(dismissedTime, 10) < 7 * 24 * 60 * 60 * 1000;

    // Auto update token silently if permission is already granted
    if (Notification.permission === 'granted' && user) {
      requestFCMToken(user.uid, user.email || 'user@example.com').catch(() => {});
    }

    // Show banner only if default and not dismissed recently
    if (Notification.permission === 'default' && !isDismissedRecently) {
      const timer = setTimeout(() => setIsVisible(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleEnable = async () => {
    setIsEnabling(true);
    setStatusMessage(null);
    try {
      const userId = user?.uid || 'guest_' + Math.random().toString(36).substring(2, 9);
      const userEmail = user?.email || 'guest@laxmiartworks.local';
      
      const token = await requestFCMToken(userId, userEmail);
      if (token) {
        setPermission('granted');
        setStatusMessage('Notifications enabled! You will receive real-time artwork updates.');
        setTimeout(() => setIsVisible(false), 3000);
      } else {
        const currentPerm = Notification.permission;
        setPermission(currentPerm);
        if (currentPerm === 'denied') {
          setStatusMessage('Notifications are blocked in your browser settings.');
        } else {
          setStatusMessage('Failed to enable notifications. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('Failed to enable push notifications:', err);
      setStatusMessage('Error requesting notification permission.');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('fcm_banner_dismissed', Date.now().toString());
  };

  if (!isVisible && permission !== 'denied' && permission !== 'granted') return null;

  return (
    <>
      {isVisible && (
        <div id="fcm-notification-banner" className="fixed bottom-6 left-6 z-50 max-w-md w-[calc(100%-3rem)] bg-neutral-900/95 border border-amber-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white transition-all animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <Sparkles size={20} />
            </div>
            <div className="flex-1 pr-2">
              <h4 className="font-bold text-sm text-neutral-100 flex items-center gap-1.5">
                Stay Updated With Your Artwork
              </h4>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Enable instant push notifications for order status, payment confirmations, and direct artist updates.
              </p>
              
              {statusMessage && (
                <div className="mt-2 text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {statusMessage}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  id="enable-notifications-btn"
                  onClick={handleEnable}
                  disabled={isEnabling}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Bell size={13} />
                  {isEnabling ? 'Enabling...' : 'Enable Notifications'}
                </button>
                <button
                  id="dismiss-notifications-btn"
                  onClick={handleDismiss}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-neutral-400 text-xs hover:text-white hover:bg-white/10 transition-colors"
                >
                  Not Now
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-neutral-500 hover:text-white transition-colors p-1"
              aria-label="Close notification request"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
