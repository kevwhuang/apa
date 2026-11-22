import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '@lib/shared/constants';
import { retractToast, toast } from '@lib/ui/toasts';

const summaries = new WeakMap<HTMLFormElement, Set<string>>();

function clearFieldErrors(form: HTMLFormElement): void {
    form.querySelectorAll('[aria-invalid]').forEach((control) => {
        control.setAttribute('aria-invalid', 'false');
    });

    queueMicrotask(() => retractSummaries(form));
}

function describeFieldErrors(form: HTMLFormElement, errors: FieldErrors) {
    const keys = Object.keys(errors);

    const names = new Set([...Array.from(form.elements, getControlName).filter(name => keys.includes(name)), ...keys]);

    return Array.from(new Set(Array.from(names, name => errors[name]))).join(' ');
}

function focusFirstError(form: HTMLFormElement, errors: FieldErrors) {
    const names = Object.keys(errors);

    const control = Array.from(form.elements).find(element => names.includes(getControlName(element)));

    if (!(control instanceof HTMLElement)) return;

    control.focus();
    control.scrollIntoView({ block: 'nearest' });
}

function getConfirmRule(): FieldRule {
    return { message: 'Both passwords must match.', required: true, validate: (_value, values) => values.get('confirm') === values.get('password') };
}

function getControlName(element: Element) {
    return 'name' in element && typeof element.name === 'string' ? element.name : '';
}

function getPasswordRule(): FieldRule {
    return {
        message: `Use ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_BYTES} characters, including a letter and a digit.`,
        min: PASSWORD_MIN_LENGTH,
        required: true,
        validate: value => /[a-z]/i.test(value) && /\d/.test(value) && new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES,
    };
}

function handleFieldEdit(event: Event) {
    const { currentTarget: form, target } = event;

    if (!(form instanceof HTMLFormElement) || !(target instanceof Element)) return;

    const name = getControlName(target);

    if (name.length === 0 || !form.querySelector(`[name="${name}"][aria-invalid="true"]`)) return;

    markField(form, name, false);
}

function handleReveal(button: HTMLButtonElement): void {
    const input = document.getElementById(button.dataset.reveal ?? '');
    const isShown = button.getAttribute('aria-pressed') === 'true';

    if (!(input instanceof HTMLInputElement)) return;

    button.setAttribute('aria-label', isShown ? 'Show password' : 'Hide password');
    button.setAttribute('aria-pressed', isShown ? 'false' : 'true');
    input.type = isShown ? 'password' : 'text';
}

function markField(form: HTMLFormElement, name: string, isInvalid: boolean) {
    form.querySelectorAll(`[name="${name}"]`).forEach((control) => {
        control.setAttribute('aria-invalid', String(isInvalid));
    });
}

function reportFieldErrors(form: HTMLFormElement, errors: FieldErrors): void {
    if (Object.keys(errors).length === 0) return;

    const summary = describeFieldErrors(form, errors);

    setFieldErrors(form, errors);
    focusFirstError(form, errors);
    summaries.set(form, (summaries.get(form) ?? new Set<string>()).add(summary));
    toast(summary, 'error');
}

function retractSummaries(form: HTMLFormElement) {
    const posted = summaries.get(form);

    if (!posted || form.querySelector('[aria-invalid="true"]')) return;

    posted.forEach(summary => retractToast(summary));
    summaries.delete(form);
}

function serialize(form: HTMLFormElement, avatar = ''): string {
    return JSON.stringify([avatar, ...new FormData(form)]);
}

function setFieldErrors(form: HTMLFormElement, errors: FieldErrors): void {
    Object.keys(errors).forEach((name) => {
        markField(form, name, true);
    });
}

function setRole(form: HTMLFormElement, value: string): void {
    const match = Array.from(form.querySelectorAll<HTMLInputElement>('[name="role"]')).find(radio => radio.value === value);

    if (match) match.checked = true;
}

function validateFields(form: HTMLFormElement, rules: Record<string, FieldRule>): FieldErrors {
    const errors: FieldErrors = {};
    const values = new FormData(form);

    Object.entries(rules).forEach(([name, rule]) => {
        const value = values.get(name);

        if (!violates(rule, (typeof value === 'string' ? value : '').trim(), values)) return;

        errors[name] = rule.message;
    });

    return errors;
}

function violates(rule: FieldRule, value: string, values: FormData) {
    if (rule.required && value.length === 0) return true;

    if (value.length === 0) return false;

    if (rule.min !== undefined && value.length < rule.min) return true;
    if (rule.max !== undefined && value.length > rule.max) return true;
    if (rule.pattern && !rule.pattern.test(value)) return true;

    return rule.validate ? !rule.validate(value, values) : false;
}

function watchFieldErrors(form: HTMLFormElement, signal: AbortSignal): void {
    form.addEventListener('change', handleFieldEdit, { capture: true, signal });
    form.addEventListener('input', handleFieldEdit, { capture: true, signal });
}

export {
    clearFieldErrors,
    getConfirmRule,
    getPasswordRule,
    handleReveal,
    reportFieldErrors,
    serialize,
    setFieldErrors,
    setRole,
    validateFields,
    watchFieldErrors,
};
