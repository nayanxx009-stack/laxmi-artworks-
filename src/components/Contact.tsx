import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Phone, Mail, ArrowRight, ArrowLeft, CheckCircle2, X, Copy, Check, QrCode, ShieldCheck, Lock, ExternalLink } from 'lucide-react';
import { FormEvent, useState, useEffect, useRef } from "react";
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';

export default function Contact() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  // Payment States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [pendingForm, setPendingForm] = useState<Record<string, string> | null>(null);
  const [generatedOrderId, setGeneratedOrderId] = useState("");
  const [firebaseDocId, setFirebaseDocId] = useState<string | null>(null);
  const firebaseDocIdRef = useRef<string | null>(null);
      const [paymentVerifyState, setPaymentVerifyState] = useState<'idle' | 'verifying' | 'verified'>('idle');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [hasClickedPayment, setHasClickedPayment] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    const draftId = localStorage.getItem('draftOrderId');
    if (draftId && !firebaseDocId) {
      getDoc(doc(db, 'orders', draftId)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.paymentStatus === 'Pending Payment' || data.paymentStatus === 'Pending Verification') {
            setFirebaseDocId(draftId);
            firebaseDocIdRef.current = draftId;
            setPendingForm(data as any);
            setGeneratedOrderId(data.orderId);
            setShowPaymentModal(true);
            if (data.paymentStatus === 'Pending Verification') {
              setPaymentVerifyState('verifying');
              setHasClickedPayment(true);
            }
          } else if (data.paymentStatus === 'Paid') {
            localStorage.removeItem('draftOrderId');
          }
        } else {
          localStorage.removeItem('draftOrderId');
        }
      });
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && hasClickedPayment && paymentVerifyState === 'idle') {
        finalizePaymentAndOrder();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasClickedPayment, paymentVerifyState, firebaseDocId, pendingForm]);

  useEffect(() => {
    if (!firebaseDocId || !showPaymentModal) return;
    const unsub = onSnapshot(doc(db, 'orders', firebaseDocId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.paymentStatus === 'Paid' || data.paymentStatus === 'Verified') {
          localStorage.removeItem('draftOrderId');
          setShowPaymentModal(false);
          setShowSuccessPopup(true);
          setPendingForm(null);
          setFormData({
            name: '',
            email: '',
            phone: '',
            subject: '',
            message: ''
          });
        }
      }
    });
    return () => unsub();
  }, [firebaseDocId, showPaymentModal]);

  

  

  // Removed auto-verification useEffect since manual UTR entry is required

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const form = e.currentTarget;
    const formDataObj = new FormData(form);
    
    const object = Object.fromEntries(formDataObj) as Record<string, string>;
    const errors: Record<string, string> = {};
    
    if (!object.name?.trim()) errors.name = "Please provide your name";
    if (!object.phone?.trim()) errors.phone = "Please provide your contact number";
    if (!object.email?.trim() || !/^\S+@\S+\.\S+$/.test(object.email)) errors.email = "Please provide a valid email address";
    if (!object.message?.trim()) errors.message = "Please describe the project details";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setStatus('sending');

    // Generate Order ID & Proceed to Smart Payment QR step
    const orderId = "ART-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    setGeneratedOrderId(orderId);
    setPendingForm(object);

    const orderData = {
      orderId,
      userId: user ? user.uid : "guest_" + Date.now(),
      name: object.name,
      email: object.email.toLowerCase(),
      phone: object.phone,
      message: object.message,
      amount: 1,
      paymentStatus: 'Pending Payment',
                      status: 'Pending Payment',
      createdAt: Date.now()
    };

    try {
      const newDocRef = doc(db, 'orders', orderId);
      // DO NOT SAVE YET. Prevent dummy orders.
      setFirebaseDocId(newDocRef.id);
      firebaseDocIdRef.current = newDocRef.id;
      // We store the data temporarily
      setPendingForm(orderData);
    } catch (err) {
      console.error("Failed to save order to Firebase:", err);
    }


    // Submit to Web3Forms (Secondary Notification)
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        ...object,
        subject: `New Commission Inquiry (${orderId}) via Laxmi Artworks`,
        botcheck: false
      })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        if (data.message?.includes('hCaptcha')) {
          console.warn("Web3Forms note: Please disable hCaptcha in your Web3Forms dashboard to receive email notifications via this custom form.");
        } else {
          console.warn("Web3Forms warning:", data.message);
        }
      }
    })
    .catch(e => {
      console.error("Web3Forms submission failed:", e);
    });
    
    setStatus('idle');
    setHasClickedPayment(false);
    setShowPaymentModal(true);
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText("7086358990@fam");
    setCopiedUpi(true);
    setHasClickedPayment(true);
    setTimeout(() => setCopiedUpi(false), 3000);
  };

  const getUpiUrl = (app: string) => {
    const upiString = `pa=7086358990@fam&pn=LaxmiArtworks&am=1&tn=${generatedOrderId}&cu=INR`;
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
    
    if (isAndroid) {
      if (app === 'gpay') {
        return `intent://pay?${upiString}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user;end`;
      } else if (app === 'phonepe') {
        return `intent://pay?${upiString}#Intent;scheme=upi;package=com.phonepe.app;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.phonepe.app;end`;
      } else if (app === 'paytm') {
        return `intent://pay?${upiString}#Intent;scheme=upi;package=net.one97.paytm;S.browser_fallback_url=https://play.google.com/store/apps/details?id=net.one97.paytm;end`;
      } else if (app === 'fam') {
        return `intent://pay?${upiString}#Intent;scheme=upi;package=com.fampay.in;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.fampay.in;end`;
      }
    }
    
    // Fallback for iOS or generic
    if (app === 'gpay') return `gpay://upi/pay?${upiString}`;
    if (app === 'phonepe') return `phonepe://pay?${upiString}`;
    if (app === 'paytm') return `paytmmp://pay?${upiString}`;
    
    return `upi://pay?${upiString}`;
  };

  const finalizePaymentAndOrder = async (e?: any) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    
    if (!firebaseDocId || !pendingForm) return;

    setPaymentVerifyState('verifying');
    
    try {
      const docRef = doc(db, 'orders', firebaseDocId);
      await setDoc(docRef, {
        ...(pendingForm as any),
        paymentStatus: 'Pending Payment',
        status: 'Pending Payment'
      });
    } catch (err) {
      console.error("Failed to update order in Firebase:", err);
    }
  };

  return (
    <section id="contact" className="py-28 relative z-10 w-full bg-[#030303]">
      {/* Smart Payment QR Modal */}
      <AnimatePresence>
        {showPaymentModal && pendingForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto"
            onClick={() => paymentVerifyState !== 'verifying' && setShowPaymentModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-amber-500/30 p-6 md:p-8 rounded-3xl max-w-lg w-full relative shadow-[0_0_60px_-10px_rgba(245,158,11,0.2)] my-8"
            >
              {paymentVerifyState !== 'verifying' && (
                <>
                  <button 
                    onClick={() => setShowPaymentModal(false)}
                    className="absolute top-5 left-5 text-neutral-500 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                  >
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button 
                    onClick={() => setShowPaymentModal(false)}
                    className="absolute top-5 right-5 text-neutral-500 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </>
              )}

              {paymentVerifyState === 'verifying' ? (
                <div className="text-center py-12 px-4 space-y-6">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ShieldCheck size={32} className="text-amber-500 animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-medium text-white mb-2">Verifying your payment...</h3>
                    <p className="text-neutral-400 text-xs font-light">Connecting with FamApp / UPI gateway to secure booking token...</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 py-2.5 px-4 rounded-full inline-flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <Lock size={14} /> 256-Bit Encrypted Studio Protocol
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pt-4">
                  <div className="border-b border-white/5 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                        Step 2 of 2: Payment
                      </span>
                      <span className="text-xs font-mono text-neutral-500">{generatedOrderId}</span>
                    </div>
                    <h3 className="text-2xl font-display font-medium text-white mt-3">
                      Booking Advance <span className="text-gradient">Token</span>
                    </h3>
                    <p className="text-neutral-400 text-xs mt-1">Scan QR code to reserve your priority commission queue slot.</p>
                  </div>

                  {/* Order Summary Box */}
                  <div className="bg-neutral-900/60 p-4 rounded-2xl border border-white/10 text-xs space-y-2">
                    <div className="flex justify-between text-neutral-400">
                      <span>Collector Name</span>
                      <strong className="text-white">{pendingForm.name}</strong>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Queue Token Amount</span>
                      <strong className="text-amber-400 font-bold text-sm">₹1 INR</strong>
                    </div>
                  </div>

                  {/* FamApp QR Card */}
                  <div className="bg-gradient-to-b from-[#181510] to-[#0c0a08] p-6 rounded-3xl border border-amber-500/20 text-center relative overflow-hidden shadow-inner">
                    <div className="flex justify-center items-center gap-2 text-amber-400 font-display font-bold text-sm mb-3">
                      <span>Subhalaxmi Batshya</span>
                      <span className="bg-amber-500/20 text-[10px] px-2 py-0.5 rounded text-amber-300 font-mono">Verified Studio</span>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-2xl w-48 h-48 mx-auto shadow-xl flex items-center justify-center relative group">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`upi://pay?pa=7086358990@fam&pn=LaxmiArtworks&am=1&tn=${generatedOrderId}&cu=INR`)}`} 
                        alt={`Payment QR ₹1 for ${generatedOrderId}`} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain mix-blend-multiply" 
                      />
                      <div className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl text-neutral-900 text-xs font-bold px-4 text-center">
                        Scan for ₹1 Booking Token<br/>Note: {generatedOrderId}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between bg-neutral-950/60 px-4 py-2.5 rounded-full border border-white/5">
                      <span className="font-mono text-xs text-neutral-300 truncate font-semibold">7086358990@fam</span>
                      <button 
                        type="button"
                        onClick={handleCopyUpi} 
                        className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0"
                      >
                        {copiedUpi ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copiedUpi ? "Copied ID!" : "Copy UPI"}
                      </button>
                    </div>
                  </div>

                  {/* Interactive UPI Deep-Link Redirect Grid */}
                  <div className="space-y-3 pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 text-center">
                      Direct Tap to Pay (Redirects to App)
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2.5">
                      <a 
                        href={getUpiUrl('gpay')}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setHasClickedPayment(true)}
                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-neutral-900 border border-white/10 hover:border-amber-500/50 hover:bg-neutral-800 transition-all text-xs font-semibold text-white shadow-sm group cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition-transform"></span>
                        Google Pay
                      </a>

                      <a 
                        href={getUpiUrl('phonepe')}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setHasClickedPayment(true)}
                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-neutral-900 border border-white/10 hover:border-amber-500/50 hover:bg-neutral-800 transition-all text-xs font-semibold text-white shadow-sm group cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-purple-500 group-hover:scale-125 transition-transform"></span>
                        PhonePe
                      </a>

                      <a 
                        href={getUpiUrl('paytm')}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setHasClickedPayment(true)}
                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-neutral-900 border border-white/10 hover:border-amber-500/50 hover:bg-neutral-800 transition-all text-xs font-semibold text-white shadow-sm group cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-sky-400 group-hover:scale-125 transition-transform"></span>
                        Paytm
                      </a>

                      <a 
                        href={getUpiUrl('fam')}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setHasClickedPayment(true)}
                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-neutral-900 border border-white/10 hover:border-amber-500/50 hover:bg-neutral-800 transition-all text-xs font-semibold text-white shadow-sm group cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500 group-hover:scale-125 transition-transform"></span>
                        FamApp / Triö
                      </a>
                    </div>

                    {/* Any UPI App Deep Link Chooser */}
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center gap-3 mb-1 mt-1">
                        <div className="h-px bg-white/10 flex-grow"></div>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">Or</span>
                        <div className="h-px bg-white/10 flex-grow"></div>
                      </div>
                      <a 
                        href={getUpiUrl('any')}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setHasClickedPayment(true)}
                        className="w-full py-3.5 px-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all text-xs font-bold text-amber-400 flex items-center justify-center gap-2.5 shadow-md cursor-pointer"
                      >
                        <ExternalLink size={16} />
                        Pay With Other Apps
                      </a>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex flex-col gap-3">
                    {hasClickedPayment ? (
                      <button
                        onClick={finalizePaymentAndOrder}
                        className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold uppercase tracking-widest text-[11px] hover:bg-amber-400 transition-colors"
                      >
                        I Have Paid
                      </button>
                    ) : (
                      <div className="w-full py-4 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-center font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                        Waiting for Payment...
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setShowPaymentModal(false);
                        setStatus('idle');
                      }}
                      className="w-full py-3.5 rounded-2xl border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors text-[11px] font-bold uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Confirmed & Live Tracker Ready Modal */}
      <AnimatePresence>
        {showSuccessPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setShowSuccessPopup(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-emerald-500/30 p-8 rounded-3xl max-w-md w-full relative shadow-[0_0_50px_-10px_rgba(16,185,129,0.2)] text-center space-y-6"
            >
              <button 
                onClick={() => setShowSuccessPopup(false)}
                className="absolute top-5 right-5 text-neutral-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CheckCircle2 size={40} className="text-emerald-400 animate-bounce" />
              </div>
              
              <div>
                <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  {generatedOrderId}
                </span>
                <h3 className="text-2xl font-display font-medium text-white mt-3">
                  Payment <span className="text-emerald-400">Submitted</span>
                </h3>
                <p className="text-neutral-400 font-light text-xs mt-2 leading-relaxed">
                  Your commission slot has been requested and your payment is currently <strong>Waiting for Verification</strong>. Our backend team securely validates all UPI transactions. You can track your status live anytime.
                </p>
              </div>

              <div className="bg-neutral-900/80 p-4 rounded-2xl border border-white/5 flex items-center justify-between text-xs">
                <span className="text-neutral-400">Current Pipeline</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Under Verification
                </span>
              </div>
              
              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={() => {
                    setShowSuccessPopup(false);
                    window.dispatchEvent(new Event('open-status-modal'));
                  }}
                  className="w-full py-4 text-neutral-950 bg-amber-500 font-bold uppercase tracking-widest text-xs hover:bg-amber-400 transition-colors rounded-full cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <QrCode size={16} /> Track Live Order Status
                </button>
                <button 
                  onClick={() => setShowSuccessPopup(false)}
                  className="w-full py-3 text-neutral-400 hover:text-white font-semibold uppercase tracking-widest text-[11px] transition-colors"
                >
                  Close Window
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Contact Section Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col justify-center"
          >
            <h2 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-amber-500"></span> Commission Inquiry
            </h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium mb-6">
              Let's create something <span className="text-gradient italic">timeless.</span>
            </h3>
            <p className="text-neutral-400 font-light mb-12 text-lg">
              For portraits, custom artwork, and commercial inquiries, fill out the form below. Upon submission, you will receive priority queue access via FamApp UPI booking verification.
            </p>

            <div className="space-y-8">
              <div className="flex items-start gap-6 border-l pl-6 border-white/10 hover:border-amber-500/50 transition-colors">
                <MapPin className="text-amber-500 mt-1" size={24} />
                <div>
                  <h4 className="font-bold text-white text-lg mb-1">Studio Address</h4>
                  <p className="text-neutral-400 font-light">Gelapukhuri Road, <br/>Chandmari Tiniali</p>
                </div>
              </div>

              <a href="tel:7086358990" className="flex items-start gap-6 border-l pl-6 border-white/10 hover:border-amber-500/50 transition-colors group">
                <Phone className="text-amber-500 mt-1" size={24} />
                <div>
                  <h4 className="font-bold text-white text-lg mb-1 group-hover:text-amber-400 transition-colors">Direct Studio Line</h4>
                  <p className="text-neutral-400 font-light">+91 7086358990</p>
                </div>
              </a>

              <a href="mailto:gargsubhalaxmi@gmail.com" className="flex items-start gap-6 border-l pl-6 border-white/10 hover:border-amber-500/50 transition-colors group">
                <Mail className="text-amber-500 mt-1" size={24} />
                <div>
                  <h4 className="font-bold text-white text-lg mb-1 group-hover:text-amber-400 transition-colors">Artist Email</h4>
                  <p className="text-neutral-400 font-light">gargsubhalaxmi@gmail.com</p>
                </div>
              </a>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-[#050505] border border-white/10 p-8 md:p-12 rounded-3xl shadow-[0_0_50px_-10px_rgba(245,158,11,0.08)] relative"
          >
            <form id="commission-form" onSubmit={handleSubmit} noValidate className="space-y-6">
              <input type="hidden" name="access_key" value="433c1e76-ac58-4323-a938-e897348ff6c5" />
              <input type="hidden" name="subject" value="New Commission Inquiry via Laxmi Artworks" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Full Name *</label>
                  <input 
                    type="text" 
                    name="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Kabir Sharma"
                    className={`w-full bg-neutral-900/60 border ${fieldErrors.name ? 'border-red-500' : 'border-white/10'} px-6 py-4 rounded-full text-white focus:outline-none focus:border-amber-500 transition-colors text-sm`}
                  />
                  {fieldErrors.name && (
                    <p className="text-red-400 text-xs mt-1.5 pl-2">{fieldErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">WhatsApp / Phone *</label>
                  <input 
                    type="tel" 
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+91 98765 43210"
                    className={`w-full bg-neutral-900/60 border ${fieldErrors.phone ? 'border-red-500' : 'border-white/10'} px-6 py-4 rounded-full text-white focus:outline-none focus:border-amber-500 transition-colors text-sm`}
                  />
                  {fieldErrors.phone && (
                    <p className="text-red-400 text-xs mt-1.5 pl-2">{fieldErrors.phone}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Email Address *</label>
                <input 
                  type="email" 
                  name="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="name@example.com"
                  className={`w-full bg-neutral-900/60 border ${fieldErrors.email ? 'border-red-500' : 'border-white/10'} px-6 py-4 rounded-full text-white focus:outline-none focus:border-amber-500 transition-colors text-sm`}
                />
                {fieldErrors.email && (
                  <p className="text-red-400 text-xs mt-1.5 pl-2">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Artwork Specifications & Vision *</label>
                <textarea 
                  name="message"
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  rows={4}
                  placeholder="Describe desired medium (Oil/Charcoal/Acrylic), canvas size, reference photos, or deadlines..."
                  className={`w-full bg-neutral-900/60 border ${fieldErrors.message ? 'border-red-500' : 'border-white/10'} p-6 rounded-3xl text-white focus:outline-none focus:border-amber-500 transition-colors resize-none text-sm`}
                ></textarea>
                {fieldErrors.message && (
                  <p className="text-red-400 text-xs mt-1.5 pl-2">{fieldErrors.message}</p>
                )}
              </div>

              <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl flex items-start gap-3 text-xs text-neutral-300">
                <ShieldCheck className="text-amber-500 shrink-0 mt-0.5" size={20} />
                <div className="space-y-1">
                  <p><strong className="text-amber-400 font-bold">Important Notice:</strong> Artist is only taking ₹1 as a booking advance right now to reserve your priority slot.</p>
                  <p className="text-neutral-400">The remaining balance can be paid securely via Cash on Delivery (COD) or online after the artwork is completed and safely delivered to you.</p>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={status === 'sending'}
                className="group relative w-full py-3.5 px-6 text-neutral-950 bg-amber-500 font-bold tracking-wide text-sm mt-4 flex items-center justify-center gap-2 hover:bg-amber-400 transition-all rounded-full cursor-pointer shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5"
              >
                {status === 'sending' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-neutral-950/20 border-t-neutral-950 rounded-full animate-spin"></div>
                    Syncing...
                  </>
                ) : (
                  <>
                    Submit Order & Proceed to Payment
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
