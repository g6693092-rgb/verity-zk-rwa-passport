pragma circom 2.0.0;

include "circomlib/less_than.circom";

// Cold-chain circuit (improved)
// Verifies that for sampleCount samples, each sample <= threshold.
// samples: array of length N (maxSamples)
// threshold: integer
// sampleCount: actual number of meaningful samples <= N

template ColdChain(n) {
    signal input samples[n];
    signal input threshold;
    signal input sampleCount;

    signal output ok;

    component ltSample[n];
    component ltIndex[n];

    signal acc;
    acc <== 1;

    for (var i = 0; i < n; i++) {
        // ltSample[i]: is threshold < samples[i] ? (1 if threshold < sample -> violation)
        ltSample[i] = LessThan(32);
        ltSample[i].in[0] <== threshold;
        ltSample[i].in[1] <== samples[i];

        // ltIndex[i]: is i < sampleCount ? (1 if i < sampleCount)
        ltIndex[i] = LessThan(32);
        ltIndex[i].in[0] <== i;
        ltIndex[i].in[1] <== sampleCount;

        // violation occurs when ltSample[i].out == 1 and ltIndex[i].out == 1
        // We compute acc = acc * (1 - violation)
        signal violation;
        violation <== ltSample[i].out * ltIndex[i].out;
        acc <== acc * (1 - violation);
    }

    ok <== acc;
}

component main = ColdChain(16);
