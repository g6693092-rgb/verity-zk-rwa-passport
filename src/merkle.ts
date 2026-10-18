import fs from 'fs';
import keccak256 from 'keccak256';
import { MerkleTree } from 'merkletreejs';

// Builds a Merkle tree from claim commitments (keccak256 of claim JSON)
async function main() {
  const dir = 'sample';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const leaves = files.map(f => {
    const content = fs.readFileSync(`${dir}/${f}`);
    const hash = keccak256(content).toString('hex');
    return Buffer.from(hash, 'hex');
  });

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getRoot().toString('hex');
  console.log('Merkle root:', '0x' + root);

  // print proof for first leaf
  if (leaves.length > 0) {
    const proof = tree.getProof(leaves[0]).map(p => '0x' + p.data.toString('hex'));
    console.log('Proof for first leaf:', proof);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
