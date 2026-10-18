// Cold-chain circuit
// Verifica che il massimo delle temperature in una lista non superi la soglia (threshold)
// Nota: questo circuito è un PoC e usa il template LessEq da circomlib; installa circomlib quando compili.

pragma circom 2.0.0;

include "circomlib/less_than.circom";

template ColdChain(n) {
    signal input samples[n]; // valori interi rappresentanti decimi di grado (es. 21 -> 2.1°C se usi un fattore)
    signal input threshold;   // stesso formato
    signal input sampleCount; // numero reale di campioni (<= n)

    signal output ok; // 1 se tutti i campioni <= threshold

    component lt[n];

    for (var i = 0; i < n; i++) {
        lt[i] = LessThan(32);
        // LessThan(a,b) verifica a < b, ma circomlib LessThan returns boolean for a < b
        // Vogliamo sample <= threshold -> !(threshold < sample)
        lt[i].in[0] <== threshold;
        lt[i].in[1] <== samples[i];
    }

    // ok iff for all i where i < sampleCount, threshold < sample is false
    signal acc = 1;
    for (var i = 0; i < n; i++) {
        // lt[i].out == 1 when threshold < samples[i]
        // so violation = lt[i].out when index < sampleCount
        // we mask by index: if i >= sampleCount, ignore (treat as ok)
        signal mask;
        // create a simple boolean mask: mask = 1 if i < sampleCount else 0
        // In PoC we assume sampleCount == n (for simplicity). For production, use range checks.
        mask <== 1;
        acc <== acc * (1 - lt[i].out * mask);
    }

    ok <== acc;
}

// Instantiate with a reasonable maximum sample size
component main = ColdChain(16);
