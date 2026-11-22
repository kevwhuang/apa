import austinCommunityCollege from '@images/brand/sponsor_acc.png';
import stationAustin from '@images/brand/sponsor_station_austin.svg';

const AI_QUESTION_MAX_LENGTH = 500;
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
const CANCELED_MESSAGE = 'Canceled.';

const CANONICAL = {
    mission: 'We bring Austin\'s music producers together. Through meetups, workshops, and collaborations, producers of every genre and experience level find their people, sharpen their craft, and support one another. Our goal is a lasting community for those behind the city\'s sound.',
    story: 'Austin Producer Alliance was founded in May 2022 by Kevin Huang and Kyle Henderson to build the city\'s foremost community for music producers. What began as a Discord server grew into a recurring meetup at the Austin Central Library, then into a collective in partnership with longtime sponsor STATION Austin (formerly Capital Factory). To date, APA has welcomed more than 1,000 producers and creatives to its events.',
} as const;

const CART_CHANGED_MESSAGE = 'Your cart changed while you were checking out. Review it and try again.';
const CENTS_PER_DOLLAR = 100;
const CHAT_MESSAGE_MAX_LENGTH = 500;
const CHECKOUT_STEPS = ['1 Review', '2 Shipping', '3 Payment'] as const;
const CHECK_VIOLATION = '23514';

const COMMERCE = {
    discountBasisPoints: 1_000,
    discountCode: 'ALLIANCE10',
    maxQuantityPerItem: 5,
    minChargeCents: 50,
    taxBasisPoints: 825,
} as const;

const DECODE_FAILED_MESSAGE = 'That file could not be decoded.';
const DEFAULT_ROLE = 'fan';
const DEFAULT_STATE = 'TX';
const DUPLICATE_FILE_MESSAGE = 'That file is already in the queue.';
const EMAIL_MAX_LENGTH = 254;
const EMAIL_MESSAGE = 'Enter a valid email address.';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_REQUIRED_MESSAGE = 'Enter your email address.';

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

const GIFT_FAILED_MESSAGE = 'Your gift did not go through. Try again.';
const HERO_FIELD_SELECTOR = '.hero__field';
const HOVER_QUERY = '(hover: hover)';
const INVALID_BODY_MESSAGE = 'Invalid request body.';
const JOIN_ROUTE = '/contact';

const KIND_COLORS: Record<AssetKind, string> = {
    audio: 'var(--color-chart-2)',
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

const LINK_MAX_LENGTH = 100;
const LOAD_FAILED_MESSAGE = 'That could not be loaded. Reload to try again.';
const LOCALE = 'en-US';
const MAX_AVATAR_MEGABYTES = 10;
const MAX_DECODE_MEGABYTES = 25;
const MAX_FILE_MEGABYTES = 50;
const MAX_PIXEL_RATIO = 2;
const MEMBER_ROLES = ['artist', 'engineer', 'fan', 'producer'] as const;
const MILLISECONDS_PER_HOUR = 3_600_000;
const MILLISECONDS_PER_SECOND = 1_000;
const MOBILE_WIDTH = 768;

const MODULE_NAMES: Record<RackKind, string> = {
    chorus: 'Weave',
    compressor: 'Clamp',
    delay: 'Relay',
    distortion: 'Scorch',
    eq: 'Ledger',
    filter: 'Sieve',
    gate: 'Latch',
    highpass: 'Sill',
    limiter: 'Ceiling',
    meter: 'Needle',
    pan: 'Bearing',
    reverb: 'Chamber',
    saturator: 'Grit',
    tremolo: 'Pulse',
    trim: 'Tare',
    tuner: 'Pitchfork',
};

const MOTION_SELECTOR = '[data-motion], [data-motion-stagger] > *';

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

const NETWORK_MESSAGE = 'That did not go through. Check your connection and try again.';
const NOT_FOUND_MESSAGE = 'Not found.';
const ONBOARDING_ROUTE = '/onboarding';

const ONBOARDING_STEPS = [
    { name: 'Basics' },
    { name: 'Why an account' },
    { name: 'The tour' },
] as const;

const PALETTE = [
    { background: 'var(--color-avatar-1-bg)', text: 'var(--color-avatar-1-text)' },
    { background: 'var(--color-avatar-2-bg)', text: 'var(--color-avatar-2-text)' },
    { background: 'var(--color-avatar-3-bg)', text: 'var(--color-avatar-3-text)' },
    { background: 'var(--color-avatar-4-bg)', text: 'var(--color-avatar-4-text)' },
    { background: 'var(--color-avatar-5-bg)', text: 'var(--color-avatar-5-text)' },
    { background: 'var(--color-avatar-6-bg)', text: 'var(--color-avatar-6-text)' },
] as const;

const PARAGRAPH_SEPARATOR = '\n\n';

const PARTNERS = [
    { logo: austinCommunityCollege, name: 'Austin Community College' },
    { logo: stationAustin, name: 'STATION Austin' },
] as const;

const PARTNER_INQUIRY_TOPIC = 'Partnerships';
const PARTNER_LOGO_WIDTH = 640;
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_MIN_LENGTH = 12;
const PAYMENTS_NOT_CONFIGURED_MESSAGE = 'Payments are not configured.';
const PAYMENT_FAILED_MESSAGE = 'Your payment did not go through. Check your card details and try again.';
const PERMISSION_DENIED = '42501';
const POINTER_COARSE_QUERY = '(pointer: coarse)';
const PORTRAIT_REMOVED_MESSAGE = 'Portrait removed.';
const PORTRAIT_STAGED_MESSAGE = 'Portrait staged.';
const PRODS_NEGATIVE_MESSAGE = 'This would take the balance below zero.';
const PRODUCT_CATEGORIES = ['apparel', 'accessories', 'audio', 'tickets'] as const;
const PRODUCT_SIZES = ['S', 'M', 'L', 'XL'] as const;
const PROMO_CODE_MESSAGE = 'That code is not valid.';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const ROLES = [
    { description: 'Runs the Alliance: programs, money, and this site.', id: 'admin', label: 'Admin' },
    { description: 'Opens the room, runs check-in, and keeps events moving.', id: 'host', label: 'Host' },
    { description: 'Makes tracks.', id: 'producer', label: 'Producer' },
    { description: 'Mixes, masters, and runs sound.', id: 'engineer', label: 'Engineer' },
    { description: 'Performs and releases under their own name.', id: 'artist', label: 'Artist' },
    { description: 'Here for the music. Every account starts here.', id: 'fan', label: 'Fan' },
] as const;

const SECONDS_PER_MINUTE = 60;

const SECURITY_HEADERS = {
    'content-security-policy': 'base-uri \'none\'; connect-src \'self\' https://*.supabase.co https://api.stripe.com wss://*.supabase.co; default-src \'self\'; form-action \'self\'; frame-ancestors \'self\'; frame-src https://*.js.stripe.com https://hooks.stripe.com https://js.stripe.com; img-src \'self\' data: https://*.supabase.co; media-src \'self\' https://*.supabase.co; script-src \'self\' \'unsafe-inline\' https://*.js.stripe.com https://js.stripe.com; style-src \'self\' \'unsafe-inline\'',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'sameorigin',
} as const;

const SETTINGS_ROUTE = '/settings';
const SIGNED_URL_SECONDS = 3_600;
const SIGN_IN_FIRST_MESSAGE = 'Sign in first.';
const SITE_UPDATED = '2026-11-22T00:00:00-06:00';
const STATUS_SERVER_ERROR = 500;
const STEPS_PER_BEAT = 4;

const STORAGE = {
    boards: { key: 'apa.boards', scope: 'memory', topic: 'apa:boards-changed' },
    cart: { key: 'apa.cart', scope: 'local', topic: 'apa:cart-changed' },
    chat: { key: 'apa.chat', scope: 'memory', topic: 'apa:chat-changed' },
    onboardingDraft: { key: 'apa.onboarding-draft', scope: 'local', topic: 'apa:onboarding-draft-changed' },
    order: { key: 'apa.order', scope: 'local', topic: 'apa:order-changed' },
    player: { key: 'apa.player', scope: 'memory', topic: 'apa:player-changed' },
    rack: { key: 'apa.rack', scope: 'memory', topic: 'apa:rack-changed' },
    session: { key: 'apa.session', scope: 'local', topic: 'apa:session-changed' },
    switches: { key: 'apa.switches', scope: 'memory', topic: 'apa:switches-changed' },
    theme: { key: 'apa.theme', scope: 'local', topic: 'apa:theme-changed' },
    tour: { key: 'apa.tour', scope: 'local', topic: 'apa:tour-changed' },
} as const;

const STORAGE_BUCKETS = {
    avatars: 'avatars',
    tracks: 'tracks',
} as const;

const TIME_ZONE = 'America/Chicago';
const TITLE_SEPARATOR = ' | ';

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

const TRACK_CONTENT_TYPES = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
} as const;

const TRACK_LOAD_MESSAGE = 'That track did not load. Try again in a few minutes.';
const TRACK_PLAY_TOPIC = 'apa:track-play';
const TRACK_STATE_TOPIC = 'apa:track-state';
const TRIGGER_START = 'top 85%';
const UNIQUE_VIOLATION = '23505';
const UNSUBSCRIBE_PARAMETER = 'unsubscribe';

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

const WINDOW_MARGINS = 48;
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

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

const CONTACT_MESSAGES = {
    email: EMAIL_MESSAGE,
    message: 'Write at least a sentence.',
    name: 'Enter your name.',
    topic: 'Choose a topic.',
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
    addressMin: 5,
    cityMin: 2,
    code: 20,
    email: EMAIL_MAX_LENGTH,
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
        maxLength: 80,
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
    acceptAttribute: '.wav,.mp3,audio/wav,audio/x-wav,audio/mpeg',
    extensions: ['wav', 'mp3'],
    maxDecodeBytes: MAX_DECODE_MEGABYTES * BYTES_PER_MEGABYTE,
    maxFileBytes: MAX_FILE_MEGABYTES * BYTES_PER_MEGABYTE,
} as const;

export {
    AI_QUESTION_MAX_LENGTH,
    ASSET_KINDS,
    ASSET_KIND_LABELS,
    AVATAR,
    BASIS_POINTS_DIVISOR,
    BYTES_PER_KILOBYTE,
    BYTES_PER_MEGABYTE,
    CANCELED_MESSAGE,
    CANONICAL,
    CARD_COLORS,
    CART_CHANGED_MESSAGE,
    CENTS_PER_DOLLAR,
    CHAT_MESSAGE_MAX_LENGTH,
    CHECKOUT_STEPS,
    CHECK_VIOLATION,
    COMMERCE,
    CONTACT_LIMITS,
    CONTACT_MESSAGES,
    CONTACT_TOPICS,
    DECODE_FAILED_MESSAGE,
    DEFAULT_ROLE,
    DEFAULT_STATE,
    DUPLICATE_FILE_MESSAGE,
    EMAIL_MAX_LENGTH,
    EMAIL_MESSAGE,
    EMAIL_PATTERN,
    EMAIL_REQUIRED_MESSAGE,
    FIELD_LIMITS,
    GENRES,
    GIFT_FAILED_MESSAGE,
    HERO_FIELD_SELECTOR,
    HOVER_QUERY,
    INVALID_BODY_MESSAGE,
    JOIN_ROUTE,
    KIND_COLORS,
    LAUNCHER_SIZE,
    LINKS,
    LINK_MAX_LENGTH,
    LOAD_FAILED_MESSAGE,
    LOCALE,
    MAX_PIXEL_RATIO,
    MEMBER_ROLES,
    MILLISECONDS_PER_HOUR,
    MILLISECONDS_PER_SECOND,
    MOBILE_WIDTH,
    MODULE_NAMES,
    MOTION_SELECTOR,
    NAV_GROUPS,
    NETWORK_MESSAGE,
    NOT_FOUND_MESSAGE,
    ONBOARDING_ROUTE,
    ONBOARDING_STEPS,
    PALETTE,
    PARAGRAPH_SEPARATOR,
    PARTNERS,
    PARTNER_INQUIRY_TOPIC,
    PARTNER_LOGO_WIDTH,
    PASSWORD_MAX_BYTES,
    PASSWORD_MIN_LENGTH,
    PAYMENTS_NOT_CONFIGURED_MESSAGE,
    PAYMENT_FAILED_MESSAGE,
    PERMISSION_DENIED,
    PLATFORMS,
    POINTER_COARSE_QUERY,
    PORTRAIT_REMOVED_MESSAGE,
    PORTRAIT_STAGED_MESSAGE,
    PRODS_NEGATIVE_MESSAGE,
    PRODUCT_CATEGORIES,
    PRODUCT_SIZES,
    PROFILE_FIELDS,
    PROFILE_ROLES,
    PROMO_CODE_MESSAGE,
    REDUCED_MOTION_QUERY,
    ROLES,
    ROUTES,
    SECONDS_PER_MINUTE,
    SECURITY_HEADERS,
    SETTINGS_ROUTE,
    SIGNED_URL_SECONDS,
    SIGN_IN_FIRST_MESSAGE,
    SITE_UPDATED,
    STATUS_SERVER_ERROR,
    STEPS_PER_BEAT,
    STORAGE,
    STORAGE_BUCKETS,
    TIME_ZONE,
    TITLE_SEPARATOR,
    TOUR_STOPS,
    TRACK_CONTENT_TYPES,
    TRACK_LOAD_MESSAGE,
    TRACK_PLAY_TOPIC,
    TRACK_STATE_TOPIC,
    TRIGGER_START,
    UNIQUE_VIOLATION,
    UNSUBSCRIBE_PARAMETER,
    UPLOAD,
    US_STATES,
    WINDOW_MARGINS,
    ZIP_PATTERN,
};
