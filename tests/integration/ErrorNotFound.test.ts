import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test } from 'vitest';

import ErrorNotFound from '../../src/sections/errors/NotFound.astro';

describe('ErrorNotFound', () => {
    test('renders 404 heading', async () => {
        const container = await AstroContainer.create();

        const html = await container.renderToString(ErrorNotFound);

        expect(html).toMatch(/<h1[^>]*>\s*404\s*<\/h1>/);
    });
});
