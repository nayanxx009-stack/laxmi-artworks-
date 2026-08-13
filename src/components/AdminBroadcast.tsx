import React, { useState, useEffect } from 'react';
import { Send, Bell, Smartphone, Monitor, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { requestFCMToken } from '../lib/fcm';
import { useAuth } from '../lib/auth';

export default function AdminBroadcast() {
  const { user } = useAuth();
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [targetType, setTargetType] = useState<'topic' | 'tokens'>('topic');
  
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [testSending, setTestSending] = useState(false);

  const fetchTokenStats = async () => {
    setLoadingStats(true);
    try {
      // 1. Try server-side admin stats first (accurate bypass of client permissions)
      const res = await fetch('/api/admin/fcm-stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success && typeof data.count === 'number') {
          setTokenCount(data.count);
          setLoadingStats(false);
          return;
        }
      }
    } catch (apiErr) {
      console.warn('Server fcm-stats notice, falling back to client firestore:', apiErr);
    }

    try {
      const tokenSet = new Set<string>();

      // Fetch from fcm_tokens
      const fcmDocs = await getDocs(collection(db, 'fcm_tokens'));
      fcmDocs.forEach(d => {
        const data = d.data();
        if (data.tokens && Array.isArray(data.tokens)) {
          data.tokens.forEach((t: string) => tokenSet.add(t));
        } else if (data.token) {
          tokenSet.add(data.token);
        }
      });

      // Fetch from users/*/notificationTokens subcollections
      const usersDocs = await getDocs(collection(db, 'users'));
      for (const uDoc of usersDocs.docs) {
        try {
          const subCol = await getDocs(collection(db, 'users', uDoc.id, 'notificationTokens'));
          subCol.forEach(tDoc => {
            const data = tDoc.data();
            if (data.token && data.enabled !== false) {
              tokenSet.add(data.token);
            }
          });
        } catch (e) {
          // ignore
        }
      }

      setTokenCount(tokenSet.size);
    } catch (err) {
      console.error('Failed to count FCM tokens:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchTokenStats();
  }, []);

  const handleSendTestPush = async () => {
    if (!title.trim() || !body.trim()) {
      alert('Please fill in both Title and Message first.');
      return;
    }
    setTestSending(true);
    try {
      const result = await requestFCMToken(user?.uid || 'admin_test', user?.email || 'admin@laxmiartworks.com');
      if (!result.success || !result.token) {
        alert(`Could not obtain FCM token for test device: ${result.error || 'Permission not granted'}`);
        setTestSending(false);
        return;
      }
      const myToken = result.token;
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: myToken, title: `[TEST] ${title}`, body, url })
      });
      const data = await res.json();
      if (data.success) {
        alert('Test notification sent to your current device successfully!');
      } else {
        alert(`Test push failed: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error sending test push: ${e.message}`);
    } finally {
      setTestSending(false);
    }
  };

  const handleBroadcast = async () => {
    setShowConfirm(false);
    setIsSending(true);
    setResult(null);

    try {
      let payload: any = { title, body, url };

      if (targetType === 'topic') {
        payload.topic = 'all_users';
      } else {
        // Collect all tokens
        const tokenSet = new Set<string>();
        const fcmDocs = await getDocs(collection(db, 'fcm_tokens'));
        fcmDocs.forEach(d => {
          const data = d.data();
          if (data.tokens && Array.isArray(data.tokens)) {
            data.tokens.forEach((t: string) => tokenSet.add(t));
          } else if (data.token) {
            tokenSet.add(data.token);
          }
        });

        const usersDocs = await getDocs(collection(db, 'users'));
        for (const uDoc of usersDocs.docs) {
          try {
            const subCol = await getDocs(collection(db, 'users', uDoc.id, 'notificationTokens'));
            subCol.forEach(tDoc => {
              const data = tDoc.data();
              if (data.token && data.enabled !== false) {
                tokenSet.add(data.token);
              }
            });
          } catch (e) {
            // ignore
          }
        }

        payload.tokens = Array.from(tokenSet);
        if (payload.tokens.length === 0) {
          setResult({ success: false, message: 'No registered push notification devices found.' });
          setIsSending(false);
          return;
        }
      }

      const res = await fetch('/api/broadcast-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({
          success: true,
          message: targetType === 'topic' 
            ? 'Broadcast sent via FCM Topic ("all_users") successfully!' 
            : `Broadcast sent to ${data.response?.successCount || payload.tokens.length} devices successfully!`,
          details: data.response
        });
        setTitle('');
        setBody('');
        setUrl('/');
        fetchTokenStats();
      } else {
        setResult({
          success: false,
          message: `Broadcast failed: ${data.error || 'Server error'}`
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: `Network/Server Error: ${err.message}`
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header & Device Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900 border border-white/10 p-6 rounded-3xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="text-amber-500" size={24} /> FCM Web Push Broadcast
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Send real-time Web Push notifications to all subscribed mobile Android and desktop browsers.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-black/40 border border-white/5 p-3 rounded-2xl">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Smartphone size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">Subscribed Devices</span>
            <div className="text-lg font-bold text-neutral-100 flex items-center gap-2">
              {loadingStats ? <RefreshCw className="animate-spin text-amber-500" size={14} /> : tokenCount}
              <button 
                onClick={fetchTokenStats} 
                className="text-neutral-500 hover:text-amber-500 text-xs transition-colors"
                title="Refresh count"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Result Alert */}
      {result && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-in fade-in ${result.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {result.success ? <CheckCircle2 size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
          <div>
            <h4 className="font-bold text-sm">{result.success ? 'Broadcast Success' : 'Broadcast Error'}</h4>
            <p className="text-xs mt-1 text-neutral-300">{result.message}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-neutral-900 border border-white/10 p-6 rounded-3xl space-y-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
            Notification Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Special Artwork Exhibition 🎨"
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
            Notification Message / Body *
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="e.g. Explore our brand new handmade oil paintings collection with special 20% commission discount!"
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Deep Link / Target URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. /#gallery or /?chat=open or /"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Delivery Mechanism
            </label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as any)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="topic">FCM Topic Broadcast ("all_users")</option>
              <option value="tokens">Multicast to All Subscribed Device Tokens</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={handleSendTestPush}
            disabled={testSending || !title.trim() || !body.trim()}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 text-xs font-bold transition-colors disabled:opacity-50"
          >
            {testSending ? 'Sending Test...' : 'Send Test Push To My Device'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!title.trim() || !body.trim()) {
                alert('Please enter both Title and Message before sending.');
                return;
              }
              setShowConfirm(true);
            }}
            disabled={isSending || !title.trim() || !body.trim()}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Send size={14} />
            {isSending ? 'Sending Broadcast...' : 'Broadcast Notification'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="text-amber-500" size={20} /> Confirm Web Push Broadcast
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to broadcast this notification to all subscribed users across Android phones and desktop browsers?
            </p>
            <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-xs space-y-1">
              <p className="font-bold text-amber-400">{title}</p>
              <p className="text-neutral-300">{body}</p>
              <p className="text-[10px] text-neutral-500">URL: {url}</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-neutral-400 text-xs hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleBroadcast}
                className="px-5 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400"
              >
                Yes, Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
