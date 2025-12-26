/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => {
    // Initialize token from sessionStorage
    return sessionStorage.getItem('auth_token');
  });

  // No useEffect needed - token is initialized from sessionStorage directly

  const login = async (username: string, password: string): Promise<void> => {
    const response = await axios.post('/api/auth/login', {
      username,
      password,
    });

    const { token: newToken } = response.data;
    setToken(newToken);
    sessionStorage.setItem('auth_token', newToken);
  };

  const logout = (): void => {
    setToken(null);
    sessionStorage.removeItem('auth_token');
    
    // Clear React Query cache on logout
    queryClient.clear();
    
    // Call backend logout endpoint to clear server-side cache
    if (token) {
      axios.post('/api/auth/logout', { token }).catch(() => {
        // Ignore errors on logout
      });
    }
  };

  const value: AuthContextType = {
    token,
    isAuthenticated: !!token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
