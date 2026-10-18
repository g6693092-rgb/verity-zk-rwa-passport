// Simple Merkle inclusion circuit (PoC)
// Assume Poseidon hash will be used in production; here we leave a placeholder.

pragma circom 2.0.0;

template MerkleInclusion(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal input root;

    signal computed;
    computed <== leaf;

    for (var i = 0; i < depth; i++) {
        signal left;
        signal right;
        if (pathIndices[i] == 0) {
            left <== computed;
            right <== pathElements[i];
        } else {
            left <== pathElements[i];
            right <== computed;
        }
        // placeholder: use a simple hash imitation: computed = left + right
        computed <== left + right;
    }

    computed === root;
}

component main = MerkleInclusion(16);
