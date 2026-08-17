import React, { useState, useEffect } from 'react';
import { Send, Bell, Smartphone, Monitor, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Wrench, Info, ExternalLink } from 'lucide-react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { requestFCMToken, runFCMDiagnostics, FCMDiagnosticReport } from '../lib/fcm';
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

  const [diagRunning, setDiagRunning] = useState(false);
  const [diagReport, setDiagReport] = useState<FCMDiagnosticReport | null>(null);
  const [swEvents, setSwEvents] = useState<{ bgReceived?: boolean; displayAttempted?: boolean; lastMsg?: any }>({});

  useEffect(() => {
    // Listen for Service Worker telemetry events
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('laxmi_fcm_sw_channel');
        channel.onmessage = (event) => {
          const { type, data } = event.data || {};
          if (type === 'BACKGROUND_MESSAGE_RECEIVED') {
            setSwEvents(prev => ({ ...prev, bgReceived: true, lastMsg: data }));
          } else if (type === 'NOTIFICATION_DISPLAY_ATTEMPTED') {
            setSwEvents(prev => ({ ...prev, displayAttempted: true }));
          }
        };
      }
    } catch (e) {}

    const handleSwMessage = (event: MessageEvent) => {
      const { type, data } = event.data || {};
      if (type === 'BACKGROUND_MESSAGE_RECEIVED') {
        setSwEvents(prev => ({ ...prev, bgReceived: true, lastMsg: data }));
      } else if (type === 'NOTIFICATION_DISPLAY_ATTEMPTED') {
        setSwEvents(prev => ({ ...prev, displayAttempted: true }));
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      if (channel) channel.close();
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  const runDiagnostics = async () => {
    setDiagRunning(true);
    try {
      const report = await runFCMDiagnostics(user?.uid || 'admin_diag', user?.email || 'admin@laxmiartworks.local');
      setDiagReport(report);
      fetchTokenStats();
    } catch (e: any) {
      console.error('Diagnostics error:', e);
    } finally {
      setDiagRunning(false);
    }
  };

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
      if (res.ok && data.success) {
        const msgId = data.messageId || 'FCM-ACCEPTED';
        const tokenPreview = data.tokenPreview || (myToken.substring(0, 8) + '...' + myToken.substring(myToken.length - 6));
        alert(`FCM Message Accepted\n\n• Firebase Message ID: ${msgId}\n• Target FCM Token: ${tokenPreview}\n• Status: Firebase Admin SDK accepted the message for delivery.`);
      } else {
        alert(`❌ Test push failed: ${data.error || 'Server error'} (Code: ${data.code || 'FCM_ERROR'})`);
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

      {/* Internal Diagnostics & Health Tool */}
      <div className="bg-neutral-900 border border-white/10 p-6 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wrench className="text-amber-400" size={16} /> FCM Setup & Worker Diagnostics
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Verifies browser permissions, service worker readiness, VAPID key, and token registration.
            </p>
          </div>
          <button
            type="button"
            onClick={runDiagnostics}
            disabled={diagRunning}
            className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {diagRunning ? <RefreshCw className="animate-spin" size={14} /> : <Wrench size={14} />}
            {diagRunning ? 'Checking Diagnostics...' : 'Run Diagnostics'}
          </button>
        </div>

        {diagReport && (
          <div className="p-4 bg-black/40 border border-white/10 rounded-2xl space-y-4 text-xs">
            {/* Core Diagnostics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-neutral-900 border border-white/5 rounded-xl">
                <span className="text-neutral-500 text-[10px] uppercase font-bold block">Browser Permission</span>
                <span className={`font-bold ${diagReport.permission === 'granted' ? 'text-green-400' : 'text-amber-400'}`}>
                  {diagReport.permission}
                </span>
              </div>
              <div className="p-2.5 bg-neutral-900 border border-white/5 rounded-xl">
                <span className="text-neutral-500 text-[10px] uppercase font-bold block">Service Worker</span>
                <span className={`font-bold ${diagReport.serviceWorkerRegistered ? 'text-green-400' : 'text-red-400'}`}>
                  {diagReport.serviceWorkerRegistered ? 'Active (/firebase-messaging-sw.js)' : 'Not Found'}
                </span>
              </div>
              <div className="p-2.5 bg-neutral-900 border border-white/5 rounded-xl">
                <span className="text-neutral-500 text-[10px] uppercase font-bold block">VAPID Public Key</span>
                <span className={`font-bold ${diagReport.vapidKeyDetected ? 'text-green-400' : 'text-amber-400'}`}>
                  {diagReport.vapidKeyDetected ? 'Configured ✓' : 'Not Found ✕'}
                </span>
              </div>
              <div className="p-2.5 bg-neutral-900 border border-white/5 rounded-xl">
                <span className="text-neutral-500 text-[10px] uppercase font-bold block">Active FCM Token</span>
                <span className={`font-mono text-[11px] ${diagReport.fcmTokenGenerated ? 'text-green-400' : 'text-red-400'}`}>
                  {diagReport.tokenPreview || 'Not Generated'}
                </span>
              </div>
            </div>

            {/* Android OS Level Permission Notice */}
            <div className="p-3 bg-neutral-900/90 border border-amber-500/20 rounded-xl space-y-1 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Info size={14} /> Android Chrome OS-Level Setting Verification
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                If the browser permission above is <strong className="text-green-400">granted</strong> and Firebase returns a message ID, but no banner appears in your Android tray, verify that Android OS has notifications enabled for Chrome: <span className="font-mono text-neutral-200">Android Settings → Apps → Chrome → Notifications → Allow Notifications</span>.
              </p>
            </div>

            {/* Blocked Permission Resolution Guidance */}
            {diagReport.permission === 'denied' && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <AlertCircle size={15} /> Notifications Are Blocked in Browser Settings
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="px-2.5 py-1 bg-amber-500 text-black font-bold text-[10px] rounded-lg flex items-center gap-1 hover:bg-amber-400 transition-all shrink-0"
                  >
                    Open in New Tab <ExternalLink size={12} />
                  </button>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Web browsers do not allow re-prompting once permission is set to <em>Denied</em>. To unblock:
                </p>
                <ol className="list-decimal list-inside text-[11px] text-neutral-400 space-y-0.5 ml-1">
                  <li>Click the <strong>Lock / Site Settings</strong> icon in the address bar (or Android Chrome menu ⋮ → Site Settings → Notifications).</li>
                  <li>Toggle Notifications from <strong>Block</strong> to <strong>Allow</strong>.</li>
                  <li>Refresh this page or open in a new tab.</li>
                </ol>
              </div>
            )}

            {/* Backend IAM & Project State */}
            {diagReport.serverTargetProjectId && (
              <div className="p-3 bg-neutral-900/90 border border-white/10 rounded-xl space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-neutral-400 font-medium">Server Target Project:</span>
                  <span className="font-mono text-amber-400">{diagReport.serverTargetProjectId}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-neutral-400 font-medium">Service Account:</span>
                  <span className="font-mono text-neutral-300">{diagReport.serverServiceAccountEmail}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-neutral-400 font-medium">Required IAM Permission:</span>
                  <span className="font-mono text-neutral-200">
                    {diagReport.serverRequiredIAMPermission} ({diagReport.serverRequiredIAMRole})
                  </span>
                </div>
              </div>
            )}

            {diagReport.error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl">
                <strong>Diagnostic Note:</strong> {diagReport.error}
              </div>
            )}
          </div>
        )}
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
