import fs from 'fs';
import path from 'path';
import keccak256 from 'keccak256';
import { MerkleTree } from 'merkletreejs';
import * as circomlibjs from 'circomlibjs';

const poseidonFactory = (circomlibjs as any).default ?? (circomlibjs as any);

async function fieldValueFromClaim(claim: any): Promise<bigint> {
  const poseidon = await poseidonFactory();
  const serial = JSON.stringify(claim);
  const hash = keccak256(Buffer.from(serial));
  const fieldVal = BigInt('0x' + hash.toString('hex'));
  const out = poseidon([fieldVal]);
  return BigInt(poseidon.F.toString(out));
}

function toBytes32Hex(value: bigint): Buffer {
  const hex = value.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

async function main() {
  const sampleDir = path.resolve(process.cwd(), 'sample');
  const files = fs.readdirSync(sampleDir).filter(f => f.endsWith('.json'));

  const leaves: Buffer[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(sampleDir, file), 'utf8');
    const claim = JSON.parse(raw);
    const field = await fieldValueFromClaim(claim);
    leaves.push(toBytes32Hex(field));
  }

  const tree = new MerkleTree(leaves, (buf: Buffer) => buf, { sortPairs: true });
  console.log('Poseidon-based Merkle root:', '0x' + tree.getRoot().toString('hex'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
