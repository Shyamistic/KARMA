import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, CheckCircle, Loader2 } from 'lucide-react';
import client from '../api/client';
import { motion } from 'framer-motion';

export const WatchOracle: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isWatching, setIsWatching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    let interval: any;
    if (isWatching && progress < 100) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            handleFinishWatching();
            return 100;
          }
          return prev + 2;
        });
      }, 500); 
    }
    return () => clearInterval(interval);
  }, [isWatching, progress]);

  const handleStartWatching = () => {
    if (!url) return;
    setIsWatching(true);
    setProgress(0);
    setResult(null);
  };

  const handleFinishWatching = async () => {
    setIsWatching(false);
    setEvaluating(true);
    try {
      // Trigger the actual AI evaluation logic on backend
      const res = await client.post('/api/admin/evaluate', { prUrl: url });
      setResult(res.data);
    } catch (e) {
      alert("Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Play size={32} color="var(--accent-secondary)" /> Watch Oracle
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Paste a Rumble content URL below to simulate a live consumption session. 
        Karma tracks your engagement and executes a Tether WDK tip based on AI-perceived value.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://rumble.com/v..."
            className="glass-panel"
            style={{ flex: 1, padding: '1rem', background: 'rgba(255,255,255,0.03)', color: 'white', border: '1px solid var(--border-glass)' }}
          />
          <button 
            onClick={handleStartWatching}
            disabled={isWatching || evaluating}
            className="btn-action"
            style={{ whiteSpace: 'nowrap' }}
          >
            {isWatching ? 'Watching...' : 'Start Session'}
          </button>
        </div>
      </div>

      {(isWatching || progress > 0) && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Engagement Monitor Active</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>{progress}%</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-secondary)', transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
             {isWatching ? <Pause size={32} onClick={() => setIsWatching(false)} style={{ cursor: 'pointer' }} /> : <Play size={32} onClick={() => setIsWatching(true)} style={{ cursor: 'pointer' }} />}
             <FastForward size={32} onClick={() => setProgress(100)} style={{ cursor: 'pointer', opacity: 0.5 }} />
          </div>
        </div>
      )}

      {evaluating && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Loader2 className="animate-spin" size={32} color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
          <h3>AI Intelligence Pass in Progress...</h3>
        </div>
      )}

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid #4ade80', borderRadius: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <CheckCircle color="#4ade80" />
            <h3 style={{ margin: 0 }}>Tip Executed Successfully</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {result.message}
          </p>
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
            STATUS: SUCCESS<br />
            ORACLE_PASS: VERIFIED<br />
            PAYMENT_ADAPTER: TETHER_WDK
          </div>
        </motion.div>
      )}
    </div>
  );
};
