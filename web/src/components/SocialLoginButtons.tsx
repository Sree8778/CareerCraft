'use client';

import { useContext } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ModalContext } from '@/contexts/LoginModalContext';
import { toast } from 'sonner';

interface Props {
  isRecruiter?: boolean;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z"/>
    </svg>
  );
}

export default function SocialLoginButtons({ isRecruiter = false }: Props) {
  const { login } = useAuth();
  const router = useRouter();
  const { closeModal } = useContext(ModalContext);

  const handleGoogleSignIn = async () => {
    const isMock = !auth.app.options.apiKey || auth.app.options.apiKey.startsWith('mock');

    if (isMock) {
      const mockUser = {
        id: 'mock_google_uid',
        email: 'google@recruitedge.mock',
        name: 'Google User',
        role: (isRecruiter ? 'recruiter' : 'candidate') as 'recruiter' | 'candidate',
        avatar: '',
      };
      login(mockUser);
      toast.success('Signed in with Google (mock)!');
      closeModal();
      router.push(isRecruiter ? '/recruiter/dashboard' : '/candidate/dashboard');
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          fullName: firebaseUser.displayName || '',
          email: firebaseUser.email || '',
          phone: firebaseUser.phoneNumber || '',
          role: isRecruiter ? 'recruiter' : 'candidate',
          avatar: firebaseUser.photoURL || '',
          onboardingCompleted: false,
          createdAt: new Date().toISOString(),
        });
      }

      toast.success('Signed in with Google!');
      closeModal();
      // onAuthStateChanged in AuthContext handles the redirect via page.tsx
    } catch (error: any) {
      console.error('[Google Sign-In]', error.code, error.message);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return;
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('Domain not authorized. Add this URL to Firebase Console → Authentication → Authorized domains.');
      } else {
        toast.error(error.message || 'Google sign-in failed.');
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-white/10" />
        <span className="text-xs text-zinc-500">or continue with</span>
        <div className="flex-1 border-t border-white/10" />
      </div>
      <button
        onClick={handleGoogleSignIn}
        className="w-full py-3 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white font-medium flex items-center justify-center gap-2.5 transition"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    </div>
  );
}
