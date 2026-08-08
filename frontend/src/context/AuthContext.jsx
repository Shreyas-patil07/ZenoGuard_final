import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('access_token');

      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } else if (storedToken) {
        setUser({ access_token: storedToken });
      }
    } catch (error) {
      console.error('Failed to restore auth state:', error);
    } finally {
      setAuthReady(true);
    }
  }, []);

  const login = (userData) => {
    const token = userData?.access_token || null;
    const normalizedUser = token ? { ...userData, access_token: token } : userData;

    setUser(normalizedUser);
    localStorage.setItem('user', JSON.stringify(normalizedUser));

    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
  };

  return (
    <AuthContext.Provider value={{ user, authReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
