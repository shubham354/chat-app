import React, { createContext, useContext, useState, useEffect } from 'react';
import Keycloak from 'keycloak-js';
import { useQuery, useMutation, QueryClient, QueryClientProvider } from 'react-query';
import axios from 'axios';

interface User {
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const queryClient = new QueryClient();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null);

  useEffect(() => {
    const kc = new Keycloak({
      url: process.env.REACT_APP_KEYCLOAK_URL,
      realm: process.env.REACT_APP_KEYCLOAK_REALM,
      clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID
    });

    kc.init({ onLoad: 'check-sso', pkceMethod: 'S256' })
      .then(authenticated => {
        if (authenticated) {
          setUser({
            username: kc.tokenParsed?.preferred_username || '',
            email: kc.tokenParsed?.email || ''
          });
        }
        setKeycloak(kc);
      })
      .catch(error => console.error('Keycloak init error', error));
  }, []);

  const login = async (username: string, password: string) => {
    if (keycloak) {
      try {
        await keycloak.login({ username, password });
        setUser({
          username: keycloak.tokenParsed?.preferred_username || '',
          email: keycloak.tokenParsed?.email || ''
        });
      } catch (error) {
        console.error('Login error', error);
        throw error;
      }
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      await axios.post('/api/register', { username, email, password });
      await login(username, password);
    } catch (error) {
      console.error('Registration error', error);
      throw error;
    }
  };

  const logout = () => {
    if (keycloak) {
      keycloak.logout();
      setUser(null);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user, login, register, logout }}>
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};