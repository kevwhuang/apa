import { signDeploy } from '../../src/lib/server/deploy.ts';

import type { Config, DeploySucceededEvent } from '@netlify/functions';

const INGEST_PASSES = 10;
const INGEST_PATH = '/api/ingest';
const PASS_TIMEOUT_MILLISECONDS = 60_000;
const SITE_ORIGIN = 'https://austinproduceralliance.com';

async function handleDeploySucceeded(event: DeploySucceededEvent) {
    if (event.deploy.context !== 'production' || event.site.url !== SITE_ORIGIN) return;

    const token = signDeploy(event.deploy.id);

    if (!token) throw new Error('The site index is not configured.');

    for (let pass = 0; pass < INGEST_PASSES; pass++) {
        const response = await fetch(new URL(INGEST_PATH, SITE_ORIGIN), {
            headers: { Authorization: `Bearer ${token}` },
            method: 'POST',
            signal: AbortSignal.timeout(PASS_TIMEOUT_MILLISECONDS),
        });

        if (!response.ok) throw new Error(`The ingest pass failed with status ${response.status}.`);

        const result: Record<string, unknown> = await response.json();

        if (result.complete === true) return;
    }

    throw new Error(`The site index is still incomplete after ${INGEST_PASSES} passes.`);
}

export const config: Config = { background: true };

export default { deploySucceeded: handleDeploySucceeded };
