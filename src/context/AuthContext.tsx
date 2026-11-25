import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getErrorMessage, isSupabaseConfigured, supabase } from '../lib/supabase';
import { fetchAdminRestaurant, signOutAdmin } from '../services/authService';
import type { Restaurant } from '../types/database';

interface AuthContextValue {
  isConfigured: boolean;
  session: Session | null;
  user: User | null;
  restaurant: Restaurant | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  authError: string | null;
  refreshRestaurant: () => Promise<void>;
  setRestaurant: React.Dispatch<React.SetStateAction<Restaurant | null>>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadRestaurantForUser = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setRestaurant(null);
      setAuthError(null);
      return;
    }

    try {
      setAuthError(null);
      const rest = await fetchAdminRestaurant(currentUser);
      setRestaurant(rest);
    } catch (err) {
      setRestaurant(null);
      setAuthError(
        getErrorMessage(err, 'Unable to verify administrator restaurant access.')
      );
    }
  }, []);

  const refreshRestaurant = useCallback(async () => {
    await loadRestaurantForUser(user);
  }, [loadRestaurantForUser, user]);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const init = async () => {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        const activeSession = data.session;
        setSession(activeSession);
        setUser(activeSession?.user ?? null);
        await loadRestaurantForUser(activeSession?.user ?? null);
      } catch (err) {
        if (mounted) {
          setAuthError(getErrorMessage(err, 'Failed to initialize session.'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: subscription } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        loadRestaurantForUser(nextSession.user);
      } else {
        setRestaurant(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadRestaurantForUser]);

  const signOut = useCallback(async () => {
    await signOutAdmin();
    setSession(null);
    setUser(null);
    setRestaurant(null);
    setIsPasswordRecovery(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isConfigured: isSupabaseConfigured,
        session,
        user,
        restaurant,
        loading,
        isPasswordRecovery,
        authError,
        refreshRestaurant,
        setRestaurant,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
