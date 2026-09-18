import React, { useEffect } from 'react';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { normalizeUser } from '../utils/auth';

/**
 * Syncs session + role from the server on app load (refresh token → latest DB role in JWT).
 */
export const AuthBootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setUser, setAuthReady } = useStore();

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const refreshToken = localStorage.getItem('meetmind_refresh_token');
        const res = await api.post('/auth/refresh-token', { refreshToken });
        if (!cancelled && res.data?.user) {
          setUser(normalizeUser(res.data.user));
          if (res.data.accessToken) {
            localStorage.setItem('meetmind_token', res.data.accessToken);
          }
          if (res.data.refreshToken) {
            localStorage.setItem('meetmind_refresh_token', res.data.refreshToken);
          }
        }
      } catch (refreshErr: unknown) {
        const refreshStatus = (refreshErr as { response?: { status?: number } })?.response?.status;
        try {
          const profileRes = await api.get('/auth/profile');
          if (!cancelled && profileRes.data) {
            setUser(normalizeUser(profileRes.data));
          }
        } catch (profileErr: unknown) {
          const profileStatus = (profileErr as { response?: { status?: number } })?.response?.status;
          if (!cancelled && (refreshStatus === 401 || profileStatus === 401)) {
            setUser(null);
            localStorage.removeItem('meetmind_token');
            localStorage.removeItem('meetmind_refresh_token');
          }
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [setUser, setAuthReady]);

  return <>{children}</>;
};
