pragma circom 2.0.0;

include "circomlib/poseidon.circom";

// Merkle inclusion circuit using Poseidon (depth configurable)
// leaf is a field element (e.g., Poseidon hash of claim commitment)
// pathElements: array of sibling nodes
// pathIndices: 0 (left) or 1 (right) per level
// root: public input

template MerkleInclusion(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal input root;

    signal computed;
    computed <== leaf;

    component hasher[depth];
    for (var i = 0; i < depth; i++) {
        // compute pair hash depending on pathIndices[i]
        // if pathIndices[i] == 0 -> computed is left: h = Poseidon([computed, pathElements[i]])
        // else -> h = Poseidon([pathElements[i], computed])
        signal left;
        signal right;
        left <== computed * (1 - pathIndices[i]) + pathElements[i] * pathIndices[i];
        right <== computed * pathIndices[i] + pathElements[i] * (1 - pathIndices[i]);

        hasher[i] = Poseidon(2);
        hasher[i].inputs[0] <== left;
        hasher[i].inputs[1] <== right;

        computed <== hasher[i].out;
    }

    computed === root;
}

component main = MerkleInclusion(16);
