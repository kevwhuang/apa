import { SECONDS_PER_MINUTE, STEPS_PER_BEAT } from '@lib/shared/constants';

const BANDS = 8;
const BAND_WEIGHTS = [1, 0.92, 0.84, 0.74, 0.64, 0.54, 0.44, 0.34] as const;
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
] as const;

const steps = PATTERN.length;

function getStepDuration(beatsPerMinute = BEATS_PER_MINUTE): number {
    return SECONDS_PER_MINUTE / (beatsPerMinute * STEPS_PER_BEAT);
}

function getStepEnergy(step: number): number {
    const mask = PATTERN[step % steps];

    let energy = 0;
    let total = 0;

    for (let band = 0; band < BANDS; band++) {
        total += BAND_WEIGHTS[band];

        if (mask & (1 << band)) energy += BAND_WEIGHTS[band];
    }

    return energy / total;
}

export { getStepDuration, getStepEnergy, steps };
