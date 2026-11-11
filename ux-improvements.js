/* Фианит Экспертиза — Unified Validation & Smart Field Helpers (v6.0) */
(function (global) {
    'use strict';

    const PRECIOUS_METALS_KEYWORDS = [
        'золото', 'золот', 'серебро', 'серебр', 'платина', 'платин',
        'палладий', 'паллад', '585', '750', '925', '999', 'драгметал', 'драг.метал',
        'монет', 'нумизмат', 'полтинник', 'червон'
    ];

    function getLocalTodayIso() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function cleanDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function syncDescribedBy(field, includeError) {
        if (!field) return;
        const hintId = field.dataset.hint;
        const errId = field.dataset.error || (field.id ? `err-${field.id}` : '');
        const ids = [];
        if (hintId && document.getElementById(hintId)) ids.push(hintId);
        if (includeError && errId && document.getElementById(errId)) ids.push(errId);
        if (ids.length > 0) {
            field.setAttribute('aria-describedby', ids.join(' '));
        } else {
            field.removeAttribute('aria-describedby');
        }
    }

    function getErrorElement(field) {
        if (!field) return null;
        if (field.dataset.error) {
            const byData = document.getElementById(field.dataset.error);
            if (byData) return byData;
        }
        if (field.id) {
            const byId = document.getElementById(`err-${field.id}`);
            if (byId) return byId;
        }
        const group = field.closest('.form-group');
        return group ? group.querySelector('.error-message') : null;
    }

    function setFieldError(field, message) {
        if (!field) return;
        field.classList.add('invalid', 'user-invalid-fallback');
        field.setAttribute('aria-invalid', 'true');
        if (typeof field.setCustomValidity === 'function') {
            field.setCustomValidity(message || 'Неверное значение');
        }
        const errEl = getErrorElement(field);
        if (errEl) {
            errEl.textContent = message;
            errEl.hidden = false;
        }
        syncDescribedBy(field, true);
    }

    function clearFieldError(field) {
        if (!field) return;
        field.classList.remove('invalid', 'input-error', 'user-invalid-fallback');
        field.setAttribute('aria-invalid', 'false');
        if (typeof field.setCustomValidity === 'function') {
            field.setCustomValidity('');
        }
        const errEl = getErrorElement(field);
        if (errEl) {
            errEl.textContent = '';
            errEl.hidden = true;
        }
        syncDescribedBy(field, false);
    }

    function announceFormError(message) {
        const announcer = document.getElementById('formErrorAnnouncer');
        if (!announcer) return;
        announcer.textContent = '';
        window.requestAnimationFrame(() => {
            announcer.textContent = message;
        });
    }

    function clearErrorSummary() {
        const summary = document.getElementById('formErrorSummary');
        const list = document.getElementById('formErrorSummaryList');
        if (summary) summary.hidden = true;
        if (list) list.innerHTML = '';
    }

    function renderErrorSummary(errors) {
        const summary = document.getElementById('formErrorSummary');
        const list = document.getElementById('formErrorSummaryList');
        if (!summary || !list) return;

        if (!errors || errors.length === 0) {
            clearErrorSummary();
            return;
        }

        list.innerHTML = '';
        errors.forEach((err) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'summary-link';
            btn.textContent = err.summaryLabel ? `${err.summaryLabel}: ${err.message}` : err.message;
            btn.addEventListener('click', () => {
                if (err.focusTarget) {
                    err.focusTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (typeof err.focusTarget.focus === 'function') {
                        err.focusTarget.focus({ preventScroll: true });
                    }
                }
            });
            li.appendChild(btn);
            list.appendChild(li);
        });
        summary.hidden = false;
    }

    function validateField(field, options) {
        if (!field) return { valid: true, message: '' };
        const opts = options || {};
        const force = Boolean(opts.force);
        const touched = field.dataset.touched === '1';

        if (!force && !touched) {
            return { valid: true, message: '' };
        }

        const id = field.id || '';
        const raw = String(field.value || '').trim();
        let errorMsg = '';

        if (id === 'department') {
            const digits = cleanDigits(raw).slice(0, 4);
            if (!digits) {
                errorMsg = 'Укажите номер подразделения';
            } else if (parseInt(digits, 10) <= 0) {
                errorMsg = 'Номер подразделения не может быть 0';
            } else if (digits.length > 4) {
                errorMsg = 'Максимум 4 цифры';
            }
        } else if (id === 'issue') {
            const digits = cleanDigits(raw).slice(0, 6);
            if (!digits) {
                errorMsg = 'Укажите номер заключения';
            } else if (parseInt(digits, 10) <= 0) {
                errorMsg = 'Укажите номер больше 0';
            }
        } else if (id === 'ticket') {
            const digits = cleanDigits(raw).slice(0, 11);
            if (!digits) {
                errorMsg = 'Укажите 11-значный номер билета';
            } else if (digits.length !== 11) {
                errorMsg = `Нужно ровно 11 цифр (сейчас ${digits.length})`;
            } else if (/^0{11}$/.test(digits)) {
                errorMsg = 'Номер билета не может состоять из одних нулей';
            }
        } else if (id === 'date') {
            if (!raw) {
                errorMsg = 'Выберите дату заключения';
            } else if (raw < '2020-01-01') {
                errorMsg = 'Проверьте дату (не раньше 2020 г.)';
            } else if (raw > getLocalTodayIso()) {
                errorMsg = 'Дата не может быть в будущем';
            }
        } else if (id === 'region') {
            if (!raw) {
                errorMsg = 'Выберите регион филиала';
            }
        } else if (field.classList.contains('desc')) {
            const meaningful = (raw.match(/[a-zа-яё0-9]/gi) || []).length;
            if (!raw) {
                errorMsg = 'Добавьте описание предмета';
            } else if (raw.length < 3 || meaningful < 2) {
                errorMsg = 'Опишите предмет подробнее (от 3 символов)';
            }
        } else if (field.classList.contains('eval')) {
            const digits = cleanDigits(raw);
            const num = parseInt(digits, 10);
            if (!digits || Number.isNaN(num) || num <= 0) {
                errorMsg = 'Укажите оценку больше 0 ₽';
            } else if (num > 50000000) {
                errorMsg = 'Проверьте сумму (максимум 50 000 000 ₽)';
            }
        }

        if (errorMsg) {
            if (force || opts.showUI !== false) {
                setFieldError(field, errorMsg);
            }
            return { valid: false, message: errorMsg };
        }

        clearFieldError(field);
        return { valid: true, message: '' };
    }

    function updateTicketPrefixChip() {
        const prefixBtn = document.getElementById('ticketPrefixBtn');
        const deptEl = document.getElementById('department');
        const ticketEl = document.getElementById('ticket');
        if (!prefixBtn || !deptEl || !ticketEl) return;

        const deptDigits = cleanDigits(deptEl.value).slice(0, 4);
        const ticketDigits = cleanDigits(ticketEl.value);

        if (deptDigits && parseInt(deptDigits, 10) > 0 && ticketDigits.length === 0) {
            const padded = deptDigits.padStart(4, '0');
            prefixBtn.dataset.prefix = padded;
            prefixBtn.textContent = `Префикс ${padded}…`;
            prefixBtn.hidden = false;
        } else {
            prefixBtn.hidden = true;
        }
    }

    function updateTicketCounter(rawVal) {
        const counter = document.getElementById('ticketCounter');
        const digits = cleanDigits(rawVal).slice(0, 11);
        const len = digits.length;
        if (counter) {
            counter.textContent = len === 11 ? '11 / 11 ✓' : `${len} / 11`;
            counter.classList.remove('is-ready', 'is-warn');
            if (len === 11 && !/^0{11}$/.test(digits)) {
                counter.classList.add('is-ready');
            } else if (len > 0) {
                counter.classList.add('is-warn');
            }
        }
        updateTicketPrefixChip();
    }

    let ticketCheckDebounce = null;
    let ticketCheckRequestSeq = 0;

    async function checkTicketDuplicateLive(ticketDigits) {
        const statusEl = document.getElementById('ticketCheckStatus');
        if (!statusEl) return;

        const clean = cleanDigits(ticketDigits).slice(0, 11);
        if (clean.length !== 11 || /^0{11}$/.test(clean)) {
            statusEl.hidden = true;
            statusEl.className = 'ticket-check-status';
            statusEl.textContent = '';
            return;
        }

        const cleanBase = typeof global.getCleanBotUrl === 'function' ? global.getCleanBotUrl() : '';
        if (!cleanBase || !navigator.onLine) {
            statusEl.hidden = true;
            return;
        }

        const seq = ++ticketCheckRequestSeq;
        statusEl.hidden = false;
        statusEl.className = 'ticket-check-status status-checking';
        statusEl.textContent = 'Проверка номера билета в базе...';

        try {
            const resp = await fetch(`${cleanBase}/api/check-ticket?ticket=${encodeURIComponent(clean)}`);
            if (seq !== ticketCheckRequestSeq) return;
            if (!resp.ok) {
                statusEl.hidden = true;
                return;
            }
            const data = await resp.json();
            if (seq !== ticketCheckRequestSeq) return;

            if (data && data.exists) {
                statusEl.className = 'ticket-check-status status-dup';
                statusEl.textContent = `Билет № ${clean} уже есть в базе (${data.count || 1} раз). Можно оформить повторно.`;
            } else {
                statusEl.className = 'ticket-check-status status-ok';
                statusEl.textContent = '✓ Билет не найден в базе — можно оформлять новое заключение';
            }
        } catch (err) {
            if (seq !== ticketCheckRequestSeq) return;
            statusEl.hidden = true;
        }
    }

    function scheduleTicketDuplicateCheck(rawVal) {
        const digits = cleanDigits(rawVal).slice(0, 11);
        updateTicketCounter(digits);
        clearTimeout(ticketCheckDebounce);
        if (digits.length === 11 && !/^0{11}$/.test(digits)) {
            ticketCheckDebounce = setTimeout(() => {
                checkTicketDuplicateLive(digits);
            }, 350);
        } else {
            const statusEl = document.getElementById('ticketCheckStatus');
            if (statusEl) {
                statusEl.hidden = true;
                statusEl.textContent = '';
            }
        }
    }

    function checkPreciousMetals(textarea) {
        if (!textarea) return;
        const formGroup = textarea.closest('.form-group');
        if (!formGroup) return;

        let warnEl = formGroup.querySelector('.precious-warning');
        const val = String(textarea.value || '').toLowerCase();
        const found = PRECIOUS_METALS_KEYWORDS.some((kw) => val.includes(kw));

        if (found) {
            if (!warnEl) {
                warnEl = document.createElement('div');
                warnEl.className = 'precious-warning';
                warnEl.setAttribute('role', 'note');
                const hintEl = formGroup.querySelector('.field-hint');
                if (hintEl) {
                    hintEl.after(warnEl);
                } else {
                    formGroup.appendChild(warnEl);
                }
            }
            warnEl.textContent = '⛔ Монеты из драгметаллов и предметы, содержащие драгоценные металлы, не принимаются по схеме кредитования «Антиквариат».';
            warnEl.hidden = false;
        } else if (warnEl) {
            warnEl.hidden = true;
        }
    }

    function autoCapitalizeInput(field) {
        if (!field || !field.value) return;
        const v = field.value;
        const first = v.charAt(0);
        if (first && first !== first.toUpperCase() && /[а-яa-zё]/i.test(first)) {
            const start = field.selectionStart;
            const end = field.selectionEnd;
            field.value = first.toUpperCase() + v.slice(1);
            if (typeof start === 'number' && typeof end === 'number') {
                try {
                    field.setSelectionRange(start, end);
                } catch (e) { }
            }
        }
    }

    function autoResizeTextarea(el) {
        if (!el || el.tagName !== 'TEXTAREA') return;
        el.style.height = 'auto';
        el.style.height = `${Math.max(74, Math.min(el.scrollHeight + 2, 240))}px`;
    }

    function bindFieldValidation(field) {
        if (!field || field.dataset.uxBound === '1') return;
        field.dataset.uxBound = '1';

        field.addEventListener('input', () => {
            field.dataset.touched = '1';
            if (field.id === 'department') {
                const clamped = cleanDigits(field.value).slice(0, 4);
                if (field.value !== clamped) field.value = clamped;
                updateTicketPrefixChip();
            } else if (field.id === 'issue') {
                const clamped = cleanDigits(field.value).slice(0, 6);
                if (field.value !== clamped) field.value = clamped;
            } else if (field.id === 'ticket') {
                const clamped = cleanDigits(field.value).slice(0, 11);
                if (field.value !== clamped) field.value = clamped;
                scheduleTicketDuplicateCheck(clamped);
            } else if (field.classList.contains('eval')) {
                const digits = cleanDigits(field.value);
                if (digits.length > 8) {
                    const clipped = digits.slice(0, 8);
                    field.value = clipped.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                }
            }
            if (field.classList.contains('desc')) {
                autoCapitalizeInput(field);
                autoResizeTextarea(field);
                checkPreciousMetals(field);
            }
            if (field.classList.contains('invalid') || field.getAttribute('aria-invalid') === 'true') {
                validateField(field, { force: true });
            }
            if (typeof global.updateFormCompletion === 'function') {
                global.updateFormCompletion();
            }
        });

        field.addEventListener('change', () => {
            field.dataset.touched = '1';
            if (field.id === 'department') {
                const val = cleanDigits(field.value).slice(0, 4);
                field.value = val;
                if (val && parseInt(val, 10) > 0) {
                    try { localStorage.setItem('last_department', val); } catch (e) { }
                }
                updateTicketPrefixChip();
            }
            validateField(field, { force: false });
            if (typeof global.updateFormCompletion === 'function') {
                global.updateFormCompletion();
            }
        });

        field.addEventListener('blur', () => {
            if (field.dataset.touched === '1') {
                validateField(field, { force: true });
            }
        });
    }

    function initUxImprovements() {
        const deptEl = document.getElementById('department');
        if (deptEl && !deptEl.value) {
            try {
                const lastDept = cleanDigits(localStorage.getItem('last_department') || '').slice(0, 4);
                if (lastDept && parseInt(lastDept, 10) > 0) {
                    deptEl.value = lastDept;
                } else {
                    localStorage.removeItem('last_department');
                }
            } catch (e) { }
        }

        const dateEl = document.getElementById('date');
        if (dateEl) {
            dateEl.min = '2020-01-01';
            dateEl.max = getLocalTodayIso();
        }

        ['department', 'issue', 'ticket', 'date', 'region'].forEach((id) => {
            bindFieldValidation(document.getElementById(id));
        });

        const ticketEl = document.getElementById('ticket');
        if (ticketEl) {
            const clamped = cleanDigits(ticketEl.value).slice(0, 11);
            if (ticketEl.value !== clamped) ticketEl.value = clamped;
            updateTicketCounter(clamped);
        }

        document.querySelectorAll('.desc, .eval').forEach((el) => bindFieldValidation(el));
    }

    global.UX = {
        getLocalTodayIso,
        cleanDigits,
        setFieldError,
        clearFieldError,
        validateField,
        announceFormError,
        renderErrorSummary,
        clearErrorSummary,
        updateTicketCounter,
        updateTicketPrefixChip,
        scheduleTicketDuplicateCheck,
        checkPreciousMetals,
        autoResizeTextarea,
        bindFieldValidation,
        initUxImprovements
    };

    global.getLocalTodayIso = getLocalTodayIso;
    global.clearFieldError = clearFieldError;
    global.initUxImprovements = initUxImprovements;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUxImprovements);
    } else {
        initUxImprovements();
    }
})(window);
