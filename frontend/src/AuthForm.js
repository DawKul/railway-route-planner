import React, { useState } from 'react';

export default function AuthForm({ onAuth }) {
    const [mode, setMode] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const submit = async () => {
        const endpoint = mode === 'login' ? '/login' : '/register';
        const res = await fetch(`http://localhost:5000${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) return alert(await res.text());
        const { token } = await res.json();
        onAuth(token);
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>{mode === 'login' ? 'Log In' : 'Register'}</h2>
                <input
                    className="auth-input"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Username"
                />
                <input
                    className="auth-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                />
                <button className="auth-button" onClick={submit}>
                    {mode === 'login' ? 'Log In' : 'Sign Up'}
                </button>
                <p
                    onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
                    style={{
                        cursor: 'pointer',
                        color: '#1976d2',
                        marginTop: '1rem',
                        textAlign: 'center',
                        fontWeight: '500'
                    }}
                >
                    {mode === 'login'
                        ? 'Need an account? Register'
                        : 'Have an account? Log In'}
                </p>
            </div>
        </div>
    );
}
