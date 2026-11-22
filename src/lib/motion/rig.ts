import {
    BufferAttribute,
    BufferGeometry,
    Color,
    DynamicDrawUsage,
    LineBasicMaterial,
    LineSegments,
    PerspectiveCamera,
    Points,
    PointsMaterial,
    Scene,
    WebGLRenderer,
} from 'three';

import { MAX_PIXEL_RATIO, MILLISECONDS_PER_SECOND, MOBILE_WIDTH, REDUCED_MOTION_QUERY, STORAGE } from '@lib/shared/constants';
import { createFrameBudget, isSlowDevice } from '@lib/shared/utils';
import { getStepDuration, getStepEnergy, steps } from '@lib/motion/pattern';
import { readColorToken } from '@lib/motion/tokens';

interface Palette {
    accent: string;
    faint: string;
    line: string;
}

interface SceneOptions {
    canvas: HTMLCanvasElement;
    holder: HTMLElement;
    palette: Palette;
    signal: AbortSignal;
    still: boolean;
}

const AXIS_HEIGHT = 1;
const AXIS_SHIFT = 9;
const AXIS_SHIFT_MOBILE = 4;
const BAR_STEPS = 16;
const BASE_RELIEF = 0.22;
const CAMERA_DEPTH = 30;
const CAMERA_DEPTH_MOBILE = 35;
const CAMERA_DRIFT_X = 1.8;
const CAMERA_DRIFT_Y = 1.1;
const CAMERA_EASE = 0.045;
const CAMERA_FAR = 140;
const CAMERA_FOV = 40;
const CAMERA_HEIGHT = 2.5;
const CAMERA_NEAR = 0.1;
const CANVAS_SELECTOR = '.rack__canvas';
const FLARE_THRESHOLD = 0.25;
const GROUND_AMPLITUDE = 1.8;
const GROUND_BED = 0.5;
const GROUND_COLUMNS = 26;
const GROUND_COLUMNS_MOBILE = 16;
const GROUND_DEPTH = 96;
const GROUND_DROP = -10;
const GROUND_FLOOR = 0.74;
const GROUND_LEAD = 8;
const GROUND_MAJOR_ROW = 6;
const GROUND_MAJOR_STRIDE = 3;
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
const MOTES = 240;
const MOTES_MOBILE = 90;
const MOTE_DEPTH_STEP = 0.754_877_666_25;
const MOTE_DRIFT = 2.6;
const MOTE_LANES = 12;
const MOTE_LANE_SKEW = 0.013;
const MOTE_LEAD = 6;
const MOTE_RADIUS_INNER = 5.6;
const MOTE_RADIUS_RANGE = 2.8;
const MOTE_SHELLS = 3;
const MOTE_SIZE = 4;
const MOTE_SPAN = 104;
const ORBIT_LIFT = 0.5;
const ORBIT_PERIOD = 168;
const ORBIT_PUSH = 1.2;
const ORBIT_SWAY = 1.4;
const PULSE_LEAD = 3;
const PULSE_LIFT = 0.16;
const PULSE_WIDTH = 2.6;
const QUALITY_FPS = [30, 20, 12] as const;
const RADIUS_BASE = 6.2;
const RADIUS_RANGE = 0.62;
const READ_INNER = 0.93;
const READ_RING = 6;
const RIB_DEPTH = 0.005;
const RIB_FINE_RATIO = 12;
const RIB_FLOOR = 0.5;
const RIB_SHIMMER_RATE = 0.03;
const RINGS = 26;
const RINGS_MOBILE = 18;
const RING_NEAR = 8;
const RING_SPAN = 78;
const RING_TWIST = 0.0006;
const SCROLL_SLOWDOWN = 9;
const SEGMENTS = 84;
const SEGMENTS_MOBILE = 56;
const SPIN_RATE = 0.01;
const SPOKE_STRIDE = 7;
const STILL_ELAPSED = 42.9;
const STILL_SETTLE = 120;
const SWELL_PERIOD = 23;
const SWELL_RANGE = 0.2;
const TAPER_DROP = 0.48;
const TARGET_BIAS = 0.67;
const TARGET_DEPTH = -20;
const TARGET_HEIGHT = 0.5;
const TICK_STRIDE = 6;
const VECTOR_COMPONENTS = 3;
const Z_COMPONENT = 2;

const tau = Math.PI * 2;

function buildGroundIndices(columns: number, rows: number) {
    const major: number[] = [];
    const minor: number[] = [];

    for (let row = 0; row < rows; row++) {
        const target = row % GROUND_MAJOR_ROW === 0 ? major : minor;

        for (let column = 0; column < columns - 1; column++) {
            target.push(row * columns + column, row * columns + column + 1);
        }
    }

    for (let column = 0; column < columns; column += GROUND_STRIDE) {
        const target = column % (GROUND_STRIDE * GROUND_MAJOR_STRIDE) === 0 ? major : minor;

        for (let row = 0; row < rows - 1; row++) {
            target.push(row * columns + column, (row + 1) * columns + column);
        }
    }

    return { major, minor };
}

function buildIndices(rings: number, segments: number) {
    const hoop: number[] = [];
    const read: number[] = [];
    const spoke: number[] = [];

    for (let ring = 0; ring < rings; ring++) {
        const target = ring === READ_RING ? read : hoop;

        for (let segment = 0; segment < segments; segment++) {
            target.push(ring * segments + segment, ring * segments + (segment + 1) % segments);
        }
    }

    for (let segment = 0; segment < segments; segment++) {
        read.push(rings * segments + segment, rings * segments + (segment + 1) % segments);
    }

    for (let segment = 0; segment < segments; segment += TICK_STRIDE) {
        read.push(READ_RING * segments + segment, rings * segments + segment);
    }

    for (let segment = 0; segment < segments; segment += SPOKE_STRIDE) {
        for (let ring = 0; ring < rings - 1; ring++) {
            spoke.push(ring * segments + segment, (ring + 1) * segments + segment);
        }
    }

    return { hoop, read, spoke };
}

function getPulseFlare(ring: number, head: number) {
    const gap = Math.abs(ring - head);

    if (gap >= PULSE_WIDTH) return 0;

    const fade = 1 - gap / PULSE_WIDTH;

    return fade * fade;
}

function getTaperScale(ratio: number) {
    return 1 - TAPER_DROP * ratio * ratio;
}

function initRig(signal: AbortSignal): void {
    const holder = document.querySelector<HTMLElement>(HOLDER_SELECTOR);
    const palette = readPalette();

    const canvas = holder?.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR);

    if (!canvas || !holder || !isValidPalette(palette)) return;

    mountScene({ canvas, holder, palette, signal, still: window.matchMedia(REDUCED_MOTION_QUERY).matches });
}

function isValidPalette(palette: Palette) {
    return Boolean(palette.accent && palette.faint && palette.line);
}

function mountScene({ canvas, holder, palette, signal, still }: SceneOptions) {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

    let renderer: WebGLRenderer;

    try {
        renderer = new WebGLRenderer({ alpha: true, antialias: ratio < MAX_PIXEL_RATIO, canvas, powerPreference: 'low-power' });
    } catch {
        return;
    }

    const accentColor = new Color(palette.accent);
    const camera = new PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
    const geometry = new BufferGeometry();
    const groundGeometry = new BufferGeometry();
    const groundMajorMaterial = new LineBasicMaterial({ color: palette.line });
    const groundMaterial = new LineBasicMaterial({ color: palette.faint });
    const hoopMaterial = new LineBasicMaterial({ vertexColors: true });
    const isMobile = window.innerWidth <= MOBILE_WIDTH;
    const lineColor = new Color(palette.line);
    const moteGeometry = new BufferGeometry();
    const moteMaterial = new PointsMaterial({ color: palette.line, size: MOTE_SIZE, sizeAttenuation: false });
    const readMaterial = new LineBasicMaterial({ color: palette.accent });
    const scene = new Scene();
    const spokeMaterial = new LineBasicMaterial({ color: palette.faint });

    const columns = isMobile ? GROUND_COLUMNS_MOBILE : GROUND_COLUMNS;
    const dolly = isMobile ? CAMERA_DEPTH_MOBILE : CAMERA_DEPTH;
    const ground = new LineSegments(groundGeometry, [groundMaterial, groundMajorMaterial]);
    const mist = new Points(moteGeometry, moteMaterial);
    const motes = isMobile ? MOTES_MOBILE : MOTES;
    const rings = isMobile ? RINGS_MOBILE : RINGS;
    const rows = isMobile ? GROUND_ROWS_MOBILE : GROUND_ROWS;
    const segments = isMobile ? SEGMENTS_MOBILE : SEGMENTS;
    const shift = isMobile ? AXIS_SHIFT_MOBILE : AXIS_SHIFT;
    const tunnel = new LineSegments(geometry, [hoopMaterial, readMaterial, spokeMaterial]);

    const cosines = new Float32Array(segments);
    const grades = new Float32Array(columns);
    const groundPlaces = new Float32Array(columns * rows * VECTOR_COMPONENTS);
    const { hoop, read, spoke } = buildIndices(rings, segments);
    const { major, minor } = buildGroundIndices(columns, rows);
    const moteCosines = new Float32Array(motes);
    const motePlaces = new Float32Array(motes * VECTOR_COMPONENTS);
    const moteSeeds = new Float32Array(motes);
    const moteSines = new Float32Array(motes);
    const moteSpans = new Float32Array(motes);
    const positions = new Float32Array((rings + 1) * segments * VECTOR_COMPONENTS);
    const readDepth = RING_NEAR - (READ_RING / (rings - 1)) * RING_SPAN;
    const ringPitch = (rings - 1) / RING_SPAN;
    const sines = new Float32Array(segments);
    const tapers = new Float32Array(rings);
    const tints = new Float32Array((rings + 1) * segments * VECTOR_COMPONENTS);

    const groundPlace = new BufferAttribute(groundPlaces, VECTOR_COMPONENTS);
    const motePlace = new BufferAttribute(motePlaces, VECTOR_COMPONENTS);
    const place = new BufferAttribute(positions, VECTOR_COMPONENTS);
    const tint = new BufferAttribute(tints, VECTOR_COMPONENTS);

    let driftX = 0;
    let driftY = 0;
    let handle = 0;
    let isRunning = false;
    let last = 0;
    let pointerX = 0;
    let pointerY = 0;
    let quality = isMobile || isSlowDevice() ? 1 : 0;
    let shouldShowGround = true;
    let shouldShowMotes = true;
    let stamp = STILL_ELAPSED;

    function degrade() {
        if (shouldShowMotes) {
            shouldShowMotes = false;
            mist.visible = false;

            return;
        }

        if (shouldShowGround) {
            shouldShowGround = false;
            ground.visible = false;

            return;
        }

        if (quality >= QUALITY_FPS.length - 1) {
            stop();

            return;
        }

        quality++;
    }

    function dispose() {
        stop();
        canvas.hidden = true;
        geometry.dispose();
        groundGeometry.dispose();
        groundMajorMaterial.dispose();
        groundMaterial.dispose();
        hoopMaterial.dispose();
        moteGeometry.dispose();
        moteMaterial.dispose();
        readMaterial.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        spokeMaterial.dispose();
    }

    function drift(elapsed: number) {
        const angle = tau * (elapsed / ORBIT_PERIOD);

        const orbit = Math.sin(angle);

        driftX += (pointerX * CAMERA_DRIFT_X + orbit * ORBIT_SWAY - driftX) * CAMERA_EASE;
        driftY += (pointerY * CAMERA_DRIFT_Y + Math.cos(angle) * ORBIT_LIFT - driftY) * CAMERA_EASE;
        camera.position.set(driftX, CAMERA_HEIGHT - driftY, dolly + orbit * ORBIT_PUSH);
        camera.lookAt(shift * TARGET_BIAS, TARGET_HEIGHT, TARGET_DEPTH);
    }

    function render() {
        renderer.render(scene, camera);
    }

    function renderFrame(now: number) {
        handle = requestAnimationFrame(renderFrame);

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

    function repaint() {
        const next = readPalette();

        if (!isValidPalette(next)) return;

        accentColor.set(next.accent);
        groundMajorMaterial.color.set(next.line);
        groundMaterial.color.set(next.faint);
        lineColor.set(next.line);
        moteMaterial.color.set(next.line);
        readMaterial.color.set(next.accent);
        spokeMaterial.color.set(next.faint);
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
        const bar = getStepDuration() * BAR_STEPS;
        const scroll = (elapsed / (getStepDuration() * SCROLL_SLOWDOWN)) % steps;
        const shimmer = elapsed * RIB_SHIMMER_RATE;
        const swell = 1 - SWELL_RANGE + SWELL_RANGE * (0.5 + 0.5 * Math.sin(tau * (elapsed / SWELL_PERIOD)));

        const head = rings + PULSE_LEAD - ((elapsed % bar) / bar) * (rings + PULSE_LEAD * 2);

        stamp = elapsed;

        for (let ring = 0; ring < rings; ring++) {
            const energy = smoothEnergy(ring + scroll);
            const flare = getPulseFlare(ring, head);
            const spin = ring * RING_TWIST + elapsed * SPIN_RATE;

            const rib = RIB_DEPTH * (RIB_FLOOR + (1 - RIB_FLOOR) * energy);
            const span = tapers[ring] * (RADIUS_BASE + RADIUS_RANGE * (BASE_RELIEF + energy) * swell * (1 + PULSE_LIFT * flare));
            const tone = flare > FLARE_THRESHOLD ? accentColor : lineColor;

            for (let segment = 0; segment < segments; segment++) {
                const sweep = segment / segments + spin;
                const vertex = ring * segments + segment;

                const offset = vertex * VECTOR_COMPONENTS;
                const radius = span * (1 + rib * Math.sin(tau * (RIB_FINE_RATIO * sweep + shimmer)));

                positions[offset] = shift + radius * cosines[segment];
                positions[offset + 1] = AXIS_HEIGHT + radius * sines[segment];
                tone.toArray(tints, offset);
            }

            if (ring !== READ_RING) continue;

            const inner = span * READ_INNER;

            for (let segment = 0; segment < segments; segment++) {
                const offset = (rings * segments + segment) * VECTOR_COMPONENTS;

                positions[offset] = shift + inner * cosines[segment];
                positions[offset + 1] = AXIS_HEIGHT + inner * sines[segment];
            }
        }

        place.needsUpdate = true;
        tint.needsUpdate = true;

        if (shouldShowGround) shapeGround(elapsed);
        if (shouldShowMotes) shapeMotes(elapsed);
    }

    function shapeGround(elapsed: number) {
        const scroll = (elapsed / (getStepDuration() * GROUND_SLOWDOWN)) % steps;

        for (let row = 0; row < rows; row++) {
            const relief = GROUND_AMPLITUDE * (GROUND_BED + (1 - GROUND_BED) * smoothEnergy(row + scroll));

            for (let column = 0; column < columns; column++) {
                groundPlaces[(row * columns + column) * VECTOR_COMPONENTS + 1] = relief * grades[column];
            }
        }

        groundPlace.needsUpdate = true;
    }

    function shapeMotes(elapsed: number) {
        const travel = elapsed * MOTE_DRIFT;

        for (let mote = 0; mote < motes; mote++) {
            const advance = (moteSeeds[mote] + travel) % MOTE_SPAN;
            const offset = mote * VECTOR_COMPONENTS;

            const depth = RING_NEAR + MOTE_LEAD - MOTE_SPAN + advance;

            const lane = (RING_NEAR - depth) * ringPitch;

            const radius = moteSpans[mote] * getTaperScale(lane / (rings - 1));

            motePlaces[offset] = shift + radius * moteCosines[mote];
            motePlaces[offset + 1] = AXIS_HEIGHT + radius * moteSines[mote];
            motePlaces[offset + Z_COMPONENT] = depth;
        }

        motePlace.needsUpdate = true;
    }

    function start() {
        if (isRunning || still) return;

        handle = requestAnimationFrame(renderFrame);
        last = performance.now() / MILLISECONDS_PER_SECOND;
        isRunning = true;
    }

    function steer(event: PointerEvent) {
        pointerX = (event.clientX / window.innerWidth) * 2 - 1;
        pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    }

    function stop() {
        isRunning = false;
        cancelAnimationFrame(handle);
    }

    function teardown() {
        observer.disconnect();
        dispose();
    }

    const watch = createFrameBudget(degrade);

    for (let segment = 0; segment < segments; segment++) {
        const turn = tau * (segment / segments);

        cosines[segment] = Math.cos(turn);
        sines[segment] = Math.sin(turn);
        positions[(rings * segments + segment) * VECTOR_COMPONENTS + Z_COMPONENT] = readDepth;
    }

    for (let ring = 0; ring < rings; ring++) {
        const turn = ring / (rings - 1);

        tapers[ring] = getTaperScale(turn);

        for (let segment = 0; segment < segments; segment++) {
            positions[(ring * segments + segment) * VECTOR_COMPONENTS + Z_COMPONENT] = RING_NEAR - turn * RING_SPAN;
        }
    }

    for (let column = 0; column < columns; column++) {
        const turn = column / (columns - 1);

        grades[column] = Math.sin(Math.PI * turn) * (GROUND_FLOOR + (1 - GROUND_FLOOR) * (0.5 + 0.5 * Math.cos(tau * turn * GROUND_RIPPLE)));
    }

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const offset = (row * columns + column) * VECTOR_COMPONENTS;

            groundPlaces[offset] = (column / (columns - 1) - 0.5) * GROUND_WIDTH;
            groundPlaces[offset + Z_COMPONENT] = (0.5 - row / (rows - 1)) * GROUND_DEPTH;
        }
    }

    for (let mote = 0; mote < motes; mote++) {
        const shell = Math.floor(mote / MOTE_LANES) % MOTE_SHELLS;

        const angle = tau * ((mote % MOTE_LANES) / MOTE_LANES + shell * MOTE_LANE_SKEW);

        moteCosines[mote] = Math.cos(angle);
        moteSeeds[mote] = ((mote * MOTE_DEPTH_STEP) % 1) * MOTE_SPAN;
        moteSines[mote] = Math.sin(angle);
        moteSpans[mote] = MOTE_RADIUS_INNER + MOTE_RADIUS_RANGE * (shell / (MOTE_SHELLS - 1));
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
    groundGeometry.setIndex(new BufferAttribute(new Uint16Array([...minor, ...major]), 1));
    groundGeometry.addGroup(0, minor.length, 0);
    groundGeometry.addGroup(minor.length, major.length, 1);
    motePlace.setUsage(DynamicDrawUsage);
    moteGeometry.setAttribute('position', motePlace);
    camera.position.set(0, CAMERA_HEIGHT, dolly);
    camera.lookAt(shift * TARGET_BIAS, TARGET_HEIGHT, TARGET_DEPTH);
    renderer.setClearAlpha(0);
    renderer.setPixelRatio(ratio);
    ground.position.set(shift, GROUND_DROP, RING_NEAR + GROUND_LEAD - GROUND_DEPTH / 2);
    ground.rotation.set(GROUND_PITCH, GROUND_YAW, GROUND_ROLL);
    ground.frustumCulled = false;
    mist.frustumCulled = false;
    tunnel.frustumCulled = false;
    scene.add(ground);
    scene.add(mist);
    scene.add(tunnel);
    canvas.style.opacity = '0';
    canvas.hidden = false;
    resize();
    shape(STILL_ELAPSED);
    drift(STILL_ELAPSED);

    if (still) {
        for (let settle = 1; settle < STILL_SETTLE; settle++) {
            drift(STILL_ELAPSED);
        }
    }

    render();

    requestAnimationFrame(() => {
        canvas.style.opacity = '1';
    });

    if (still) {
        signal.addEventListener('abort', dispose);
        window.addEventListener(STORAGE.theme.topic, repaint, { signal });
        window.addEventListener('resize', resize, { signal });

        return;
    }

    const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) start();
        else stop();
    });

    observer.observe(holder);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop();
        else start();
    }, { signal });

    signal.addEventListener('abort', teardown);
    window.addEventListener(STORAGE.theme.topic, repaint, { signal });
    window.addEventListener('pointermove', steer, { signal });
    window.addEventListener('resize', resize, { signal });
}

function readPalette() {
    const styles = getComputedStyle(document.documentElement);

    return {
        accent: readColorToken(styles, '--color-text-brand'),
        faint: readColorToken(styles, '--color-border-subtle'),
        line: readColorToken(styles, '--color-border'),
    };
}

function smoothEnergy(position: number) {
    const index = Math.floor(position);

    const fraction = position - index;

    const blend = fraction * fraction * (3 - 2 * fraction);

    return getStepEnergy(index) * (1 - blend) + getStepEnergy(index + 1) * blend;
}

export { initRig };
