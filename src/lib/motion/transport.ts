import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { getMotionTokens } from '@lib/motion/tokens';

const VELOCITY_LIMIT = 1;

const VELOCITY_PRECISION = 4;

const VELOCITY_PROPERTY = '--scroll-velocity';

export function clearTransport(): void {
    document.documentElement.style.removeProperty(VELOCITY_PROPERTY);
}

export function initTransport(): void {
    const root = document.documentElement;
    const tokens = getMotionTokens();
    const velocity = { value: 0 };

    function writeVelocity() {
        root.style.setProperty(VELOCITY_PROPERTY, velocity.value.toFixed(VELOCITY_PRECISION));
    }

    ScrollTrigger.create({
        end: 'max',
        onUpdate(self) {
            velocity.value = gsap.utils.clamp(-VELOCITY_LIMIT, VELOCITY_LIMIT, self.getVelocity() / tokens.velocityCap);
            writeVelocity();
            gsap.to(velocity, {
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
