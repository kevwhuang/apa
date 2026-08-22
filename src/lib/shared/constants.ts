import austinCommunityCollege from '@images/logos/austin_community_college.png';
import stationAustin from '@images/logos/station_austin.svg';

const ARTIST_NAME_MAX_LENGTH = 50;
const ASSET_KINDS = ['brochure', 'document', 'media-kit', 'photo-pack', 'press-kit', 'sample-pack', 'slides', 'stems', 'video'] as const;

const ASSET_KIND_LABELS: Record<AssetKind, string> = {
    'brochure': 'Brochure',
    'document': 'Document',
    'media-kit': 'Media kit',
    'photo-pack': 'Photo pack',
    'press-kit': 'Press kit',
    'sample-pack': 'Sample pack',
    'slides': 'Slides',
    'stems': 'Stems',
    'video': 'Video',
};

const BASIS_POINTS_DIVISOR = 10_000;
const BYTES_PER_KILOBYTE = 1_024;
const BYTES_PER_MEGABYTE = 1_048_576;

const MAX_AVATAR_MEGABYTES = 5;

const AVATAR = {
    acceptAttribute: '.jpeg,.jpg,.png,.webp,image/jpeg,image/png,image/webp',
    aliasExtensions: ['jpeg'],
    extensions: ['jpg', 'png', 'webp'],
    fallbackType: 'image/jpeg',
    maxDataUrlLength: 200_000,
    maxFileBytes: MAX_AVATAR_MEGABYTES * BYTES_PER_MEGABYTE,
    minEdgePixels: 200,
    renderPixels: 512,
    renderQuality: 0.82,
    renderType: 'image/webp',
} as const;

const CANONICAL = {
    history: 'Austin Producer Alliance was founded in May 2022 by Kevin Huang and Kyle Henderson to build the city\'s foremost community for music producers. What began as a Discord server grew into a recurring meetup at the Austin Central Library, then into a collective in collaboration with longtime partner Station Austin (formerly Capital Factory). To date, APA has welcomed more than 500 producers and creatives to its events.',
    mission: 'We bring Austin\'s music producers together. Through meetups, workshops, and collaborations, producers of every genre and experience level find their people, sharpen their craft, and support one another. Our goal is a lasting community for those behind the city\'s sound.',
} as const;

const CENTS_PER_DOLLAR = 100;
const CHECKOUT_STEPS = ['01 Review', '02 Shipping', '03 Payment'] as const;

const COMMERCE = {
    discountBasisPoints: 1_000,
    discountCode: 'ALLIANCE10',
    maxQuantityPerItem: 5,
    taxBasisPoints: 825,
} as const;

const EMAIL_MAX_LENGTH = 254;

const CONTACT_LIMITS = {
    email: EMAIL_MAX_LENGTH,
    message: 2_000,
    messageMin: 10,
    name: 50,
} as const;

const PARTNER_INQUIRY_TOPIC = 'Partnership inquiry';

const CONTACT_TOPICS = ['Booking', 'Membership', PARTNER_INQUIRY_TOPIC, 'Press', 'Something else'] as const;
const CONTENT_DIR = 'src/content';

const DEMO_CREDENTIALS = {
    takenEmail: 'taken@austinproduceralliance.com',
    wrongPassword: 'wrongpassword',
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EVENT_CADENCES = ['monthly', 'bimonthly', 'quarterly', 'yearly'] as const;

const EVENT_PROGRAMS: Record<EventType, EventProgram> = {
    'assembly': {
        cadence: 'monthly',
        name: 'Assembly',
        shortName: 'Assembly',
        state: 'active',
        summary: 'The Alliance\'s centerpiece at Station Austin, an evening devoted to craft and community, with time for tracks to be heard.',
    },
    'hangout': {
        cadence: 'monthly',
        name: 'Hangout',
        shortName: 'Hangout',
        state: 'active',
        summary: 'A pop-up social for connecting beyond the music, landing midway between Assemblies.',
    },
    'bash': {
        cadence: 'bimonthly',
        name: 'Bash',
        shortName: 'Bash',
        state: 'active',
        summary: 'An afternoon of producing against the clock at Austin Community College, sparked by a prompt and capped by a final showdown.',
    },
    'open-decks': {
        cadence: 'quarterly',
        name: 'Open Decks',
        shortName: 'Open Decks',
        state: 'planned',
        summary: 'An indoor or outdoor open stage where anyone can sign up and perform a set.',
    },
    'studio-tour': {
        cadence: 'yearly',
        name: 'Studio Tour',
        shortName: 'Studio Tour',
        state: 'planned',
        summary: 'An evening group tour through the inner workings of a real Austin studio.',
    },
    'producer-camp': {
        cadence: 'yearly',
        name: 'Producer Camp',
        shortName: 'Camp',
        state: 'planned',
        summary: 'A weekend retreat where producers disconnect from daily life and create together under one roof.',
    },
    'producer-royale': {
        cadence: 'yearly',
        name: 'Producer Royale',
        shortName: 'Royale',
        state: 'planned',
        summary: 'An all-day production tournament with group stages, knockout rounds, and winners decided by vote.',
    },
    'the-annual': {
        cadence: 'yearly',
        name: 'The Annual',
        shortName: 'Annual',
        state: 'planned',
        summary: 'The Alliance\'s largest party, an end-of-year mixer hosted in collaboration with partner communities.',
    },
};

const EVENT_STATUSES = ['past', 'upcoming'] as const;
const EVENT_TYPES = ['assembly', 'hangout', 'bash', 'open-decks', 'studio-tour', 'producer-camp', 'producer-royale', 'the-annual'] as const;

const FIELD_LIMITS = {
    address: 100,
    card: 19,
    code: 20,
    csc: 4,
    email: EMAIL_MAX_LENGTH,
    expiry: 7,
    name: 50,
} as const;

const GENRES = ['afrobeats', 'ambient', 'disco', 'drum & bass', 'dubstep', 'experimental', 'folk', 'funk', 'hip-hop', 'house', 'indie', 'jazz', 'Latin', 'lo-fi', 'pop', 'R&B', 'reggaeton', 'rock', 'soul', 'techno', 'trap'] as const;
const JOIN_ROUTE = '/contact#contact-topic';

const KIND_COLORS: Record<AssetKind, string> = {
    'brochure': 'var(--color-signal)',
    'document': 'var(--color-ink-muted)',
    'media-kit': 'var(--color-bloom-deep)',
    'photo-pack': 'var(--color-pulse-deep)',
    'press-kit': 'var(--color-accent-deep)',
    'sample-pack': 'var(--color-surface-violet)',
    'slides': 'var(--color-signal-deep)',
    'stems': 'var(--color-accent)',
    'video': 'var(--color-bloom)',
};

const LINKS = {
    aephonics: 'https://instagram.com/aephonics',
    discord: 'https://discord.gg/aVM3mbRRpU',
    email: 'hello@austinproduceralliance.com',
    hub: 'https://austinproduceralliance.com',
    instagram: 'https://www.instagram.com/austin_producer_alliance',
    meetup: 'https://www.meetup.com/austin-producer-alliance',
    pressEmail: 'press@austinproduceralliance.com',
} as const;

const MAX_DECODE_MEGABYTES = 25;
const MAX_FILE_MEGABYTES = 50;
const MAX_SPOTLIGHT_MEGABYTES = 20;
const MAX_TOTAL_MEGABYTES = 150;
const MEMBER_ROLES = ['artist', 'engineer', 'fan', 'producer'] as const;
const MILLISECONDS_PER_DAY = 86_400_000;
const MILLISECONDS_PER_HOUR = 3_600_000;
const MOCK_LATENCY_MS = 400;

const NAV_GROUPS = [
    {
        id: 'events',
        items: [
            { href: '/events', label: 'All events' },
            { href: '/assembly', label: 'Assembly' },
            { href: '/bash', label: 'Bash' },
            { href: '/hangout', label: 'Hangout' },
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
    { blurb: 'Name, sound, and what you do.', name: 'Basics' },
    { blurb: 'What the account carries.', name: 'Why an account' },
    { blurb: 'A guided lap around the room.', name: 'The tour' },
] as const;

const ONBOARDING_TOKEN_PARAM = 't';
const ONBOARDING_TOKEN_TTL_HOURS = 24;

const ORDER_ID = {
    digits: 5,
    prefix: 'APA-',
    range: 100_000,
} as const;

const PALETTE = [
    'var(--color-accent)',
    'var(--color-signal)',
    'var(--color-pulse-deep)',
    'var(--color-bloom)',
    'var(--color-surface-violet)',
    'var(--color-bloom-deep)',
    'var(--color-signal-deep)',
    'var(--color-accent-deep)',
] as const;

const CARD_COLORS = PALETTE.slice(0, 4);

const PARTNERS = [
    { logo: austinCommunityCollege, name: 'Austin Community College' },
    { logo: stationAustin, name: 'Station Austin' },
] as const;

const PARTNER_LOGO_WIDTH = 640;
const PASSWORD_MIN_LENGTH = 12;

const PLATFORMS = [
    { blurb: 'Event listings and RSVPs for every meet on the calendar.', href: LINKS.meetup, label: 'Meetup' },
    { blurb: 'The day-to-day room where the community actually talks.', href: LINKS.discord, label: 'Discord' },
    { blurb: 'Recaps, announcements, and work from across the roster.', href: LINKS.instagram, label: 'Instagram' },
] as const;

const POINTER_COARSE_QUERY = '(pointer: coarse)';
const PRODUCT_CATEGORIES = ['accessory', 'apparel', 'music'] as const;
const PRODUCT_SIZES = ['S', 'M', 'L', 'XL'] as const;

const PROFILE_FIELDS = {
    artistName: {
        autocomplete: 'nickname',
        help: `Up to ${ARTIST_NAME_MAX_LENGTH} characters. This is what the roster shows \u2014 it cannot be used to sign in.`,
        label: 'Artist name',
        maxLength: ARTIST_NAME_MAX_LENGTH,
    },
    bio: {
        help: 'A line or two on what you make and how you make it.',
        label: 'Bio',
        maxLength: 280,
    },
    city: {
        autocomplete: 'address-level2',
        label: 'City',
        message: 'Name the city you work out of.',
        required: true,
    },
    genres: {
        label: 'What you make',
        max: 5,
        message: 'Pick five at most.',
        qualifier: 'Pick up to five',
    },
    portrait: {
        label: 'Portrait',
        picker: 'Choose an image',
    },
    role: {
        label: 'What do you do?',
        qualifier: 'Pick one',
    },
    state: {
        autocomplete: 'address-level1',
        label: 'State',
        required: true,
    },
} as const;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const ROLES = [
    { description: 'Runs the Alliance \u2014 programs, money, and this site.', id: 'admin' },
    { description: 'Opens the room, runs check-in, and keeps events moving.', id: 'host' },
    { description: 'Makes tracks.', id: 'producer' },
    { description: 'Mixes, masters, and runs sound.', id: 'engineer' },
    { description: 'Performs and releases under their own name.', id: 'artist' },
    { description: 'Here for the music. Every account starts here.', id: 'fan' },
] as const;

const PROFILE_ROLES = ROLES.filter(role => MEMBER_ROLES.some(member => member === role.id));

const ROUTES = [
    { href: '/', label: 'Home' },
    ...NAV_GROUPS.flatMap<{ href: string; label: string }>(group => ('href' in group ? [{ href: group.href, label: group.label }] : group.items)),
] as const;

const SESSION_TTL_DAYS = 14;
const SITE_UPDATED = '2026-08-07T00:00:00-05:00';

const SPOTLIGHT = {
    acceptAttribute: '.mp3,audio/mpeg',
    extensions: ['mp3'],
    maxFileBytes: MAX_SPOTLIGHT_MEGABYTES * BYTES_PER_MEGABYTE,
} as const;

const SPOTLIGHT_EXTENSIONS_LABEL = SPOTLIGHT.extensions.map(extension => extension.toUpperCase()).join(', ');

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
        blurb: 'Events, the directory, the gallery, the store.',
        body: 'Everything lives here \u2014 events, the directory, the gallery, the store.',
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
        blurb: 'Ask it anything about the Alliance.',
        body: 'Ask the assistant anything \u2014 programs, events, Prods.',
        name: 'The assistant',
        selectors: ['[data-ai-launcher]'],
    },
    {
        blurb: 'The member room, one tap away.',
        body: 'The member room \u2014 talk to the Alliance.',
        name: 'Member chat',
        selectors: ['[data-chat-launcher]'],
    },
    {
        blurb: 'It keeps playing, page to page.',
        body: 'The floating player follows you from page to page.',
        name: 'The player',
        selectors: ['[data-player-launcher]'],
    },
] as const;

const TRACK_PLAY_TOPIC = 'apa:track-play';
const TRACK_STATE_TOPIC = 'apa:track-state';

const UPLOAD = {
    acceptAttribute: '.aif,.aiff,.flac,.mp3,.wav,audio/aiff,audio/flac,audio/mpeg,audio/wav,audio/x-aiff,audio/x-wav',
    extensions: ['aif', 'aiff', 'flac', 'mp3', 'wav'],
    failureTrigger: 'fail',
    maxDecodeBytes: MAX_DECODE_MEGABYTES * BYTES_PER_MEGABYTE,
    maxFileBytes: MAX_FILE_MEGABYTES * BYTES_PER_MEGABYTE,
    maxFiles: 5,
    maxTotalBytes: MAX_TOTAL_MEGABYTES * BYTES_PER_MEGABYTE,
} as const;

const UPLOAD_EXTENSIONS_LABEL = UPLOAD.extensions.map(extension => extension.toUpperCase()).join(', ');

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
    CONTENT_DIR,
    DEMO_CREDENTIALS,
    EMAIL_MAX_LENGTH,
    EMAIL_PATTERN,
    EVENT_CADENCES,
    EVENT_PROGRAMS,
    EVENT_STATUSES,
    EVENT_TYPES,
    FIELD_LIMITS,
    GENRES,
    JOIN_ROUTE,
    KIND_COLORS,
    LINKS,
    MEMBER_ROLES,
    MILLISECONDS_PER_DAY,
    MILLISECONDS_PER_HOUR,
    MOCK_LATENCY_MS,
    NAV_GROUPS,
    ONBOARDING_ROUTE,
    ONBOARDING_STEPS,
    ONBOARDING_TOKEN_PARAM,
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
    SPOTLIGHT,
    SPOTLIGHT_EXTENSIONS_LABEL,
    STORAGE,
    TOUR_STOPS,
    TRACK_PLAY_TOPIC,
    TRACK_STATE_TOPIC,
    UPLOAD,
    UPLOAD_EXTENSIONS_LABEL,
    US_STATES,
    WELCOME_PRODS,
};
