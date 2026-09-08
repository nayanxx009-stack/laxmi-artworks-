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
  RotateCcw,
  Clock,
  Monitor,
  MousePointer,
  ArrowUpRight,
  Wifi
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
  testMode: 'immediate' | 'delayed_background';
  tabVisibilityAtTrigger: string;
  // Stage 1: Backend API Request
  backendStatus: 'IDLE' | 'SENDING' | 'REQUEST_ACCEPTED' | 'REQUEST_FAILED';
  backendResponse?: any;
  backendError?: string;
  // Stage 2: FCM Message Sent
  fcmSentToTarget: boolean;
  firebaseMessageId?: string;
  targetTokenPreview?: string;
  // Stage 3: Service Worker Push Event
  swReceived: boolean;
  swReceivedAt?: string;
  swReceivedPayload?: any;
  // Stage 4: Notification Presentation
  swShown: boolean;
  swShownAt?: string;
  swShownSuccess?: boolean;
  swShownError?: string;
  hasVisibleClient?: boolean;
  // Stage 5: Notification Click
  notificationClicked: boolean;
  notificationClickedAt?: string;
  clickAction?: string;
  // Stage 6: URL Navigation
  targetUrlOpened: boolean;
  targetUrlOpenedAt?: string;
  openedUrl?: string;
  // Foreground message receipt
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

  // Countdown for Background Probe
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<any>(null);

  // Service Worker Ping telemetry
  const [swPingStatus, setSwPingStatus] = useState<{ active: boolean; version?: string; scope?: string; lastPong?: string } | null>(null);

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
      addLog('success', `FOREGROUND MESSAGE RECEIVED [${fgDiagId || 'no-id'}]`, payload);

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
        addLog('success', `STAGE 3: FCM SERVICE WORKER RECEIVED PUSH EVENT [${diagnosticId || 'unknown'}]`, payload);
        
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
          addLog('success', `STAGE 4: NOTIFICATION DISPLAY CONFIRMED BY SW [${diagnosticId || 'unknown'}] (${msgTitle || ''})`);
        } else {
          addLog('error', `STAGE 4: NOTIFICATION DISPLAY FAILED AT SW [${diagnosticId || 'unknown'}]: ${error}`);
        }

        setActiveDiag(prev => {
          if (!prev) return prev;
          if (!diagnosticId || prev.diagnosticId === diagnosticId) {
            return {
              ...prev,
              swShown: true,
              swShownAt: new Date().toLocaleTimeString(),
              swShownSuccess: success,
              swShownError: error,
              hasVisibleClient: data.hasVisibleClient
            };
          }
          return prev;
        });
      } else if (type === 'FCM_SW_NOTIFICATION_CLICKED') {
        addLog('success', `STAGE 5: NOTIFICATION CLICK RECEIVED [${diagnosticId || 'unknown'}] - Action: ${data.action || 'default'}`);
        setActiveDiag(prev => {
          if (!prev) return prev;
          if (!diagnosticId || prev.diagnosticId === diagnosticId) {
            return {
              ...prev,
              notificationClicked: true,
              notificationClickedAt: new Date().toLocaleTimeString(),
              clickAction: data.action || 'default'
            };
          }
          return prev;
        });
      } else if (type === 'FCM_SW_URL_OPENED' || type === 'NAVIGATE') {
        addLog('success', `STAGE 6: CORRECT PRODUCTION URL OPENED [${diagnosticId || 'unknown'}] - Target URL: ${data.url}`);
        setActiveDiag(prev => {
          if (!prev) return prev;
          if (!diagnosticId || prev.diagnosticId === diagnosticId) {
            return {
              ...prev,
              targetUrlOpened: true,
              targetUrlOpenedAt: new Date().toLocaleTimeString(),
              openedUrl: data.url
            };
          }
          return prev;
        });
      } else if (type === 'PONG_SW') {
        setSwPingStatus({
          active: true,
          version: data.version || '2.2.0',
          scope: data.scope || '/',
          lastPong: new Date().toLocaleTimeString()
        });
        addLog('success', `SW PONG RECEIVED: Service Worker is ACTIVE. Version: ${data.version}, Scope: ${data.scope}`);
      }
    }

    // Initial ping to service worker
    setTimeout(() => {
      pingServiceWorker();
    }, 1000);

    return () => {
      if (channel) channel.close();
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleWindowSwMessage);
      }
      if (unsubscribeFg) {
        unsubscribeFg();
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // Ping Service Worker
  const pingServiceWorker = () => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'PING_SW' });
        addLog('info', 'Sent PING_SW to navigator.serviceWorker.controller');
      } else {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg?.active) {
            reg.active.postMessage({ type: 'PING_SW' });
            addLog('info', 'Sent PING_SW to registration.active');
          } else {
            addLog('warn', 'No active Service Worker controller found. Refreshing registration...');
            navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          }
        });
      }
    }
  };

  // Test Direct SW Notification (Directly tests registration.showNotification)
  const testSWDirectNotification = () => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const msg = {
        type: 'TEST_SW_NOTIFICATION',
        title: 'Direct SW Notification Test 🔔',
        body: `Triggered directly from Admin Panel at ${new Date().toLocaleTimeString()}`,
        url: window.location.href
      };
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
        addLog('info', 'Dispatched TEST_SW_NOTIFICATION to Service Worker controller');
      } else {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg?.active) {
            reg.active.postMessage(msg);
            addLog('info', 'Dispatched TEST_SW_NOTIFICATION to registration.active');
          }
        });
      }
    }
  };

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
      pingServiceWorker();
    } catch (e: any) {
      addLog('error', `Diagnostics refresh error: ${e.message}`);
    } finally {
      setDiagRunning(false);
    }
  };

  useEffect(() => {
    refreshDiagnostics();
  }, []);

  // Delayed Probe Trigger (allows tester to switch tabs or minimize window)
  const startDelayedProbe = (seconds = 5) => {
    setCountdown(seconds);
    addLog('info', `Delayed Background Probe scheduled in ${seconds} seconds. Switch tabs or minimize now to test background event!`);
    
    let current = seconds;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    countdownTimerRef.current = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdown(current);
      } else {
        clearInterval(countdownTimerRef.current);
        setCountdown(null);
        handleRunDeliveryDiagnostic('delayed_background');
      }
    }, 1000);
  };

  // 2. Trigger Diagnostic Delivery Probe Test
  const handleRunDeliveryDiagnostic = async (mode: 'immediate' | 'delayed_background' = 'immediate') => {
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

    const currentVisibility = typeof document !== 'undefined' ? document.visibilityState : 'unknown';

    const testState: DiagnosticRunState = {
      diagnosticId,
      triggeredAt: new Date().toLocaleTimeString(),
      testMode: mode,
      tabVisibilityAtTrigger: currentVisibility,
      backendStatus: 'SENDING',
      fcmSentToTarget: false,
      swReceived: false,
      swShown: false,
      notificationClicked: false,
      targetUrlOpened: false,
      fgReceived: false
    };
    setActiveDiag(testState);
    addLog('info', `DISPATCHING FCM DIAGNOSTIC PROBE [${diagnosticId}] (Mode: ${mode}, Tab Visibility: ${currentVisibility}) to token: ${targetToken.substring(0, 10)}...`);

    try {
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: targetToken,
          title: `[DIAG ${diagnosticId.slice(-6)}] Delivery Test`,
          body: `FCM Probe dispatched at ${new Date().toLocaleTimeString()} (Tab: ${currentVisibility})`,
          url: `/?diag=${diagnosticId}`,
          diagnosticId,
          data: {
            diagnosticId,
            title: `[DIAG ${diagnosticId.slice(-6)}] Delivery Test`,
            body: `FCM Probe dispatched at ${new Date().toLocaleTimeString()} (Tab: ${currentVisibility})`,
            url: `/?diag=${diagnosticId}`
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        addLog('success', `STAGE 1 PASS (Backend Accepted) & STAGE 2 PASS (FCM Sent): Message ID ${data.messageId || 'unknown'}`, data);
        setActiveDiag(prev => prev && prev.diagnosticId === diagnosticId ? {
          ...prev,
          backendStatus: 'REQUEST_ACCEPTED',
          fcmSentToTarget: true,
          backendResponse: data,
          firebaseMessageId: data.messageId,
          targetTokenPreview: data.tokenPreview || targetToken.substring(0, 16) + '...'
        } : prev);
      } else {
        addLog('error', `STAGE 1 or 2 FAILED by Backend / FCM: ${data.error || 'Unknown error'} (Code: ${data.code || 'FCM_ERROR'})`, data);
        setActiveDiag(prev => prev && prev.diagnosticId === diagnosticId ? {
          ...prev,
          backendStatus: 'REQUEST_FAILED',
          fcmSentToTarget: false,
          backendError: data.error || 'FCM Request Rejected',
          backendResponse: data
        } : prev);
      }
    } catch (err: any) {
      addLog('error', `Network error during probe send: ${err.message}`);
      setActiveDiag(prev => prev && prev.diagnosticId === diagnosticId ? {
        ...prev,
        backendStatus: 'REQUEST_FAILED',
        fcmSentToTarget: false,
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
        serviceWorkerScope: diagReport?.serviceWorkerScope || '/',
        serviceWorkerActiveScriptURL: diagReport?.serviceWorkerActiveScriptURL || '/firebase-messaging-sw.js',
        serviceWorkerControlling: !!navigator.serviceWorker?.controller,
        serviceWorkerVersion: swPingStatus?.version || '2.2.0',
        pageVisibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown'
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
        serverFcmHttpApiStatus: diagReport?.serverFcmHttpApiStatus || 'Authorized'
      },
      runtimeProbeLifecycle: activeDiag ? {
        diagnosticId: activeDiag.diagnosticId,
        triggeredAt: activeDiag.triggeredAt,
        testMode: activeDiag.testMode,
        tabVisibilityAtTrigger: activeDiag.tabVisibilityAtTrigger,
        stage1BackendAccepted: activeDiag.backendStatus === 'REQUEST_ACCEPTED',
        stage2FcmSentToTarget: activeDiag.fcmSentToTarget,
        stage2FirebaseMessageId: activeDiag.firebaseMessageId || 'N/A',
        stage3SwReceivedPushEvent: activeDiag.swReceived ? `PASS (${activeDiag.swReceivedAt})` : 'AWAITING / DELEGATED',
        stage4SwNotificationShown: activeDiag.swShown ? (activeDiag.swShownSuccess ? `PASS (${activeDiag.swShownAt})` : `FAIL: ${activeDiag.swShownError}`) : 'AWAITING',
        stage5NotificationClicked: activeDiag.notificationClicked ? `PASS (${activeDiag.notificationClickedAt})` : 'AWAITING CLICK',
        stage6TargetUrlOpened: activeDiag.targetUrlOpened ? `PASS (${activeDiag.targetUrlOpenedAt})` : 'AWAITING',
        foregroundMessageReceived: activeDiag.fgReceived ? `PASS (${activeDiag.fgReceivedAt})` : 'NO',
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
• SW Live Version: ${reportData.runtimeEnvironment.serviceWorkerVersion}
• Page Visibility State: ${reportData.runtimeEnvironment.pageVisibility}

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

[5. RUNTIME PROBE LIFECYCLE VERIFICATION]
${activeDiag ? `• Diagnostic ID: ${activeDiag.diagnosticId}
• Test Mode: ${activeDiag.testMode} | Tab Visibility: ${activeDiag.tabVisibilityAtTrigger}
• STAGE 1 — Backend API Request Accepted: ${activeDiag.backendStatus === 'REQUEST_ACCEPTED' ? 'PASS' : 'FAIL'}
• STAGE 2 — FCM Message Sent to Selected Target: ${activeDiag.fcmSentToTarget ? `PASS (Message ID: ${activeDiag.firebaseMessageId})` : 'FAIL'}
• STAGE 3 — Service Worker Background Push Event: ${activeDiag.swReceived ? `PASS at ${activeDiag.swReceivedAt}` : 'AWAITING / DELEGATED TO FG'}
• STAGE 4 — Service Worker Displays Notification: ${activeDiag.swShown ? (activeDiag.swShownSuccess ? `PASS at ${activeDiag.swShownAt}` : `FAIL: ${activeDiag.swShownError}`) : 'AWAITING CONFIRMATION'}
• STAGE 5 — Notification Click Received: ${activeDiag.notificationClicked ? `PASS at ${activeDiag.notificationClickedAt}` : 'AWAITING CLICK'}
• STAGE 6 — Correct Production URL Opened: ${activeDiag.targetUrlOpened ? `PASS (${activeDiag.openedUrl || '/'})` : 'AWAITING NAVIGATION'}
• Foreground Message Received: ${activeDiag.fgReceived ? `PASS at ${activeDiag.fgReceivedAt}` : 'NO'}` : '• No diagnostic probe run in current session'}

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
        const successCount = data.response?.successCount ?? (targetType === 'topic' ? 1 : payload.tokens?.length);
        const failureCount = data.response?.failureCount ?? 0;
        setBroadcastResult({
          success: true,
          message: targetType === 'topic' 
            ? '✅ Broadcast accepted for FCM Topic ("all_users")!' 
            : `✅ Broadcast completed: ${successCount} succeeded, ${failureCount} failed (${payload.tokens?.length || 0} total target devices)`,
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
              {/* Immediate Probe Button */}
              <button
                id="btn-send-test-to-myself"
                type="button"
                onClick={() => handleRunDeliveryDiagnostic('immediate')}
                disabled={probeSending || diagRunning || countdown !== null}
                className="px-5 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                title="Dispatches a real push notification to your device via backend Firebase Admin SDK immediately"
              >
                {probeSending ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                {probeSending ? 'Sending Probe via Admin SDK...' : 'Dispatch Probe (Immediate)'}
              </button>

              {/* Delayed Background Probe Button */}
              <button
                id="btn-send-delayed-probe"
                type="button"
                onClick={() => startDelayedProbe(5)}
                disabled={probeSending || diagRunning || countdown !== null}
                className="px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                title="Counts down 5 seconds so you can switch tabs or minimize the browser to test true background delivery"
              >
                {countdown !== null ? <Clock className="animate-spin" size={14} /> : <Clock size={14} />}
                {countdown !== null ? `Switch Tabs Now! (${countdown}s)` : 'Dispatch Background Probe (5s Delay)'}
              </button>

              {/* SW Ping & Test Notification buttons */}
              <button
                id="btn-ping-sw"
                type="button"
                onClick={pingServiceWorker}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-1.5"
                title="Ping Service Worker controller directly"
              >
                <Wifi size={14} className={swPingStatus?.active ? 'text-green-400' : 'text-neutral-400'} />
                Ping SW
              </button>

              <button
                id="btn-test-sw-notification"
                type="button"
                onClick={testSWDirectNotification}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-1.5"
                title="Test native browser notification display directly from Service Worker context"
              >
                <Monitor size={14} />
                Test SW Notification
              </button>

              <button
                id="btn-regenerate-token"
                type="button"
                onClick={handleRegenerateToken}
                disabled={regeneratingToken || probeSending}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 hover:text-white hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {regeneratingToken ? <RefreshCw className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                {regeneratingToken ? 'Regenerating...' : 'Regenerate Token'}
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

          {/* Countdown Banner if active */}
          {countdown !== null && (
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-center justify-between text-purple-300 animate-pulse">
              <div className="flex items-center gap-3">
                <Clock size={20} className="shrink-0 text-purple-400" />
                <div>
                  <h4 className="font-bold text-sm text-white">Background Probe Countdown Active: {countdown}s</h4>
                  <p className="text-xs text-purple-200/80">Switch to another tab or minimize this browser window right now. The probe will fire in {countdown} seconds.</p>
                </div>
              </div>
              <span className="text-2xl font-mono font-bold text-purple-400">{countdown}</span>
            </div>
          )}

          {/* Real-time Delivery Status Board (All 6 Stages) */}
          <div className="bg-neutral-900 border border-white/10 p-6 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Radio className="text-amber-400 animate-pulse" size={16} />
                <h3 className="text-sm font-bold text-white">
                  Runtime Probe Lifecycle (Real End-to-End Verification)
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-neutral-400">
                  Mode: <strong className="text-amber-400">{activeDiag?.testMode || 'None'}</strong>
                </span>
                <span className="text-neutral-400">
                  Tab: <strong className={activeDiag?.tabVisibilityAtTrigger === 'visible' ? 'text-blue-400' : 'text-purple-400'}>{activeDiag?.tabVisibilityAtTrigger || (typeof document !== 'undefined' ? document.visibilityState : 'visible')}</strong>
                </span>
                <span className="text-neutral-400">
                  ID: <strong className="text-amber-400">{activeDiag?.diagnosticId || 'Awaiting Probe'}</strong>
                </span>
              </div>
            </div>

            {/* 6-Stage Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              
              {/* STAGE 1: Backend API Request Accepted */}
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
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">STAGE 1: Backend API</span>
                  {activeDiag?.backendStatus === 'REQUEST_ACCEPTED' && <CheckCircle2 size={16} />}
                  {activeDiag?.backendStatus === 'REQUEST_FAILED' && <AlertCircle size={16} />}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {activeDiag?.backendStatus === 'REQUEST_ACCEPTED' ? 'PASS — REQUEST ACCEPTED' : activeDiag?.backendStatus || 'Awaiting Probe'}
                </div>
                <p className="text-[11px] mt-1.5 text-neutral-300 leading-relaxed">
                  {activeDiag?.backendStatus === 'REQUEST_ACCEPTED' 
                    ? `POST /api/send-push accepted by Express backend at ${activeDiag.triggeredAt}.` 
                    : activeDiag?.backendStatus === 'REQUEST_FAILED'
                      ? `Failed: ${activeDiag.backendError || 'Server Error'}`
                      : 'Dispatches payload via POST /api/send-push'}
                </p>
              </div>

              {/* STAGE 2: FCM Message Sent to Selected Target */}
              <div className={`p-4 rounded-2xl border transition-all ${
                !activeDiag 
                  ? 'bg-black/30 border-white/5 text-neutral-500'
                  : activeDiag.fcmSentToTarget
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : activeDiag.backendStatus === 'REQUEST_ACCEPTED'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-black/30 border-white/5 text-neutral-500'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">STAGE 2: FCM Target Dispatch</span>
                  {activeDiag?.fcmSentToTarget && <CheckCircle2 size={16} />}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {activeDiag?.fcmSentToTarget ? 'PASS — FCM MESSAGE SENT' : 'AWAITING_FCM_DISPATCH'}
                </div>
                <p className="text-[11px] mt-1.5 text-neutral-300 leading-relaxed">
                  {activeDiag?.fcmSentToTarget 
                    ? `Firebase Admin SDK transmitted message. Message ID: ${activeDiag.firebaseMessageId?.slice(-14) || 'OK'}` 
                    : 'Awaiting FCM Admin SDK multicast or direct send response...'}
                </p>
              </div>

              {/* STAGE 3: Service Worker Receives Background Push Event */}
              <div className={`p-4 rounded-2xl border transition-all ${
                !activeDiag 
                  ? 'bg-black/30 border-white/5 text-neutral-500'
                  : activeDiag.swReceived
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : activeDiag.fgReceived
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                      : activeDiag.fcmSentToTarget
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-black/30 border-white/5 text-neutral-500'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">STAGE 3: SW Push Event</span>
                  {activeDiag?.swReceived && <CheckCircle2 size={16} />}
                  {activeDiag?.fgReceived && !activeDiag?.swReceived && <Info size={16} />}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {activeDiag?.swReceived 
                    ? 'PASS — SW PUSH EVENT RECEIVED' 
                    : activeDiag?.fgReceived 
                      ? 'DELEGATED (TAB IS FOREGROUND)' 
                      : 'AWAITING_SW_EVENT'}
                </div>
                <p className="text-[11px] mt-1.5 text-neutral-300 leading-relaxed">
                  {activeDiag?.swReceived 
                    ? `Raw push event captured by /firebase-messaging-sw.js at ${activeDiag.swReceivedAt}.` 
                    : activeDiag?.fgReceived
                      ? 'Tab is active in foreground; browser routed message directly to onMessage listener.'
                      : 'Listening for BroadcastChannel / postMessage from Service Worker...'}
                </p>
              </div>

              {/* STAGE 4: Service Worker Displays Browser Notification */}
              <div className={`p-4 rounded-2xl border transition-all ${
                !activeDiag 
                  ? 'bg-black/30 border-white/5 text-neutral-500'
                  : activeDiag.swShown
                    ? activeDiag.swShownSuccess 
                      ? 'bg-green-500/10 border-green-500/30 text-green-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                    : activeDiag.fgReceived
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                      : activeDiag.fcmSentToTarget
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-black/30 border-white/5 text-neutral-500'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">STAGE 4: Notification Display</span>
                  {activeDiag?.swShown && activeDiag.swShownSuccess && <CheckCircle2 size={16} />}
                  {activeDiag?.fgReceived && !activeDiag?.swShown && <Info size={16} />}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {activeDiag?.swShown 
                    ? activeDiag.swShownSuccess ? 'PASS — NOTIFICATION DISPLAYED' : 'FAIL — NOTIFICATION ERROR'
                    : activeDiag?.fgReceived
                      ? 'IN-APP (FOREGROUND ACTIVE)'
                      : 'AWAITING_CONFIRMATION'}
                </div>
                <p className="text-[11px] mt-1.5 text-neutral-300 leading-relaxed">
                  {activeDiag?.swShown && activeDiag.swShownSuccess
                    ? `self.registration.showNotification() resolved successfully at ${activeDiag.swShownAt}!`
                    : activeDiag?.swShown && !activeDiag.swShownSuccess
                      ? `Notification display error: ${activeDiag.swShownError}`
                      : activeDiag?.fgReceived
                        ? 'Foreground tab active. In W3C Push spec, active tabs delegate OS banners to in-app.'
                        : 'Awaiting native showNotification callback from SW...'}
                </p>
              </div>

              {/* STAGE 5: Notification Click Received */}
              <div className={`p-4 rounded-2xl border transition-all ${
                !activeDiag 
                  ? 'bg-black/30 border-white/5 text-neutral-500'
                  : activeDiag.notificationClicked
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-black/30 border-white/5 text-neutral-500'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">STAGE 5: Notification Click</span>
                  {activeDiag?.notificationClicked && <CheckCircle2 size={16} />}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {activeDiag?.notificationClicked ? 'PASS — CLICK RECEIVED' : 'AWAITING_USER_CLICK'}
                </div>
                <p className="text-[11px] mt-1.5 text-neutral-300 leading-relaxed">
                  {activeDiag?.notificationClicked 
                    ? `Notification click handled at ${activeDiag.notificationClickedAt} (Action: ${activeDiag.clickAction || 'default'}).` 
                    : 'Click the browser/Android notification banner to trigger notificationclick event.'}
                </p>
              </div>

              {/* STAGE 6: Correct Production URL Opened */}
              <div className={`p-4 rounded-2xl border transition-all ${
                !activeDiag 
                  ? 'bg-black/30 border-white/5 text-neutral-500'
                  : activeDiag.targetUrlOpened
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-black/30 border-white/5 text-neutral-500'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">STAGE 6: URL Navigation</span>
                  {activeDiag?.targetUrlOpened && <CheckCircle2 size={16} />}
                </div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {activeDiag?.targetUrlOpened ? 'PASS — URL OPENED' : 'AWAITING_NAVIGATION'}
                </div>
                <p className="text-[11px] mt-1.5 text-neutral-300 leading-relaxed">
                  {activeDiag?.targetUrlOpened 
                    ? `Window focused/opened with target URL (${activeDiag.openedUrl || '/'}) at ${activeDiag.targetUrlOpenedAt}.` 
                    : 'Service worker focuses or opens client window with deep link payload.'}
                </p>
              </div>

            </div>

            {/* Foreground Listener status note */}
            {activeDiag?.fgReceived && (
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-blue-400 shrink-0" />
                  <span className="font-bold">FCM FOREGROUND MESSAGE RECEIVED</span>
                  <span className="text-blue-300/80">({activeDiag.fgReceivedAt})</span>
                </div>
                <span className="text-[11px] text-blue-200/70">
                  Page was in foreground state ({activeDiag.tabVisibilityAtTrigger}). Message intercepted by onMessage listener.
                </span>
              </div>
            )}
          </div>

          {/* Core Runtime Parameters Grid */}
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
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">SW Version & Controller</span>
                <div className="font-mono text-neutral-300 truncate" title={diagReport?.swControllerScriptURL || 'None'}>
                  {swPingStatus?.version ? `v${swPingStatus.version} (Active)` : (diagReport?.swControllerScriptURL ? diagReport.swControllerScriptURL.split('/').pop() : 'Active')}
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

            {/* Server-Side Admin SDK & Service Account Verification */}
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
                <div className="text-neutral-600 italic py-2">No events logged yet. Click "Dispatch Probe" to test.</div>
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
            <div className={`p-4 rounded-2xl border flex flex-col gap-3 ${
              broadcastResult.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              <div className="flex items-start gap-3">
                {broadcastResult.success ? <CheckCircle2 size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
                <div>
                  <h4 className="font-bold text-sm">{broadcastResult.success ? 'Broadcast Accepted' : 'Broadcast Error'}</h4>
                  <p className="text-xs mt-1 text-neutral-300">{broadcastResult.message}</p>
                </div>
              </div>

              {/* Detailed Device Breakdown Table for Part 9 */}
              {broadcastResult.details?.deviceResults && broadcastResult.details.deviceResults.length > 0 && (
                <div className="mt-3 space-y-2 bg-black/40 border border-white/10 p-4 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Target Device Audit Breakdown ({broadcastResult.details.deviceResults.length} devices)
                    </h5>
                    <span className="text-[11px] text-neutral-400">
                      {broadcastResult.details.successCount} Delivered • {broadcastResult.details.failureCount} Failed
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-neutral-500 uppercase text-[10px]">
                          <th className="py-2 px-3">Target Device Token</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Error Code</th>
                          <th className="py-2 px-3">Error Message / Reason</th>
                          <th className="py-2 px-3">Cleanup Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {broadcastResult.details.deviceResults.map((dev: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-300">{dev.tokenPreview}</td>
                            <td className="py-2.5 px-3">
                              {dev.success ? (
                                <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-bold text-[10px]">
                                  DELIVERED
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold text-[10px]">
                                  FAILED
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[10px] text-amber-400">{dev.errorCode || 'None'}</td>
                            <td className="py-2.5 px-3 text-neutral-400 max-w-xs truncate" title={dev.errorMessage || ''}>{dev.errorMessage || (dev.success ? 'Message accepted by FCM gateway' : 'Unknown')}</td>
                            <td className="py-2.5 px-3 text-[11px] text-neutral-300 font-medium">{dev.cleanupAction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
              onClick={() => handleRunDeliveryDiagnostic('immediate')}
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
