import { getCollection } from 'astro:content';

import type { CollectionEntry } from 'astro:content';

interface Sources {
    speakers: CollectionEntry<'speakers'>[];
    sponsors: CollectionEntry<'sponsors'>[];
}

function getRecord<T extends { id: string }>(records: T[], id: string, label: string) {
    const record = records.find(candidate => candidate.id === id);

    if (!record) throw new Error(`${label} ${id} has no file.`);

    return record;
}

async function loadEvents(): Promise<EventRecord[]> {
    const events = await getCollection('events');

    const sources = {
        speakers: await getCollection('speakers'),
        sponsors: await getCollection('sponsors'),
    };

    return events
        .map(entry => toEventRecord(entry, sources))
        .sort((a, b) => +a.starts_at - +b.starts_at);
}

function requireBody(entry: CollectionEntry<'events' | 'speakers' | 'sponsors'>) {
    if (!entry.body) throw new Error(`${entry.collection} ${entry.id} needs a body.`);

    return entry.body;
}

function toEventRecord(entry: CollectionEntry<'events'>, sources: Sources) {
    const { program, speaker: speakerLink, sponsor: sponsorLink, ...core } = entry.data;

    const slug = program.toLowerCase();

    const idPattern = new RegExp(`^\\d{4}_\\d{2}_${slug}(_\\d+)?$`);

    if (!idPattern.test(entry.id)) throw new Error(`Event ${entry.id} must be named YYYY_MM_${slug}.`);

    const speaker = speakerLink && toSpeaker(getRecord(sources.speakers, speakerLink.id, 'Speaker'));
    const sponsor = sponsorLink && toSponsor(getRecord(sources.sponsors, sponsorLink.id, 'Sponsor'));

    return {
        ...core,
        body: requireBody(entry),
        id: entry.id,
        program,
        speaker,
        sponsor,
    };
}

function toSpeaker(entry: CollectionEntry<'speakers'>) {
    return { ...entry.data, bio: requireBody(entry) };
}

function toSponsor(entry: CollectionEntry<'sponsors'>) {
    return { ...entry.data, description: requireBody(entry) };
}

export { loadEvents };
