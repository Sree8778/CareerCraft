'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  loading: true,
  needsOnboarding: false,
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
      const savedUser = localStorage.getItem('careercraft_mock_session');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser) as User;
          setUser(parsed);
          setNeedsOnboarding(!isOnboardingDone(parsed.id, parsed.onboardingCompleted));
        } catch (e) {
          const fallback: User = { id: 'mock_uid_123', email: 'developer@careercraft.mock', name: 'Jane Doe', role: 'candidate', avatar: '' };
          setUser(fallback);
          setNeedsOnboarding(!isOnboardingDone(fallback.id));
        }
      } else {
        const fallback: User = { id: 'mock_uid_123', email: 'developer@careercraft.mock', name: 'Jane Doe', role: 'candidate', avatar: '' };
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
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const u: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: userData.name || userData.fullName || firebaseUser.displayName || 'User',
              role: userData.role || 'candidate',
              avatar: userData.avatar || userData.profilePicture || '',
              onboardingCompleted: userData.onboardingCompleted ?? false,
            };
            setUser(u);
            setNeedsOnboarding(!isOnboardingDone(u.id, u.onboardingCompleted));
          } else {
            const u: User = { id: firebaseUser.uid, email: firebaseUser.email || '', name: firebaseUser.displayName || 'New User', role: 'candidate' };
            setUser(u);
            setNeedsOnboarding(!isOnboardingDone(u.id));
          }
        } catch (error) {
          console.error('Error fetching user profile from Firestore:', error);
          const u: User = { id: firebaseUser.uid, email: firebaseUser.email || '', name: firebaseUser.displayName || 'User', role: 'candidate' };
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
    localStorage.setItem('careercraft_mock_session', JSON.stringify(userData));
    setUser(userData);
    setNeedsOnboarding(!isOnboardingDone(userData.id, userData.onboardingCompleted));
  };

  const logout = async () => {
    try {
      localStorage.removeItem('careercraft_mock_session');
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

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, loading, needsOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);