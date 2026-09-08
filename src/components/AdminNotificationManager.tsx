import React, { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Send,
  Users,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Search,
  Check,
  X,
  RefreshCw,
  Eye,
  Sliders,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Tag,
  Info,
  ShieldCheck,
  Smartphone,
  Laptop,
  Trash2,
  FileText,
  ChevronRight,
  Filter
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, where } from 'firebase/firestore';
import { NotificationType, NotificationAudience, NotificationLog, DeviceDeliveryResult } from '../types';

interface AdminNotificationManagerProps {
  onOpenDiagnostics?: () => void;
  adminEmail?: string;
}

interface UserCandidate {
  id: string;
  uid?: string;
  displayName?: string;
  name?: string;
  email?: string;
  lastLogin?: number;
  activeDeviceCount: number;
  tokens: string[];
}

export default function AdminNotificationManager({ onOpenDiagnostics, adminEmail = 'admin' }: AdminNotificationManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'composer' | 'history' | 'templates'>('composer');

  // Composer Form State
  const [audienceType, setAudienceType] = useState<NotificationAudience>('individual');
  const [notificationType, setNotificationType] = useState<NotificationType>('order');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [iconUrl, setIconUrl] = useState('/icon-192.png');
  const [imageUrl, setImageUrl] = useState('');
  const [clickDestinationType, setClickDestinationType] = useState<'home' | 'orders' | 'specific_order' | 'custom'>('specific_order');
  const [customClickUrl, setCustomClickUrl] = useState('');
  const [orderIdInput, setOrderIdInput] = useState('');
  const [orderVerificationStatus, setOrderVerificationStatus] = useState<{ verified: boolean; error?: string; ownerName?: string; ownerEmail?: string; ownerId?: string } | null>(null);

  // User Targeting State
  const [usersList, setUsersList] = useState<UserCandidate[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserCandidate | null>(null);
  const [selectedUsersMulti, setSelectedUsersMulti] = useState<UserCandidate[]>([]);

  // Safety & Broadcast Confirmation State
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    notificationId?: string;
    targetDeviceCount?: number;
    successCount?: number;
    failureCount?: number;
    status?: string;
    deviceResults?: DeviceDeliveryResult[];
    error?: string;
  } | null>(null);
  const [showDeviceAuditModal, setShowDeviceAuditModal] = useState(false);

  // History State
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLogForAudit, setSelectedLogForAudit] = useState<NotificationLog | null>(null);

  // Load Users & Tokens on Mount
  useEffect(() => {
    fetchUsersAndTokens();
    fetchLogs();
  }, []);

  const fetchUsersAndTokens = async () => {
    setLoadingUsers(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const fcmTokensSnap = await getDocs(collection(db, 'fcm_tokens'));

      // Map tokens by userId and email
      const tokensByUser = new Map<string, Set<string>>();
      const tokensByEmail = new Map<string, Set<string>>();

      fcmTokensSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const uId = data.userId || docSnap.id;
        const em = data.email ? data.email.toLowerCase() : '';
        const tokenList: string[] = Array.isArray(data.tokens) ? data.tokens : (data.token ? [data.token] : []);

        if (uId) {
          if (!tokensByUser.has(uId)) tokensByUser.set(uId, new Set());
          tokenList.forEach(t => tokensByUser.get(uId)!.add(t));
        }
        if (em) {
          if (!tokensByEmail.has(em)) tokensByEmail.set(em, new Set());
          tokenList.forEach(t => tokensByEmail.get(em)!.add(t));
        }
      });

      const candidates: UserCandidate[] = [];
      const seenIds = new Set<string>();

      usersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const uid = docSnap.id;
        seenIds.add(uid);
        const email = (data.email || '').toLowerCase();
        const name = data.displayName || data.name || 'Art Collector';

        const userTokens = new Set<string>();
        if (tokensByUser.has(uid)) {
          tokensByUser.get(uid)!.forEach(t => userTokens.add(t));
        }
        if (email && tokensByEmail.has(email)) {
          tokensByEmail.get(email)!.forEach(t => userTokens.add(t));
        }

        candidates.push({
          id: uid,
          uid,
          displayName: name,
          email: data.email || 'No email',
          lastLogin: data.lastLogin || data.createdAt,
          tokens: Array.from(userTokens),
          activeDeviceCount: userTokens.size
        });
      });

      // Also include standalone FCM registrations if not in users collection
      fcmTokensSnap.forEach((docSnap) => {
        const uid = docSnap.id;
        if (!seenIds.has(uid) && !uid.includes('/')) {
          const data = docSnap.data();
          const tokenList: string[] = Array.isArray(data.tokens) ? data.tokens : (data.token ? [data.token] : []);
          candidates.push({
            id: uid,
            uid,
            displayName: data.email ? data.email.split('@')[0] : `Guest (${uid.slice(0, 6)})`,
            email: data.email || 'guest@laxmiartworks.local',
            lastLogin: data.updatedAt || Date.now(),
            tokens: tokenList,
            activeDeviceCount: tokenList.length
          });
        }
      });

      // Sort with active devices first, then by last login
      candidates.sort((a, b) => (b.activeDeviceCount - a.activeDeviceCount) || ((b.lastLogin || 0) - (a.lastLogin || 0)));
      setUsersList(candidates);
    } catch (err) {
      console.error('Error fetching users and tokens:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/notification-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      } else {
        // Fallback to direct Firestore
        const q = query(collection(db, 'notification_logs'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        const l: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLogs(l);
      }
    } catch (e) {
      console.error('Failed to load notification logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Verify Order ID when typing or clicking verify
  const handleVerifyOrderId = async (idToVerify?: string) => {
    const targetId = (idToVerify || orderIdInput).trim();
    if (!targetId) return;

    try {
      let orderSnap = await getDoc(doc(db, 'orders', targetId));
      let orderData = orderSnap.exists() ? orderSnap.data() : null;

      if (!orderData) {
        const q = query(collection(db, 'orders'), where('orderId', '==', targetId), limit(1));
        const res = await getDocs(q);
        if (!res.empty) {
          orderSnap = res.docs[0];
          orderData = orderSnap.data();
        }
      }

      if (orderData) {
        const ownerEmail = orderData.email || '';
        const ownerId = orderData.userId || '';
        const ownerName = orderData.name || 'Customer';

        setOrderVerificationStatus({
          verified: true,
          ownerName,
          ownerEmail,
          ownerId
        });

        // Auto-select this owner candidate
        const matched = usersList.find(u => (ownerId && u.id === ownerId) || (ownerEmail && u.email?.toLowerCase() === ownerEmail.toLowerCase()));
        if (matched) {
          setSelectedUser(matched);
          setAudienceType('individual');
        } else {
          setSelectedUser({
            id: ownerId || `order_user_${targetId}`,
            uid: ownerId,
            displayName: ownerName,
            email: ownerEmail,
            tokens: [],
            activeDeviceCount: 0
          });
        }
      } else {
        setOrderVerificationStatus({
          verified: false,
          error: `Order #${targetId} not found in database.`
        });
      }
    } catch (err: any) {
      setOrderVerificationStatus({
        verified: false,
        error: err.message || 'Order verification error.'
      });
    }
  };

  // Predefined Templates
  const applyTemplate = (templateKey: string) => {
    const currentOrderId = orderIdInput.trim() || '1042';
    switch (templateKey) {
      case 'ORDER_CREATED':
        setNotificationType('order');
        setTitle('Order Placed 🎨');
        setBody(`Your Laxmi Artworks order #${currentOrderId} has been received and is being processed.`);
        setClickDestinationType('specific_order');
        break;
      case 'PAYMENT_SUCCESS':
        setNotificationType('payment');
        setTitle('Payment Successful ✓');
        setBody(`Your payment for order #${currentOrderId} was received and verified successfully.`);
        setClickDestinationType('specific_order');
        break;
      case 'PAYMENT_FAILED':
        setNotificationType('payment');
        setTitle('Payment Issue ⚠️');
        setBody(`We could not confirm payment for order #${currentOrderId}. Please tap to review.`);
        setClickDestinationType('specific_order');
        break;
      case 'ORDER_CONFIRMED':
        setNotificationType('order');
        setTitle('Order Confirmed ✨');
        setBody(`Artwork commission #${currentOrderId} is confirmed. Our artists are preparing the concept.`);
        setClickDestinationType('specific_order');
        break;
      case 'ORDER_SHIPPED':
        setNotificationType('order');
        setTitle('Order Shipped 🚚');
        setBody(`Your order #${currentOrderId} has been packaged and handed over to our courier partner.`);
        setClickDestinationType('specific_order');
        break;
      case 'ORDER_OUT_FOR_DELIVERY':
        setNotificationType('order');
        setTitle('Out for Delivery 🛵');
        setBody(`Your Laxmi Artworks package #${currentOrderId} is out for delivery today!`);
        setClickDestinationType('specific_order');
        break;
      case 'ORDER_DELIVERED':
        setNotificationType('order');
        setTitle('Artwork Delivered 🎉');
        setBody(`Order #${currentOrderId} has been delivered. We hope you love your handmade artwork!`);
        setClickDestinationType('specific_order');
        break;
      case 'ORDER_CANCELLED':
        setNotificationType('order');
        setTitle('Order Cancelled ❌');
        setBody(`Your order #${currentOrderId} has been cancelled. Tap for refund or support details.`);
        setClickDestinationType('specific_order');
        break;
      case 'PROMOTION_NEW_COLLECTION':
        setNotificationType('promotion');
        setTitle('New Collection Released 🎨');
        setBody('Explore our latest curated handcrafted paintings and custom canvas styles now live.');
        setClickDestinationType('custom');
        setCustomClickUrl('/#gallery');
        setImageUrl('https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80');
        break;
      case 'PROMOTION_FESTIVE_OFFER':
        setNotificationType('promotion');
        setTitle('Exclusive Art Offer ✨');
        setBody('Enjoy 15% off bespoke portrait commissions this week only. Use code ARTISTRY15.');
        setClickDestinationType('custom');
        setCustomClickUrl('/#services');
        break;
      case 'GENERAL_UPDATE':
        setNotificationType('general');
        setTitle('New Improvements Available');
        setBody('We have updated the Laxmi Artworks portal with live real-time commission tracking.');
        setClickDestinationType('home');
        break;
    }
  };

  // Resolved Click URL based on choice
  const getResolvedClickUrl = (): string => {
    switch (clickDestinationType) {
      case 'home':
        return '/';
      case 'orders':
        return '/?view=orders';
      case 'specific_order':
        return orderIdInput.trim() ? `/?orderId=${encodeURIComponent(orderIdInput.trim())}` : '/';
      case 'custom':
        return customClickUrl.trim() || '/';
      default:
        return '/';
    }
  };

  // Character counts
  const TITLE_RECOMMENDED = 50;
  const TITLE_MAX = 80;
  const BODY_RECOMMENDED = 150;
  const BODY_MAX = 250;

  // Filter users list
  const filteredUsers = usersList.filter(u => {
    const q = userSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  // Calculate target tokens & deduplicated devices
  const getTargetDeviceCount = (): number => {
    if (audienceType === 'individual') {
      return selectedUser ? selectedUser.activeDeviceCount : 0;
    }
    if (audienceType === 'selected') {
      const set = new Set<string>();
      selectedUsersMulti.forEach(u => u.tokens.forEach(t => set.add(t)));
      return set.size;
    }
    if (audienceType === 'all') {
      const set = new Set<string>();
      usersList.forEach(u => u.tokens.forEach(t => set.add(t)));
      return set.size;
    }
    return 0;
  };

  // Send Notification Handler with Duplicate Protection
  const handleSendNotification = async () => {
    if (isSending) return;

    // 1. Validations
    if (!title.trim()) {
      alert('Please enter a notification title.');
      return;
    }
    if (!body.trim()) {
      alert('Please enter a notification message body.');
      return;
    }
    if (audienceType === 'individual' && !selectedUser) {
      alert('Please select a target user for Individual User audience.');
      return;
    }
    if (audienceType === 'selected' && selectedUsersMulti.length === 0) {
      alert('Please select at least one user from the list.');
      return;
    }
    if (audienceType === 'all' && !confirmBroadcast) {
      alert('Please confirm that you intend to broadcast to all active users.');
      return;
    }
    if (notificationType === 'order' && orderIdInput.trim() && !orderVerificationStatus?.verified) {
      const proceed = confirm(`Order #${orderIdInput.trim()} was not verified. Do you still want to proceed?`);
      if (!proceed) return;
    }

    // 2. Click URL Validation
    const resolvedUrl = getResolvedClickUrl();
    if (resolvedUrl.startsWith('javascript:') || resolvedUrl.startsWith('data:')) {
      alert('Unsafe click URL destination detected.');
      return;
    }

    setIsSending(true);
    setSendResult(null);

    // Unique notificationId for Server-Side Idempotency
    const uniqueNotificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Prepare targetUserIds
    let targetUserIds: string[] = [];
    if (audienceType === 'individual' && selectedUser) {
      targetUserIds = [selectedUser.id];
    } else if (audienceType === 'selected') {
      targetUserIds = selectedUsersMulti.map(u => u.id);
    }

    const payload = {
      notificationId: uniqueNotificationId,
      type: notificationType,
      audienceType,
      targetUserIds,
      orderId: orderIdInput.trim() || undefined,
      title: title.trim(),
      body: body.trim(),
      iconUrl: iconUrl.trim() || '/icon-192.png',
      imageUrl: imageUrl.trim() || undefined,
      clickUrl: resolvedUrl,
      adminEmail: adminEmail || 'admin'
    };

    try {
      const response = await fetch('/api/admin/send-composed-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      setSendResult({
        success: true,
        notificationId: data.notificationId,
        targetDeviceCount: data.targetDeviceCount,
        successCount: data.successCount,
        failureCount: data.failureCount,
        status: data.status,
        deviceResults: data.deviceResults
      });

      // Refresh history
      fetchLogs();

    } catch (err: any) {
      console.error('Send notification error:', err);
      setSendResult({
        success: false,
        error: err.message || 'Failed to dispatch notification.'
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header Card */}
      <div className="bg-neutral-900/90 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">
              <Sparkles size={14} /> Production Push Suite
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Notification Manager
            </h2>
            <p className="text-neutral-400 text-sm mt-1 max-w-2xl">
              Professional Web Push composer with individual recipient targeting, verified order lookups, server idempotency, and live delivery telemetry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onOpenDiagnostics && (
              <button
                onClick={onOpenDiagnostics}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 transition-all hover:border-amber-500/30"
              >
                <Sliders size={14} className="text-amber-500" />
                View Delivery Diagnostics
              </button>
            )}
            <button
              onClick={() => { fetchUsersAndTokens(); fetchLogs(); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
            >
              <RefreshCw size={14} className={loadingUsers || loadingLogs ? 'animate-spin' : ''} />
              Sync Registrations
            </button>
          </div>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-white/5 mt-6 pt-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('composer')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSubTab === 'composer'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-black/40 text-neutral-400 hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <Send size={14} /> Notification Composer
          </button>
          <button
            onClick={() => setActiveSubTab('templates')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSubTab === 'templates'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-black/40 text-neutral-400 hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <Sparkles size={14} /> Predefined Templates
          </button>
          <button
            onClick={() => { setActiveSubTab('history'); fetchLogs(); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSubTab === 'history'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-black/40 text-neutral-400 hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <FileText size={14} /> Notification History ({logs.length})
          </button>
        </div>
      </div>

      {/* SUB-TAB: PREDEFINED TEMPLATES */}
      {activeSubTab === 'templates' && (
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" /> One-Click Notification Templates
            </h3>
            <p className="text-xs text-neutral-400 mb-6">
              Select a standardized notification template to instantly prefill title, copy, and contextual destination links.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'ORDER_CREATED', title: 'Order Placed 🎨', desc: 'Notify customer of successful order creation', cat: 'Order' },
                { key: 'PAYMENT_SUCCESS', title: 'Payment Successful ✓', desc: 'Confirm payment receipt and verification', cat: 'Payment' },
                { key: 'PAYMENT_FAILED', title: 'Payment Issue ⚠️', desc: 'Alert customer to resolve payment verification', cat: 'Payment' },
                { key: 'ORDER_CONFIRMED', title: 'Order Confirmed ✨', desc: 'Confirm commission sketch phase begins', cat: 'Order' },
                { key: 'ORDER_SHIPPED', title: 'Order Shipped 🚚', desc: 'Dispatch tracking notice with courier details', cat: 'Order' },
                { key: 'ORDER_OUT_FOR_DELIVERY', title: 'Out for Delivery 🛵', desc: 'Notify customer of arrival today', cat: 'Order' },
                { key: 'ORDER_DELIVERED', title: 'Artwork Delivered 🎉', desc: 'Delivered confirmation and review invitation', cat: 'Order' },
                { key: 'ORDER_CANCELLED', title: 'Order Cancelled ❌', desc: 'Notice of order cancellation and support', cat: 'Order' },
                { key: 'PROMOTION_NEW_COLLECTION', title: 'New Collection 🎨', desc: 'Showcase curated artwork release', cat: 'Promotion' },
                { key: 'PROMOTION_FESTIVE_OFFER', title: 'Festive Promo 15% ✨', desc: 'Broadcast seasonal discount offer', cat: 'Promotion' },
                { key: 'GENERAL_UPDATE', title: 'System Announcement 📢', desc: 'Broadcast platform feature improvements', cat: 'Update' }
              ].map(tpl => (
                <div
                  key={tpl.key}
                  onClick={() => { applyTemplate(tpl.key); setActiveSubTab('composer'); }}
                  className="bg-black/40 hover:bg-white/5 border border-white/5 hover:border-amber-500/30 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {tpl.cat}
                      </span>
                      <span className="text-xs text-neutral-500 group-hover:text-amber-500 transition-colors flex items-center gap-1">
                        Use <ChevronRight size={12} />
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white">{tpl.title}</div>
                    <div className="text-xs text-neutral-400 mt-1">{tpl.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: COMPOSER */}
      {activeSubTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Composer Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Target Audience */}
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6">
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3 flex items-center gap-2">
                <Users size={14} className="text-amber-500" /> A. Select Target Audience
              </label>

              <div className="grid grid-cols-3 gap-2 p-1.5 bg-black/50 rounded-2xl border border-white/5 mb-4">
                {(['individual', 'selected', 'all'] as NotificationAudience[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setAudienceType(mode);
                      setConfirmBroadcast(false);
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold capitalize transition-all ${
                      audienceType === mode
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {mode === 'individual' ? 'Individual User' : mode === 'selected' ? 'Selected Users' : 'All Active Users'}
                  </button>
                ))}
              </div>

              {/* Individual User Search & Selection */}
              {audienceType === 'individual' && (
                <div className="space-y-4 pt-2 border-t border-white/5">
                  <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search recipient by Name, Email, UID, or Order ID..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Selected User Badge */}
                  {selectedUser && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
                          {selectedUser.displayName?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            {selectedUser.displayName}
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-semibold">
                              {selectedUser.activeDeviceCount} Active Device{selectedUser.activeDeviceCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-400">{selectedUser.email}</div>
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5">UID: {selectedUser.id}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedUser(null)}
                        className="text-xs text-neutral-400 hover:text-white p-1 hover:bg-white/10 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* Search Results Dropdown / List */}
                  {!selectedUser && (
                    <div className="max-h-56 overflow-y-auto space-y-2 no-scrollbar pr-1">
                      {filteredUsers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-neutral-500 border border-dashed border-white/5 rounded-xl">
                          No matching registered users found.
                        </div>
                      ) : (
                        filteredUsers.slice(0, 8).map(u => (
                          <div
                            key={u.id}
                            onClick={() => setSelectedUser(u)}
                            className="p-3 bg-black/40 hover:bg-white/5 border border-white/5 hover:border-amber-500/30 rounded-xl cursor-pointer transition-colors flex items-center justify-between"
                          >
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-2">
                                {u.displayName}
                                {u.activeDeviceCount > 0 ? (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded">
                                    {u.activeDeviceCount} device{u.activeDeviceCount !== 1 ? 's' : ''}
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded">
                                    0 devices
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-400">{u.email}</div>
                            </div>
                            <button
                              type="button"
                              className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg hover:bg-amber-500 hover:text-black transition-colors"
                            >
                              Select
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Users Multi-Selector */}
              {audienceType === 'selected' && (
                <div className="space-y-4 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">
                      Selected: {selectedUsersMulti.length} user{selectedUsersMulti.length !== 1 ? 's' : ''} (Deduplicated Devices: {getTargetDeviceCount()})
                    </span>
                    {selectedUsersMulti.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedUsersMulti([])}
                        className="text-[10px] text-neutral-400 hover:text-white"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 no-scrollbar pr-1 border border-white/5 p-2 rounded-2xl bg-black/30">
                    {filteredUsers.slice(0, 15).map(u => {
                      const isSelected = selectedUsersMulti.some(item => item.id === u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedUsersMulti(prev => prev.filter(item => item.id !== u.id));
                            } else {
                              setSelectedUsersMulti(prev => [...prev, u]);
                            }
                          }}
                          className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between text-xs ${
                            isSelected
                              ? 'bg-amber-500/20 border border-amber-500/30'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-white/20 text-amber-500 focus:ring-0"
                            />
                            <div>
                              <div className="font-bold text-white">{u.displayName}</div>
                              <div className="text-[10px] text-neutral-400">{u.email}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400">
                            {u.activeDeviceCount} device{u.activeDeviceCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Active Users Explicit Confirmation */}
              {audienceType === 'all' && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-3 pt-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs text-white">Broadcast Safety Guard</div>
                      <p className="text-[11px] text-neutral-300 mt-0.5">
                        This action targets all {getTargetDeviceCount()} active Web Push registrations registered with Laxmi Artworks. Stale or deleted device records will be cleaned up automatically.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-neutral-300 font-medium cursor-pointer pt-2 border-t border-red-500/20">
                    <input
                      type="checkbox"
                      checked={confirmBroadcast}
                      onChange={(e) => setConfirmBroadcast(e.target.checked)}
                      className="rounded border-white/20 text-red-500 focus:ring-0"
                    />
                    <span>This will send a notification to all active notification-enabled users.</span>
                  </label>
                </div>
              )}
            </div>

            {/* 2. Notification Type & Context */}
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6">
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3 flex items-center gap-2">
                <Tag size={14} className="text-amber-500" /> B. Notification Type
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { type: 'order', label: 'Order', icon: ShoppingBag },
                  { type: 'payment', label: 'Payment', icon: CreditCard },
                  { type: 'promotion', label: 'Promotion', icon: Tag },
                  { type: 'general', label: 'General Update', icon: Info }
                ].map(item => {
                  const Icon = item.icon;
                  const isAct = notificationType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setNotificationType(item.type as NotificationType)}
                      className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        isAct
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                          : 'bg-black/40 border-white/5 text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Order Mode Contextual Verification */}
              {notificationType === 'order' && (
                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-300">Contextual Order ID (Optional)</label>
                    <span className="text-[10px] text-neutral-500">Auto-locks audience to order owner</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 1042 or full order doc ID"
                      value={orderIdInput}
                      onChange={(e) => {
                        setOrderIdInput(e.target.value);
                        setOrderVerificationStatus(null);
                      }}
                      className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyOrderId()}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                    >
                      Verify Order
                    </button>
                  </div>

                  {orderVerificationStatus && (
                    <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      orderVerificationStatus.verified
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}>
                      {orderVerificationStatus.verified ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>
                        {orderVerificationStatus.verified
                          ? `Order verified! Owner: ${orderVerificationStatus.ownerName} (${orderVerificationStatus.ownerEmail})`
                          : orderVerificationStatus.error}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Notification Content: Title & Message */}
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 space-y-4">
              {/* Title */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                    C. Notification Title
                  </label>
                  <span className={`text-[10px] font-mono ${title.length > TITLE_RECOMMENDED ? 'text-amber-400' : 'text-neutral-500'}`}>
                    {title.length} / {TITLE_MAX} chars {title.length > TITLE_RECOMMENDED && `(Recommended ≤ ${TITLE_RECOMMENDED})`}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={TITLE_MAX}
                  placeholder="e.g. Order Shipped 🚚"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              {/* Message Body */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                    D. Notification Message Body
                  </label>
                  <span className={`text-[10px] font-mono ${body.length > BODY_RECOMMENDED ? 'text-amber-400' : 'text-neutral-500'}`}>
                    {body.length} / {BODY_MAX} chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={BODY_MAX}
                  placeholder="e.g. Your custom commission #1042 has been shipped and is heading your way."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
              </div>

              {/* Optional Icon & Image */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-neutral-400 mb-1 block">
                    E. Notification Icon (Default Logo)
                  </label>
                  <input
                    type="text"
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-neutral-300 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-400 mb-1 block">
                    F. Optional Banner Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://... (Optional banner)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Click Destination */}
              <div className="pt-2 border-t border-white/5 space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-neutral-400 block">
                  G. Click Destination
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'home', label: 'Homepage (/)' },
                    { key: 'orders', label: 'Orders Hub' },
                    { key: 'specific_order', label: 'Specific Order' },
                    { key: 'custom', label: 'Custom Route' }
                  ].map(dest => (
                    <button
                      key={dest.key}
                      type="button"
                      onClick={() => setClickDestinationType(dest.key as any)}
                      className={`p-2.5 rounded-xl border text-[11px] font-bold transition-all text-center ${
                        clickDestinationType === dest.key
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-black/30 border-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {dest.label}
                    </button>
                  ))}
                </div>

                {clickDestinationType === 'custom' && (
                  <div>
                    <input
                      type="text"
                      placeholder="e.g. /#gallery or /#contact"
                      value={customClickUrl}
                      onChange={(e) => setCustomClickUrl(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-500 font-mono focus:outline-none focus:border-amber-500"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">
                      Must begin with `/` or be an authorized Laxmi Artworks domain link. External arbitrary domains are blocked for user security.
                    </p>
                  </div>
                )}

                <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-1.5">
                  <ExternalLink size={12} className="text-amber-500" />
                  Resolved link: <span className="text-amber-400">{getResolvedClickUrl()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Simulator, Confirmation & Send Action (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live Web Push Notification Simulator */}
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                <Smartphone size={14} className="text-amber-500" /> Live OS Push Notification Preview
              </h3>

              <div className="bg-[#18181b] border border-white/10 rounded-2xl p-4 shadow-xl text-white space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between text-[11px] text-neutral-400 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <img src={iconUrl || '/icon-192.png'} alt="Icon" className="w-4 h-4 rounded object-cover" />
                    <span className="font-semibold text-neutral-300">Laxmi Artworks</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">Just now</span>
                </div>

                <div className="flex items-start gap-3">
                  <img
                    src={iconUrl || '/icon-192.png'}
                    alt="Push Icon"
                    className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0 bg-neutral-800"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-white truncate">
                      {title || 'Your Notification Title'}
                    </div>
                    <div className="text-xs text-neutral-300 mt-0.5 line-clamp-3 leading-relaxed">
                      {body || 'Notification message content will appear here when received on the client operating system.'}
                    </div>
                  </div>
                </div>

                {imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-white/10 max-h-36">
                    <img src={imageUrl} alt="Notification Graphic" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="text-[10px] text-amber-400/80 font-mono truncate pt-1 flex items-center gap-1">
                  <ExternalLink size={10} />
                  <span>Click: {getResolvedClickUrl()}</span>
                </div>
              </div>

              <p className="text-[10px] text-neutral-500 mt-2 text-center">
                Visual rendering simulates native OS notification appearance.
              </p>
            </div>

            {/* Confirmation & Summary Card */}
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                <ShieldCheck size={14} className="text-amber-500" /> Dispatch Confirmation
              </h3>

              <div className="bg-black/50 border border-white/5 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Audience:</span>
                  <span className="font-bold text-white capitalize">{audienceType}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-400">Recipients:</span>
                  <span className="font-bold text-white">
                    {audienceType === 'individual'
                      ? selectedUser ? selectedUser.displayName : 'None selected'
                      : audienceType === 'selected'
                      ? `${selectedUsersMulti.length} users`
                      : 'All Active Users'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-400">Target Devices:</span>
                  <span className="font-bold text-amber-400 font-mono">{getTargetDeviceCount()} active device(s)</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-400">Category:</span>
                  <span className="font-bold text-white uppercase tracking-wider text-[10px]">{notificationType}</span>
                </div>

                <div className="flex justify-between border-t border-white/5 pt-2">
                  <span className="text-neutral-400">Destination:</span>
                  <span className="font-mono text-neutral-300 text-[11px] truncate max-w-[180px]">{getResolvedClickUrl()}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isSending || (audienceType === 'all' && !confirmBroadcast) || getTargetDeviceCount() === 0}
                onClick={handleSendNotification}
                className="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Dispatching via FCM...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send Notification</span>
                  </>
                )}
              </button>

              {/* Send Result Banner */}
              {sendResult && (
                <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  sendResult.success
                    ? 'bg-green-500/10 border-green-500/30 text-green-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="font-bold flex items-center gap-1.5">
                      {sendResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      {sendResult.success ? 'Notification Dispatched Successfully' : 'Dispatch Failed'}
                    </div>
                    {sendResult.deviceResults && (
                      <button
                        onClick={() => setShowDeviceAuditModal(true)}
                        className="underline text-[11px] font-semibold hover:text-white"
                      >
                        View Device Audit
                      </button>
                    )}
                  </div>

                  {sendResult.success ? (
                    <div className="space-y-1 text-[11px]">
                      <div>Target Devices: <strong>{sendResult.targetDeviceCount}</strong></div>
                      <div>Successful: <strong className="text-green-400">{sendResult.successCount}</strong> | Failed: <strong className={sendResult.failureCount ? 'text-red-400' : 'text-neutral-400'}>{sendResult.failureCount}</strong></div>
                      <div className="text-neutral-400 text-[10px] font-mono">ID: {sendResult.notificationId}</div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-red-300">
                      {sendResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: NOTIFICATION HISTORY */}
      {activeSubTab === 'history' && (
        <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={18} className="text-amber-500" /> Sent Notification Logs
              </h3>
              <p className="text-xs text-neutral-400">
                Canonical delivery records stored in Firestore collection <code className="text-amber-400">notification_logs</code>.
              </p>
            </div>
            <button
              onClick={fetchLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
            >
              <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-black/30 text-[11px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
                  <th className="p-3.5 pl-4">Timestamp</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Audience</th>
                  <th className="p-3.5">Title & Message</th>
                  <th className="p-3.5 text-center">Devices</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 pr-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {loadingLogs ? (
                  <tr><td colSpan={7} className="p-8 text-center text-neutral-500">Loading delivery logs...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-neutral-500">No notifications sent yet.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id || log.notificationId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 pl-4 align-middle whitespace-nowrap text-neutral-400 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3.5 align-middle">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {log.type}
                        </span>
                      </td>
                      <td className="p-3.5 align-middle capitalize text-neutral-300 text-xs">
                        {log.audienceType}
                      </td>
                      <td className="p-3.5 align-middle max-w-[280px]">
                        <div className="font-bold text-white truncate">{log.title}</div>
                        <div className="text-[11px] text-neutral-400 truncate">{log.body}</div>
                      </td>
                      <td className="p-3.5 align-middle text-center font-mono">
                        <span className="text-green-400 font-bold">{log.successCount}</span>
                        <span className="text-neutral-600"> / </span>
                        <span className="text-neutral-400">{log.targetDeviceCount}</span>
                      </td>
                      <td className="p-3.5 align-middle text-center">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          log.status === 'SENT'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : log.status === 'PARTIAL_FAILURE'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : log.status === 'SENDING'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3.5 pr-4 align-middle text-right">
                        <button
                          onClick={() => setSelectedLogForAudit(log)}
                          className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold border border-white/10"
                        >
                          Audit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Device Audit Details */}
      {(showDeviceAuditModal || selectedLogForAudit) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <ShieldCheck size={16} className="text-amber-500" />
                  Per-Device Delivery Breakdown
                </h3>
                <p className="text-[11px] text-neutral-400">
                  ID: {selectedLogForAudit?.notificationId || sendResult?.notificationId}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDeviceAuditModal(false);
                  setSelectedLogForAudit(null);
                }}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 no-scrollbar">
              {(selectedLogForAudit?.deviceResults || sendResult?.deviceResults || []).length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500">
                  No device-level results recorded for this send.
                </div>
              ) : (
                (selectedLogForAudit?.deviceResults || sendResult?.deviceResults || []).map((dev, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border text-xs flex items-start justify-between gap-4 ${
                      dev.success
                        ? 'bg-green-500/5 border-green-500/20 text-green-300'
                        : 'bg-red-500/5 border-red-500/20 text-red-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 font-mono font-bold text-[11px]">
                        {dev.success ? <CheckCircle2 size={14} className="text-green-400" /> : <AlertCircle size={14} className="text-red-400" />}
                        <span>{dev.tokenPreview}</span>
                      </div>
                      {dev.errorMessage && (
                        <div className="text-[11px] text-red-400 mt-1 font-sans">
                          {dev.errorMessage}
                        </div>
                      )}
                      <div className="text-[10px] text-neutral-400 mt-1">
                        Cleanup Action: <span className="text-neutral-300">{dev.cleanupAction || 'Active'}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        dev.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {dev.success ? 'FCM_ACCEPTED' : dev.errorCode || 'FAILED'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
              <button
                onClick={() => {
                  setShowDeviceAuditModal(false);
                  setSelectedLogForAudit(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
