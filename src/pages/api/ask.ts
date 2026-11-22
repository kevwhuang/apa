import { AI_QUESTION_MAX_LENGTH, INVALID_BODY_MESSAGE } from '@lib/shared/constants';
import { answerQuestion } from '@lib/server/ai';
import { createAdminClient } from '@lib/server/supabase';
import { limitRequest, limitSite, toLimitResponse } from '@lib/server/limiter';

import type { APIRoute } from 'astro';

const UNAVAILABLE_MESSAGE = 'The assistant is not configured.';

export const prerender = false;

export const POST: APIRoute = async ({ clientAddress, request }) => {
    let body: Record<string, unknown>;

    try {
        body = await request.json();
    } catch {
        return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });
    }

    if (!body || typeof body !== 'object') return Response.json({ error: INVALID_BODY_MESSAGE }, { status: 400 });

    const question = typeof body.question === 'string' ? body.question.trim() : '';

    if (!question || question.length > AI_QUESTION_MAX_LENGTH) {
        return Response.json({ error: `Ask a question of ${AI_QUESTION_MAX_LENGTH} characters or fewer.` }, { status: 400 });
    }

    const admin = createAdminClient();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!admin || !apiKey) return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 503 });

    const limited = await limitRequest('ask', clientAddress);

    if (limited) return limited;

    const quota = await limitSite('ask');

    if (quota.isLimited) return toLimitResponse(quota);

    const result = await answerQuestion(question, admin, apiKey);

    if (!result.ok) return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 503 });

    return Response.json(result.answer ? { ...result.answer, answered: true } : { answered: false });
};
