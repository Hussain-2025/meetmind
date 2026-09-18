import React, { useEffect } from 'react';
import { sessionHandlers } from '../services/api';
import { useStore } from '../store/useStore';

export const SessionBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setUser = useStore((s) => s.setUser);

  useEffect(() => {
    sessionHandlers.onUnauthorized = () => {
      localStorage.removeItem('meetmind_token');
      localStorage.removeItem('meetmind_refresh_token');
      setUser(null);
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    };
    return () => {
      sessionHandlers.onUnauthorized = undefined;
    };
  }, [setUser]);

  return <>{children}</>;
};
