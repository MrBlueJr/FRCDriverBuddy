// API Configuration
const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';
const STATBOTICS_BASE_URL = 'https://api.statbotics.io/v3';

// State
let config = {
    teamNumber: localStorage.getItem('frc_team') || '',
    eventKey: localStorage.getItem('frc_event') || '',
    tbaKey: localStorage.getItem('frc_tba_key') || ''
};
let eventMatches = [];

// DOM Elements
const views = {
    dashboard: document.getElementById('dashboard'),
    matchDetails: document.getElementById('matchDetails'),
    strategyBoard: document.getElementById('strategyBoard')
};
const settingsModal = document.getElementById('settingsModal');
const matchList = document.getElementById('matchList');

// Initialize
function init() {
    setupEventListeners();
    setupCanvas();

    if (!config.teamNumber || !config.eventKey || !config.tbaKey) {
        openSettings();
    } else {
        loadDashboard();
    }
}

function setupEventListeners() {
    document.getElementById('sidebarSettingsBtn').addEventListener('click', openSettings);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('backBtn').addEventListener('click', () => showView('dashboard'));

    // Sidebar toggle
    document.getElementById('toggleSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Navigation buttons
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showView(btn.dataset.view);
            if (btn.dataset.view === 'strategyBoard') {
                resizeCanvas();
            }
        });
    });

    // Fullscreen toggle
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullScreen);
    }

    document.addEventListener('fullscreenchange', () => {
        const icon = document.querySelector('#fullscreenBtn i');
        if (icon) {
            if (document.fullscreenElement) {
                icon.classList.remove('fa-expand');
                icon.classList.add('fa-compress');
            } else {
                icon.classList.remove('fa-compress');
                icon.classList.add('fa-expand');
            }
        }
    });
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function showView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active');
}

function openSettings() {
    document.getElementById('teamNumber').value = config.teamNumber;
    document.getElementById('eventKey').value = config.eventKey;
    document.getElementById('tbaKey').value = config.tbaKey;
    settingsModal.classList.remove('hidden');
}

function saveSettings() {
    config.teamNumber = document.getElementById('teamNumber').value;
    config.eventKey = document.getElementById('eventKey').value;
    config.tbaKey = document.getElementById('tbaKey').value;

    localStorage.setItem('frc_team', config.teamNumber);
    localStorage.setItem('frc_event', config.eventKey);
    localStorage.setItem('frc_tba_key', config.tbaKey);

    settingsModal.classList.add('hidden');
    loadDashboard();
}

// API Helper
async function fetchTBA(endpoint) {
    const response = await fetch(`${TBA_BASE_URL}${endpoint}`, {
        headers: {
            'X-TBA-Auth-Key': config.tbaKey,
            'Accept': 'application/json'
        }
    });
    if (!response.ok) throw new Error(`TBA API Error: ${response.status}`);
    return await response.json();
}

async function fetchStatbotics(endpoint) {
    const response = await fetch(`${STATBOTICS_BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(`Statbotics API Error: ${response.status}`);
    return await response.json();
}

async function loadDashboard() {
    try {
        document.getElementById('myTeamTitle').textContent = `Team ${config.teamNumber}`;
        document.getElementById('eventTitle').textContent = `Loading ${config.eventKey}...`;
        matchList.innerHTML = '<div class="spinner"></div>';

        // Fetch matches for the team at the event
        const matches = await fetchTBA(`/team/frc${config.teamNumber}/event/${config.eventKey}/matches`);

        // Fetch event details for title
        const eventInfo = await fetchTBA(`/event/${config.eventKey}`);
        document.getElementById('eventTitle').textContent = eventInfo.name;

        // Sort matches by level and number
        const levelOrder = { 'qm': 1, 'ef': 2, 'qf': 3, 'sf': 4, 'f': 5 };
        eventMatches = matches.sort((a, b) => {
            if (levelOrder[a.comp_level] !== levelOrder[b.comp_level]) {
                return levelOrder[a.comp_level] - levelOrder[b.comp_level];
            }
            if (a.set_number !== b.set_number) {
                return a.set_number - b.set_number;
            }
            return a.match_number - b.match_number;
        });

        renderMatchList();
    } catch (error) {
        console.error(error);
        matchList.innerHTML = `<p style="color: #ff3366;">Error loading data. Check API keys and event info.</p>`;
    }
}

function renderMatchList() {
    const pastMatchList = document.getElementById('pastMatchList');
    matchList.innerHTML = '';
    if (pastMatchList) pastMatchList.innerHTML = '';

    const strategySelect = document.getElementById('strategyMatchSelect');
    // Keep the default option
    strategySelect.innerHTML = '<option value="">Select Match...</option>';

    if (eventMatches.length === 0) {
        matchList.innerHTML = '<p>No matches found.</p>';
        return;
    }

    let upcomingCount = 0;
    let pastCount = 0;

    eventMatches.forEach((match, index) => {
        const item = document.createElement('div');
        item.className = 'match-item';

        // Parse match name nicely
        const compLevelMap = { 'qm': 'Quals', 'ef': 'Eighths', 'qf': 'Quarters', 'sf': 'Semis', 'f': 'Finals' };
        const matchName = `${compLevelMap[match.comp_level] || match.comp_level} ${match.match_number}`;

        const timeStr = match.time ? new Date(match.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';

        item.innerHTML = `
            <div class="match-name">${matchName}</div>
            <div class="match-time">${timeStr}</div>
        `;

        item.addEventListener('click', () => loadMatchDetails(match));

        // Determine if match is past
        if (match.winning_alliance || match.post_result_time) {
            if (pastMatchList) pastMatchList.appendChild(item);
            pastCount++;
        } else {
            matchList.appendChild(item);
            upcomingCount++;
        }

        // Add to strategy select
        const option = document.createElement('option');
        option.value = index; // Store index to retrieve later
        option.textContent = `${matchName} (${timeStr})`;
        strategySelect.appendChild(option);
    });

    if (upcomingCount === 0) matchList.innerHTML = '<p>No upcoming matches.</p>';
    if (pastCount === 0 && pastMatchList) pastMatchList.innerHTML = '<p>No past matches.</p>';
}

async function loadMatchDetails(match) {
    showView('matchDetails');
    const compLevelMap = { 'qm': 'Quals', 'ef': 'Eighths', 'qf': 'Quarters', 'sf': 'Semis', 'f': 'Finals' };
    document.getElementById('matchTitle').textContent = `${compLevelMap[match.comp_level] || match.comp_level} ${match.match_number}`;

    const redContainer = document.getElementById('redTeams');
    const blueContainer = document.getElementById('blueTeams');
    const predictionEl = document.getElementById('matchPrediction');

    redContainer.innerHTML = '<div class="spinner"></div>';
    blueContainer.innerHTML = '<div class="spinner"></div>';
    if (predictionEl) {
        predictionEl.textContent = 'Loading prediction...';
        predictionEl.style.color = 'var(--text-muted)';
    }

    const redTeams = match.alliances.red.team_keys.map(k => k.replace('frc', ''));
    const blueTeams = match.alliances.blue.team_keys.map(k => k.replace('frc', ''));

    // Fetch Statbotics prediction
    if (predictionEl) {
        fetchStatbotics(`/match/${match.key}`)
            .then(data => {
                if (data && data.epa_win_prob !== undefined) {
                    const isRedFavored = data.epa_win_prob >= 0.5;
                    const prob = isRedFavored ? data.epa_win_prob : (1 - data.epa_win_prob);
                    const percent = (prob * 100).toFixed(1);
                    predictionEl.textContent = `${isRedFavored ? 'Red' : 'Blue'} Predicted to win (${percent}%)`;
                    predictionEl.style.color = isRedFavored ? 'var(--accent-red)' : 'var(--accent-blue)';
                } else {
                    predictionEl.textContent = '';
                }
            })
            .catch(() => predictionEl.textContent = '');
    }

    // Fetch and render parallel
    const redPromises = redTeams.map(t => fetchAndRenderTeam(t, redContainer));
    const bluePromises = blueTeams.map(t => fetchAndRenderTeam(t, blueContainer));

    await Promise.all([
        Promise.all(redPromises).then(() => {
            redContainer.querySelector('.spinner')?.remove();
        }),
        Promise.all(bluePromises).then(() => {
            blueContainer.querySelector('.spinner')?.remove();
        })
    ]);
}

async function fetchAndRenderTeam(teamNumber, container) {
    const template = document.getElementById('teamCardTemplate');
    const clone = template.content.cloneNode(true);

    const card = clone.querySelector('.team-card');
    clone.querySelector('.team-number-badge').textContent = teamNumber;

    // Highlight user's team
    if (teamNumber === config.teamNumber) {
        card.style.border = '2px solid var(--accent-blue)';
        card.style.boxShadow = '0 0 15px var(--accent-blue-dim)';
    }

    container.appendChild(clone);

    // Fetch Data
    const year = config.eventKey.substring(0, 4);

    try {
        // Fetch Statbotics EPA
        let statbotics = null;
        try {
            statbotics = await fetchStatbotics(`/team_year/${teamNumber}/${year}`);
        } catch (e) {
            try {
                statbotics = await fetchStatbotics(`/team_year/${teamNumber}/${parseInt(year) - 1}`);
            } catch (e2) {
                // If team_year fails entirely, fallback to global team endpoint
                statbotics = await fetchStatbotics(`/team/${teamNumber}`);
            }
        }

        card.querySelector('.team-name').textContent = statbotics.name || `Team ${teamNumber}`;
        const epaVal = statbotics.epa || statbotics.norm_epa || 0;
        card.querySelector('.epa-total').textContent = epaVal.toFixed(1);
        card.querySelector('.epa-auto').textContent = statbotics.auto_epa !== undefined ? statbotics.auto_epa.toFixed(1) : '-';
        card.querySelector('.epa-teleop').textContent = statbotics.teleop_epa !== undefined ? statbotics.teleop_epa.toFixed(1) : '-';
        card.querySelector('.epa-endgame').textContent = statbotics.endgame_epa !== undefined ? statbotics.endgame_epa.toFixed(1) : '-';

        // Fetch Photo from TBA
        let media = null;
        let photoYear = parseInt(year);
        // Fallback up to 4 years back to find a photo
        for (let y = photoYear; y >= photoYear - 4; y--) {
            media = await fetchTBA(`/team/frc${teamNumber}/media/${y}`);
            if (media && media.length > 0) {
                photoYear = y;
                break;
            }
        }

        const imgElement = card.querySelector('.team-photo');

        // Find best photo (Imgur or Instagram or direct URL)
        let photoUrl = null;
        if (media && media.length > 0) {
            for (let m of media) {
                if (m.type === 'imgur') {
                    photoUrl = `https://i.imgur.com/${m.foreign_key}.jpg`;
                    break;
                } else if (m.type === 'cdphotothread') {
                    if (m.direct_url) {
                        photoUrl = m.direct_url;
                        break;
                    } else if (m.details && m.details.image_partial) {
                        photoUrl = `https://www.chiefdelphi.com/uploads/default/original/${m.details.image_partial}`;
                        break;
                    }
                }
            }
        }

        if (photoUrl) {
            imgElement.src = photoUrl;
        } else {
            // Fallback avatar
            imgElement.src = `https://www.thebluealliance.com/avatar/${year}/frc${teamNumber}`;
            imgElement.onerror = () => {
                imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="white"><path d="M448 64h-80V32c0-17.6-14.4-32-32-32H176c-17.6 0-32 14.4-32 32v32H64C28.7 64 0 92.7 0 128v288c0 35.3 28.7 64 64 64h384c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64zm-160 0h-64V32h64v32zM192 384h-64v-64h64v64zm0-128h-64v-64h64v64zm192 128h-64v-64h64v64zm0-128h-64v-64h64v64z"/></svg>';
                imgElement.classList.add('placeholder');
            };
        }

    } catch (error) {
        console.error(`Failed to load data for team ${teamNumber}`, error);
        card.querySelector('.team-name').textContent = `Team ${teamNumber}`;
        card.querySelectorAll('.stat-value').forEach(el => el.textContent = '-');
    }
}

// --- Strategy Board Canvas Logic ---
const canvas = document.getElementById('strategyCanvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let isErasing = false;
let currentMode = 'draw';
let currentStroke = null; // active stroke being drawn

let currentStrategyMatch = -1;
let currentStage = 'start'; // 'start', 'auto', 'teleop', 'endgame'
const strategyState = {};
const brushCursor = document.getElementById('brushCursor');

function setupCanvas() {
    const eraserBtn = document.getElementById('eraserBtn');
    const clearBtn = document.getElementById('clearBoardBtn');

    document.getElementById('strategyFullscreenBtn').addEventListener('click', toggleStrategyFullscreen);
    document.getElementById('downloadStrategyBtn').addEventListener('click', downloadStrategyBoard);

    document.getElementById('saveAutoBtn').addEventListener('click', openSaveAutoModal);
    document.getElementById('loadAutoBtn').addEventListener('click', openLoadAutoModal);
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('saveAutoModal').classList.add('hidden');
            document.getElementById('loadAutoModal').classList.add('hidden');
        });
    });
    document.getElementById('confirmSaveAutoBtn').addEventListener('click', saveAutoToLibrary);
    document.getElementById('confirmLoadAutoBtn').addEventListener('click', loadAutoFromLibrary);

    window.addEventListener('resize', () => {
        if (!views.strategyBoard.classList.contains('hidden')) {
            resizeCanvas();
        }
    });

    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', handleCanvasMouseOut);

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    document.addEventListener('mouseup', stopDrawing);

    // Brush cursor size preview
    const drawSizeSlider = document.getElementById('drawSize');
    drawSizeSlider.addEventListener('input', updateBrushCursorSize);

    eraserBtn.addEventListener('click', () => {
        currentMode = currentMode === 'erase' ? 'draw' : 'erase';
        isErasing = currentMode === 'erase';
        eraserBtn.classList.toggle('active', currentMode === 'erase');
        canvas.style.cursor = 'none';
        updateBrushCursorStyle();
    });

    clearBtn.addEventListener('click', () => {
        if (currentStrategyMatch === -1) return;
        strategyState[currentStrategyMatch].strokes[currentStage] = [];
        redrawCanvas();
    });

    // Match select logic
    document.getElementById('strategyMatchSelect').addEventListener('change', (e) => {
        const matchIndex = e.target.value;
        if (matchIndex === '') {
            document.getElementById('robotOverlays').innerHTML = '';
            document.getElementById('stageSelector').classList.add('hidden');
            currentStrategyMatch = -1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        document.getElementById('stageSelector').classList.remove('hidden');
        currentStrategyMatch = matchIndex;
        currentStage = 'start';

        document.querySelectorAll('.stage-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.stage-btn[data-stage="start"]').classList.add('active');

        if (!strategyState[matchIndex]) {
            initStrategyState(matchIndex);
        }
        loadCurrentStage();
    });

    // Stage select logic
    document.querySelectorAll('.stage-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newStage = e.target.dataset.stage;
            if (newStage === currentStage || currentStrategyMatch === -1) return;

            document.querySelectorAll('.stage-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentStage = newStage;

            loadCurrentStage();
        });
    });

    // Global events for robot dragging
    document.addEventListener('mousemove', handleRobotDrag);
    document.addEventListener('mouseup', stopRobotDrag);
    document.addEventListener('touchmove', handleRobotDrag, { passive: false });
    document.addEventListener('touchend', stopRobotDrag);
}

// --- Strategy State Logic ---
function initStrategyState(matchIndex) {
    const state = {
        strokes: { start: [], auto: [], teleop: [], endgame: [] },
        positions: { start: {}, auto: {}, teleop: {}, endgame: {} },
        paths: { auto: {}, teleop: {}, endgame: {} },
        teams: { red: [], blue: [] }
    };

    const match = eventMatches[matchIndex];
    state.teams.red = match.alliances.red.team_keys.map(k => k.replace('frc', ''));
    state.teams.blue = match.alliances.blue.team_keys.map(k => k.replace('frc', ''));

    const startPositions = {
        red: [{ x: 10, y: 25 }, { x: 10, y: 50 }, { x: 10, y: 75 }],
        blue: [{ x: 90, y: 75 }, { x: 90, y: 50 }, { x: 90, y: 25 }]
    };

    state.teams.red.forEach((team, i) => { state.positions.start[team] = startPositions.red[i]; });
    state.teams.blue.forEach((team, i) => { state.positions.start[team] = startPositions.blue[i]; });

    strategyState[matchIndex] = state;
}

function getCascadePosition(matchState, stage, team) {
    const order = ['start', 'auto', 'teleop', 'endgame'];
    let idx = order.indexOf(stage);
    while (idx >= 0) {
        const s = order[idx];
        if (matchState.positions[s] && matchState.positions[s][team]) {
            return matchState.positions[s][team];
        }
        idx--;
    }
    return { x: 50, y: 50 }; // fallback
}

function loadCurrentStage() {
    if (currentStrategyMatch === -1) return;
    const matchState = strategyState[currentStrategyMatch];

    const overlays = document.getElementById('robotOverlays');
    overlays.innerHTML = '';

    // Place robots at cascaded position
    const allTeams = [...matchState.teams.red, ...matchState.teams.blue];
    allTeams.forEach(team => {
        const alliance = matchState.teams.red.includes(team) ? 'red' : 'blue';
        const pos = getCascadePosition(matchState, currentStage, team);
        overlays.appendChild(createRobotMarker(team, alliance, pos.x, pos.y));
    });

    redrawCanvas();
}

function redrawCanvas() {
    if (currentStrategyMatch === -1) return;
    const matchState = strategyState[currentStrategyMatch];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    // 1. Draw robot drag paths for current stage
    if (currentStage !== 'start' && matchState.paths[currentStage]) {
        Object.entries(matchState.paths[currentStage]).forEach(([team, path]) => {
            if (!path || path.length < 2) return;

            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = matchState.teams.red.includes(team) ? '#ff3366' : '#00d2ff';

            ctx.beginPath();
            const startPxX = (path[0].x / 100) * canvas.width;
            const startPxY = (path[0].y / 100) * canvas.height;
            ctx.moveTo(startPxX, startPxY);

            for (let i = 1; i < path.length; i++) {
                ctx.lineTo((path[i].x / 100) * canvas.width, (path[i].y / 100) * canvas.height);
            }
            ctx.stroke();
        });
    }

    // 2. Draw freehand strokes from vector history
    const strokes = matchState.strokes[currentStage] || [];
    ctx.globalCompositeOperation = 'source-over';
    strokes.forEach(stroke => {
        if (!stroke.points || stroke.points.length < 2) return;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
    });
}

// --- Robot Placement & Dragging ---
let draggedRobot = null;
let dragHasMoved = false;

function createRobotMarker(teamNumber, alliance, startX, startY) {
    const el = document.createElement('div');
    el.className = `robot-marker ${alliance}`;
    el.textContent = teamNumber;
    el.style.left = `${startX}%`;
    el.style.top = `${startY}%`;

    const startDrag = (e) => {
        if (e.type === 'touchstart') e.preventDefault();

        if (currentMode === 'erase' && currentStage !== 'start') {
            // Erase this robot's path
            const matchState = strategyState[currentStrategyMatch];
            matchState.paths[currentStage][teamNumber] = [];
            // Reset position to previous stage
            const prevOrder = ['start', 'auto', 'teleop', 'endgame'];
            const prevStage = prevOrder[prevOrder.indexOf(currentStage) - 1];
            const oldPos = getCascadePosition(matchState, prevStage, teamNumber);
            matchState.positions[currentStage][teamNumber] = oldPos;

            el.style.left = `${oldPos.x}%`;
            el.style.top = `${oldPos.y}%`;

            redrawCanvas();
            return;
        }

        draggedRobot = el;
        dragHasMoved = false;

        if (currentStage !== 'start') {
            const matchState = strategyState[currentStrategyMatch];
            if (!matchState.paths[currentStage][teamNumber]) {
                matchState.paths[currentStage][teamNumber] = [];
            }
            // Push starting point of this drag
            matchState.paths[currentStage][teamNumber].push({
                x: parseFloat(el.style.left),
                y: parseFloat(el.style.top)
            });
        }
    };

    el.addEventListener('mousedown', startDrag);
    el.addEventListener('touchstart', startDrag, { passive: false });

    return el;
}

function handleRobotDrag(e) {
    if (!draggedRobot) return;
    e.preventDefault();
    dragHasMoved = true;

    const container = document.querySelector('.canvas-container');
    const rect = container.getBoundingClientRect();

    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    draggedRobot.style.left = `${x}%`;
    draggedRobot.style.top = `${y}%`;

    const team = draggedRobot.textContent;
    const matchState = strategyState[currentStrategyMatch];

    // Update end position
    matchState.positions[currentStage][team] = { x, y };

    if (currentStage !== 'start') {
        matchState.paths[currentStage][team].push({ x, y });
        redrawCanvas();
    }
}

function stopRobotDrag() {
    draggedRobot = null;
}

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    redrawCanvas();
}

// --- Manual Drawing (Freehand) ---
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

function getClientPos(e) {
    if (e.touches && e.touches.length > 0) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
}

// --- Brush Cursor ---
function updateBrushCursorSize() {
    const size = parseInt(document.getElementById('drawSize').value);
    const rect = canvas.getBoundingClientRect();
    // Scale the brush size from canvas pixels to screen pixels
    const screenSize = Math.max(6, size * (rect.width / canvas.width));
    brushCursor.style.width = `${screenSize}px`;
    brushCursor.style.height = `${screenSize}px`;
}

function updateBrushCursorStyle() {
    if (currentMode === 'erase') {
        brushCursor.style.borderColor = 'rgba(255, 80, 80, 0.9)';
        brushCursor.style.borderWidth = '2px';
    } else {
        brushCursor.style.borderColor = 'rgba(255, 255, 255, 0.8)';
        brushCursor.style.borderWidth = '1px';
    }
}

function positionBrushCursor(e) {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();
    const { clientX, clientY } = getClientPos(e);
    brushCursor.style.left = `${clientX - containerRect.left}px`;
    brushCursor.style.top = `${clientY - containerRect.top}px`;
    brushCursor.style.display = 'block';
    updateBrushCursorSize();
}

// --- Stroke Eraser (hit-test) ---
function findStrokeAtPoint(pos) {
    if (currentStrategyMatch === -1) return -1;
    const strokes = strategyState[currentStrategyMatch].strokes[currentStage] || [];
    const hitRadius = 10; // pixels proximity threshold

    // Search in reverse so topmost strokes get priority
    for (let i = strokes.length - 1; i >= 0; i--) {
        const stroke = strokes[i];
        for (let j = 0; j < stroke.points.length - 1; j++) {
            const p1 = stroke.points[j];
            const p2 = stroke.points[j + 1];
            const dist = distToSegment(pos, p1, p2);
            if (dist < hitRadius + stroke.size / 2) {
                return i;
            }
        }
    }
    return -1;
}

function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = v.x + t * (w.x - v.x);
    const projY = v.y + t * (w.y - v.y);
    return Math.hypot(p.x - projX, p.y - projY);
}

function findPathAtPoint(pos) {
    if (currentStrategyMatch === -1) return null;
    const matchState = strategyState[currentStrategyMatch];
    if (!matchState.paths[currentStage]) return null;

    const paths = matchState.paths[currentStage];
    const hitRadius = 8; // pixels

    for (const [team, path] of Object.entries(paths)) {
        if (!path || path.length < 2) continue;
        const pixelPoints = path.map(point => ({
            x: (point.x / 100) * canvas.width,
            y: (point.y / 100) * canvas.height
        }));

        for (let i = 0; i < pixelPoints.length - 1; i++) {
            const p1 = pixelPoints[i];
            const p2 = pixelPoints[i + 1];
            if (distToSegment(pos, p1, p2) <= hitRadius) {
                return team;
            }
        }
    }

    return null;
}

function clearRobotPath(team) {
    if (currentStrategyMatch === -1) return false;
    const matchState = strategyState[currentStrategyMatch];
    if (!matchState.paths[currentStage] || !matchState.paths[currentStage][team]) return false;

    matchState.paths[currentStage][team] = [];
    const prevOrder = ['start', 'auto', 'teleop', 'endgame'];
    const prevStage = prevOrder[prevOrder.indexOf(currentStage) - 1];
    if (prevStage) {
        const oldPos = getCascadePosition(matchState, prevStage, team);
        matchState.positions[currentStage][team] = oldPos;
    }
    redrawCanvas();
    return true;
}

// --- Canvas Event Handlers ---
function handleCanvasMouseDown(e) {
    if (currentMode === 'erase') {
        isDrawing = true;
        const pos = getPos(e);
        const pathTeam = findPathAtPoint(pos);
        if (pathTeam) {
            clearRobotPath(pathTeam);
            return;
        }

        const idx = findStrokeAtPoint(pos);
        if (idx !== -1) {
            strategyState[currentStrategyMatch].strokes[currentStage].splice(idx, 1);
            redrawCanvas();
        }
        return;
    }
    startDrawing(e);
}

function handleCanvasMouseMove(e) {
    positionBrushCursor(e);
    if (currentMode === 'erase') {
        const pos = getPos(e);
        const pathTeam = findPathAtPoint(pos);
        const strokeIdx = findStrokeAtPoint(pos);
        canvas.style.cursor = 'none';
        if (pathTeam || strokeIdx !== -1) {
            brushCursor.style.borderColor = 'rgba(255, 80, 80, 1)';
            brushCursor.style.background = 'rgba(255, 80, 80, 0.15)';
            if (isDrawing) {
                if (pathTeam) {
                    clearRobotPath(pathTeam);
                } else if (strokeIdx !== -1) {
                    strategyState[currentStrategyMatch].strokes[currentStage].splice(strokeIdx, 1);
                    redrawCanvas();
                }
            }
        } else {
            brushCursor.style.borderColor = 'rgba(255, 80, 80, 0.9)';
            brushCursor.style.background = 'transparent';
        }
        return;
    }
    canvas.style.cursor = 'none';
    draw(e);
}

function handleCanvasMouseOut(e) {
    brushCursor.style.display = 'none';
    stopDrawing();
}

function handleTouchStart(e) {
    e.preventDefault();
    if (currentMode === 'erase') {
        isDrawing = true;
        handleCanvasMouseDown(e);
    } else {
        startDrawing(e);
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    if (currentMode === 'erase') {
        positionBrushCursor(e);
        const pos = getPos(e);
        const idx = findStrokeAtPoint(pos);
        if (idx !== -1) {
            strategyState[currentStrategyMatch].strokes[currentStage].splice(idx, 1);
            redrawCanvas();
        }
    } else {
        draw(e);
        positionBrushCursor(e);
    }
}

function startDrawing(e) {
    if (currentStrategyMatch === -1) return;
    isDrawing = true;
    const pos = getPos(e);
    const color = document.getElementById('drawColor').value;
    const size = parseInt(document.getElementById('drawSize').value);
    currentStroke = { color, size, points: [pos] };
}

function draw(e) {
    if (!isDrawing || !currentStroke) return;
    const pos = getPos(e);
    currentStroke.points.push(pos);

    // Live preview: redraw everything then draw the in-progress stroke
    redrawCanvas();
    if (currentStroke.points.length >= 2) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = currentStroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentStroke.color;
        ctx.beginPath();
        ctx.moveTo(currentStroke.points[0].x, currentStroke.points[0].y);
        for (let i = 1; i < currentStroke.points.length; i++) {
            ctx.lineTo(currentStroke.points[i].x, currentStroke.points[i].y);
        }
        ctx.stroke();
    }
}

function stopDrawing() {
    if (isDrawing && currentStroke && currentStroke.points.length >= 2) {
        // Commit the stroke to history
        if (currentStrategyMatch !== -1) {
            strategyState[currentStrategyMatch].strokes[currentStage].push(currentStroke);
        }
    }
    isDrawing = false;
    currentStroke = null;
    redrawCanvas();
}

function toggleStrategyFullscreen() {
    const strategySection = document.getElementById('strategyBoard');
    if (!document.fullscreenElement) {
        strategySection.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

function downloadStrategyBoard() {
    if (currentStrategyMatch === -1) return;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const octx = offCanvas.getContext('2d');

    const bgImg = new Image();
    bgImg.src = 'field.png';
    bgImg.onload = () => {
        octx.drawImage(bgImg, 0, 0, offCanvas.width, offCanvas.height);
        octx.drawImage(canvas, 0, 0);

        const markers = document.querySelectorAll('.robot-marker');
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.font = '800 16px Outfit, sans-serif';

        markers.forEach(m => {
            const x = parseFloat(m.style.left) / 100 * offCanvas.width;
            const y = parseFloat(m.style.top) / 100 * offCanvas.height;
            const isRed = m.classList.contains('red');
            const team = m.textContent;

            octx.fillStyle = isRed ? 'rgba(255, 51, 102, 0.9)' : 'rgba(0, 210, 255, 0.9)';
            octx.strokeStyle = isRed ? '#ff3366' : '#00d2ff';
            octx.lineWidth = 2;

            octx.beginPath();
            if (octx.roundRect) {
                octx.roundRect(x - 22.5, y - 22.5, 45, 45, 8);
            } else {
                octx.rect(x - 22.5, y - 22.5, 45, 45); // fallback
            }
            octx.fill();
            octx.stroke();

            octx.fillStyle = 'white';
            octx.fillText(team, x, y);
        });

        const link = document.createElement('a');
        link.download = `Strategy_Match_${currentStrategyMatch}_${currentStage}.png`;
        link.href = offCanvas.toDataURL('image/png');
        link.click();
    };
}

// --- Auto Library Logic ---
function openSaveAutoModal() {
    if (currentStrategyMatch === -1 || currentStage !== 'auto') {
        alert("You can only save autos when viewing the 'Auto' stage of a match.");
        return;
    }
    const matchState = strategyState[currentStrategyMatch];
    const teamSelect = document.getElementById('saveAutoTeam');
    teamSelect.innerHTML = '';

    const allTeams = [...matchState.teams.red, ...matchState.teams.blue];
    allTeams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team;
        opt.textContent = `Team ${team}`;
        teamSelect.appendChild(opt);
    });

    document.getElementById('saveAutoModal').classList.remove('hidden');
}

function saveAutoToLibrary() {
    const team = document.getElementById('saveAutoTeam').value;
    const name = document.getElementById('saveAutoName').value.trim();
    if (!name) return alert("Please enter a name for the auto.");

    const matchState = strategyState[currentStrategyMatch];
    const path = matchState.paths.auto[team] || [];

    let library = JSON.parse(localStorage.getItem('frc_autos') || '{}');
    if (!library[team]) library[team] = {};
    library[team][name] = path;

    localStorage.setItem('frc_autos', JSON.stringify(library));
    document.getElementById('saveAutoModal').classList.add('hidden');
    document.getElementById('saveAutoName').value = '';
}

function openLoadAutoModal() {
    if (currentStrategyMatch === -1 || currentStage !== 'auto') {
        alert("You can only load autos when viewing the 'Auto' stage of a match.");
        return;
    }

    const matchState = strategyState[currentStrategyMatch];
    const teamSelect = document.getElementById('loadAutoTeam');
    teamSelect.innerHTML = '';

    const allTeams = [...matchState.teams.red, ...matchState.teams.blue];
    allTeams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team;
        opt.textContent = `Team ${team}`;
        teamSelect.appendChild(opt);
    });

    updateLoadAutoList();
    teamSelect.addEventListener('change', updateLoadAutoList);

    document.getElementById('loadAutoModal').classList.remove('hidden');
}

function updateLoadAutoList() {
    const team = document.getElementById('loadAutoTeam').value;
    const list = document.getElementById('loadAutoSelect');
    list.innerHTML = '';

    let library = JSON.parse(localStorage.getItem('frc_autos') || '{}');
    const teamAutos = library[team] || {};

    const names = Object.keys(teamAutos);
    if (names.length === 0) {
        list.innerHTML = '<option value="">No autos found for this team</option>';
    } else {
        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            list.appendChild(opt);
        });
    }
}

function loadAutoFromLibrary() {
    const team = document.getElementById('loadAutoTeam').value;
    const name = document.getElementById('loadAutoSelect').value;
    if (!name) return;

    let library = JSON.parse(localStorage.getItem('frc_autos') || '{}');
    const path = library[team][name];

    if (path) {
        const matchState = strategyState[currentStrategyMatch];
        matchState.paths.auto[team] = path;

        if (path.length > 0) {
            matchState.positions.auto[team] = path[path.length - 1];

            // Snap robot marker
            const markers = document.querySelectorAll('.robot-marker');
            markers.forEach(m => {
                if (m.textContent === team) {
                    m.style.left = `${path[path.length - 1].x}%`;
                    m.style.top = `${path[path.length - 1].y}%`;
                }
            });
        }

        redrawCanvas();
    }

    document.getElementById('loadAutoModal').classList.add('hidden');
}

// Start
document.addEventListener('DOMContentLoaded', init);
