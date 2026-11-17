import { describe, expect, test } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

import Play from '../../src/components/icons/Play.astro';

describe('Play', () => {
    test('hides the svg from assistive technology', async () => {
        const container = await AstroContainer.create();

        const html = await container.renderToString(Play);

        expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    });
});
