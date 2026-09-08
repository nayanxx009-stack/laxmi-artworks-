import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, Shield, Check, ShoppingBag, CreditCard, Tag, Info, Sliders } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserNotificationPreferences } from '../types';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationPreferencesModal({ isOpen, onClose }: NotificationPreferencesModalProps) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserNotificationPreferences>({
    orders: true,
    payments: true,
    promotions: true,
    general: true
  });
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const userId = user?.uid || (typeof window !== 'undefined' ? localStorage.getItem('laxmi_guest_id') || 'guest' : 'guest');

  useEffect(() => {
    if (!isOpen) return;
    loadPreferences();
  }, [isOpen, userId]);

  const loadPreferences = async () => {
    setLoading(true);
    setSavedSuccess(false);
    try {
      if (userId && userId !== 'guest') {
        const prefDoc = await getDoc(doc(db, 'notification_preferences', userId));
        if (prefDoc.exists()) {
          setPreferences(prefDoc.data() as UserNotificationPreferences);
          return;
        }
      }

      // Fallback to API
      const res = await fetch(`/api/notification-preferences/${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setPreferences(data.preferences);
        }
      }
    } catch (e) {
      console.warn('Failed to load notification preferences:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload: UserNotificationPreferences = {
        orders: preferences.orders,
        payments: preferences.payments,
        promotions: preferences.promotions,
        general: preferences.general,
        updatedAt: Date.now()
      };

      if (userId && userId !== 'guest') {
        await setDoc(doc(db, 'notification_preferences', userId), payload, { merge: true });
      }

      await fetch(`/api/notification-preferences/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (e) {
      console.error('Failed to save preferences:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-neutral-900 border border-white/10 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Notification Preferences</h3>
              <p className="text-xs text-neutral-400">Manage what notifications you receive</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Order Updates */}
          <div className="flex items-start justify-between p-3.5 bg-black/40 rounded-2xl border border-white/5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                <ShoppingBag size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Order & Artwork Tracking</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Updates about commission sketches, packaging, shipping, and courier delivery.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.orders}
              onChange={(e) => setPreferences(prev => ({ ...prev, orders: e.target.checked }))}
              className="rounded border-white/20 text-amber-500 focus:ring-0 mt-1 cursor-pointer"
            />
          </div>

          {/* Payment Updates */}
          <div className="flex items-start justify-between p-3.5 bg-black/40 rounded-2xl border border-white/5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
                <CreditCard size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Payment & Receipt Confirmations</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Instant alerts for payment verifications, receipts, and refund statuses.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.payments}
              onChange={(e) => setPreferences(prev => ({ ...prev, payments: e.target.checked }))}
              className="rounded border-white/20 text-amber-500 focus:ring-0 mt-1 cursor-pointer"
            />
          </div>

          {/* Promotional Offers */}
          <div className="flex items-start justify-between p-3.5 bg-black/40 rounded-2xl border border-white/5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                <Tag size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Promotions & Exclusive Drops</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Handcrafted gallery highlights, seasonal discount codes, and art exhibitions.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.promotions}
              onChange={(e) => setPreferences(prev => ({ ...prev, promotions: e.target.checked }))}
              className="rounded border-white/20 text-amber-500 focus:ring-0 mt-1 cursor-pointer"
            />
          </div>

          {/* General Platform Announcements */}
          <div className="flex items-start justify-between p-3.5 bg-black/40 rounded-2xl border border-white/5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                <Info size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">General Announcements</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  System improvements, holiday schedules, and service advisories.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.general}
              onChange={(e) => setPreferences(prev => ({ ...prev, general: e.target.checked }))}
              className="rounded border-white/20 text-amber-500 focus:ring-0 mt-1 cursor-pointer"
            />
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <span className="text-[10px] text-neutral-500 flex items-center gap-1">
            <Shield size={12} /> Privacy protected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              {savedSuccess ? (
                <>
                  <Check size={14} /> Saved!
                </>
              ) : (
                'Save Preferences'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
