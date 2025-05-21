// AdminPanel.js – panel administratora z zakładkami "Trasy" i "Użytkownicy"
import React, { useEffect, useState } from 'react';

export default function AdminPanel({ token }) {
    const [activeTab, setActiveTab] = useState('routes');
    const [routes, setRoutes] = useState([]);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        fetch('http://localhost:5000/admin/routes', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(setRoutes)
            .catch(err => console.error('Failed to load routes:', err));

        fetch('http://localhost:5000/admin/users', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(setUsers)
            .catch(err => console.error('Failed to load users:', err));
    }, [token]);

    const deleteRoute = (id) => {
        fetch(`http://localhost:5000/admin/routes/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.ok && setRoutes(routes.filter(r => r.route_id !== id)));
    };

    const deleteUser = (id) => {
        fetch(`http://localhost:5000/admin/users/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.ok && setUsers(users.filter(u => u.user_id !== id)));
    };

    const promoteUser = (id) => {
        fetch(`http://localhost:5000/admin/users/${id}/promote`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.ok && setUsers(users.map(u => u.user_id === id ? { ...u, role: 'admin' } : u)));
    };

    return (
        <div className="admin-panel">
            <h2>Admin Panel</h2>
            <div className="tab-buttons">
                <button onClick={() => setActiveTab('routes')}>Trasy</button>
                <button onClick={() => setActiveTab('users')}>Użytkownicy</button>
            </div>

            {activeTab === 'routes' && (
                <div>
                    <h3>Lista tras</h3>
                    <ul>
                        {routes.map(r => (
                            <li key={r.route_id}>
                                <b>{r.name}</b> – utworzona przez <i>{r.username}</i>
                                <button onClick={() => deleteRoute(r.route_id)}>Usuń</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {activeTab === 'users' && (
                <div>
                    <h3>Lista użytkowników</h3>
                    <ul>
                        {users.map(u => (
                            <li key={u.user_id}>
                                {u.username} ({u.role})
                                {u.role !== 'admin' && (
                                    <button onClick={() => promoteUser(u.user_id)}>Nadaj admina</button>
                                )}
                                <button onClick={() => deleteUser(u.user_id)}>Usuń</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
