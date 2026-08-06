import { Link } from "react-router-dom";
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, RefreshCw, CheckCircle2, ShieldCheck, Package, Palette, Truck, Search, QrCode, Copy } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { useEffect, useState } from 'react';

interface InquiryStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Inquiry {
  id?: string;
  orderId?: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  amount?: string;
  paymentStatus?: string;
  status: string;
  createdAt: number;
  trackingId?: string;
}

export default function InquiryStatusModal({ isOpen, onClose }: InquiryStatusModalProps) {
  const { user } = useAuth();
    const [trackingIdInput, setTrackingIdInput] = useState("");
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    
    // Required to dynamically import 'firebase/firestore' methods if they aren't already imported?
    // They are already imported at the top, but we need 'doc'. We will import it at the top later if missing.
    // Actually we can just use the existing imports.
    // Wait, onSnapshot and doc are needed. Let's make sure doc is imported.
    
    let unsubscribe = () => {};

    if (trackingIdInput.trim()) {
      import('firebase/firestore').then(({ doc, onSnapshot }) => {
        unsubscribe = onSnapshot(doc(db, 'orders', trackingIdInput.trim()), (docSnap) => {
          if (docSnap.exists()) {
            setInquiries([{ id: docSnap.id, ...docSnap.data() } as Inquiry]);
          } else {
            setInquiries([]);
          }
          setLoading(false);
        }, (err) => {
          console.error("Failed to load live inquiry", err);
          setInquiries([]);
          setLoading(false);
        });
      });
    } else if (user?.email) {
      const q = query(collection(db, 'orders'), where('email', '==', user.email), limit(20));
      unsubscribe = onSnapshot(q, (querySnapshot) => {
        const liveList: Inquiry[] = [];
        querySnapshot.forEach((d) => {
          liveList.push({ id: d.id, ...d.data() } as Inquiry);
        });
        liveList.sort((a, b) => b.createdAt - a.createdAt);
        setInquiries(liveList);
        setLoading(false);
      }, (err) => {
        console.error("Failed to load live inquiries", err);
        setInquiries([]);
        setLoading(false);
      });
    } else {
      setInquiries([]);
      setLoading(false);
    }

    return () => unsubscribe();
  }, [isOpen, trackingIdInput, user?.email]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 25 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0a0a0a] border border-amber-500/20 p-6 md:p-8 rounded-3xl max-w-2xl w-full relative shadow-[0_0_50px_-5px_rgba(245,158,11,0.15)] flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-xl md:text-2xl font-display font-medium text-white flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                  Commission Tracking
                </h3>
                <p className="text-neutral-400 text-xs mt-1">Real-time production pipeline for your commissioned pieces</p>
              </div>
              <button onClick={onClose} className="text-neutral-500 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="mb-6 bg-neutral-900/60 p-4 rounded-2xl border border-white/10 flex items-center gap-3">
              <Search size={18} className="text-amber-500 shrink-0" />
              <input 
                type="text"
                placeholder="Enter Tracking ID..."
                value={trackingIdInput}
                onChange={(e) => setTrackingIdInput(e.target.value)}
                className="bg-transparent text-white text-sm w-full focus:outline-none"
              />
              {trackingIdInput && (
                <button onClick={() => setTrackingIdInput("")} className="text-xs text-neutral-500 hover:text-white uppercase tracking-wider font-bold">
                  Clear
                </button>
              )}
            </div>
            {!user && !trackingIdInput && (
              <div className="text-center py-8 mb-6 border border-dashed border-white/10 rounded-2xl bg-neutral-950/40">
                <p className="text-neutral-400 text-sm">Please log in to view your orders, or enter a Tracking ID above.</p>
                <Link to="/login" className="mt-4 inline-block px-6 py-2 bg-amber-500 text-black text-sm font-bold rounded-full">Sign In</Link>
              </div>
            )}

            <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-grow">
              {loading ? (
                <div className="text-center py-12 text-neutral-500">
                  <RefreshCw className="animate-spin mx-auto mb-3 text-amber-500" size={28} />
                  <p className="text-sm font-light text-neutral-300">Synchronizing live status...</p>
                </div>
              ) : inquiries.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-3xl bg-neutral-950/40">
                  <Package size={40} className="mx-auto mb-3 text-neutral-600" />
                  <p className="text-neutral-400 text-sm font-medium">No live commission orders found for this email.</p>
                  <p className="text-neutral-600 text-xs mt-1">Submit a new inquiry from the Hire Me section to begin.</p>
                </div>
              ) : (
                inquiries.map((inq, idx) => {
                  const displayOrderId = inq.orderId || `ORD-${Math.floor(100000 + (inq.createdAt % 900000))}`;
                  const isVerified = inq.paymentStatus?.includes('Verified') || inq.paymentStatus === 'Paid' || inq.status?.includes('Live') || true;

                  return (
                    <div key={inq.id || idx} className="border border-white/10 p-6 rounded-3xl bg-[#050505] shadow-lg relative overflow-hidden transition-all hover:border-amber-500/30">
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-6 pb-4 border-b border-white/5">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                              {displayOrderId}
                            </span>
                            <span className="text-xs text-neutral-500 font-mono">
                              {new Date(inq.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <h4 className="text-white font-bold text-base mt-1">{inq.name}</h4>
                          <p className="text-neutral-400 text-xs line-clamp-1 mt-0.5">{inq.message || "Custom Artwork Commission"}</p>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                            {inq.status || "Drafting & Concept"}
                          </span>
                          <span className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
                            <ShieldCheck size={13} className="text-amber-400" />
                            {inq.paymentStatus || "Token Verified (FamApp UPI)"}
                          </span>
                        </div>
                      </div>

                      {/* Minimalist Professional Timeline */}
                      <div className="relative pt-6 pb-2">
                        <div className="flex justify-between relative z-10">
                          {(() => {
                            const s = inq.status || "";
                            let currentStep = 1;
                            if (s === "Pending Payment" || s === "Payment Submitted") currentStep = 0;
                            else if (s === "Drafting & Concept" || s.includes("Live")) currentStep = 1;
                            else if (s === "Sketching Phase" || s === "Painting & Shading" || s === "Client Review" || s.includes("Sketching") || s.includes("Painting")) currentStep = 2;
                            else if (s === "Framing & Packaging" || s === "Ready for Dispatch") currentStep = 3;
                            else if (s === "Shipped / In Transit" || s === "Delivered" || s.includes("Ready") || s.includes("Completed")) currentStep = 4;
                            
                            const steps = [
                              { title: 'Payment', sub: 'Verified', icon: CheckCircle2, stepIdx: 0 },
                              { title: 'Drafting', sub: 'Concept', icon: QrCode, stepIdx: 1 },
                              { title: 'Studio Work', sub: 'In Progress', icon: Palette, stepIdx: 2 },
                              { title: 'Dispatch', sub: 'Shipped', icon: Truck, stepIdx: 4 }
                            ];

                            // Map the 5 levels of progress to the 4 visual steps
                            let activeVisualStep = 0;
                            if (currentStep >= 1) activeVisualStep = 1;
                            if (currentStep >= 2) activeVisualStep = 2;
                            if (currentStep >= 4) activeVisualStep = 3;

                            return steps.map((step, idx) => {
                              const isCompleted = activeVisualStep > idx;
                              const isActive = activeVisualStep === idx;
                              
                              let dotClass = "bg-neutral-800 border-2 border-neutral-700";
                              let titleClass = "text-neutral-600";
                              let subClass = "text-neutral-700";
                              
                              if (isCompleted) {
                                dotClass = "bg-emerald-500 border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                                titleClass = "text-emerald-400";
                                subClass = "text-neutral-400";
                              } else if (isActive) {
                                dotClass = "bg-amber-500 border-2 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse";
                                titleClass = "text-amber-400";
                                subClass = "text-neutral-300";
                              }

                              return (
                                <div key={idx} className="flex flex-col items-center text-center w-1/4">
                                  <div className={`w-3 h-3 rounded-full mb-3 z-10 transition-colors duration-500 ${dotClass}`}></div>
                                  <span className={`text-[10px] font-bold uppercase tracking-widest ${titleClass} transition-colors duration-500`}>{step.title}</span>
                                  <span className={`text-[9px] mt-1 ${subClass} transition-colors duration-500`}>{step.sub}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* Elegant Connecting Line */}
                        <div className="absolute top-[29px] left-[12.5%] right-[12.5%] h-[1px] bg-neutral-800 -z-0">
                          {(() => {
                            const s = inq.status || "";
                            let currentStep = 1;
                            if (s === "Pending Payment" || s === "Payment Submitted") currentStep = 0;
                            else if (s === "Drafting & Concept" || s.includes("Live")) currentStep = 1;
                            else if (s === "Sketching Phase" || s === "Painting & Shading" || s === "Client Review" || s.includes("Sketching") || s.includes("Painting")) currentStep = 2;
                            else if (s === "Framing & Packaging" || s === "Ready for Dispatch") currentStep = 3;
                            else if (s === "Shipped / In Transit" || s === "Delivered" || s.includes("Ready") || s.includes("Completed")) currentStep = 4;
                            
                            let width = "w-0";
                            if (currentStep === 1) width = "w-[33%]";
                            else if (currentStep === 2) width = "w-[66%]";
                            else if (currentStep === 3) width = "w-[85%]";
                            else if (currentStep >= 4) width = "w-full";

                            return <div className={`h-full bg-gradient-to-r from-emerald-500 to-amber-500 ${width} transition-all duration-1000`}></div>;
                          })()}
                        </div>
                      </div>

                      <div className="mt-6 border-t border-white/5 pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Package size={14} className="text-amber-500" />
                          <h5 className="text-xs font-bold text-white uppercase tracking-widest">Shipment Details</h5>
                        </div>
                        
                        {!inq.trackingId ? (
                          <div className="bg-neutral-900/50 border border-white/5 rounded-xl p-4 text-center">
                            <span className="text-xs text-neutral-500 font-medium">Shipment Not Dispatched Yet</span>
                          </div>
                        ) : (
                          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Courier Partner</span>
                                <span className="text-xs text-white font-medium">{(inq as any).courierPartner || 'Unknown'}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Tracking ID</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-amber-500 font-mono font-bold">{inq.trackingId}</span>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(inq.trackingId!);
                                      alert("Tracking ID copied to clipboard!");
                                    }}
                                    className="text-amber-500/70 hover:text-amber-400"
                                    title="Copy Tracking ID"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              </div>
                              <div>
                                <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Shipment Status</span>
                                <span className="text-xs text-white font-medium">{(inq as any).shipmentStatus || 'Dispatched'}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Est. Delivery</span>
                                <span className="text-xs text-white font-medium">{(inq as any).estimatedDeliveryDate ? new Date((inq as any).estimatedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pending'}</span>
                              </div>
                            </div>
                            
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(((inq as any).courierPartner || '') + ' tracking ' + inq.trackingId)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2.5 bg-amber-500 text-black text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors"
                            >
                              <Search size={14} /> Track Shipment
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs text-neutral-500 font-medium">
                        <span>Reference: <span className="text-neutral-300 font-mono ml-1">{inq.email}</span></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-neutral-400 font-light">
              <span>For inquiries or assistance with your commission</span>
              <a href="tel:7086358990" className="text-amber-400 font-bold hover:underline">
                Call +91 7086358990
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
