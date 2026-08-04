import { generateInvoice } from '../lib/generateInvoice';
import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signInWithRedirect, signOut, User } from 'firebase/auth';
import { adminAuth, adminGoogleProvider, adminDb as db, storage } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc, limit, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import jsPDF from 'jspdf';
import { Shield, Truck, Download, LogOut, CheckCircle2, Clock, XCircle, Trash2, Edit2, Save, X, RefreshCw, Eye, LayoutDashboard, Settings, Users, ArrowRight, Paintbrush, Loader2, Link2, Lock, Plus, Image as ImageIcon, Mail, MessageSquare, IndianRupee, UploadCloud } from 'lucide-react';
import AdminAnalytics from './AdminAnalytics';
import AdminBackup from './AdminBackup';
import AdminChat from './AdminChat';
import AdminInquiries from './AdminInquiries';
import AdminNotifications from './AdminNotifications';


import { useSiteConfig, defaultSiteConfig, SiteConfig } from '../lib/SiteContext';

const MASTER_ADMINS = ["gargsubhalaxmi@gmail.com", "nayanxx009@gmail.com", "admin@example.com"];

async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}



export default function AdminPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(adminAuth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithRedirect(adminAuth, adminGoogleProvider);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        console.error("Login failed", err);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(adminAuth);
    } catch (err) {
      console.error(err);
    }
  };
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [adminDocData, setAdminDocData] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Payment verification state
  

  // Authentication Flow States
  const [passwordFlow, setPasswordFlow] = useState<'none' | 'setup' | 'enter'>('none');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'site' | 'admins' | 'gallery' | 'system'>('dashboard');
  

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

  const siteConfig = useSiteConfig();
  const [localSiteConfig, setLocalSiteConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [isUploadingPopup, setIsUploadingPopup] = useState(false);
  const [showPopupPreview, setShowPopupPreview] = useState(false);
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

  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoading) return;
      if (!user) {
        setCheckingAuth(false);
        setPasswordFlow('none');
        return;
      }
      try {
        if (!user.email) {
          setIsAdmin(false);
          setCheckingAuth(false);
          return;
        }

        let isMaster = MASTER_ADMINS.includes(user.email.toLowerCase());
        let isAuthorized = isMaster;

        const adminDoc = await getDoc(doc(db, 'admins', user.email));
        if (adminDoc.exists()) {
          isAuthorized = true;
        }

        if (!isAuthorized) {
          setIsAdmin(false);
          setPasswordFlow('none');
          setLoginError("You are not authorized to access the Admin Panel.");
          await signOut(adminAuth);
          setCheckingAuth(false);
          return;
        }

        setIsAdmin(true);
        setIsOwner(isMaster);

        if (adminDoc.exists()) {
          setAdminDocData(adminDoc.data());
          if (!adminDoc.data().password) {
            setPasswordFlow('setup');
          } else {
            // ALWAYS verify password, even on trusted devices
            setPasswordFlow('enter');
          }
        } else {
          // Master admin first time
          await setDoc(doc(db, 'admins', user.email), { email: user.email, addedAt: Date.now() });
          setPasswordFlow('setup');
        }
      } catch (e: any) {
        if (e.code === 'unavailable' || e.message?.includes('offline')) {
          alert("Failed to connect to the database. If you are using an ad blocker, strict privacy settings, or are in a preview iframe, please open the app in a new tab or disable the blocker.");
        } else {
          console.error(e);
        }
        setIsAdmin(false);
        setPasswordFlow('none');
      }
      setCheckingAuth(false);
    };
    checkAdmin();
  }, [user, authLoading]);

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
    if (!adminPasswordInput.trim()) return;
    
    setPasswordError('');
    try {
      const hashed = await hashPassword(adminPasswordInput);
      if (passwordFlow === 'setup') {
        const updateData: any = { password: hashed };
        if (rememberMe) {
           const token = generateToken();
           updateData.trustedDevices = [token];
           localStorage.setItem(`admin_trusted_${user!.email}`, token);
        }
        await updateDoc(doc(db, 'admins', user!.email!), updateData);
        setPasswordFlow('none');
      } else if (passwordFlow === 'enter') {
        if (adminDocData.password === hashed) {
          if (rememberMe) {
             const token = generateToken();
             const trustedList = adminDocData.trustedDevices || [];
             await updateDoc(doc(db, 'admins', user!.email!), { trustedDevices: [...trustedList, token] });
             localStorage.setItem(`admin_trusted_${user!.email}`, token);
          }
          setPasswordFlow('none');
        } else {
          setPasswordError('Incorrect password');
        }
      }
    } catch (e) {
      console.error(e);
      setPasswordError('An error occurred');
    }
  };

  const handleForgotPassword = async () => {
    // If they forget the password, we clear it and force them to re-authenticate with Google.
    // They must own the Google account to sign back in.
    if (!window.confirm("This will sign you out and reset your password. You must sign in with Google again to set a new password. Continue?")) return;
    try {
      await updateDoc(doc(db, 'admins', user!.email!), { password: '' });
      await logout();
    } catch (e) {
      console.error(e);
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
      
      if (isNewShipment && editForm.email) {
         try {
           await fetch((import.meta.env.VITE_API_URL || '') + '/api/notify-shipment', {
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

  const handlePopupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large (max 2MB)");
      return;
    }
    try {
      setIsUploadingPopup(true);
      const fileRef = ref(storage, `popup/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setLocalSiteConfig({ ...localSiteConfig, popupImage: url });
    } catch (error: any) {
      alert("Upload failed: " + error.message);
    } finally {
      setIsUploadingPopup(false);
    }
  };

  const saveSiteConfig = async () => {
    setSavingSite(true);
    try {
      await setDoc(doc(db, 'settings', 'site_config'), localSiteConfig);
      alert("Site settings saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Error saving settings.");
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
    } catch (e) {
      console.error(e);
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
        const fileRef = ref(storage, `gallery/${Date.now()}_${galleryFile.name}`);
        await uploadBytes(fileRef, galleryFile);
        imageUrl = await getDownloadURL(fileRef);
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-sm font-mono text-neutral-500">VERIFYING CREDENTIALS...</p>
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
            onClick={() => { setLoginError(''); loginWithGoogle(); }}
            className="w-full bg-white text-black font-bold py-3 px-4 rounded-xl hover:bg-neutral-200 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (passwordFlow !== 'none') {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white p-4">
        <div className="bg-neutral-900 border border-amber-500/30 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
          <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-white">
            {passwordFlow === 'setup' ? 'Set Admin Password' : 'Admin Password'}
          </h1>
          <p className="text-sm text-neutral-400 mb-6">
            {passwordFlow === 'setup' ? 'Create a secure password to protect your admin workspace.' : 'Enter your admin password to proceed.'}
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input 
                type="password"
                placeholder={passwordFlow === 'setup' ? "New Password" : "Password"}
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                className="w-full bg-black/50 border border-white/10 px-4 py-3 rounded-xl text-white outline-none focus:border-amber-500 transition-colors"
                required
              />
            </div>
            {passwordError && <p className="text-red-400 text-xs text-left">{passwordError}</p>}
            <div className="flex items-center gap-2 text-left">
              <input 
                type="checkbox" 
                id="remember" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-amber-500 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-neutral-400 cursor-pointer select-none">
                Remember this device
              </label>
            </div>
            <button 
              type="submit"
              className="w-full bg-amber-500 text-black font-bold py-3 px-4 rounded-xl hover:bg-amber-400 transition-colors"
            >
              {passwordFlow === 'setup' ? 'Save Password' : 'Enter'}
            </button>
          </form>
          {passwordFlow === 'enter' && (
            <button 
              onClick={handleForgotPassword}
              className="mt-6 text-xs text-neutral-500 hover:text-white transition-colors"
            >
              Forgot password? Reset via Google
            </button>
          )}
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
                onClick={logout}
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
                  {['analytics', 'chat', 'orders', 'inquiries', 'users', 'subscribers', 'reviews', 'backup'].map(view => (
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
                  
                  {dashboardView === 'chat' && <AdminChat />}
                  {dashboardView === 'inquiries' && <AdminInquiries />}
                  {dashboardView === 'orders' && (
                  <table className="w-full text-left border-collapse min-w-[800px]">
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
                                    value={r.status || 'pending'}
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
                                <button onClick={() => deleteReview(r.id)} className="text-red-400 hover:text-red-300">
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
          <motion.div initial={{opacity:0, y: 10}} animate={{opacity:1, y:0}} className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold">Popup Manager</h2>
                <p className="text-sm text-neutral-400">Configure the global image popup for website visitors.</p>
              </div>
            </div>
            
            <div className="bg-neutral-900 p-6 rounded-3xl border border-white/10 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h3 className="font-bold">Enable Popup</h3>
                  <p className="text-xs text-neutral-400">Turn the popup on or off globally.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={localSiteConfig.popupEnabled || false} onChange={e => setLocalSiteConfig({...localSiteConfig, popupEnabled: e.target.checked})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-neutral-400 mb-1 block">Popup Frequency</label>
                    <select 
                      value={localSiteConfig.popupFrequency || 'session'} 
                      onChange={e => setLocalSiteConfig({...localSiteConfig, popupFrequency: e.target.value as any})}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 outline-none appearance-none"
                    >
                      <option value="always">Show Every Visit</option>
                      <option value="daily">Show Once Per Day</option>
                      <option value="session">Show Once Per Session</option>
                      <option value="once">Show Only One Time Ever</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-neutral-400 mb-1 block">Popup Image (Firebase Storage)</label>
                    {localSiteConfig.popupImage ? (
                      <div className="relative w-full h-48 bg-black rounded-xl overflow-hidden border border-white/10 mb-2 flex items-center justify-center">
                        <img src={localSiteConfig.popupImage} alt="Popup" className="max-w-full max-h-full object-contain" />
                        <button onClick={() => setLocalSiteConfig({...localSiteConfig, popupImage: ''})} className="absolute top-2 right-2 p-2 bg-black/80 text-white rounded-full hover:bg-red-500 transition-colors backdrop-blur-md">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-500 relative flex items-center justify-center hover:border-amber-500/50 transition-colors border-dashed">
                        <input type="file" accept="image/*" onChange={handlePopupImageUpload} disabled={isUploadingPopup} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                          <ImageIcon size={24} className="text-neutral-600" />
                          <span>{isUploadingPopup ? "Uploading..." : "Upload from Gallery"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex gap-4">
                <button onClick={saveSiteConfig} className="bg-amber-500 text-black font-bold py-3 px-6 rounded-xl hover:bg-amber-400 transition-colors flex items-center gap-2">
                  <Save size={16} /> Save Popup Config
                </button>
                <button onClick={() => setShowPopupPreview(true)} className="bg-neutral-800 text-white font-bold py-3 px-6 rounded-xl hover:bg-neutral-700 transition-colors flex items-center gap-2">
                  <Eye size={16} /> Preview
                </button>
              </div>
            </div>

            {showPopupPreview && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="relative max-w-md md:max-w-xl w-full flex flex-col items-center justify-center rounded-3xl overflow-hidden shadow-2xl">
                  <button onClick={() => setShowPopupPreview(false)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-md">
                    <X size={20} />
                  </button>
                  {localSiteConfig.popupImage ? (
                    <img src={localSiteConfig.popupImage} alt="Announcement" className="w-full object-contain max-h-[85vh] bg-black" />
                  ) : (
                    <div className="w-full h-64 bg-neutral-900 flex items-center justify-center text-neutral-500">No image uploaded</div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ADMINS TAB */}
        {activeTab === 'admins' && (
          <motion.div initial={{opacity:0, y: 10}} animate={{opacity:1, y:0}} className="space-y-6">
            <h2 className="text-2xl font-bold">Manage Admins</h2>
            <div className="bg-neutral-900 p-6 rounded-3xl border border-white/10">
              <form onSubmit={addAdmin} className="flex gap-4">
                <input 
                  type="email" 
                  placeholder="New Admin Email" 
                  value={newAdminEmail} 
                  onChange={e => setNewAdminEmail(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/10 px-4 py-3 rounded-xl text-white outline-none" 
                  required 
                />
                <button type="submit" className="bg-amber-500 text-black font-bold py-3 px-6 rounded-xl hover:bg-amber-400 transition-colors whitespace-nowrap">
                  Add Admin
                </button>
              </form>
            </div>
            <div className="bg-neutral-900 rounded-3xl border border-white/10 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-white/5">
                  {adminsList.map(a => (
                    <tr key={a.id}>
                      <td className="p-5 text-white">{a.email}</td>
                      <td className="p-5 text-right">
                        {!MASTER_ADMINS.includes(a.email) && (
                          <button onClick={() => removeAdmin(a.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

      </div>

      {/* Edit Order Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} className="relative bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h3 className="text-xl font-bold flex items-center gap-2">Order Details</h3>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-amber-500 mb-2 uppercase tracking-widest">Customer Information</h4>
                  <div className="grid grid-cols-2 gap-4 bg-neutral-900/50 p-4 rounded-2xl border border-white/5">
                    <div><span className="text-neutral-500 text-xs block mb-1">Name</span><div className="text-sm font-medium">{selectedOrder.name}</div></div>
                    <div><span className="text-neutral-500 text-xs block mb-1">Email</span><div className="text-sm font-medium break-all">{selectedOrder.email}</div></div>
                    <div><span className="text-neutral-500 text-xs block mb-1">Phone</span><div className="text-sm font-medium">{selectedOrder.phone}</div></div>
                    <div><span className="text-neutral-500 text-xs block mb-1">Order Date</span><div className="text-sm font-medium">{new Date(selectedOrder.createdAt).toLocaleString()}</div></div>
                  </div>
                </div>

                {editingId === selectedOrder.id ? (
                  <div className="space-y-4 bg-amber-500/5 p-6 rounded-2xl border border-amber-500/20">
                    <h4 className="text-sm font-bold text-amber-500 mb-4 flex items-center gap-2"><Edit2 size={14} /> Edit Status</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-neutral-400 mb-1 block">Production Status</label>
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
                  <div className="flex flex-col sm:flex-row justify-between pt-4 border-t border-white/5 gap-3">
                    <div className="flex gap-3">
                      <button onClick={() => generateInvoice(selectedOrder, 'download')} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-amber-500 text-black hover:bg-amber-400">
                        <Download size={16} /> Generate Invoice
                      </button>
                      <button onClick={() => generateInvoice(selectedOrder, 'email')} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-neutral-800 text-amber-500 border border-amber-500/30 hover:bg-neutral-700">
                        <Mail size={16} /> Send Invoice
                      </button>
                    </div>
                    <button onClick={() => { setEditingId(selectedOrder.id); setEditForm(selectedOrder); }} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-white text-black hover:bg-neutral-200">
                      <Edit2 size={16} /> Edit Order
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
