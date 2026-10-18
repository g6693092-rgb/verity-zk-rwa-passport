#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

# create a claim
RESP=$(curl -s -X POST "$BASE_URL/claims" -H "Content-Type: application/json" -d @sample/claim-example.json)
echo "Create claim response: $RESP"
CLAIM_ID=$(echo "$RESP" | node -e "const fs=require('fs'); const s=fs.readFileSync(0,'utf8'); console.log(JSON.parse(s).id);")

if [ -z "$CLAIM_ID" ]; then
  echo "Failed to create claim"
  exit 1
fi

# build batch
RESP2=$(curl -s -X POST "$BASE_URL/batch")
echo "Batch response: $RESP2"

# prove (may take time)
RESP3=$(curl -s -X POST "$BASE_URL/prove" -H "Content-Type: application/json" -d '{"claimId":"'"$CLAIM_ID"'"}')
echo "Prove response: $RESP3"

if echo "$RESP3" | grep -q 'valid'; then
  echo "Proof generation triggered"
else
  echo "Proof generation likely failed"
  exit 1
fi

echo "Smoke test complete"
