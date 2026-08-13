import React, { useState, useEffect } from 'react';
import { Bell, Sparkles, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { requestFCMToken, FCMRegistrationResult } from '../lib/fcm';

export default function NotificationBanner() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [isVisible, setIsVisible] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const currentPerm = Notification.permission;
    setPermission(currentPerm);

    // 1. Listen for manual open requests (e.g. from Floating Bell widget)
    const handleOpenModal = () => {
      setIsVisible(true);
      setStatus(null);
    };
    window.addEventListener('open-notification-modal', handleOpenModal);

    // 2. Silent sync if granted & registered
    if (currentPerm === 'granted') {
      const uId = user?.uid || 'guest_' + (localStorage.getItem('laxmi_guest_id') || Math.random().toString(36).substring(2, 9));
      if (!localStorage.getItem('laxmi_guest_id')) localStorage.setItem('laxmi_guest_id', uId);
      requestFCMToken(uId, user?.email || 'guest@laxmiartworks.local').catch(() => {});
    }

    // 3. Show centered modal on default permission if not dismissed in current session & not already registered
    const isAlreadyRegistered = localStorage.getItem('fcm_token_registered') === 'true';
    const isSessionDismissed = sessionStorage.getItem('fcm_modal_dismissed') === 'true';

    if (currentPerm === 'default' && !isAlreadyRegistered && !isSessionDismissed) {
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('open-notification-modal', handleOpenModal);
    };
  }, [user]);

  const handleEnable = async () => {
    setIsEnabling(true);
    setStatus(null);

    try {
      let guestId = localStorage.getItem('laxmi_guest_id');
      if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('laxmi_guest_id', guestId);
      }
      const userId = user?.uid || guestId;
      const userEmail = user?.email || 'guest@laxmiartworks.local';
      
      console.log("[FCM] User initiated Enable Notifications flow");
      const result: FCMRegistrationResult = await requestFCMToken(userId, userEmail);
      const updatedPerm = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
      setPermission(updatedPerm);

      if (result.success && result.token) {
        setStatus({
          type: 'success',
          message: '✓ Notifications enabled successfully! You will receive real-time updates.'
        });
        setTimeout(() => {
          setIsVisible(false);
        }, 1800);
      } else {
        if (updatedPerm === 'denied') {
          setStatus({
            type: 'error',
            message: 'Notifications are blocked in your browser settings. Please click the lock/bell icon in your browser address bar to allow permissions.'
          });
        } else {
          setStatus({
            type: 'error',
            message: result.error || 'Could not enable notifications right now. Please try again.'
          });
        }
      }
    } catch (err: any) {
      console.error('[FCM] Exception enabling notifications:', err);
      setStatus({
        type: 'error',
        message: 'Error requesting notification permission: ' + (err.message || err)
      });
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('fcm_modal_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-neutral-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-white relative text-center space-y-4 animate-in zoom-in-95">
        
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors p-1"
          aria-label="Close notification modal"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <Bell size={28} />
        </div>

        {/* Title */}
        <div>
          <h3 className="text-lg font-bold text-neutral-100 flex items-center justify-center gap-2">
            Stay Updated With Your Artwork 🎨
          </h3>
          <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
            Receive real-time Web Push notifications for order updates, payment confirmations, artwork status, shipping/delivery alerts, and direct messages.
          </p>
        </div>

        {/* Denied State Banner */}
        {permission === 'denied' && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2 text-left">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              Notifications are blocked in your browser settings. Please click the lock or site settings icon in your browser URL bar to allow notifications.
            </span>
          </div>
        )}

        {/* Status Feedback */}
        {status && (
          <div className={`p-3 rounded-xl text-xs flex items-start gap-2 text-left animate-in fade-in ${
            status.type === 'success' 
              ? 'bg-green-500/10 border border-green-500/30 text-green-400 font-semibold' 
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>
            {status.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-green-400" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
          {permission === 'granted' && status?.type === 'success' ? (
            <div className="py-3 px-4 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 font-bold text-xs flex items-center justify-center gap-2">
              <CheckCircle2 size={16} /> Notifications Enabled
            </div>
          ) : (
            <>
              <button
                id="enable-notifications-btn"
                onClick={handleEnable}
                disabled={isEnabling}
                className="w-full py-3 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {isEnabling ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    Enabling Notifications...
                  </>
                ) : status?.type === 'error' ? (
                  <>
                    <RefreshCw size={14} />
                    Retry Enabling Notifications
                  </>
                ) : (
                  <>
                    <Bell size={14} />
                    Enable Notifications
                  </>
                )}
              </button>

              <button
                id="dismiss-notifications-btn"
                onClick={handleDismiss}
                disabled={isEnabling}
                className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white text-xs transition-colors disabled:opacity-50"
              >
                Not Now
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
