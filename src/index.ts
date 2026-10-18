// Orchestrator skeleton: build merkle, compile circuit, run prover (instructions)

import { execSync } from 'child_process';
import fs from 'fs';

function run(cmd: string) {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}

async function main() {
  console.log('1) Build merkle root: npm run merkle');
  console.log('2) Compile circuits: use circom (see README)');
  console.log('3) Generate witness and proof using snarkjs (see README)');
  console.log('4) Anchor root on VeChain via ethers / provider and contracts/RootRegistry.sol');
}

main().catch(err => { console.error(err); process.exit(1); });
