import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const INPUT_LIMIT = 2;
const INPUT_MAX_LENGTH = 4_000;
const MODEL = 'gte-small';

const session = new Supabase.ai.Session(MODEL);

async function handleRequest(request: Request) {
    if (!(await isAuthorized(request))) return Response.json({ error: 'A project secret key or an admin session is required.' }, { status: 401 });

    let body: Record<string, unknown>;

    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const input = body?.input;

    if (!isValidInput(input)) {
        return Response.json({ error: `Send between 1 and ${INPUT_LIMIT} texts of ${INPUT_MAX_LENGTH} characters or fewer.` }, { status: 400 });
    }

    const embeddings: number[][] = [];

    for (const text of input) {
        embeddings.push(await session.run(text, { mean_pool: true, normalize: true }));
    }

    return Response.json({ embeddings });
}

async function isAdmin(request: Request, key: string) {
    const authorization = request.headers.get('Authorization');

    if (!authorization) return false;

    try {
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/get_account`, {
            body: '{}',
            headers: { 'Authorization': authorization, 'Content-Type': 'application/json', 'apikey': key },
            method: 'POST',
        });

        if (!response.ok) return false;

        const account: Record<string, unknown> | null = await response.json();

        return account?.admin === true;
    } catch {
        return false;
    }
}

async function isAuthorized(request: Request) {
    const key = request.headers.get('apikey');

    if (!key) return false;

    const secretKeys: Record<string, string> = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');

    if (Object.values(secretKeys).includes(key)) return true;

    return isAdmin(request, key);
}

function isValidInput(input: unknown): input is string[] {
    if (!Array.isArray(input) || input.length === 0 || input.length > INPUT_LIMIT) return false;

    return input.every(text => typeof text === 'string' && text.trim().length > 0 && text.length <= INPUT_MAX_LENGTH);
}

Deno.serve(handleRequest);
