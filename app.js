/* Фианит Экспертиза — Mini App Logic (v6.0) */
'use strict';

// ============================================
// 1. TELEGRAM SHIM & CONFIG
// ============================================
const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : {
    initData: '',
    initDataUnsafe: {},
    colorScheme: 'light',
    platform: 'unknown',
    themeParams: {},
    expand: () => { },
    ready: () => { },
    requestFullscreen: () => { },
    setHeaderColor: () => { },
    setBackgroundColor: () => { },
    showAlert: (message) => window.alert(message),
    showPopup: ({ message }) => window.alert(message),
    sendData: () => { },
    close: () => { },
    onEvent: () => { },
    MainButton: {
        setText: () => { },
        show: () => { },
        hide: () => { },
        enable: () => { },
        disable: () => { },
        showProgress: () => { },
        hideProgress: () => { },
        onClick: () => { },
        offClick: () => { }
    },
    HapticFeedback: {
        impactOccurred: () => { },
        notificationOccurred: () => { },
        selectionChanged: () => { }
    }
};

const APP_CONFIG = {
    DEFAULT_BOT_URL: window.APP_DEFAULT_BOT_URL || '',
    IMAGEBAN_CLIENT_ID: window.APP_IMAGEBAN_CLIENT_ID || 'JNo3V4ZQiuzGItX0zXj1kFFfdJ1ocGs7dfN'
};
const APP_BUILD_ID = '6000';
const QUIZ_SIZE = 5;
const QUIZ_VERSION = '6000';

const urlParams = new URLSearchParams(window.location.search);
const urlBotUrl = (urlParams.get('bot_url') || '').trim();
const urlImgbbKey = (urlParams.get('imgbb_key') || '').trim();
const imagebanClientId = (urlParams.get('imageban_client') || APP_CONFIG.IMAGEBAN_CLIENT_ID || '').trim();

function isTelegramWebAppRuntime() {
    const platform = String(tg.platform || '').toLowerCase();
    const knownTelegramPlatforms = new Set(['android', 'ios', 'macos', 'tdesktop', 'weba', 'webk', 'unigram']);
    return Boolean(
        (tg.initData && tg.initData.length > 0) ||
        (tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) ||
        knownTelegramPlatforms.has(platform)
    );
}

const isInTelegram = isTelegramWebAppRuntime();

let botUrl = urlBotUrl || APP_CONFIG.DEFAULT_BOT_URL;
if (!isInTelegram) {
    try {
        botUrl = localStorage.getItem('bot_url') || botUrl;
    } catch (e) { }
} else if (botUrl) {
    try {
        localStorage.setItem('bot_url', botUrl);
    } catch (e) { }
}

function getCleanBotUrl() {
    return String(botUrl || '').trim().replace(/\/$/, '');
}

function escapeHtml(unsafe) {
    return String(unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function cleanNumber(str) {
    return parseInt(String(str || '').replace(/[^\d]/g, ''), 10) || 0;
}

function formatNumber(num) {
    return (Number(num) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatNumberWithSpaces(num) {
    return formatNumber(num);
}

function showAppAlert(message) {
    if (isTelegramWebAppRuntime() && typeof tg.showAlert === 'function') {
        try {
            tg.showAlert(message);
            return;
        } catch (e) { }
    }
    window.alert(message);
}

function showAppPopup(message) {
    if (isTelegramWebAppRuntime() && typeof tg.showPopup === 'function') {
        try {
            tg.showPopup({ message });
            return;
        } catch (e) { }
    }
    window.alert(message);
}

// ============================================
// 2. AUDIO, HAPTICS & THEME SYNC
// ============================================
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
    }
    return audioCtx;
}

function unlockAudio() {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => { });
    }
}

function playTone(kind = 'success') {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return;
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;

        if (kind === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(210, now);
            osc.frequency.linearRampToValueAtTime(140, now + 0.14);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
        }

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.17);
    } catch (e) { }
}

function haptic(type = 'light', opts = {}) {
    if (isTelegramWebAppRuntime() && tg.HapticFeedback) {
        try {
            if (type === 'success' || type === 'error' || type === 'warning') {
                tg.HapticFeedback.notificationOccurred(type);
            } else {
                tg.HapticFeedback.impactOccurred(type);
            }
        } catch (e) { }
    } else if (opts && opts.vibrate && navigator.vibrate) {
        navigator.vibrate(type === 'error' ? [30, 40, 30] : 12);
    }
    if (opts && opts.sound) {
        playTone(type === 'error' ? 'error' : 'success');
    }
}

function applyTheme() {
    const paramTheme = (urlParams.get('theme') || '').toLowerCase();
    const osPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const tgDark = isTelegramWebAppRuntime() && tg.colorScheme === 'dark';
    const isDark = paramTheme ? paramTheme === 'dark' : (isTelegramWebAppRuntime() ? tgDark : osPrefersDark);

    const htmlEl = document.documentElement;
    if (paramTheme === 'dark' || paramTheme === 'light' || isTelegramWebAppRuntime()) {
        htmlEl.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
        htmlEl.removeAttribute('data-theme');
    }

    document.body.classList.toggle('dark-mode', isDark);

    if (isTelegramWebAppRuntime()) {
        document.body.classList.add('in-telegram');
        try {
            const bgColor = isDark ? '#0b1120' : '#eef2f8';
            if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor(bgColor);
            if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor(bgColor);
        } catch (e) { }
    }
}

applyTheme();
if (typeof tg.onEvent === 'function') {
    tg.onEvent('themeChanged', applyTheme);
}
if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', applyTheme);
    }
}

try {
    if (typeof tg.expand === 'function') tg.expand();
    if (typeof tg.ready === 'function') tg.ready();
} catch (e) { }

document.addEventListener('click', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

// ============================================
// 3. TOP-LAYER NATIVE <dialog> HELPERS
// ============================================
let appState = 'editing';
let previewOpen = false;
let submitInProgress = false;

function supportsTopLayerAnimation() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return false;
    }
    return Boolean(
        typeof CSS !== 'undefined' &&
        typeof CSS.supports === 'function' &&
        CSS.supports('transition-behavior', 'allow-discrete') &&
        CSS.supports('overlay', 'auto')
    );
}

function finishDialogClose(dialog) {
    if (!dialog) return;
    delete dialog.dataset.closing;
    if (dialog.open) {
        dialog.close();
    }
}

function openDialog(dialog) {
    if (!dialog) return;
    delete dialog.dataset.closing;
    if (supportsTopLayerAnimation()) {
        dialog.classList.add('is-animating-top-layer');
    } else {
        dialog.classList.remove('is-animating-top-layer');
    }
    if (!dialog.open) {
        dialog.showModal();
    }
}

function closeDialog(dialog) {
    if (!dialog || !dialog.open) return;

    if (!dialog.classList.contains('is-animating-top-layer')) {
        finishDialogClose(dialog);
        return;
    }

    if (dialog.dataset.closing === '1') return;
    dialog.dataset.closing = '1';

    let finished = false;
    const done = () => {
        if (finished) return;
        finished = true;
        finishDialogClose(dialog);
    };

    dialog.addEventListener('transitionend', (evt) => {
        if (evt.target === dialog) done();
    }, { once: true });

    window.setTimeout(done, 260);
}

function setupDialogDismissHandlers() {
    document.querySelectorAll('dialog.app-dialog').forEach((dialog) => {
        let pointerDownOnBackdrop = false;

        dialog.addEventListener('pointerdown', (e) => {
            pointerDownOnBackdrop = (e.target === dialog);
        });

        dialog.addEventListener('pointerup', (e) => {
            const shouldClose = pointerDownOnBackdrop && e.target === dialog;
            pointerDownOnBackdrop = false;
            if (!shouldClose) return;

            if (dialog.id === 'previewModal') closePreview();
            else if (dialog.id === 'lightboxModal') closeLightbox();
            else if (dialog.id === 'quizModal') closeQuiz();
            else if (dialog.id === 'motivationModal') closeMotivation();
            else if (dialog.id === 'guideModal') closeGuide();
            else closeDialog(dialog);
        });

        dialog.addEventListener('close', () => {
            delete dialog.dataset.closing;
            if (dialog.id === 'previewModal') {
                appState = 'editing';
                previewOpen = false;
                updateMainButton();
            }
        });
    });
}

function showUserGuide() {
    haptic('light');
    openDialog(document.getElementById('guideModal'));
}

function closeGuide() {
    haptic('light');
    closeDialog(document.getElementById('guideModal'));
}

function showMotivation() {
    haptic('light');
    openDialog(document.getElementById('motivationModal'));
}

function closeMotivation() {
    haptic('light');
    closeDialog(document.getElementById('motivationModal'));
}

function openLightbox(src) {
    if (!src) return;
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImage');
    if (!modal || !img) return;
    img.src = src;
    openDialog(modal);
    haptic('light');
}

function closeLightbox() {
    const modal = document.getElementById('lightboxModal');
    if (!modal) return;
    closeDialog(modal);
}

// ============================================
// 4. QUIZ MODULE
// ============================================
let quizQuestions = [];
let quizState = null;

const QUIZ_FACTS = [
    'Самые ценные предметы обычно сопровождаются чёткой историей происхождения.',
    'Бережная чистка ценится выше агрессивной полировки.',
    'Наличие клейм и маркировок повышает доверие к предмету.',
    'Фотография при дневном освещении лучше всего передаёт детали и фактуру.',
    'Указание точных размеров помогает эксперту быстрее оценить лот.'
];

function getQuizRegion() {
    const regionSelect = document.getElementById('region');
    const current = regionSelect ? regionSelect.value.trim() : '';
    if (current) {
        try { localStorage.setItem('last_region', current); } catch (e) { }
        return current;
    }
    try { return localStorage.getItem('last_region') || ''; } catch (e) { return ''; }
}

function getQuizUserMeta() {
    const user = (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : {};
    const nameParts = [user.first_name, user.last_name].filter(Boolean);
    return {
        user_id: user.id || null,
        username: user.username || null,
        full_name: nameParts.join(' ') || null
    };
}

function sendQuizStats(payload) {
    const cleanBase = getCleanBotUrl();
    if (!cleanBase) return;
    fetch(`${cleanBase}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
    }).catch(() => { });
}

function reportQuizAttempt() {
    if (!quizState || quizState.reported) return;
    quizState.reported = true;
    const total = quizState.questions ? quizState.questions.length : QUIZ_SIZE;
    const userMeta = getQuizUserMeta();
    sendQuizStats({
        ...userMeta,
        region: getQuizRegion(),
        correct: quizState.score || 0,
        total,
        finished_at: new Date().toISOString(),
        source: isInTelegram ? 'telegram_webapp' : 'browser'
    });
}

async function loadQuizQuestions() {
    if (quizQuestions.length > 0) return quizQuestions;
    const response = await fetch(`quiz_questions.json?v=${QUIZ_VERSION}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Quiz fetch failed');
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Quiz data empty');
    quizQuestions = data;
    return quizQuestions;
}

function shuffleArray(source) {
    const copy = source.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function openQuiz() {
    haptic('light');
    const modal = document.getElementById('quizModal');
    const body = document.getElementById('quizBody');
    if (!modal || !body) return;

    openDialog(modal);
    body.innerHTML = '<div class="quiz-progress">⏱ 1 минута • Загрузка вопросов...</div>';

    try {
        await loadQuizQuestions();
        startQuiz();
    } catch (e) {
        body.innerHTML = `
            <div class="quiz-result">Не удалось загрузить викторину. Попробуйте позже.</div>
            <div class="quiz-footer">
                <button type="button" class="btn btn-secondary" onclick="closeQuiz()">Закрыть</button>
            </div>
        `;
    }
}

function closeQuiz() {
    const modal = document.getElementById('quizModal');
    if (!modal) return;
    if (quizState && quizState.answers && quizState.answers.length > 0 && !quizState.reported) {
        reportQuizAttempt();
    }
    closeDialog(modal);
}

function startQuiz() {
    const pool = shuffleArray(quizQuestions);
    const chosen = pool.slice(0, Math.min(QUIZ_SIZE, pool.length));
    quizState = {
        questions: chosen,
        current: 0,
        score: 0,
        answered: false,
        reported: false,
        answers: []
    };
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const body = document.getElementById('quizBody');
    if (!body || !quizState) return;
    const q = quizState.questions[quizState.current];
    const optionsHtml = q.options.map((opt, idx) =>
        `<button type="button" class="quiz-option" onclick="selectQuizOption(${idx})">${escapeHtml(opt)}</button>`
    ).join('');

    body.innerHTML = `
        <div class="quiz-progress">⏱ 1 минута • Вопрос ${quizState.current + 1} из ${quizState.questions.length}</div>
        <div class="quiz-question">${escapeHtml(q.question)}</div>
        <div class="quiz-options">${optionsHtml}</div>
        <div class="quiz-footer" id="quizNext" hidden>
            <button type="button" class="btn btn-primary" onclick="goToNextQuestion()" id="quizNextBtn">Дальше</button>
            <button type="button" class="btn btn-secondary" onclick="closeQuiz()">Отмена</button>
        </div>
    `;
}

function selectQuizOption(index) {
    if (!quizState || quizState.answered) return;
    quizState.answered = true;
    const q = quizState.questions[quizState.current];
    const buttons = document.querySelectorAll('#quizBody .quiz-option');
    buttons.forEach((btn, idx) => {
        btn.disabled = true;
        if (idx === q.answerIndex) btn.classList.add('correct');
        if (idx === index && idx !== q.answerIndex) btn.classList.add('wrong');
    });

    const isCorrect = index === q.answerIndex;
    if (isCorrect) quizState.score += 1;
    quizState.answers.push({ index, isCorrect });
    haptic(isCorrect ? 'success' : 'error');

    const body = document.getElementById('quizBody');
    const feedback = document.createElement('div');
    feedback.className = 'quiz-feedback';
    feedback.innerHTML = `${isCorrect ? '✅ Верно!' : '❌ Неверно.'} ${escapeHtml(q.explanation || '')}`;
    const nextFooter = document.getElementById('quizNext');
    if (nextFooter) {
        body.insertBefore(feedback, nextFooter);
        nextFooter.hidden = false;
        const nextBtn = document.getElementById('quizNextBtn');
        if (nextBtn) {
            nextBtn.textContent = (quizState.current + 1 >= quizState.questions.length) ? 'Результат' : 'Дальше';
        }
    }
}

function goToNextQuestion() {
    if (!quizState) return;
    if (quizState.current + 1 < quizState.questions.length) {
        quizState.current += 1;
        quizState.answered = false;
        renderQuizQuestion();
    } else {
        showQuizResult();
    }
}

function showQuizResult() {
    const body = document.getElementById('quizBody');
    if (!body || !quizState) return;
    reportQuizAttempt();
    const total = quizState.questions.length;
    const score = quizState.score;
    const fact = QUIZ_FACTS[Math.floor(Math.random() * QUIZ_FACTS.length)];

    body.innerHTML = `
        <div class="quiz-result">
            <strong>Ваш результат: ${score} из ${total}</strong>
        </div>
        ${fact ? `<div class="quiz-fact">💡 ${escapeHtml(fact)}</div>` : ''}
        <div class="quiz-footer">
            <button type="button" class="btn btn-primary" onclick="startQuiz()">Сыграть ещё раз</button>
            <button type="button" class="btn btn-secondary" onclick="closeQuiz()">Закрыть</button>
        </div>
    `;
}

// ============================================
// 5. ITEM CARDS, CLEAVE, DRAG-DROP & SWIPE
// ============================================
let itemCount = 0;
let dragSrcCard = null;

function createCardHtml(idx) {
    return `
        <div class="swipe-delete-indicator" aria-hidden="true">Удалить</div>
        <div class="item-header">
            <span class="drag-handle" aria-hidden="true" title="Перетащить для сортировки">⋮⋮</span>
            <button type="button" class="item-header-toggle" onclick="toggleItem(this)"
                aria-expanded="true" aria-controls="item-body-${idx}">
                <span class="item-number">#${idx}</span>
                <span class="item-summary">Новый предмет</span>
                <span class="collapse-chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                        stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </span>
            </button>
        </div>
        <div class="item-body" id="item-body-${idx}">
            <div class="form-group">
                <label class="field-label" for="desc-${idx}">
                    Описание предмета <span class="required" aria-hidden="true">*</span>
                </label>
                <div class="input-wrapper textarea-wrapper">
                    <textarea id="desc-${idx}" class="desc item-field" rows="2"
                        placeholder="Например: Икона Николай Чудотворец, XIX век, дерево, темпера, 27×22 см"
                        required aria-invalid="false"
                        data-hint="hint-desc-${idx}" data-error="err-desc-${idx}"
                        aria-describedby="hint-desc-${idx}"></textarea>
                    <button type="button" class="mic-btn"
                        onclick="startSpeechRecognition(this, 'desc-${idx}')"
                        aria-label="Голосовой ввод описания" title="Голосовой ввод">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    </button>
                </div>
                <span class="field-hint" id="hint-desc-${idx}">Наименование, материал, период, клейма или дефекты</span>
                <span class="error-message" id="err-desc-${idx}" hidden></span>
            </div>

            <div class="form-group">
                <label class="field-label" for="eval-${idx}">
                    Оценка <span class="required" aria-hidden="true">*</span>
                </label>
                <div class="input-wrapper has-suffix">
                    <input type="text" id="eval-${idx}" class="eval item-field" inputmode="numeric"
                        placeholder="Например: 15 000" required aria-invalid="false"
                        data-hint="hint-eval-${idx}" data-error="err-eval-${idx}"
                        aria-describedby="hint-eval-${idx}">
                    <span class="input-suffix" aria-hidden="true">₽</span>
                </div>
                <span class="field-hint" id="hint-eval-${idx}">Сумма оценки в рублях</span>
                <span class="error-message" id="err-eval-${idx}" hidden></span>
            </div>

            <div class="form-group">
                <span class="field-label">Фотография предмета <span class="required" aria-hidden="true">*</span></span>
                <div class="photo-upload-container" id="photo-box-${idx}">
                    <input type="file" accept="image/*" class="file-input sr-only" id="file-${idx}"
                        onchange="handleFileSelect(this)" aria-label="Выбрать фото предмета ${idx}">
                    <div class="photo-preview" id="preview-${idx}"
                        role="button" tabindex="0"
                        aria-label="Добавить фото предмета ${idx}"
                        aria-describedby="status-photo-${idx}"
                        onclick="triggerFileInput(this)"
                        onkeydown="handlePreviewKeydown(event, this)"
                        ondragover="handleDragOver(event)"
                        ondragleave="handleDragLeave(event)"
                        ondrop="handleDrop(event, this.parentElement)">
                        <div class="skeleton-loader" hidden></div>
                        <div class="upload-label">
                            <div class="upload-icon-circle" aria-hidden="true">📷</div>
                            <span class="btn-text">Добавить фото</span>
                            <span class="hint">Нажмите, перетащите или вставьте (Ctrl+V)</span>
                        </div>
                        <div class="photo-actions">
                            <button type="button" class="photo-action-btn"
                                onclick="handleReplacePhoto(this, event)">Заменить</button>
                            <button type="button" class="photo-action-btn danger"
                                onclick="handleRemovePhoto(this, event)">Удалить</button>
                        </div>
                        <div class="upload-progress">
                            <div class="upload-progress-bar"></div>
                        </div>
                    </div>
                    <div class="upload-status" id="status-photo-${idx}">Добавьте одно фото предмета</div>
                    <span class="error-message" id="err-photo-${idx}" hidden></span>
                </div>
            </div>
        </div>
    `;
}

function handlePreviewKeydown(event, previewEl) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        triggerFileInput(previewEl);
    }
}

function triggerFileInput(previewEl) {
    if (!previewEl) return;
    if (previewEl.classList.contains('has-photo')) {
        const img = previewEl.querySelector('.photo-preview-img');
        if (img && img.src) openLightbox(img.src);
        return;
    }
    const container = previewEl.closest('.photo-upload-container');
    const fileInput = container ? container.querySelector('.file-input') : null;
    if (fileInput) fileInput.click();
}

function addItem(scrollToNew = true) {
    itemCount += 1;
    const list = document.getElementById('itemsList');
    if (!list) return null;

    const card = document.createElement('article');
    card.className = 'item-card';
    card.id = `item-${itemCount}`;
    card.innerHTML = createCardHtml(itemCount);

    list.appendChild(card);

    const evalInput = card.querySelector('.eval');
    const descInput = card.querySelector('.desc');

    if (typeof window.Cleave === 'function' && evalInput) {
        new window.Cleave(evalInput, {
            numeral: true,
            numeralThousandsGroupStyle: 'thousand',
            delimiter: ' ',
            numeralDecimalScale: 0,
            numeralPositiveOnly: true
        });
    }

    if (evalInput) {
        evalInput.addEventListener('input', () => {
            updateTotal();
            updateItemSummary(card);
        });
        evalInput.addEventListener('change', () => updateItemSummary(card));
        if (window.UX) window.UX.bindFieldValidation(evalInput);
    }

    if (descInput) {
        descInput.addEventListener('input', () => {
            updateItemSummary(card);
        });
        if (window.UX) window.UX.bindFieldValidation(descInput);
    }

    initDragAndDrop(card);
    initTouchSwipe(card);
    renumberItems();
    updateTotal();
    updateFormCompletion();

    if (scrollToNew && itemCount > 1) {
        haptic('light');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return card;
}

function removeItem(btn, event) {
    if (event) event.stopPropagation();
    const cards = document.querySelectorAll('.item-card');
    if (cards.length <= 1) {
        showAppAlert('Должен остаться хотя бы один предмет.');
        return;
    }
    const card = btn.closest('.item-card');
    if (card) {
        card.remove();
        renumberItems();
        updateTotal();
        updateFormCompletion();
        saveFormData();
        haptic('medium');
    }
}

function renumberItems() {
    const cards = document.querySelectorAll('.item-card');
    cards.forEach((card, index) => {
        const number = index + 1;
        const badge = card.querySelector('.item-number');
        if (badge) badge.textContent = `#${number}`;

        const header = card.querySelector('.item-header');
        if (!header) return;

        let removeBtn = header.querySelector('.btn-remove');
        if (cards.length > 1) {
            if (!removeBtn) {
                removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'btn-remove';
                removeBtn.setAttribute('aria-label', `Удалить предмет ${number}`);
                removeBtn.setAttribute('title', 'Удалить предмет');
                removeBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                        stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                    </svg>
                `;
                removeBtn.onclick = function (e) { removeItem(this, e); };
                header.appendChild(removeBtn);
            } else {
                removeBtn.setAttribute('aria-label', `Удалить предмет ${number}`);
            }
        } else if (removeBtn) {
            removeBtn.remove();
        }
    });
    updateBadge();
}

function updateItemSummary(card) {
    if (!card) return;
    const desc = (card.querySelector('.desc')?.value || '').trim();
    const evalVal = cleanNumber(card.querySelector('.eval')?.value);
    const summaryEl = card.querySelector('.item-summary');
    if (!summaryEl) return;

    if (!desc && !evalVal) {
        summaryEl.textContent = 'Новый предмет';
        return;
    }
    const shortDesc = desc.length > 26 ? `${desc.slice(0, 26)}…` : (desc || 'Без описания');
    const evalText = evalVal > 0 ? ` • ${formatNumber(evalVal)} ₽` : '';
    summaryEl.textContent = `${shortDesc}${evalText}`;
}

function toggleItem(trigger) {
    const card = trigger.closest('.item-card');
    if (!card) return;
    const collapsed = card.classList.toggle('collapsed');
    const toggleBtn = card.querySelector('.item-header-toggle');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
    updateItemSummary(card);
    haptic('light');
}

function updateBadge() {
    const count = document.querySelectorAll('.item-card').length;
    const badge = document.getElementById('itemCountBadge');
    if (badge) badge.textContent = String(count);
}

function updateTotal() {
    const cards = document.querySelectorAll('.item-card');
    let total = 0;
    let photoCount = 0;

    cards.forEach((card) => {
        total += cleanNumber(card.querySelector('.eval')?.value);
        const container = card.querySelector('.photo-upload-container');
        if (container && container.dataset.photoUrl) {
            photoCount += 1;
        }
    });

    const totalEl = document.getElementById('totalAmountDisplay');
    const metaEl = document.getElementById('totalItemsMeta');
    if (totalEl) totalEl.textContent = `${formatNumber(total)} ₽`;
    if (metaEl) metaEl.textContent = `${cards.length} ${pluralizeItems(cards.length)} • ${photoCount} фото`;
}

function pluralizeItems(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'предмет';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'предмета';
    return 'предметов';
}

function initDragAndDrop(card) {
    const handle = card.querySelector('.drag-handle');
    if (!handle) return;

    handle.addEventListener('pointerdown', () => {
        card.setAttribute('draggable', 'true');
    });

    card.addEventListener('dragstart', (e) => {
        dragSrcCard = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.id);
        haptic('medium');
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        card.removeAttribute('draggable');
        document.querySelectorAll('.item-card.drag-over').forEach((c) => c.classList.remove('drag-over'));
        dragSrcCard = null;
    });

    card.addEventListener('dragover', (e) => {
        if (!dragSrcCard || dragSrcCard === card) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!card.classList.contains('drag-over')) {
            haptic('light');
        }
        card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
        if (!dragSrcCard || dragSrcCard === card) return;
        e.preventDefault();
        card.classList.remove('drag-over');
        const list = document.getElementById('itemsList');
        const cards = Array.from(list.children);
        const fromIdx = cards.indexOf(dragSrcCard);
        const toIdx = cards.indexOf(card);
        if (fromIdx < toIdx) {
            list.insertBefore(dragSrcCard, card.nextSibling);
        } else {
            list.insertBefore(dragSrcCard, card);
        }
        renumberItems();
        haptic('success');
        saveFormData();
    });
}

function initTouchSwipe(card) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let swiping = false;
    const header = card.querySelector('.item-header');
    const indicator = card.querySelector('.swipe-delete-indicator');
    if (!header || !indicator) return;

    header.addEventListener('touchstart', (e) => {
        if (e.target.closest('button') || e.target.closest('.drag-handle')) return;
        if (document.querySelectorAll('.item-card').length <= 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = 0;
        swiping = false;
    }, { passive: true });

    header.addEventListener('touchmove', (e) => {
        if (!startX) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (Math.abs(dy) > Math.abs(dx) + 8) {
            startX = 0;
            return;
        }
        if (dx < -18) {
            swiping = true;
            currentX = Math.max(dx, -110);
            card.style.transform = `translateX(${currentX}px)`;
            indicator.style.display = 'flex';
        }
    }, { passive: true });

    header.addEventListener('touchend', () => {
        if (swiping && currentX <= -85 && document.querySelectorAll('.item-card').length > 1) {
            const btn = card.querySelector('.btn-remove');
            if (btn) removeItem(btn);
        }
        card.style.transform = '';
        indicator.style.display = 'none';
        startX = 0;
        currentX = 0;
        swiping = false;
    });
}

// ============================================
// 6. PHOTO UPLOAD, PASTE & DICTATION
// ============================================
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e, container) {
    e.preventDefault();
    e.stopPropagation();
    const preview = container.querySelector('.photo-preview');
    if (preview) preview.classList.remove('dragover');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
        const fileInput = container.querySelector('.file-input');
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        fileInput.files = dt.files;
        handleFileSelect(fileInput);
    }
}

function setUploadProgress(previewContainer, percent) {
    const progressEl = previewContainer.querySelector('.upload-progress');
    const barEl = previewContainer.querySelector('.upload-progress-bar');
    if (!progressEl || !barEl) return;

    if (percent === null || typeof percent === 'undefined') {
        progressEl.classList.remove('active', 'indeterminate');
        barEl.style.width = '0%';
        return;
    }
    progressEl.classList.add('active');
    if (percent < 0) {
        progressEl.classList.add('indeterminate');
        barEl.style.width = '';
    } else {
        progressEl.classList.remove('indeterminate');
        barEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
}

function handleReplacePhoto(button, event) {
    if (event) event.stopPropagation();
    const container = button.closest('.photo-upload-container');
    const input = container ? container.querySelector('.file-input') : null;
    if (input) input.click();
}

function handleRemovePhoto(button, event) {
    if (event) event.stopPropagation();
    const container = button.closest('.photo-upload-container');
    if (!container) return;
    resetPhotoContainer(container);
    updateTotal();
    updateFormCompletion();
    saveFormData();
    haptic('light');
}

function resetPhotoContainer(container) {
    const preview = container.querySelector('.photo-preview');
    const status = container.querySelector('.upload-status');
    const btnText = container.querySelector('.btn-text');
    const input = container.querySelector('.file-input');
    const card = container.closest('.item-card');
    const cardIdx = card ? card.id.replace('item-', '') : '1';
    const errEl = document.getElementById(`err-photo-${cardIdx}`) || container.querySelector('.error-message');

    if (input) input.value = '';
    delete container.dataset.photoUrl;

    if (preview) {
        preview.classList.remove('has-photo', 'loading', 'photo-invalid');
        const img = preview.querySelector('.photo-preview-img');
        if (img) img.remove();
        const skeleton = preview.querySelector('.skeleton-loader');
        if (skeleton) skeleton.hidden = true;
        setUploadProgress(preview, null);
    }

    if (btnText) btnText.textContent = 'Добавить фото';
    if (status) {
        status.textContent = 'Добавьте одно фото предмета';
        status.className = 'upload-status';
    }
    if (errEl) {
        errEl.textContent = '';
        errEl.hidden = true;
    }
}

async function handleFileSelect(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    const container = input.closest('.photo-upload-container');
    const previewContainer = container.querySelector('.photo-preview');
    const status = container.querySelector('.upload-status');
    const btnText = previewContainer.querySelector('.btn-text');
    const skeleton = previewContainer.querySelector('.skeleton-loader');
    const card = container.closest('.item-card');
    const cardIdx = card ? card.id.replace('item-', '') : '1';
    const errEl = document.getElementById(`err-photo-${cardIdx}`);

    previewContainer.classList.remove('photo-invalid');
    if (errEl) {
        errEl.textContent = '';
        errEl.hidden = true;
    }

    previewContainer.classList.add('loading');
    if (skeleton) skeleton.hidden = false;

    const compressionAvailable = typeof window.imageCompression === 'function';
    if (btnText) btnText.textContent = compressionAvailable ? 'Сжатие...' : 'Подготовка...';
    if (status) {
        status.textContent = '⏳ Обработка фото...';
        status.className = 'upload-status';
    }
    delete container.dataset.photoUrl;
    setUploadProgress(previewContainer, -1);

    try {
        const compressedFile = compressionAvailable
            ? await window.imageCompression(file, {
                maxSizeMB: 1,
                maxWidthOrHeight: 1280,
                useWebWorker: true,
                fileType: 'image/jpeg'
            })
            : file;

        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsDataURL(compressedFile);
        });

        let img = previewContainer.querySelector('.photo-preview-img');
        if (!img) {
            img = document.createElement('img');
            img.className = 'photo-preview-img';
            img.alt = 'Превью предмета';
            previewContainer.appendChild(img);
        }
        img.src = dataUrl;
        img.onclick = (evt) => {
            evt.stopPropagation();
            openLightbox(dataUrl);
        };

        if (skeleton) skeleton.hidden = true;
        previewContainer.classList.add('has-photo');

        if (btnText) btnText.textContent = 'Загрузка...';
        if (status) status.textContent = '⏳ Загрузка: 0%';
        setUploadProgress(previewContainer, 0);

        const uploadedUrl = await uploadImageToBot(compressedFile, (percent) => {
            const safePercent = Math.max(0, Math.min(100, percent));
            setUploadProgress(previewContainer, safePercent);
            if (status && safePercent > 0 && safePercent < 100) {
                status.textContent = `⏳ Загрузка: ${safePercent}%`;
            }
        });

        container.dataset.photoUrl = uploadedUrl;
        previewContainer.classList.remove('loading');
        setUploadProgress(previewContainer, 100);
        window.setTimeout(() => setUploadProgress(previewContainer, null), 600);

        if (btnText) btnText.textContent = '✓ Загружено';
        if (status) {
            status.textContent = '✅ Готово к отправке';
            status.className = 'upload-status success';
        }

        haptic('success', { sound: true, vibrate: true });
        updateTotal();
        updateFormCompletion();
        saveFormData();
    } catch (error) {
        console.error('Upload failed:', error);
        if (skeleton) skeleton.hidden = true;
        previewContainer.classList.remove('loading');
        resetPhotoContainer(container);
        if (status) status.textContent = `⚠ ${error.message || 'Ошибка загрузки фото'}`;
        if (errEl) {
            errEl.textContent = error.message || 'Не удалось загрузить фото';
            errEl.hidden = false;
        }
        haptic('error', { sound: true });
        updateTotal();
        updateFormCompletion();
    }
}

async function uploadImageToBot(file, onProgress) {
    const cleanBase = getCleanBotUrl();
    if (!cleanBase) {
        return uploadWithRetry(() => uploadImageToImageBan(file, onProgress));
    }

    const uploadUrl = `${cleanBase}/api/upload-photo`;
    const formData = new FormData();
    formData.append('photo', file, 'photo.jpg');

    const headers = {};
    if (tg.initData) headers['X-Telegram-Init-Data'] = tg.initData;

    try {
        const result = await uploadWithRetry(() => uploadWithProgress(uploadUrl, formData, headers, onProgress));
        if (!result || !result.url) throw new Error('Сервер не вернул ссылку на фото');
        return result.url;
    } catch (botErr) {
        console.warn('Bot upload fallback to ImageBan:', botErr);
        return uploadWithRetry(() => uploadImageToImageBan(file, onProgress));
    }
}

async function uploadImageToImageBan(file, onProgress) {
    if (!imagebanClientId) {
        throw new Error('Не настроен ключ загрузки фото');
    }
    const formData = new FormData();
    formData.append('image', file, 'photo.jpg');
    const result = await uploadWithProgress(
        'https://api.imageban.ru/v1',
        formData,
        { Authorization: `TOKEN ${imagebanClientId}` },
        onProgress
    );
    if (!result || !result.success || !result.data || !result.data.link) {
        throw new Error('Ошибка фотохостинга ImageBan');
    }
    return result.data.link;
}

function shouldRetryUpload(error) {
    const msg = String((error && error.message) || '').toLowerCase();
    return msg.includes('сеть') || msg.includes('таймаут') || msg.includes('502') || msg.includes('503') || msg.includes('504');
}

async function uploadWithRetry(fn, retries = 1) {
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt >= retries || !shouldRetryUpload(err)) break;
            await new Promise((r) => setTimeout(r, 700));
        }
    }
    throw lastErr;
}

function uploadWithProgress(url, formData, headers, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.timeout = 45000;
        xhr.open('POST', url, true);
        if (headers) {
            Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        }
        if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            };
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText || '{}'));
                } catch (err) {
                    reject(new Error('Некорректный ответ сервера'));
                }
            } else {
                reject(new Error(`Ошибка сервера (${xhr.status})`));
            }
        };
        xhr.onerror = () => reject(new Error('Ошибка сети при загрузке фото'));
        xhr.ontimeout = () => reject(new Error('Таймаут загрузки фото'));
        xhr.send(formData);
    });
}

// Clipboard image paste (Ctrl+V / Cmd+V) into first empty photo slot or focused card
document.addEventListener('paste', (e) => {
    const clipboardItems = e.clipboardData && e.clipboardData.items;
    if (!clipboardItems) return;

    let imageFile = null;
    for (const item of clipboardItems) {
        if (item.type && item.type.startsWith('image/')) {
            imageFile = item.getAsFile();
            break;
        }
    }
    if (!imageFile) return;

    const activeCard = document.activeElement ? document.activeElement.closest('.item-card') : null;
    let targetContainer = activeCard ? activeCard.querySelector('.photo-upload-container') : null;

    if (!targetContainer || targetContainer.dataset.photoUrl) {
        targetContainer = Array.from(document.querySelectorAll('.photo-upload-container'))
            .find((c) => !c.dataset.photoUrl) || document.querySelector('.photo-upload-container');
    }
    if (!targetContainer) return;

    const input = targetContainer.querySelector('.file-input');
    if (input) {
        const dt = new DataTransfer();
        dt.items.add(imageFile);
        input.files = dt.files;
        handleFileSelect(input);
    }
});

// Voice Dictation
function startSpeechRecognition(btn, inputId) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showAppAlert('Голосовой ввод не поддерживается вашим браузером.');
        return;
    }
    const field = document.getElementById(inputId);
    if (!field) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    btn.classList.add('recording');
    haptic('light');

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        field.value = field.value ? `${field.value.trim()} ${transcript}` : transcript;
        field.dataset.touched = '1';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        haptic('success');
    };

    recognition.onerror = () => {
        btn.classList.remove('recording');
        haptic('error');
    };

    recognition.onend = () => {
        btn.classList.remove('recording');
    };

    recognition.start();
}

// ============================================
// 7. VALIDATION, COMPLETION BAR & MAINBUTTON
// ============================================
function updateMainButton() {
    const isTg = isTelegramWebAppRuntime();
    const stickyFooter = document.getElementById('stickyFooter');
    const mainButton = tg.MainButton;

    if (isTg) {
        document.body.classList.add('in-telegram');
        if (stickyFooter) stickyFooter.style.display = 'none';
        if (mainButton) {
            mainButton.setText(appState === 'preview' ? 'ПОДТВЕРДИТЬ И ОТПРАВИТЬ' : 'ПРОВЕРИТЬ И ОТПРАВИТЬ');
            mainButton.show();
            mainButton.enable();
            mainButton.offClick(handleMainButton);
            mainButton.onClick(handleMainButton);
        }
    } else {
        document.body.classList.remove('in-telegram');
        if (stickyFooter) stickyFooter.style.display = '';
        if (mainButton) mainButton.hide();
    }
}

function handleMainButton() {
    if (appState === 'preview') submitForm();
    else showPreview();
}

function updateFormCompletion() {
    const ux = window.UX;
    if (!ux) return;

    const deptOk = ux.cleanDigits(document.getElementById('department')?.value).length >= 1;
    const issueOk = ux.cleanDigits(document.getElementById('issue')?.value).length >= 1;
    const ticketOk = ux.cleanDigits(document.getElementById('ticket')?.value).length === 11;
    const dateVal = document.getElementById('date')?.value || '';
    const dateOk = Boolean(dateVal && dateVal <= ux.getLocalTodayIso());
    const regionOk = Boolean(document.getElementById('region')?.value);

    const cards = Array.from(document.querySelectorAll('.item-card'));
    const itemsOk = cards.length > 0 && cards.every((card) => {
        const desc = (card.querySelector('.desc')?.value || '').trim();
        const evalNum = cleanNumber(card.querySelector('.eval')?.value);
        const photoUrl = card.querySelector('.photo-upload-container')?.dataset.photoUrl;
        return desc.length >= 3 && evalNum > 0 && Boolean(photoUrl);
    });

    const completed = [deptOk, issueOk, ticketOk, dateOk, regionOk, itemsOk].filter(Boolean).length;
    const percent = Math.round((completed / 6) * 100);

    const pill = document.getElementById('formCompletionPill');
    const bar = document.getElementById('progressBar');
    const container = document.getElementById('progressContainer');

    if (pill) {
        pill.textContent = `${completed} / 6`;
        pill.classList.toggle('is-complete', completed === 6);
    }
    if (bar) {
        bar.style.width = `${percent}%`;
        bar.classList.toggle('complete', completed === 6);
    }
    if (container) {
        container.setAttribute('aria-valuenow', String(percent));
    }
}

function validateForm() {
    const ux = window.UX;
    const errors = [];
    let firstFocusTarget = null;

    const fields = [
        { id: 'department', label: 'Подразделение' },
        { id: 'issue', label: '№ заключения' },
        { id: 'ticket', label: 'Номер билета' },
        { id: 'date', label: 'Дата заключения' },
        { id: 'region', label: 'Регион' }
    ];

    fields.forEach(({ id, label }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.dataset.touched = '1';
        const res = ux.validateField(el, { force: true });
        if (!res.valid) {
            if (!firstFocusTarget) firstFocusTarget = el;
            errors.push({ summaryLabel: label, message: res.message, focusTarget: el });
        }
    });

    const cards = document.querySelectorAll('.item-card');
    cards.forEach((card, index) => {
        const num = index + 1;
        const cardIdx = card.id.replace('item-', '');
        const descEl = card.querySelector('.desc');
        const evalEl = card.querySelector('.eval');
        const photoBox = card.querySelector('.photo-upload-container');
        const previewEl = card.querySelector('.photo-preview');
        const photoErrEl = document.getElementById(`err-photo-${cardIdx}`);
        let cardHasErr = false;

        if (descEl) {
            descEl.dataset.touched = '1';
            const res = ux.validateField(descEl, { force: true });
            if (!res.valid) {
                cardHasErr = true;
                if (!firstFocusTarget) firstFocusTarget = descEl;
                errors.push({ summaryLabel: `Предмет #${num} (описание)`, message: res.message, focusTarget: descEl });
            }
        }

        if (evalEl) {
            evalEl.dataset.touched = '1';
            const res = ux.validateField(evalEl, { force: true });
            if (!res.valid) {
                cardHasErr = true;
                if (!firstFocusTarget) firstFocusTarget = evalEl;
                errors.push({ summaryLabel: `Предмет #${num} (оценка)`, message: res.message, focusTarget: evalEl });
            }
        }

        if (photoBox && !photoBox.dataset.photoUrl) {
            cardHasErr = true;
            if (previewEl) previewEl.classList.add('photo-invalid');
            const isLoading = previewEl && previewEl.classList.contains('loading');
            const msg = isLoading ? 'Дождитесь завершения загрузки фото' : 'Прикрепите фотографию предмета';
            if (photoErrEl) {
                photoErrEl.textContent = msg;
                photoErrEl.hidden = false;
            }
            if (!firstFocusTarget && previewEl) firstFocusTarget = previewEl;
            errors.push({ summaryLabel: `Предмет #${num} (фото)`, message: msg, focusTarget: previewEl });
        } else if (previewEl) {
            previewEl.classList.remove('photo-invalid');
            if (photoErrEl) {
                photoErrEl.textContent = '';
                photoErrEl.hidden = true;
            }
        }

        if (cardHasErr && card.classList.contains('collapsed')) {
            card.classList.remove('collapsed');
            const toggleBtn = card.querySelector('.item-header-toggle');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
        }
    });

    if (errors.length > 0) {
        ux.renderErrorSummary(errors);
        ux.announceFormError(`Найдены ошибки (${errors.length}): ${errors[0].summaryLabel} — ${errors[0].message}`);
        haptic('error', { sound: true, vibrate: true });

        if (firstFocusTarget) {
            firstFocusTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            window.setTimeout(() => {
                if (typeof firstFocusTarget.focus === 'function') {
                    firstFocusTarget.focus({ preventScroll: true });
                }
            }, 220);
        }
        return false;
    }

    ux.clearErrorSummary();
    return true;
}

// ============================================
// 8. PREVIEW, SUBMIT & OFFLINE SYNC
// ============================================
function collectFormData() {
    const cards = document.querySelectorAll('.item-card');
    const items = [];
    cards.forEach((card) => {
        const description = (card.querySelector('.desc')?.value || '').trim();
        const evaluation = String(cleanNumber(card.querySelector('.eval')?.value));
        const photoUrl = card.querySelector('.photo-upload-container')?.dataset.photoUrl || '';
        items.push({ description, evaluation, photo_url: photoUrl });
    });

    const isTest = document.getElementById('mode-test')?.checked || false;
    const rawDate = document.getElementById('date').value;
    const cleanTicket = window.UX ? window.UX.cleanDigits(document.getElementById('ticket').value) : document.getElementById('ticket').value;

    return {
        department_number: document.getElementById('department').value.trim(),
        issue_number: document.getElementById('issue').value.trim(),
        ticket_number: cleanTicket,
        date: rawDate ? rawDate.split('-').reverse().join('.') : '',
        region: document.getElementById('region').value,
        items,
        is_test: isTest
    };
}

function showPreview() {
    if (!validateForm()) return;

    const previewContent = document.getElementById('previewContent');
    const data = collectFormData();
    const totalSum = data.items.reduce((acc, item) => acc + cleanNumber(item.evaluation), 0);

    const itemsHtml = Array.from(document.querySelectorAll('.item-card')).map((card, i) => {
        const desc = card.querySelector('.desc')?.value.trim() || '';
        const evalNum = cleanNumber(card.querySelector('.eval')?.value);
        const imgSrc = card.querySelector('.photo-preview-img')?.src || card.querySelector('.photo-upload-container')?.dataset.photoUrl || '';

        return `
            <div class="preview-item">
                ${imgSrc ? `<img src="${escapeHtml(imgSrc)}" alt="Предмет ${i + 1}" class="preview-thumb">` : ''}
                <div class="preview-item-copy">
                    <div class="preview-item-title">#${i + 1}. ${escapeHtml(desc)}</div>
                    <div class="preview-item-eval">${formatNumber(evalNum)} ₽</div>
                </div>
            </div>
        `;
    }).join('');

    previewContent.innerHTML = `
        <div class="preview-grid">
            <div class="preview-kv">
                <span class="preview-k">Подразделение</span>
                <span class="preview-v">${escapeHtml(data.department_number)}</span>
            </div>
            <div class="preview-kv">
                <span class="preview-k">№ заключения</span>
                <span class="preview-v">${escapeHtml(data.issue_number)}</span>
            </div>
            <div class="preview-kv full">
                <span class="preview-k">Билет</span>
                <span class="preview-v">${escapeHtml(data.ticket_number)}</span>
            </div>
            <div class="preview-kv">
                <span class="preview-k">Дата</span>
                <span class="preview-v">${escapeHtml(data.date)}</span>
            </div>
            <div class="preview-kv">
                <span class="preview-k">Регион</span>
                <span class="preview-v">${escapeHtml(data.region)}</span>
            </div>
            <div class="preview-kv">
                <span class="preview-k">Режим</span>
                <span class="preview-v">${data.is_test ? '🧪 Черновик' : '📄 Оригинал'}</span>
            </div>
            <div class="preview-kv">
                <span class="preview-k">Итого</span>
                <span class="preview-v">${formatNumber(totalSum)} ₽</span>
            </div>
        </div>
        ${itemsHtml}
    `;

    openDialog(document.getElementById('previewModal'));
    appState = 'preview';
    previewOpen = true;
    updateMainButton();
    haptic('success', { sound: true, vibrate: true });
}

function closePreview() {
    haptic('light');
    closeDialog(document.getElementById('previewModal'));
    appState = 'editing';
    previewOpen = false;
    updateMainButton();
}

async function postReportToBot(data) {
    const cleanBase = getCleanBotUrl();
    if (!cleanBase) {
        throw new Error('Для отправки в браузере откройте ссылку с параметром bot_url.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
        const response = await fetch(`${cleanBase}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: controller.signal
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(text || `Ошибка сервера (${response.status})`);
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const prefix = data.is_test ? 'TEST_' : '';
        a.download = `${prefix}Заключение_${data.ticket_number || 'doc'}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 3000);
    } finally {
        clearTimeout(timer);
    }
}

async function submitForm() {
    if (submitInProgress) return;
    submitInProgress = true;

    const btn = document.getElementById('finalSubmitBtn');
    const resetBtnState = () => {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Подтвердить и отправить';
        }
        if (isTelegramWebAppRuntime() && tg.MainButton) {
            tg.MainButton.hideProgress();
            tg.MainButton.enable();
        }
        submitInProgress = false;
    };

    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Подготовка...';
    }
    if (isTelegramWebAppRuntime() && tg.MainButton) {
        tg.MainButton.showProgress();
        tg.MainButton.disable();
    }

    const data = collectFormData();
    const missingPhoto = data.items.some((item) => !item.photo_url);
    if (missingPhoto) {
        showAppAlert('⚠️ Прикрепите фото к каждому предмету перед отправкой!');
        resetBtnState();
        return;
    }

    try {
        recordRegionUsage(data.region);

        if (isTelegramWebAppRuntime()) {
            if (btn) btn.textContent = 'Отправка в Telegram...';
            tg.sendData(JSON.stringify(data));
            haptic('success', { sound: true, vibrate: true });

            try {
                localStorage.removeItem('formDraft');
            } catch (e) { }

            const ticketEl = document.getElementById('ticket');
            if (ticketEl) {
                ticketEl.value = '';
                if (window.UX) window.UX.updateTicketCounter('');
            }
            closePreview();
            resetBtnState();
            return;
        }

        if (!navigator.onLine) {
            await savePendingReport(data);
            closePreview();
            resetBtnState();
            return;
        }

        if (btn) btn.textContent = '⏳ Создание Word...';
        await postReportToBot(data);

        try {
            localStorage.removeItem('formDraft');
        } catch (e) { }

        haptic('success', { sound: true, vibrate: true });
        closePreview();
        resetBtnState();
    } catch (e) {
        console.error('Submission error:', e);
        haptic('error', { sound: true });
        if (e.name === 'AbortError') {
            showAppPopup('Ошибка: превышено время ожидания (30с). Проверьте подключение к интернету.');
        } else {
            showAppPopup(e.message || 'Не удалось отправить данные.');
        }
        resetBtnState();
    }
}

// ============================================
// 9. OFFLINE QUEUE (IndexedDB) & DRAFTS
// ============================================
function showOfflineBanner(text, isOnline) {
    const banner = document.getElementById('offlineBanner');
    const bannerText = document.getElementById('offlineBannerText');
    if (!banner || !bannerText) return;

    banner.classList.remove('hiding', 'online');
    if (isOnline) banner.classList.add('online');
    bannerText.textContent = text || (isOnline ? 'Подключение восстановлено' : 'Нет подключения');
    banner.hidden = false;

    if (isOnline) {
        window.setTimeout(() => {
            banner.classList.add('hiding');
            window.setTimeout(() => { banner.hidden = true; }, 300);
        }, 3000);
    }
}

function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('ReportsDB', 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pending')) {
                db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function savePendingReport(data) {
    try {
        const db = await openOfflineDB();
        const tx = db.transaction('pending', 'readwrite');
        tx.objectStore('pending').add({ data, timestamp: Date.now() });
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        showOfflineBanner('📦 Сохранено в очередь — отправится при восстановлении сети', false);
        return true;
    } catch (e) {
        return false;
    }
}

window.addEventListener('offline', () => {
    showOfflineBanner('📴 Нет сети — заключение можно сохранить в очередь', false);
});

window.addEventListener('online', async () => {
    showOfflineBanner('🔄 Соединение восстановлено...', true);
    try {
        const db = await openOfflineDB();
        const tx = db.transaction('pending', 'readonly');
        const req = tx.objectStore('pending').getAll();
        const pending = await new Promise((resolve) => {
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
        if (pending.length === 0 || isTelegramWebAppRuntime() || !getCleanBotUrl()) {
            showOfflineBanner('✅ Подключение восстановлено', true);
            return;
        }
        let synced = 0;
        for (const row of pending) {
            try {
                await postReportToBot(row.data);
                const delTx = db.transaction('pending', 'readwrite');
                delTx.objectStore('pending').delete(row.id);
                synced += 1;
            } catch (e) {
                console.warn('Sync row skipped:', e);
            }
        }
        if (synced > 0) {
            showOfflineBanner(`✅ Синхронизировано заключений: ${synced}`, true);
        }
    } catch (e) { }
});

function saveFormData() {
    try {
        const cards = document.querySelectorAll('.item-card');
        const items = [];
        cards.forEach((card) => {
            items.push({
                description: card.querySelector('.desc')?.value || '',
                evaluation: card.querySelector('.eval')?.value || ''
            });
        });
        const draft = {
            department: document.getElementById('department')?.value || '',
            issue: document.getElementById('issue')?.value || '',
            ticket: document.getElementById('ticket')?.value || '',
            date: document.getElementById('date')?.value || '',
            region: document.getElementById('region')?.value || '',
            items,
            savedAt: Date.now()
        };
        localStorage.setItem('formDraft', JSON.stringify(draft));
    } catch (e) { }
}

function discardDraft() {
    try {
        localStorage.removeItem('formDraft');
    } catch (e) { }
    const notice = document.getElementById('draftNotice');
    if (notice) notice.hidden = true;

    const form = document.getElementById('mainForm');
    if (form) form.reset();

    const dateEl = document.getElementById('date');
    if (dateEl && window.UX) {
        const today = window.UX.getLocalTodayIso();
        dateEl.value = today;
        dateEl.max = today;
    }

    const list = document.getElementById('itemsList');
    if (list) {
        list.innerHTML = '';
        itemCount = 0;
        addItem(false);
    }

    if (window.UX) {
        window.UX.clearErrorSummary();
        window.UX.updateTicketCounter('');
    }
    updateTotal();
    updateFormCompletion();
    haptic('light');
}

function restoreDraft() {
    try {
        const raw = localStorage.getItem('formDraft');
        if (!raw) return false;
        const draft = JSON.parse(raw);
        if (!draft || Date.now() - (draft.savedAt || 0) > 86400000) {
            localStorage.removeItem('formDraft');
            return false;
        }
        const hasUseful = Boolean(
            draft.department || draft.issue || draft.ticket ||
            (Array.isArray(draft.items) && draft.items.some((i) => i.description || i.evaluation))
        );
        if (!hasUseful) return false;

        if (draft.department) document.getElementById('department').value = draft.department;
        if (draft.issue) document.getElementById('issue').value = draft.issue;
        if (draft.ticket) document.getElementById('ticket').value = draft.ticket;
        if (draft.date) document.getElementById('date').value = draft.date;
        if (draft.region) document.getElementById('region').value = draft.region;

        if (Array.isArray(draft.items) && draft.items.length > 0) {
            const list = document.getElementById('itemsList');
            list.innerHTML = '';
            itemCount = 0;
            draft.items.forEach((item) => {
                const card = addItem(false);
                if (!card) return;
                const descEl = card.querySelector('.desc');
                const evalEl = card.querySelector('.eval');
                if (descEl && item.description) {
                    descEl.value = item.description;
                    if (window.UX) {
                        window.UX.autoResizeTextarea(descEl);
                        window.UX.checkPreciousMetals(descEl);
                    }
                }
                if (evalEl && item.evaluation) evalEl.value = item.evaluation;
                updateItemSummary(card);
            });
        }

        const notice = document.getElementById('draftNotice');
        if (notice) notice.hidden = false;
        if (window.UX) window.UX.updateTicketCounter(draft.ticket || '');
        return true;
    } catch (e) {
        return false;
    }
}

function recordRegionUsage(region) {
    if (!region) return;
    try {
        localStorage.setItem('last_region', region);
        const history = JSON.parse(localStorage.getItem('region_history') || '{}');
        history[region] = (history[region] || 0) + 1;
        localStorage.setItem('region_history', JSON.stringify(history));
    } catch (e) { }
}

function sortRegionsByFrequency() {
    const select = document.getElementById('region');
    if (!select) return;
    try {
        const history = JSON.parse(localStorage.getItem('region_history') || '{}');
        const options = Array.from(select.querySelectorAll('option')).filter((opt) => opt.value !== '');
        if (options.length === 0) return;

        options.sort((a, b) => {
            const diff = (history[b.value] || 0) - (history[a.value] || 0);
            return diff !== 0 ? diff : a.textContent.localeCompare(b.textContent, 'ru');
        });
        options.forEach((opt) => select.appendChild(opt));
    } catch (e) { }
}

// ============================================
// 10. SERVICE WORKER & INITIALIZATION
// ============================================
async function forceUpdate() {
    haptic('medium');
    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
        }
    } catch (e) { }
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('v', APP_BUILD_ID);
    window.location.replace(nextUrl.toString());
}

if ('serviceWorker' in navigator) {
    const swDir = window.location.pathname.replace(/[^/]*$/, '');
    const swUrl = `${swDir}service-worker.js?v=${APP_BUILD_ID}`;
    navigator.serviceWorker.register(swUrl).catch(() => { });
}

document.addEventListener('DOMContentLoaded', () => {
    setupDialogDismissHandlers();
    sortRegionsByFrequency();

    const dateInput = document.getElementById('date');
    const todayIso = window.UX ? window.UX.getLocalTodayIso() : new Date().toISOString().slice(0, 10);
    if (dateInput) {
        if (!dateInput.value) dateInput.value = todayIso;
        dateInput.max = todayIso;
    }

    const restored = restoreDraft();
    if (!restored) {
        addItem(false);
        const regionSelect = document.getElementById('region');
        try {
            const savedRegion = localStorage.getItem('last_region') || localStorage.getItem('default_region');
            if (regionSelect && savedRegion) regionSelect.value = savedRegion;
            const deptEl = document.getElementById('department');
            const savedDept = localStorage.getItem('last_department') || localStorage.getItem('default_department');
            if (deptEl && !deptEl.value && savedDept) deptEl.value = savedDept;
        } catch (e) { }
    }

    const formEl = document.getElementById('mainForm');
    if (formEl) {
        formEl.addEventListener('input', () => {
            saveFormData();
            updateFormCompletion();
        });
        formEl.addEventListener('change', () => {
            saveFormData();
            updateFormCompletion();
        });
    }

    if (!navigator.onLine) {
        showOfflineBanner('📴 Нет подключения — данные будут сохранены', false);
    }

    updateTotal();
    updateFormCompletion();
    updateMainButton();
});
