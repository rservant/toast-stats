import React, { createContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from sessionStorage on mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password,
      });

      const { token: newToken } = response.data;
      setToken(newToken);
      sessionStorage.setItem('auth_token', newToken);
    } catch (error) {
      // Re-throw error to be handled by the component
      throw error;
    }
  };

  const logout = (): void => {
    setToken(null);
    sessionStorage.removeItem('auth_token');
    
    // Optionally call backend logout endpoint
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
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
