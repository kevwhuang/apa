import { STORAGE } from '@lib/shared/constants';
import { createStore } from '@lib/shared/state';

interface OnboardingProgress {
    step: number;
    userId: string;
}

const EMPTY_PROGRESS: OnboardingProgress = { step: 0, userId: '' };

const store = createStore<OnboardingProgress>({
    fallback: EMPTY_PROGRESS,
    key: STORAGE.onboardingDraft.key,
    normalize: normalizeProgress,
    scope: STORAGE.onboardingDraft.scope,
    topic: STORAGE.onboardingDraft.topic,
});

function clearOnboardingStep(): void {
    store.remove();
}

function getOnboardingStep(userId: string): number {
    const progress = store.get();

    return progress.userId === userId ? progress.step : 0;
}

function normalizeProgress(value: OnboardingProgress): OnboardingProgress {
    if (typeof value !== 'object' || value === null) return EMPTY_PROGRESS;
    if (typeof value.userId !== 'string' || value.userId.length === 0) return EMPTY_PROGRESS;

    return { step: Math.max(0, Math.trunc(Number(value.step)) || 0), userId: value.userId };
}

function saveOnboardingStep(userId: string, step: number): void {
    store.set({ step, userId });
}

export { clearOnboardingStep, getOnboardingStep, saveOnboardingStep };
