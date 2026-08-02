import { getToken, onMessage } from "firebase/messaging";
import { messaging, db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

export const requestFCMToken = async (userId: string, email: string) => {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging);
      if (token) {
        await setDoc(doc(db, 'fcm_tokens', userId), {
          token,
          userId,
          email: email.toLowerCase(),
          updatedAt: Date.now()
        });
        return token;
      }
    }
  } catch (error) {
    console.error("FCM Token error", error);
  }
  return null;
};

export const onForegroundMessage = () => {
  if (!messaging) return;
  return onMessage(messaging, (payload) => {
    console.log("Message received. ", payload);
    // You could show a toast here if you want
  });
};
