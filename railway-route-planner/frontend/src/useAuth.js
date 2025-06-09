
import { useState, useEffect } from 'react';

export default function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || '');
  const [userId, setUserId] = useState(localStorage.getItem('user_id') || null);

  const login = (newToken) => {
    setToken(newToken);
    setUsername(localStorage.getItem('username') || '');
    setRole(localStorage.getItem('role') || '');
    setUserId(localStorage.getItem('user_id') || null);
  };

  const logout = () => {
    setToken(null);
    setUsername('');
    setRole('');
    setUserId(null);
    localStorage.clear();
  };

  return {
    token,
    username,
    role,
    userId,
    login,
    logout
  };
}
