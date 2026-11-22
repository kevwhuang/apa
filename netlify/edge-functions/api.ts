import type { Config } from '@netlify/edge-functions';

const SECONDS_PER_MINUTE = 60;

function continueChain() {
    return undefined;
}

export const config: Config = {
    excludedPath: ['/api/stripe', '/api/unsubscribe'],
    onError: 'bypass',
    path: '/api/*',
    rateLimit: { aggregateBy: ['ip', 'domain'], windowLimit: 120, windowSize: SECONDS_PER_MINUTE },
};

export default continueChain;
