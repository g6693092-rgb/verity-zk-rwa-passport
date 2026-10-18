#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p circuits/build proofs

# 1) Compile circuit (cold_chain)
circom circuits/cold_chain.circom --r1cs --wasm --sym -o circuits/build

# 2) Generate witness from sample input
node circuits/build/cold_chain_js/generate_witness.js \
  circuits/build/cold_chain.wasm \
  sample/input-cold-chain.json \
  proofs/witness.wtns

# 3) Setup a proving key (Groth16)
# For a real environment, use a proper universal ptau or a trusted setup artifact.
if [ ! -f pot12_final.ptau ]; then
  echo "pot12_final.ptau not found - building a local ptau (this may take a while)"
  snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
  snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="first contribution" -v
  snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
fi

snarkjs groth16 setup \
  circuits/build/cold_chain.r1cs \
  pot12_final.ptau \
  proofs/circuit_0000.zkey

# 4) Contribute to trusted setup (demo placeholder)
snarkjs zkey contribute \
  proofs/circuit_0000.zkey \
  proofs/circuit_final.zkey \
  --name="verity-first-contribution" -v

# 5) Export verification key
snarkjs zkey export verificationkey \
  proofs/circuit_final.zkey \
  proofs/verification_key.json

# 6) Generate proof
snarkjs groth16 prove \
  proofs/circuit_final.zkey \
  proofs/witness.wtns \
  proofs/proof.json \
  proofs/public.json

# 7) Verify proof
snarkjs groth16 verify \
  proofs/verification_key.json \
  proofs/public.json \
  proofs/proof.json

echo "Proof generation complete. Artifacts in proofs/"
