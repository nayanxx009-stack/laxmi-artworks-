const fs = require('fs');
let code = fs.readFileSync('src/components/AdminChat.tsx', 'utf8');

const oldBroadcast = `  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setIsBroadcasting(true);
    try {
      let targets = [];
      if (broadcastTarget === 'all') {
        const chatsSnapshot = await getDocs(collection(db, 'chats'));
        targets = chatsSnapshot.docs.map(d => d.id);
      } else if (broadcastTarget === 'selected' && activeChat) {
        targets = [activeChat.id];
      }
      
      for (const targetId of targets) {
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
        sendPushToUser(targetId, 'Message from Laxmi Artworks', broadcastMessage, '/?chat=open');
      }
      setBroadcastMessage('');
      setShowBroadcastModal(false);
      alert(\`Broadcast sent to \${targets.length} user(s).\`);
    } catch (err) {
      console.error("Broadcast failed:", err);
      alert("Failed to send broadcast");
    }
    setIsBroadcasting(false);
  };`;

const newBroadcast = `  const handleBroadcast = async () => {
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
          const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/broadcast-push', {
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
      alert(\`Broadcast sent to \${targets.length} user(s).\\n\\nPush Stats:\\nDelivered: \${sentStats.success}\\nFailed: \${sentStats.failure}\`);
    } catch (err) {
      console.error("Broadcast failed:", err);
      alert("Failed to send broadcast");
    }
    setIsBroadcasting(false);
  };`;

// Also need to add premium/recent buttons
const oldButtons = `                <button 
                  onClick={() => setBroadcastTarget('all')}
                  className={\`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors \${broadcastTarget === 'all' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}\`}
                >
                  <Users size={16} /> All Users
                </button>
                <button 
                  onClick={() => setBroadcastTarget('selected')}
                  disabled={!activeChat}
                  className={\`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors \${broadcastTarget === 'selected' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'} \${!activeChat ? 'opacity-50 cursor-not-allowed' : ''}\`}
                >
                  <User size={16} /> Selected User
                </button>`;

const newButtons = `                <button 
                  onClick={() => setBroadcastTarget('all')}
                  className={\`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors \${broadcastTarget === 'all' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}\`}
                >
                  <Users size={14} /> All
                </button>
                <button 
                  onClick={() => setBroadcastTarget('selected')}
                  disabled={!activeChat}
                  className={\`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors \${broadcastTarget === 'selected' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'} \${!activeChat ? 'opacity-50 cursor-not-allowed' : ''}\`}
                >
                  <User size={14} /> Selected
                </button>
                <button 
                  onClick={() => setBroadcastTarget('premium')}
                  className={\`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors \${broadcastTarget === 'premium' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}\`}
                >
                  Premium
                </button>
                <button 
                  onClick={() => setBroadcastTarget('recent')}
                  className={\`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors \${broadcastTarget === 'recent' ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}\`}
                >
                  Recent
                </button>`;

if (code.includes(oldBroadcast) && code.includes(oldButtons)) {
  // We need to update broadcastTarget type
  code = code.replace(`const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'selected'>('all');`, `const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'selected' | 'premium' | 'recent'>('all');`);
  
  code = code.replace(oldBroadcast, newBroadcast);
  code = code.replace(oldButtons, newButtons);
  fs.writeFileSync('src/components/AdminChat.tsx', code);
  console.log("Updated AdminChat");
} else {
  console.log("Could not find targets");
}
