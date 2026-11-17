import { describe, expect, test } from 'vitest';

import { BYTES_PER_MEGABYTE } from '../../src/lib/shared/constants';

describe('BYTES_PER_MEGABYTE', () => {
    test('equals 1024 bytes squared', () => {
        expect(BYTES_PER_MEGABYTE).toBe(1_024 ** 2);
    });
});
