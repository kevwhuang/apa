import { limitRequest } from '@lib/server/limiter';
import { loadRoster } from '@lib/server/roster';

import type { APIRoute } from 'astro';

const UNAVAILABLE_MESSAGE = 'The roster could not be loaded. Try again in a moment.';

export const prerender = false;

export const GET: APIRoute = async ({ clientAddress }) => {
    const limited = await limitRequest('content', clientAddress);

    if (limited) return limited;

    const roster = await loadRoster();

    if (!roster) return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 503 });

    const records = roster
        .map(member => ({
            bio: member.bio,
            featured: member.featured,
            genres: member.genres,
            id: member.id,
            joined: member.joined,
            links: member.links,
            location: member.location,
            name: member.name,
            roles: member.roles,
            tracks: member.tracks.map(track => ({ durationSeconds: track.durationSeconds, title: track.title })),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

    return Response.json(records, {
        headers: { 'Cache-Control': 'no-store' },
    });
};
