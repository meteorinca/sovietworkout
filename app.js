// State Management
let currentState = {
    week: 1,
    day: 0, // 0: Monday, 1: Wednesday, 2: Friday
    cycle: 1,
    workoutStarted: false,
    bodyweight: 140,
    progress: JSON.parse(localStorage.getItem('ironSovietProgress')) || {},
    settings: JSON.parse(localStorage.getItem('ironSovietSettings')) || {
        autoProgress: true,
        notifications: true
    }
};

// Soviet Training Program
const program = {
    weeks: {
        1: {
            days: [
                {
                    name: "Monday",
                    type: "Heavy",
                    focus: "Strength",
                    instruction: "Stop 2 reps before failure. Rest 3 min between sets.",
                    exercises: [
                        { name: "Weighted Push-ups", sets: 4, reps: "3-5", weight: "+20-30lbs", type: "push" },
                        { name: "Pull-ups", sets: 4, reps: "3-5", weight: "Bodyweight", type: "pull" },
                        { name: "Goblet Squats", sets: 3, reps: 5, weight: "Heavy", type: "legs" },
                        { name: "Hanging Leg Raises", sets: 3, reps: "5-8", weight: "Bodyweight", type: "core" }
                    ]
                },
                {
                    name: "Wednesday",
                    type: "Light",
                    focus: "Technique",
                    instruction: "Focus on perfect form. Explosive movements. Rest 90s between sets.",
                    exercises: [
                        { name: "Push-ups", sets: 3, reps: 10, weight: "Bodyweight", type: "push" },
                        { name: "Bodyweight Rows", sets: 3, reps: 12, weight: "Bodyweight", type: "pull" },
                        { name: "Bulgarian Split Squats", sets: 3, reps: "8/leg", weight: "Bodyweight", type: "legs" },
                        { name: "Plank", sets: 3, reps: "30s", weight: "Bodyweight", type: "core" }
                    ]
                },
                {
                    name: "Friday",
                    type: "Volume",
                    focus: "Hypertrophy",
                    instruction: "Controlled tempo. Focus on muscle connection. Rest 2 min between sets.",
                    exercises: [
                        { name: "Overhead Press", sets: 4, reps: "8-10", weight: "Moderate", type: "push" },
                        { name: "Chin-ups", sets: 4, reps: "6-8", weight: "Bodyweight", type: "pull" },
                        { name: "Romanian Deadlifts", sets: 3, reps: "10-12", weight: "Moderate", type: "legs" },
                        { name: "Ab Wheel", sets: 3, reps: "8-10", weight: "Bodyweight", type: "core" }
                    ]
                }
            ]
        },
        2: {
            days: [
                {
                    name: "Monday",
                    type: "Heavy",
                    focus: "Strength",
                    instruction: "Stop 2 reps before failure. Rest 3 min between sets.",
                    exercises: [
                        { name: "Overhead Press", sets: 4, reps: "3-5", weight: "Heavy", type: "push" },
                        { name: "Weighted Chin-ups", sets: 4, reps: "3-5", weight: "+10-20lbs", type: "pull" },
                        { name: "Romanian Deadlifts", sets: 3, reps: 5, weight: "Heavy", type: "legs" },
                        { name: "Weighted Plank", sets: 3, reps: "45s", weight: "+10lbs", type: "core" }
                    ]
                },
                // ... similar structure for week 2, 3, 4
            ]
        }
        // Weeks 3 and 4 would continue with rotated exercises
    },
    deloadWeek: {
        days: [
            {
                name: "Monday",
                type: "Deload",
                focus: "Recovery",
                instruction: "50% of normal volume. Focus on perfect technique.",
                exercises: [
                    { name: "Push-ups", sets: 2, reps: 10, weight: "Easy", type: "push" },
                    { name: "Bodyweight Rows", sets: 2, reps: 12, weight: "Easy", type: "pull" },
                    { name: "Goblet Squats", sets: 2, reps: 10, weight: "Light", type: "legs" },
                    { name: "Plank", sets: 2, reps: "30s", weight: "Bodyweight", type: "core" }
                ]
            }
            // Similar for Wednesday and Friday
        ]
    }
};

// DOM Elements
const elements = {
    weekCounter: document.getElementById('week-counter'),
    cycleCounter: document.getElementById('cycle-counter'),
    dayTitle: document.getElementById('day-title'),
    dayType: document.getElementById('day-type'),
    dayFocus: document.getElementById('day-focus'),
    workoutInstruction: document.getElementById('workout-instruction-text'),
    exerciseList: document.getElementById('exercise-list'),
    progressGrid: document.getElementById('progress-grid'),
    nextSession: document.getElementById('next-session'),
    deloadCountdown: document.getElementById('deload-countdown'),
    bodyweightInput: document.getElementById('bodyweight-input'),
    
    // Buttons
    startWorkoutBtn: document.getElementById('start-workout'),
    completeWorkoutBtn: document.getElementById('complete-workout'),
    prevDayBtn: document.getElementById('prev-day'),
    nextDayBtn: document.getElementById('next-day'),
    resetWeekBtn: document.getElementById('reset-week'),
    deloadWeekBtn: document.getElementById('deload-week'),
    
    // Modal
    exerciseModal: document.getElementById('exercise-modal'),
    closeModalBtn: document.querySelector('.close-modal'),
    modalExerciseName: document.getElementById('modal-exercise-name'),
    modalExerciseImage: document.getElementById('modal-exercise-image'),
    modalExerciseInstructions: document.getElementById('modal-exercise-instructions')
};

// Initialize App
function init() {
    loadState();
    renderWorkout();
    setupEventListeners();
    updateStats();
}

// Load state from localStorage
function loadState() {
    const savedState = localStorage.getItem('ironSovietState');
    if (savedState) {
        const parsed = JSON.parse(savedState);
        // Check if we should advance to next day based on last workout date
        const lastWorkout = parsed.lastWorkoutDate ? new Date(parsed.lastWorkoutDate) : null;
        const today = new Date();
        
        if (lastWorkout) {
            const daysSince = Math.floor((today - lastWorkout) / (1000 * 60 * 60 * 24));
            // Auto-advance if it's been more than 2 days since last workout
            if (daysSince >= 2 && parsed.autoAdvance !== false) {
                parsed.day = (parsed.day + 1) % 3;
                if (parsed.day === 0) {
                    parsed.week = parsed.week === 4 ? 1 : parsed.week + 1;
                    if (parsed.week === 1) parsed.cycle++;
                }
            }
        }
        
        currentState = { ...currentState, ...parsed };
    }
    saveState();
}

// Save state to localStorage
function saveState() {
    currentState.lastWorkoutDate = new Date().toISOString();
    localStorage.setItem('ironSovietState', JSON.stringify(currentState));
    localStorage.setItem('ironSovietProgress', JSON.stringify(currentState.progress));
    localStorage.setItem('ironSovietSettings', JSON.stringify(currentState.settings));
}

// Render current workout
function renderWorkout() {
    const weekData = currentState.week === 4 ? program.deloadWeek : program.weeks[Math.min(currentState.week, 3)];
    const dayData = weekData.days[currentState.day];
    
    // Update header
    elements.dayTitle.textContent = `${dayData.name} - ${dayData.type} Day`;
    elements.dayType.textContent = dayData.type;
    elements.dayFocus.textContent = dayData.focus;
    elements.workoutInstruction.textContent = dayData.instruction;
    
    // Update counters
    elements.weekCounter.textContent = currentState.week;
    elements.cycleCounter.textContent = currentState.cycle;
    
    // Render exercises
    renderExercises(dayData.exercises);
    
    // Render progress inputs
    renderProgressInputs(dayData.exercises);
    
    // Update next session
    const nextDayIndex = (currentState.day + 1) % 3;
    const nextDayData = weekData.days[nextDayIndex];
    elements.nextSession.textContent = `${nextDayData.name} - ${nextDayData.type}`;
    
    // Update deload countdown
    const weeksToDeload = 4 - (currentState.week % 4);
    elements.deloadCountdown.textContent = `${weeksToDeload} ${weeksToDeload === 1 ? 'week' : 'weeks'}`;
    
    // Update bodyweight input
    elements.bodyweightInput.value = currentState.bodyweight;
}

// Render exercise list
function renderExercises(exercises) {
    elements.exerciseList.innerHTML = '';
    
    exercises.forEach((exercise, index) => {
        const exerciseEl = document.createElement('div');
        exerciseEl.className = 'exercise-item';
        exerciseEl.dataset.index = index;
        
        exerciseEl.innerHTML = `
            <div class="exercise-header">
                <span class="exercise-name">${exercise.name}</span>
                <span class="exercise-sets">${exercise.sets} sets</span>
            </div>
            <div class="exercise-info">
                <span>📊 ${exercise.reps} reps</span>
                <span>⚖️ ${exercise.weight}</span>
                <span>${getExerciseIcon(exercise.type)} ${exercise.type}</span>
            </div>
        `;
        
        exerciseEl.addEventListener('click', () => showExerciseModal(exercise));
        elements.exerciseList.appendChild(exerciseEl);
    });
}

// Render progress tracking inputs
function renderProgressInputs(exercises) {
    elements.progressGrid.innerHTML = '';
    
    exercises.forEach((exercise, exerciseIndex) => {
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        
        let setsHTML = '';
        for (let i = 1; i <= exercise.sets; i++) {
            setsHTML += `
                <div class="set-inputs">
                    <span>Set ${i}:</span>
                    <input type="number" placeholder="Weight" id="weight-${exerciseIndex}-${i}" 
                           data-exercise="${exerciseIndex}" data-set="${i}" data-type="weight">
                    <input type="number" placeholder="Reps" id="reps-${exerciseIndex}-${i}" 
                           data-exercise="${exerciseIndex}" data-set="${i}" data-type="reps">
                </div>
            `;
        }
        
        progressItem.innerHTML = `
            <div class="progress-exercise">
                <span>${exercise.name}</span>
                <span>${exercise.sets} × ${exercise.reps}</span>
            </div>
            ${setsHTML}
        `;
        
        elements.progressGrid.appendChild(progressItem);
    });
    
    // Load saved progress for this workout
    loadProgressForWorkout();
}

// Show exercise modal with form instructions
function showExerciseModal(exercise) {
    elements.modalExerciseName.textContent = exercise.name;
    elements.modalExerciseImage.src = `assets/exercises/${exercise.name.toLowerCase().replace(/[^a-z]/g, '_')}.png`;
    elements.modalExerciseImage.alt = `Proper form for ${exercise.name}`;
    
    // Set instructions based on exercise type
    const instructions = getExerciseInstructions(exercise);
    elements.modalExerciseInstructions.textContent = instructions;
    
    elements.exerciseModal.style.display = 'flex';
}

// Get exercise icon
function getExerciseIcon(type) {
    const icons = {
        push: '💪',
        pull: '👐',
        legs: '🦵',
        core: '🎯'
    };
    return icons[type] || '🏋️';
}

// Get exercise instructions
function getExerciseInstructions(exercise) {
    const instructions = {
        'Weighted Push-ups': 'Place weight plate on upper back. Keep core tight, lower until chest nearly touches ground.',
        'Pull-ups': 'Grip wider than shoulders. Pull chest to bar, avoid kipping. Lower with control.',
        'Goblet Squats': 'Hold weight close to chest. Squat deep, keep chest up, knees tracking over toes.',
        'Overhead Press': 'Start at shoulders. Press straight up, brace core. Don\'t arch back excessively.',
        // Add more instructions as needed
    };
    
    return instructions[exercise.name] || `Perform ${exercise.sets} sets of ${exercise.reps} with ${exercise.weight}. Focus on perfect form.`;
}

// Update statistics
function updateStats() {
    // This would calculate and display progress charts
    // For minimal version, we just save/load progress
}

// Load progress for current workout
function loadProgressForWorkout() {
    const workoutKey = `week${currentState.week}_day${currentState.day}`;
    const savedProgress = currentState.progress[workoutKey];
    
    if (savedProgress) {
        savedProgress.forEach((set, index) => {
            const [exerciseIndex, setNumber, weight, reps] = set.split(':');
            const weightInput = document.getElementById(`weight-${exerciseIndex}-${setNumber}`);
            const repsInput = document.getElementById(`reps-${exerciseIndex}-${setNumber}`);
            
            if (weightInput) weightInput.value = weight;
            if (repsInput) repsInput.value = reps;
        });
    }
}

// Save progress for current workout
function saveProgressForWorkout() {
    const inputs = document.querySelectorAll('.set-inputs input');
    const workoutKey = `week${currentState.week}_day${currentState.day}`;
    const progress = [];
    
    inputs.forEach(input => {
        if (input.value) {
            const { exercise, set, type } = input.dataset;
            // Find matching pair (weight/reps)
            const pairType = type === 'weight' ? 'reps' : 'weight';
            const pairInput = document.querySelector(`input[data-exercise="${exercise}"][data-set="${set}"][data-type="${pairType}"]`);
            
            if (pairInput && pairInput.value) {
                const weight = type === 'weight' ? input.value : pairInput.value;
                const reps = type === 'reps' ? input.value : pairInput.value;
                progress.push(`${exercise}:${set}:${weight}:${reps}`);
            }
        }
    });
    
    currentState.progress[workoutKey] = progress;
    saveState();
}

// Setup event listeners
function setupEventListeners() {
    // Start workout
    elements.startWorkoutBtn.addEventListener('click', () => {
        currentState.workoutStarted = true;
        elements.startWorkoutBtn.disabled = true;
        elements.completeWorkoutBtn.disabled = false;
        elements.startWorkoutBtn.textContent = 'Workout in Progress...';
        
        // Start timer (simplified)
        const startTime = new Date();
        localStorage.setItem('workoutStartTime', startTime.toISOString());
    });
    
    // Complete workout
    elements.completeWorkoutBtn.addEventListener('click', () => {
        saveProgressForWorkout();
        currentState.workoutStarted = false;
        
        // Auto-advance to next day
        currentState.day = (currentState.day + 1) % 3;
        if (currentState.day === 0) {
            currentState.week = currentState.week === 4 ? 1 : currentState.week + 1;
            if (currentState.week === 1) currentState.cycle++;
        }
        
        saveState();
        renderWorkout();
        
        // Reset buttons
        elements.startWorkoutBtn.disabled = false;
        elements.completeWorkoutBtn.disabled = true;
        elements.startWorkoutBtn.textContent = 'Start Workout';
        
        // Show completion message
        alert('Workout completed! Progress saved. Auto-advanced to next session.');
    });
    
    // Navigation
    elements.prevDayBtn.addEventListener('click', () => {
        currentState.day = currentState.day > 0 ? currentState.day - 1 : 2;
        if (currentState.day === 2) {
            currentState.week = currentState.week > 1 ? currentState.week - 1 : 4;
            if (currentState.week === 4) currentState.cycle = Math.max(1, currentState.cycle - 1);
        }
        saveState();
        renderWorkout();
    });
    
    elements.nextDayBtn.addEventListener('click', () => {
        currentState.day = (currentState.day + 1) % 3;
        if (currentState.day === 0) {
            currentState.week = currentState.week === 4 ? 1 : currentState.week + 1;
            if (currentState.week === 1) currentState.cycle++;
        }
        saveState();
        renderWorkout();
    });
    
    // Reset week
    elements.resetWeekBtn.addEventListener('click', () => {
        if (confirm('Reset current week progress?')) {
            currentState.day = 0;
            saveState();
            renderWorkout();
        }
    });
    
    // Deload week
    elements.deloadWeekBtn.addEventListener('click', () => {
        if (confirm('Start deload week? This will reset to week 4 (recovery).')) {
            currentState.week = 4;
            currentState.day = 0;
            saveState();
            renderWorkout();
        }
    });
    
    // Bodyweight input
    elements.bodyweightInput.addEventListener('change', () => {
        currentState.bodyweight = parseInt(elements.bodyweightInput.value) || 140;
        saveState();
    });
    
    // Modal close
    elements.closeModalBtn.addEventListener('click', () => {
        elements.exerciseModal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === elements.exerciseModal) {
            elements.exerciseModal.style.display = 'none';
        }
    });
    
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            // Add to clicked
            btn.classList.add('active');
            // Switch view (simplified - would show/hide sections)
            const view = btn.dataset.view;
            console.log(`Switch to ${view} view`);
        });
    });
    
    // Auto-save progress on input change
    document.addEventListener('input', (e) => {
        if (e.target.matches('.set-inputs input')) {
            // Auto-save progress after a delay
            clearTimeout(window.progressSaveTimeout);
            window.progressSaveTimeout = setTimeout(saveProgressForWorkout, 1000);
        }
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Service Worker for PWA (optional for GitHub Pages)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}