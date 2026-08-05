import { getMotionTokens } from '@lib/motion/tokens';

const BLUR_CLEAR = 'blur(0px)';
const BLUR_SCALE = 1.02;
const BLUR_START = 'blur(14px)';
const CLIP_OPEN = 'inset(0% 0% 0% 0%)';
const FLIP_PERSPECTIVE = 900;
const FLIP_ROTATION = -55;
const ORIGIN_LEADING = '0% 50%';
const ORIGIN_TOP = '50% 0%';
const RISE_BLUR = 'blur(6px)';
const RISE_SCALE = 0.985;
const STAMP_BLUR = 'blur(4px)';
const STAMP_SCALE = 1.18;
const STRIKE_CLIP = 'inset(0% 0% 108% 0%)';
const STRIKE_OFFSET = '0.18em';
const STRIKE_SKEW = 2;
const TILT_ROTATION = -4;
const TILT_SCALE = 0.94;
const UNFOLD_CLIP = 'inset(14% 0% 14% 0%)';
const UNFOLD_PERSPECTIVE = 700;
const UNFOLD_ROTATION = -8;
const UNFOLD_SCALE = 0.92;
const WIPE_CLIP = 'inset(0% 100% 0% 0%)';
const WIPE_OFFSET = -28;

const ENTRANCE_PRESETS: Record<MotionPresetName, MotionPreset> = {
    blur: {
        duration: 'cinematic',
        ease: 'entrance',
        from: () => ({ filter: BLUR_START, opacity: 0, scale: BLUR_SCALE }),
        stagger: 'base',
        to: () => ({ filter: BLUR_CLEAR, opacity: 1, scale: 1 }),
    },
    flip: {
        duration: 'slower',
        ease: 'entrance',
        from: tokens => ({ opacity: 0, rotateX: FLIP_ROTATION, transformOrigin: ORIGIN_TOP, transformPerspective: FLIP_PERSPECTIVE, y: tokens.travel }),
        stagger: 'base',
        to: () => ({ opacity: 1, rotateX: 0, y: 0 }),
    },
    rise: {
        duration: 'slower',
        ease: 'entrance',
        from: tokens => ({ filter: RISE_BLUR, opacity: 0, scale: RISE_SCALE, y: tokens.travel }),
        stagger: 'base',
        to: () => ({ filter: BLUR_CLEAR, opacity: 1, scale: 1, y: 0 }),
    },
    rule: {
        duration: 'slow',
        ease: 'mechanical',
        from: () => ({ opacity: 1, scaleX: 0, transformOrigin: ORIGIN_LEADING }),
        stagger: 'tight',
        to: () => ({ scaleX: 1 }),
    },
    stamp: {
        duration: 'base',
        ease: 'snap',
        from: () => ({ filter: STAMP_BLUR, opacity: 0, scale: STAMP_SCALE, transformOrigin: ORIGIN_LEADING }),
        stagger: 'tight',
        to: () => ({ filter: BLUR_CLEAR, opacity: 1, scale: 1 }),
    },
    strike: {
        duration: 'slowest',
        ease: 'entrance',
        from: () => ({ clipPath: STRIKE_CLIP, opacity: 1, skewY: STRIKE_SKEW, y: STRIKE_OFFSET }),
        stagger: 'base',
        to: () => ({ clipPath: CLIP_OPEN, skewY: 0, y: 0 }),
    },
    tilt: {
        duration: 'slow',
        ease: 'snap',
        from: tokens => ({ opacity: 0, rotate: TILT_ROTATION, scale: TILT_SCALE, y: tokens.travel }),
        stagger: 'tight',
        to: () => ({ opacity: 1, rotate: 0, scale: 1, y: 0 }),
    },
    unfold: {
        duration: 'slower',
        ease: 'entrance',
        from: () => ({ clipPath: UNFOLD_CLIP, opacity: 0, rotateX: UNFOLD_ROTATION, scaleY: UNFOLD_SCALE, transformPerspective: UNFOLD_PERSPECTIVE }),
        stagger: 'base',
        to: () => ({ clipPath: CLIP_OPEN, opacity: 1, rotateX: 0, scaleY: 1 }),
    },
    wipe: {
        duration: 'slowest',
        ease: 'mechanical',
        from: () => ({ clipPath: WIPE_CLIP, opacity: 1, x: WIPE_OFFSET }),
        stagger: 'base',
        to: () => ({ clipPath: CLIP_OPEN, x: 0 }),
    },
};

const FOLDED_PROPERTIES = ['filter', 'rotate', 'scale', 'transform', 'translate'];
const GUARDED_PRESET: MotionPresetName = 'rise';

const PRESET_NAMES = Object.keys(ENTRANCE_PRESETS) as MotionPresetName[];

const REST_PROPERTIES = 'clipPath,filter,rotate,scale,transform,transformOrigin,translate,willChange';
const VISIBLE_PRESETS: MotionPresetName[] = ['rule', 'strike', 'wipe'];

function buildStagger(count: number, token: MotionStaggerToken, from: MotionStaggerOrigin = 'start'): gsap.StaggerVars {
    const tokens = getMotionTokens();

    return { amount: Math.min(count * tokens.stagger[token], tokens.staggerMaxTotal), from };
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
