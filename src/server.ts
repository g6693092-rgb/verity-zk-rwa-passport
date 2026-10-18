import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import keccak256 from 'keccak256';
import { MerkleTree } from 'merkletreejs';
import { exec } from 'child_process';
import snarkjs from 'snarkjs';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SAMPLE_DIR = path.resolve(process.cwd(), 'sample');
const PROOFS_DIR = path.resolve(process.cwd(), 'proofs');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(SAMPLE_DIR)) fs.mkdirSync(SAMPLE_DIR);
if (!fs.existsSync(PROOFS_DIR)) fs.mkdirSync(PROOFS_DIR);

const app = express();
app.use(express.json());

function saveJson(filePath: string, obj: any) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function loadJson(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function commitmentOfClaim(claim: any) {
  const payload = JSON.stringify(claim);
  const hash = keccak256(Buffer.from(payload));
  return '0x' + hash.toString('hex');
}

app.post('/claims', (req, res) => {
  try {
    const claim = req.body;
    if (!claim) return res.status(400).json({ error: 'Empty body' });

    const id = claim.claimId || `claim-${uuidv4()}`;
    claim.claimId = id;
    const filename = path.join(DATA_DIR, `${id}.json`);
    saveJson(filename, claim);

    const commitment = commitmentOfClaim(claim);

    // index
    const indexPath = path.join(DATA_DIR, 'index.json');
    const index = loadJson(indexPath) || [];
    index.push({ id, commitment });
    saveJson(indexPath, index);

    return res.json({ id, commitment });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/claims/:id', (req, res) => {
  const id = req.params.id;
  const filename = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(filename)) return res.status(404).json({ error: 'Not found' });
  const claim = loadJson(filename);
  return res.json(claim);
});

app.post('/batch', (req, res) => {
  try {
    const indexPath = path.join(DATA_DIR, 'index.json');
    const index = loadJson(indexPath) || [];
    if (index.length === 0) return res.status(400).json({ error: 'No claims to batch' });

    const leaves = index.map((item: any) => Buffer.from(item.commitment.replace(/^0x/, ''), 'hex'));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = '0x' + tree.getRoot().toString('hex');

    // store batch
    const batchesPath = path.join(DATA_DIR, 'batches.json');
    const batches = loadJson(batchesPath) || [];
    const batch = { id: `batch-${uuidv4()}`, root, timestamp: new Date().toISOString(), count: leaves.length };
    batches.push(batch);
    saveJson(batchesPath, batches);

    return res.json({ batch });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/prove', async (req, res) => {
  try {
    const { claimId } = req.body;
    if (!claimId) return res.status(400).json({ error: 'claimId required' });
    const filename = path.join(DATA_DIR, `${claimId}.json`);
    if (!fs.existsSync(filename)) return res.status(404).json({ error: 'Claim not found' });

    const claim = loadJson(filename);

    // prepare input for circuit: samples array length must be 16 (padding)
    const maxSamples = 16;
    const samples = (claim.temperatureSamples || []).slice(0, maxSamples).map((v: number) => Math.round(v));
    while (samples.length < maxSamples) samples.push(0);
    const threshold = Math.round((claim.transportCheck && claim.transportCheck.maxTemp) || 40);

    const input = { samples, threshold, sampleCount: Math.min((claim.temperatureSamples || []).length, maxSamples) };
    const inputPath = path.join(SAMPLE_DIR, 'input-cold-chain.json');
    saveJson(inputPath, input);

    // run proof script
    const script = path.join(process.cwd(), 'scripts', 'run-cold-chain-proof.sh');
    if (!fs.existsSync(script)) return res.status(500).json({ error: 'Proof script not found' });

    exec(`bash ${script}`, { cwd: process.cwd() }, async (error, stdout, stderr) => {
      if (error) {
        console.error('Proof script error:', stderr);
        return res.status(500).json({ error: 'Proof generation failed', details: stderr });
      }

      // read proofs
      const proofPath = path.join(PROOFS_DIR, 'proof.json');
      const publicPath = path.join(PROOFS_DIR, 'public.json');
      const vkPath = path.join(PROOFS_DIR, 'verification_key.json');
      if (!fs.existsSync(proofPath) || !fs.existsSync(publicPath) || !fs.existsSync(vkPath)) {
        return res.status(500).json({ error: 'Proof artifacts missing after run' });
      }

      const proof = loadJson(proofPath);
      const publicSignals = loadJson(publicPath);
      const vKey = loadJson(vkPath);

      // verify locally using snarkjs
      const valid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

      // return artifacts (small) and verification result
      return res.json({ valid, publicSignals, proof });
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/anchor', async (req, res) => {
  try {
    const root = req.body.root;
    if (!root) return res.status(400).json({ error: 'root required' });

    const rpc = process.env.VECHAIN_TESTNET_RPC || process.env.VECHAIN_MAINNET_RPC;
    const pk = process.env.DEPLOYER_PRIVATE_KEY;
    const contractAddr = process.env.ROOT_REGISTRY;
    if (!rpc || !pk || !contractAddr) return res.status(500).json({ error: 'Missing RPC, DEPLOYER_PRIVATE_KEY or ROOT_REGISTRY in env' });

    const chainId = rpc.includes('testnet') ? 100010 : 100009;
    const provider = new ethers.providers.JsonRpcProvider(rpc, { name: 'vechain', chainId });
    const wallet = new ethers.Wallet(pk, provider);
    const abi = ['function anchorRoot(bytes32 root, string calldata schemaId)'];
    const contract = new ethers.Contract(contractAddr, abi, wallet);

    const schemaId = req.body.schemaId || 'cold-chain-v1';
    const tx = await contract.anchorRoot(root, schemaId, { gasLimit: 500000 });
    await tx.wait();

    // record anchor
    const anchorsPath = path.join(DATA_DIR, 'anchors.json');
    const anchors = loadJson(anchorsPath) || [];
    anchors.push({ root, txHash: tx.hash, schemaId, timestamp: new Date().toISOString() });
    saveJson(anchorsPath, anchors);

    return res.json({ anchored: true, txHash: tx.hash });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Verity PoC backend listening on http://localhost:${PORT}`);
});
