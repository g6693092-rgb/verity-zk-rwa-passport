#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p circuits/build proofs

if ! command -v circom >/dev/null 2>&1; then
  echo "circom not found in PATH. Attempting to install via npm (may fail)."
  npm install -g circom || true
fi

# 1) Compile circuit (cold_chain)
circom circuits/cold_chain.circom --r1cs --wasm --sym -o circuits/build

# 2) Generate witness from sample input
if [ ! -f sample/input-cold-chain.json ]; then
  echo "sample/input-cold-chain.json missing"
  exit 1
fi

node circuits/build/cold_chain_js/generate_witness.js \
  circuits/build/cold_chain.wasm \
  sample/input-cold-chain.json \
  proofs/witness.wtns

# 3) Prepare ptau (powersoftau) - use small power for PoC
if [ ! -f pot12_final.ptau ]; then
  echo "pot12_final.ptau not found - building a local ptau (this may take a while)"
  npx snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
  npx snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="first contribution" -v
  npx snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
fi

# PLONK-only flow
npx snarkjs plonk setup circuits/build/cold_chain.r1cs pot12_final.ptau proofs/circuit_final.zkey

npx snarkjs plonk prove proofs/circuit_final.zkey proofs/witness.wtns proofs/proof.json proofs/public.json

npx snarkjs plonk verify proofs/circuit_final.zkey proofs/public.json proofs/proof.json

echo "PLONK proof generation complete. Artifacts in proofs/"
