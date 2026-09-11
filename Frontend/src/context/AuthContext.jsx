/**
 * AuthContext.jsx
 * ---------------------------------------------------------------------
 * PURPOSE
 *   Single source of truth for "who is logged in" across the whole app.
 *   On first mount, if tokens already exist in localStorage (the user
 *   refreshed the page or came back later), we call GET /auth/me to
 *   restore their session silently instead of forcing a fresh login --
 *   this is what makes the app feel like a real logged-in product
 *   rather than a demo that forgets you on every reload.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/auth';
import { tokenStorage } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // isLoading covers the brief "checking if you're already logged in"
  // window right after the app boots -- used to avoid flashing the
  // login page before we know the answer.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      if (!tokenStorage.getAccessToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        setUser(me);
      } catch {
        tokenStorage.clear();
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  const applySession = useCallback((session) => {
    tokenStorage.setTokens(session.accessToken, session.refreshToken);
    setUser(session.user);
  }, []);

  const register = useCallback(async (payload) => {
    // Deliberately does NOT call applySession: after registering, the
    // person should land on the Login page and log in themselves,
    // rather than being silently signed in. The backend still issues a
    // session in its response (useful for other integrations), we just
    // don't store it here.
    await authApi.register(payload);
  }, []);
  const login = useCallback(
    async (payload) => applySession(await authApi.login(payload)),
    [applySession]
  );
  const googleLogin = useCallback(
    async (idToken) => applySession(await authApi.googleAuth(idToken)),
    [applySession]
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      await authApi.logout(refreshToken);
    } catch {
      // Even if the network call fails, we still clear the local
      // session -- the user's intent to log out should always succeed
      // from their point of view.
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const updated = await authApi.updateMe(payload);
    setUser(updated);
    return updated;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, register, login, googleLogin, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
