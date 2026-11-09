import austinCommunityCollege from '@images/brand/sponsor_acc.png';
import stationAustin from '@images/brand/sponsor_station_austin.svg';

const ARTIST_NAME_MAX_LENGTH = 50;
const ASSET_KINDS = ['audio', 'bash', 'brochure', 'media', 'official'] as const;

const ASSET_KIND_LABELS: Record<AssetKind, string> = {
    audio: 'Audio',
    bash: 'Bash',
    brochure: 'Brochures',
    media: 'Media',
    official: 'Official',
};

const BASIS_POINTS_DIVISOR = 10_000;
const BYTES_PER_KILOBYTE = 1_024;
const BYTES_PER_MEGABYTE = 1_048_576;

const CANONICAL = {
    mission: 'We bring Austin\'s music producers together. Through meetups, workshops, and collaborations, producers of every genre and experience level find their people, sharpen their craft, and support one another. Our goal is a lasting community for those behind the city\'s sound.',
    story: 'Austin Producer Alliance was founded in May 2022 by Kevin Huang and Kyle Henderson to build the city\'s foremost community for music producers. What began as a Discord server grew into a recurring meetup at the Austin Central Library, then into a collective in partnership with longtime sponsor STATION Austin (formerly Capital Factory). To date, APA has welcomed more than 1,000 producers and creatives to its events.',
} as const;

const CENTS_PER_DOLLAR = 100;
const CHECKOUT_STEPS = ['1 Review', '2 Shipping', '3 Payment'] as const;

const COMMERCE = {
    discountBasisPoints: 1_000,
    discountCode: 'ALLIANCE10',
    maxQuantityPerItem: 5,
    taxBasisPoints: 825,
} as const;

const DEMO_CREDENTIALS = {
    takenEmail: 'taken@austinproduceralliance.com',
    wrongPassword: 'wrongpassword',
} as const;

const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EVENT_CADENCES = ['monthly', 'quarterly', 'biannually', 'annually'] as const;

const EVENT_PROGRAMS: Record<EventType, EventProgram> = {
    'assembly': {
        cadence: 'monthly',
        name: 'Assembly',
        shortName: 'Assembly',
        state: 'active',
        summary: 'The Alliance\'s centerpiece at STATION Austin, an evening devoted to craft and community, with time for tracks to be heard.',
    },
    'bash': {
        cadence: 'quarterly',
        name: 'Bash',
        shortName: 'Bash',
        state: 'active',
        summary: 'An afternoon of producing against the clock at ACC Highland Campus, sparked by a prompt and capped by a final showdown.',
    },
    'camp': {
        cadence: 'biannually',
        name: 'CAMP',
        shortName: 'CAMP',
        state: 'active',
        summary: 'A weekend retreat where producers disconnect from daily life and create together under one roof.',
    },
    'hangout': {
        cadence: 'monthly',
        name: 'Hangout',
        shortName: 'Hangout',
        state: 'active',
        summary: 'A pop-up social for track feedback and conversation, landing midway between Assemblies.',
    },
    'open-decks': {
        cadence: 'quarterly',
        name: 'Open Decks',
        shortName: 'Open Decks',
        state: 'planned',
        summary: 'An indoor or outdoor open stage where anyone can sign up and perform a set.',
    },
    'studio-tour': {
        cadence: 'annually',
        name: 'Studio Tour',
        shortName: 'Studio Tour',
        state: 'planned',
        summary: 'An evening group tour through the inner workings of a real Austin studio.',
    },
    'the-royale': {
        cadence: 'annually',
        name: 'The Royale',
        shortName: 'Royale',
        state: 'planned',
        summary: 'An all-day production tournament with group stages, knockout rounds, and winners decided by vote.',
    },
    'the-annual': {
        cadence: 'annually',
        name: 'The Annual',
        shortName: 'Annual',
        state: 'planned',
        summary: 'The Alliance\'s largest party, an end-of-year mixer hosted in collaboration with partner communities.',
    },
};

const EVENT_TYPES = ['assembly', 'bash', 'camp', 'hangout', 'open-decks', 'studio-tour', 'the-royale', 'the-annual'] as const;

const GENRES = [
    'afrobeats',
    'ambient',
    'disco',
    'drum & bass',
    'dubstep',
    'experimental',
    'folk',
    'funk',
    'hip-hop',
    'house',
    'indie',
    'jazz',
    'Latin',
    'lo-fi',
    'pop',
    'R&B',
    'rock',
    'soul',
    'techno',
    'trap',
    'urbano',
] as const;

const JOIN_ROUTE = '/contact#contact-topic';

const KIND_COLORS: Record<AssetKind, string> = {
    audio: 'var(--color-chart-3)',
    bash: 'var(--color-marker-cobalt)',
    brochure: 'var(--color-text-secondary)',
    media: 'var(--color-signal)',
    official: 'var(--color-marker-cobalt)',
};

const LAUNCHER_SIZE = 48;

const LINKS = {
    aephonics: 'https://instagram.com/aephonics',
    discord: 'https://discord.gg/QvAtjbWZ7b',
    email: 'hello@austinproduceralliance.com',
    hub: 'https://austinproduceralliance.com',
    instagram: 'https://instagram.com/austinproduceralliance',
    linktree: 'https://linktr.ee/austinproduceralliance',
    meetup: 'https://meetup.com/austinproduceralliance',
    soundcloud: 'https://soundcloud.com/austinproduceralliance',
    spotify: 'https://open.spotify.com/user/31uvopo4bn7six3qvkkbkjxu2bwe',
} as const;

const MAX_AVATAR_MEGABYTES = 10;
const MAX_DECODE_MEGABYTES = 25;
const MAX_FILE_MEGABYTES = 100;
const MEMBER_ROLES = ['artist', 'engineer', 'fan', 'producer'] as const;
const MILLISECONDS_PER_DAY = 86_400_000;
const MILLISECONDS_PER_HOUR = 3_600_000;
const MOBILE_WIDTH = 768;
const MOCK_LATENCY_MILLISECONDS = 400;

const NAV_GROUPS = [
    {
        id: 'events',
        items: [
            { href: '/assemblies', label: 'Assemblies' },
            { href: '/bashes', label: 'Bashes' },
            { href: '/hangouts', label: 'Hangouts' },
        ],
        label: 'Events',
    },
    {
        id: 'community',
        items: [
            { href: '/directory', label: 'Directory' },
            { href: '/partners', label: 'Partners' },
            { href: '/gallery', label: 'Gallery' },
            { href: '/about', label: 'About' },
            { href: '/contact', label: 'Contact' },
        ],
        label: 'Community',
    },
    {
        href: '/resources',
        id: 'resources',
        label: 'Resources',
    },
    {
        href: '/store',
        id: 'store',
        label: 'Store',
    },
    {
        href: '/rack',
        id: 'rack',
        label: 'Rack',
    },
] as const;

const ONBOARDING_ROUTE = '/onboarding';

const ONBOARDING_STEPS = [
    { name: 'Basics' },
    { name: 'Why an account' },
    { name: 'The tour' },
] as const;

const ONBOARDING_TOKEN_PARAMETER = 't';
const ONBOARDING_TOKEN_TTL_HOURS = 24;

const ORDER_ID = {
    digits: 5,
    prefix: 'APA-',
    range: 100_000,
} as const;

const PALETTE = [
    { background: 'var(--color-avatar-1-bg)', text: 'var(--color-avatar-1-text)' },
    { background: 'var(--color-avatar-2-bg)', text: 'var(--color-avatar-2-text)' },
    { background: 'var(--color-avatar-3-bg)', text: 'var(--color-avatar-3-text)' },
    { background: 'var(--color-avatar-4-bg)', text: 'var(--color-avatar-4-text)' },
    { background: 'var(--color-avatar-5-bg)', text: 'var(--color-avatar-5-text)' },
    { background: 'var(--color-avatar-6-bg)', text: 'var(--color-avatar-6-text)' },
] as const;

const PARTNERS = [
    { logo: austinCommunityCollege, name: 'Austin Community College' },
    { logo: stationAustin, name: 'STATION Austin' },
] as const;

const PARTNER_INQUIRY_TOPIC = 'Partnerships';
const PARTNER_LOGO_WIDTH = 640;
const PASSWORD_MIN_LENGTH = 12;
const POINTER_COARSE_QUERY = '(pointer: coarse)';
const PRODUCT_CATEGORIES = ['apparel', 'accessories', 'audio', 'tickets'] as const;
const PRODUCT_SIZES = ['S', 'M', 'L', 'XL'] as const;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const ROLES = [
    { description: 'Runs the Alliance: programs, money, and this site.', id: 'admin', label: 'Admin' },
    { description: 'Opens the room, runs check-in, and keeps events moving.', id: 'host', label: 'Host' },
    { description: 'Makes tracks.', id: 'producer', label: 'Producer' },
    { description: 'Mixes, masters, and runs sound.', id: 'engineer', label: 'Engineer' },
    { description: 'Performs and releases under their own name.', id: 'artist', label: 'Artist' },
    { description: 'Here for the music. Every account starts here.', id: 'fan', label: 'Fan' },
] as const;

const SESSION_TTL_DAYS = 14;
const SITE_UPDATED = '2026-11-11T00:00:00-06:00';

const STORAGE = {
    adminProds: { key: 'apa.admin-prods', scope: 'local', topic: 'apa:admin-prods-changed' },
    bashBoard: { key: 'apa.bash-board', scope: 'local', topic: 'apa:bash-board-changed' },
    cart: { key: 'apa.cart', scope: 'local', topic: 'apa:cart-changed' },
    chat: { key: 'apa.chat', scope: 'local', topic: 'apa:chat-changed' },
    newsletter: { key: 'apa.newsletter', scope: 'local', topic: 'apa:newsletter-changed' },
    onboardingDraft: { key: 'apa.onboarding-draft', scope: 'local', topic: 'apa:onboarding-draft-changed' },
    order: { key: 'apa.order', scope: 'local', topic: 'apa:order-changed' },
    player: { key: 'apa.player', scope: 'memory', topic: 'apa:player-changed' },
    profiles: { key: 'apa.profiles', scope: 'local', topic: 'apa:profiles-changed' },
    rack: { key: 'apa.rack', scope: 'memory', topic: 'apa:rack-changed' },
    session: { key: 'apa.session', scope: 'local', topic: 'apa:session-changed' },
    theme: { key: 'apa.theme', scope: 'local', topic: 'apa:theme-changed' },
    tour: { key: 'apa.tour', scope: 'local', topic: 'apa:tour-changed' },
} as const;

const TOUR_STOPS = [
    {
        blurb: 'Events, community, resources, the store, the rack.',
        body: 'Everything lives here: events, community, resources, the store, and the rack.',
        name: 'The nav',
        selectors: ['.site-nav', '.nav-toggle'],
    },
    {
        blurb: 'Your profile and your cart, side by side.',
        body: 'Your profile keeps orders, Prods, and settings. The cart sits right beside it.',
        name: 'Profile and cart',
        selectors: ['.account', '.cart-link'],
    },
    {
        blurb: 'It keeps playing, page to page.',
        body: 'The track player follows you from page to page.',
        name: 'The player',
        selectors: ['[data-player-launcher]'],
    },
    {
        blurb: 'The member room, one tap away.',
        body: 'The member room. Talk to the Alliance.',
        name: 'Member chat',
        selectors: ['[data-chat-launcher]'],
    },
    {
        blurb: 'Ask it anything about the Alliance.',
        body: 'Ask the assistant anything: programs, events, Prods.',
        name: 'The assistant',
        selectors: ['[data-ai-launcher]'],
    },
] as const;

const TRACK_PLAY_TOPIC = 'apa:track-play';
const TRACK_STATE_TOPIC = 'apa:track-state';

const US_STATES = [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'DC', name: 'District of Columbia' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' },
] as const;

const WELCOME_PRODS = 1;
const WINDOW_MARGINS = 48;

const AVATAR = {
    acceptAttribute: '.jpeg,.jpg,.png,image/jpeg,image/png',
    aliasExtensions: ['jpeg'],
    extensions: ['jpg', 'png'],
    fallbackType: 'image/jpeg',
    maxDataUrlLength: 200_000,
    maxFileBytes: MAX_AVATAR_MEGABYTES * BYTES_PER_MEGABYTE,
    minEdgePixels: 500,
    renderPixels: 512,
    renderQuality: 0.82,
    renderType: 'image/webp',
} as const;

const CARD_COLORS = PALETTE.slice(0, 4);

const CONTACT_LIMITS = {
    email: EMAIL_MAX_LENGTH,
    message: 2_000,
    messageMin: 10,
    name: 50,
} as const;

const CONTACT_TOPICS = [
    'Accounts',
    'Bug report',
    'Events',
    PARTNER_INQUIRY_TOPIC,
    'Store orders',
    'Something else',
] as const;

const FIELD_LIMITS = {
    address: 100,
    card: 19,
    code: 20,
    csc: 4,
    email: EMAIL_MAX_LENGTH,
    expiry: 7,
    name: 50,
    zip: 10,
} as const;

const PLATFORMS = [
    { blurb: 'Recaps, announcements, and work from across the roster.', href: LINKS.instagram, label: 'Instagram' },
    { blurb: 'Event listings and RSVPs for every meet on the calendar.', href: LINKS.meetup, label: 'Meetup' },
    { blurb: 'The day-to-day room where the community actually talks.', href: LINKS.discord, label: 'Discord' },
] as const;

const PROFILE_FIELDS = {
    artistName: {
        autocomplete: 'nickname',
        label: 'Artist name',
        maxLength: ARTIST_NAME_MAX_LENGTH,
        message: `Use ${ARTIST_NAME_MAX_LENGTH} characters or fewer.`,
    },
    bio: {
        label: 'Bio',
        maxLength: 400,
    },
    city: {
        autocomplete: 'address-level2',
        label: 'City',
        message: 'Name the city you work out of.',
        required: true,
    },
    genres: {
        label: 'What you make',
    },
    portrait: {
        label: 'Portrait',
        picker: 'Choose an image',
    },
    role: {
        label: 'What do you do?',
        qualifier: 'pick one',
    },
    state: {
        autocomplete: 'address-level1',
        label: 'State',
        required: true,
    },
} as const;

const PROFILE_ROLES = ROLES.filter(role => MEMBER_ROLES.some(member => member === role.id));

const ROUTES = [
    { href: '/', label: 'Home' },
    ...NAV_GROUPS.flatMap<{ href: string; label: string }>(group => ('href' in group ? [{ href: group.href, label: group.label }] : group.items)),
] as const;

const UPLOAD = {
    acceptAttribute: '.mp3,.wav,audio/mpeg,audio/wav,audio/x-wav',
    extensions: ['mp3', 'wav'],
    failureTrigger: 'fail',
    maxDecodeBytes: MAX_DECODE_MEGABYTES * BYTES_PER_MEGABYTE,
    maxFileBytes: MAX_FILE_MEGABYTES * BYTES_PER_MEGABYTE,
} as const;

export {
    ASSET_KINDS,
    ASSET_KIND_LABELS,
    AVATAR,
    BASIS_POINTS_DIVISOR,
    BYTES_PER_KILOBYTE,
    BYTES_PER_MEGABYTE,
    CANONICAL,
    CARD_COLORS,
    CENTS_PER_DOLLAR,
    CHECKOUT_STEPS,
    COMMERCE,
    CONTACT_LIMITS,
    CONTACT_TOPICS,
    DEMO_CREDENTIALS,
    EMAIL_MAX_LENGTH,
    EMAIL_PATTERN,
    EVENT_CADENCES,
    EVENT_PROGRAMS,
    EVENT_TYPES,
    FIELD_LIMITS,
    GENRES,
    JOIN_ROUTE,
    KIND_COLORS,
    LAUNCHER_SIZE,
    LINKS,
    MEMBER_ROLES,
    MILLISECONDS_PER_DAY,
    MILLISECONDS_PER_HOUR,
    MOBILE_WIDTH,
    MOCK_LATENCY_MILLISECONDS,
    NAV_GROUPS,
    ONBOARDING_ROUTE,
    ONBOARDING_STEPS,
    ONBOARDING_TOKEN_PARAMETER,
    ONBOARDING_TOKEN_TTL_HOURS,
    ORDER_ID,
    PALETTE,
    PARTNERS,
    PARTNER_INQUIRY_TOPIC,
    PARTNER_LOGO_WIDTH,
    PASSWORD_MIN_LENGTH,
    PLATFORMS,
    POINTER_COARSE_QUERY,
    PRODUCT_CATEGORIES,
    PRODUCT_SIZES,
    PROFILE_FIELDS,
    PROFILE_ROLES,
    REDUCED_MOTION_QUERY,
    ROLES,
    ROUTES,
    SESSION_TTL_DAYS,
    SITE_UPDATED,
    STORAGE,
    TOUR_STOPS,
    TRACK_PLAY_TOPIC,
    TRACK_STATE_TOPIC,
    UPLOAD,
    US_STATES,
    WELCOME_PRODS,
    WINDOW_MARGINS,
};
