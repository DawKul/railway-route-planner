import React from 'react';
import AdminPanel from './AdminPanel';

export default function SidebarMenu({
  theme,
  setTheme,
  username,
  handleLogout,
  activeTab,
  setActiveTab,
  role,
  token
}) {
  return (
    <div className={`sidebar ${theme}-theme`}>
      <div className="tab-buttons">
        <button onClick={() => setActiveTab('account')}>Konto</button>
        <button onClick={() => setActiveTab('theme')}>Motyw</button>
      </div>

      {activeTab === 'account' && (
        <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
          <p>Zalogowany jako:</p>
          <h3>{username}</h3>
          <button onClick={handleLogout}>Wyloguj</button>
        </div>
      )}

      {activeTab === 'theme' && (
        <div style={{ padding: '1rem' }}>
          <label htmlFor="theme-select">Wybierz motyw:</label>
          <select
            id="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="light">Jasny</option>
            <option value="dark">Ciemny</option>
            <option value="gray">Szary</option>
          </select>
        </div>
      )}

      {activeTab === 'admin' && role === 'admin' && (
        <AdminPanel token={token} />
      )}
    </div>
  );
}
