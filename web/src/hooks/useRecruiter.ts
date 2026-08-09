import { useAuth } from '@/contexts/AuthContext';

export function useRecruiter() {
  const { user } = useAuth();
  return {
    name: user?.role === 'recruiter' ? user.name : '',
    email: user?.role === 'recruiter' ? user.email : '',
  };
}
