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

// Per-day exercise configs: { 0: [{id, sets, reps, weight, rest}, ...], 2: [...], 4: [...] }
const DAY_EXERCISES = {};

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
        workoutLog: {},       // "YYYY-MM-DD": { exerciseId: { sets: [{weight, reps}] } }
        customWeights: {}     // exerciseId_dayIndex: "weight" (user overrides)
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
        } else if (title === 'Exercises' || title.startsWith('Exercises')) {
            // Split by newline followed by the start of an exercise block
            const exBlocks = content.split(/\n- \[/);
            EXERCISES.length = 0;
            exBlocks.forEach(block => {
                const cleanBlock = block.replace(/^- \[/, '');
                const idMatch = cleanBlock.match(/^([^\]]+)\] \*\*(.+)\*\* (.*)/);
                if (!idMatch) return;
                
                const id = idMatch[1].trim();
                const name = idMatch[2].trim();
                const icon = idMatch[3].trim();

                const equipment = cleanBlock.match(/Equipment:\s*(.*)/)?.[1] || '';
                const slot = cleanBlock.match(/Slot:\s*(.*)/)?.[1] || '';
                const why = cleanBlock.match(/Why:\s*(.*)/)?.[1] || '';
                const instructions = cleanBlock.match(/Instructions:\s*(.*)/)?.[1] || '';
                const tipsStr = cleanBlock.match(/Tips:\s*(.*)/)?.[1] || '';
                const imageDescription = cleanBlock.match(/Image:\s*(.*)/)?.[1] || '';

                EXERCISES.push({
                    id, name, icon, equipment, slot, why, instructions,
                    tips: tipsStr.split(',').map(t => t.trim()).filter(t => t),
                    imageDescription
                });
            });
        } else if (title.includes('DayExercises')) {
            // Parse per-day exercise configurations
            const dayMap = { 'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6 };
            let currentDay = null;
            
            content.split('\n').forEach(line => {
                const dayHeader = line.match(/^###\s+(\w+)/);
                if (dayHeader) {
                    currentDay = dayMap[dayHeader[1]];
                    if (currentDay !== undefined) {
                        DAY_EXERCISES[currentDay] = [];
                    }
                    return;
                }
                
                if (currentDay === null || currentDay === undefined) return;
                
                // Parse: - exercise_id | sets x reps | weight | rest
                const exMatch = line.match(/^-\s+(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)$/);
                if (!exMatch) return;
                
                const id = exMatch[1].trim();
                const setsReps = exMatch[2].trim();
                const weight = exMatch[3].trim();
                const rest = exMatch[4].trim();
                
                // Parse sets x reps: "3 x 5", "3 x 8/arm", "3 x 30 sec", "2 x 10/leg"
                const srMatch = setsReps.match(/(\d+)\s*x\s*(.+)/);
                const sets = srMatch ? parseInt(srMatch[1]) : 3;
                const reps = srMatch ? srMatch[2].trim() : setsReps;
                
                DAY_EXERCISES[currentDay].push({ id, sets, reps, weight, rest });
            });
        } else if (title.includes('Schedule')) {
            const schedLines = content.split('\n');
            const dayMap = { 'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6 };
            TRAINING_DAYS.length = 0;
            schedLines.forEach(line => {
                const parts = line.split('|').map(p => p.trim());
                if (parts.length < 5) return;
                const dayMatch = parts[0].match(/-\s*(\w+):\s*([^(]+)(?:\((.+)\))?/);
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
        } else if (title.includes('MovementSnack')) {
            const listEl = document.getElementById('movement-snack-body');
            if (listEl) listEl.innerHTML = marked.parse(content);
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

    // Movement snack is always visible (it's collapsible by user)
    document.getElementById('movement-snack-section').style.display = '';

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

    // Get per-day exercise list
    const dayExercises = DAY_EXERCISES[dayIndex] || [];
    
    dayExercises.forEach(dayEx => {
        const ex = EXERCISES.find(e => e.id === dayEx.id);
        if (!ex) return;
        
        const done = !!checks[ex.id];
        const el = document.createElement('div');
        el.className = 'exercise-row' + (done ? ' exercise-row--done' : '');
        el.dataset.exerciseId = ex.id;

        const prevData = getLastLogForExercise(ex.id, dayIndex);
        const currentLog = state.workoutLog[dateKey]?.[ex.id];

        const numSets = dayEx.sets;
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

        // Build exercise meta string with per-exercise details
        const metaStr = `${dayEx.sets}×${dayEx.reps} · ${dayEx.weight} · ${dayEx.rest} rest`;

        el.innerHTML = `
            <div class="exercise-row-main">
                <button class="exercise-check" data-exercise="${ex.id}" aria-label="Mark ${ex.name} done">
                    <span class="check-icon">${done ? '✅' : '⬜'}</span>
                </button>
                <div class="exercise-info-block">
                    <span class="exercise-name">${ex.icon} ${ex.name}</span>
                    <span class="exercise-meta">${metaStr}</span>
                </div>
                <button class="exercise-expand-btn" data-exercise="${ex.id}" aria-label="Show details for ${ex.name}">ℹ️</button>
            </div>
            <div class="exercise-detail" id="detail-${ex.id}" hidden>
                <p class="exercise-instructions">${ex.instructions}</p>
                <ul class="exercise-tips">${ex.tips.map(t => `<li>${t}</li>`).join('')}</ul>
                <p class="exercise-slot">Slot: ${ex.slot} · ${ex.why}</p>
                <div class="exercise-image-container">
                    <img src="assets/exercises/${ex.id}.gif" alt="${ex.imageDescription || ex.name}" class="exercise-gif" onerror="this.style.display='none'">
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

    const dayExercises = DAY_EXERCISES[dayIndex] || [];
    const dayEx = dayExercises.find(e => e.id === exerciseId);
    const expectedSets = dayEx ? dayEx.sets : config.sets;

    const filledSets = log.sets.filter(s => s.weight && s.reps);
    if (filledSets.length < expectedSets) return;

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
const CUSTOM_PROGRAM_KEY = 'ironSoviet_customProgram';

document.addEventListener('DOMContentLoaded', async () => {
    state.selectedDay = todayDayIndex();
    await loadProgram();          // parse defaults from program.md
    applyCustomProgram();         // overlay any user customisations
    cleanupOldData();
    setupCollapsibles();
    render();
    setupEvents();
    setupEditor();
});

// ═══════════════════════════════════════════════════════════════════
// Program Editor — makes the app customisable per person
// ═══════════════════════════════════════════════════════════════════

/* ── Custom-program persistence ─────────────────────────────────── */
function loadCustomProgram() {
    try {
        const raw = localStorage.getItem(CUSTOM_PROGRAM_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveCustomProgram(data) {
    localStorage.setItem(CUSTOM_PROGRAM_KEY, JSON.stringify(data));
}

function deleteCustomProgram() {
    localStorage.removeItem(CUSTOM_PROGRAM_KEY);
}

/**
 * Apply a saved custom program over the defaults already parsed
 * from program.md. Merges exercises, day-exercises, schedule,
 * and food items.
 */
function applyCustomProgram() {
    const custom = loadCustomProgram();
    if (!custom) return;

    // Exercises list
    if (custom.exercises) {
        EXERCISES.length = 0;
        custom.exercises.forEach(e => EXERCISES.push(e));
    }

    // Per-day exercise configs
    if (custom.dayExercises) {
        Object.keys(DAY_EXERCISES).forEach(k => delete DAY_EXERCISES[k]);
        for (const [day, list] of Object.entries(custom.dayExercises)) {
            DAY_EXERCISES[parseInt(day)] = list;
        }
    }

    // Schedule (training days + day config)
    if (custom.schedule) {
        TRAINING_DAYS.length = 0;
        Object.keys(DAY_CONFIG).forEach(k => delete DAY_CONFIG[k]);
        for (const [day, cfg] of Object.entries(custom.schedule)) {
            const idx = parseInt(day);
            DAY_CONFIG[idx] = cfg;
            TRAINING_DAYS.push(idx);
        }
    }

    // Food items
    if (custom.foodItems) {
        FOOD_ITEMS.length = 0;
        custom.foodItems.forEach(f => FOOD_ITEMS.push(f));
    }
}

/* ── Working draft (in-memory copy the editor modifies) ─────── */
let editorDraft = null;
let editorSelectedDay = 0; // which training day tab is selected

function createDraft() {
    return {
        exercises: JSON.parse(JSON.stringify(EXERCISES)),
        dayExercises: JSON.parse(JSON.stringify(DAY_EXERCISES)),
        schedule: {},
        foodItems: JSON.parse(JSON.stringify(FOOD_ITEMS)),
    };
}

function createDraftSchedule(draft) {
    // Build schedule from current DAY_CONFIG / TRAINING_DAYS
    draft.schedule = {};
    for (let i = 0; i < 7; i++) {
        if (DAY_CONFIG[i]) {
            draft.schedule[i] = JSON.parse(JSON.stringify(DAY_CONFIG[i]));
        }
    }
}

/* ── Open / Close ───────────────────────────────────────────── */
function openEditor() {
    editorDraft = createDraft();
    createDraftSchedule(editorDraft);
    // default to first training day
    const tDays = Object.keys(editorDraft.schedule).map(Number).sort();
    editorSelectedDay = tDays.length ? tDays[0] : 0;
    document.getElementById('editor-overlay').hidden = false;
    document.body.style.overflow = 'hidden';
    renderEditorTabs();
    renderEditorExercisesTab();
}

function closeEditor() {
    document.getElementById('editor-overlay').hidden = true;
    document.body.style.overflow = '';
    editorDraft = null;
}

/* ── Tab Switching ──────────────────────────────────────────── */
function switchEditorTab(tabName) {
    document.querySelectorAll('.editor-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.editor-panel').forEach(p => {
        p.hidden = p.id !== `panel-${tabName}`;
    });
    // render content for selected tab
    if (tabName === 'exercises') renderEditorExercisesTab();
    else if (tabName === 'schedule') renderEditorScheduleTab();
    else if (tabName === 'nutrition') renderEditorNutritionTab();
}

/* ── Exercises Tab Rendering ────────────────────────────────── */
function renderEditorTabs() {
    // Day sub-tabs inside exercises panel
    const container = document.getElementById('editor-day-tabs');
    const tDays = Object.keys(editorDraft.schedule).map(Number).sort();
    container.innerHTML = '';
    tDays.forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'editor-day-tab' + (d === editorSelectedDay ? ' active' : '');
        btn.textContent = DAY_NAMES[d].slice(0, 3);
        btn.addEventListener('click', () => {
            editorSelectedDay = d;
            renderEditorTabs();
            renderEditorExercisesTab();
        });
        container.appendChild(btn);
    });
}

function renderEditorExercisesTab() {
    const list = document.getElementById('editor-exercises-list');
    list.innerHTML = '';
    const dayEx = editorDraft.dayExercises[editorSelectedDay] || [];

    dayEx.forEach((dex, idx) => {
        const ex = editorDraft.exercises.find(e => e.id === dex.id);
        const name = ex ? `${ex.icon} ${ex.name}` : dex.id;

        const card = document.createElement('div');
        card.className = 'editor-exercise-card';
        card.innerHTML = `
            <div class="editor-exercise-header" data-idx="${idx}">
                <span class="editor-exercise-name">${name}</span>
                <span class="editor-exercise-toggle">▸</span>
            </div>
            <div class="editor-exercise-body" hidden>
                <div class="editor-field-row">
                    <span class="editor-field-label">Sets</span>
                    <input class="editor-field-input" data-field="sets" type="number" min="1" max="10" value="${dex.sets}">
                </div>
                <div class="editor-field-row">
                    <span class="editor-field-label">Reps</span>
                    <input class="editor-field-input" data-field="reps" value="${dex.reps}">
                </div>
                <div class="editor-field-row">
                    <span class="editor-field-label">Weight</span>
                    <input class="editor-field-input" data-field="weight" value="${dex.weight}">
                </div>
                <div class="editor-field-row">
                    <span class="editor-field-label">Rest</span>
                    <input class="editor-field-input" data-field="rest" value="${dex.rest}">
                </div>
                <button class="editor-exercise-remove" data-idx="${idx}">🗑 Remove from this day</button>
            </div>
        `;

        // Toggle expand
        card.querySelector('.editor-exercise-header').addEventListener('click', () => {
            const body = card.querySelector('.editor-exercise-body');
            const icon = card.querySelector('.editor-exercise-toggle');
            body.hidden = !body.hidden;
            icon.textContent = body.hidden ? '▸' : '▾';
        });

        // Field edits
        card.querySelectorAll('.editor-field-input').forEach(input => {
            input.addEventListener('input', () => {
                const field = input.dataset.field;
                const val = input.value;
                if (field === 'sets') {
                    editorDraft.dayExercises[editorSelectedDay][idx].sets = parseInt(val) || 1;
                } else {
                    editorDraft.dayExercises[editorSelectedDay][idx][field] = val;
                }
            });
        });

        // Remove
        card.querySelector('.editor-exercise-remove').addEventListener('click', () => {
            editorDraft.dayExercises[editorSelectedDay].splice(idx, 1);
            renderEditorExercisesTab();
        });

        list.appendChild(card);
    });
}

/* ── Add Exercise ───────────────────────────────────────────── */
function handleAddExercise() {
    const container = document.getElementById('panel-exercises');
    // remove existing add form if present
    const existing = container.querySelector('.editor-add-form');
    if (existing) { existing.remove(); return; }

    // Build a picker from available exercises not already on this day
    const dayEx = editorDraft.dayExercises[editorSelectedDay] || [];
    const usedIds = dayEx.map(d => d.id);
    const available = editorDraft.exercises.filter(e => !usedIds.includes(e.id));

    const form = document.createElement('div');
    form.className = 'editor-add-form';

    if (available.length === 0) {
        form.innerHTML = `<p style="color:var(--text-muted);font-size:0.84rem;">All exercises are already on this day.</p>`;
    } else {
        let optionsHTML = available.map(e =>
            `<option value="${e.id}">${e.icon} ${e.name}</option>`
        ).join('');
        form.innerHTML = `
            <div class="editor-field-row">
                <span class="editor-field-label">Pick</span>
                <select class="editor-field-input" id="add-ex-select">${optionsHTML}</select>
            </div>
            <div class="editor-field-row">
                <span class="editor-field-label">Sets</span>
                <input class="editor-field-input" id="add-ex-sets" type="number" value="3" min="1" max="10">
            </div>
            <div class="editor-field-row">
                <span class="editor-field-label">Reps</span>
                <input class="editor-field-input" id="add-ex-reps" value="8">
            </div>
            <div class="editor-field-row">
                <span class="editor-field-label">Weight</span>
                <input class="editor-field-input" id="add-ex-weight" value="BW">
            </div>
            <div class="editor-field-row">
                <span class="editor-field-label">Rest</span>
                <input class="editor-field-input" id="add-ex-rest" value="60 sec">
            </div>
            <div class="editor-add-form-actions">
                <button class="editor-btn editor-btn--primary" id="confirm-add-ex">✓ Add</button>
                <button class="editor-btn editor-btn--secondary" id="cancel-add-ex">Cancel</button>
            </div>
        `;
    }

    container.querySelector('.editor-add-exercise').after(form);

    form.querySelector('#cancel-add-ex')?.addEventListener('click', () => form.remove());
    form.querySelector('#confirm-add-ex')?.addEventListener('click', () => {
        const id = form.querySelector('#add-ex-select').value;
        const sets = parseInt(form.querySelector('#add-ex-sets').value) || 3;
        const reps = form.querySelector('#add-ex-reps').value || '8';
        const weight = form.querySelector('#add-ex-weight').value || 'BW';
        const rest = form.querySelector('#add-ex-rest').value || '60 sec';

        if (!editorDraft.dayExercises[editorSelectedDay]) {
            editorDraft.dayExercises[editorSelectedDay] = [];
        }
        editorDraft.dayExercises[editorSelectedDay].push({ id, sets, reps, weight, rest });
        form.remove();
        renderEditorExercisesTab();
    });
}

/* ── Schedule Tab ───────────────────────────────────────────── */
function renderEditorScheduleTab() {
    const grid = document.getElementById('editor-schedule-grid');
    grid.innerHTML = '';

    DAY_NAMES.forEach((name, idx) => {
        const isTraining = !!editorDraft.schedule[idx];
        const cfg = editorDraft.schedule[idx];
        const type = cfg ? cfg.type : 'Heavy';

        const row = document.createElement('div');
        row.className = 'editor-schedule-row';
        row.innerHTML = `
            <span class="editor-schedule-day">${name}</span>
            <div class="editor-schedule-toggle-wrap">
                <div class="editor-toggle ${isTraining ? 'active' : ''}" data-day="${idx}"></div>
            </div>
            <div class="editor-schedule-type">
                <select data-day="${idx}" ${!isTraining ? 'disabled' : ''}>
                    <option value="Heavy" ${type === 'Heavy' ? 'selected' : ''}>Heavy</option>
                    <option value="Volume" ${type === 'Volume' ? 'selected' : ''}>Volume</option>
                    <option value="Light" ${type === 'Light' ? 'selected' : ''}>Light</option>
                </select>
            </div>
        `;

        const toggle = row.querySelector('.editor-toggle');
        const select = row.querySelector('select');

        toggle.addEventListener('click', () => {
            if (editorDraft.schedule[idx]) {
                delete editorDraft.schedule[idx];
                // also remove day-exercises for that day
                delete editorDraft.dayExercises[idx];
            } else {
                const t = select.value || 'Heavy';
                editorDraft.schedule[idx] = buildDayConfig(t);
                // initialise with empty exercise list
                editorDraft.dayExercises[idx] = [];
            }
            renderEditorScheduleTab();
            renderEditorTabs(); // refresh day sub-tabs
        });

        select.addEventListener('change', () => {
            if (editorDraft.schedule[idx]) {
                editorDraft.schedule[idx] = buildDayConfig(select.value);
            }
        });

        grid.appendChild(row);
    });
}

function buildDayConfig(type) {
    const presets = {
        Heavy:  { type: 'Heavy',  label: 'HEAVY DAY',  desc: 'Low reps · Long rest · Strength',       sets: 3, reps: '3–8',  rest: '2 min', instruction: 'Low reps, heavy load. Long rest. Leave 2 reps in tank.' },
        Volume: { type: 'Volume', label: 'VOLUME DAY', desc: 'More reps · Shorter rest · Pump and growth', sets: 3, reps: '8–15', rest: '60s',   instruction: 'More reps, shorter rest. Pump and growth.' },
        Light:  { type: 'Light',  label: 'LIGHT DAY',  desc: 'Low load · Perfect form · Active recovery', sets: 3, reps: '6–12', rest: '30s',   instruction: 'Low load, perfect form, explosive speed. Active recovery.' }
    };
    return presets[type] || presets.Heavy;
}

/* ── Nutrition Tab ──────────────────────────────────────────── */
function renderEditorNutritionTab() {
    const list = document.getElementById('editor-nutrition-list');
    list.innerHTML = '';

    editorDraft.foodItems.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'editor-nutrition-row';
        row.innerHTML = `
            <div class="editor-nutrition-icon">
                <input value="${item.icon}" data-idx="${idx}" data-field="icon">
            </div>
            <div class="editor-nutrition-name">
                <input value="${item.label}" data-idx="${idx}" data-field="label">
            </div>
            <button class="editor-nutrition-remove" data-idx="${idx}">✕</button>
        `;

        row.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => {
                editorDraft.foodItems[idx][inp.dataset.field] = inp.value;
            });
        });

        row.querySelector('.editor-nutrition-remove').addEventListener('click', () => {
            editorDraft.foodItems.splice(idx, 1);
            renderEditorNutritionTab();
        });

        list.appendChild(row);
    });
}

function handleAddFood() {
    const newId = 'food_' + Date.now();
    editorDraft.foodItems.push({ id: newId, icon: '🍽️', label: 'New item' });
    renderEditorNutritionTab();
}

/* ── Save ────────────────────────────────────────────────────── */
function saveEditor() {
    // Persist the draft
    saveCustomProgram(editorDraft);

    // Apply immediately to the live program
    applyCustomProgram();
    render();

    // Flash feedback
    const btn = document.getElementById('editor-save-btn');
    btn.textContent = '✅ Saved!';
    btn.classList.add('editor-save-flash');
    setTimeout(() => {
        btn.textContent = '💾 Save Changes';
        btn.classList.remove('editor-save-flash');
    }, 1200);
}

/* ── Export / Import / Reset ─────────────────────────────────── */
function exportProgram() {
    const data = loadCustomProgram() || createDraft();
    if (!data.schedule || Object.keys(data.schedule).length === 0) {
        createDraftSchedule(data);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iron-soviet-program.json';
    a.click();
    URL.revokeObjectURL(url);
    showShareStatus('✅ Program exported!');
}

function importProgram(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.exercises || !data.dayExercises) {
                showShareStatus('❌ Invalid program file.');
                return;
            }
            saveCustomProgram(data);
            applyCustomProgram();
            render();
            // refresh editor draft
            editorDraft = createDraft();
            createDraftSchedule(editorDraft);
            const tDays = Object.keys(editorDraft.schedule).map(Number).sort();
            editorSelectedDay = tDays.length ? tDays[0] : 0;
            renderEditorTabs();
            renderEditorExercisesTab();
            showShareStatus('✅ Program imported successfully!');
        } catch {
            showShareStatus('❌ Could not parse file.');
        }
    };
    reader.readAsText(file);
}

function resetProgram() {
    if (!confirm('Reset to the default program? Your customisations will be lost.')) return;
    deleteCustomProgram();
    // Reload program from scratch
    location.reload();
}

function showShareStatus(msg) {
    const el = document.getElementById('editor-share-status');
    el.textContent = msg;
    setTimeout(() => { el.textContent = ''; }, 3000);
}

/* ── Wire up editor events ──────────────────────────────────── */
function setupEditor() {
    // Open
    document.getElementById('edit-program-btn').addEventListener('click', openEditor);

    // Close
    document.getElementById('editor-close-btn').addEventListener('click', closeEditor);
    document.getElementById('editor-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeEditor();
    });

    // Tabs
    document.getElementById('editor-tabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.editor-tab');
        if (tab) switchEditorTab(tab.dataset.tab);
    });

    // Save
    document.getElementById('editor-save-btn').addEventListener('click', saveEditor);

    // Add exercise
    document.getElementById('add-exercise-btn').addEventListener('click', handleAddExercise);

    // Add food
    document.getElementById('add-food-btn').addEventListener('click', handleAddFood);

    // Export
    document.getElementById('export-program-btn').addEventListener('click', exportProgram);

    // Import
    document.getElementById('import-program-input').addEventListener('change', (e) => {
        if (e.target.files[0]) importProgram(e.target.files[0]);
        e.target.value = ''; // allow re-select
    });

    // Reset
    document.getElementById('reset-program-btn').addEventListener('click', resetProgram);
}
