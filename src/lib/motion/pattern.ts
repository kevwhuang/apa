const BAND_COUNT = 8;

const BAND_WEIGHT = [1, 0.92, 0.84, 0.74, 0.64, 0.54, 0.44, 0.34];

const BEATS_PER_MINUTE = 92;

const PATTERN = [
    0b1100_0011, 0b0000_0000, 0b0001_0000, 0b0000_0100,
    0b0110_1001, 0b0000_0010, 0b1000_0000, 0b0000_1000,
    0b1010_0101, 0b0000_0001, 0b0001_0010, 0b0000_0000,
    0b0100_1100, 0b0010_0000, 0b1000_0001, 0b0000_0110,
    0b1101_0011, 0b0000_0000, 0b0000_1000, 0b0001_0001,
    0b0110_0110, 0b0000_0100, 0b1001_0000, 0b0000_0010,
    0b1011_0001, 0b0000_1000, 0b0010_0100, 0b0000_0000,
    0b0101_1010, 0b1000_0010, 0b0000_0001, 0b0011_0100,
];

const SECONDS_PER_MINUTE = 60;

const STEPS_PER_BEAT = 4;

export const STEP_COUNT = PATTERN.length;

export function stepDuration(): number {
    return SECONDS_PER_MINUTE / (BEATS_PER_MINUTE * STEPS_PER_BEAT);
}

export function stepEnergy(step: number): number {
    const mask = PATTERN[step % STEP_COUNT];

    let energy = 0;
    let total = 0;

    for (let band = 0; band < BAND_COUNT; band += 1) {
        total += BAND_WEIGHT[band];

        if (mask & (1 << band)) energy += BAND_WEIGHT[band];
    }

    return energy / total;
}
