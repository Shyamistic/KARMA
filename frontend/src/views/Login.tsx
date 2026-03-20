import React, { useState } from 'react';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const resp = await client.post('/api/auth/login', { password });
      if (resp.data.token) {
        localStorage.setItem('karma_admin_token', resp.data.token);
        navigate('/');
      }
    } catch (err) {
      setError('Invalid admin password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '1rem' 
    }}>
      <div className="glass-card animate-fade-in" style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '2.5rem',
        textAlign: 'center'
      }}>
        <h1 className="premium-gradient-text" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
          Karma Oracle
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Administrator Secure Login
        </p>

        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Admin Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              background: 'rgba(255,255,255,0.05)',
              color: 'white',
              marginBottom: '1rem',
              outline: 'none'
            }}
          />
          {error && <p style={{ color: '#ff4b4b', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}
          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
