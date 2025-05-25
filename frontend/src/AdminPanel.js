
import React, { useEffect, useState } from 'react';

export default function AdminPanel({ token }) {
    const [users, setUsers] = useState([]);
    const [routes, setRoutes] = useState([]);

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
        <div className="admin-panel">
            <h3>Trasy</h3>
            <ul>
                {routes.map((r) => (
                    <li key={r.route_id}>
                        {r.name} – <i>{r.username}</i>
                        <button onClick={() => deleteRoute(r.route_id)}>Usuń</button>
                    </li>
                ))}
            </ul>

            <h3>Użytkownicy</h3>
            <ul>
                {users.map((u) => (
                    <li key={u.id}>
                        {u.username} ({u.role})
                        <button onClick={() => deleteUser(u.id)}>Usuń</button>
                        {u.role !== 'admin' && (
                            <button onClick={() => promoteToAdmin(u.id)}>Nadaj admina</button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
