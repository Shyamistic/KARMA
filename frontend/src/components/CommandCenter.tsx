import React, { useState } from 'react';
import { 
  Plus, 
  Github, 
  Globe, 
  Send,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import client from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';

export const CommandCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rumble' | 'github'>('rumble');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Rumble Form
  const [username, setUsername] = useState('');
  const [wallet, setWallet] = useState('');

  // GitHub Form
  const [prUrl, setPrUrl] = useState('');

  const handleAddCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await client.post('/api/admin/rumble/add-creator', { username, walletAddress: wallet });
      showSuccess(`Monitoring @${username}`);
      setUsername('');
      setWallet('');
    } catch (err) {
      alert('Failed to add creator');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await client.post('/api/admin/evaluate', { prUrl });
      showSuccess('Evaluation Protocol Initiated');
      setPrUrl('');
    } catch (err) {
      alert('Evaluation failed to start');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '300px' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setActiveTab('rumble')}
          className={`nav-item ${activeTab === 'rumble' ? 'active' : ''}`}
          style={{ margin: 0, padding: '8px 16px', background: 'none' }}
        >
          <Globe size={18} /> Rumble Creator
        </button>
        <button 
          onClick={() => setActiveTab('github')}
          className={`nav-item ${activeTab === 'github' ? 'active' : ''}`}
          style={{ margin: 0, padding: '8px 16px', background: 'none' }}
        >
          <Github size={18} /> GitHub PR
        </button>
      </div>

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div 
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
          >
            <CheckCircle2 size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.2rem' }}>{success}</h3>
          </motion.div>
        ) : activeTab === 'rumble' ? (
          <motion.form 
            key="rumble"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleAddCreator}
          >
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Rumble Username</label>
              <input 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Asmongold"
                className="glass-panel"
                style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', color: 'white', outline: 'none' }}
                required
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Destination Wallet (Optional)</label>
              <input 
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0x..."
                className="glass-panel"
                style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', color: 'white', outline: 'none' }}
              />
            </div>
            <button type="submit" className="btn-action" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? <Loader2 className="animate-spin" /> : <><Plus size={18} /> Add to Watchlist</>}
            </button>
          </motion.form>
        ) : (
          <motion.form 
            key="github"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleEvaluatePR}
          >
             <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Pull Request URL</label>
              <input 
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="glass-panel"
                style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', color: 'white', outline: 'none' }}
                required
              />
            </div>
            <button type="submit" className="btn-action" disabled={loading} style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #00d1ff, #8e2de2)' }}>
              {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Trigger Logic Pass</>}
            </button>
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              The Karma Oracle will analyze impact and assign rewards based on contribution quality.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};
