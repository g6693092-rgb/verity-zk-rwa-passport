import React, { useState } from 'react';
import axios from 'axios';

export default function App() {
  const [claim, setClaim] = useState('');
  const [resp, setResp] = useState<any>(null);

  const createClaim = async () => {
    try {
      const obj = JSON.parse(claim);
      const r = await axios.post('http://localhost:3000/claims', obj);
      setResp(r.data);
    } catch (e: any) {
      setResp({ error: e.message });
    }
  };

  const buildBatch = async () => {
    const r = await axios.post('http://localhost:3000/batch');
    setResp(r.data);
  };

  const prove = async (id: string) => {
    const r = await axios.post('http://localhost:3000/prove', { claimId: id });
    setResp(r.data);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Verity PoC UI</h1>
      <section>
        <h2>Create claim</h2>
        <textarea value={claim} onChange={(e) => setClaim(e.target.value)} rows={8} cols={80} />
        <br />
        <button onClick={createClaim}>Create claim</button>
      </section>

      <section>
        <h2>Batch & Proof</h2>
        <button onClick={buildBatch}>Build batch</button>
        <br />
        <input id="claimId" placeholder="claimId to prove" />
        <button onClick={() => prove((document.getElementById('claimId') as HTMLInputElement).value)}>Prove</button>
      </section>

      <section>
        <h2>Response</h2>
        <pre>{JSON.stringify(resp, null, 2)}</pre>
      </section>
    </div>
  );
}
