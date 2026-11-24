import { createHmac, timingSafeEqual } from 'node:crypto';

function isDeployToken(token: string, deployId: string): boolean {
    const signature = signDeploy(deployId);

    if (!signature) return false;

    const expected = Buffer.from(signature);
    const presented = Buffer.from(token);

    return expected.length === presented.length && timingSafeEqual(expected, presented);
}

function signDeploy(deployId: string): null | string {
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!deployId || !secretKey) return null;

    return createHmac('sha256', secretKey).update(deployId).digest('hex');
}

export { isDeployToken, signDeploy };
