import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Phone, Mail, ArrowRight, CheckCircle2, X, Copy, QrCode, ShieldCheck, CreditCard } from 'lucide-react';
import { FormEvent, useState, useEffect, useRef } from "react";
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';

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

  // Payment States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [pendingForm, setPendingForm] = useState<Record<string, string> | null>(null);
  const [generatedOrderId, setGeneratedOrderId] = useState("");
  
  const [paymentDocId, setPaymentDocId] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<'idle' | 'Pending' | 'Waiting For Payment' | 'Verifying' | 'Paid' | 'Order Confirmed' | 'Failed'>('idle');
  const [showFallbackQR, setShowFallbackQR] = useState(false);
  const [manualUTR, setManualUTR] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);

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

    const paymentData = {
      orderId,
      upiId: '7086358990@fam',
      amount: 1,
      paymentApp: 'Universal UPI',
      timestamp: Date.now(),
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
      const docRef = doc(collection(db, 'payments'));
      await setDoc(docRef, paymentData);
      setPaymentDocId(docRef.id);
      setPaymentState('Waiting For Payment');
      setShowPaymentModal(true);
      setShowFallbackQR(false);
      setManualUTR("");
      
      // Submit to Web3Forms for notification only (optional)
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          ...object,
          subject: `New Commission Inquiry (${orderId}) initiated (Payment Pending)`,
          botcheck: false,
          access_key: "433c1e76-ac58-4323-a938-e897348ff6c5"
        })
      }).catch(console.error);

      // Trigger universal UPI intent
      const upiUrl = `upi://pay?pa=7086358990@fam&pn=Laxmi%20Artworks&tr=${orderId}&tn=${orderId}&am=1&cu=INR`;
      const clickTime = Date.now();
      window.location.href = upiUrl;

      // Fallback check
      setTimeout(() => {
        if (document.visibilityState === 'visible' && Date.now() - clickTime < 4000) {
          setShowFallbackQR(true);
        }
      }, 3500);

    } catch (err) {
      console.error("Failed to initiate payment:", err);
      setStatus('idle');
      alert("Something went wrong. Please try again.");
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && paymentState === 'Waiting For Payment' && paymentDocId) {
        setPaymentState('Verifying');
        updateDoc(doc(db, 'payments', paymentDocId), { verificationStatus: 'Verifying' }).catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [paymentState, paymentDocId]);

  useEffect(() => {
    if (!paymentDocId) return;
    const unsub = onSnapshot(doc(db, 'payments', paymentDocId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.verificationStatus === 'Order Confirmed') {
          setPaymentState('Order Confirmed');
          setStatus('success'); // Show success screen
          setShowPaymentModal(false);
          setShowSuccessPopup(true);
          setFormData({ name: '', phone: '', email: '', subject: '', message: '' });
        } else if (data.verificationStatus === 'Paid') {
          setPaymentState('Paid');
        } else if (data.verificationStatus === 'Failed') {
          setPaymentState('Failed');
        } else if (data.verificationStatus === 'Verifying') {
          setPaymentState('Verifying');
        } else if (data.verificationStatus === 'Waiting For Payment') {
          setPaymentState('Waiting For Payment');
        }
      }
    });
    return () => unsub();
  }, [paymentDocId]);

  const handleManualSubmit = async () => {
    if (!manualUTR.trim() || !paymentDocId) return;
    try {
      await updateDoc(doc(db, 'payments', paymentDocId), {
        verificationStatus: 'Verifying',
        manualUTR: manualUTR.trim()
      });
      setPaymentState('Verifying');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText("7086358990@fam");
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 3000);
  };

  return (
    <section id="contact" className="py-28 relative z-10 w-full bg-[#030303]">
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-amber-500/30 p-6 md:p-8 rounded-3xl max-w-lg w-full relative shadow-[0_0_60px_-10px_rgba(245,158,11,0.2)] my-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                  <CreditCard className="text-amber-500" size={32} />
                </div>
                <h3 className="text-2xl font-display font-medium text-white mb-2">Complete Payment</h3>
                <p className="text-neutral-400 text-sm">Amount: <strong className="text-amber-500 text-lg">₹1</strong></p>
              </div>

              <div className="space-y-6">
                {paymentState === 'Waiting For Payment' && !showFallbackQR && (
                   <div className="text-center py-8">
                     <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                     <p className="text-amber-500 font-bold tracking-widest uppercase text-sm mb-2">Opening UPI App...</p>
                     <p className="text-neutral-500 text-xs">Please complete the payment in your UPI app.</p>
                     <button 
                       onClick={() => setShowFallbackQR(true)}
                       className="mt-6 text-amber-500/70 hover:text-amber-400 text-xs underline"
                     >
                       App didn't open? Show QR Code
                     </button>
                   </div>
                )}

                {paymentState === 'Verifying' && (
                   <div className="text-center py-8">
                     <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                     <p className="text-emerald-500 font-bold tracking-widest uppercase text-sm mb-2">Verifying Payment...</p>
                     <p className="text-neutral-500 text-xs">This may take up to 2-3 minutes. Please do not close this window.</p>
                   </div>
                )}

                {paymentState === 'Paid' && (
                   <div className="text-center py-8">
                     <CheckCircle2 className="text-emerald-500 mx-auto mb-4" size={48} />
                     <p className="text-emerald-500 font-bold tracking-widest uppercase text-sm mb-2">Payment Successful!</p>
                     <p className="text-neutral-500 text-xs">Generating your order...</p>
                   </div>
                )}

                {(showFallbackQR || paymentState === 'Failed') && (paymentState !== 'Verifying' && paymentState !== 'Paid' && paymentState !== 'Order Confirmed') && (
                  <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 text-center">
                    {paymentState === 'Failed' && (
                       <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                         <p className="text-red-400 text-xs">Payment verification failed or timed out. Please try again or provide UTR manually.</p>
                       </div>
                    )}
                    <p className="text-sm text-neutral-400 mb-4">Scan QR code using any UPI app</p>
                    <div className="bg-white p-4 rounded-xl inline-block mb-4 shadow-lg">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=7086358990@fam&pn=Laxmi%20Artworks&tr=${generatedOrderId}&tn=${generatedOrderId}&am=1&cu=INR`)}`} 
                        alt="Payment QR" 
                        className="w-48 h-48"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between bg-black/50 p-3 rounded-xl border border-white/10 mb-6">
                      <div className="text-left">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-1">UPI ID</span>
                        <span className="text-sm font-mono text-white">7086358990@fam</span>
                      </div>
                      <button 
                        onClick={handleCopyUpi}
                        className="p-2 bg-neutral-800 hover:bg-amber-500 text-neutral-400 hover:text-black rounded-lg transition-colors"
                        title="Copy UPI ID"
                      >
                        {copiedUpi ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                      </button>
                    </div>

                    <div className="border-t border-white/10 pt-6">
                      <label className="block text-left text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Already Paid? Enter UTR</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Enter 12-digit UTR number"
                          value={manualUTR}
                          onChange={e => setManualUTR(e.target.value)}
                          className="flex-1 bg-black border border-white/10 px-4 py-3 rounded-xl text-white outline-none focus:border-amber-500 text-sm"
                        />
                        <button 
                          onClick={handleManualSubmit}
                          className="bg-amber-500 text-black font-bold px-6 py-3 rounded-xl text-sm hover:bg-amber-400 transition-colors"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <button 
                        onClick={() => {
                          const upiUrl = `upi://pay?pa=7086358990@fam&pn=Laxmi%20Artworks&tr=${generatedOrderId}&tn=${generatedOrderId}&am=1&cu=INR`;
                          window.location.href = upiUrl;
                        }}
                        className="text-amber-500 text-xs hover:underline"
                      >
                        Try opening UPI app again
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 text-center">
                <button 
                  onClick={() => {
                    if (paymentState !== 'Verifying' && paymentState !== 'Paid' && paymentState !== 'Order Confirmed') {
                      setShowPaymentModal(false);
                      setStatus('idle');
                    }
                  }}
                  className={`text-neutral-500 text-xs hover:text-white transition-colors ${['Verifying', 'Paid', 'Order Confirmed'].includes(paymentState) ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  Cancel Payment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowSuccessPopup(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#050505] border border-amber-500/20 p-8 md:p-12 rounded-3xl shadow-[0_0_40px_-10px_rgba(245,158,11,0.15)] max-w-md w-full text-center relative"
            >
              <button 
                onClick={() => setShowSuccessPopup(false)}
                className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="text-amber-500" size={40} />
              </div>
              <h3 className="text-3xl font-display font-medium text-white mb-2">Order Confirmed</h3>
              <p className="text-neutral-400 font-light mb-6 text-sm">
                Your payment was verified successfully. Order ID: <strong className="text-amber-500 font-mono ml-1">{generatedOrderId}</strong>
              </p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left mb-8">
                <p className="text-neutral-300 text-xs font-light leading-relaxed">
                  We've secured your priority slot in the commission queue. An invoice and details have been sent to your email. You can track your artwork's progress at any time.
                </p>
              </div>
              <button 
                onClick={() => setShowSuccessPopup(false)}
                className="w-full py-4 bg-amber-500 text-neutral-950 font-bold tracking-widest uppercase text-sm hover:bg-amber-400 transition-colors rounded-full"
              >
                Track My Order
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
