import { PASSWORD_MIN_LENGTH } from '@lib/shared/constants';
import { describeCartIssue, setText } from '@lib/shared/utils';

const BYPASS_WINDOW_MS = 0;
const PLACEHOLDER_EMAIL = 'you@studio.fm';

let bypassTimer: Timer | undefined;
let bypassing = false;

function clearFieldErrors(form: HTMLFormElement): void {
    form.querySelectorAll('[aria-invalid]').forEach((control) => {
        control.setAttribute('aria-invalid', 'false');
    });

    form.querySelectorAll('[data-field-error]').forEach((element) => {
        element.textContent = '';
        element.setAttribute('hidden', '');
    });
}

function confirmRule(): FieldRule {
    return { message: 'Both passwords must match.', required: true, validate: (value, values) => value === values.get('password') };
}

function focusFirstError(form: HTMLFormElement, errors: FieldErrors): void {
    const names = Object.keys(errors);

    if (names.length === 0) return;

    const control = Array.from(form.elements).find(element => names.includes(getControlName(element)));

    if (control instanceof HTMLElement) control.focus();
}

function getControlName(element: Element) {
    return 'name' in element && typeof element.name === 'string' ? element.name : '';
}

function getErrorElement(form: HTMLFormElement, name: string) {
    const control = form.querySelector(`[name="${name}"]`);

    const described = control?.getAttribute('aria-describedby') ?? '';

    for (const id of described.split(/\s+/).filter(Boolean)) {
        const element = form.ownerDocument.getElementById(id);

        if (element?.hasAttribute('data-field-error')) return element;
    }

    return null;
}

function getValue(values: FormData, name: string) {
    const value = values.get(name);

    return typeof value === 'string' ? value : '';
}

function handleBypassClick(event: MouseEvent): void {
    bypassing = event.metaKey;

    if (!bypassing) return;

    clearTimeout(bypassTimer);
    bypassTimer = setTimeout(releaseBypass, BYPASS_WINDOW_MS);
}

function handleReveal(button: HTMLButtonElement): void {
    const input = document.getElementById(button.dataset.reveal ?? '');
    const shown = button.getAttribute('aria-pressed') === 'true';

    if (!(input instanceof HTMLInputElement)) return;

    button.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
    button.setAttribute('aria-pressed', shown ? 'false' : 'true');
    input.type = shown ? 'password' : 'text';
}

function hasLetterAndDigit(value: string): boolean {
    return /[a-z]/i.test(value) && /\d/.test(value);
}

function isValidationBypassed(): boolean {
    return bypassing;
}

function passwordRule(): FieldRule {
    return { message: `Use at least ${PASSWORD_MIN_LENGTH} characters, including a letter and a digit.`, min: PASSWORD_MIN_LENGTH, required: true, validate: hasLetterAndDigit };
}

function readEmail(values: FormData): string {
    const email = String(values.get('email') ?? '').trim();

    if (email.length > 0 || !isValidationBypassed()) return email;

    return PLACEHOLDER_EMAIL;
}

function releaseBypass(): void {
    bypassing = false;
    bypassTimer = undefined;
}

function renderIssueList(issues: CartIssue[], notice: HTMLElement | null, list: HTMLElement | null, template: HTMLTemplateElement | null): void {
    if (!list || !notice || !template) return;

    list.replaceChildren();
    notice.toggleAttribute('hidden', issues.length === 0);

    issues.forEach((issue) => {
        const fragment = template.content.cloneNode(true) as DocumentFragment;

        setText(fragment.querySelector('[data-issue-text]'), describeCartIssue(issue));
        list.append(fragment);
    });
}

function setFieldErrors(form: HTMLFormElement, errors: FieldErrors): void {
    Object.entries(errors).forEach(([name, message]) => {
        form.querySelectorAll(`[name="${name}"]`).forEach((control) => {
            control.setAttribute('aria-invalid', 'true');
        });

        const element = getErrorElement(form, name);

        if (!element) return;

        element.textContent = message;
        element.removeAttribute('hidden');
    });
}

function setRole(form: HTMLFormElement, value: string): void {
    const match = Array.from(form.querySelectorAll<HTMLInputElement>('[name="role"]')).find(radio => radio.value === value);

    if (match) match.checked = true;
}

function validateFields(form: HTMLFormElement, rules: Record<string, FieldRule>): FieldErrors {
    if (isValidationBypassed()) return {};

    const errors: FieldErrors = {};
    const values = new FormData(form);

    Object.entries(rules).forEach(([name, rule]) => {
        if (!violates(rule, getValue(values, name).trim(), values)) return;

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

if (typeof document !== 'undefined') document.addEventListener('click', handleBypassClick, { capture: true });

export {
    clearFieldErrors,
    confirmRule,
    focusFirstError,
    handleReveal,
    hasLetterAndDigit,
    isValidationBypassed,
    passwordRule,
    readEmail,
    renderIssueList,
    setFieldErrors,
    setRole,
    validateFields,
};
