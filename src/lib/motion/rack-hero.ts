import { BufferAttribute, BufferGeometry, CanvasTexture, Color, DynamicDrawUsage, Fog, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, Scene, WebGLRenderer } from 'three';

import { REDUCED_MOTION_QUERY, STORAGE } from '@lib/constants';
import { STEP_COUNT, stepDuration, stepEnergy } from '@lib/motion/pattern';
import { readColorToken } from '@lib/motion/tokens';

interface Palette {
    accent: string;
    ink: string;
    muted: string;
    surface: string;
}

interface SceneOptions {
    holder: HTMLElement;
    palette: Palette;
    signal: AbortSignal;
    still: boolean;
}

const ALPHA_ENERGY = 0.3;

const ALPHA_FLOOR = 0.44;

const ALPHA_PULSE = 0.5;

const AXIS_HEIGHT = 1;

const AXIS_SHIFT = 9;

const AXIS_SHIFT_MOBILE = 4;

const BAR_STEPS = 16;

const BASE_RELIEF = 0.22;

const BUDGET_BREACH_LIMIT = 12;

const BUDGET_MILLISECONDS = 6;

const BUDGET_WINDOW = 30;

const CAMERA_DEPTH = 30;

const CAMERA_DEPTH_MOBILE = 35;

const CAMERA_DRIFT_X = 1.8;

const CAMERA_DRIFT_Y = 1.1;

const CAMERA_EASE = 0.045;

const CAMERA_FAR = 140;

const CAMERA_FOV = 40;

const CAMERA_HEIGHT = 2.5;

const CAMERA_NEAR = 0.1;

const FOG_FAR = 110;

const FOG_NEAR = 46;

const GROUND_AMPLITUDE = 3.6;

const GROUND_COLUMNS = 26;

const GROUND_COLUMNS_MOBILE = 16;

const GROUND_DEPTH = 96;

const GROUND_DROP = -10;

const GROUND_FLOOR = 0.5;

const GROUND_LEAD = 8;

const GROUND_OPACITY = 0.3;

const GROUND_RIPPLE = 1.5;

const GROUND_ROWS = 30;

const GROUND_ROWS_MOBILE = 20;

const GROUND_SLOWDOWN = 16;

const GROUND_STRIDE = 3;

const GROUND_WIDTH = 46;

const HOLDER_SELECTOR = '.rack__scene';

const HOOP_OPACITY = 0.72;

const MAX_PIXEL_RATIO = 2;

const MILLISECONDS_PER_SECOND = 1_000;

const MOBILE_WIDTH = 768;

const MOTE_ALPHA_FLOOR = 0.18;

const MOTE_ALPHA_RANGE = 0.52;

const MOTE_COUNT = 240;

const MOTE_COUNT_MOBILE = 90;

const MOTE_DEPTH_STEP = 0.754_877_666_25;

const MOTE_DRIFT = 2.6;

const MOTE_LEAD = 6;

const MOTE_RADIUS_INNER = 5.4;

const MOTE_RADIUS_RANGE = 4.4;

const MOTE_RADIUS_STEP = 0.381_966_011_25;

const MOTE_SIZE = 0.16;

const MOTE_SPAN = 104;

const MOTE_SPREAD_STEP = 0.618_033_988_75;

const ORBIT_LIFT = 0.5;

const ORBIT_PERIOD = 168;

const ORBIT_PUSH = 1.2;

const ORBIT_SWAY = 1.4;

const PULSE_LEAD = 3;

const PULSE_LIFT = 0.55;

const PULSE_WIDTH = 2.6;

const QUALITY_FPS = [30, 20, 12];

const RADIUS_BASE = 5;

const RADIUS_RANGE = 2.46;

const READ_OPACITY_FLOOR = 0.7;

const READ_OPACITY_RANGE = 0.3;

const READ_PULSE_GAIN = 0.3;

const READ_RING = 6;

const RIB_DEPTH = 0.075;

const RIB_FLOOR = 0.36;

const RIB_LIFE_GAIN = 0.1;

const RIB_LIFE_RATIO = 7;

const RIB_PRIME_RATIO = 6;

const RIB_SHIMMER_GAIN = 0.34;

const RIB_SHIMMER_RATE = 0.03;

const RIB_SHIMMER_RATIO = 12;

const RING_COUNT = 26;

const RING_COUNT_MOBILE = 18;

const RING_NEAR = 8;

const RING_SPAN = 78;

const RING_TWIST = 0.0015;

const SCAN_HEIGHT = 22;

const SCAN_OPACITY = 0.16;

const SCAN_PERIOD = 9.5;

const SCAN_SWEEP = 6.6;

const SCAN_TEXTURE_CORE = 0.42;

const SCAN_TEXTURE_SIZE = 64;

const SCAN_WIDTH = 0.55;

const SCROLL_SLOWDOWN = 9;

const SEGMENT_COUNT = 84;

const SEGMENT_COUNT_MOBILE = 56;

const SLOW_CORE_COUNT = 4;

const SPIN_RATE = 0.01;

const SPOKE_OPACITY = 0.24;

const SPOKE_STRIDE = 7;

const STILL_ELAPSED = 4;

const SWELL_PERIOD = 23;

const SWELL_RANGE = 0.2;

const TARGET_BIAS = 0.67;

const TARGET_DEPTH = -20;

const TARGET_HEIGHT = 0.5;

const TAU = Math.PI * 2;

const WAVE_SCALE = RIB_DEPTH / (1 + RIB_LIFE_GAIN + RIB_SHIMMER_GAIN);

function buildGroundIndices(columns: number, rows: number) {
    const lines: number[] = [];

    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns - 1; column += 1) {
            lines.push(row * columns + column, row * columns + column + 1);
        }
    }

    for (let column = 0; column < columns; column += GROUND_STRIDE) {
        for (let row = 0; row < rows - 1; row += 1) {
            lines.push(row * columns + column, (row + 1) * columns + column);
        }
    }

    return lines;
}

function buildIndices(rings: number, segments: number) {
    const hoop: number[] = [];
    const read: number[] = [];
    const spoke: number[] = [];

    for (let ring = 0; ring < rings; ring += 1) {
        const target = ring === READ_RING ? read : hoop;

        for (let segment = 0; segment < segments; segment += 1) {
            target.push(ring * segments + segment, ring * segments + (segment + 1) % segments);
        }
    }

    for (let segment = 0; segment < segments; segment += SPOKE_STRIDE) {
        for (let ring = 0; ring < rings - 1; ring += 1) {
            spoke.push(ring * segments + segment, (ring + 1) * segments + segment);
        }
    }

    return { hoop, read, spoke };
}

function buildScanTexture() {
    const surface = document.createElement('canvas');

    surface.height = SCAN_TEXTURE_SIZE;
    surface.width = 1;

    const context = surface.getContext('2d');

    if (context) {
        const gradient = context.createLinearGradient(0, 0, 0, SCAN_TEXTURE_SIZE);

        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(SCAN_TEXTURE_CORE, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 1, SCAN_TEXTURE_SIZE);
    }

    return new CanvasTexture(surface);
}

export function initRackHero(signal: AbortSignal): void {
    const holder = document.querySelector<HTMLElement>(HOLDER_SELECTOR);
    const palette = readPalette();

    if (!holder || !validPalette(palette)) return;

    mountScene({ holder, palette, signal, still: window.matchMedia(REDUCED_MOTION_QUERY).matches });
}

function mountScene({ holder, palette, signal, still }: SceneOptions): void {
    const canvas = document.createElement('canvas');
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

    let renderer: WebGLRenderer;

    try {
        renderer = new WebGLRenderer({ alpha: true, antialias: ratio < MAX_PIXEL_RATIO, canvas, powerPreference: 'low-power' });
    } catch {
        return;
    }

    const mobile = window.innerWidth <= MOBILE_WIDTH;
    const columns = mobile ? GROUND_COLUMNS_MOBILE : GROUND_COLUMNS;
    const dolly = mobile ? CAMERA_DEPTH_MOBILE : CAMERA_DEPTH;
    const motes = mobile ? MOTE_COUNT_MOBILE : MOTE_COUNT;
    const rings = mobile ? RING_COUNT_MOBILE : RING_COUNT;
    const rows = mobile ? GROUND_ROWS_MOBILE : GROUND_ROWS;
    const segments = mobile ? SEGMENT_COUNT_MOBILE : SEGMENT_COUNT;
    const shift = mobile ? AXIS_SHIFT_MOBILE : AXIS_SHIFT;

    const { hoop, read, spoke } = buildIndices(rings, segments);
    const cosine = new Float32Array(segments);
    const grades = new Float32Array(columns);
    const groundLines = buildGroundIndices(columns, rows);
    const groundPlaces = new Float32Array(columns * rows * 3);
    const motePlaces = new Float32Array(motes * 3);
    const moteSeeds = new Float32Array(motes);
    const moteTints = new Float32Array(motes * 4);
    const positions = new Float32Array(rings * segments * 3);
    const sine = new Float32Array(segments);
    const tints = new Float32Array(rings * segments * 4);

    const accentColor = new Color(palette.accent);
    const camera = new PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
    const fog = new Fog(palette.surface, FOG_NEAR, FOG_FAR);
    const geometry = new BufferGeometry();
    const groundGeometry = new BufferGeometry();
    const groundMaterial = new LineBasicMaterial({ color: palette.ink, opacity: GROUND_OPACITY, transparent: true });
    const groundPlace = new BufferAttribute(groundPlaces, 3);
    const hoopMaterial = new LineBasicMaterial({ opacity: HOOP_OPACITY, transparent: true, vertexColors: true });
    const inkColor = new Color(palette.ink);
    const moteGeometry = new BufferGeometry();
    const moteMaterial = new PointsMaterial({ color: palette.muted, depthWrite: false, size: MOTE_SIZE, transparent: true, vertexColors: true });
    const motePlace = new BufferAttribute(motePlaces, 3);
    const moteTint = new BufferAttribute(moteTints, 4);
    const place = new BufferAttribute(positions, 3);
    const readDepth = RING_NEAR - (READ_RING / (rings - 1)) * RING_SPAN;
    const readMaterial = new LineBasicMaterial({ color: palette.accent, opacity: READ_OPACITY_FLOOR, transparent: true });
    const ringPitch = (rings - 1) / RING_SPAN;
    const scanGeometry = new PlaneGeometry(SCAN_WIDTH, SCAN_HEIGHT);
    const scanTexture = buildScanTexture();
    const scanMaterial = new MeshBasicMaterial({ color: palette.accent, depthWrite: false, map: scanTexture, opacity: SCAN_OPACITY, transparent: true });
    const scene = new Scene();
    const spokeMaterial = new LineBasicMaterial({ color: palette.muted, opacity: SPOKE_OPACITY, transparent: true });
    const tint = new BufferAttribute(tints, 4);

    const ground = new LineSegments(groundGeometry, groundMaterial);
    const mist = new Points(moteGeometry, moteMaterial);
    const scan = new Mesh(scanGeometry, scanMaterial);
    const tunnel = new LineSegments(geometry, [hoopMaterial, readMaterial, spokeMaterial]);

    let breaches = 0;
    let cost = 0;
    let driftX = 0;
    let driftY = 0;
    let frames = 0;
    let handle = 0;
    let last = 0;
    let pointerX = 0;
    let pointerY = 0;
    let quality = mobile || slowDevice() ? 1 : 0;
    let running = false;
    let showGround = true;
    let showMotes = true;
    let stamp = STILL_ELAPSED;

    function degrade() {
        if (showMotes) {
            showMotes = false;
            mist.visible = false;

            return;
        }

        if (showGround) {
            showGround = false;
            ground.visible = false;

            return;
        }

        if (quality >= QUALITY_FPS.length - 1) {
            stop();

            return;
        }

        quality += 1;
    }

    function dispose() {
        stop();
        geometry.dispose();
        groundGeometry.dispose();
        groundMaterial.dispose();
        hoopMaterial.dispose();
        moteGeometry.dispose();
        moteMaterial.dispose();
        readMaterial.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        scanGeometry.dispose();
        scanMaterial.dispose();
        scanTexture.dispose();
        spokeMaterial.dispose();
        canvas.remove();
    }

    function drift(elapsed: number) {
        const angle = TAU * (elapsed / ORBIT_PERIOD);
        const orbit = Math.sin(angle);

        driftX += (pointerX * CAMERA_DRIFT_X + orbit * ORBIT_SWAY - driftX) * CAMERA_EASE;
        driftY += (pointerY * CAMERA_DRIFT_Y + Math.cos(angle) * ORBIT_LIFT - driftY) * CAMERA_EASE;
        camera.position.set(driftX, CAMERA_HEIGHT - driftY, dolly + orbit * ORBIT_PUSH);
        camera.lookAt(shift * TARGET_BIAS, TARGET_HEIGHT, TARGET_DEPTH);
    }

    function frame(now: number) {
        handle = requestAnimationFrame(frame);

        const elapsed = now / MILLISECONDS_PER_SECOND;
        const interval = 1 / QUALITY_FPS[quality];

        if (elapsed - last < interval) return;

        last = elapsed;

        const started = performance.now();

        shape(elapsed);
        drift(elapsed);
        render();
        watch(performance.now() - started);
    }

    function render() {
        renderer.render(scene, camera);
    }

    function repaint() {
        const next = readPalette();

        if (!validPalette(next)) return;

        accentColor.set(next.accent);
        fog.color.set(next.surface);
        groundMaterial.color.set(next.ink);
        inkColor.set(next.ink);
        moteMaterial.color.set(next.muted);
        readMaterial.color.set(next.accent);
        scanMaterial.color.set(next.accent);
        spokeMaterial.color.set(next.muted);
        shape(stamp);
        render();
    }

    function resize() {
        const height = holder.clientHeight;
        const width = holder.clientWidth;

        if (!height || !width) return;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        render();
    }

    function shape(elapsed: number) {
        const accentBlue = accentColor.b;
        const accentGreen = accentColor.g;
        const accentRed = accentColor.r;
        const head = pulseHead(elapsed, rings);
        const inkBlue = inkColor.b;
        const inkGreen = inkColor.g;
        const inkRed = inkColor.r;
        const scroll = (elapsed / (stepDuration() * SCROLL_SLOWDOWN)) % STEP_COUNT;
        const shimmer = elapsed * RIB_SHIMMER_RATE;
        const swell = 1 - SWELL_RANGE + SWELL_RANGE * (0.5 + 0.5 * Math.sin(TAU * (elapsed / SWELL_PERIOD)));

        stamp = elapsed;

        for (let ring = 0; ring < rings; ring += 1) {
            const energy = smoothEnergy(ring + scroll);
            const flare = pulseFlare(ring, head);
            const alpha = Math.min(1, ALPHA_FLOOR + ALPHA_ENERGY * energy + ALPHA_PULSE * flare);
            const blue = inkBlue + (accentBlue - inkBlue) * flare;
            const green = inkGreen + (accentGreen - inkGreen) * flare;
            const red = inkRed + (accentRed - inkRed) * flare;
            const rib = WAVE_SCALE * (RIB_FLOOR + (1 - RIB_FLOOR) * energy);
            const span = RADIUS_BASE + RADIUS_RANGE * (BASE_RELIEF + energy) * swell * (1 + PULSE_LIFT * flare);
            const spin = ring * RING_TWIST + elapsed * SPIN_RATE;

            for (let segment = 0; segment < segments; segment += 1) {
                const sweep = segment / segments + spin;
                const wave = Math.sin(TAU * RIB_PRIME_RATIO * sweep)
                    + RIB_SHIMMER_GAIN * Math.sin(TAU * (RIB_SHIMMER_RATIO * sweep + shimmer))
                    + RIB_LIFE_GAIN * Math.sin(TAU * (RIB_LIFE_RATIO * sweep - shimmer));
                const radius = span * (1 + rib * wave);
                const vertex = ring * segments + segment;
                const offset = vertex * 3;
                const slot = vertex * 4;

                positions[offset] = shift + radius * cosine[segment];
                positions[offset + 1] = AXIS_HEIGHT + radius * sine[segment];
                tints[slot] = red;
                tints[slot + 1] = green;
                tints[slot + 2] = blue;
                tints[slot + 3] = alpha;
            }
        }

        place.needsUpdate = true;
        tint.needsUpdate = true;
        readMaterial.opacity = Math.min(1, READ_OPACITY_FLOOR + READ_OPACITY_RANGE * smoothEnergy(READ_RING + scroll) + READ_PULSE_GAIN * pulseFlare(READ_RING, head));
        scan.position.x = shift + SCAN_SWEEP * Math.sin(TAU * (elapsed / SCAN_PERIOD));

        if (showGround) shapeGround(elapsed);
        if (showMotes) shapeMotes(elapsed, scroll);
    }

    function shapeGround(elapsed: number) {
        const scroll = (elapsed / (stepDuration() * GROUND_SLOWDOWN)) % STEP_COUNT;

        for (let row = 0; row < rows; row += 1) {
            const relief = GROUND_AMPLITUDE * smoothEnergy(row + scroll);

            for (let column = 0; column < columns; column += 1) {
                groundPlaces[(row * columns + column) * 3 + 1] = GROUND_DROP + relief * grades[column];
            }
        }

        groundPlace.needsUpdate = true;
    }

    function shapeMotes(elapsed: number, scroll: number) {
        const travel = elapsed * MOTE_DRIFT;

        for (let mote = 0; mote < motes; mote += 1) {
            const depth = RING_NEAR + MOTE_LEAD - MOTE_SPAN + (moteSeeds[mote] + travel) % MOTE_SPAN;

            motePlaces[mote * 3 + 2] = depth;
            moteTints[mote * 4 + 3] = MOTE_ALPHA_FLOOR + MOTE_ALPHA_RANGE * smoothEnergy(scroll + STEP_COUNT + (RING_NEAR - depth) * ringPitch);
        }

        motePlace.needsUpdate = true;
        moteTint.needsUpdate = true;
    }

    function start() {
        if (running || still) return;

        running = true;
        last = performance.now() / MILLISECONDS_PER_SECOND;
        handle = requestAnimationFrame(frame);
    }

    function steer(event: PointerEvent) {
        pointerX = (event.clientX / window.innerWidth) * 2 - 1;
        pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    }

    function stop() {
        running = false;
        cancelAnimationFrame(handle);
    }

    function watch(duration: number) {
        cost += duration;
        frames += 1;

        if (frames < BUDGET_WINDOW) return;

        breaches = cost / frames > BUDGET_MILLISECONDS ? breaches + 1 : 0;
        cost = 0;
        frames = 0;

        if (breaches < BUDGET_BREACH_LIMIT) return;

        breaches = 0;
        degrade();
    }

    for (let segment = 0; segment < segments; segment += 1) {
        const turn = TAU * (segment / segments);

        cosine[segment] = Math.cos(turn);
        sine[segment] = Math.sin(turn);
    }

    for (let ring = 0; ring < rings; ring += 1) {
        for (let segment = 0; segment < segments; segment += 1) {
            positions[(ring * segments + segment) * 3 + 2] = RING_NEAR - (ring / (rings - 1)) * RING_SPAN;
        }
    }

    for (let column = 0; column < columns; column += 1) {
        const turn = column / (columns - 1);

        grades[column] = Math.sin(Math.PI * turn) * (GROUND_FLOOR + (1 - GROUND_FLOOR) * (0.5 + 0.5 * Math.sin(TAU * turn * GROUND_RIPPLE)));
    }

    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const offset = (row * columns + column) * 3;

            groundPlaces[offset] = shift + (column / (columns - 1) - 0.5) * GROUND_WIDTH;
            groundPlaces[offset + 1] = GROUND_DROP;
            groundPlaces[offset + 2] = RING_NEAR + GROUND_LEAD - (row / (rows - 1)) * GROUND_DEPTH;
        }
    }

    for (let mote = 0; mote < motes; mote += 1) {
        const angle = TAU * ((mote * MOTE_SPREAD_STEP) % 1);
        const radius = MOTE_RADIUS_INNER + MOTE_RADIUS_RANGE * ((mote * MOTE_RADIUS_STEP) % 1);
        const offset = mote * 3;
        const slot = mote * 4;

        motePlaces[offset] = shift + radius * Math.cos(angle);
        motePlaces[offset + 1] = AXIS_HEIGHT + radius * Math.sin(angle);
        moteSeeds[mote] = ((mote * MOTE_DEPTH_STEP) % 1) * MOTE_SPAN;
        moteTints[slot] = 1;
        moteTints[slot + 1] = 1;
        moteTints[slot + 2] = 1;
    }

    place.setUsage(DynamicDrawUsage);
    tint.setUsage(DynamicDrawUsage);
    geometry.setAttribute('color', tint);
    geometry.setAttribute('position', place);
    geometry.setIndex(new BufferAttribute(new Uint16Array([...hoop, ...read, ...spoke]), 1));
    geometry.addGroup(0, hoop.length, 0);
    geometry.addGroup(hoop.length, read.length, 1);
    geometry.addGroup(hoop.length + read.length, spoke.length, 2);
    groundPlace.setUsage(DynamicDrawUsage);
    groundGeometry.setAttribute('position', groundPlace);
    groundGeometry.setIndex(new BufferAttribute(new Uint16Array(groundLines), 1));
    motePlace.setUsage(DynamicDrawUsage);
    moteTint.setUsage(DynamicDrawUsage);
    moteGeometry.setAttribute('color', moteTint);
    moteGeometry.setAttribute('position', motePlace);
    camera.position.set(0, CAMERA_HEIGHT, dolly);
    camera.lookAt(shift * TARGET_BIAS, TARGET_HEIGHT, TARGET_DEPTH);
    renderer.setClearAlpha(0);
    renderer.setPixelRatio(ratio);
    scan.position.set(shift, AXIS_HEIGHT, readDepth);
    scene.fog = fog;
    ground.frustumCulled = false;
    mist.frustumCulled = false;
    scan.frustumCulled = false;
    tunnel.frustumCulled = false;
    scene.add(ground);
    scene.add(mist);
    scene.add(scan);
    scene.add(tunnel);
    canvas.className = 'rack__canvas';
    canvas.style.opacity = '0';
    holder.append(canvas);
    resize();
    shape(STILL_ELAPSED);
    drift(STILL_ELAPSED);
    render();
    requestAnimationFrame(() => (canvas.style.opacity = '1'));

    if (still) {
        window.addEventListener(STORAGE.theme.topic, repaint, { signal });
        window.addEventListener('resize', resize, { signal });
        signal.addEventListener('abort', dispose);

        return;
    }

    const observer = new IntersectionObserver(entries => (entries[0]?.isIntersecting ? start() : stop()));

    observer.observe(holder);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()), { signal });
    window.addEventListener(STORAGE.theme.topic, repaint, { signal });
    window.addEventListener('pointermove', steer, { signal });
    window.addEventListener('resize', resize, { signal });
    signal.addEventListener('abort', () => {
        observer.disconnect();
        dispose();
    });
}

function pulseFlare(ring: number, head: number): number {
    const gap = Math.abs(ring - head);

    if (gap >= PULSE_WIDTH) return 0;

    const fade = 1 - gap / PULSE_WIDTH;

    return fade * fade;
}

function pulseHead(elapsed: number, rings: number): number {
    const bar = stepDuration() * BAR_STEPS;
    const progress = (elapsed % bar) / bar;

    return rings + PULSE_LEAD - progress * (rings + PULSE_LEAD * 2);
}

function readPalette(): Palette {
    const styles = getComputedStyle(document.documentElement);

    return {
        accent: readColorToken(styles, '--hero-field-accent'),
        ink: readColorToken(styles, '--color-ink'),
        muted: readColorToken(styles, '--color-ink-muted'),
        surface: readColorToken(styles, '--color-surface'),
    };
}

function slowDevice(): boolean {
    const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } };

    return connection?.saveData === true || (navigator.hardwareConcurrency ?? 0) <= SLOW_CORE_COUNT;
}

function smoothEnergy(position: number): number {
    const index = Math.floor(position);
    const fraction = position - index;
    const blend = fraction * fraction * (3 - 2 * fraction);

    return stepEnergy(index) * (1 - blend) + stepEnergy(index + 1) * blend;
}

function validPalette(palette: Palette): boolean {
    return Boolean(palette.accent && palette.ink && palette.muted && palette.surface);
}
