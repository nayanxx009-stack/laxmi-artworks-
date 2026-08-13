import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { adminAuth, googleProvider, adminDb as db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AdminAuthContextType {
  adminUser: User | null;
  adminRole: string | null;
  adminLoading: boolean;
  loginAdminWithGoogle: (remember: boolean) => Promise<void>;
  logoutAdmin: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  adminUser: null,
  adminRole: null,
  adminLoading: true,
  loginAdminWithGoogle: async () => {},
  logoutAdmin: async () => {},
});

export const useAdminAuth = () => useContext(AdminAuthContext);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = adminAuth.onAuthStateChanged(async (currentUser) => {
      setAdminUser(currentUser);
      if (currentUser) {
        try {
          const MASTER_ADMINS = ["gargsubhalaxmi@gmail.com", "nayanxx009@gmail.com", "bolt36520@gmail.com", "admin@example.com"];
          const email = currentUser.email?.toLowerCase() || '';
          if (MASTER_ADMINS.includes(email)) {
            setAdminRole('admin');
          } else {
            const adminDoc = await getDoc(doc(db, 'admins', email));
            if (adminDoc.exists()) {
              setAdminRole(adminDoc.data().role || 'admin');
            } else {
              setAdminRole('user');
            }
          }
        } catch (error) {
          console.error("Failed to fetch admin role", error);
          setAdminRole('user');
        }
      } else {
        setAdminRole(null);
      }
      setAdminLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginAdminWithGoogle = async (remember: boolean) => {
    try {
      const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(adminAuth, persistence);
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(adminAuth, googleProvider);
    } catch (error: any) {
      console.error("Error logging in admin with Google", error);
      throw error;
    }
  };

  const logoutAdmin = async () => {
    await signOut(adminAuth);
    // Remove only admin-specific items
    Object.keys(localStorage).forEach(key => {
      if (key.includes('firebase:authUser:') && key.includes('adminApp')) {
         localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('firebase:authUser:') && key.includes('adminApp')) {
         sessionStorage.removeItem(key);
      }
    });
  };

  return (
    <AdminAuthContext.Provider value={{ adminUser, adminRole, adminLoading, loginAdminWithGoogle, logoutAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
