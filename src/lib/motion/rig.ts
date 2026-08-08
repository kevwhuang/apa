import { BufferAttribute, BufferGeometry, CanvasTexture, Color, DynamicDrawUsage, Fog, LineBasicMaterial, LineSegments, LinearFilter, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, Scene, WebGLRenderer } from 'three';

import { REDUCED_MOTION_QUERY, STORAGE } from '@lib/shared/constants';
import { STEP_COUNT, stepDuration, stepEnergy } from '@lib/motion/pattern';
import { isSlowDevice } from '@lib/shared/utils';
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

const ALPHA_ENERGY = 1;
const ALPHA_FLOOR = 0.24;
const ALPHA_PULSE = 0.56;
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
const DEPTH_FADE_CURVE = 1.45;
const DEPTH_FADE_FLOOR = 0.42;
const FOG_FAR = 106;
const FOG_NEAR = 44;
const GROUND_AMPLITUDE = 1.8;
const GROUND_AXIS_OPACITY = 0.26;
const GROUND_BED = 0.5;
const GROUND_COLUMNS = 26;
const GROUND_COLUMNS_MOBILE = 16;
const GROUND_DEPTH = 96;
const GROUND_DROP = -10;
const GROUND_FLOOR = 0.74;
const GROUND_LEAD = 8;
const GROUND_MAJOR_OPACITY = 0.5;
const GROUND_MAJOR_ROW = 6;
const GROUND_MAJOR_STRIDE = 3;
const GROUND_OPACITY = 0.17;
const GROUND_PITCH = 0.3;
const GROUND_RIPPLE = 2;
const GROUND_ROLL = 0.05;
const GROUND_ROWS = 30;
const GROUND_ROWS_MOBILE = 20;
const GROUND_SLOWDOWN = 16;
const GROUND_STRIDE = 3;
const GROUND_WIDTH = 46;
const GROUND_YAW = -0.18;
const HOLDER_SELECTOR = '.rack__scene';
const HOOP_OPACITY = 0.88;
const MAX_PIXEL_RATIO = 2;
const MILLISECONDS_PER_SECOND = 1_000;
const MOBILE_WIDTH = 768;
const MOTE_ALPHA_FLOOR = 0.14;
const MOTE_ALPHA_RANGE = 0.9;
const MOTE_COUNT = 240;
const MOTE_COUNT_MOBILE = 90;
const MOTE_DEPTH_STEP = 0.754_877_666_25;
const MOTE_DRIFT = 2.6;
const MOTE_LANES = 12;
const MOTE_LANE_SKEW = 0.013;
const MOTE_LEAD = 6;
const MOTE_NEAR_CURVE = 1.6;
const MOTE_NEAR_FADE = 18;
const MOTE_RADIUS_INNER = 5.6;
const MOTE_RADIUS_RANGE = 2.8;
const MOTE_SHELLS = 3;
const MOTE_SIZE = 0.44;
const MOTE_SPAN = 104;
const MOTE_TEXTURE_CORE = 0.55;
const MOTE_TEXTURE_FALLOFF = 0.72;
const MOTE_TEXTURE_SIZE = 64;
const ORBIT_LIFT = 0.5;
const ORBIT_PERIOD = 168;
const ORBIT_PUSH = 1.2;
const ORBIT_SWAY = 1.4;
const PULSE_LEAD = 3;
const PULSE_LIFT = 0.16;
const PULSE_WIDTH = 2.6;
const QUALITY_FPS = [30, 20, 12];
const RADIUS_BASE = 6.2;
const RADIUS_RANGE = 0.62;
const READ_INNER = 0.93;
const READ_OPACITY_FLOOR = 0.6;
const READ_OPACITY_RANGE = 0.5;
const READ_PULSE_GAIN = 0.3;
const READ_RING = 6;
const RIB_DEPTH = 0.005;
const RIB_FINE_RATIO = 12;
const RIB_FLOOR = 0.5;
const RIB_SHIMMER_RATE = 0.03;
const RING_COUNT = 26;
const RING_COUNT_MOBILE = 18;
const RING_NEAR = 8;
const RING_SPAN = 78;
const RING_TWIST = 0.0006;
const SCAN_HEIGHT = 15;
const SCAN_OPACITY = 0.22;
const SCAN_PERIOD = 9.5;
const SCAN_SWEEP = 6.6;
const SCAN_TEXTURE_CORE = 0.46;
const SCAN_TEXTURE_SIZE = 64;
const SCAN_WIDTH = 0.32;
const SCROLL_SLOWDOWN = 9;
const SEGMENT_COUNT = 84;
const SEGMENT_COUNT_MOBILE = 56;
const SPIN_RATE = 0.01;
const SPOKE_OPACITY = 0.16;
const SPOKE_STRIDE = 7;
const STILL_ELAPSED = 42.9;
const STILL_SETTLE = 120;
const SWELL_PERIOD = 23;
const SWELL_RANGE = 0.2;
const TAPER_DROP = 0.48;
const TARGET_BIAS = 0.67;
const TARGET_DEPTH = -20;
const TARGET_HEIGHT = 0.5;
const TAU = Math.PI * 2;
const TICK_STRIDE = 6;

function buildGroundIndices(columns: number, rows: number) {
    const axis: number[] = [];
    const major: number[] = [];
    const minor: number[] = [];
    const middle = Math.round((columns - 1) / 2 / GROUND_STRIDE) * GROUND_STRIDE;

    for (let row = 0; row < rows; row += 1) {
        const target = row % GROUND_MAJOR_ROW === 0 ? major : minor;

        for (let column = 0; column < columns - 1; column += 1) {
            target.push(row * columns + column, row * columns + column + 1);
        }
    }

    for (let column = 0; column < columns; column += GROUND_STRIDE) {
        const target = column === middle ? axis : column % (GROUND_STRIDE * GROUND_MAJOR_STRIDE) === 0 ? major : minor;

        for (let row = 0; row < rows - 1; row += 1) {
            target.push(row * columns + column, (row + 1) * columns + column);
        }
    }

    return { axis, major, minor };
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

    for (let segment = 0; segment < segments; segment += 1) {
        read.push(rings * segments + segment, rings * segments + (segment + 1) % segments);
    }

    for (let segment = 0; segment < segments; segment += TICK_STRIDE) {
        read.push(READ_RING * segments + segment, rings * segments + segment);
    }

    for (let segment = 0; segment < segments; segment += SPOKE_STRIDE) {
        for (let ring = 0; ring < rings - 1; ring += 1) {
            spoke.push(ring * segments + segment, (ring + 1) * segments + segment);
        }
    }

    return { hoop, read, spoke };
}

function buildMoteTexture() {
    const surface = document.createElement('canvas');

    surface.height = MOTE_TEXTURE_SIZE;
    surface.width = MOTE_TEXTURE_SIZE;

    const context = surface.getContext('2d');
    const middle = MOTE_TEXTURE_SIZE / 2;

    if (context) {
        const gradient = context.createRadialGradient(middle, middle, 0, middle, middle, middle);

        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(MOTE_TEXTURE_CORE, `rgba(255, 255, 255, ${MOTE_TEXTURE_FALLOFF})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, MOTE_TEXTURE_SIZE, MOTE_TEXTURE_SIZE);
    }

    const texture = new CanvasTexture(surface);

    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;

    return texture;
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

function initRig(signal: AbortSignal): void {
    const holder = document.querySelector<HTMLElement>(HOLDER_SELECTOR);
    const palette = readPalette();

    if (!holder || !isValidPalette(palette)) return;

    mountScene({ holder, palette, signal, still: window.matchMedia(REDUCED_MOTION_QUERY).matches });
}

function isValidPalette(palette: Palette): boolean {
    return Boolean(palette.accent && palette.ink && palette.muted && palette.surface);
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

    const { axis, major, minor } = buildGroundIndices(columns, rows);
    const { hoop, read, spoke } = buildIndices(rings, segments);
    const cosine = new Float32Array(segments);
    const fades = new Float32Array(rings);
    const grades = new Float32Array(columns);
    const groundPlaces = new Float32Array(columns * rows * 3);
    const moteCosine = new Float32Array(motes);
    const motePlaces = new Float32Array(motes * 3);
    const moteSeeds = new Float32Array(motes);
    const moteSine = new Float32Array(motes);
    const moteSpans = new Float32Array(motes);
    const moteTints = new Float32Array(motes * 4);
    const positions = new Float32Array((rings + 1) * segments * 3);
    const sine = new Float32Array(segments);
    const tapers = new Float32Array(rings);
    const tints = new Float32Array((rings + 1) * segments * 4);

    const moteTexture = buildMoteTexture();
    const scanTexture = buildScanTexture();

    const accentColor = new Color(palette.accent);
    const camera = new PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
    const fog = new Fog(palette.surface, FOG_NEAR, FOG_FAR);
    const geometry = new BufferGeometry();
    const groundAxisMaterial = new LineBasicMaterial({ color: palette.accent, opacity: GROUND_AXIS_OPACITY, transparent: true });
    const groundGeometry = new BufferGeometry();
    const groundMajorMaterial = new LineBasicMaterial({ color: palette.ink, opacity: GROUND_MAJOR_OPACITY, transparent: true });
    const groundMaterial = new LineBasicMaterial({ color: palette.ink, opacity: GROUND_OPACITY, transparent: true });
    const groundPlace = new BufferAttribute(groundPlaces, 3);
    const hoopMaterial = new LineBasicMaterial({ opacity: HOOP_OPACITY, transparent: true, vertexColors: true });
    const inkColor = new Color(palette.ink);
    const moteGeometry = new BufferGeometry();
    const moteMaterial = new PointsMaterial({ color: palette.muted, depthWrite: false, map: moteTexture, size: MOTE_SIZE, transparent: true, vertexColors: true });
    const motePlace = new BufferAttribute(motePlaces, 3);
    const moteTint = new BufferAttribute(moteTints, 4);
    const place = new BufferAttribute(positions, 3);
    const readDepth = RING_NEAR - (READ_RING / (rings - 1)) * RING_SPAN;
    const readMaterial = new LineBasicMaterial({ color: palette.accent, opacity: READ_OPACITY_FLOOR, transparent: true });
    const ringPitch = (rings - 1) / RING_SPAN;
    const scanGeometry = new PlaneGeometry(SCAN_WIDTH, SCAN_HEIGHT);
    const scanMaterial = new MeshBasicMaterial({ color: palette.accent, depthWrite: false, map: scanTexture, opacity: SCAN_OPACITY, transparent: true });
    const scene = new Scene();
    const spokeMaterial = new LineBasicMaterial({ color: palette.muted, opacity: SPOKE_OPACITY, transparent: true });
    const tint = new BufferAttribute(tints, 4);

    const ground = new LineSegments(groundGeometry, [groundMaterial, groundMajorMaterial, groundAxisMaterial]);
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
    let quality = mobile || isSlowDevice() ? 1 : 0;
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
        canvas.remove();
        geometry.dispose();
        groundAxisMaterial.dispose();
        groundGeometry.dispose();
        groundMajorMaterial.dispose();
        groundMaterial.dispose();
        hoopMaterial.dispose();
        moteGeometry.dispose();
        moteMaterial.dispose();
        moteTexture.dispose();
        readMaterial.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        scanGeometry.dispose();
        scanMaterial.dispose();
        scanTexture.dispose();
        spokeMaterial.dispose();
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

        drift(elapsed);
        shape(elapsed);
        render();
        watch(performance.now() - started);
    }

    function render() {
        renderer.render(scene, camera);
    }

    function repaint() {
        const next = readPalette();

        if (!isValidPalette(next)) return;

        accentColor.set(next.accent);
        fog.color.set(next.surface);
        groundAxisMaterial.color.set(next.accent);
        groundMajorMaterial.color.set(next.ink);
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
            const spin = ring * RING_TWIST + elapsed * SPIN_RATE;

            const alpha = fades[ring] * Math.min(1, ALPHA_FLOOR + ALPHA_ENERGY * energy + ALPHA_PULSE * flare);
            const blue = inkBlue + (accentBlue - inkBlue) * flare;
            const green = inkGreen + (accentGreen - inkGreen) * flare;
            const red = inkRed + (accentRed - inkRed) * flare;
            const rib = RIB_DEPTH * (RIB_FLOOR + (1 - RIB_FLOOR) * energy);
            const span = tapers[ring] * (RADIUS_BASE + RADIUS_RANGE * (BASE_RELIEF + energy) * swell * (1 + PULSE_LIFT * flare));

            for (let segment = 0; segment < segments; segment += 1) {
                const sweep = segment / segments + spin;
                const vertex = ring * segments + segment;

                const offset = vertex * 3;
                const radius = span * (1 + rib * Math.sin(TAU * (RIB_FINE_RATIO * sweep + shimmer)));
                const slot = vertex * 4;

                positions[offset] = shift + radius * cosine[segment];
                positions[offset + 1] = AXIS_HEIGHT + radius * sine[segment];
                tints[slot] = red;
                tints[slot + 1] = green;
                tints[slot + 2] = blue;
                tints[slot + 3] = alpha;
            }

            if (ring !== READ_RING) continue;

            const inner = span * READ_INNER;

            for (let segment = 0; segment < segments; segment += 1) {
                const offset = (rings * segments + segment) * 3;

                positions[offset] = shift + inner * cosine[segment];
                positions[offset + 1] = AXIS_HEIGHT + inner * sine[segment];
            }
        }

        place.needsUpdate = true;
        readMaterial.opacity = Math.min(1, READ_OPACITY_FLOOR + READ_OPACITY_RANGE * smoothEnergy(READ_RING + scroll) + READ_PULSE_GAIN * pulseFlare(READ_RING, head));
        scan.position.x = shift + SCAN_SWEEP * Math.sin(TAU * (elapsed / SCAN_PERIOD));
        tint.needsUpdate = true;

        if (showGround) shapeGround(elapsed);
        if (showMotes) shapeMotes(elapsed, scroll);
    }

    function shapeGround(elapsed: number) {
        const scroll = (elapsed / (stepDuration() * GROUND_SLOWDOWN)) % STEP_COUNT;

        for (let row = 0; row < rows; row += 1) {
            const relief = GROUND_AMPLITUDE * (GROUND_BED + (1 - GROUND_BED) * smoothEnergy(row + scroll));

            for (let column = 0; column < columns; column += 1) {
                groundPlaces[(row * columns + column) * 3 + 1] = relief * grades[column];
            }
        }

        groundPlace.needsUpdate = true;
    }

    function shapeMotes(elapsed: number, scroll: number) {
        const travel = elapsed * MOTE_DRIFT;

        for (let mote = 0; mote < motes; mote += 1) {
            const advance = (moteSeeds[mote] + travel) % MOTE_SPAN;
            const offset = mote * 3;

            const approach = Math.min(1, (MOTE_SPAN - advance) / MOTE_NEAR_FADE) ** MOTE_NEAR_CURVE;
            const depth = RING_NEAR + MOTE_LEAD - MOTE_SPAN + advance;

            const lane = (RING_NEAR - depth) * ringPitch;

            const radius = moteSpans[mote] * taperScale(lane / (rings - 1));

            motePlaces[offset] = shift + radius * moteCosine[mote];
            motePlaces[offset + 1] = AXIS_HEIGHT + radius * moteSine[mote];
            motePlaces[offset + 2] = depth;
            moteTints[mote * 4 + 3] = approach * (MOTE_ALPHA_FLOOR + MOTE_ALPHA_RANGE * smoothEnergy(scroll + STEP_COUNT + lane));
        }

        motePlace.needsUpdate = true;
        moteTint.needsUpdate = true;
    }

    function start() {
        if (running || still) return;

        handle = requestAnimationFrame(frame);
        last = performance.now() / MILLISECONDS_PER_SECOND;
        running = true;
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
        positions[(rings * segments + segment) * 3 + 2] = readDepth;
    }

    for (let ring = 0; ring < rings; ring += 1) {
        const turn = ring / (rings - 1);

        fades[ring] = DEPTH_FADE_FLOOR + (1 - DEPTH_FADE_FLOOR) * (1 - turn) ** DEPTH_FADE_CURVE;
        tapers[ring] = taperScale(turn);

        for (let segment = 0; segment < segments; segment += 1) {
            positions[(ring * segments + segment) * 3 + 2] = RING_NEAR - turn * RING_SPAN;
        }
    }

    for (let column = 0; column < columns; column += 1) {
        const turn = column / (columns - 1);

        grades[column] = Math.sin(Math.PI * turn) * (GROUND_FLOOR + (1 - GROUND_FLOOR) * (0.5 + 0.5 * Math.cos(TAU * turn * GROUND_RIPPLE)));
    }

    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            const offset = (row * columns + column) * 3;

            groundPlaces[offset] = (column / (columns - 1) - 0.5) * GROUND_WIDTH;
            groundPlaces[offset + 2] = (0.5 - row / (rows - 1)) * GROUND_DEPTH;
        }
    }

    for (let mote = 0; mote < motes; mote += 1) {
        const shell = Math.floor(mote / MOTE_LANES) % MOTE_SHELLS;
        const slot = mote * 4;

        const angle = TAU * ((mote % MOTE_LANES) / MOTE_LANES + shell * MOTE_LANE_SKEW);

        moteCosine[mote] = Math.cos(angle);
        moteSeeds[mote] = ((mote * MOTE_DEPTH_STEP) % 1) * MOTE_SPAN;
        moteSine[mote] = Math.sin(angle);
        moteSpans[mote] = MOTE_RADIUS_INNER + MOTE_RADIUS_RANGE * (shell / (MOTE_SHELLS - 1));
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
    groundGeometry.setIndex(new BufferAttribute(new Uint16Array([...minor, ...major, ...axis]), 1));
    groundGeometry.addGroup(0, minor.length, 0);
    groundGeometry.addGroup(minor.length, major.length, 1);
    groundGeometry.addGroup(minor.length + major.length, axis.length, 2);
    motePlace.setUsage(DynamicDrawUsage);
    moteTint.setUsage(DynamicDrawUsage);
    moteGeometry.setAttribute('color', moteTint);
    moteGeometry.setAttribute('position', motePlace);
    camera.position.set(0, CAMERA_HEIGHT, dolly);
    camera.lookAt(shift * TARGET_BIAS, TARGET_HEIGHT, TARGET_DEPTH);
    renderer.setClearAlpha(0);
    renderer.setPixelRatio(ratio);
    ground.position.set(shift, GROUND_DROP, RING_NEAR + GROUND_LEAD - GROUND_DEPTH / 2);
    ground.rotation.set(GROUND_PITCH, GROUND_YAW, GROUND_ROLL);
    scan.position.set(shift, AXIS_HEIGHT, readDepth);
    ground.frustumCulled = false;
    mist.frustumCulled = false;
    scan.frustumCulled = false;
    tunnel.frustumCulled = false;
    scene.fog = fog;
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

    if (still) for (let settle = 1; settle < STILL_SETTLE; settle += 1) drift(STILL_ELAPSED);

    render();
    requestAnimationFrame(() => (canvas.style.opacity = '1'));

    if (still) {
        signal.addEventListener('abort', dispose);
        window.addEventListener(STORAGE.theme.topic, repaint, { signal });
        window.addEventListener('resize', resize, { signal });

        return;
    }

    const observer = new IntersectionObserver(entries => (entries[0]?.isIntersecting ? start() : stop()));

    observer.observe(holder);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()), { signal });
    signal.addEventListener('abort', () => {
        observer.disconnect();
        dispose();
    });
    window.addEventListener(STORAGE.theme.topic, repaint, { signal });
    window.addEventListener('pointermove', steer, { signal });
    window.addEventListener('resize', resize, { signal });
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

function smoothEnergy(position: number): number {
    const index = Math.floor(position);

    const fraction = position - index;

    const blend = fraction * fraction * (3 - 2 * fraction);

    return stepEnergy(index) * (1 - blend) + stepEnergy(index + 1) * blend;
}

function taperScale(ratio: number): number {
    return 1 - TAPER_DROP * ratio * ratio;
}

export { initRig };
