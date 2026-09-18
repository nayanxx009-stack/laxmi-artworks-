import { createPortal } from 'react-dom';
import { generateInvoice } from '../lib/generateInvoice';
import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { useAuth } from '../lib/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc, getDocFromServer, limit, onSnapshot } from 'firebase/firestore';
import { uploadToCloudinary } from '../lib/cloudinary';
import jsPDF from 'jspdf';
import { Shield, Truck, Download, LogOut, CheckCircle2, Clock, Calendar, XCircle, Trash2, Edit2, Save, X, RefreshCw, Eye, LayoutDashboard, Settings, Users, ArrowRight, Paintbrush, Loader2, Link2, Lock, Plus, Image as ImageIcon, Mail, MessageSquare, IndianRupee, UploadCloud, Bell, AlertCircle, ExternalLink } from 'lucide-react';
import AdminAnalytics from './AdminAnalytics';
import AdminBackup from './AdminBackup';
import AdminChat from './AdminChat';
import AdminInquiries from './AdminInquiries';
import AdminNotifications from './AdminNotifications';
import AdminBroadcast from './AdminBroadcast';
import AdminNotificationManager from './AdminNotificationManager';


import { useSiteConfig, defaultSiteConfig, SiteConfig } from '../lib/SiteContext';

const MASTER_ADMINS = ["gargsubhalaxmi@gmail.com", "nayanxx009@gmail.com", "bolt36520@gmail.com", "admin@example.com"];

const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Prefer webp if supported, otherwise jpeg
        const type = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0 ? 'image/webp' : 'image/jpeg';
        resolve(canvas.toDataURL(type, quality));
      };
      img.onerror = (error) => reject(new Error('Failed to load image. It may be corrupt or an unsupported format.'));
    };
    reader.onerror = (error) => reject(error);
  });
};


async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}



export default function AdminPanel() {
  const { user, role, loading: authLoading, logout: realLogout, loginWithGoogle } = useAuth();
  const logout = () => {
    // Just redirect to lock the admin panel without signing out of Firebase
    window.location.href = '/';
  };
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  
  // We can remove passwordFlow entirely, but keeping state to avoid refactoring the whole file if it uses it.
  // We will force it to 'none' always.
  const [passwordFlow, setPasswordFlow] = useState<'none' | 'setup' | 'enter'>('none');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'site' | 'admins' | 'gallery' | 'popup' | 'notifications' | 'system'>('dashboard');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [dashboardView, setDashboardView] = useState<"orders" | "users" | "subscribers" | "reviews" | "analytics" | "backup" | "coupons" | "chat">("analytics");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalReviews: 0, totalSubscribers: 0, totalRevenue: 0, totalOrders: 0, totalInquiries: 0 });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [viewingRefPhoto, setViewingRefPhoto] = useState<string | null>(null);
  const [sendingInvoiceOrderId, setSendingInvoiceOrderId] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    setInvoiceStatus(null);
  }, [selectedOrder?.id]);

  const siteConfig = useSiteConfig();
  const [localSiteConfig, setLocalSiteConfig] = useState<SiteConfig>(defaultSiteConfig);

  // Popup Manager State (Clean & direct to canonical settings/popup)
  const [popupEnabled, setPopupEnabled] = useState<boolean>(false);
  const [savedPopupImageUrl, setSavedPopupImageUrl] = useState<string>('');
  const [popupStartAt, setPopupStartAt] = useState<string>('');
  const [popupEndAt, setPopupEndAt] = useState<string>('');
  const [popupMaxShows, setPopupMaxShows] = useState<number>(0);
  const [popupFrequency, setPopupFrequency] = useState<'every_visit' | 'once_per_session' | 'once_per_day'>('every_visit');
  const [selectedPopupFile, setSelectedPopupFile] = useState<File | null>(null);
  const [popupPreviewUrl, setPopupPreviewUrl] = useState<string | null>(null);
  const [isUploadingPopup, setIsUploadingPopup] = useState<boolean>(false);
  const [popupUploadProgress, setPopupUploadProgress] = useState<number>(0);
  const [isSavingPopup, setIsSavingPopup] = useState<boolean>(false);
  const [popupFeedback, setPopupFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPopupPreview, setShowPopupPreview] = useState(false);
  const popupFileInputRef = useRef<HTMLInputElement>(null);

  const [savingSite, setSavingSite] = useState(false);

  const [adminsList, setAdminsList] = useState<{id: string, email: string, role?: string}[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const [gallery, setGallery] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [newGalleryItem, setNewGalleryItem] = useState({ title: '', img: '', cat: 'Fine Art' });
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSiteConfig(siteConfig);
  }, [siteConfig]);

  // Load canonical settings/popup when popup tab is opened
  useEffect(() => {
    if (activeTab !== 'popup') return;
    const fetchCanonicalPopup = async () => {
      try {
        const pSnap = await getDoc(doc(db, 'settings', 'popup'));
        if (pSnap.exists()) {
          const pData = pSnap.data();
          const activeImg = (typeof pData?.imageUrl === 'string' ? pData.imageUrl.trim() : '') || (typeof pData?.popupImage === 'string' ? pData.popupImage.trim() : '');
          setSavedPopupImageUrl(activeImg);
          setPopupEnabled(Boolean(pData?.enabled));
          setPopupStartAt(typeof pData?.startAt === 'string' ? pData.startAt : '');
          setPopupEndAt(typeof pData?.endAt === 'string' ? pData.endAt : '');
          setPopupMaxShows(pData?.maxShows !== undefined && pData?.maxShows !== null ? Number(pData.maxShows) : 0);
          setPopupFrequency(pData?.frequency || 'every_visit');
        }
      } catch (err) {
        console.warn('Notice loading canonical settings/popup:', err);
      }
    };
    fetchCanonicalPopup();
  }, [activeTab]);

  useEffect(() => {
    let active = true;
    const checkAdminData = async () => {
      if (user && role === 'admin') {
        const email = (user.email || '').toLowerCase().trim();
        if (active) setIsOwner(MASTER_ADMINS.includes(email));
        if (active) setIsAdmin(true);
        
        try {
          const adminDoc = await getDoc(doc(db, 'admins', email));
          if (adminDoc.exists() && adminDoc.data().password) {
            if (active) setPasswordFlow('enter');
          } else {
            if (active) setPasswordFlow('setup');
          }
        } catch (e) {
          console.error(e);
          if (active) setPasswordFlow('setup');
        }
        
        if (active) setCheckingAuth(false);
      } else {
        if (active) setIsAdmin(false);
        if (active) setIsOwner(false);
      }
    };
    if (user && role === 'admin') {
      checkAdminData();
    } else if (!user || role !== 'admin') {
      setIsAdmin(false);
      setIsOwner(false);
    }
    return () => { active = false; };
  }, [user, role]);

  useEffect(() => {
    if (!isAdmin || passwordFlow !== 'none') return;
    
    setLoading(true);
    let unsubOrders = () => {};
    let unsubInquiries = () => {};
    let unsubReviews = () => {};
    let unsubSubscribers = () => {};
    let unsubUsers = () => {};

    if (activeTab === 'dashboard') {
      const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      unsubOrders = onSnapshot(qOrders, (snapshot) => {
        const allOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        // Filter out dummy/abandoned orders (Pending Payment) from showing in the admin panel
        const ordersData = allOrders.filter((o: any) => o.paymentStatus !== 'Pending Payment');
        setOrders(ordersData);
        
        const totalRev = ordersData.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
        setStats(prev => ({
          ...prev,
          totalRevenue: totalRev,
          totalOrders: ordersData.length,
          totalInquiries: 0
        }));
        setLoading(false);
      }, (error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); });

      const qUsers = query(collection(db, 'users'), orderBy('lastLogin', 'desc'));
      unsubUsers = onSnapshot(qUsers, (snap) => {
        const usersData = snap.docs.map(d => d.data());
        setUsersList(usersData);
        setStats(prev => ({ ...prev, totalUsers: snap.size }));
      }, (error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); });

      unsubReviews = onSnapshot(collection(db, 'reviews'), (snapshot) => {
        setReviews(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setStats(prev => ({ ...prev, totalReviews: snapshot.size }));
      }, (error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); });

      const qSubscribers = query(collection(db, 'subscribers'), orderBy('createdAt', 'desc'));
      unsubSubscribers = onSnapshot(qSubscribers, (snapshot) => {
        setSubscribers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setStats(prev => ({ ...prev, totalSubscribers: snapshot.size }));
      }, (error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); });
      
      const qInquiries = query(collection(db, 'inquiries'));
      unsubInquiries = onSnapshot(qInquiries, (snapshot) => {
        setStats(prev => ({ ...prev, totalInquiries: snapshot.size }));
      }, (error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); });
    }
    
    return () => {
      unsubOrders();
      unsubInquiries();
      unsubReviews();
      unsubSubscribers();
      unsubUsers();
    };
  }, [isAdmin, passwordFlow, activeTab]);

  

  useEffect(() => {
    if (!isAdmin || passwordFlow !== 'none' || activeTab !== 'admins') return;
    setLoadingAdmins(true);
    const unsub = onSnapshot(collection(db, 'admins'), (snapshot) => {
      const aData = snapshot.docs.map(d => ({
        id: d.id,
        email: d.data().email,
        role: d.data().role || 'admin'
      }));
      setAdminsList(aData);
      setLoadingAdmins(false);
    }, (error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); });
    
    return () => unsub();
  }, [isAdmin, passwordFlow, activeTab]);

  useEffect(() => {
    if (!isAdmin || passwordFlow !== 'none' || activeTab !== 'gallery') return;
    setLoadingGallery(true);
    const unsub = onSnapshot(collection(db, 'gallery'), (snapshot) => {
      const gData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setGallery(gData);
      setLoadingGallery(false);
    }, (error) => { if (error.code !== 'unavailable' && !error.message?.includes('offline')) console.error(error); });

    return () => unsub();
  }, [isAdmin, passwordFlow, activeTab]);

  const generateToken = () => Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!adminPasswordInput) return;
    
    try {
      const adminDocRef = doc(db, 'admins', user!.email!);
      const adminDoc = await getDoc(adminDocRef);
      
      if (passwordFlow === 'setup') {
        await setDoc(adminDocRef, {
           email: user!.email!,
           password: adminPasswordInput,
           role: 'admin',
           updatedAt: Date.now()
        }, { merge: true });
        setPasswordFlow('none');
      } else if (passwordFlow === 'enter') {
         if (adminDoc.exists() && adminDoc.data().password === adminPasswordInput) {
            setPasswordFlow('none');
         } else {
            setPasswordError('Incorrect password.');
         }
      }
    } catch (err) {
      console.error(err);
      setPasswordError('Error verifying password.');
    }
  };

  const handleForgotPassword = async () => {
    if (!window.confirm("This will sign you out and reset your password. You must sign in with Google again to set a new password. Continue?")) return;
    try {
      await updateDoc(doc(db, 'admins', user!.email!), { password: '' });
      window.location.href = '/';
    } catch (e: any) {
      console.error(e);
      alert("Failed to reset password. " + e.message);
    }
  };

  

  

  const handleUpdateOrder = async (id: string, field: string, value: string) => {
    try {
      const updateData: any = { [field]: value };
      if (field === 'paymentStatus') {
         updateData.lastVerifiedAt = Date.now();
         updateData.lastVerifiedBy = user?.email || 'admin';
      }
      await updateDoc(doc(db, 'orders', id), updateData);
    } catch (err) {
      console.error("Error updating doc", err);
    }
  };

  const saveFullEdit = async (id: string) => {
    try {
      const updateData: any = { ...editForm };
      if (editForm.paymentStatus !== selectedOrder?.paymentStatus) {
         updateData.lastVerifiedAt = Date.now();
         updateData.lastVerifiedBy = user?.email || 'admin';
      }
      
      const isNewShipment = (!selectedOrder?.trackingId && editForm.trackingId);
      
      await updateDoc(doc(db, 'orders', id), updateData);
      setEditingId(null);
      setSelectedOrder({ ...selectedOrder, ...updateData });
      
      if (isNewShipment && editForm.email) {
         try {
           await fetch('/api/notify-shipment', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                email: editForm.email,
                orderId: editForm.orderId,
                courierPartner: editForm.courierPartner || 'N/A',
                trackingId: editForm.trackingId,
                estimatedDelivery: editForm.estimatedDeliveryDate || 'N/A',
                status: editForm.shipmentStatus || 'Dispatched'
             })
           });
         } catch(e) {
           console.error("Failed to notify shipment", e);
         }
      }
      
    } catch (err) {
      console.error("Error saving doc", err);
    }
  };

  const handleSendInvoice = async (order: any) => {
    if (!order) return;
    if (sendingInvoiceOrderId) return; // Prevent duplicate rapid clicks

    const currentOrderId = order.orderId || order.id;
    const currentCustomerEmail = (order.email || '').trim();
    const currentCustomerName = order.name || 'Customer';

    // 1. Check if customer email exists in this exact order
    if (!currentCustomerEmail) {
      const missingMsg = 'Customer email address is not available for this order.';
      setInvoiceStatus({
        type: 'error',
        text: missingMsg
      });
      setSaveSuccessMessage(missingMsg);
      return;
    }

    setSendingInvoiceOrderId(order.id);
    setInvoiceStatus({
      type: 'info',
      text: 'Generating invoice PDF...'
    });

    try {
      // 2. Generate the invoice PDF using the existing invoice generation system
      let pdfBase64: string;
      try {
        pdfBase64 = await generateInvoice(order, 'base64');
        if (!pdfBase64 || typeof pdfBase64 !== 'string') {
          throw new Error('Generated PDF content is empty');
        }
      } catch (pdfErr: any) {
        console.error('[INVOICE] Generation error:', pdfErr);
        throw new Error('Failed to generate invoice PDF. Email was not sent.');
      }

      setInvoiceStatus({
        type: 'info',
        text: `Sending invoice to ${currentCustomerEmail}...`
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentOrderId,
          id: order.id,
          email: currentCustomerEmail,
          customerName: currentCustomerName,
          order: order,
          pdfBase64: pdfBase64
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send invoice. Check email credentials.');
      }

      setInvoiceStatus({
        type: 'success',
        text: "Invoice sent successfully to the customer's email."
      });
      setSaveSuccessMessage("Invoice sent successfully to the customer's email.");
    } catch (err: any) {
      console.error('[INVOICE] Sending error:', err);
      const isAbort = err.name === 'AbortError' || err.message?.includes('abort');
      const errText = isAbort ? 'Connection timed out while sending email.' : (err.message || 'Failed to send invoice.');
      setInvoiceStatus({
        type: 'error',
        text: errText
      });
      setSaveSuccessMessage(`❌ ${errText}`);
    } finally {
      setSendingInvoiceOrderId(null);
    }
  };

  const handlePopupImageFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!file.type.startsWith('image/') && !validTypes.includes(file.type.toLowerCase())) {
      setPopupFeedback({
        type: 'error',
        message: 'Invalid file format. Please select a JPG, PNG, or WebP image.'
      });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setPopupFeedback({
        type: 'error',
        message: 'The selected image is larger than 15MB. Please choose an image under 15MB.'
      });
      return;
    }

    if (popupPreviewUrl) {
      try { URL.revokeObjectURL(popupPreviewUrl); } catch (_) {}
    }

    setSelectedPopupFile(file);
    setPopupPreviewUrl(URL.createObjectURL(file));
    setPopupFeedback(null);
    if (e.target) e.target.value = '';
  };

  const cancelSelectedPopupFile = () => {
    if (popupPreviewUrl) {
      try { URL.revokeObjectURL(popupPreviewUrl); } catch (_) {}
    }
    setSelectedPopupFile(null);
    setPopupPreviewUrl(null);
  };

  const removePopupImage = () => {
    cancelSelectedPopupFile();
    setSavedPopupImageUrl('');
  };

  const getActivePopupDisplayUrl = () => {
    return popupPreviewUrl || savedPopupImageUrl || '';
  };

  const getPopupScheduleStatus = () => {
    if (!popupEnabled) {
      return {
        label: 'Disabled',
        badgeClass: 'bg-neutral-800 text-neutral-400 border-neutral-700',
        description: 'Popup is turned off globally and will not be displayed to any visitors.'
      };
    }
    if (!savedPopupImageUrl && !selectedPopupFile) {
      return {
        label: 'Needs Image',
        badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        description: 'Please upload or select an image to enable popup display.'
      };
    }
    const now = Date.now();
    if (popupStartAt) {
      const startMs = new Date(popupStartAt).getTime();
      if (!isNaN(startMs) && now < startMs) {
        return {
          label: 'Scheduled for Future',
          badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          description: `Scheduled to start displaying on ${new Date(popupStartAt).toLocaleString()}.`
        };
      }
    }
    if (popupEndAt) {
      const endMs = new Date(popupEndAt).getTime();
      if (!isNaN(endMs) && now > endMs) {
        return {
          label: 'Expired',
          badgeClass: 'bg-red-500/10 text-red-400 border-red-500/30',
          description: `Expired on ${new Date(popupEndAt).toLocaleString()} and will no longer show.`
        };
      }
    }
    return {
      label: 'Active & Live',
      badgeClass: 'bg-green-500/10 text-green-400 border-green-500/30',
      description: 'Popup is active and currently displaying to eligible visitors according to schedule and frequency rules.'
    };
  };

  const executeSavePopup = async () => {
    setIsSavingPopup(true);
    setPopupFeedback(null);

    try {
      let finalImageUrl = savedPopupImageUrl;

      // Operation B: New file selected -> Upload to Cloudinary using unsigned preset
      if (selectedPopupFile) {
        setIsUploadingPopup(true);
        setPopupUploadProgress(0);

        const uploadResult = await uploadToCloudinary(selectedPopupFile, {
          onProgress: (info) => {
            setPopupUploadProgress(info.percent);
          }
        });

        setIsUploadingPopup(false);

        if (!uploadResult.secure_url || (!uploadResult.secure_url.includes('cloudinary.com') && !uploadResult.secure_url.includes('res.cloudinary.com'))) {
          throw new Error('Cloudinary response did not return a valid Cloudinary secure URL.');
        }

        finalImageUrl = uploadResult.secure_url;
      }

      // Save directly to settings/popup
      const popupPayload = {
        enabled: Boolean(popupEnabled),
        imageUrl: finalImageUrl,
        startAt: popupStartAt ? popupStartAt : null,
        endAt: popupEndAt ? popupEndAt : null,
        maxShows: Number(popupMaxShows) || 0,
        frequency: popupFrequency || 'every_visit'
      };

      try {
        await setDoc(doc(db, 'settings', 'popup'), popupPayload);
      } catch (clientWriteErr: any) {
        // Fallback to server endpoint
        const res = await fetch('/api/admin/save-popup-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(popupPayload)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || clientWriteErr.message || 'Failed to save popup settings.');
        }
      }

      setSavedPopupImageUrl(finalImageUrl);
      cancelSelectedPopupFile();
      setPopupFeedback({
        type: 'success',
        message: '✓ Popup configuration saved successfully to settings/popup!'
      });
      setTimeout(() => setPopupFeedback(null), 5000);
    } catch (saveErr: any) {
      console.error('Error saving popup:', saveErr);
      setIsUploadingPopup(false);
      setPopupFeedback({
        type: 'error',
        message: `❌ ${saveErr.message || 'Failed to save popup configuration.'}`
      });
    } finally {
      setIsSavingPopup(false);
    }
  };

  const saveSiteConfig = async () => {
    setSavingSite(true);
    try {
      await setDoc(doc(db, 'settings', 'site_config'), localSiteConfig, { merge: true });
      setSaveSuccessMessage("✅ Site settings saved successfully!");
      setTimeout(() => setSaveSuccessMessage(''), 4000);
    } catch (e) {
      console.error(e);
      setSaveSuccessMessage("❌ Error saving settings.");
      setTimeout(() => setSaveSuccessMessage(''), 4000);
    }
    setSavingSite(false);
  };

  const updateAdminRole = async (id: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'admins', id), { role: newRole });
    } catch (e) {
      console.error(e);
    }
  };

  const updateReviewStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'reviews', id), { status: newStatus });
      alert('Review status updated successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to update review status.');
    }
  };
  
  const replyReview = async (id: string) => {
    const reply = prompt("Enter your reply for this review:");
    if (reply === null) return;
    try {
      await updateDoc(doc(db, 'reviews', id), { adminReply: reply.trim() });
      alert('Reply added successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to add reply');
    }
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      await deleteDoc(doc(db, 'reviews', id));
    } catch (e) {
      console.error(e);
    }
  };

  const addAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || MASTER_ADMINS.includes(newAdminEmail.trim().toLowerCase())) return;
    try {
      const em = newAdminEmail.trim().toLowerCase();
      await setDoc(doc(db, 'admins', em), { email: em, addedAt: Date.now(), role: 'admin' });
      setNewAdminEmail("");
    } catch (e) {
      console.error(e);
    }
  };

  const removeAdmin = async (id: string) => {
    if (!window.confirm("Remove this admin?")) return;
    try {
      await deleteDoc(doc(db, 'admins', id));
    } catch (e) {
      console.error(e);
    }
  };

  const addGalleryItem = async (e: FormEvent) => {
    e.preventDefault();
    if ((!newGalleryItem.img.trim() && !galleryFile) || !newGalleryItem.title.trim()) return;
    
    setUploadingGallery(true);
    try {
      let imageUrl = newGalleryItem.img;

      if (galleryFile) {
        imageUrl = await compressImage(galleryFile, 1200, 1200, 0.7);
        const sizeInBytes = imageUrl.length * 0.75;
        if (sizeInBytes > 900000) {
            alert("Image is too large even after compression. Please use a smaller image to fit in database.");
            setUploadingGallery(false);
            return;
        }
      }

      await setDoc(doc(collection(db, 'gallery')), {
        ...newGalleryItem,
        img: imageUrl,
        createdAt: Date.now()
      });
      
      setNewGalleryItem({ title: '', img: '', cat: 'Fine Art' });
      setGalleryFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      console.error(e);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryItem = async (id: string) => {
    if (!window.confirm("Remove this artwork?")) return;
    try {
      await deleteDoc(doc(db, 'gallery', id));
    } catch (e) {
      console.error(e);
    }
  };

  if (checkingAuth || authLoading) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-sm font-mono text-neutral-500">VERIFYING CREDENTIALS...</p>
      </div>
    );
  }

  if (user && role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white p-4">
        <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-white">Access Denied</h1>
          <p className="text-sm text-neutral-400 mb-6">You do not have administrator privileges.</p>
          <button 
            onClick={logout}
            className="w-full bg-red-500 text-white font-bold py-3 px-4 rounded-xl hover:bg-red-400 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }
  
  if (passwordFlow !== 'none') {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white p-4">
        <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
          <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-white">
            {passwordFlow === 'setup' ? 'Setup Admin Password' : 'Enter Admin Password'}
          </h1>
          <p className="text-sm text-neutral-400 mb-6">
            {passwordFlow === 'setup' 
              ? 'Create a secondary password for your admin account.' 
              : 'Enter your secondary password to access the admin panel.'}
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input 
              type="password" 
              placeholder="Admin Password"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
              required
            />
            {passwordError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                {passwordError}
              </div>
            )}
            <button 
              type="submit"
              className="w-full bg-amber-500 text-black font-bold py-3 px-4 rounded-xl hover:bg-amber-400 transition-colors"
            >
              {passwordFlow === 'setup' ? 'Set Password' : 'Verify Password'}
            </button>
            {passwordFlow === 'enter' && (
              <button 
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-neutral-500 hover:text-white mt-4 block mx-auto"
              >
                Forgot password?
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white p-4">
        <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
          <Shield className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-white">Admin Access</h1>
          <p className="text-sm text-neutral-400 mb-6">Secure portal for authorized personnel only.</p>
          {loginError && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
              {loginError}
            </div>
          )}
          <button 
            onClick={async () => { setLoginError(''); try { await loginWithGoogle(true); } catch (e: any) { if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') { setLoginError('Sign-in popup was closed.'); } else { setLoginError(e.message || 'Google sign-in failed'); } } }}
            className="w-full bg-white text-black font-bold py-3 px-4 rounded-xl hover:bg-neutral-200 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans selection:bg-amber-500/30 flex flex-col">
      
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-[#030303]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo area */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Shield className="text-amber-500 w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Admin<br/><span className="text-amber-500 text-sm">Workspace</span></h1>
              </div>
            </div>

            {/* Logout */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-neutral-400 hidden sm:block">{user.email}</span>
              <button 
                onClick={() => setShowSignOutConfirm(true)}
                className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-bold bg-white/5 px-4 py-2 rounded-full border border-white/10"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar border-t border-white/5 pt-4">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-white/5'}`}
            >
              <LayoutDashboard size={16} /> Stats & Orders
            </button>
            <button 
              onClick={() => setActiveTab('gallery')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'gallery' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-white/5'}`}
            >
              <ImageIcon size={16} /> Manage Gallery
            </button>
            <button 
              onClick={() => setActiveTab('site')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'site' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-white/5'}`}
            >
              <Paintbrush size={16} /> Site Content
            </button>
            <button 
              onClick={() => setActiveTab('admins')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'admins' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-white/5'}`}
            >
              <Users size={16} /> Manage Admins
            </button>
            <button 
              onClick={() => setActiveTab('popup')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'popup' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-white/5'}`}
            >
              <MessageSquare size={16} /> Popup Manager
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'notifications' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-white/5'}`}
            >
              <Bell size={16} /> Notification Manager
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-24">
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <motion.div initial={{opacity:0, y: 10}} animate={{opacity:1, y:0}} className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">Analytics & Orders <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase tracking-widest font-bold">Live Synced</span></h2>
                  <p className="text-sm text-neutral-400">Manage client commissions and track platform engagement in real-time.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900 p-6 rounded-2xl border border-white/5 flex flex-col justify-between relative overflow-hidden group">
                  <div className="relative z-10 flex items-center justify-between mb-4 text-neutral-400">
                    <span className="text-xs uppercase font-bold tracking-widest">Total Orders</span>
                    <Truck size={16} className="text-amber-500" />
                  </div>
                  <div className="relative z-10 text-3xl font-bold">{stats.totalOrders}</div>
                </div>

                <div className="bg-neutral-900 p-6 rounded-2xl border border-white/5 flex flex-col justify-between relative overflow-hidden group">
                  <div className="relative z-10 flex items-center justify-between mb-4 text-neutral-400">
                    <span className="text-xs uppercase font-bold tracking-widest">Inquiries</span>
                    <MessageSquare size={16} className="text-amber-500" />
                  </div>
                  <div className="relative z-10 text-3xl font-bold">{stats.totalInquiries}</div>
                </div>

                <div className="bg-neutral-900 p-6 rounded-2xl border border-white/5 flex flex-col justify-between relative overflow-hidden group">
                  <div className="relative z-10 flex items-center justify-between mb-4 text-neutral-400">
                    <span className="text-xs uppercase font-bold tracking-widest">Revenue</span>
                    <IndianRupee size={16} className="text-amber-500" />
                  </div>
                  <div className="relative z-10 text-3xl font-bold text-amber-500">₹{stats.totalRevenue.toLocaleString()}</div>
                </div>

                <div className="bg-neutral-900 p-6 rounded-2xl border border-white/5 flex flex-col justify-between relative overflow-hidden group">
                  <div className="relative z-10 flex items-center justify-between mb-4 text-neutral-400">
                    <span className="text-xs uppercase font-bold tracking-widest">Registered</span>
                    <Users size={16} className="text-amber-500" />
                  </div>
                  <div className="relative z-10 text-3xl font-bold">{stats.totalUsers}</div>
                </div>
              </div>

              <div className="bg-neutral-900 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="flex border-b border-white/5 overflow-x-auto no-scrollbar">
                  {['analytics', 'chat', 'orders', 'inquiries', 'web-push', 'users', 'subscribers', 'reviews', 'backup'].map(view => (
                    <button 
                      key={view}
                      onClick={() => setDashboardView(view as any)}
                      className={`px-6 py-4 text-sm font-bold uppercase tracking-widest transition-colors ${dashboardView === view ? 'text-amber-500 border-b-2 border-amber-500' : 'text-neutral-500 hover:text-white'}`}
                    >
                      {view}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  {dashboardView === 'analytics' && <AdminAnalytics stats={stats} orders={orders} users={usersList} />}
                  {dashboardView === 'backup' && <AdminBackup />}
                  {dashboardView === 'web-push' && <AdminBroadcast />}
                  
                  {dashboardView === 'chat' && <AdminChat />}
                  {dashboardView === 'inquiries' && <AdminInquiries />}
                  {dashboardView === 'orders' && (
                  <div>
                    {/* Mobile Order Cards (Compact & Mobile-Friendly) */}
                    <div className="md:hidden p-4 space-y-4">
                      {loading && orders.length === 0 ? (
                        <div className="p-8 text-center text-neutral-500">Loading orders...</div>
                      ) : orders.length === 0 ? (
                        <div className="p-8 text-center text-neutral-500">No orders found.</div>
                      ) : (
                        orders.map((order) => {
                          const isMainAdminOrder = MASTER_ADMINS.includes(order.email?.toLowerCase());
                          return (
                            <div key={order.id} className={`p-4 rounded-2xl border transition-colors ${isMainAdminOrder ? 'bg-amber-500/5 border-amber-500/20' : 'bg-black/40 border-white/5'} space-y-3`}>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  {isMainAdminOrder && (
                                    <div className="inline-flex items-center gap-1 mb-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black animate-pulse">
                                      ⭐ PRIORITY ADMIN ORDER
                                    </div>
                                  )}
                                  <div className="text-xs font-mono text-amber-500">{order.orderId || order.id.slice(0,8)}</div>
                                  <div className="text-xs text-neutral-400 mt-0.5">{new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-white">₹{order.amount || 0}</div>
                                  {(order.paymentStatus?.includes('Verified') || order.paymentStatus === 'Paid') ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400">
                                      <CheckCircle2 size={10} /> Paid Advance
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                                      <Clock size={10} /> {order.paymentStatus || 'Pending'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="pt-2 border-t border-white/5 text-xs space-y-1">
                                <div className="font-semibold text-white">{order.name}</div>
                                <div className="text-neutral-400">{order.email}</div>
                                {order.phone && <div className="text-neutral-400">{order.phone}</div>}
                              </div>

                              {/* Compact Reference Photo Section - only shown if this order has referencePhotoUrl */}
                              {order.referencePhotoUrl && (
                                <div className="p-2.5 bg-neutral-900 border border-white/10 rounded-xl flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <img 
                                      src={order.referencePhotoUrl} 
                                      alt={`Reference photo for ${order.orderId || order.id}`} 
                                      className="w-11 h-11 rounded-lg object-cover border border-white/10 cursor-pointer hover:border-amber-500 transition-all shrink-0"
                                      onClick={() => setViewingRefPhoto(order.referencePhotoUrl)}
                                      title="Click to view full reference photo"
                                    />
                                    <div className="min-w-0">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Reference Photo</span>
                                      <span className="text-[11px] text-neutral-300 truncate block">Client reference</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setViewingRefPhoto(order.referencePhotoUrl)}
                                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-amber-500 hover:text-black text-white transition-colors cursor-pointer"
                                  >
                                    <Eye size={13} /> View Photo
                                  </button>
                                </div>
                              )}

                              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                                <div className="text-xs text-neutral-400">
                                  Status: <span className="text-white font-medium">{order.status || 'Payment Submitted'}</span>
                                </div>
                                <button 
                                  onClick={() => setSelectedOrder(order)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase bg-white/5 border border-white/10 hover:bg-white hover:text-black transition-colors"
                                >
                                  <Edit2 size={12} /> Manage
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Desktop Table View */}
                    <table className="hidden md:table w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-black/20 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
                        <th className="p-5 pl-6 whitespace-nowrap">Order Info</th>
                        <th className="p-5 whitespace-nowrap">Customer</th>
                        <th className="p-5 whitespace-nowrap">Status & Payment</th>
                        <th className="p-5 whitespace-nowrap text-right pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {loading && orders.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Loading orders...</td></tr>
                      ) : orders.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-neutral-500">No orders found.</td></tr>
                      ) : (
                        orders.map((order) => {
                          const isMainAdminOrder = MASTER_ADMINS.includes(order.email?.toLowerCase());
                          return (
                          <tr key={order.id} className={`transition-colors group ${isMainAdminOrder ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-white/[0.02]'}`}>
                            <td className="p-5 pl-6 align-top">
                              {isMainAdminOrder && (
                                <div className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                                  ⭐ PRIORITY ADMIN ORDER
                                </div>
                              )}
                              <div className="text-xs font-mono text-amber-500 mb-1">{order.orderId || order.id.slice(0,8)}</div>
                              <div className="text-sm text-white">{new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}</div>
                              {(order.paymentStatus?.includes('Verified') || order.paymentStatus === 'Paid') && (
                                <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                                  <CheckCircle2 size={10} /> Paid Advance
                                </div>
                              )}
                              {(order.paymentStatus === 'Payment Submitted' || order.paymentStatus === 'Pending Verification') && (
                                <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <Clock size={10} /> Needs Verification
                                </div>
                              )}
                            </td>
                            <td className="p-5 align-top">
                              <div className="font-semibold text-sm text-white">{order.name}</div>
                              <div className="text-xs text-neutral-400">{order.email}</div>
                              <div className="text-xs text-neutral-400">{order.phone}</div>
                              {order.referencePhotoUrl && (
                                <div className="mt-2.5 p-2 bg-black/40 border border-white/10 rounded-xl inline-flex items-center gap-2.5">
                                  <img 
                                    src={order.referencePhotoUrl} 
                                    alt={`Reference photo for ${order.orderId || order.id}`} 
                                    className="w-10 h-10 rounded-lg object-cover border border-white/10 cursor-pointer hover:border-amber-500 hover:scale-105 transition-all shrink-0"
                                    onClick={(e) => { e.stopPropagation(); setViewingRefPhoto(order.referencePhotoUrl); }}
                                    title="Click to view full reference photo"
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Reference Photo</span>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setViewingRefPhoto(order.referencePhotoUrl); }}
                                      className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline font-semibold cursor-pointer flex items-center gap-1 mt-0.5"
                                    >
                                      <Eye size={11} /> View Photo
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="p-5 align-top">
                              <select 
                                value={order.status} 
                                onChange={(e) => handleUpdateOrder(order.id, 'status', e.target.value)}
                                className="bg-black/50 border border-white/10 text-white text-xs rounded-xl py-2 px-3 outline-none focus:border-amber-500 appearance-none min-w-[140px] mb-2 block"
                              >
                                <option value="Payment Submitted">Payment Submitted</option>
                                <option value="Pending Payment">Pending Payment</option>
                                <option value="Drafting & Concept">Drafting & Concept</option>
                                <option value="Sketching Phase">Sketching Phase</option>
                                <option value="Painting & Shading">Painting & Shading</option>
                                <option value="Client Review">Client Review</option>
                                <option value="Framing & Packaging">Framing & Packaging</option>
                                <option value="Ready for Dispatch">Ready for Dispatch</option>
                                <option value="Shipped / In Transit">Shipped / In Transit</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                              
                              <select 
                                value={order.paymentStatus || 'Pending Payment'} 
                                onChange={(e) => handleUpdateOrder(order.id, 'paymentStatus', e.target.value)}
                                className={`bg-black/50 border border-white/10 text-xs rounded-xl py-2 px-3 outline-none focus:border-amber-500 appearance-none min-w-[140px] block ${(order.paymentStatus === 'Payment Submitted' || order.paymentStatus === 'Pending Verification') ? 'text-amber-400 border-amber-500/50' : (order.paymentStatus === 'Verified' || order.paymentStatus === 'Paid') ? 'text-green-400 border-green-500/50' : 'text-neutral-400'}`}
                              >
                                <option value="Pending Payment">Pending Payment</option>
                                <option value="Payment Submitted">Payment Submitted</option>
                                <option value="Pending Verification">Pending Verification</option>
                                <option value="Verified">Verified</option>
                                <option value="Paid">Paid</option>
                                <option value="Failed">Failed</option>
                              </select>
                            </td>
                            <td className="p-5 align-top text-right pr-6">
                              <div className="flex justify-end items-center h-full">
                                <button 
                                  onClick={() => setSelectedOrder(order)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase bg-white/5 border border-white/10 hover:bg-white hover:text-black transition-colors"
                                >
                                  <Edit2 size={14} /> Manage
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                        })
                      )}
                    </tbody>
                  </table>
                  </div>
                  )}

                  {dashboardView === 'users' && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/20 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
                          <th className="p-5 pl-6 whitespace-nowrap">Name</th>
                          <th className="p-5 whitespace-nowrap">Email</th>
                          <th className="p-5 whitespace-nowrap text-right">Last Login</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {usersList.length === 0 ? (
                           <tr><td colSpan={3} className="p-8 text-center text-neutral-500">No users found.</td></tr>
                        ) : (
                          usersList.map((u, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-5 pl-6 text-sm text-white font-semibold">{u.displayName || 'User'}</td>
                              <td className="p-5 text-sm text-neutral-400">{u.email}</td>
                              <td className="p-5 text-sm text-neutral-500 text-right">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {dashboardView === 'subscribers' && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/20 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
                          <th className="p-5 pl-6 whitespace-nowrap">Email</th>
                          <th className="p-5 whitespace-nowrap text-right">Subscribed At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {subscribers.length === 0 ? (
                           <tr><td colSpan={2} className="p-8 text-center text-neutral-500">No subscribers found.</td></tr>
                        ) : (
                          subscribers.map((s, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-5 pl-6 text-sm text-white">{s.email}</td>
                              <td className="p-5 text-sm text-neutral-400 text-right">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {dashboardView === 'reviews' && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-black/20 text-xs uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/5">
                          <th className="p-5 pl-6 whitespace-nowrap">User</th>
                          <th className="p-5 whitespace-nowrap">Review</th>
                          <th className="p-5 whitespace-nowrap">Status</th>
                          <th className="p-5 whitespace-nowrap text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {reviews.length === 0 ? (
                           <tr><td colSpan={4} className="p-8 text-center text-neutral-500">No reviews found.</td></tr>
                        ) : (
                          reviews.map((r, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-5 pl-6 align-top">
                                <div className="text-sm text-white">{r.userName || 'Anonymous'}</div>
                                <div className="text-xs text-neutral-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</div>
                              </td>
                              <td className="p-5 align-top">
                                <div className="text-sm text-neutral-300 line-clamp-2">{r.comment}</div>
                              </td>
                              <td className="p-5 align-top">
                                <div className="flex flex-wrap gap-2">
                                  <select 
                                    value={r.status?.toLowerCase() === 'approved' ? 'approved' : r.status?.toLowerCase() === 'rejected' ? 'rejected' : 'pending'}
                                    onChange={(e) => updateReviewStatus(r.id, e.target.value)}
                                    className="bg-black/50 border border-white/10 text-xs rounded-lg py-1 px-2 outline-none focus:border-amber-500"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                  </select>
                                </div>
                              </td>
                              <td className="p-5 align-top text-right">
                                <button onClick={() => replyReview(r.id)} className="text-amber-500 hover:text-amber-400 mr-3" title="Reply to review">
                                  Reply
                                </button>
                                <button onClick={() => deleteReview(r.id)} className="text-red-400 hover:text-red-300" title="Delete review">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
          </motion.div>
        )}

        {/* GALLERY TAB */}
        {activeTab === 'gallery' && (
          <motion.div initial={{opacity:0, y: 10}} animate={{opacity:1, y:0}} className="space-y-6">
            <h2 className="text-2xl font-bold">Manage Gallery</h2>
            <div className="bg-neutral-900 p-6 rounded-3xl border border-white/10">
              <form onSubmit={addGalleryItem} className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Artwork Title" 
                  value={newGalleryItem.title} 
                  onChange={e => setNewGalleryItem({...newGalleryItem, title: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 px-4 py-3 rounded-xl text-white outline-none" 
                  required 
                />
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef}
                  onChange={e => e.target.files && setGalleryFile(e.target.files[0])}
                  className="w-full bg-black/50 border border-white/10 px-4 py-3 rounded-xl text-white outline-none" 
                />
                <button type="submit" disabled={uploadingGallery} className="w-full bg-amber-500 text-black font-bold py-3 px-4 rounded-xl hover:bg-amber-400 transition-colors">
                  {uploadingGallery ? 'Uploading...' : 'Add to Gallery'}
                </button>
              </form>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gallery.map(item => (
                <div key={item.id} className="relative group rounded-2xl overflow-hidden aspect-square border border-white/10">
                  <img src={item.img} alt={item.title} className="w-full h-full object-cover" />
                  <button onClick={() => removeGalleryItem(item.id)} className="absolute top-2 right-2 p-2 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        
        {/* POPUP MANAGER TAB */}
        {activeTab === 'popup' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold">Popup Manager</h2>
                <p className="text-sm text-neutral-400">Configure the global announcement popup for website visitors.</p>
              </div>
            </div>

            <div className="bg-neutral-900 p-6 rounded-3xl border border-white/10 space-y-6">
              {/* Enable / Disable Toggle */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h3 className="font-bold text-white">Enable Popup</h3>
                  <p className="text-xs text-neutral-400">Turn the announcement popup on or off globally for all visitors.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={popupEnabled}
                    onChange={e => setPopupEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Live Status Summary Card */}
              {(() => {
                const status = getPopupScheduleStatus();
                return (
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${status.badgeClass} flex items-center gap-1.5`}>
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                        {status.label}
                      </span>
                      <p className="text-xs text-neutral-400">{status.description}</p>
                    </div>
                    <div className="text-xs text-neutral-400 flex items-center gap-2 shrink-0">
                      <span className="bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                        {popupFrequency === 'every_visit' ? 'Every visit' : popupFrequency === 'once_per_session' ? 'Once per session' : 'Once per day'}
                      </span>
                      <span className="bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                        {popupMaxShows === 0 ? 'Unlimited shows' : `Max ${popupMaxShows} ${popupMaxShows === 1 ? 'show' : 'shows'}`}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Scheduling Section */}
              <div className="space-y-4 border-b border-white/5 pb-6">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Calendar size={16} className="text-amber-500" /> Display Schedule
                  </h3>
                  <p className="text-xs text-neutral-400">Control when the announcement popup is scheduled to run. Both fields are optional.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Start Date & Time */}
                  <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                        <Clock size={13} className="text-amber-400" /> Start Date & Time
                      </label>
                      {popupStartAt && (
                        <button
                          type="button"
                          onClick={() => setPopupStartAt('')}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                        >
                          Clear (Immediate)
                        </button>
                      )}
                    </div>
                    <input
                      type="datetime-local"
                      value={popupStartAt}
                      onChange={e => setPopupStartAt(e.target.value)}
                      className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none [color-scheme:dark]"
                    />
                    <p className="text-[11px] text-neutral-500">
                      {popupStartAt ? `Active from ${new Date(popupStartAt).toLocaleString()}` : 'Optional. Starts immediately if left empty.'}
                    </p>
                  </div>

                  {/* End Date & Time */}
                  <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                        <Clock size={13} className="text-red-400" /> End Date & Time
                      </label>
                      {popupEndAt && (
                        <button
                          type="button"
                          onClick={() => setPopupEndAt('')}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                        >
                          Clear (No Expiry)
                        </button>
                      )}
                    </div>
                    <input
                      type="datetime-local"
                      value={popupEndAt}
                      onChange={e => setPopupEndAt(e.target.value)}
                      className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none [color-scheme:dark]"
                    />
                    <p className="text-[11px] text-neutral-500">
                      {popupEndAt ? `Stops showing after ${new Date(popupEndAt).toLocaleString()}` : 'Optional. Runs continuously with no expiration date if left empty.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Frequency & Display Limits Section */}
              <div className="space-y-4 border-b border-white/5 pb-6">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <RefreshCw size={16} className="text-amber-500" /> Display Frequency & Limits
                  </h3>
                  <p className="text-xs text-neutral-400">Control how frequently and how many times the popup is shown to each individual visitor.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Frequency Option */}
                  <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2">
                    <label className="text-xs font-semibold text-neutral-300 block">
                      Display Frequency
                    </label>
                    <select
                      value={popupFrequency}
                      onChange={e => setPopupFrequency(e.target.value as any)}
                      className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
                    >
                      <option value="every_visit">Every visit (Default)</option>
                      <option value="once_per_session">Once per session</option>
                      <option value="once_per_day">Once per day</option>
                    </select>
                    <p className="text-[11px] text-neutral-500">
                      {popupFrequency === 'every_visit' && 'Displays on every page load/visit (unless max show count is reached).'}
                      {popupFrequency === 'once_per_session' && 'Displays only once per browser tab session.'}
                      {popupFrequency === 'once_per_day' && 'Displays once every 24 hours per visitor browser.'}
                    </p>
                  </div>

                  {/* Maximum Show Count */}
                  <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2">
                    <label className="text-xs font-semibold text-neutral-300 block">
                      Maximum Show Count
                    </label>
                    <select
                      value={popupMaxShows}
                      onChange={e => setPopupMaxShows(Number(e.target.value))}
                      className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
                    >
                      <option value={0}>Unlimited (Default)</option>
                      <option value={1}>1 time</option>
                      <option value={2}>2 times</option>
                      <option value={3}>3 times</option>
                      <option value={5}>5 times</option>
                      <option value={10}>10 times</option>
                    </select>
                    <p className="text-[11px] text-neutral-500">
                      {popupMaxShows === 0 ? 'No limit on the total number of times a visitor sees this popup.' : `Stops showing completely after a user has viewed it ${popupMaxShows} ${popupMaxShows === 1 ? 'time' : 'times'}.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Popup Image Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">Popup Image</h3>
                    <p className="text-xs text-neutral-400">Select an image to display inside the announcement popup modal.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedPopupFile && (
                      <button
                        type="button"
                        onClick={cancelSelectedPopupFile}
                        className="text-xs text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-800 transition-colors"
                      >
                        Cancel New File
                      </button>
                    )}
                    {getActivePopupDisplayUrl() && (
                      <button
                        type="button"
                        onClick={removePopupImage}
                        className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1 rounded-lg bg-red-500/10 transition-colors flex items-center gap-1 font-semibold"
                      >
                        <Trash2 size={13} /> Remove Image
                      </button>
                    )}
                  </div>
                </div>

                {getActivePopupDisplayUrl() ? (
                  <div className="relative w-full h-64 bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center p-3 group">
                    <img
                      src={getActivePopupDisplayUrl()}
                      alt="Popup Preview"
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3.5 py-2 bg-black/80 backdrop-blur-md rounded-xl text-xs text-neutral-300 border border-white/10">
                      <span className="truncate">
                        {selectedPopupFile ? (
                          <span className="text-amber-400 font-semibold">
                            New file: {selectedPopupFile.name} (Uploads on Save)
                          </span>
                        ) : (
                          <span className="text-green-400 font-semibold">Current Saved Image</span>
                        )}
                      </span>
                      <label className="text-amber-400 hover:text-amber-300 cursor-pointer font-bold shrink-0 ml-2">
                        Replace Image
                        <input
                          ref={popupFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/jpg"
                          onChange={handlePopupImageFileSelection}
                          disabled={isSavingPopup || isUploadingPopup}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-56 bg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-neutral-500 relative flex items-center justify-center hover:border-amber-500/50 transition-colors border-dashed">
                    <input
                      ref={popupFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handlePopupImageFileSelection}
                      disabled={isSavingPopup || isUploadingPopup}
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex flex-col items-center gap-2 pointer-events-none text-center px-4">
                      <ImageIcon size={32} className="text-neutral-500" />
                      <span className="text-sm font-semibold text-neutral-300">
                        Click or drag an image here to upload
                      </span>
                      <span className="text-xs text-neutral-500">
                        Supports JPG, PNG, WebP up to 15MB
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Progress Bar if Uploading */}
              {isUploadingPopup && (
                <div className="rounded-2xl bg-black/60 border border-amber-500/20 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin" /> Uploading image to Cloudinary...
                    </span>
                    <span>{popupUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-200"
                      style={{ width: `${popupUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Feedback Alert Banner */}
              {popupFeedback && (
                <div
                  className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
                    popupFeedback.type === 'success'
                      ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                      : 'bg-red-500/10 border border-red-500/30 text-red-400'
                  }`}
                >
                  {popupFeedback.type === 'success' ? (
                    <CheckCircle2 size={16} className="shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0" />
                  )}
                  <span>{popupFeedback.message}</span>
                </div>
              )}

              {/* Actions: Save & Preview */}
              <div className="pt-4 border-t border-white/5 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={executeSavePopup}
                  disabled={isSavingPopup || isUploadingPopup}
                  className="bg-amber-500 text-black font-bold py-3 px-6 rounded-xl hover:bg-amber-400 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingPopup || isUploadingPopup ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>{isUploadingPopup ? 'Uploading...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Popup Config</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowPopupPreview(true)}
                  className="bg-neutral-800 text-white font-bold py-3 px-6 rounded-xl hover:bg-neutral-700 transition-colors flex items-center gap-2"
                >
                  <Eye size={16} /> Preview Modal
                </button>
              </div>
            </div>

            {/* Popup Full Preview Modal */}
            {showPopupPreview && typeof document !== 'undefined' && createPortal(
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="relative max-w-md md:max-w-xl w-full flex flex-col items-center justify-center rounded-3xl overflow-hidden shadow-2xl bg-neutral-950 border border-white/10">
                  <button
                    onClick={() => setShowPopupPreview(false)}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-md"
                  >
                    <X size={20} />
                  </button>
                  {getActivePopupDisplayUrl() ? (
                    <img
                      src={getActivePopupDisplayUrl()}
                      alt="Announcement Preview"
                      className="w-full object-contain max-h-[85vh] bg-black"
                    />
                  ) : (
                    <div className="w-full h-64 bg-neutral-900 flex items-center justify-center text-neutral-500">
                      No image configured
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}
          </motion.div>
        )}

        {/* ADMINS TAB */}
        {activeTab === 'admins' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-6">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Users className="text-amber-500" /> Authorized Personnel</h2>
              {loadingAdmins ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-500 w-8 h-8" /></div>
              ) : (
                <div className="space-y-4">
                  {adminsList.map((a: any) => (
                    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black rounded-xl border border-white/5 gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-500">
                           <Shield size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-white">{a.email}</p>
                          <p className="text-xs text-neutral-400 capitalize">{a.role} Access</p>
                        </div>
                      </div>
                      
                      {isOwner && a.email !== user?.email && (
                        <div className="flex gap-2">
                          <select 
                            value={a.role}
                            onChange={(e) => updateAdminRole(a.id, e.target.value)}
                            className="bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                          >
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* NOTIFICATION MANAGER TAB */}
        {activeTab === 'notifications' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AdminNotificationManager 
              onOpenDiagnostics={() => {
                setActiveTab('dashboard');
                setDashboardView('web-push' as any);
              }}
              adminEmail={user?.email || 'admin'}
            />
          </motion.div>
        )}
      </div>

      {/* GLOBAL ORDER DETAIL MODAL */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedOrder && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-white/10 rounded-2xl max-w-2xl w-full my-8 shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-neutral-900/90 backdrop-blur-md rounded-t-2xl z-10">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  Order Details
                </h3>
                <button onClick={() => { setSelectedOrder(null); setEditingId(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Customer</h4>
                    <div className="space-y-1">
                      <p className="font-medium text-lg">{selectedOrder.name}</p>
                      <p className="text-neutral-300">{selectedOrder.email}</p>
                      <p className="text-neutral-300">{selectedOrder.phone}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Order Info</h4>
                    <div className="space-y-1">
                      <p className="font-mono text-amber-500 text-sm">ID: {selectedOrder.orderId || selectedOrder.id}</p>
                      <p className="text-neutral-300">Date: {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                      <p className="text-neutral-300 font-medium">Amount: ₹{selectedOrder.amount}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Artwork Details</h4>
                  <div className="bg-black p-4 rounded-xl border border-white/5 grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-neutral-500 block mb-1">Subject:</span> {selectedOrder.subject || selectedOrder.artCode || 'Custom Commission'}</div>
                    <div><span className="text-neutral-500 block mb-1">Size:</span> {selectedOrder.size || 'Custom Size'}</div>
                    <div><span className="text-neutral-500 block mb-1">Medium:</span> {selectedOrder.medium || 'Handmade Artwork'}</div>
                    <div><span className="text-neutral-500 block mb-1">Framing:</span> {selectedOrder.framing || 'Standard'}</div>
                    {selectedOrder.message && (
                      <div className="col-span-2 pt-2 border-t border-white/5">
                        <span className="text-neutral-500 block mb-1">Client Vision / Specifications:</span>
                        <p className="text-neutral-300 whitespace-pre-wrap">{selectedOrder.message}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reference Photo Section (Only shown when that particular order has referencePhotoUrl) */}
                {selectedOrder.referencePhotoUrl && (
                  <div id="admin-reference-photo-section">
                    <h4 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Reference Photo</h4>
                    <div className="bg-black p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <img 
                          src={selectedOrder.referencePhotoUrl} 
                          alt={`Reference for order ${selectedOrder.orderId || selectedOrder.id}`} 
                          className="w-16 h-16 object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-85 hover:border-amber-500 transition-all shrink-0"
                          onClick={() => setViewingRefPhoto(selectedOrder.referencePhotoUrl)}
                          title="Click for full view"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">Client Reference Artwork</p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">Uploaded during commission enquiry</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <button 
                          type="button"
                          id="btn-admin-view-ref-full"
                          onClick={() => setViewingRefPhoto(selectedOrder.referencePhotoUrl)}
                          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-amber-500 hover:text-black text-white transition-colors cursor-pointer"
                        >
                          <Eye size={14} /> Full View
                        </button>
                        <a 
                          href={selectedOrder.referencePhotoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Open original image in new tab"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-bold text-neutral-400 mb-2 uppercase tracking-wider">Shipping Address</h4>
                  <div className="bg-black p-4 rounded-xl border border-white/5 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                    {selectedOrder.address}
                  </div>
                </div>

                {editingId === selectedOrder.id ? (
                  <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl space-y-4">
                    <h4 className="font-bold text-amber-500 flex items-center gap-2">
                      <Edit2 size={16} /> Edit Order Status
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-neutral-400 mb-1 block">Order Status</label>
                        <select 
                          value={editForm.status || 'Payment Submitted'} 
                          onChange={(e) => setEditForm({...editForm, status: e.target.value})}

                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 outline-none"
                        >
                          <option value="Payment Submitted">Payment Submitted</option>
                          <option value="Pending Payment">Pending Payment</option>
                          <option value="Drafting & Concept">Drafting & Concept</option>
                          <option value="Sketching Phase">Sketching Phase</option>
                          <option value="Painting & Shading">Painting & Shading</option>
                          <option value="Client Review">Client Review</option>
                          <option value="Framing & Packaging">Framing & Packaging</option>
                          <option value="Ready for Dispatch">Ready for Dispatch</option>
                          <option value="Shipped / In Transit">Shipped / In Transit</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-neutral-400 mb-1 block">Payment Status</label>
                        <select 
                          value={editForm.paymentStatus || 'Pending Payment'} 
                          onChange={(e) => setEditForm({...editForm, paymentStatus: e.target.value})}
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 outline-none"
                        >
                          <option value="Pending Payment">Pending Payment</option>
                          <option value="Payment Submitted">Payment Submitted</option>
                          <option value="Pending Verification">Pending Verification</option>
                          <option value="Verified">Verified</option>
                          <option value="Paid">Paid</option>
                          <option value="Failed">Failed</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-xs text-neutral-400 mb-1 block">Courier Partner</label>
                        <select 
                          value={editForm.courierPartner || ''} 
                          onChange={(e) => setEditForm({...editForm, courierPartner: e.target.value})}
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 outline-none"
                        >
                          <option value="">Select Courier...</option>
                          <option value="Delhivery">Delhivery</option>
                          <option value="Blue Dart">Blue Dart</option>
                          <option value="DTDC">DTDC</option>
                          <option value="XpressBees">XpressBees</option>
                          <option value="Ecom Express">Ecom Express</option>
                          <option value="India Post">India Post</option>
                          <option value="Shadowfax">Shadowfax</option>
                          <option value="DHL">DHL</option>
                          <option value="FedEx">FedEx</option>
                          <option value="Amazon Shipping">Amazon Shipping</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-neutral-400 mb-1 block">Tracking ID (Optional)</label>
                        <input 
                          type="text" 
                          placeholder="AWB or Tracking Number"
                          value={editForm.trackingId || ''} 
                          onChange={(e) => setEditForm({...editForm, trackingId: e.target.value})}
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 outline-none"
                        />
                      </div>

                    </div>
                    <div className="flex gap-3 pt-4">
                      <button onClick={() => saveFullEdit(selectedOrder.id)} className="flex-1 bg-amber-500 text-black font-bold py-3 rounded-xl hover:bg-amber-400">Save Changes</button>
                      <button onClick={() => setEditingId(null)} className="flex-1 bg-white/5 text-white font-bold py-3 rounded-xl hover:bg-white/10">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    {invoiceStatus && (
                      <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
                        invoiceStatus.type === 'success' 
                          ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                          : invoiceStatus.type === 'error'
                          ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                          : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                      }`}>
                        {invoiceStatus.type === 'success' && <CheckCircle2 size={16} className="shrink-0 text-green-400" />}
                        {invoiceStatus.type === 'error' && <AlertCircle size={16} className="shrink-0 text-red-400" />}
                        {invoiceStatus.type === 'info' && <Loader2 size={16} className="shrink-0 animate-spin text-amber-400" />}
                        <span className="flex-1 leading-relaxed">{invoiceStatus.text}</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between gap-3">
                      <div className="flex flex-wrap gap-3">
                        <button 
                          type="button"
                          onClick={() => generateInvoice(selectedOrder, 'download')} 
                          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-amber-500 text-black hover:bg-amber-400 cursor-pointer transition-colors"
                        >
                          <Download size={16} /> Generate Invoice
                        </button>
                        <button 
                          type="button"
                          disabled={sendingInvoiceOrderId === selectedOrder.id || !!sendingInvoiceOrderId}
                          onClick={() => handleSendInvoice(selectedOrder)}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-neutral-800 text-amber-500 border border-amber-500/30 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          {sendingInvoiceOrderId === selectedOrder.id ? (
                            <>
                              <Loader2 size={16} className="animate-spin" /> Sending...
                            </>
                          ) : (
                            <>
                              <Mail size={16} /> Send Invoice
                            </>
                          )}
                        </button>
                      </div>
                      <button 
                        type="button"
                        onClick={() => { setEditingId(selectedOrder.id); setEditForm(selectedOrder); }} 
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-white text-black hover:bg-neutral-200 cursor-pointer transition-colors"
                      >
                        <Edit2 size={16} /> Edit Order
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
          )}
        </AnimatePresence>,
        document.body
      )}
                
      <AnimatePresence>
        {saveSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-[250] bg-neutral-900 border border-white/10 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3"
          >
            {saveSuccessMessage}
          </motion.div>
        )}
      </AnimatePresence>
      
      {showSignOutConfirm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center">
            <LogOut className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Sign Out</h3>
            <p className="text-neutral-400 text-sm mb-6">Are you sure you want to sign out of the Admin Workspace?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 bg-neutral-800 text-white font-bold py-3 px-4 rounded-xl hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => { setShowSignOutConfirm(false); logout(); }}
                className="flex-1 bg-red-500 text-white font-bold py-3 px-4 rounded-xl hover:bg-red-400 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* FULL REFERENCE PHOTO LIGHTBOX */}
      {typeof document !== 'undefined' && viewingRefPhoto && createPortal(
        <div 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setViewingRefPhoto(null)}
        >
          <div 
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-12 right-0 flex items-center gap-2 z-10">
              <a
                href={viewingRefPhoto}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-3 rounded-full bg-black/80 hover:bg-white/20 text-white transition-colors border border-white/10 inline-flex items-center gap-1.5 text-xs font-medium"
                title="Open original in new tab"
              >
                <ExternalLink size={14} /> Open Original
              </a>
              <button 
                type="button"
                onClick={() => setViewingRefPhoto(null)} 
                className="p-1.5 rounded-full bg-black/80 hover:bg-white/20 text-white transition-colors border border-white/10 cursor-pointer"
                title="Close lightbox"
              >
                <X size={18} />
              </button>
            </div>
            <img 
              src={viewingRefPhoto} 
              alt="Full Reference" 
              className="max-h-[82vh] max-w-full object-contain rounded-2xl border border-white/10 shadow-2xl" 
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
