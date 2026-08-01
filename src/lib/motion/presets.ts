import { getMotionTokens } from '@lib/motion/tokens';

const CLIP_OPEN = 'inset(0% 0% 0% 0%)';

const STAMP_ORIGIN = '0% 50%';

const STAMP_SCALE = 1.07;

const STRIKE_CLIP = 'inset(0% 0% 108% 0%)';

const STRIKE_OFFSET = '0.12em';

const UNFOLD_CLIP = 'inset(12% 0% 12% 0%)';

const UNFOLD_SCALE = 0.94;

export const ENTRANCE_PRESETS: Record<MotionPresetName, MotionPreset> = {
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
        from: () => ({ opacity: 1, scaleX: 0, transformOrigin: STAMP_ORIGIN }),
        stagger: 'tight',
        to: () => ({ scaleX: 1 }),
    },
    stamp: {
        duration: 'base',
        ease: 'snap',
        from: () => ({ opacity: 0, scale: STAMP_SCALE, transformOrigin: STAMP_ORIGIN }),
        stagger: 'tight',
        to: () => ({ opacity: 1, scale: 1 }),
    },
    strike: {
        duration: 'slowest',
        ease: 'entrance',
        from: () => ({ clipPath: STRIKE_CLIP, opacity: 1, y: STRIKE_OFFSET }),
        stagger: 'base',
        to: () => ({ clipPath: CLIP_OPEN, y: 0 }),
    },
    unfold: {
        duration: 'slower',
        ease: 'entrance',
        from: () => ({ clipPath: UNFOLD_CLIP, opacity: 0, scaleY: UNFOLD_SCALE }),
        stagger: 'base',
        to: () => ({ clipPath: CLIP_OPEN, opacity: 1, scaleY: 1 }),
    },
};

export const FOLDED_PROPERTIES = ['rotate', 'scale', 'transform', 'translate'];

export const GUARDED_PRESET: MotionPresetName = 'rise';

export const PRESET_NAMES = Object.keys(ENTRANCE_PRESETS) as MotionPresetName[];

export const REST_PROPERTIES = 'clipPath,rotate,scale,transform,transformOrigin,translate,willChange';

export const VISIBLE_PRESETS: MotionPresetName[] = ['rule', 'strike'];

export function buildStagger(count: number, token: MotionStaggerToken, from: 'end' | 'start' = 'start'): gsap.StaggerVars {
    const tokens = getMotionTokens();

    return { amount: Math.min(count * tokens.stagger[token], tokens.staggerMaxTotal), from };
}

export function resolvePreset(name: string | undefined): MotionPresetName | undefined {
    return PRESET_NAMES.find(preset => preset === name);
}
