import React, { useEffect, useState } from 'react';

export default function AdminPanel({ token }) {
    const [users, setUsers] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [showRoutes, setShowRoutes] = useState(true);
    const [showUsers, setShowUsers] = useState(true);

    useEffect(() => {
        loadUsers();
        loadRoutes();
    }, []);

    const loadUsers = async () => {
        const res = await fetch('http://localhost:5000/admin/users', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setUsers(data);
    };

    const loadRoutes = async () => {
        const res = await fetch('http://localhost:5000/admin/routes', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setRoutes(data);
    };

    const deleteUser = async (id) => {
        await fetch(`http://localhost:5000/admin/users/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        loadUsers();
    };

    const promoteToAdmin = async (id) => {
        await fetch(`http://localhost:5000/admin/users/${id}/promote`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` }
        });
        loadUsers();
    };

    const deleteRoute = async (id) => {
        await fetch(`http://localhost:5000/routes/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        loadRoutes();
    };

    return (
        <div className="admin-panel" style={{ fontSize: '0.9rem' }}>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.5rem',
                borderBottom: '1px solid #ddd',
                paddingBottom: '0.5rem'
            }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Trasy</h3>
                <button 
                    onClick={() => setShowRoutes(!showRoutes)}
                    style={{ 
                        border: 'none', 
                        background: 'none', 
                        cursor: 'pointer',
                        color: '#666',
                        fontSize: '1.2rem',
                        padding: '0 4px'
                    }}
                >
                    {showRoutes ? '▼' : '▶'}
                </button>
            </div>
            <div style={{
                maxHeight: showRoutes ? '200px' : '0',
                overflow: 'auto',
                transition: 'max-height 0.3s ease-in-out'
            }}>
                <ul style={{ margin: 0, padding: 0 }}>
                    {routes.map((r) => (
                        <li key={r.route_id} style={{
                            padding: '0.4rem 0',
                            borderBottom: '1px solid #eee',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem'
                        }}>
                            <div>
                                <span style={{ fontWeight: 'bold' }}>{r.name}</span>
                                <span style={{ color: '#666', marginLeft: '0.5rem' }}>
                                    – {r.username}
                                </span>
                            </div>
                            <button 
                                onClick={() => deleteRoute(r.route_id)}
                                style={{
                                    padding: '0.2rem 0.4rem',
                                    fontSize: '0.8rem',
                                    backgroundColor: '#ff4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Usuń
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: '1rem',
                marginBottom: '0.5rem',
                borderBottom: '1px solid #ddd',
                paddingBottom: '0.5rem'
            }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Użytkownicy</h3>
                <button 
                    onClick={() => setShowUsers(!showUsers)}
                    style={{ 
                        border: 'none', 
                        background: 'none', 
                        cursor: 'pointer',
                        color: '#666',
                        fontSize: '1.2rem',
                        padding: '0 4px'
                    }}
                >
                    {showUsers ? '▼' : '▶'}
                </button>
            </div>
            <div style={{
                maxHeight: showUsers ? '200px' : '0',
                overflow: 'auto',
                transition: 'max-height 0.3s ease-in-out'
            }}>
                <ul style={{ margin: 0, padding: 0 }}>
                    {users.map((u) => (
                        <li key={u.id} style={{
                            padding: '0.4rem 0',
                            borderBottom: '1px solid #eee',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem'
                        }}>
                            <div>
                                <span style={{ fontWeight: 'bold' }}>{u.username}</span>
                                <span style={{ 
                                    color: u.role === 'admin' ? '#2196F3' : '#666',
                                    marginLeft: '0.5rem'
                                }}>
                                    ({u.role})
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {u.role !== 'admin' && (
                                    <button 
                                        onClick={() => promoteToAdmin(u.id)}
                                        style={{
                                            padding: '0.2rem 0.4rem',
                                            fontSize: '0.8rem',
                                            backgroundColor: '#4CAF50',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Nadaj admina
                                    </button>
                                )}
                                <button 
                                    onClick={() => deleteUser(u.id)}
                                    style={{
                                        padding: '0.2rem 0.4rem',
                                        fontSize: '0.8rem',
                                        backgroundColor: '#ff4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Usuń
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
