
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
        <button onClick={() => setActiveTab('account')}>Account</button>
        <button onClick={() => setActiveTab('map')}>Map</button>
        <button onClick={() => setActiveTab('theme')}>Theme</button>
      </div>

      {activeTab === 'account' && (
        <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
          <p>Zalogowany jako:</p>
          <h3>{username}</h3>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}

      {activeTab === 'map' && (
        <div style={{ padding: '1rem' }}>
          <p>Map settings coming soon...</p>
        </div>
      )}

      {activeTab === 'theme' && (
        <div style={{ padding: '1rem' }}>
          <label htmlFor="theme-select">Select theme:</label>
          <select
            id="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="gray">Gray</option>
          </select>
        </div>
      )}

      {activeTab === 'admin' && role === 'admin' && (
        <AdminPanel token={token} />
      )}
    </div>
  );
}
