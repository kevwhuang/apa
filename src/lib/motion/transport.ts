import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { getMotionTokens } from '@lib/motion/tokens';

const VELOCITY_LIMIT = 1;

const VELOCITY_PRECISION = 4;

const VELOCITY_PROPERTY = '--scroll-velocity';

let decay: gsap.core.Tween | undefined;

let trigger: ScrollTrigger | undefined;

export function clearTransport(): void {
    decay?.kill();
    trigger?.kill();
    decay = undefined;
    trigger = undefined;
    document.documentElement.style.removeProperty(VELOCITY_PROPERTY);
}

export function initTransport(): void {
    const root = document.documentElement;
    const tokens = getMotionTokens();
    const velocity = { value: 0 };

    function writeVelocity() {
        root.style.setProperty(VELOCITY_PROPERTY, velocity.value.toFixed(VELOCITY_PRECISION));
    }

    trigger = ScrollTrigger.create({
        end: 'max',
        onUpdate(self) {
            velocity.value = gsap.utils.clamp(-VELOCITY_LIMIT, VELOCITY_LIMIT, self.getVelocity() / tokens.velocityCap);
            writeVelocity();
            decay = gsap.to(velocity, {
                duration: tokens.duration.slow,
                ease: tokens.ease.standard,
                onUpdate: writeVelocity,
                overwrite: true,
                value: 0,
            });
        },
        start: 0,
        trigger: document.body,
    });
}
