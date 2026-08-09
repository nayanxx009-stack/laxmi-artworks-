const fs = require('fs');
let code = fs.readFileSync('src/components/LiveChat.tsx', 'utf8');

// Use a ref for isOpen to access it in the FCM callback
code = code.replace(
  /const \[isOpen, setIsOpen\] = useState\(false\);/,
  `const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);`
);

code = code.replace(
  /const unsubFCM = onForegroundMessage\(\);/,
  `const unsubFCM = onForegroundMessage((payload: any) => {
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
    });`
);

fs.writeFileSync('src/components/LiveChat.tsx', code);
