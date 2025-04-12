import React, { useState } from 'react';

const AuthForm = () => {
  const [isRegister, setIsRegister] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isRegister ? 'register' : 'login';

    try {
      const res = await fetch(`http://localhost:5000/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const text = await res.text();

      if (res.ok) {
        setMessage('');
        setLoggedInUser(username); // zapamietujemy zalogowanego uzytkownika
      } else {
        setMessage(text);
      }
    } catch (error) {
      setMessage('Blad polaczenia z serwerem');
      console.error(error);
    }
  };

  // Po zalogowaniu – pokaz mini panel profilowy
  if (loggedInUser) {
  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      left: '10px',
      padding: '1rem',
      borderRadius: '1rem',
      backgroundColor: '#ffffff',
      boxShadow: '0 0 8px rgba(0,0,0,0.2)',
      fontSize: '0.9rem',
      zIndex: 1000
    }}>
      <p>Zalogowano jako:</p>
      <strong>{loggedInUser}</strong>
    </div>
  );
}

  // Formularz logowania/rejestracji
  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: '1rem', border: '1px solid #ccc', borderRadius: '1rem' }}>
      <h2>{isRegister ? 'Rejestracja' : 'Logowanie'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nazwa uzytkownika"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
        <input
          type="password"
          placeholder="Haslo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
        />
        <button type="submit" style={{ width: '100%', padding: '0.5rem' }}>
          {isRegister ? 'Zarejestruj sie' : 'Zaloguj sie'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>{message}</p>
      <button onClick={() => setIsRegister(!isRegister)} style={{ marginTop: '1rem' }}>
        {isRegister ? 'Masz konto? Zaloguj sie' : 'Nie masz konta? Zarejestruj sie'}
      </button>
    </div>
  );
};

export default AuthForm;
