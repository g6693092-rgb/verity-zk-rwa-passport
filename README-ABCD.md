# README - Expanded instructions for A/B/C/D

This repository now includes:
- improved circuits with Poseidon-based Merkle (circuits/merkle.circom)
- improved cold-chain circuit with dynamic sampleCount (circuits/cold_chain.circom)
- backend Express server with POST /verify endpoint (src/server.ts)
- minimal React UI in /ui to create claims, build batch and trigger proof (C)
- updated scripts/run-cold-chain-proof.sh to generate ptau if missing
- .env.example expanded

Run the full PoC locally (high level)
1. Install prerequisites: Node.js 16+, npm, circom 2.x, snarkjs
2. npm install (root)
3. cp .env.example .env and set DEPLOYER_PRIVATE_KEY and ROOT_REGISTRY if you use anchoring
4. Start backend: npm run start:dev
5. Start UI: cd ui && npm install && npm start

Notes on circuits and ZK
- Merkle circuit uses Poseidon from circomlib. Ensure circomlib is in your circom include path when compiling.
- The cold_chain circuit now supports dynamic sampleCount and checks each sample only if its index < sampleCount.
- The PoC still uses Groth16; for production consider PLONK (single universal setup).

Next steps
- I can create CI scripts to build circuits and store artifacts in proofs/
- I can implement Poseidon-based leaf hashing end-to-end (claim -> poseidon( commitment ) -> merkle)
- I can migrate proofs to PLONK to avoid multiple trusted ceremonies

