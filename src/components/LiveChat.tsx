import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MessageSquare, X, Send, Bell, FileText, Download } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { requestFCMToken, onForegroundMessage } from '../lib/fcm';
import { sendPushToAdmins } from '../lib/pushNotify';
import { generateInvoice } from '../lib/generateInvoice';

export default function LiveChat() {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const { user } = useAuth();
  const [chatId, setChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const docSnap = await getDoc(doc(db, 'orders', orderId));
      if (docSnap.exists()) {
        const orderData = { id: docSnap.id, ...docSnap.data() };
        await generateInvoice(orderData, 'download');
      } else {
        alert("Order not found or you don't have permission.");
      }
    } catch (e: any) {
      alert("Error generating invoice: " + e.message);
    }
  };

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-live-chat', handleOpen);
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data?.url?.includes('chat=open')) {
        setIsOpen(true);
      }
    };
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }
    
    if (window.location.search.includes('chat=open')) {
      setIsOpen(true);
    }
    
    const unsubFCM = onForegroundMessage((payload: any) => {
      // Do not show browser notification if chat is open
      if (!isOpenRef.current && Notification.permission === 'granted') {
         try {
           new Notification(payload.notification?.title || 'New Message', {
             body: payload.notification?.body,
             icon: '/vite.svg',
             data: payload.data
           });
         } catch(e) {
           console.error('Failed to show foreground notification:', e);
         }
      }
    });
    return () => {
      window.removeEventListener('open-live-chat', handleOpen);
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
      if (unsubFCM && typeof unsubFCM === 'function') unsubFCM();
    };
  }, []);

  const handleRequestNotifications = async (silent = false) => {
    if (!chatId || typeof Notification === 'undefined') return;
    try {
       const token = await requestFCMToken(chatId, user?.email || 'guest@example.com');
       if (token) {
         setNotificationStatus('granted');
         if (!silent) alert("Notifications enabled!");
       } else {
         setNotificationStatus(Notification.permission);
         if (!silent && Notification.permission === 'denied') {
           alert("Notifications are blocked in your browser settings.");
         }
       }
    } catch (e) {
       console.error(e);
    }
  };

  // Removed automatic prompt to comply with mobile browser policies requiring user gestures
  
  useEffect(() => {
    let cId = user?.uid || localStorage.getItem('guest_chat_id');
    if (!cId) {
      cId = 'guest_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('guest_chat_id', cId);
    }
    setChatId(cId);

    setDoc(doc(db, 'chats', cId), {
      userId: user?.uid || 'guest',
      userName: user?.displayName || 'Guest',
      userEmail: user?.email || '',
      lastMessageAt: Date.now(),
    }, { merge: true }).catch(() => {});

    const q = query(collection(db, 'chats', cId, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const msg = change.doc.data();
          if (msg.sender === 'admin' && msg.timestamp > Date.now() - 5000) {
            if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
              new Notification("Laxmi Artworks", { body: msg.text.startsWith('[INVOICE:') ? "Sent you an invoice" : msg.text });
            }
          }
        }
      });
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubChat = onSnapshot(doc(db, 'chats', cId), (docSnap) => {
      if (docSnap.exists()) {
        setAdminTyping(docSnap.data().adminTyping || false);
      }
    });

    if (isOpen) {
      updateDoc(doc(db, 'chats', cId), { unreadUser: 0 }).catch(() => {});
    }

    return () => { unsub(); unsubChat(); };
  }, [user, isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    try {
      const msg = newMessage;
      setNewMessage('');
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: msg,
        sender: 'user',
        timestamp: Date.now()
      });
      await updateDoc(doc(db, 'chats', chatId), {
        userTyping: false,
        lastMessage: msg,
        lastMessageAt: Date.now(),
        unreadAdmin: 1
      });
      sendPushToAdmins('New Message from ' + (user?.displayName || 'Guest'), msg, '/?chat=open');
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 sm:bottom-6 sm:right-6 z-[100] w-[calc(100vw-3rem)] sm:w-80 h-[500px] max-h-[80vh] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-black p-4 flex justify-between items-center shadow-md">
        <h3 className="font-bold text-sm tracking-widest uppercase flex items-center gap-2"><MessageSquare size={16}/> Live Support</h3>
        <div className="flex items-center gap-2">
          {notificationStatus !== 'granted' && notificationStatus !== 'unsupported' && (
            <button onClick={handleRequestNotifications} title="Enable Notifications" className="hover:opacity-70 p-1 bg-black/10 rounded-full transition-colors">
              <Bell size={16} className="animate-pulse" />
            </button>
          )}
          <button onClick={() => setIsOpen(false)} className="hover:opacity-70 p-1 bg-black/10 rounded-full transition-colors"><X size={16}/></button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-950/80">
        <div className="flex flex-col items-start">
          <div className="bg-neutral-800 border border-white/5 p-3 rounded-2xl rounded-tl-sm text-sm text-neutral-200 w-3/4 shadow-sm">
            Hello! How can we help you today?
          </div>
        </div>
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`p-3 rounded-2xl text-sm max-w-[85%] shadow-sm ${msg.sender === 'user' ? 'bg-amber-500 text-black rounded-br-sm' : 'bg-neutral-800 border border-white/5 text-neutral-200 rounded-tl-sm'}`}>
              {msg.text.startsWith('[INVOICE:') ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold border-b border-white/10 pb-2">
                    <FileText size={16} /> Invoice Attached
                  </div>
                  <button 
                    onClick={() => handleDownloadInvoice(msg.text.replace('[INVOICE:', '').replace(']', ''))}
                    className={`flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${msg.sender === 'user' ? 'bg-black/20 hover:bg-black/30 text-black' : 'bg-amber-500 text-black hover:bg-amber-400'}`}
                  >
                    <Download size={14} /> Download Invoice
                  </button>
                </div>
              ) : (
                msg.text
              )}
            </div>
            <span className="text-[10px] text-neutral-600 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        ))}
        {adminTyping && (
          <div className="flex flex-col items-start">
            <div className="p-3 rounded-2xl text-sm bg-neutral-800 border border-white/5 text-neutral-400 rounded-tl-sm flex gap-1">
              <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '0.2s'}}>.</span><span className="animate-bounce" style={{animationDelay: '0.4s'}}>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-[#0a0a0a] flex gap-2">
        <input 
          type="text" 
          value={newMessage}
          onChange={e => {
            setNewMessage(e.target.value);
            if (chatId) {
              updateDoc(doc(db, 'chats', chatId), { userTyping: e.target.value.length > 0 }).catch(() => {});
            }
          }}
          placeholder="Type your message..."
          className="flex-1 bg-neutral-900 border border-white/10 rounded-full px-4 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
        />
        <button type="submit" className="bg-amber-500 text-black p-2 w-10 h-10 flex items-center justify-center rounded-full hover:bg-amber-400 transition-colors">
          <Send size={16} className="-ml-0.5 mt-0.5" />
        </button>
      </form>
    </div>
  );
}
