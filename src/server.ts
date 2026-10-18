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
import * as circomlibjs from 'circomlibjs';

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SAMPLE_DIR = path.resolve(process.cwd(), 'sample');
const PROOFS_DIR = path.resolve(process.cwd(), 'proofs');

const poseidonFactory = (circomlibjs as any).default ?? (circomlibjs as any);

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

function keccakCommitmentOfClaim(claim: any) {
  const payload = JSON.stringify(claim);
  const hash = keccak256(Buffer.from(payload));
  return '0x' + hash.toString('hex');
}

async function poseidonFieldFromClaim(claim: any): Promise<bigint> {
  const poseidon = await poseidonFactory();
  const hash = keccak256(Buffer.from(JSON.stringify(claim)));
  const fieldValue = BigInt('0x' + hash.toString('hex'));
  const out = poseidon([fieldValue]);
  return BigInt(poseidon.F.toString(out));
}

function toBytes32Hex(value: bigint): Buffer {
  const hex = value.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

async function buildPoseidonMerkleFromIndex(index: Array<any>) {
  const leaves: Buffer[] = [];
  const idToLeaf: Record<string, Buffer> = {};
  for (const item of index) {
    const claim = loadJson(path.join(DATA_DIR, `${item.id}.json`));
    const field = await poseidonFieldFromClaim(claim);
    const buf = toBytes32Hex(field);
    leaves.push(buf);
    idToLeaf[item.id] = buf;
  }
  const tree = new MerkleTree(leaves, (x: Buffer) => x, { sortPairs: true });
  const root = '0x' + tree.getRoot().toString('hex');
  return { tree, root, idToLeaf };
}

app.post('/claims', async (req, res) => {
  try {
    const claim = req.body;
    if (!claim) return res.status(400).json({ error: 'Empty body' });

    const id = claim.claimId || `claim-${uuidv4()}`;
    claim.claimId = id;
    const filename = path.join(DATA_DIR, `${id}.json`);
    saveJson(filename, claim);

    const commitment = keccakCommitmentOfClaim(claim);
    const poseidonLeaf = await poseidonFieldFromClaim(claim);

    const indexPath = path.join(DATA_DIR, 'index.json');
    const index = loadJson(indexPath) || [];
    index.push({ id, commitment, poseidonLeaf: poseidonLeaf.toString(10) });
    saveJson(indexPath, index);

    return res.json({ id, commitment, poseidonLeaf: poseidonLeaf.toString(10) });
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

app.post('/batch', async (req, res) => {
  try {
    const indexPath = path.join(DATA_DIR, 'index.json');
    const index = loadJson(indexPath) || [];
    if (index.length === 0) return res.status(400).json({ error: 'No claims to batch' });

    const { root } = await buildPoseidonMerkleFromIndex(index);

    const batchesPath = path.join(DATA_DIR, 'batches.json');
    const batches = loadJson(batchesPath) || [];
    const batch = { id: `batch-${uuidv4()}`, root, timestamp: new Date().toISOString(), count: index.length };
    batches.push(batch);
    saveJson(batchesPath, batches);

    return res.json({ batch });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Inclusion proof endpoint: returns pathElements and pathIndices for a claim in the current index
app.post('/batch/inclusion', async (req, res) => {
  try {
    const { claimId } = req.body;
    if (!claimId) return res.status(400).json({ error: 'claimId required' });

    const indexPath = path.join(DATA_DIR, 'index.json');
    const index = loadJson(indexPath) || [];
    if (index.length === 0) return res.status(400).json({ error: 'No claims indexed' });

    const { tree, idToLeaf, root } = await buildPoseidonMerkleFromIndex(index);
    const leaf = idToLeaf[claimId];
    if (!leaf) return res.status(404).json({ error: 'Claim not found in index' });

    const proof = tree.getProof(leaf);
    const pathElements = proof.map((p: any) => '0x' + p.data.toString('hex'));
    const pathIndices = proof.map((p: any) => (p.position === 'left' ? 0 : 1));

    return res.json({ root, leaf: '0x' + leaf.toString('hex'), pathElements, pathIndices });
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

    const maxSamples = 16;
    const samples = (claim.temperatureSamples || []).slice(0, maxSamples).map((v: number) => Math.round(v));
    while (samples.length < maxSamples) samples.push(0);
    const threshold = Math.round((claim.transportCheck && claim.transportCheck.maxTemp) || 40);

    const input = { samples, threshold, sampleCount: Math.min((claim.temperatureSamples || []).length, maxSamples) };
    const inputPath = path.join(SAMPLE_DIR, 'input-cold-chain.json');
    saveJson(inputPath, input);

    const script = path.join(process.cwd(), 'scripts', 'run-cold-chain-proof.sh');
    if (!fs.existsSync(script)) return res.status(500).json({ error: 'Proof script not found' });

    exec(`bash ${script}`, { cwd: process.cwd() }, async (error, stdout, stderr) => {
      if (error) {
        console.error('Proof script error:', stderr);
        return res.status(500).json({ error: 'Proof generation failed', details: stderr });
      }

      const proofPath = path.join(PROOFS_DIR, 'proof.json');
      const publicPath = path.join(PROOFS_DIR, 'public.json');
      const vkPath = path.join(PROOFS_DIR, 'verification_key.json');
      if (!fs.existsSync(proofPath) || !fs.existsSync(publicPath) || !fs.existsSync(vkPath)) {
        return res.status(500).json({ error: 'Proof artifacts missing after run' });
      }

      const proof = loadJson(proofPath);
      const publicSignals = loadJson(publicPath);
      const vKey = loadJson(vkPath);

      const valid = await snarkjs.plonk.verify(vKey, publicSignals, proof).catch(async () => {
        // fallback to groth16 verify if verification token differs; keep compatibility
        return await snarkjs.groth16.verify(vKey, publicSignals, proof);
      });

      return res.json({ valid, publicSignals, proof });
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/verify', async (req, res) => {
  try {
    const { proof, publicSignals, vk, root, rpc, contract } = req.body;

    let proofObj = proof;
    let publicObj = publicSignals;
    let vKey = vk;

    if (typeof proofObj === 'string' && proofObj.endsWith('.json')) proofObj = loadJson(path.resolve(proofObj));
    if (typeof publicObj === 'string' && publicObj.endsWith('.json')) publicObj = loadJson(path.resolve(publicObj));
    if (typeof vKey === 'string' && vKey.endsWith('.json')) vKey = loadJson(path.resolve(vKey));

    if (!proofObj || !publicObj || !vKey) {
      return res.status(400).json({ error: 'proof, publicSignals and vk are required' });
    }

    let valid = false;
    // try PLONK verify first
    try {
      valid = await snarkjs.plonk.verify(vKey, publicObj, proofObj);
    } catch (e) {
      // fallback to groth16
      valid = await snarkjs.groth16.verify(vKey, publicObj, proofObj);
    }

    let detectedRoot = root;
    if (!detectedRoot) {
      for (const s of publicObj) {
        if (typeof s === 'string' && s.startsWith('0x') && s.length <= 66) {
          detectedRoot = s;
          break;
        }
        if (typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length <= 64) {
          detectedRoot = '0x' + s;
          break;
        }
      }
    }

    let anchored = null;
    let normalized = null;

    if (detectedRoot) {
      normalized = normalizeRoot(detectedRoot);
      const rpcUrl = rpc || process.env.VECHAIN_TESTNET_RPC || process.env.VECHAIN_MAINNET_RPC;
      const contractAddr = contract || process.env.ROOT_REGISTRY;

      if (normalized && rpcUrl && contractAddr) {
        const chainId = rpcUrl.includes('testnet') ? 100010 : 100009;
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl, { name: 'vechain', chainId });
        const abi = ['function isAnchored(bytes32 root) view returns (bool)'];
        const c = new ethers.Contract(contractAddr, abi, provider);
        anchored = await c.isAnchored(normalized);
      }
    }

    return res.json({ valid, anchored, normalized, publicSignals: publicObj });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

function normalizeRoot(value: string) {
  if (!value) return null;
  if (value.startsWith('0x')) return ethers.utils.hexZeroPad(value, 32);
  if (/^[0-9]+$/.test(value)) {
    return ethers.utils.hexZeroPad(ethers.utils.hexlify(ethers.BigNumber.from(value)), 32);
  }
  if (/^[0-9a-fA-F]+$/.test(value)) return ethers.utils.hexZeroPad('0x' + value, 32);
  return null;
}

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
