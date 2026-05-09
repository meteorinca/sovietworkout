/* ===================================================================
   Iron Soviet – app.js
   Soviet-inspired daily strength & nutrition tracker.
   Static site, localStorage only. GitHub Pages compatible.
   =================================================================== */

// ─── Program Data (Populated via program.md) ──────────────────────
const EXERCISES = [];
const DAY_CONFIG = {};
const TRAINING_DAYS = [];
const FOOD_ITEMS = [];
const REST_ITEMS = [];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── State ────────────────────────────────────────────────────────
const STORAGE_KEY = 'ironSoviet_v2';
let state = loadState();

function defaultState() {
    return {
        selectedDay: todayDayIndex(),
        bodyweight: '',
        exerciseChecks: {},   // "YYYY-MM-DD_dayIndex": { exerciseId: true }
        foodChecks: {},       // "YYYY-MM-DD": { foodId: true }
        restChecks: {},       // "YYYY-MM-DD": { restId: true }
        progression: {},      // exerciseId: { flagged, dayType, weight, date }
        workoutLog: {}        // "YYYY-MM-DD": { exerciseId: { sets: [{weight, reps}] } }
    };
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return { ...defaultState(), ...parsed };
        }
    } catch (e) { /* corrupted — start fresh */ }
    return defaultState();
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Helpers ──────────────────────────────────────────────────────
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayDayIndex() {
    const dow = new Date().getDay(); // 0=Sun
    return dow === 0 ? 6 : dow - 1;  // convert to 0=Mon
}

function isTrainingDay(dayIndex) {
    return TRAINING_DAYS.includes(dayIndex);
}

function getDayConfig(dayIndex) {
    return DAY_CONFIG[dayIndex] || null;
}

// ─── Markdown Parser ──────────────────────────────────────────────
async function loadProgram() {
    try {
        const response = await fetch('program.md');
        if (!response.ok) throw new Error('Could not load program.md');
        const text = await response.text();
        parseProgram(text);
    } catch (err) {
        console.error('Error loading program:', err);
    }
}

function parseProgram(text) {
    // Split by H2 headers
    const sections = text.split(/\n## /);
    sections.forEach(section => {
        const lines = section.split('\n');
        const title = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();

        if (title.includes('Program Meta')) {
            const titleMatch = content.match(/Title:\s*(.*)/);
            const subtitleMatch = content.match(/Subtitle:\s*(.*)/);
            if (titleMatch) document.querySelector('h1').textContent = titleMatch[1];
            if (subtitleMatch) document.querySelector('.subtitle').textContent = subtitleMatch[1];
        } else if (title.includes('Exercises')) {
            const exBlocks = content.split(/\n- \[/);
            EXERCISES.length = 0;
            exBlocks.forEach(block => {
                const idMatch = block.match(/^([^\]]+)\] \*\*(.+)\*\* (.*)/);
                if (!idMatch) return;
                const id = idMatch[1];
                const name = idMatch[2];
                const icon = idMatch[3];

                const equipment = block.match(/Equipment:\s*(.*)/)?.[1] || '';
                const slot = block.match(/Slot:\s*(.*)/)?.[1] || '';
                const why = block.match(/Why:\s*(.*)/)?.[1] || '';
                const instructions = block.match(/Instructions:\s*(.*)/)?.[1] || '';
                const tipsStr = block.match(/Tips:\s*(.*)/)?.[1] || '';
                const imageDescription = block.match(/Image:\s*(.*)/)?.[1] || '';

                EXERCISES.push({
                    id, name, icon, equipment, slot, why, instructions,
                    tips: tipsStr.split(',').map(t => t.trim()),
                    imageDescription
                });
            });
        } else if (title.includes('Schedule')) {
            const schedLines = content.split('\n');
            const dayMap = { 'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6 };
            TRAINING_DAYS.length = 0;
            schedLines.forEach(line => {
                const parts = line.split('|').map(p => p.trim());
                if (parts.length < 5) return;
                const dayMatch = parts[0].match(/-\s*(\w+):\s*([^(]+)(?:\((.*)\))?/);
                if (!dayMatch) return;
                const dayName = dayMatch[1];
                const type = dayMatch[2].trim();
                const desc = dayMatch[3] ? dayMatch[3].trim() : type;
                const dayIdx = dayMap[dayName];
                if (dayIdx === undefined) return;

                DAY_CONFIG[dayIdx] = {
                    type,
                    label: `${type.toUpperCase()} DAY`,
                    desc: desc,
                    sets: parseInt(parts[1]),
                    reps: parts[2].replace('reps', '').trim(),
                    rest: parts[3].replace('rest', '').trim(),
                    instruction: parts[4]
                };
                TRAINING_DAYS.push(dayIdx);
            });
        } else if (title.includes('Nutrition')) {
            FOOD_ITEMS.length = 0;
            const foodLines = content.split('\n');
            foodLines.forEach(line => {
                const match = line.match(/-\s*\[([^\]]+)\]\s*(\S+)\s*(.*)/);
                if (match) FOOD_ITEMS.push({ id: match[1], icon: match[2], label: match[3] });
            });
        } else if (title.includes('Rest Checklist')) {
            REST_ITEMS.length = 0;
            const restLines = content.split('\n');
            restLines.forEach(line => {
                const match = line.match(/-\s*\[([^\]]+)\]\s*(\S+)\s*(.*)/);
                if (match) REST_ITEMS.push({ id: match[1], icon: match[2], label: match[3] });
            });
        } else if (title.includes('Warmup')) {
            const listEl = document.getElementById('warmup-body');
            if (listEl) listEl.innerHTML = marked.parse(content);
        } else if (title.includes('Cooldown')) {
            const listEl = document.getElementById('cooldown-body');
            if (listEl) listEl.innerHTML = marked.parse(content);
        } else if (title.includes('Never Do')) {
            const listEl = document.getElementById('never-do-content');
            if (listEl) listEl.innerHTML = marked.parse(content);
        } else if (title.includes('Rest Protocol')) {
            const container = document.getElementById('rest-protocol-body');
            if (container) {
                // Pre-process for better styling: add protocol-block class to each H3 section
                const html = marked.parse(content);
                const temp = document.createElement('div');
                temp.innerHTML = html;
                
                let processedHTML = '';
                let currentBlock = null;
                
                Array.from(temp.children).forEach(child => {
                    if (child.tagName === 'H3') {
                        if (currentBlock) processedHTML += '</div>';
                        const isDanger = child.textContent.toLowerCase().includes('do not');
                        processedHTML += `<div class="protocol-block${isDanger ? ' protocol-block--danger' : ''}"><h4>${child.textContent}</h4>`;
                        currentBlock = true;
                    } else {
                        if (currentBlock) {
                            processedHTML += child.outerHTML;
                        } else {
                            processedHTML += child.outerHTML;
                        }
                    }
                });
                if (currentBlock) processedHTML += '</div>';
                container.innerHTML = processedHTML;
            }
        }
    });
}

// ─── Rendering ────────────────────────────────────────────────────

function render() {
    const day = state.selectedDay;
    const training = isTrainingDay(day);
    const config = getDayConfig(day);

    renderDaySelector(day);
    renderDayBanner(day, training, config);
    renderWorkout(day, training, config);
    renderRestDay(training);
    renderRestChecklist();
    renderProgressionAlerts();
    renderFoodChecklist();
    renderBodyweight();

    // Show/hide training-only sections
    document.getElementById('warmup-section').style.display = training ? '' : 'none';
    document.getElementById('workout-section').style.display = training ? '' : 'none';
    document.getElementById('cooldown-section').style.display = training ? '' : 'none';

    // Show/hide rest-day section
    document.getElementById('rest-day-section').style.display = training ? 'none' : '';
}

function renderDaySelector(activeDay) {
    const btns = document.querySelectorAll('.day-btn');
    const todayIdx = todayDayIndex();
    btns.forEach(btn => {
        const d = parseInt(btn.dataset.day);
        btn.classList.toggle('active', d === activeDay);
        btn.classList.toggle('training', isTrainingDay(d));
        btn.classList.toggle('today', d === todayIdx);
    });
}

function renderDayBanner(dayIndex, training, config) {
    const banner = document.getElementById('day-banner');
    const typeEl = document.getElementById('day-banner-type');
    const descEl = document.getElementById('day-banner-desc');

    if (training && config) {
        banner.style.display = '';
        typeEl.textContent = config.label;
        descEl.textContent = config.desc;
        banner.className = 'day-banner day-banner--' + config.type.toLowerCase();
    } else {
        banner.style.display = 'none';
    }
}

function renderWorkout(dayIndex, training, config) {
    const toggleLabel = document.getElementById('workout-toggle-label');
    const instrEl = document.getElementById('workout-instruction');
    const listEl = document.getElementById('exercise-checklist');

    if (!training || !config) return;

    toggleLabel.textContent = `${DAY_NAMES[dayIndex]} – ${config.type} Day`;
    instrEl.textContent = config.instruction;

    const dateKey = todayKey();
    const checkKey = `${dateKey}_${dayIndex}`;

    if (!state.exerciseChecks[checkKey]) {
        state.exerciseChecks[checkKey] = {};
    }
    const checks = state.exerciseChecks[checkKey];

    if (!state.workoutLog[dateKey]) {
        state.workoutLog[dateKey] = {};
    }

    listEl.innerHTML = '';

    EXERCISES.forEach(ex => {
        const done = !!checks[ex.id];
        const el = document.createElement('div');
        el.className = 'exercise-row' + (done ? ' exercise-row--done' : '');
        el.dataset.exerciseId = ex.id;

        const prevData = getLastLogForExercise(ex.id, dayIndex);
        const currentLog = state.workoutLog[dateKey]?.[ex.id];

        const numSets = config.sets;
        let setsHTML = '';
        for (let s = 0; s < numSets; s++) {
            const savedWeight = currentLog?.sets?.[s]?.weight ?? prevData?.sets?.[s]?.weight ?? '';
            const savedReps = currentLog?.sets?.[s]?.reps ?? prevData?.sets?.[s]?.reps ?? '';
            const isPrev = !currentLog?.sets?.[s] && prevData?.sets?.[s];
            setsHTML += `
                <div class="set-row">
                    <span class="set-label">Set ${s + 1}</span>
                    <input type="number" class="set-input weight-input${isPrev ? ' suggested' : ''}" data-exercise="${ex.id}" data-set="${s}" data-field="weight"
                           placeholder="lbs" value="${savedWeight}">
                    <span class="set-x">×</span>
                    <input type="number" class="set-input reps-input${isPrev ? ' suggested' : ''}" data-exercise="${ex.id}" data-set="${s}" data-field="reps"
                           placeholder="reps" value="${savedReps}">
                </div>`;
        }

        el.innerHTML = `
            <div class="exercise-row-main">
                <button class="exercise-check" data-exercise="${ex.id}" aria-label="Mark ${ex.name} done">
                    <span class="check-icon">${done ? '✅' : '⬜'}</span>
                </button>
                <div class="exercise-info-block">
                    <span class="exercise-name">${ex.icon} ${ex.name}</span>
                    <span class="exercise-meta">${config.sets}×${config.reps} · ${config.rest} rest · ${ex.equipment}</span>
                </div>
                <button class="exercise-expand-btn" data-exercise="${ex.id}" aria-label="Show details for ${ex.name}">ℹ️</button>
            </div>
            <div class="exercise-detail" id="detail-${ex.id}" hidden>
                <p class="exercise-instructions">${ex.instructions}</p>
                <ul class="exercise-tips">${ex.tips.map(t => `<li>${t}</li>`).join('')}</ul>
                <p class="exercise-slot">Slot: ${ex.slot} · ${ex.why}</p>
                <div class="exercise-image-container">
                    <img src="assets/exercises/${ex.id}.gif" alt="${ex.imageDescription || ex.name}" class="exercise-gif" onerror="this.style.display='none'">
                    ${ex.id === 'conditioning' ? `<img src="assets/exercises/ski_erg.gif" alt="Ski Erg form" class="exercise-gif" onerror="this.style.display='none'">` : ''}
                    ${ex.id === 'pushup' ? `<img src="assets/exercises/pushup_form.gif" alt="Push-up form" class="exercise-gif" onerror="this.style.display='none'">` : ''}
                </div>
            </div>
            <div class="exercise-sets-block" id="sets-${ex.id}">
                ${setsHTML}
            </div>
        `;
        listEl.appendChild(el);
    });
}

function renderRestDay(training) {
    // Visibility handled in render()
}

function renderRestChecklist() {
    const listEl = document.getElementById('rest-checklist');
    if (!listEl) return;

    const dateKey = todayKey();
    if (!state.restChecks[dateKey]) {
        state.restChecks[dateKey] = {};
    }
    const checks = state.restChecks[dateKey];

    listEl.innerHTML = '';
    REST_ITEMS.forEach(item => {
        const done = !!checks[item.id];
        const el = document.createElement('div');
        el.className = 'food-row' + (done ? ' food-row--done' : '');
        el.innerHTML = `
            <button class="food-check rest-check-btn" data-rest="${item.id}" aria-label="Mark ${item.label}">
                <span class="check-icon">${done ? '✅' : '⬜'}</span>
            </button>
            <span class="food-label">${item.icon} ${item.label}</span>
        `;
        listEl.appendChild(el);
    });
}

function renderFoodChecklist() {
    const listEl = document.getElementById('food-checklist');
    const progressEl = document.getElementById('food-progress');
    if (!listEl || !progressEl) return;

    const dateKey = todayKey();

    if (!state.foodChecks[dateKey]) {
        state.foodChecks[dateKey] = {};
    }
    const checks = state.foodChecks[dateKey];

    let doneCount = 0;
    listEl.innerHTML = '';

    FOOD_ITEMS.forEach(item => {
        const done = !!checks[item.id];
        if (done) doneCount++;

        const el = document.createElement('div');
        el.className = 'food-row' + (done ? ' food-row--done' : '');
        el.innerHTML = `
            <button class="food-check" data-food="${item.id}" aria-label="Mark ${item.label}">
                <span class="check-icon">${done ? '✅' : '⬜'}</span>
            </button>
            <span class="food-label">${item.icon} ${item.label}</span>
        `;
        listEl.appendChild(el);
    });

    progressEl.textContent = `${doneCount} / ${FOOD_ITEMS.length}`;
    progressEl.classList.toggle('food-progress--complete', doneCount === FOOD_ITEMS.length);
}

function renderBodyweight() {
    const input = document.getElementById('bodyweight-input');
    if (state.bodyweight) input.value = state.bodyweight;
}

function renderProgressionAlerts() {
    const container = document.getElementById('progression-alerts');
    const list = document.getElementById('progression-list');
    const flags = Object.entries(state.progression || {}).filter(([, v]) => v.flagged);

    if (flags.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = '';
    list.innerHTML = '';
    flags.forEach(([exId, data]) => {
        const ex = EXERCISES.find(e => e.id === exId);
        if (!ex) return;
        const el = document.createElement('div');
        el.className = 'progression-flag';
        el.innerHTML = `
            <span>⬆️ Increase <strong>${ex.name}</strong> weight by ~5 lbs next ${data.dayType} day</span>
            <button class="dismiss-flag" data-exercise="${exId}">✓ Got it</button>
        `;
        list.appendChild(el);
    });
}

// ─── Last-Log Lookup ──────────────────────────────────────────────
function getLastLogForExercise(exerciseId) {
    const entries = Object.entries(state.workoutLog || {}).sort((a, b) => b[0].localeCompare(a[0]));
    for (const [dateKey, exercises] of entries) {
        if (dateKey === todayKey()) continue;
        if (exercises[exerciseId]) return exercises[exerciseId];
    }
    return null;
}

// ─── Progression Logic ────────────────────────────────────────────
function checkProgression(exerciseId, dayIndex) {
    const config = getDayConfig(dayIndex);
    if (!config) return;

    const dateKey = todayKey();
    const log = state.workoutLog[dateKey]?.[exerciseId];
    if (!log?.sets || log.sets.length === 0) return;

    const match = config.reps.match(/(\d+)[–-](\d+)/);
    if (!match) return;
    const maxReps = parseInt(match[2]);

    const filledSets = log.sets.filter(s => s.weight && s.reps);
    if (filledSets.length < config.sets) return;

    const allAtMax = filledSets.every(s => parseInt(s.reps) >= maxReps);
    const sameWeight = new Set(filledSets.map(s => s.weight)).size === 1;

    if (allAtMax && sameWeight) {
        if (!state.progression) state.progression = {};
        state.progression[exerciseId] = { flagged: true, dayType: config.type, weight: filledSets[0].weight, date: dateKey };
        saveState();
    }
}

// ─── Collapsible Toggle Logic ─────────────────────────────────────
function setupCollapsibles() {
    document.addEventListener('click', e => {
        const toggle = e.target.closest('.collapsible-toggle');
        if (!toggle) return;

        const targetId = toggle.dataset.collapse;
        const body = document.getElementById(targetId);
        if (!body) return;

        const isCurrentlyOpen = !body.hidden;
        body.hidden = isCurrentlyOpen;
        toggle.setAttribute('aria-expanded', String(!isCurrentlyOpen));
        toggle.querySelector('.toggle-icon').textContent = isCurrentlyOpen ? '▸' : '▾';
    });
}

// ─── Event Handling ───────────────────────────────────────────────

function setupEvents() {
    // Day selector buttons
    document.getElementById('day-selector').addEventListener('click', e => {
        const btn = e.target.closest('.day-btn');
        if (!btn) return;
        state.selectedDay = parseInt(btn.dataset.day);
        saveState();
        render();
    });

    // Exercise check toggles + detail expand
    document.getElementById('exercise-checklist').addEventListener('click', e => {
        const checkBtn = e.target.closest('.exercise-check');
        if (checkBtn) {
            const exId = checkBtn.dataset.exercise;
            const checkKey = `${todayKey()}_${state.selectedDay}`;
            if (!state.exerciseChecks[checkKey]) state.exerciseChecks[checkKey] = {};
            state.exerciseChecks[checkKey][exId] = !state.exerciseChecks[checkKey][exId];
            saveState();
            render();
            return;
        }

        const expandBtn = e.target.closest('.exercise-expand-btn');
        if (expandBtn) {
            const exId = expandBtn.dataset.exercise;
            const detail = document.getElementById(`detail-${exId}`);
            if (detail) detail.hidden = !detail.hidden;
        }
    });

    // Set inputs (weight/reps logging)
    document.getElementById('exercise-checklist').addEventListener('input', e => {
        const input = e.target.closest('.set-input');
        if (!input) return;

        const exId = input.dataset.exercise;
        const setIdx = parseInt(input.dataset.set);
        const field = input.dataset.field;
        const dateKey = todayKey();

        if (!state.workoutLog[dateKey]) state.workoutLog[dateKey] = {};
        if (!state.workoutLog[dateKey][exId]) state.workoutLog[dateKey][exId] = { sets: [] };

        const sets = state.workoutLog[dateKey][exId].sets;
        while (sets.length <= setIdx) sets.push({ weight: '', reps: '' });
        sets[setIdx][field] = input.value;

        clearTimeout(window._saveTimeout);
        window._saveTimeout = setTimeout(() => {
            saveState();
            checkProgression(exId, state.selectedDay);
            renderProgressionAlerts();
        }, 500);
    });

    // Food check toggles
    document.getElementById('food-checklist').addEventListener('click', e => {
        const checkBtn = e.target.closest('.food-check');
        if (!checkBtn) return;
        const foodId = checkBtn.dataset.food;
        const dateKey = todayKey();
        if (!state.foodChecks[dateKey]) state.foodChecks[dateKey] = {};
        state.foodChecks[dateKey][foodId] = !state.foodChecks[dateKey][foodId];
        saveState();
        renderFoodChecklist();
    });

    // Rest day check toggles
    document.getElementById('rest-checklist').addEventListener('click', e => {
        const checkBtn = e.target.closest('.rest-check-btn');
        if (!checkBtn) return;
        const restId = checkBtn.dataset.rest;
        const dateKey = todayKey();
        if (!state.restChecks[dateKey]) state.restChecks[dateKey] = {};
        state.restChecks[dateKey][restId] = !state.restChecks[dateKey][restId];
        saveState();
        renderRestChecklist();
    });

    // Bodyweight input
    document.getElementById('bodyweight-input').addEventListener('change', e => {
        state.bodyweight = e.target.value;
        saveState();
    });

    // Reset all
    document.getElementById('reset-all-btn').addEventListener('click', () => {
        if (confirm('Reset ALL data? This will erase your workout logs, food checks, and progression. Are you sure?')) {
            localStorage.removeItem(STORAGE_KEY);
            state = defaultState();
            saveState();
            render();
        }
    });

    // Dismiss progression flag
    document.getElementById('progression-list').addEventListener('click', e => {
        const btn = e.target.closest('.dismiss-flag');
        if (!btn) return;
        const exId = btn.dataset.exercise;
        if (state.progression?.[exId]) {
            state.progression[exId].flagged = false;
            saveState();
            renderProgressionAlerts();
        }
    });
}

// ─── Cleanup Old Data ─────────────────────────────────────────────
function cleanupOldData() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

    for (const key of Object.keys(state.exerciseChecks || {})) { if (key < cutoffStr) delete state.exerciseChecks[key]; }
    for (const key of Object.keys(state.foodChecks || {})) { if (key < cutoffStr) delete state.foodChecks[key]; }
    for (const key of Object.keys(state.restChecks || {})) { if (key < cutoffStr) delete state.restChecks[key]; }
    for (const key of Object.keys(state.workoutLog || {})) { if (key < cutoffStr) delete state.workoutLog[key]; }
    saveState();
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    state.selectedDay = todayDayIndex();
    await loadProgram();
    cleanupOldData();
    setupCollapsibles();
    render();
    setupEvents();
});
