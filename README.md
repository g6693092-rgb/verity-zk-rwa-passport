# Verity ZK RWA Passport - PoC

Questo repository è un punto di partenza. Per compilare i circuiti e generare le prove, segui i passaggi seguenti.

Prerequisiti
- Node.js 16+
- npm
- circom 2.x (per compilare i circuiti)
- snarkjs (npm install -g snarkjs) oppure usare la versione in devDependencies
- circomlib (per LessThan)

Setup rapido
1. npm install
2. npm run merkle    # genera Merkle root a partire da sample/*.json

Compilare circuiti (esempio)
- circom circuits/cold_chain.circom --r1cs --wasm --sym -o circuits/build

Generare witness e prova (esempio con snarkjs)
- node circuits/build/cold_chain_js/generate_witness.js circuits/build/cold_chain.wasm sample/input-cold-chain.json proofs/witness.wtns
- snarkjs groth16 setup circuits/build/cold_chain.r1cs pot12_final.ptau proofs/circuit_0000.zkey
- snarkjs zkey contribute proofs/circuit_0000.zkey proofs/circuit_final.zkey --name="First contribution"
- snarkjs zkey export verificationkey proofs/circuit_final.zkey proofs/verification_key.json
- snarkjs groth16 prove proofs/circuit_final.zkey proofs/witness.wtns proofs/proof.json proofs/public.json
- snarkjs groth16 verify proofs/verification_key.json proofs/public.json proofs/proof.json

Esecuzione automatica (script)
- chmod +x scripts/run-cold-chain-proof.sh
- ./scripts/run-cold-chain-proof.sh

Questo script usa una sample file già presente: sample/input-cold-chain.json

Anchoring su VeChain (testnet)
- Deploy contracts/RootRegistry.sol su VeChain testnet (EVM compatible)
- Esegui una transazione di anchorRoot con il valore root (es. 0x...)

Note
- Il circuito di cold-chain in circuits/cold_chain.circom è PoC: per produzione usare Poseidon e controlli range più robusti.
- Il merkle in circuits/merkle.circom usa una funzione hash placeholder; sostituire con Poseidon in produzione.
- Lo script usa un setup teatrale a scopo dimostrativo; in produzione usare una ptau corretta e uno setup rigoroso per circuito.
