import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { MessageSquare, Send, ArrowLeft, FileText, Megaphone, Users, User, X } from 'lucide-react';
import { getDocs, collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { sendPushToUser } from '../lib/pushNotify';

export default function AdminChat() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userTyping, setUserTyping] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'selected' | 'premium' | 'recent'>('all');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);


  useEffect(() => {
    const q = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activeChat) return;
    const q = query(collection(db, 'chats', activeChat.id, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    updateDoc(doc(db, 'chats', activeChat.id), { unreadAdmin: 0 }).catch(() => {});
    let unsubChat = () => {};
    unsubChat = onSnapshot(doc(db, 'chats', activeChat.id), (docSnap) => {
      if (docSnap.exists()) setUserTyping(docSnap.data().userTyping || false);
    });
    return () => { unsub(); unsubChat(); };
  }, [activeChat]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    try {
      const msg = newMessage;
      setNewMessage('');
      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        text: msg,
        sender: 'admin',
        timestamp: Date.now()
      });
      sendPushToUser(activeChat.id, 'New Message from Laxmi Artworks', msg, '/?chat=open', db);
      await updateDoc(doc(db, 'chats', activeChat.id), {
        adminTyping: false,
        lastMessage: msg,
        lastMessageAt: Date.now(),
        unreadUser: 1 // for user to see
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setIsBroadcasting(true);
    try {
      let targetUserIds = new Set<string>();
      
      if (broadcastTarget === 'all') {
        const chatsSnapshot = await getDocs(collection(db, 'chats'));
        chatsSnapshot.forEach(d => targetUserIds.add(d.id));
      } else if (broadcastTarget === 'selected' && activeChat) {
        targetUserIds.add(activeChat.id);
      } else if (broadcastTarget === 'premium' || broadcastTarget === 'recent') {
        const ordersSnap = await getDocs(collection(db, 'orders'));
        ordersSnap.forEach(d => {
          const data = d.data();
          if (broadcastTarget === 'premium' && (data.paymentStatus === 'Paid' || data.paymentStatus === 'Verified')) {
            targetUserIds.add(data.userId || data.email);
          }
          if (broadcastTarget === 'recent' && data.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000) {
            targetUserIds.add(data.userId || data.email);
          }
        });
      }

      const targets = Array.from(targetUserIds);
      let tokens: string[] = [];
      
      const fcmDocs = await getDocs(collection(db, 'fcm_tokens'));
      fcmDocs.forEach(d => {
        const data = d.data();
        if (targetUserIds.has(data.userId) || targetUserIds.has(data.email)) {
          tokens.push(data.token);
        }
      });
      
      for (const targetId of targets) {
        if (!targetId) continue;
        try {
          await addDoc(collection(db, 'chats', targetId, 'messages'), {
            text: broadcastMessage,
            sender: 'admin',
            timestamp: Date.now()
          });
          await updateDoc(doc(db, 'chats', targetId), {
            lastMessage: broadcastMessage,
            lastMessageAt: Date.now(),
            unreadUser: 1
          });
        } catch (e) {
          // Ignore if chat doc doesn't exist
        }
      }
      
      let sentStats = { success: 0, failure: 0 };
      if (tokens.length > 0) {
        try {
          const res = await fetch('/api/broadcast-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokens, title: 'Message from Laxmi Artworks', body: broadcastMessage, url: '/?chat=open' })
          });
          const data = await res.json();
          if (data.response) {
            sentStats.success = data.response.successCount || 0;
            sentStats.failure = data.response.failureCount || 0;
          }
        } catch (e) {
          console.error("Push API error", e);
        }
      }

      setBroadcastMessage('');
      setShowBroadcastModal(false);
      alert(`Broadcast sent to ${targets.length} user(s).\n\nPush Stats:\nDelivered: ${sentStats.success}\nFailed: ${sentStats.failure}`);
    } catch (err) {
      console.error("Broadcast failed:", err);
      alert("Failed to send broadcast");
    }
    setIsBroadcasting(false);
  };

  const handleSendInvoice = async () => {
    const orderId = prompt("Enter the Order ID to send invoice for:");
    if (!orderId || !orderId.trim() || !activeChat) return;
    try {
      const msg = `[INVOICE:${orderId.trim()}]`;
      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        text: msg,
        sender: 'admin',
        timestamp: Date.now()
      });
      sendPushToUser(activeChat.id, 'Invoice Received', 'You have received a new invoice from Laxmi Artworks', '/?chat=open', db);
      await updateDoc(doc(db, 'chats', activeChat.id), {
        adminTyping: false,
        lastMessage: 'Sent an invoice',
        lastMessageAt: Date.now(),
        unreadUser: 1
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
    <div className="h-full min-h-[85vh] w-full flex flex-col md:flex-row gap-6 text-white">
      <div className={`w-full md:w-1/3 bg-neutral-900 border border-white/10 rounded-2xl flex flex-col overflow-hidden ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 md:p-6 border-b border-white/10 bg-black/20 flex items-center justify-between">
          <h2 className="font-bold uppercase tracking-widest text-sm flex items-center gap-2 text-amber-500"><MessageSquare size={16}/> Customer Chats</h2>
          <button onClick={() => setShowBroadcastModal(true)} className="p-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black rounded-full transition-colors group relative" title="Broadcast Message">
            <Megaphone size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 && <div className="p-6 text-center text-neutral-500 text-sm">No active chats.</div>}
          {chats.map(chat => (
            <button 
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${activeChat?.id === chat.id ? 'bg-amber-500/10 border-l-2 border-amber-500' : ''}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm truncate text-neutral-100">{chat.userName || 'Guest'}</span>
                {chat.unreadAdmin > 0 && <span className="bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">{chat.unreadAdmin} new</span>}
              </div>
              <p className="text-xs text-neutral-400 truncate">{chat.lastMessage || 'No messages'}</p>
              <p className="text-[10px] text-neutral-600 mt-1">{new Date(chat.lastMessageAt).toLocaleString()}</p>
            </button>
          ))}
        </div>
      </div>

      <div className={`w-full md:flex-1 bg-neutral-900 border border-white/10 rounded-2xl flex flex-col overflow-hidden relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            Select a chat to start messaging
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-white/10 bg-black/20 flex items-center gap-3">
              <button className="md:hidden p-2 bg-white/5 rounded-full hover:bg-white/10" onClick={() => setActiveChat(null)}>
                <ArrowLeft size={16} />
              </button>
              <div>
                <h3 className="font-bold text-amber-500">{activeChat.userName || 'Guest'}</h3>
                <p className="text-xs text-neutral-500">{activeChat.userEmail || 'No email provided'}</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-950/50">
              {messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-3 rounded-2xl text-sm max-w-[85%] md:max-w-[70%] shadow-lg ${msg.sender === 'admin' ? 'bg-amber-500 text-black rounded-br-sm' : 'bg-neutral-800 text-neutral-200 border border-white/10 rounded-tl-sm'}`}>
                    {msg.text.startsWith('[INVOICE:') ? (
                      <div className="flex items-center gap-2">
                        <FileText size={16} />
                        <span className="font-bold">Sent Invoice: {msg.text.replace('[INVOICE:', '').replace(']', '')}</span>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-500 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
              {userTyping && (
                <div className="flex flex-col items-start">
                  <div className="p-3 rounded-2xl text-sm bg-neutral-800 text-neutral-400 border border-white/10 rounded-tl-sm flex gap-1">
                    <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '0.2s'}}>.</span><span className="animate-bounce" style={{animationDelay: '0.4s'}}>.</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 md:p-6 border-t border-white/10 bg-neutral-900 flex items-center gap-3 w-full">
              <button type="button" onClick={handleSendInvoice} title="Send Invoice" className="bg-neutral-800 text-neutral-400 p-3 md:p-4 rounded-xl hover:bg-neutral-700 hover:text-amber-500 transition-colors flex-shrink-0">
                <FileText size={20} />
              </button>
              <input 
                type="text" 
                value={newMessage}
                onChange={e => {
                setNewMessage(e.target.value);
                updateDoc(doc(db, 'chats', activeChat.id), { adminTyping: e.target.value.length > 0 }).catch(() => {});
              }}
                placeholder="Type your message..."
                className="flex-1 bg-black border border-white/10 rounded-xl px-5 md:px-6 py-4 text-white text-sm md:text-base focus:outline-none focus:border-amber-500 transition-colors w-full"
              />
              <button type="submit" className="bg-amber-500 text-black p-4 rounded-xl hover:bg-amber-400 transition-colors shadow-[0_0_20px_rgba(245,158,11,0.2)] flex items-center justify-center flex-shrink-0">
                <Send size={20} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
      {showBroadcastModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
            <button onClick={() => setShowBroadcastModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Megaphone className="text-amber-500" /> Broadcast Message</h3>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <button 
                  onClick={() => setBroadcastTarget('all')}
                  className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors ${broadcastTarget === 'all' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                >
                  <Users size={14} /> All
                </button>
                <button 
                  onClick={() => setBroadcastTarget('selected')}
                  disabled={!activeChat}
                  className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors ${broadcastTarget === 'selected' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'} ${!activeChat ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <User size={14} /> Selected
                </button>
                <button 
                  onClick={() => setBroadcastTarget('premium')}
                  className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors ${broadcastTarget === 'premium' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                >
                  Premium
                </button>
                <button 
                  onClick={() => setBroadcastTarget('recent')}
                  className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors ${broadcastTarget === 'recent' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                >
                  Recent
                </button>
              </div>
              
              <div>
                <label className="text-xs text-neutral-400 mb-2 block">Message</label>
                <textarea 
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  placeholder="Enter the message you want to broadcast..."
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm focus:border-amber-500 outline-none h-32 resize-none"
                />
              </div>

              <button 
                onClick={handleBroadcast}
                disabled={isBroadcasting || !broadcastMessage.trim()}
                className="w-full py-4 rounded-xl bg-amber-500 text-black font-bold uppercase tracking-widest text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                {isBroadcasting ? 'Sending...' : 'Send Broadcast'} <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
