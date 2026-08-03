import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN } from '@lib/constants';
import { describeCartIssue, setText } from '@lib/utils';

const USERNAME_REGEX = new RegExp(`^${USERNAME_PATTERN}$`, 'i');

export function clearFieldErrors(form: HTMLFormElement): void {
    form.querySelectorAll('[aria-invalid]').forEach((control) => {
        control.setAttribute('aria-invalid', 'false');
    });

    form.querySelectorAll('[data-field-error]').forEach((element) => {
        element.textContent = '';
        element.setAttribute('hidden', '');
    });
}

export function confirmRule(): FieldRule {
    return { message: 'Both passwords must match.', required: true, validate: (value, values) => value === values.get('password') };
}

export function focusFirstError(form: HTMLFormElement, errors: FieldErrors): void {
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

export function hasLetterAndDigit(value: string): boolean {
    return /[a-z]/i.test(value) && /\d/.test(value);
}

export function passwordRule(): FieldRule {
    return { message: `Use at least ${PASSWORD_MIN_LENGTH} characters, including a letter and a digit.`, min: PASSWORD_MIN_LENGTH, required: true, validate: hasLetterAndDigit };
}

export function renderErrorSummary(form: HTMLFormElement, errors: FieldErrors, anchorPrefix: string): void {
    const list = form.querySelector<HTMLElement>('[data-form-error-list]');
    const names = Object.keys(errors);
    const summary = form.querySelector<HTMLElement>('[data-form-error]');
    const template = form.ownerDocument.querySelector<HTMLTemplateElement>('[data-error-anchor]');

    if (!list || !summary) return;

    list.replaceChildren();
    summary.toggleAttribute('hidden', names.length === 0);
    setText(summary.querySelector('[data-form-error-message]'), names.length === 0 ? '' : `Check ${names.length === 1 ? 'this field' : `these ${names.length} fields`} before you continue.`);

    if (names.length === 0 || !template) return;

    names.forEach((name) => {
        const fragment = template.content.cloneNode(true) as DocumentFragment;
        const link = fragment.querySelector<HTMLAnchorElement>('[data-anchor]');

        if (link) {
            link.href = `#${anchorPrefix}-${name}`;
            link.textContent = errors[name];
        }

        list.append(fragment);
    });

    summary.focus();
}

export function renderIssueList(issues: CartIssue[], notice: HTMLElement | null, list: HTMLElement | null, template: HTMLTemplateElement | null): void {
    if (!list || !notice || !template) return;

    list.replaceChildren();
    notice.toggleAttribute('hidden', issues.length === 0);

    issues.forEach((issue) => {
        const fragment = template.content.cloneNode(true) as DocumentFragment;

        setText(fragment.querySelector('[data-issue-text]'), describeCartIssue(issue));
        list.append(fragment);
    });
}

export function setFieldErrors(form: HTMLFormElement, errors: FieldErrors): void {
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

export function usernameRule(): FieldRule {
    return { message: 'Use 3 to 20 letters, numbers, or underscores.', pattern: USERNAME_REGEX, required: true };
}

export function validateFields(form: HTMLFormElement, rules: Record<string, FieldRule>): FieldErrors {
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
