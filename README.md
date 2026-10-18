# Verity ZK RWA Passport - PoC

Questo repository è un punto di partenza. Per compilare i circuiti e generare le prove, segui i passaggi seguenti.

Prerequisiti
- Node.js 16+
- npm
- circom 2.x (per compilare i circuiti)
- snarkjs (npm i -g snarkjs) oppure usare la versione in devDependencies
- (opzionale) circomlib per comparator LessThan

Setup rapido
1. npm install
2. npm run merkle    # genera Merkle root a partire da sample/*.json

Compilare circuiti (esempio)
- circom circuits/cold_chain.circom --r1cs --wasm --sym -o circuits/build

Generare witness e prova (esempio con snarkjs)
- node circuits/build/cold_chain_js/generate_witness.js circuits/build/cold_chain.wasm input.json witness.wtns
- snarkjs groth16 setup circuits/build/cold_chain.r1cs pot12_final.ptau circuit_0000.zkey
- snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey --name="First contribution"
- snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json
- snarkjs groth16 verify verification_key.json public.json proof.json

Anchoring su VeChain (testnet)
- Deploy contracts/RootRegistry.sol su VeChain testnet (EVM compatible)
- Esegui una transazione di anchorRoot con il valore root (es. 0x...)

Note
- Il circuito di cold-chain in circuits/cold_chain.circom è PoC: per produzione usare Poseidon e controlli range più robusti.
- Il merkle in circuits/merkle.circom usa una funzione hash placeholder; sostituire con Poseidon in produzione.
