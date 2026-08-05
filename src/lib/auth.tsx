import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db, auth, googleProvider } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { requestFCMToken, onForegroundMessage } from './fcm';
import { Navigate } from 'react-router-dom';
import {
  User,
  sendEmailVerification,
  getRedirectResult,
  signInWithRedirect,
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

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (e: string, p: string, r: boolean) => Promise<any>;
  signupWithEmail: (e: string, p: string) => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
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
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};

    setPersistence(auth, browserLocalPersistence).then(() => {
      getRedirectResult(auth).then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setAccessToken(credential.accessToken);
          }
        }
      }).catch(console.error);
  
      unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
        if (u) {
          setDoc(doc(db, 'users', u.uid), {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            lastLogin: Date.now()
          }, { merge: true }).catch(err => console.error("Failed to save user to db", err));
        } else {
          setAccessToken(null);
        }
      });
    }).catch((err) => {
      console.error("Failed to set persistence", err);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithRedirect(auth, googleProvider); return;
      
      
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
      // Avoid noisy console errors for expected user errors
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
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, accessToken, loginWithGoogle, loginWithEmail, signupWithEmail, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}
