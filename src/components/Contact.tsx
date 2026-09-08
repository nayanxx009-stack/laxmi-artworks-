import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Phone, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  X, 
  Copy, 
  QrCode, 
  ShieldCheck, 
  Smartphone, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Zap, 
  Lock,
  ExternalLink
} from 'lucide-react';
import { FormEvent, useState, useEffect } from "react";
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';

const UPI_ID = '7086358990@fam';
const PAYEE_NAME = 'Laxmi Artworks';
const SESSION_STORAGE_KEY = 'laxmi_art_payment_session';

export default function Contact() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  // Payment State Management
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [generatedOrderId, setGeneratedOrderId] = useState("");
  const [generatedArtCode, setGeneratedArtCode] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(1);
  const [paymentDocId, setPaymentDocId] = useState<string | null>(null);
  
  // Real-time verification status: 'PAYMENT_PENDING' | 'Verifying' | 'Paid' | 'Order Confirmed' | 'Failed'
  const [paymentState, setPaymentState] = useState<'idle' | 'PAYMENT_PENDING' | 'Verifying' | 'Paid' | 'Order Confirmed' | 'Failed'>('idle');
  const [statusNote, setStatusNote] = useState<string>('');
  
  // UI toggles
  const [showUtrSection, setShowUtrSection] = useState(false);
  const [manualUTR, setManualUTR] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedArtCode, setCopiedArtCode] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [utrSubmitting, setUtrSubmitting] = useState(false);

  // Helper to generate unique 6-char alphanumeric ART CODE (e.g. ART-8F4K2M)
  const generateArtCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `ART-${code}`;
  };

  // Helper to build standardized dynamic UPI URL
  const getUpiUrl = (artCode: string, orderId: string, amount: number = 1) => {
    const pa = UPI_ID;
    const pn = encodeURIComponent(PAYEE_NAME);
    const tn = encodeURIComponent(`LAXMI ARTWORKS | ${artCode}`);
    const tr = encodeURIComponent(orderId);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${amount}&cu=INR&tn=${tn}&tr=${tr}`;
  };

  // STEP 4: Restore payment session on mount if returning
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        const session = JSON.parse(savedSession);
        // Valid for 2 hours
        if (session.paymentStartedAt && Date.now() - session.paymentStartedAt < 2 * 60 * 60 * 1000) {
          setPaymentDocId(session.docId);
          setGeneratedOrderId(session.orderId);
          setGeneratedArtCode(session.artCode || session.orderId);
          setPaymentAmount(session.amount || 1);
          setPaymentState('PAYMENT_PENDING');
          setShowPaymentModal(true);
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error("Could not restore payment session:", e);
    }
  }, []);

  // STEP 5: Real-time Firestore background listener for payment document
  useEffect(() => {
    if (!paymentDocId) return;

    const unsub = onSnapshot(doc(db, 'payments', paymentDocId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const vStatus = data.verificationStatus;
        const pStatus = data.paymentStatus;
        setStatusNote(data.verificationNote || '');

        if (vStatus === 'Order Confirmed' || pStatus === 'ORDER_ACCEPTED') {
          setPaymentState('Order Confirmed');
          setStatus('success');
          setShowPaymentModal(false);
          setShowSuccessPopup(true);
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setFormData({ name: '', phone: '', email: '', subject: '', message: '' });
        } else if (vStatus === 'Paid' || pStatus === 'PAYMENT_VERIFIED') {
          setPaymentState('Paid');
        } else if (vStatus === 'Failed' || pStatus === 'PAYMENT_FAILED') {
          setPaymentState('Failed');
        } else if (vStatus === 'Verifying') {
          setPaymentState('Verifying');
        } else if (vStatus === 'Waiting For Payment' || pStatus === 'PAYMENT_PENDING' || vStatus === 'Pending') {
          setPaymentState('PAYMENT_PENDING');
        }
      }
    });

    return () => unsub();
  }, [paymentDocId]);

  // STEP 5: Visibility change handler when user returns from UPI app
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && paymentDocId && (paymentState === 'PAYMENT_PENDING' || paymentState === 'idle')) {
        setPaymentState('Verifying');
        updateDoc(doc(db, 'payments', paymentDocId), { 
          verificationStatus: 'Verifying',
          paymentStatus: 'PAYMENT_PENDING'
        }).catch(console.error);

        // Trigger on-demand backend verification check
        fetch('/api/verify-payment-now', { method: 'POST' }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [paymentState, paymentDocId]);

  // STEP 1 & 3: Create Payment Session & Launch UPI
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

    // STEP 1: Generate unique order ID, payment ID, and unique ART CODE
    const artCode = generateArtCode();
    const orderId = artCode;
    const paymentId = `PAY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const amount = 1;

    setGeneratedOrderId(orderId);
    setGeneratedArtCode(artCode);
    setPaymentAmount(amount);

    const paymentData = {
      orderId,
      paymentId,
      artCode,
      upiId: UPI_ID,
      amount,
      currency: 'INR',
      paymentApp: 'Universal UPI',
      timestamp: Date.now(),
      paymentStartedAt: Date.now(),
      paymentStatus: 'PAYMENT_PENDING',
      verificationStatus: 'Waiting For Payment',
      formData: {
        name: object.name,
        email: object.email.toLowerCase(),
        phone: object.phone,
        message: object.message,
        userId: user ? user.uid : "guest_" + Date.now()
      }
    };

    try {
      // Save payment session to Firestore BEFORE opening any external app
      const docRef = doc(collection(db, 'payments'));
      await setDoc(docRef, paymentData);
      setPaymentDocId(docRef.id);
      setPaymentState('PAYMENT_PENDING');
      setShowPaymentModal(true);
      setShowUtrSection(false);
      setManualUTR("");

      // STEP 4: Persist session to localStorage before launching app
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        docId: docRef.id,
        orderId,
        paymentId,
        artCode,
        amount,
        upiId: UPI_ID,
        paymentStatus: 'PAYMENT_PENDING',
        paymentStartedAt: Date.now(),
        formData: paymentData.formData
      }));

      // Optional inquiry webhook for customer support record
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          ...object,
          subject: `New Commission Inquiry (${artCode}) initiated (Payment Pending)`,
          botcheck: false,
          access_key: "433c1e76-ac58-4323-a938-e897348ff6c5"
        })
      }).catch(console.error);

      // STEP 3: Standard UPI Intent deep-link launch
      const upiUrl = getUpiUrl(artCode, orderId, amount);
      window.location.href = upiUrl;

    } catch (err) {
      console.error("Failed to initiate payment:", err);
      setStatus('idle');
      alert("Something went wrong initializing payment. Please try again.");
    }
  };

  // Explicit UPI CTA button click handler
  const handleLaunchUpi = () => {
    if (!generatedArtCode || !generatedOrderId) return;
    const upiUrl = getUpiUrl(generatedArtCode, generatedOrderId, paymentAmount);
    setPaymentState('PAYMENT_PENDING');
    window.location.href = upiUrl;
  };

  // STEP 5: Manual UTR Verification
  const handleManualSubmit = async () => {
    if (!manualUTR.trim() || !paymentDocId) return;
    setUtrSubmitting(true);
    try {
      await updateDoc(doc(db, 'payments', paymentDocId), {
        verificationStatus: 'Verifying',
        paymentStatus: 'PAYMENT_PENDING',
        manualUTR: manualUTR.trim()
      });
      setPaymentState('Verifying');
      // Trigger instant verification check on backend
      fetch('/api/verify-payment-now', { method: 'POST' }).catch(() => {});
    } catch (e) {
      console.error(e);
      alert("Could not submit UTR. Please try again.");
    } finally {
      setUtrSubmitting(false);
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleCopyArtCode = () => {
    if (!generatedArtCode) return;
    navigator.clipboard.writeText(generatedArtCode);
    setCopiedArtCode(true);
    setTimeout(() => setCopiedArtCode(false), 2500);
  };

  const handleCancelPayment = () => {
    if (paymentState !== 'Verifying' && paymentState !== 'Paid' && paymentState !== 'Order Confirmed') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setShowPaymentModal(false);
      setStatus('idle');
    }
  };

  const currentUpiUrl = getUpiUrl(generatedArtCode || generatedOrderId || 'ART-ORDER', generatedOrderId || 'ORDER', paymentAmount);

  return (
    <section id="contact" className="py-28 relative z-10 w-full bg-[#030303]">
      {/* STEP 8: Premium QR + Intent Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0c0c0c] border border-amber-500/25 p-6 sm:p-8 rounded-3xl max-w-md w-full relative shadow-[0_0_80px_-15px_rgba(245,158,11,0.25)] my-8 text-neutral-200"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">Booking Advance</h3>
                    <p className="text-[11px] text-neutral-400">Commission Priority Slot</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-neutral-900 border border-white/10 px-2.5 py-1 rounded-xl">
                  <span className="font-mono text-xs font-bold text-amber-400">{generatedArtCode || generatedOrderId}</span>
                  <button 
                    type="button"
                    onClick={handleCopyArtCode}
                    className="text-neutral-400 hover:text-white transition-colors p-0.5"
                    title="Copy ART CODE"
                  >
                    {copiedArtCode ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* 1. PAYMENT AMOUNT & ART CODE DISPLAY */}
              <div className="bg-gradient-to-b from-neutral-900/80 to-neutral-950 border border-white/5 p-4 rounded-2xl text-center mb-5 relative overflow-hidden">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold block mb-1">
                  Amount Payable Now
                </span>
                <div className="text-4xl font-display font-bold text-white tracking-tight flex items-center justify-center gap-1">
                  <span className="text-amber-500">₹</span>{paymentAmount}
                </div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-[11px] text-neutral-400 font-light">ART CODE:</span>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                    {generatedArtCode || generatedOrderId}
                  </span>
                </div>
              </div>

              {/* 2. DYNAMIC QR ("Scan & Pay") */}
              <div className="bg-neutral-950/60 border border-white/5 p-4 rounded-2xl text-center mb-4">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <QrCode size={16} className="text-amber-500" />
                    <span>Scan & Pay</span>
                  </div>
                  <div className="text-[11px] font-mono text-amber-400 font-bold">
                    ₹{paymentAmount} • {generatedArtCode || generatedOrderId}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl inline-block shadow-2xl mb-2">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(currentUpiUrl)}`} 
                    alt="Dynamic Order UPI QR" 
                    className="w-44 h-44 block mx-auto"
                  />
                </div>

                <div className="text-[10px] text-neutral-400 flex items-center justify-center gap-1 font-light">
                  <Lock size={11} className="text-amber-500/80" /> Dynamic UPI QR linked to {generatedArtCode || generatedOrderId}
                </div>
              </div>

              {/* 3. ONE MAIN BUTTON: "Pay ₹XXX with UPI" */}
              {paymentState !== 'Paid' && (
                <div className="mb-4 space-y-2">
                  <button
                    id="btn-pay-with-upi"
                    type="button"
                    onClick={handleLaunchUpi}
                    className="w-full py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm transition-all shadow-[0_4px_20px_rgba(245,158,11,0.35)] flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer group"
                  >
                    <Smartphone size={18} className="group-hover:scale-110 transition-transform" />
                    <span>Pay ₹{paymentAmount} with UPI</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <p className="text-[11px] text-neutral-500 text-center">
                    Launches installed UPI app (Google Pay, PhonePe, Paytm, etc.)
                  </p>
                </div>
              )}

              {/* 4. UPI ID + COPY */}
              <div className="flex items-center justify-between bg-black/60 border border-white/5 px-4 py-3 rounded-2xl mb-4">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold block mb-0.5">
                    UPI ID
                  </span>
                  <span className="text-xs font-mono text-neutral-200 font-semibold">{UPI_ID}</span>
                </div>
                <button 
                  type="button"
                  onClick={handleCopyUpi}
                  className="px-3 py-1.5 bg-white/5 hover:bg-amber-500/20 text-neutral-300 hover:text-amber-400 border border-white/10 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  {copiedUpi ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* 5. "Already paid? Verify payment" (UTR Fallback) */}
              <div className="border border-white/5 rounded-2xl overflow-hidden bg-neutral-950/40 mb-4">
                <button
                  type="button"
                  onClick={() => setShowUtrSection(!showUtrSection)}
                  className="w-full px-4 py-3 text-xs font-semibold text-neutral-400 hover:text-white flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-500/80" />
                    Already paid? Verify payment
                  </span>
                  {showUtrSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                <AnimatePresence>
                  {showUtrSection && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 pb-4 pt-2 border-t border-white/5 space-y-2.5"
                    >
                      <p className="text-[11px] text-neutral-400">
                        Enter the 12-digit UPI transaction reference (UTR) from your bank/UPI app:
                      </p>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="12-digit UTR number"
                          value={manualUTR}
                          onChange={e => setManualUTR(e.target.value.replace(/\D/g, '').slice(0, 12))}
                          className="flex-1 bg-black/60 border border-white/10 px-3.5 py-2.5 rounded-xl text-white outline-none focus:border-amber-500 font-mono text-xs tracking-wider"
                        />
                        <button 
                          type="button"
                          onClick={handleManualSubmit}
                          disabled={utrSubmitting || manualUTR.trim().length < 6}
                          className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2.5 rounded-xl text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {utrSubmitting ? <RefreshCw size={12} className="animate-spin" /> : null}
                          Verify
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 6. PAYMENT VERIFICATION STATUS */}
              <div className="space-y-3">
                {paymentState === 'Verifying' && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-2">
                    <div className="w-7 h-7 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Verifying your payment...
                    </p>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Confirming transaction status with the backend. Please keep this screen open.
                    </p>
                  </div>
                )}

                {paymentState === 'Paid' && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2">
                    <CheckCircle2 className="text-emerald-400 mx-auto" size={32} />
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Payment Verified ✓
                    </p>
                    <p className="text-[11px] text-neutral-300">
                      Finalizing order acceptance...
                    </p>
                  </div>
                )}

                {paymentState === 'Failed' && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-left">
                    <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-red-400">Payment Pending Verification</p>
                      <p className="text-[11px] text-neutral-400">
                        {statusNote || "If payment was made, enter the 12-digit UTR above or tap Pay with UPI to retry."}
                      </p>
                    </div>
                  </div>
                )}

                {paymentState === 'PAYMENT_PENDING' && (
                  <div className="p-3 bg-neutral-900/60 border border-white/5 rounded-xl flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span>Status: Waiting for payment</span>
                    </div>
                    <span className="font-mono text-neutral-500 text-[10px]">PAYMENT_PENDING</span>
                  </div>
                )}
              </div>

              {/* Dismiss / Cancel */}
              <div className="mt-5 text-center pt-2">
                <button 
                  type="button"
                  onClick={handleCancelPayment}
                  className={`text-neutral-500 text-xs hover:text-neutral-300 transition-colors ${['Verifying', 'Paid', 'Order Confirmed'].includes(paymentState) ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  Cancel & Return
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STEP 7: Payment Confirmed Success Modal */}
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
              className="bg-[#080808] border border-amber-500/25 p-8 md:p-10 rounded-3xl shadow-[0_0_50px_-10px_rgba(245,158,11,0.25)] max-w-md w-full text-center relative"
            >
              <button 
                onClick={() => setShowSuccessPopup(false)}
                className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5 text-emerald-400">
                <CheckCircle2 size={36} />
              </div>

              <h3 className="text-2xl font-display font-medium text-white mb-1">✓ Payment Confirmed</h3>
              <p className="text-amber-400 font-semibold text-sm mb-5">Order Accepted</p>

              <div className="bg-neutral-900/80 border border-white/5 rounded-2xl p-4 text-left mb-6 space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-neutral-400">ART CODE:</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">{generatedArtCode || generatedOrderId}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-400">Amount Paid:</span>
                  <span className="font-bold text-white">₹{paymentAmount}</span>
                </div>
              </div>

              <p className="text-neutral-400 font-light text-xs leading-relaxed mb-6">
                Your commission priority slot has been secured. Our studio has received your inquiry and will begin concept drafting.
              </p>

              <button 
                onClick={() => setShowSuccessPopup(false)}
                className="w-full py-3.5 bg-amber-500 text-neutral-950 font-bold tracking-wider uppercase text-xs hover:bg-amber-400 transition-colors rounded-full cursor-pointer shadow-[0_4px_15px_rgba(245,158,11,0.3)]"
              >
                Close & Track Order
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-4 flex items-center gap-3">
              <span className="w-8 h-px bg-amber-500"></span> Commission Inquiry
            </h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium mb-6">
              Let's create something <span className="text-gradient italic">timeless.</span>
            </h3>
            <p className="text-neutral-400 font-light mb-12 text-lg">
              For portraits, custom artwork, and commercial inquiries, fill out the form below. Upon submission, you will receive priority queue access via UPI booking verification.
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
                    Securing Details...
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
