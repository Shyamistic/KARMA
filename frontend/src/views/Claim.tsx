import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { CheckCircle, AlertCircle, Loader2, Wallet } from 'lucide-react';

const Claim: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [claim, setClaim] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);

  useEffect(() => {
    if (token) {
      client.get(`/api/claim/${token}`)
        .then(res => setClaim(res.data))
        .catch(() => setClaim(null))
        .finally(() => setLoading(false));
    }
  }, [token]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setRedeeming(true);
    setResult(null);
    
    try {
      const resp = await client.post(`/api/claim/${token}/execute`, { address: walletAddress });
      setResult(resp.data);
    } catch (err: any) {
      setResult({ success: false, error: err.response?.data?.error || 'Redemption failed' });
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
    </div>
  );

  if (!claim && !result) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div className="glass-card" style={{ padding: '3rem' }}>
        <AlertCircle size={64} color="#ff4b4b" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem' }}>Claim Link Expired or Invalid</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Please contact the project administrator.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem' }}>
        
        {!result ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ 
                width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0, 255, 189, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
              }}>
                <Wallet color="var(--accent-primary)" size={32} />
              </div>
              <h1 className="premium-gradient-text" style={{ fontSize: '1.75rem', fontWeight: 800 }}>Claim Your Reward</h1>
              <p style={{ color: 'var(--text-secondary)' }}>You've earned <strong>{claim.amountUsdt} USDT</strong> for your contribution</p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Contributor</span>
                <span style={{ fontWeight: 600 }}>@{claim.contributor}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Platform</span>
                <span style={{ textTransform: 'capitalize' }}>{claim.platform}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-glass)', margin: '0.5rem 0', paddingTop: '0.5rem' }}>
                <p style={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{claim.reasoning}"</p>
              </div>
            </div>

            <form onSubmit={handleRedeem}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Your ERC-20 (EVM) Wallet Address
              </label>
              <input
                type="text"
                placeholder="0x..."
                required
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                style={{
                  width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-glass)',
                  background: 'rgba(255,255,255,0.05)', color: 'white', marginBottom: '1.5rem', outline: 'none'
                }}
              />
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }} disabled={redeeming}>
                {redeeming ? 'Processing Transfer...' : 'Redeem Reward'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            {result.success ? (
              <>
                <CheckCircle size={64} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Success!</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '2rem' }}>
                  {claim.amountUsdt} USDT has been sent to your wallet.
                </p>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  <strong>Transaction Hash:</strong><br />
                  <a href={`https://sepolia.etherscan.io/tx/${result.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-secondary)' }}>
                    {result.txHash}
                  </a>
                </div>
                <button onClick={() => window.location.reload()} className="btn-primary" style={{ width: '100%' }}>Done</button>
              </>
            ) : (
              <>
                <AlertCircle size={64} color="#ff4b4b" style={{ marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Error</h2>
                <p style={{ color: '#ff4b4b', marginTop: '0.5rem', marginBottom: '2rem' }}>{result.error}</p>
                <button onClick={() => setResult(null)} className="btn-primary" style={{ width: '100%' }}>Try Again</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Claim;
