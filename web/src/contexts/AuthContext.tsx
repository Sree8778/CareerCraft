'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'recruiter' | 'candidate';
  avatar?: string;
  onboardingCompleted?: boolean;
};

type AuthContextType = {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  needsOnboarding: boolean;
  getToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  loading: true,
  needsOnboarding: false,
  getToken: async () => '',
});

const isOnboardingDone = (uid: string, firestoreFlag?: boolean) =>
  firestoreFlag === true || localStorage.getItem(`onboarding_done_${uid}`) === '1';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const isMockFirebase = !auth.app.options.apiKey || auth.app.options.apiKey.startsWith("your_api_key") || auth.app.options.apiKey.startsWith("mock");

    if (isMockFirebase) {
      console.warn("Firebase Auth running in Developer Offline Bypass Mode (unconfigured .env.local keys).");
      // Check if there is an active logged-in user in local storage to persist
      const savedUser = localStorage.getItem('recruitedge_mock_session');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser) as User;
          setUser(parsed);
          setNeedsOnboarding(!isOnboardingDone(parsed.id, parsed.onboardingCompleted));
        } catch (e) {
          const fallback: User = { id: 'mock_uid_123', email: 'developer@recruitedge.mock', name: 'Jane Doe', role: 'candidate', avatar: '' };
          setUser(fallback);
          setNeedsOnboarding(!isOnboardingDone(fallback.id));
        }
      } else {
        const fallback: User = { id: 'mock_uid_123', email: 'developer@recruitedge.mock', name: 'Jane Doe', role: 'candidate', avatar: '' };
        setUser(fallback);
        setNeedsOnboarding(!isOnboardingDone(fallback.id));
      }
      setLoading(false);
      return () => {}; // Return no-op cleanup
    }

    // Listen to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch additional user profile data from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          // Helper: get saved role from localStorage (set by login() during signup/signin)
          const savedSession = (() => {
            try { return JSON.parse(localStorage.getItem('recruitedge_mock_session') || 'null'); } catch { return null; }
          })();
          const savedRole: 'recruiter' | 'candidate' = savedSession?.role === 'recruiter' ? 'recruiter' : 'candidate';

          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Suspended accounts are signed out immediately (set by Super Admin)
            if (userData.suspended === true) {
              await signOut(auth);
              setUser(null);
              setLoading(false);
              try { alert('Your account has been suspended. Contact support for assistance.'); } catch {}
              return;
            }
            // Treat existing users with profile data as onboarded even if the flag is missing.
            // This auto-heals accounts created before the flag was reliably saved.
            const hasProfileData = !!(userData.fullName || userData.name);
            const onboardingCompleted =
              userData.onboardingCompleted === true ||
              hasProfileData ||
              localStorage.getItem(`onboarding_done_${firebaseUser.uid}`) === '1';
            // Back-fill the flag silently so future logins are instant
            if (onboardingCompleted && !userData.onboardingCompleted) {
              setDoc(userDocRef, { onboardingCompleted: true }, { merge: true }).catch(() => {});
              localStorage.setItem(`onboarding_done_${firebaseUser.uid}`, '1');
            }
            const u: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || firebaseUser.phoneNumber || '',
              name: userData.name || userData.fullName || firebaseUser.displayName || firebaseUser.phoneNumber || 'User',
              role: (userData.role as 'recruiter' | 'candidate') || savedRole,
              avatar: userData.avatar || userData.profilePicture || firebaseUser.photoURL || '',
              onboardingCompleted,
            };
            setUser(u);
            setNeedsOnboarding(!onboardingCompleted);
          } else {
            // Doc doesn't exist yet (e.g. immediately after account creation) — use localStorage role
            const u: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || firebaseUser.phoneNumber || '',
              name: firebaseUser.displayName || firebaseUser.phoneNumber || savedSession?.name || 'New User',
              role: savedRole,
            };
            setUser(u);
            setNeedsOnboarding(!isOnboardingDone(u.id));
          }
        } catch (error) {
          // Firestore read failed (e.g. security rules) — preserve role from localStorage
          console.error('Error fetching user profile from Firestore:', error);
          const savedSession = (() => {
            try { return JSON.parse(localStorage.getItem('recruitedge_mock_session') || 'null'); } catch { return null; }
          })();
          const u: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || firebaseUser.phoneNumber || '',
            name: firebaseUser.displayName || firebaseUser.phoneNumber || savedSession?.name || 'User',
            role: savedSession?.role === 'recruiter' ? 'recruiter' : 'candidate',
          };
          setUser(u);
          setNeedsOnboarding(!isOnboardingDone(u.id));
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (userData: User) => {
    localStorage.setItem('recruitedge_mock_session', JSON.stringify(userData));
    setUser(userData);
    setNeedsOnboarding(!isOnboardingDone(userData.id, userData.onboardingCompleted));
  };

  const logout = async () => {
    try {
      localStorage.removeItem('recruitedge_mock_session');
      const isMockFirebase = !auth.app.options.apiKey || auth.app.options.apiKey.startsWith("your_api_key") || auth.app.options.apiKey.startsWith("mock");
      if (!isMockFirebase) {
        await signOut(auth);
      }
      setUser(null);
      setNeedsOnboarding(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isAuthenticated = !!user;

  const getToken = async (): Promise<string> => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) return token;
    } catch {}
    // Fallback for local dev / mock sessions
    return user ? `mock_token_for_${user.id}` : '';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, loading, needsOnboarding, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);