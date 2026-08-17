import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Bell, 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Wrench, 
  Info, 
  ExternalLink,
  Copy,
  Check,
  Radio,
  Terminal,
  Activity,
  Zap,
  KeyRound,
  RotateCcw
} from 'lucide-react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  requestFCMToken, 
  regenerateFCMToken, 
  runFCMDiagnostics, 
  onForegroundMessage,
  FCMDiagnosticReport 
} from '../lib/fcm';
import { useAuth } from '../lib/auth';

interface DiagnosticRunState {
  diagnosticId: string;
  triggeredAt: string;
  backendStatus: 'IDLE' | 'SENDING' | 'REQUEST_ACCEPTED' | 'REQUEST_FAILED';
  backendResponse?: any;
  backendError?: string;
  firebaseMessageId?: string;
  swReceived: boolean;
  swReceivedAt?: string;
  swReceivedPayload?: any;
  swShown: boolean;
  swShownAt?: string;
  swShownSuccess?: boolean;
  swShownError?: string;
  fgReceived: boolean;
  fgReceivedAt?: string;
  fgReceivedPayload?: any;
}

export default function AdminBroadcast() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'broadcast'>('diagnostics');
  
  // Device count
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  
  // Broadcast Form
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [targetType, setTargetType] = useState<'topic' | 'tokens'>('topic');
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  // Runtime Diagnostics State
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagReport, setDiagReport] = useState<FCMDiagnosticReport | null>(null);
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const [probeSending, setProbeSending] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Current Live Diagnostic Probe Run
  const [activeDiag, setActiveDiag] = useState<DiagnosticRunState | null>(null);
  const activeDiagRef = useRef<DiagnosticRunState | null>(null);
  activeDiagRef.current = activeDiag;

  // Diagnostic Event History
  const [diagLog, setDiagLog] = useState<Array<{ timestamp: string; level: 'info' | 'success' | 'warn' | 'error'; message: string; data?: any }>>([]);

  const addLog = (level: 'info' | 'success' | 'warn' | 'error', message: string, data?: any) => {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data
    };
    setDiagLog(prev => [entry, ...prev.slice(0, 49)]);
  };

  // 1. Setup Listeners for Service Worker Messages & Foreground Messaging
  useEffect(() => {
    addLog('info', 'Initializing Service Worker telemetry & Foreground Message listeners...');
    
    // BroadcastChannel Listener
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('laxmi_fcm_sw_channel');
        channel.onmessage = (event) => {
          handleSwPayload(event.data);
        };
      }
    } catch (e) {}

    // Window Service Worker Message Listener
    const handleWindowSwMessage = (event: MessageEvent) => {
      handleSwPayload(event.data);
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleWindowSwMessage);
    }

    // Foreground Firebase Messaging listener
    let unsubscribeFg: (() => void) | null = null;
    onForegroundMessage((payload) => {
      const fgDiagId = payload.data?.diagnosticId || payload.diagnosticId || '';
      console.log('[FCM Foreground] Message received in active page:', { fgDiagId, payload });
      addLog('success', `FCM FOREGROUND MESSAGE RECEIVED [${fgDiagId || 'no-id'}]`, payload);

      setActiveDiag(prev => {
        if (!prev) return prev;
        if (!fgDiagId || prev.diagnosticId === fgDiagId) {
          return {
            ...prev,
            fgReceived: true,
            fgReceivedAt: new Date().toLocaleTimeString(),
            fgReceivedPayload: payload
          };
        }
        return prev;
      });
    }).then(unsub => {
      unsubscribeFg = unsub;
    }).catch(() => {});

    function handleSwPayload(data: any) {
      if (!data) return;
      const { type, diagnosticId, title: msgTitle, success, error, payload } = data;

      if (type === 'FCM_SW_MESSAGE_RECEIVED') {
        console.log('[SW Telemetry] FCM_SW_MESSAGE_RECEIVED:', { diagnosticId, payload });
        addLog('success', `FCM SERVICE WORKER RECEIVED MESSAGE [${diagnosticId || 'unknown'}]`, payload);
        
        setActiveDiag(prev => {
          if (!prev) return prev;
          if (!diagnosticId || prev.diagnosticId === diagnosticId) {
            return {
              ...prev,
              swReceived: true,
              swReceivedAt: new Date().toLocaleTimeString(),
              swReceivedPayload: payload
            };
          }
          return prev;
        });
      } else if (type === 'FCM_SW_NOTIFICATION_SHOWN') {
        console.log('[SW Telemetry] FCM_SW_NOTIFICATION_SHOWN:', { diagnosticId, success, error });
        if (success) {
          addLog('success', `DELIVERY_CONFIRMED_BY_SW: Notification shown successfully [${diagnosticId || 'unknown'}] (${msgTitle || ''})`);
        } else {
          addLog('error', `DELIVERY_FAILED_AT_SW: Notification display failed [${diagnosticId || 'unknown'}]: ${error}`);
        }

        setActiveDiag(prev => {
          if (!prev) return prev;
          if (!diagnosticId || prev.diagnosticId === diagnosticId) {
            return {
              ...prev,
              swShown: true,
              swShownAt: new Date().toLocaleTimeString(),
              swShownSuccess: success,
              swShownError: error
            };
          }
          return prev;
        });
      }
    }

    return () => {
      if (channel) channel.close();
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleWindowSwMessage);
      }
      if (unsubscribeFg) {
        unsubscribeFg();
      }
    };
  }, []);

  // Fetch token counts
  const fetchTokenStats = async () => {
    setLoadingStats(true);
    try {
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
      console.warn('Server fcm-stats notice:', apiErr);
    }

    try {
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
      setTokenCount(tokenSet.size);
    } catch (err) {
      console.error('Failed to count FCM tokens:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const refreshDiagnostics = async () => {
    setDiagRunning(true);
    addLog('info', 'Refreshing FCM runtime diagnostics...');
    try {
      const report = await runFCMDiagnostics(user?.uid || 'admin_diag', user?.email || 'admin@laxmiartworks.local');
      setDiagReport(report);
      addLog('info', 'Runtime diagnostics updated.', {
        permission: report.permission,
        origin: report.origin,
        fcmToken: report.tokenPreview,
        swScope: report.serviceWorkerScope
      });
      fetchTokenStats();
    } catch (e: any) {
      addLog('error', `Diagnostics refresh error: ${e.message}`);
    } finally {
      setDiagRunning(false);
    }
  };

  useEffect(() => {
    refreshDiagnostics();
  }, []);

  // 2. Trigger Diagnostic Delivery Probe Test
  const handleRunDeliveryDiagnostic = async () => {
    const diagnosticId = `diag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setProbeSending(true);
    
    // Initialize or get current token
    let targetToken = diagReport?.currentToken || localStorage.getItem('fcm_last_token') || '';
    if (!targetToken) {
      addLog('info', 'Target token not in memory, requesting fresh token...');
      const reqRes = await requestFCMToken(user?.uid || 'admin_diag', user?.email || 'admin@laxmiartworks.local');
      if (reqRes.success && reqRes.token) {
        targetToken = reqRes.token;
      } else {
        addLog('error', `Cannot run diagnostic: ${reqRes.error || 'Token acquisition failed'}`);
        setProbeSending(false);
        return;
      }
    }

    const testState: DiagnosticRunState = {
      diagnosticId,
      triggeredAt: new Date().toLocaleTimeString(),
      backendStatus: 'SENDING',
      swReceived: false,
      swShown: false,
      fgReceived: false
    };
    setActiveDiag(testState);
    addLog('info', `DISPATCHING FCM DIAGNOSTIC PROBE [${diagnosticId}] to token: ${targetToken.substring(0, 10)}...`);

    try {
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: targetToken,
          title: `[DIAG ${diagnosticId.slice(-6)}] Delivery Test`,
          body: `FCM Probe dispatched from ${window.location.origin} at ${new Date().toLocaleTimeString()}`,
          url: `/?diag=${diagnosticId}`,
          diagnosticId,
          data: {
            diagnosticId,
            title: `[DIAG ${diagnosticId.slice(-6)}] Delivery Test`,
            body: `FCM Probe dispatched from ${window.location.origin} at ${new Date().toLocaleTimeString()}`,
            url: `/?diag=${diagnosticId}`
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addLog('success', `REQUEST_ACCEPTED by Firebase Admin SDK: Message ID ${data.messageId || 'unknown'}`, data);
        setActiveDiag(prev => prev && prev.diagnosticId === diagnosticId ? {
          ...prev,
          backendStatus: 'REQUEST_ACCEPTED',
          backendResponse: data,
          firebaseMessageId: data.messageId
        } : prev);
      } else {
        addLog('error', `REQUEST_FAILED by Backend / FCM: ${data.error || 'Unknown error'} (Code: ${data.code || 'FCM_ERROR'})`, data);
        setActiveDiag(prev => prev && prev.diagnosticId === diagnosticId ? {
          ...prev,
          backendStatus: 'REQUEST_FAILED',
          backendError: data.error || 'FCM Request Rejected',
          backendResponse: data
        } : prev);
      }
    } catch (err: any) {
      addLog('error', `Network error during probe send: ${err.message}`);
      setActiveDiag(prev => prev && prev.diagnosticId === diagnosticId ? {
        ...prev,
        backendStatus: 'REQUEST_FAILED',
        backendError: err.message
      } : prev);
    } finally {
      setProbeSending(false);
    }
  };

  // 3. Regenerate Test Token explicitly
  const handleRegenerateToken = async () => {
    if (!confirm('Regenerate a clean test FCM token now?\n\nThis will delete the current token from Firebase Messaging, refresh service worker registrations, request permission if needed, and generate a fresh token.')) {
      return;
    }
    setRegeneratingToken(true);
    addLog('info', 'Regenerating FCM test token...');
    try {
      const res = await regenerateFCMToken(user?.uid || 'admin_diag', user?.email || 'admin@laxmiartworks.local');
      if (res.success && res.token) {
        addLog('success', `Fresh FCM Token Generated: ${res.token.substring(0, 16)}...`);
        alert(`✅ Fresh FCM Token Generated successfully!\n\nToken Preview: ${res.token.substring(0, 24)}...`);
      } else {
        addLog('error', `Token regeneration failed: ${res.error}`);
        alert(`❌ Failed to regenerate token: ${res.error}`);
      }
      await refreshDiagnostics();
    } catch (err: any) {
      addLog('error', `Token regeneration exception: ${err.message}`);
    } finally {
      setRegeneratingToken(false);
    }
  };

  // 4. Generate & Copy Diagnostic Report
  const handleCopyDiagnosticReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      runtimeEnvironment: {
        windowLocationOrigin: window.location.origin,
        notificationPermission: typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
        swControllerScriptURL: navigator.serviceWorker?.controller?.scriptURL || 'None (Uncontrolled)',
        serviceWorkerScope: diagReport?.serviceWorkerScope || 'Unknown',
        serviceWorkerActiveScriptURL: diagReport?.serviceWorkerActiveScriptURL || 'Unknown',
        serviceWorkerControlling: !!navigator.serviceWorker?.controller
      },
      firebaseConfig: {
        projectId: diagReport?.projectId || "laxmi-artworks",
        messagingSenderId: diagReport?.messagingSenderId || "598865578283",
        vapidKeyDetected: diagReport?.vapidKeyDetected ?? false,
        vapidSource: diagReport?.vapidSource || 'default'
      },
      tokenDetails: {
        currentToken: diagReport?.currentToken || localStorage.getItem('fcm_last_token') || 'None',
        tokenCreatedAt: diagReport?.tokenCreatedAt || 'Unknown',
        tokenGenerated: diagReport?.fcmTokenGenerated ?? false,
        firestoreSaved: diagReport?.firestoreSaved ?? false,
        backendRegistered: diagReport?.backendRegistered ?? false
      },
      serverBackendAdminSDK: {
        serverTargetProjectId: diagReport?.serverTargetProjectId || 'laxmi-artworks',
        serverServiceAccountEmail: diagReport?.serverServiceAccountEmail || 'ADC',
        serverRequiredIAMPermission: diagReport?.serverRequiredIAMPermission || 'cloudmessaging.messages.create',
        serverRequiredIAMRole: diagReport?.serverRequiredIAMRole || 'roles/firebasecloudmessaging.admin',
        serverFcmHttpApiStatus: diagReport?.serverFcmHttpApiStatus || 'unknown'
      },
      latestDiagnosticProbe: activeDiag ? {
        diagnosticId: activeDiag.diagnosticId,
        triggeredAt: activeDiag.triggeredAt,
        backendStatus: activeDiag.backendStatus,
        firebaseMessageId: activeDiag.firebaseMessageId || 'N/A',
        swReceived: activeDiag.swReceived ? `YES (${activeDiag.swReceivedAt})` : 'NO',
        deliveryConfirmedBySW: activeDiag.swShown ? `YES (${activeDiag.swShownAt})` : 'NO',
        foregroundReceived: activeDiag.fgReceived ? `YES (${activeDiag.fgReceivedAt})` : 'NO',
        backendResponse: activeDiag.backendResponse
      } : 'No probe executed in current session'
    };

    const formattedReport = `================================================
LAXMI ARTWORKS — FCM DELIVERY DIAGNOSTIC REPORT
Generated: ${new Date().toLocaleString()}
================================================

[1. RUNTIME BROWSER & ORIGIN]
• window.location.origin: ${reportData.runtimeEnvironment.windowLocationOrigin}
• Notification.permission: ${reportData.runtimeEnvironment.notificationPermission}
• SW Controller Script: ${reportData.runtimeEnvironment.swControllerScriptURL}
• SW Registration Scope: ${reportData.runtimeEnvironment.serviceWorkerScope}
• SW Active Script URL: ${reportData.runtimeEnvironment.serviceWorkerActiveScriptURL}
• SW Controlling Page: ${reportData.runtimeEnvironment.serviceWorkerControlling ? 'YES' : 'NO'}

[2. FIREBASE CLIENT CONFIGURATION]
• Firebase projectId: ${reportData.firebaseConfig.projectId}
• Firebase messagingSenderId: ${reportData.firebaseConfig.messagingSenderId}
• VAPID Key Available: ${reportData.firebaseConfig.vapidKeyDetected ? 'YES' : 'NO'} (${reportData.firebaseConfig.vapidSource})

[3. ACTIVE FCM TOKEN STATE]
• Token Created At: ${reportData.tokenDetails.tokenCreatedAt}
• Current FCM Token: ${reportData.tokenDetails.currentToken}
• Firestore Saved: ${reportData.tokenDetails.firestoreSaved ? 'YES' : 'NO'}
• Backend Registered: ${reportData.tokenDetails.backendRegistered ? 'YES' : 'NO'}

[4. SERVER-SIDE FIREBASE ADMIN SDK]
• Target Project ID: ${reportData.serverBackendAdminSDK.serverTargetProjectId}
• Service Account: ${reportData.serverBackendAdminSDK.serverServiceAccountEmail}
• Required IAM Role: ${reportData.serverBackendAdminSDK.serverRequiredIAMRole}
• IAM Permission: ${reportData.serverBackendAdminSDK.serverRequiredIAMPermission}
• FCM HTTP v1 API Status: ${reportData.serverBackendAdminSDK.serverFcmHttpApiStatus}

[5. RUNTIME DELIVERY PROBE RESULTS]
${activeDiag ? `• Diagnostic ID: ${activeDiag.diagnosticId}
• Backend Status: ${activeDiag.backendStatus} (Firebase Msg ID: ${activeDiag.firebaseMessageId || 'N/A'})
• FCM Service Worker Received Message: ${activeDiag.swReceived ? `YES at ${activeDiag.swReceivedAt}` : 'NO / Awaiting'}
• DELIVERY CONFIRMED BY SW: ${activeDiag.swShown ? `YES (Notification displayed at ${activeDiag.swShownAt})` : 'NO / Awaiting'}
• Foreground Page Received: ${activeDiag.fgReceived ? `YES at ${activeDiag.fgReceivedAt}` : 'NO'}` : '• No diagnostic probe run yet'}

================================================
RAW JSON DATA:
${JSON.stringify(reportData, null, 2)}
`;

    navigator.clipboard.writeText(formattedReport).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    });
  };

  // 5. Broadcast Push Handler
  const handleBroadcast = async () => {
    setShowConfirm(false);
    setIsSending(true);
    setBroadcastResult(null);

    try {
      let payload: any = { title, body, url };

      if (targetType === 'topic') {
        payload.topic = 'all_users';
      } else {
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

        payload.tokens = Array.from(tokenSet);
        if (payload.tokens.length === 0) {
          setBroadcastResult({ success: false, message: 'No registered push notification devices found.' });
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
        setBroadcastResult({
          success: true,
          message: targetType === 'topic' 
            ? 'Broadcast accepted for FCM Topic ("all_users")!' 
            : `Broadcast accepted for ${data.response?.successCount || payload.tokens?.length || 0} registered devices!`,
          details: data.response
        });
        setTitle('');
        setBody('');
        setUrl('/');
        fetchTokenStats();
      } else {
        setBroadcastResult({
          success: false,
          message: `Broadcast rejected: ${data.error || 'Server error'}`
        });
      }
    } catch (err: any) {
      setBroadcastResult({
        success: false,
        message: `Network/Server Error: ${err.message}`
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Navigation & Stats Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900 border border-white/10 p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Activity size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                FCM Delivery Diagnostics & Broadcast
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Real-time runtime verification of Service Worker delivery, Admin SDK, and Chrome Android push channels.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Toggle & Stats */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-black/40 border border-white/10 rounded-2xl">
            <button
              id="tab-diagnostics"
              onClick={() => setActiveTab('diagnostics')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'diagnostics' 
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Wrench size={14} /> Live Diagnostics
            </button>
            <button
              id="tab-broadcast"
              onClick={() => setActiveTab('broadcast')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'broadcast' 
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Bell size={14} /> Send Broadcast
            </button>
          </div>

          <div className="flex items-center gap-3 bg-black/40 border border-white/5 px-4 py-2.5 rounded-2xl">
            <Smartphone size={16} className="text-amber-500" />
            <div>
              <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold block">Subscribed</span>
              <div className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                {loadingStats ? <RefreshCw className="animate-spin text-amber-500" size={10} /> : tokenCount} devices
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: RUNTIME DELIVERY DIAGNOSTICS */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 border border-white/10 p-4 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                id="btn-run-delivery-probe"
                type="button"
                onClick={handleRunDeliveryDiagnostic}
                disabled={probeSending || diagRunning}
                className="px-5 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {probeSending ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                {probeSending ? 'Dispatching Test Probe...' : 'Send Runtime Delivery Diagnostic Probe'}
              </button>

              <button
                id="btn-regenerate-token"
                type="button"
                onClick={handleRegenerateToken}
                disabled={regeneratingToken || probeSending}
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {regeneratingToken ? <RefreshCw className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                {regeneratingToken ? 'Regenerating...' : 'Regenerate Test Token'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-refresh-diag"
                type="button"
                onClick={refreshDiagnostics}
                disabled={diagRunning}
                className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-neutral-400 hover:text-amber-400 transition-colors"
                title="Refresh Status"
              >
                <RefreshCw size={14} className={diagRunning ? 'animate-spin text-amber-500' : ''} />
              </button>

              <button
                id="btn-copy-report"
                type="button"
                onClick={handleCopyDiagnosticReport}
                className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {copiedReport ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copiedReport ? 'Report Copied!' : 'COPY DIAGNOSTIC REPORT'}
              </button>
            </div>
          </div>

          {/* Real-time Delivery Status Board */}
          <div className="bg-neutral-900 border border-white/10 p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="text-amber-400 animate-pulse" size={16} /> Runtime Probe Lifecycle Status
              </h3>
              <span className="text-[11px] font-mono text-neutral-400">
                Active ID: <strong className="text-amber-400">{activeDiag?.diagnosticId || 'None (Click probe to test)'}</strong>
              </span>
            </div>

            {/* 3-Stage Delivery Progression */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              
              {/* Stage 1: Backend Request */}
              <div className={`p-4 rounded-2xl border transition-all ${
                !activeDiag 
                  ? 'bg-black/30 border-white/5 text-neutral-500'
                  : activeDiag.backendStatus === 'REQUEST_ACCEPTED'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : activeDiag.backendStatus === 'REQUEST_FAILED'
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Stage 1: Backend API</span>
                  {activeDiag?.backendStatus === 'REQUEST_ACCEPTED' && <CheckCircle2 size={16} />}
                  {activeDiag?.backendStatus === 'REQUEST_FAILED' && <AlertCircle size={16} />}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {activeDiag?.backendStatus || 'Awaiting Probe'}
                </div>
                <p className="text-[11px] mt-1.5 text-neutral-300 leading-relaxed">
                  {activeDiag?.backendStatus === 'REQUEST_ACCEPTED' 
                    ? `Admin SDK accepted message (ID: ${activeDiag.firebaseMessageId?.slice(-12) || 'OK'}). Note: Delivery is NOT confirmed until SW reports.` 
                    : activeDiag?.backendStatus === 'REQUEST_FAILED'
                      ? `Failed: ${activeDiag.backendError || 'Server Error'}`
                      : 'Dispatches payload via POST /api/send-push'}
                </p>
              </div>

              {/* Stage 2: Service Worker Message Receipt */}
              <div className={`p-4 rounded-2xl border transition-all ${
                !activeDiag 
                  ? 'bg-black/30 border-white/5 text-neutral-500'
                  : activeDiag.swReceived
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : activeDiag.backendStatus === 'REQUEST_ACCEPTED'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-black/30 border-white/5 text-neutral-500'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Stage 2: Service Worker</span>
                  {activeDiag?.swReceived && <CheckCircle2 size={16} />}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {activeDiag?.swReceived ? 'FCM SERVICE WORKER RECEIVED MESSAGE' : 'AWAITING_SW_EVENT'}
                </div>
                <p className="text-[11px] mt-1.5 text-neutral-300 leading-relaxed">
                  {activeDiag?.swReceived 
                    ? `Background push captured by /firebase-messaging-sw.js at ${activeDiag.swReceivedAt}.` 
                    : activeDiag?.backendStatus === 'REQUEST_ACCEPTED'
                      ? 'Listening for BroadcastChannel / postMessage from Service Worker...'
                      : 'Awaiting push transmission'}
                </p>
              </div>

              {/* Stage 3: Notification Presentation Confirmation */}
              <div className={`p-4 rounded-2xl border transition-all ${
                !activeDiag 
                  ? 'bg-black/30 border-white/5 text-neutral-500'
                  : activeDiag.swShown
                    ? activeDiag.swShownSuccess 
                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                    : activeDiag.backendStatus === 'REQUEST_ACCEPTED'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-black/30 border-white/5 text-neutral-500'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Stage 3: Notification Display</span>
                  {activeDiag?.swShown && activeDiag.swShownSuccess && <CheckCircle2 size={16} />}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {activeDiag?.swShown 
                    ? activeDiag.swShownSuccess ? 'DELIVERY_CONFIRMED_BY_SW' : 'SW_NOTIFICATION_ERROR'
                    : 'AWAITING_CONFIRMATION'}
                </div>
                <p className="text-[11px] mt-1.5 text-neutral-300 leading-relaxed">
                  {activeDiag?.swShown && activeDiag.swShownSuccess
                    ? `self.registration.showNotification() resolved successfully at ${activeDiag.swShownAt}!`
                    : activeDiag?.swShown && !activeDiag.swShownSuccess
                      ? `Notification presentation error: ${activeDiag.swShownError}`
                      : 'Real delivery confirmed only when showNotification() callback completes.'}
                </p>
              </div>

            </div>

            {/* Foreground Listener status note if foreground page caught it */}
            {activeDiag?.fgReceived && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between text-xs text-blue-300">
                <span className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> FCM FOREGROUND MESSAGE RECEIVED
                </span>
                <span className="text-[11px] font-mono text-neutral-300">
                  Received at {activeDiag.fgReceivedAt} in active tab
                </span>
              </div>
            )}
          </div>

          {/* Core Runtime Parameters Grid (Requirements A & J) */}
          <div className="bg-neutral-900 border border-white/10 p-6 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <KeyRound className="text-amber-400" size={16} /> Runtime Environment Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              
              {/* window.location.origin */}
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">window.location.origin</span>
                <div className="font-mono text-amber-400 break-all font-semibold">
                  {typeof window !== 'undefined' ? window.location.origin : 'N/A'}
                </div>
              </div>

              {/* Notification.permission */}
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Notification.permission</span>
                <div className={`font-bold uppercase ${
                  diagReport?.permission === 'granted' ? 'text-green-400' : 'text-amber-400'
                }`}>
                  {diagReport?.permission || 'unsupported'}
                </div>
              </div>

              {/* Service Worker Scope */}
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">SW Registration Scope</span>
                <div className="font-mono text-neutral-200 break-all">
                  {diagReport?.serviceWorkerScope || '/'}
                </div>
              </div>

              {/* SW Controller State */}
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">SW Controller Script</span>
                <div className="font-mono text-neutral-300 truncate" title={diagReport?.swControllerScriptURL || 'None'}>
                  {diagReport?.swControllerScriptURL ? diagReport.swControllerScriptURL.split('/').pop() : 'None (Active on SW)'}
                </div>
              </div>

              {/* Active Script URL */}
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Active SW Script URL</span>
                <div className="font-mono text-neutral-300 truncate" title={diagReport?.serviceWorkerActiveScriptURL || 'N/A'}>
                  {diagReport?.serviceWorkerActiveScriptURL || '/firebase-messaging-sw.js'}
                </div>
              </div>

              {/* Firebase Project ID */}
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Firebase Project ID</span>
                <div className="font-mono text-amber-400 font-semibold">
                  {diagReport?.projectId || "laxmi-artworks"}
                </div>
              </div>

              {/* Messaging Sender ID */}
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Messaging Sender ID</span>
                <div className="font-mono text-neutral-200">
                  {diagReport?.messagingSenderId || "598865578283"}
                </div>
              </div>

              {/* Token Creation Time */}
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">Token Created At</span>
                <div className="text-neutral-300">
                  {diagReport?.tokenCreatedAt || 'Current Session'}
                </div>
              </div>

            </div>

            {/* Current Active FCM Token (Full Display) */}
            <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-neutral-400">Current Target FCM Token</span>
                <button
                  type="button"
                  onClick={() => {
                    const t = diagReport?.currentToken || localStorage.getItem('fcm_last_token') || '';
                    if (t) {
                      navigator.clipboard.writeText(t);
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 2000);
                    }
                  }}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1"
                >
                  {copiedToken ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copiedToken ? 'Copied Token' : 'Copy Full Token'}
                </button>
              </div>
              <div className="p-2.5 bg-neutral-950 border border-white/5 rounded-xl font-mono text-[11px] text-green-400 break-all select-all">
                {diagReport?.currentToken || localStorage.getItem('fcm_last_token') || 'No FCM token registered in current session'}
              </div>
            </div>

            {/* Server-Side Admin SDK & Service Account Verification (Requirement J) */}
            <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Backend Firebase Admin SDK Configuration</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-2.5 bg-neutral-900/80 border border-white/5 rounded-xl">
                  <span className="text-neutral-500 text-[10px] uppercase font-bold block">Admin SDK Project</span>
                  <span className="font-mono text-amber-400 font-bold">{diagReport?.serverTargetProjectId || 'laxmi-artworks'}</span>
                </div>
                <div className="p-2.5 bg-neutral-900/80 border border-white/5 rounded-xl">
                  <span className="text-neutral-500 text-[10px] uppercase font-bold block">Service Account</span>
                  <span className="font-mono text-neutral-300 truncate block" title={diagReport?.serverServiceAccountEmail || 'ADC'}>
                    {diagReport?.serverServiceAccountEmail || 'Application Default Credentials'}
                  </span>
                </div>
                <div className="p-2.5 bg-neutral-900/80 border border-white/5 rounded-xl">
                  <span className="text-neutral-500 text-[10px] uppercase font-bold block">FCM HTTP v1 API & IAM Status</span>
                  <span className="font-mono text-green-400 font-bold">{diagReport?.serverFcmHttpApiStatus || 'Authorized'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Live Diagnostic Event Stream Log */}
          <div className="bg-neutral-900 border border-white/10 p-6 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="text-neutral-400" size={16} /> Live Diagnostic Event Log
              </h3>
              <button
                type="button"
                onClick={() => setDiagLog([])}
                className="text-[11px] text-neutral-500 hover:text-neutral-300"
              >
                Clear Log
              </button>
            </div>

            <div className="p-3 bg-black/60 border border-white/5 rounded-2xl font-mono text-[11px] max-h-60 overflow-y-auto space-y-1.5">
              {diagLog.length === 0 ? (
                <div className="text-neutral-600 italic py-2">No events logged yet. Click "Send Runtime Delivery Diagnostic Probe" to test.</div>
              ) : (
                diagLog.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-neutral-500 shrink-0">[{log.timestamp}]</span>
                    <span className={`shrink-0 uppercase font-bold text-[9px] px-1 py-0.5 rounded ${
                      log.level === 'success' ? 'bg-green-500/20 text-green-400' :
                      log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                      log.level === 'warn' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-white/10 text-neutral-300'
                    }`}>
                      {log.level}
                    </span>
                    <span className={`${
                      log.level === 'success' ? 'text-green-300' :
                      log.level === 'error' ? 'text-red-300' :
                      log.level === 'warn' ? 'text-amber-300' :
                      'text-neutral-300'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: BROADCAST NOTIFICATION */}
      {activeTab === 'broadcast' && (
        <div className="bg-neutral-900 border border-white/10 p-6 rounded-3xl space-y-5 animate-in fade-in">
          
          {broadcastResult && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
              broadcastResult.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {broadcastResult.success ? <CheckCircle2 size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
              <div>
                <h4 className="font-bold text-sm">{broadcastResult.success ? 'Broadcast Accepted' : 'Broadcast Error'}</h4>
                <p className="text-xs mt-1 text-neutral-300">{broadcastResult.message}</p>
              </div>
            </div>
          )}

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
              onClick={handleRunDeliveryDiagnostic}
              disabled={probeSending}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 text-xs font-bold transition-colors disabled:opacity-50"
            >
              {probeSending ? 'Sending Test...' : 'Send Test Diagnostic Probe First'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!title.trim() || !body.trim()) {
                  alert('Please enter both Title and Message before broadcasting.');
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
      )}

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
              <p className="text-[10px] text-neutral-500">Target URL: {url}</p>
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
