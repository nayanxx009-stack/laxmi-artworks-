import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db, auth, googleProvider } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { requestFCMToken, onForegroundMessage } from './fcm';
import { Navigate } from 'react-router-dom';
import {
  User,
  sendEmailVerification,
  getRedirectResult,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';

const MASTER_ADMINS = ["gargsubhalaxmi@gmail.com", "nayanxx009@gmail.com", "bolt36520@gmail.com", "admin@example.com"];

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'user' | null;
  loading: boolean;
  accessToken: string | null;
  loginWithGoogle: (remember: boolean) => Promise<void>;
  loginWithEmail: (e: string, p: string, r: boolean) => Promise<any>;
  signupWithEmail: (e: string, p: string) => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  accessToken: null,
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  signupWithEmail: async () => {},
  resetPassword: async () => {},
  logout: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    getRedirectResult(auth).then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setAccessToken(credential.accessToken);
        }
      }
    }).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const userDocRef = doc(db, 'users', u.uid);
          const userDoc = await getDoc(userDocRef);
          let currentRole: 'admin' | 'user' = 'user';
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            currentRole = MASTER_ADMINS.includes(u.email?.toLowerCase() || '') ? 'admin' : (data.role || 'user');
          } else {
            currentRole = MASTER_ADMINS.includes(u.email?.toLowerCase() || '') ? 'admin' : 'user';
          }

          await setDoc(userDocRef, {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            role: currentRole,
            lastLogin: Date.now()
          }, { merge: true });

          setRole(currentRole);
          setUser(u);
        } catch (err) {
          console.error("Failed to save user to db", err);
          setUser(u); // fallback
          setRole(MASTER_ADMINS.includes(u.email?.toLowerCase() || '') ? 'admin' : 'user');
        }
      } else {
        setUser(null);
        setRole(null);
        setAccessToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (remember: boolean) => {
    try {
      const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error("Login failed:", error);
      }
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string, remember: boolean) => {
    try {
      const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      return await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      if (error.code !== 'auth/invalid-credential') {
        console.error("Login with email failed:", error);
      }
      throw error;
    }
  };

  const signupWithEmail = async (email: string, pass: string) => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCred.user) {
        await sendEmailVerification(userCred.user);
      }
    } catch (error: any) {
      if (error.code !== 'auth/email-already-in-use') {
        console.error("Signup failed:", error);
      }
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error("Password reset failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setAccessToken(null);
      setRole(null);
      setUser(null);
      // Remove only user-specific items, do not clear all storage
      Object.keys(localStorage).forEach(key => {
        if (key.includes('firebase:authUser:') && !key.includes('adminApp')) {
           localStorage.removeItem(key);
        }
      });
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('firebase:authUser:') && !key.includes('adminApp')) {
           sessionStorage.removeItem(key);
        }
      });
      window.location.href = '/';
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, accessToken, loginWithGoogle, loginWithEmail, signupWithEmail, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user || role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}
