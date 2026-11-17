import { getCollection } from 'astro:content';

import { LOCALE, TIME_ZONE } from '@lib/shared/constants';

import type { CollectionEntry } from 'astro:content';

interface Sources {
    programs: Program[];
    speakers: CollectionEntry<'speakers'>[];
    sponsors: CollectionEntry<'sponsors'>[];
}

const CREDIT_SEPARATOR = ' \u00b7 ';
const ROMAN_MONTHS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'] as const;

function formatEventName(data: EventData, program: Program, speaker?: Speaker) {
    if (data.title && program.id === 'bash') return `${data.title} ${program.name}`;

    const month = program.title_style === 'numeral'
        ? ROMAN_MONTHS[Number(data.starts_at.toLocaleDateString(LOCALE, { month: 'numeric', timeZone: TIME_ZONE })) - 1]
        : data.starts_at.toLocaleDateString(LOCALE, { month: 'long', timeZone: TIME_ZONE });

    const stamp = `${month} ${data.starts_at.toLocaleDateString(LOCALE, { timeZone: TIME_ZONE, year: 'numeric' })}`;

    return speaker ? `${stamp} ${program.name}${CREDIT_SEPARATOR}${speaker.name}` : stamp;
}

async function getProgram(id: string): Promise<Program> {
    return getRecord(await loadPrograms(), id, 'Program');
}

function getRecord<T extends { id: string }>(records: T[], id: string, label: string) {
    const record = records.find(candidate => candidate.id === id);

    if (!record) throw new Error(`${label} ${id} has no file.`);

    return record;
}

async function loadEvents(): Promise<EventRecord[]> {
    const events = await getCollection('events');

    const sources = {
        programs: await loadPrograms(),
        speakers: await getCollection('speakers'),
        sponsors: await getCollection('sponsors'),
    };

    return events
        .map(entry => toEventRecord(entry, sources))
        .sort((a, b) => +a.starts_at - +b.starts_at);
}

async function loadPrograms(): Promise<Program[]> {
    const programs = await getCollection('programs');

    return programs
        .map(toProgram)
        .sort((a, b) => a.id.localeCompare(b.id));
}

function requireText(text: string | undefined, label: string) {
    if (text === undefined) throw new Error(`${label} is missing and its program sets no default.`);

    return text;
}

function toEventRecord(entry: CollectionEntry<'events'>, sources: Sources) {
    const { program: programLink, speaker: speakerLink, sponsors: sponsorLinks, ...core } = entry.data;

    const program = getRecord(sources.programs, programLink.id, 'Program');

    const idPattern = new RegExp(`^\\d{4}_\\d{2}_${program.id}(_\\d+)?$`);

    if (!idPattern.test(entry.id)) throw new Error(`Event ${entry.id} must be named YYYY_MM_${program.id}.`);

    const speaker = speakerLink && toSpeaker(getRecord(sources.speakers, speakerLink.id, 'Speaker'));

    const sponsors = sponsorLinks
        .map(link => getRecord(sources.sponsors, link.id, 'Sponsor'))
        .map(toSponsor);

    return {
        ...core,
        body: requireText(entry.body ?? program.default_body, `The body of event ${entry.id}`),
        id: entry.id,
        name: formatEventName(entry.data, program, speaker),
        program,
        speaker,
        sponsors,
    };
}

function toProgram(entry: CollectionEntry<'programs'>) {
    if (!entry.body) throw new Error(`Program ${entry.id} needs a summary as the body of its file.`);

    return { ...entry.data, id: entry.id, summary: entry.body };
}

function toSpeaker(entry: CollectionEntry<'speakers'>) {
    if (!entry.body) throw new Error(`Speaker ${entry.id} needs a bio as the body of its file.`);

    return { ...entry.data, bio: entry.body };
}

function toSponsor(entry: CollectionEntry<'sponsors'>) {
    if (!entry.body) throw new Error(`Sponsor ${entry.id} needs a description as the body of its file.`);

    return { ...entry.data, description: entry.body };
}

export { getProgram, loadEvents, loadPrograms };
