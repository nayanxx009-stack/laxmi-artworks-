import { createPortal } from 'react-dom';
import { generateInvoice } from '../lib/generateInvoice';
import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { useAuth } from '../lib/auth';
import { auth, googleProvider, db, storage } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc, getDocFromServer, limit, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import jsPDF from 'jspdf';
import { Shield, Truck, Download, LogOut, CheckCircle2, Clock, XCircle, Trash2, Edit2, Save, X, RefreshCw, Eye, LayoutDashboard, Settings, Users, ArrowRight, Paintbrush, Loader2, Link2, Lock, Plus, Image as ImageIcon, Mail, MessageSquare, IndianRupee, UploadCloud, Bell, AlertCircle } from 'lucide-react';
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

  const siteConfig = useSiteConfig();
  const [localSiteConfig, setLocalSiteConfig] = useState<SiteConfig>(defaultSiteConfig);

  // Strict Popup Manager State Machine Types & Variables
  // NO_NEW_FILE -> FILE_SELECTED -> VALIDATING -> UPLOADING -> UPLOAD_SUCCESS -> READY_TO_SAVE -> SAVING -> VERIFYING -> SUCCESS
  // On error: UPLOAD_FAILED -> ERROR
  type PopupUploadState = 
    | 'NO_NEW_FILE' 
    | 'FILE_SELECTED' 
    | 'VALIDATING' 
    | 'UPLOADING' 
    | 'UPLOAD_SUCCESS' 
    | 'UPLOAD_FAILED' 
    | 'READY_TO_SAVE' 
    | 'SAVING' 
    | 'VERIFYING' 
    | 'SUCCESS' 
    | 'ERROR';

  const [savedPopupImageUrl, setSavedPopupImageUrl] = useState<string>('');
  const [pendingPopupImageUrl, setPendingPopupImageUrl] = useState<string | null>(null);
  const [hasPendingNewImage, setHasPendingNewImage] = useState<boolean>(false);
  const [directImageUrlInput, setDirectImageUrlInput] = useState<string>('');
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [uploadStateMachine, setUploadStateMachine] = useState<PopupUploadState>('NO_NEW_FILE');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [bytesTransferred, setBytesTransferred] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadErrorCode, setUploadErrorCode] = useState<string | null>(null);
  const [uploadErrorDetails, setUploadErrorDetails] = useState<{ title: string; explanation: string; action: string } | null>(null);
  const activeUploadTaskRef = useRef<any>(null);
  const popupFileInputRef = useRef<HTMLInputElement>(null);

  // Diagnostics verification tracking
  const [finalSaveUrl, setFinalSaveUrl] = useState<string | null>(null);
  const [firestoreServerUrl, setFirestoreServerUrl] = useState<string | null>(null);
  const [urlMatch, setUrlMatch] = useState<'YES' | 'NO' | 'PENDING' | 'N/A'>('N/A');

  const [popupEnabled, setPopupEnabled] = useState<boolean>(false);
  const [popupFrequency, setPopupFrequency] = useState<'session' | 'always' | 'daily' | 'once'>('session');

  const [showPopupPreview, setShowPopupPreview] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [savingPopup, setSavingPopup] = useState(false);
  const [popupSaveFeedback, setPopupSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
    if (siteConfig.popupImage && !savedPopupImageUrl) {
      setSavedPopupImageUrl(siteConfig.popupImage);
    }
  }, [siteConfig]);

  // Load canonical settings/popup when popup tab is opened
  useEffect(() => {
    if (activeTab !== 'popup') return;
    const fetchCanonicalPopup = async () => {
      try {
        console.log('[POPUP_SERVER_READBACK_STARTED] Fetching canonical settings/popup');
        const pSnap = await getDoc(doc(db, 'settings', 'popup'));
        if (pSnap.exists()) {
          const pData = pSnap.data();
          const activeImg = pData.imageUrl || pData.popupImage || '';
          setSavedPopupImageUrl(activeImg);
          setDirectImageUrlInput(pData.directImageUrl || activeImg);
          setPopupEnabled(pData.enabled !== undefined ? Boolean(pData.enabled) : false);
          setPopupFrequency(pData.frequency || 'session');
          setLocalSiteConfig(prev => ({
            ...prev,
            popupEnabled: pData.enabled !== undefined ? Boolean(pData.enabled) : prev.popupEnabled,
            popupFrequency: pData.frequency || prev.popupFrequency,
            popupImage: activeImg,
            imageUrl: activeImg
          }));
          console.log('[POPUP_SERVER_READBACK_SUCCESS] Canonical popup loaded:', {
            enabled: pData.enabled,
            frequency: pData.frequency,
            hasImage: Boolean(activeImg)
          });
        }
      } catch (err) {
        console.warn('[POPUP_SERVER_READBACK_ERROR] Notice loading canonical settings/popup:', err);
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

  const logPopupStage = (stage: string, payload?: any) => {
    console.log(`[${stage}]`, {
      timestamp: new Date().toISOString(),
      projectId: "laxmi-artworks",
      storageBucket: "laxmi-artworks.firebasestorage.app",
      ...payload
    });
  };

  const logPopupError = (stage: string, error: any, extra?: any) => {
    const code = error?.code || error?.status_ || 'unknown';
    const name = error?.name || 'Error';
    const message = error?.message || String(error);
    console.error(`[${stage}]`, {
      error: {
        code,
        name,
        message,
        serverResponse: error?.serverResponse,
      },
      operation: 'Firebase Storage / Firestore Popup',
      projectId: "laxmi-artworks",
      storageBucket: "laxmi-artworks.firebasestorage.app",
      ...extra
    });
  };

  const mapFirebaseStorageError = (code: string, rawMessage?: string): { title: string; explanation: string; action: string } => {
    switch (code) {
      case 'storage/unauthorized':
        return {
          title: 'Permission Denied (storage/unauthorized)',
          explanation: 'The current user does not have permission to write to this Firebase Storage bucket. Storage security rules require authenticated admin privileges.',
          action: 'Ensure you are signed in with an authorized admin account and check storage.rules.'
        };
      case 'storage/unauthenticated':
        return {
          title: 'Authentication Required (storage/unauthenticated)',
          explanation: 'Firebase Storage request was sent without an active authenticated session.',
          action: 'Log in again via the Admin Sign-in screen.'
        };
      case 'storage/quota-exceeded':
        return {
          title: 'Storage Quota Exceeded (storage/quota-exceeded)',
          explanation: 'The storage quota for this Firebase project has been exceeded.',
          action: 'Review Firebase project billing and storage usage in the Firebase Console.'
        };
      case 'storage/retry-limit-exceeded':
        return {
          title: 'Upload Timed Out (storage/retry-limit-exceeded)',
          explanation: 'The upload operation timed out after exceeding the retry limit. The network connection was interrupted or the storage endpoint did not respond.',
          action: 'Check your network connection, ensure the bucket exists, and click Retry Upload.'
        };
      case 'storage/object-not-found':
        return {
          title: 'Object Not Found (storage/object-not-found)',
          explanation: 'The specified storage object does not exist.',
          action: 'Select a new image and retry the upload.'
        };
      case 'storage/bucket-not-found':
        return {
          title: 'Bucket Not Found (storage/bucket-not-found)',
          explanation: 'The Firebase Storage bucket "laxmi-artworks.firebasestorage.app" does not exist or has not been initialized. Under modern Google Cloud Firebase billing policies, Cloud Storage requires the Blaze (Pay-as-you-go) plan.',
          action: 'Enable Cloud Storage on the Blaze plan or initialize the default storage bucket in the Firebase Console (console.firebase.google.com).'
        };
      case 'storage/project-not-found':
        return {
          title: 'Project Not Found (storage/project-not-found)',
          explanation: 'Firebase project "laxmi-artworks" could not be located.',
          action: 'Verify your Firebase project ID in firebase-blueprint.json.'
        };
      case 'storage/canceled':
        return {
          title: 'Upload Canceled (storage/canceled)',
          explanation: 'The upload was canceled by the user or a replacement file was chosen.',
          action: 'Select a file to start a new upload.'
        };
      case 'storage/unknown':
        return {
          title: 'Storage Unavailable (storage/unknown)',
          explanation: `Firebase Storage service returned an unknown error: ${rawMessage || 'Server unreachable'}. This typically indicates that Cloud Storage is not provisioned or requires the Blaze plan for this project.`,
          action: 'Verify Firebase Storage bucket initialization in Firebase Console.'
        };
      default:
        return {
          title: `Upload Error (${code || 'storage/error'})`,
          explanation: rawMessage || 'An unexpected error occurred during storage upload.',
          action: 'Inspect browser console diagnostics and retry.'
        };
    }
  };

  const uploadNewImage = async (file: File): Promise<string> => {
    // Unique Storage Path to eliminate CDN and browser caching issues
    const timestamp = Date.now();
    const randomId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `popup-images/popup-${timestamp}-${randomId}-${sanitizedName}`;

    // Section 7: Log SAFE diagnostics (UID, email, storage bucket, storage path)
    console.log('[POPUP_AUTH_DIAGNOSTICS]', {
      currentUserUid: auth.currentUser?.uid || 'anonymous',
      currentUserEmail: auth.currentUser?.email || 'unauthenticated',
      storageBucket: storage.app.options.storageBucket || "laxmi-artworks.firebasestorage.app",
      storagePath
    });

    logPopupStage('POPUP_UPLOAD_STARTED', {
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    const storageRef = ref(storage, storagePath);
    const metadata = {
      contentType: file.type,
      customMetadata: {
        uploadedBy: auth.currentUser?.email || user?.email || 'admin',
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    };

    const uploadTask = uploadBytesResumable(storageRef, file, metadata);
    activeUploadTaskRef.current = uploadTask;

    await new Promise<void>((resolve, reject) => {
      // 25-second timeout safety
      const uploadTimeout = setTimeout(() => {
        try { uploadTask.cancel(); } catch (_) {}
        const timeoutErr: any = new Error('Firebase Storage upload timed out after 25 seconds.');
        timeoutErr.code = 'storage/retry-limit-exceeded';
        reject(timeoutErr);
      }, 25000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const transferred = snapshot.bytesTransferred;
          const total = snapshot.totalBytes;
          const progress = total > 0 ? (transferred / total) * 100 : 0;
          setBytesTransferred(transferred);
          setTotalBytes(total);
          setUploadProgress(Math.round(progress));
          logPopupStage('POPUP_UPLOAD_PROGRESS', { transferred, total, percent: Math.round(progress) });
        },
        (error) => {
          clearTimeout(uploadTimeout);
          activeUploadTaskRef.current = null;
          reject(error);
        },
        () => {
          clearTimeout(uploadTimeout);
          activeUploadTaskRef.current = null;
          resolve();
        }
      );
    });

    logPopupStage('POPUP_UPLOAD_SUCCESS', { storagePath });
    logPopupStage('POPUP_DOWNLOAD_URL_STARTED', { storagePath });

    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
    if (!downloadUrl) {
      throw new Error("Upload completed without receiving a download URL");
    }
    logPopupStage('POPUP_DOWNLOAD_URL_SUCCESS', { downloadUrl });
    return downloadUrl;
  };

  const startUploadFlow = async (file: File) => {
    setUploadStateMachine('UPLOADING');
    setUploadProgress(0);
    setBytesTransferred(0);
    setTotalBytes(file.size);
    setUploadError(null);
    setUploadErrorCode(null);
    setUploadErrorDetails(null);
    setPopupSaveFeedback(null);

    try {
      const downloadUrl = await uploadNewImage(file);
      setUploadProgress(100);
      setPendingPopupImageUrl(downloadUrl);
      setUploadStateMachine('UPLOAD_SUCCESS');
      // Transition immediately to READY_TO_SAVE
      setTimeout(() => {
        setUploadStateMachine('READY_TO_SAVE');
      }, 250);
    } catch (err: any) {
      logPopupError('POPUP_UPLOAD_ERROR', err, {});
      setUploadStateMachine('UPLOAD_FAILED');
      const code = err?.code || 'storage/unknown';
      const msg = err?.message || String(err);
      setUploadErrorCode(code);
      const details = mapFirebaseStorageError(code, msg);
      setUploadError(details.explanation);
      setUploadErrorDetails(details);
      // NEVER FALL BACK TO OLD IMAGE: hasPendingNewImage remains true, pendingPopupImageUrl remains null.
    }
  };

  const handlePopupImageFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Transition to FILE_SELECTED
    setUploadStateMachine('FILE_SELECTED');
    setHasPendingNewImage(true);
    setPendingPopupImageUrl(null);
    setFinalSaveUrl(null);
    setFirestoreServerUrl(null);
    setUrlMatch('N/A');
    setUploadError(null);
    setUploadErrorCode(null);
    setUploadErrorDetails(null);
    setPopupSaveFeedback(null);

    logPopupStage('POPUP_FILE_SELECTED', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Transition to VALIDATING
    setUploadStateMachine('VALIDATING');

    // 1. Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadStateMachine('UPLOAD_FAILED');
      setUploadErrorCode('storage/invalid-argument');
      const details = {
        title: 'Invalid File Format',
        explanation: 'The selected file is not an image. Please select a valid image format (JPG, PNG, WebP).',
        action: 'Select a valid image file.'
      };
      setUploadError(details.explanation);
      setUploadErrorDetails(details);
      return;
    }

    // 2. Validate file size (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      setUploadStateMachine('UPLOAD_FAILED');
      setUploadErrorCode('storage/quota-exceeded');
      const details = {
        title: 'File Too Large',
        explanation: 'The selected image is larger than 15MB. Please choose an image under 15MB.',
        action: 'Compress or resize the image before uploading.'
      };
      setUploadError(details.explanation);
      setUploadErrorDetails(details);
      return;
    }

    // 3. Create local preview URL for instant visual feedback
    if (previewObjectUrl) {
      try { URL.revokeObjectURL(previewObjectUrl); } catch (_) {}
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewObjectUrl(objectUrl);
    setSelectedFile(file);

    // 4. Initiate upload
    startUploadFlow(file);
    if (e.target) e.target.value = '';
  };

  const getActiveDisplayImageUrl = () => {
    if (hasPendingNewImage) {
      return pendingPopupImageUrl || previewObjectUrl || null;
    }
    return directImageUrlInput.trim() || savedPopupImageUrl || null;
  };

  const executeSavePopup = async (targetImageUrlOverride?: string) => {
    const isNewFileFlow = Boolean(hasPendingNewImage || selectedFile);

    // 1. Strict guard: If a new file was selected, it MUST have a fresh uploaded URL before saving can proceed
    if (isNewFileFlow) {
      const freshUploadedUrl = targetImageUrlOverride || pendingPopupImageUrl;
      if (!freshUploadedUrl) {
        setUploadStateMachine('ERROR');
        setPopupSaveFeedback({
          type: 'error',
          message: '❌ A new image was selected, but its Firebase Storage upload has not completed. Cannot save until upload finishes. Fallback to previous image is strictly prohibited.'
        });
        return;
      }
      if (freshUploadedUrl === savedPopupImageUrl || freshUploadedUrl.includes('images.unsplash.com')) {
        setUploadStateMachine('ERROR');
        setPopupSaveFeedback({
          type: 'error',
          message: '❌ Cannot save: A new file was selected, but the upload returned the old saved image URL. A fresh download URL is required.'
        });
        return;
      }
    }

    // Determine finalImageUrl with strict priority — NEVER fall back to old Unsplash URL when a new file was selected
    let finalImageUrl = '';
    if (isNewFileFlow) {
      finalImageUrl = (targetImageUrlOverride || pendingPopupImageUrl)!;
    } else if (directImageUrlInput.trim() && directImageUrlInput.trim() !== savedPopupImageUrl) {
      finalImageUrl = directImageUrlInput.trim();
    } else {
      finalImageUrl = savedPopupImageUrl;
    }

    // Double safeguard: If a new file was selected, finalImageUrl must strictly be the new uploaded image
    if (isNewFileFlow && (!finalImageUrl || finalImageUrl === savedPopupImageUrl || finalImageUrl.includes('images.unsplash.com'))) {
      setUploadStateMachine('ERROR');
      setPopupSaveFeedback({
        type: 'error',
        message: '❌ Data flow error: A new file was selected, but finalImageUrl fell back to the previous saved URL. Save aborted.'
      });
      return;
    }

    // 2. Validate popup enabled without image
    if (popupEnabled && !finalImageUrl) {
      setUploadStateMachine('ERROR');
      setPopupSaveFeedback({
        type: 'error',
        message: '❌ Please upload an image or provide an Image URL before enabling the popup.'
      });
      return;
    }

    // Section 11: Log POPUP_SAVE_INPUT
    console.log('[POPUP_SAVE_INPUT]', {
      hasPendingNewImage,
      pendingPopupImageUrl: targetImageUrlOverride || pendingPopupImageUrl,
      savedPopupImageUrl,
      finalImageUrl
    });

    setFinalSaveUrl(finalImageUrl);
    setUrlMatch('PENDING');
    setUploadStateMachine('SAVING');
    setSavingPopup(true);
    setPopupSaveFeedback(null);
    setShowSaveConfirmModal(false);

    logPopupStage('POPUP_SAVE_STARTED', {
      enabled: popupEnabled,
      frequency: popupFrequency,
      finalImageUrl
    });

    const now = Date.now();
    const popupPayload = {
      enabled: Boolean(popupEnabled),
      frequency: popupFrequency || 'session',
      imageUrl: finalImageUrl,
      popupImage: finalImageUrl,
      directImageUrl: hasPendingNewImage ? '' : (directImageUrlInput.trim() || finalImageUrl),
      updatedAt: now,
      updatedBy: auth.currentUser?.email || user?.email || 'admin'
    };

    try {
      logPopupStage('POPUP_FIRESTORE_WRITE_STARTED', { doc: 'settings/popup', finalImageUrl });

      try {
        await setDoc(doc(db, 'settings', 'popup'), popupPayload, { merge: true });
        await setDoc(doc(db, 'settings', 'site_config'), {
          popupEnabled: popupPayload.enabled,
          popupFrequency: popupPayload.frequency,
          popupImage: popupPayload.imageUrl,
          imageUrl: popupPayload.imageUrl,
          updatedAt: now
        }, { merge: true });
        logPopupStage('POPUP_FIRESTORE_WRITE_SUCCESS');
      } catch (clientWriteErr: any) {
        logPopupError('POPUP_FIRESTORE_WRITE_ERROR', clientWriteErr, { fallback: 'server-api' });
        const res = await fetch('/api/admin/save-popup-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...popupPayload,
            userEmail: auth.currentUser?.email || user?.email || 'admin'
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || clientWriteErr.message || 'Write failed');
        }
      }

      // Section 13: FIRESTORE SERVER READ-BACK VERIFICATION
      setUploadStateMachine('VERIFYING');
      logPopupStage('POPUP_SERVER_READBACK_STARTED', { doc: 'settings/popup' });

      const serverSnapshot = await getDocFromServer(doc(db, 'settings', 'popup'));
      if (!serverSnapshot.exists()) {
        throw new Error("Firestore verification failed: Configuration could not be verified from Firestore server (document not found).");
      }

      const serverData = serverSnapshot.data();
      const serverImageUrl = serverData?.imageUrl || serverData?.popupImage || '';
      setFirestoreServerUrl(serverImageUrl);

      console.log('[POPUP_SERVER_READBACK_VERIFY]', {
        serverImageUrl,
        finalImageUrl,
        match: serverImageUrl === finalImageUrl
      });

      if (serverImageUrl !== finalImageUrl) {
        setUrlMatch('NO');
        setUploadStateMachine('ERROR');
        throw new Error(`Firestore verification failed: saved image URL does not match uploaded image URL. (Server: "${serverImageUrl}", Expected: "${finalImageUrl}")`);
      }

      setUrlMatch('YES');
      setUploadStateMachine('SUCCESS');
      const wasNewFile = isNewFileFlow;
      setSavedPopupImageUrl(finalImageUrl);
      setHasPendingNewImage(false);
      setPendingPopupImageUrl(null);
      if (wasNewFile) {
        setDirectImageUrlInput(finalImageUrl);
      }
      if (previewObjectUrl) {
        try { URL.revokeObjectURL(previewObjectUrl); } catch (_) {}
        setPreviewObjectUrl(null);
      }
      setSelectedFile(null);

      setLocalSiteConfig(prev => ({
        ...prev,
        popupEnabled: popupPayload.enabled,
        popupFrequency: popupPayload.frequency,
        popupImage: finalImageUrl,
        imageUrl: finalImageUrl
      }));

      setPopupSaveFeedback({
        type: 'success',
        message: 'SUCCESS — NEW IMAGE SAVED AND VERIFIED! Global Popup configuration successfully verified by server.'
      });
      setTimeout(() => setPopupSaveFeedback(null), 8000);
    } catch (saveErr: any) {
      logPopupError('POPUP_SAVE_ERROR', saveErr, { finalImageUrl });
      setUploadStateMachine('ERROR');
      setPopupSaveFeedback({
        type: 'error',
        message: `❌ ${saveErr.message || 'Failed to save popup configuration.'}`
      });
    } finally {
      setSavingPopup(false);
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
          <motion.div initial={{opacity:0, y: 10}} animate={{opacity:1, y:0}} className="space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold">Popup Manager</h2>
                <p className="text-sm text-neutral-400">Configure the global image popup for website visitors.</p>
              </div>
            </div>
            
            <div className="bg-neutral-900 p-6 rounded-3xl border border-white/10 space-y-6">
              {/* Top Toggle: Enable / Disable Popup */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h3 className="font-bold text-white">Enable Popup</h3>
                  <p className="text-xs text-neutral-400">Turn the announcement popup on or off globally for all visitors.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={popupEnabled} 
                    onChange={e => {
                      setPopupEnabled(e.target.checked);
                      setLocalSiteConfig(prev => ({ ...prev, popupEnabled: e.target.checked }));
                    }} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Form Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-neutral-400 mb-1 block font-semibold uppercase tracking-wider">Popup Display Frequency</label>
                    <select 
                      value={popupFrequency} 
                      onChange={e => {
                        const val = e.target.value as 'session' | 'always' | 'daily' | 'once';
                        setPopupFrequency(val);
                        setLocalSiteConfig(prev => ({ ...prev, popupFrequency: val }));
                      }}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                    >
                      <option value="session">Once Per Session (Recommended)</option>
                      <option value="always">Every Visit (Always)</option>
                      <option value="daily">Once Per Day</option>
                      <option value="once">Only One Time Ever</option>
                    </select>
                    <p className="text-[11px] text-neutral-500 mt-1.5">
                      Controls how often an eligible visitor sees the announcement popup on your site.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-neutral-400 mb-1 block font-semibold uppercase tracking-wider">Direct Image URL (Optional / Fallback)</label>
                    <input 
                      type="url"
                      value={directImageUrlInput}
                      onChange={e => {
                        const val = e.target.value;
                        setDirectImageUrlInput(val);
                        if (!hasPendingNewImage) {
                          setPendingPopupImageUrl(null);
                        }
                      }}
                      placeholder="https://example.com/announcement.jpg"
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-amber-500 outline-none font-mono"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1.5">
                      {hasPendingNewImage 
                        ? 'Notice: A new file is currently selected. The uploaded file takes precedence over direct URLs.' 
                        : 'You can paste an external image URL directly or upload an image file on the right.'}
                    </p>
                  </div>
                </div>

                {/* Image Upload & Display Card */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-neutral-400 block font-semibold uppercase tracking-wider">Popup Image</label>
                      <div className="flex items-center gap-2">
                        {hasPendingNewImage && (
                          <button
                            type="button"
                            onClick={() => {
                              if (previewObjectUrl) {
                                try { URL.revokeObjectURL(previewObjectUrl); } catch (_) {}
                              }
                              setPreviewObjectUrl(null);
                              setPendingPopupImageUrl(null);
                              setHasPendingNewImage(false);
                              setSelectedFile(null);
                              setUploadStateMachine('NO_NEW_FILE');
                              setUploadProgress(0);
                              setUploadError(null);
                              setUploadErrorCode(null);
                              setUploadErrorDetails(null);
                            }}
                            className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 font-semibold"
                          >
                            Cancel New File
                          </button>
                        )}
                        {getActiveDisplayImageUrl() && (
                          <button 
                            type="button"
                            onClick={() => {
                              if (previewObjectUrl) {
                                try { URL.revokeObjectURL(previewObjectUrl); } catch (_) {}
                              }
                              setPreviewObjectUrl(null);
                              setPendingPopupImageUrl(null);
                              setHasPendingNewImage(false);
                              setDirectImageUrlInput('');
                              setSavedPopupImageUrl('');
                              setSelectedFile(null);
                              setUploadStateMachine('NO_NEW_FILE');
                              setUploadProgress(0);
                              setUploadError(null);
                              setUploadErrorCode(null);
                              setUploadErrorDetails(null);
                              setLocalSiteConfig(prev => ({ ...prev, popupImage: '', imageUrl: '' }));
                            }} 
                            className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                          >
                            <Trash2 size={12} /> Remove Image
                          </button>
                        )}
                      </div>
                    </div>

                    {getActiveDisplayImageUrl() ? (
                      <div className="relative w-full h-56 bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-2 group">
                        <img 
                          src={getActiveDisplayImageUrl()!} 
                          alt="Popup Preview" 
                          className="max-w-full max-h-full object-contain rounded-lg" 
                        />
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-3 py-1.5 bg-black/80 backdrop-blur-md rounded-lg text-[11px] text-neutral-300">
                          <span className="truncate">
                            {hasPendingNewImage 
                              ? (pendingPopupImageUrl 
                                  ? 'New image uploaded ✓ Ready to save' 
                                  : previewObjectUrl 
                                    ? (uploadStateMachine === 'UPLOAD_FAILED' ? 'Upload failed — Not yet saved' : 'New file selected (Local preview)')
                                    : 'Pending new upload')
                              : (savedPopupImageUrl ? 'Saved in Firestore' : 'Direct URL configured')}
                          </span>
                          <label className="text-amber-400 hover:text-amber-300 cursor-pointer font-semibold shrink-0 ml-2">
                            Replace
                            <input 
                              ref={popupFileInputRef}
                              type="file" 
                              accept="image/*" 
                              onChange={handlePopupImageFileSelection} 
                              disabled={uploadStateMachine === 'UPLOADING' || savingPopup}
                              className="hidden" 
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-56 bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-neutral-500 relative flex items-center justify-center hover:border-amber-500/50 transition-colors border-dashed">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handlePopupImageFileSelection} 
                          disabled={uploadStateMachine === 'UPLOADING' || savingPopup} 
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                        />
                        <div className="flex flex-col items-center gap-2 pointer-events-none text-center px-4">
                          <ImageIcon size={28} className="text-neutral-500" />
                          <span className="text-xs font-semibold text-neutral-300">
                            Click or drag an image here to upload
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            Supports PNG, JPG, WebP up to 15MB
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Real-time Progress Bar & Status Details */}
              <div className="rounded-xl bg-black/50 border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-300">Upload Status:</span>
                  <span className={`font-mono font-bold ${
                    uploadStateMachine === 'UPLOADING' ? 'text-amber-400' :
                    uploadStateMachine === 'READY_TO_SAVE' || uploadStateMachine === 'UPLOAD_SUCCESS' ? 'text-green-400' :
                    uploadStateMachine === 'UPLOAD_FAILED' || uploadStateMachine === 'ERROR' ? 'text-red-400' :
                    uploadStateMachine === 'SAVING' || uploadStateMachine === 'VERIFYING' ? 'text-cyan-400' :
                    uploadStateMachine === 'SUCCESS' ? 'text-emerald-400' : 'text-neutral-400'
                  }`}>
                    {uploadStateMachine === 'NO_NEW_FILE' && 'Idle (No new file)'}
                    {uploadStateMachine === 'FILE_SELECTED' && 'File selected'}
                    {uploadStateMachine === 'VALIDATING' && 'Validating image...'}
                    {uploadStateMachine === 'UPLOADING' && `Uploading to Firebase Storage (${uploadProgress}%)`}
                    {uploadStateMachine === 'UPLOAD_SUCCESS' && 'Upload complete ✓'}
                    {uploadStateMachine === 'READY_TO_SAVE' && 'New image uploaded ✓ Ready to save'}
                    {uploadStateMachine === 'SAVING' && 'Saving to Firestore...'}
                    {uploadStateMachine === 'VERIFYING' && 'Verifying with server...'}
                    {uploadStateMachine === 'SUCCESS' && 'Verified by server ✓'}
                    {uploadStateMachine === 'UPLOAD_FAILED' && 'Upload failed ✕'}
                    {uploadStateMachine === 'ERROR' && 'Save/Verification error ✕'}
                  </span>
                </div>

                {uploadStateMachine === 'UPLOADING' && (
                  <div className="space-y-1.5">
                    <div className="w-full bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-200 ease-out" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
                      <span>Uploading to Firebase Storage</span>
                      <span>
                        {uploadProgress}% • {(bytesTransferred / (1024 * 1024)).toFixed(2)} MB / {(totalBytes / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                )}

                {(uploadStateMachine === 'READY_TO_SAVE' || uploadStateMachine === 'UPLOAD_SUCCESS') && (
                  <div className="text-xs text-green-400 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>Upload complete ✓ Ready to save. Click <strong>Save Popup Config</strong> below to publish to the site.</span>
                  </div>
                )}

                {uploadStateMachine === 'UPLOAD_FAILED' && (
                  <div className="space-y-3 bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-xs text-red-300">
                    <div className="flex items-start gap-2.5">
                      <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-2 flex-1">
                        <div className="font-bold text-sm text-red-400">
                          Firebase Storage Upload Failed
                        </div>
                        {uploadErrorCode && (
                          <div className="bg-black/40 px-2.5 py-1.5 rounded-lg border border-red-500/20 font-mono text-[11px] text-red-300">
                            <strong className="text-red-400">Error Code:</strong> {uploadErrorCode}
                          </div>
                        )}
                        <div className="bg-black/40 px-2.5 py-1.5 rounded-lg border border-red-500/20 font-mono text-[11px] text-red-200">
                          <strong className="text-red-400">Error Message:</strong> {uploadError || 'Storage request failed.'}
                        </div>
                        {uploadErrorDetails && (
                          <div className="space-y-1 text-[11px] text-red-300/90 leading-relaxed border-t border-red-500/15 pt-2">
                            <div><strong className="text-red-400">Explanation:</strong> {uploadErrorDetails.explanation}</div>
                            <div><strong className="text-red-400">Action Required:</strong> {uploadErrorDetails.action}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-red-500/15 flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400 italic">Save is blocked while an upload is failed.</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (previewObjectUrl) {
                              try { URL.revokeObjectURL(previewObjectUrl); } catch (_) {}
                            }
                            setPreviewObjectUrl(null);
                            setPendingPopupImageUrl(null);
                            setHasPendingNewImage(false);
                            setSelectedFile(null);
                            setUploadStateMachine('NO_NEW_FILE');
                            setUploadProgress(0);
                            setUploadError(null);
                            setUploadErrorCode(null);
                            setUploadErrorDetails(null);
                          }}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Cancel New File
                        </button>
                        {selectedFile && (
                          <button
                            type="button"
                            onClick={() => startUploadFlow(selectedFile)}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <RefreshCw size={12} /> Retry Upload
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 18: Diagnostics and Technical Information */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Pipeline Diagnostics</span>
                    <span className="font-mono text-[10px] text-neutral-500">laxmi-artworks.firebasestorage.app</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5 truncate">
                      <span className="text-neutral-500 block text-[10px] uppercase font-sans font-semibold">CURRENT SAVED IMAGE:</span>
                      <span className="text-neutral-300" title={savedPopupImageUrl || 'None'}>
                        {savedPopupImageUrl ? (savedPopupImageUrl.startsWith('data:') ? 'Embedded image data' : savedPopupImageUrl.slice(0, 36) + '...') : '(None)'}
                      </span>
                    </div>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5 truncate">
                      <span className="text-neutral-500 block text-[10px] uppercase font-sans font-semibold">PENDING IMAGE:</span>
                      <span className={pendingPopupImageUrl ? 'text-green-400 font-bold' : 'text-neutral-400'} title={pendingPopupImageUrl || 'None'}>
                        {pendingPopupImageUrl ? pendingPopupImageUrl.slice(0, 36) + '...' : '(None)'}
                      </span>
                    </div>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5">
                      <span className="text-neutral-500 block text-[10px] uppercase font-sans font-semibold">NEW FILE SELECTED:</span>
                      <span className={hasPendingNewImage ? 'text-amber-400 font-bold' : 'text-neutral-400'}>
                        {hasPendingNewImage ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5">
                      <span className="text-neutral-500 block text-[10px] uppercase font-sans font-semibold">UPLOAD STATUS:</span>
                      <span className={`font-bold ${
                        uploadStateMachine === 'UPLOADING' ? 'text-amber-400' :
                        uploadStateMachine === 'READY_TO_SAVE' || uploadStateMachine === 'UPLOAD_SUCCESS' ? 'text-green-400' :
                        uploadStateMachine === 'UPLOAD_FAILED' || uploadStateMachine === 'ERROR' ? 'text-red-400' :
                        uploadStateMachine === 'SAVING' || uploadStateMachine === 'VERIFYING' ? 'text-cyan-400' :
                        uploadStateMachine === 'SUCCESS' ? 'text-emerald-400' : 'text-neutral-400'
                      }`}>
                        {uploadStateMachine}
                      </span>
                    </div>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5">
                      <span className="text-neutral-500 block text-[10px] uppercase font-sans font-semibold">UPLOAD PROGRESS:</span>
                      <span className="text-neutral-300">{uploadProgress}%</span>
                    </div>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5">
                      <span className="text-neutral-500 block text-[10px] uppercase font-sans font-semibold">STORAGE PLAN:</span>
                      <span className="text-neutral-300 font-mono">
                        {uploadErrorCode === 'storage/bucket-not-found' ? 'Blaze Required (Bucket Missing)' : 'Standard'}
                      </span>
                    </div>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5 truncate">
                      <span className="text-neutral-500 block text-[10px] uppercase font-sans font-semibold">FINAL SAVE URL:</span>
                      <span className="text-neutral-300" title={finalSaveUrl || 'Not yet saved'}>
                        {finalSaveUrl ? (finalSaveUrl.startsWith('data:') ? 'Embedded image data' : finalSaveUrl.slice(0, 36) + '...') : '(Not yet saved)'}
                      </span>
                    </div>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5 truncate">
                      <span className="text-neutral-500 block text-[10px] uppercase font-sans font-semibold">FIRESTORE SERVER URL:</span>
                      <span className="text-neutral-300" title={firestoreServerUrl || 'Not yet verified'}>
                        {firestoreServerUrl ? (firestoreServerUrl.startsWith('data:') ? 'Embedded image data' : firestoreServerUrl.slice(0, 36) + '...') : '(Not yet verified)'}
                      </span>
                    </div>
                    <div className="bg-black/60 p-2.5 rounded-lg border border-white/5 sm:col-span-2 flex items-center justify-between">
                      <span className="text-neutral-500 text-[10px] uppercase font-sans font-semibold">URL MATCH:</span>
                      <span className={`font-bold text-xs ${
                        urlMatch === 'YES' ? 'text-green-400' :
                        urlMatch === 'NO' ? 'text-red-400' : 'text-neutral-400'
                      }`}>
                        {urlMatch}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {hasPendingNewImage && !pendingPopupImageUrl && (
                <div className="p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 text-amber-300">
                  <AlertCircle size={16} className="shrink-0 text-amber-400" />
                  <span>New image has not finished uploading. Please wait or retry.</span>
                </div>
              )}

              {popupSaveFeedback && (
                <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                  popupSaveFeedback.type === 'success' 
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {popupSaveFeedback.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
                  <span>{popupSaveFeedback.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-white/5 flex flex-wrap items-center gap-4">
                <button 
                  type="button"
                  onClick={() => setShowSaveConfirmModal(true)} 
                  disabled={uploadStateMachine === 'UPLOADING' || uploadStateMachine === 'VALIDATING' || (hasPendingNewImage && !pendingPopupImageUrl) || savingPopup}
                  className="bg-amber-500 text-black font-bold py-3 px-6 rounded-xl hover:bg-amber-400 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadStateMachine === 'UPLOADING' ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>Uploading image... {uploadProgress}%</span>
                    </>
                  ) : savingPopup ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>Saving & Verifying...</span>
                    </>
                  ) : (uploadStateMachine === 'READY_TO_SAVE' || uploadStateMachine === 'UPLOAD_SUCCESS') ? (
                    <>
                      <Save size={16} />
                      <span>Save & Publish New Image</span>
                    </>
                  ) : (hasPendingNewImage && !pendingPopupImageUrl) ? (
                    <>
                      <Save size={16} />
                      <span>Upload Incomplete — Save Blocked</span>
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
                <div className="relative max-w-md md:max-w-xl w-full flex flex-col items-center justify-center rounded-3xl overflow-hidden shadow-2xl">
                  <button onClick={() => setShowPopupPreview(false)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-md">
                    <X size={20} />
                  </button>
                  {getActiveDisplayImageUrl() ? (
                    <img 
                      src={getActiveDisplayImageUrl()!} 
                      alt="Announcement Preview" 
                      className="w-full object-contain max-h-[85vh] bg-black" 
                    />
                  ) : (
                    <div className="w-full h-64 bg-neutral-900 flex items-center justify-center text-neutral-500">No image configured</div>
                  )}
                </div>
              </div>,
              document.body
            )}

            {/* Save Popup Confirmation Modal */}
            {showSaveConfirmModal && typeof document !== 'undefined' && createPortal(
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="relative max-w-md w-full bg-neutral-900 border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Save size={18} className="text-amber-500" /> Confirm Popup Configuration
                    </h3>
                    <button 
                      onClick={() => setShowSaveConfirmModal(false)}
                      disabled={savingPopup}
                      className="text-neutral-400 hover:text-white transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs text-neutral-300">
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-neutral-400">Popup Status:</span>
                      <span className={`font-bold ${popupEnabled ? 'text-green-400' : 'text-neutral-400'}`}>
                        {popupEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-neutral-400">Frequency:</span>
                      <span className="font-bold text-white capitalize">
                        {popupFrequency === 'session' ? 'Once Per Session' :
                         popupFrequency === 'always' ? 'Every Visit' :
                         popupFrequency === 'daily' ? 'Once Per Day' : 'Only One Time Ever'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block mb-1.5">Target Image:</span>
                      {getActiveDisplayImageUrl() ? (
                        <div className="w-full h-36 bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-2">
                          <img 
                            src={getActiveDisplayImageUrl()!} 
                            alt="Target Popup" 
                            className="max-w-full max-h-full object-contain rounded-lg" 
                          />
                        </div>
                      ) : (
                        <span className="text-amber-400 italic">No image configured (Popup cannot be enabled without an image)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSaveConfirmModal(false)}
                      disabled={savingPopup}
                      className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-semibold text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => executeSavePopup()}
                      disabled={savingPopup || (Boolean(hasPendingNewImage || selectedFile) && !pendingPopupImageUrl) || (popupEnabled && !getActiveDisplayImageUrl())}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {savingPopup ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      {savingPopup ? 'Publishing & Verifying...' : 'Confirm & Publish'}
                    </button>
                  </div>
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
                    <div><span className="text-neutral-500 block mb-1">Subject:</span> {selectedOrder.subject}</div>
                    <div><span className="text-neutral-500 block mb-1">Size:</span> {selectedOrder.size}</div>
                    <div><span className="text-neutral-500 block mb-1">Medium:</span> {selectedOrder.medium}</div>
                    <div><span className="text-neutral-500 block mb-1">Framing:</span> {selectedOrder.framing}</div>
                  </div>
                </div>

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
                  <div className="flex flex-col sm:flex-row justify-between pt-4 border-t border-white/5 gap-3">
                    <div className="flex gap-3">
                      <button onClick={() => generateInvoice(selectedOrder, 'download')} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-amber-500 text-black hover:bg-amber-400">
                        <Download size={16} /> Generate Invoice
                      </button>
                      <button onClick={async (e) => {
                        const btn = e.currentTarget;
                        btn.disabled = true;
                        try {
                          if (!selectedOrder.email) {
                             throw new Error("Customer email missing");
                          }
                          setSaveSuccessMessage("Preparing invoice...");
                          await new Promise(r => setTimeout(r, 600));
                          
                          setSaveSuccessMessage("Generating PDF...");
                          const pdfBase64 = await generateInvoice(selectedOrder, 'base64');
                          await new Promise(r => setTimeout(r, 600));
                          
                          setSaveSuccessMessage(`Sending invoice to ${selectedOrder.email}...`);
                          
                          const controller = new AbortController();
                          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
                          
                          const res = await fetch('/api/send-invoice', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: selectedOrder.email, order: selectedOrder, pdfBase64 }),
                            signal: controller.signal
                          });
                          clearTimeout(timeoutId);
                          
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok || !data.success) {
                            throw new Error(data.error || 'Failed to send invoice. Check email credentials.');
                          }
                          
                          setSaveSuccessMessage("✅ Invoice sent successfully");
                          setTimeout(() => setSaveSuccessMessage(''), 5000);
                        } catch (err: any) {
                          const isAbort = err.name === 'AbortError' || err.message.includes('abort');
                          setSaveSuccessMessage("❌ " + (isAbort ? "Connection timed out" : err.message));
                          setTimeout(() => setSaveSuccessMessage(''), 7000);
                        } finally {
                          btn.disabled = false;
                        }
                      }} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-neutral-800 text-amber-500 border border-amber-500/30 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed">
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
        </AnimatePresence>,
        document.body
      )}
                
      <AnimatePresence>
        {saveSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-[200] bg-neutral-900 border border-white/10 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3"
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
    </div>
  );
}
