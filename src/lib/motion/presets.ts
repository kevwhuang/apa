import { getMotionTokens } from '@lib/motion/tokens';

const CLIP_OPEN = 'inset(0% 0% 0% 0%)';
const FLIP_PERSPECTIVE = 900;
const FLIP_ROTATION = -55;
const FOLDED_PROPERTIES = ['rotate', 'scale', 'transform', 'translate'];
const GUARDED_PRESET: MotionPresetName = 'rise';
const ORIGIN_TOP = '50% 0%';
const REST_PROPERTIES = 'clipPath,rotate,scale,transform,transformOrigin,translate,willChange';
const RULE_CLIP = 'inset(0% 100% 0% 0%)';
const STRIKE_CLIP = 'inset(-30% -30% 138% -30%)';
const STRIKE_OFFSET = '0.18em';
const STRIKE_OPEN = 'inset(-30% -30% -30% -30%)';
const STRIKE_SKEW = 2;
const TILT_ROTATION = -8;
const UNFOLD_CLIP = 'inset(14% 0% 14% 0%)';
const UNFOLD_OPEN = 'inset(-15% -15% -15% -15%)';
const UNFOLD_PERSPECTIVE = 700;
const UNFOLD_ROTATION = -8;
const VISIBLE_PRESETS: MotionPresetName[] = ['rule', 'strike', 'wipe'];
const WIPE_CLIP = 'inset(-50% 105% -5% -5%)';
const WIPE_OFFSET = -28;
const WIPE_OPEN = 'inset(-50% -5% -5% -5%)';

const ENTRANCE_PRESETS: Record<MotionPresetName, MotionPreset> = {
    blur: {
        duration: 'cinematic',
        ease: 'entrance',
        from: () => ({ opacity: 0 }),
        stagger: 'base',
        to: () => ({ opacity: 1 }),
    },
    flip: {
        duration: 'slower',
        ease: 'entrance',
        from: tokens => ({
            opacity: 0,
            rotateX: FLIP_ROTATION,
            transformOrigin: ORIGIN_TOP,
            transformPerspective: FLIP_PERSPECTIVE,
            y: tokens.travel,
        }),
        stagger: 'base',
        to: () => ({ opacity: 1, rotateX: 0, y: 0 }),
    },
    rise: {
        duration: 'slower',
        ease: 'entrance',
        from: tokens => ({ opacity: 0, y: tokens.travel }),
        stagger: 'base',
        to: () => ({ opacity: 1, y: 0 }),
    },
    rule: {
        duration: 'slow',
        ease: 'mechanical',
        from: () => ({ clipPath: RULE_CLIP, opacity: 1 }),
        stagger: 'tight',
        to: () => ({ clipPath: CLIP_OPEN }),
    },
    stamp: {
        duration: 'base',
        ease: 'snap',
        from: () => ({ opacity: 0 }),
        stagger: 'tight',
        to: () => ({ opacity: 1 }),
    },
    strike: {
        duration: 'slowest',
        ease: 'entrance',
        from: () => ({ clipPath: STRIKE_CLIP, opacity: 1, skewY: STRIKE_SKEW, y: STRIKE_OFFSET }),
        stagger: 'base',
        to: () => ({ clipPath: STRIKE_OPEN, skewY: 0, y: 0 }),
    },
    tilt: {
        duration: 'cinematic',
        ease: 'snap',
        from: tokens => ({ opacity: 0, rotate: TILT_ROTATION, transformOrigin: ORIGIN_TOP, y: tokens.travel }),
        stagger: 'tight',
        to: () => ({ opacity: 1, rotate: 0, y: 0 }),
    },
    unfold: {
        duration: 'slower',
        ease: 'entrance',
        from: () => ({ clipPath: UNFOLD_CLIP, opacity: 0, rotateX: UNFOLD_ROTATION, transformPerspective: UNFOLD_PERSPECTIVE }),
        stagger: 'base',
        to: () => ({ clipPath: UNFOLD_OPEN, opacity: 1, rotateX: 0 }),
    },
    wipe: {
        duration: 'slowest',
        ease: 'mechanical',
        from: () => ({ clipPath: WIPE_CLIP, opacity: 1, x: WIPE_OFFSET }),
        stagger: 'base',
        to: () => ({ clipPath: WIPE_OPEN, x: 0 }),
    },
};

const PRESET_NAMES = Object.keys(ENTRANCE_PRESETS) as MotionPresetName[];

function buildStagger(count: number, token: MotionStaggerToken, from: MotionStaggerOrigin = 'start'): gsap.StaggerVars {
    const tokens = getMotionTokens();

    return { each: Math.min(tokens.stagger[token], tokens.staggerMaxTotal / Math.max(count - 1, 1)), from };
}

function resolvePreset(name: string | undefined): MotionPresetName | undefined {
    return PRESET_NAMES.find(preset => preset === name);
}

export {
    ENTRANCE_PRESETS,
    FOLDED_PROPERTIES,
    GUARDED_PRESET,
    PRESET_NAMES,
    REST_PROPERTIES,
    VISIBLE_PRESETS,
    buildStagger,
    resolvePreset,
};
