// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
    originalData: [],
    stagedData: [],
    columns: [],
    fileName: '',
    fileType: '',
    issues: [],
    autoFixes: [],
    pendingSuggestions: [],
    appliedChanges: [],
    rejectedChanges: [],
    ollamaConnected: false,
    selectedModel: 'qwen3:8b',
    chatHistory: [],
    changeHistory: [],
    settings: {
        theme: 'midnight',
        panelWidth: 400,
        chatHeight: 300,
        tableFont: 13,
        ollamaUrl: 'http://localhost:11434',
        maxPreviewRows: 200,
        // LLM Provider settings
        aiProvider: 'ollama',
        customApiUrl: '',
        customApiKey: '',
        customModelName: '',
        dontSaveApiKey: false
    },
    // Session-only API key (not persisted)
    sessionApiKey: '',
    context: {
        projectName: '',
        projectDescription: '',
        dataDescription: '',
        cleaningPrefs: ''
    },
    abortController: null
};

// Provider presets
const providerPresets = {
    ollama: { url: 'http://localhost:11434', hint: 'Run locally. Start with: <code>$env:OLLAMA_ORIGINS="*"; ollama serve</code>' },
    openai: { url: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], hint: 'Get API key from <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>' },
    anthropic: { url: 'https://api.anthropic.com/v1', models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'], hint: 'Get API key from <a href="https://console.anthropic.com/" target="_blank">console.anthropic.com</a>. Note: Requires CORS proxy for browser use.' },
    groq: { url: 'https://api.groq.com/openai/v1', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'], hint: 'Free tier available! Get key from <a href="https://console.groq.com/keys" target="_blank">console.groq.com</a>' },
    openrouter: { url: 'https://openrouter.ai/api/v1', models: ['google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.1-8b-instruct:free', 'anthropic/claude-3.5-sonnet'], hint: 'Access many models. Get key from <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai</a>' },
    together: { url: 'https://api.together.xyz/v1', models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'], hint: 'Get key from <a href="https://api.together.xyz/" target="_blank">together.ai</a>' },
    custom: { url: '', models: [], hint: 'Enter any OpenAI-compatible API endpoint' }
};

const themes = [
    { id: 'midnight', name: 'Midnight', colors: ['#08090a', '#00d4aa'] },
    { id: 'ocean', name: 'Ocean', colors: ['#0a1628', '#4cc9f0'] },
    { id: 'forest', name: 'Forest', colors: ['#0d1f0d', '#7cb342'] },
    { id: 'sunset', name: 'Sunset', colors: ['#1a0a0a', '#ff7e5f'] },
    { id: 'purple', name: 'Purple', colors: ['#13001a', '#bf5af2'] },
    { id: 'nord', name: 'Nord', colors: ['#2e3440', '#88c0d0'] },
    { id: 'monokai', name: 'Monokai', colors: ['#272822', '#a6e22e'] },
    { id: 'cyberpunk', name: 'Cyber', colors: ['#0a0a0f', '#ff00ff'] },
    { id: 'light', name: 'Light', colors: ['#ffffff', '#0066cc'] },
    { id: 'dracula', name: 'Dracula', colors: ['#282a36', '#bd93f9'] },
    { id: 'solarized', name: 'Solar', colors: ['#002b36', '#2aa198'] },
    { id: 'rosepine', name: 'Rosé', colors: ['#1f1d2e', '#ebbcba'] }
];

const uploadZone = document.getElementById('uploadZone');
const workspace = document.getElementById('workspace');
const fileInput = document.getElementById('fileInput');
const modelSelect = document.getElementById('modelSelect');

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupFileUpload();
    setupTabs();
    setupResizeHandles();
    renderThemeGrid();
    checkConnection();
});

function loadSettings() {
    try {
        const saved = localStorage.getItem('datascrub_settings');
        if (saved) state.settings = { ...state.settings, ...JSON.parse(saved) };
        const savedContext = localStorage.getItem('datascrub_context');
        if (savedContext) state.context = JSON.parse(savedContext);
    } catch (e) { console.log('Could not load settings'); }
    applySettings();
}

function applySettings() {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    document.documentElement.style.setProperty('--panel-width', state.settings.panelWidth + 'px');
    document.documentElement.style.setProperty('--chat-height', state.settings.chatHeight + 'px');
    document.documentElement.style.setProperty('--table-font', state.settings.tableFont + 'px');
}

function setupFileUpload() {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => { if (e.target.files[0]) processFile(e.target.files[0]); });
    modelSelect.addEventListener('change', (e) => { state.selectedModel = e.target.value; });
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            document.getElementById('originalTab').classList.toggle('hidden', tabName !== 'original');
            document.getElementById('stagedTab').classList.toggle('hidden', tabName !== 'staged');
            document.getElementById('reportTab').classList.toggle('hidden', tabName !== 'report');
        });
    });
}

function setupResizeHandles() {
    const resizeHandle = document.getElementById('resizeHandle');
    const chatResizeHandle = document.getElementById('chatResizeHandle');
    
    let isResizing = false;
    let startX, startWidth;
    
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = state.settings.panelWidth;
        resizeHandle.classList.add('active');
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResize);
    });
    
    function handleMouseMove(e) {
        if (!isResizing) return;
        const diff = startX - e.clientX;
        const newWidth = Math.min(600, Math.max(280, startWidth + diff));
        state.settings.panelWidth = newWidth;
        document.documentElement.style.setProperty('--panel-width', newWidth + 'px');
    }
    
    function stopResize() {
        isResizing = false;
        resizeHandle.classList.remove('active');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResize);
        saveSettingsToStorage();
    }
    
    // Chat resize
    let isChatResizing = false;
    let startY, startHeight;
    
    chatResizeHandle.addEventListener('mousedown', (e) => {
        isChatResizing = true;
        startY = e.clientY;
        startHeight = state.settings.chatHeight;
        chatResizeHandle.classList.add('active');
        document.addEventListener('mousemove', handleChatMove);
        document.addEventListener('mouseup', stopChatResize);
    });
    
    function handleChatMove(e) {
        if (!isChatResizing) return;
        const diff = startY - e.clientY;
        const newHeight = Math.min(500, Math.max(150, startHeight + diff));
        state.settings.chatHeight = newHeight;
        document.documentElement.style.setProperty('--chat-height', newHeight + 'px');
    }
    
    function stopChatResize() {
        isChatResizing = false;
        chatResizeHandle.classList.remove('active');
        document.removeEventListener('mousemove', handleChatMove);
        document.removeEventListener('mouseup', stopChatResize);
        saveSettingsToStorage();
    }
}

function saveSettingsToStorage() {
    try { localStorage.setItem('datascrub_settings', JSON.stringify(state.settings)); } catch (e) {}
}

// ============================================
// SETTINGS MODAL
// ============================================
function renderThemeGrid() {
    const grid = document.getElementById('themeGrid');
    grid.innerHTML = themes.map(t => `
        <button class="theme-btn ${state.settings.theme === t.id ? 'active' : ''}" 
                data-name="${t.name}" onclick="setTheme('${t.id}')"
                style="background: linear-gradient(135deg, ${t.colors[0]} 60%, ${t.colors[1]} 100%);">
        </button>
    `).join('');
}

function setTheme(themeId) {
    state.settings.theme = themeId;
    document.documentElement.setAttribute('data-theme', themeId);
    renderThemeGrid();
    saveSettingsToStorage();
}

function openSettings() {
    document.getElementById('panelWidthSlider').value = state.settings.panelWidth;
    document.getElementById('panelWidthValue').textContent = state.settings.panelWidth + 'px';
    document.getElementById('chatHeightSlider').value = state.settings.chatHeight;
    document.getElementById('chatHeightValue').textContent = state.settings.chatHeight + 'px';
    document.getElementById('tableFontSlider').value = state.settings.tableFont;
    document.getElementById('tableFontValue').textContent = state.settings.tableFont + 'px';
    document.getElementById('ollamaUrl').value = state.settings.ollamaUrl;
    document.getElementById('maxPreviewRows').value = state.settings.maxPreviewRows;
    
    // Provider settings
    document.getElementById('aiProvider').value = state.settings.aiProvider;
    document.getElementById('customApiUrl').value = state.settings.customApiUrl;
    document.getElementById('customModelName').value = state.settings.customModelName;
    document.getElementById('dontSaveApiKey').checked = state.settings.dontSaveApiKey;
    
    // Show API key from session or storage depending on mode
    if (state.settings.dontSaveApiKey) {
        document.getElementById('customApiKey').value = state.sessionApiKey;
    } else {
        document.getElementById('customApiKey').value = state.settings.customApiKey;
    }
    
    toggleProviderSettings();
    
    document.getElementById('settingsModal').classList.remove('hidden');
}

function toggleProviderSettings() {
    const provider = document.getElementById('aiProvider').value;
    const ollamaSettings = document.getElementById('ollamaSettings');
    const customSettings = document.getElementById('customLLMSettings');
    const presetsDiv = document.getElementById('providerPresets');
    const preset = providerPresets[provider];
    
    if (provider === 'ollama') {
        ollamaSettings.classList.remove('hidden');
        customSettings.classList.add('hidden');
    } else {
        ollamaSettings.classList.add('hidden');
        customSettings.classList.remove('hidden');
        
        // Pre-fill with preset values
        if (preset.url) {
            document.getElementById('customApiUrl').value = preset.url;
        }
        if (preset.models && preset.models.length > 0) {
            document.getElementById('customModelName').placeholder = preset.models[0];
            if (!document.getElementById('customModelName').value) {
                document.getElementById('customModelName').value = preset.models[0];
            }
        }
    }
    
    // Show hint
    if (preset.hint) {
        presetsDiv.classList.remove('hidden');
        presetsDiv.querySelector('.preset-hint').innerHTML = preset.hint;
    } else {
        presetsDiv.classList.add('hidden');
    }
}

function closeSettings() { document.getElementById('settingsModal').classList.add('hidden'); }

function updatePanelWidth(val) {
    state.settings.panelWidth = parseInt(val);
    document.documentElement.style.setProperty('--panel-width', val + 'px');
    document.getElementById('panelWidthValue').textContent = val + 'px';
}

function updateChatHeight(val) {
    state.settings.chatHeight = parseInt(val);
    document.documentElement.style.setProperty('--chat-height', val + 'px');
    document.getElementById('chatHeightValue').textContent = val + 'px';
}

function updateTableFont(val) {
    state.settings.tableFont = parseInt(val);
    document.documentElement.style.setProperty('--table-font', val + 'px');
    document.getElementById('tableFontValue').textContent = val + 'px';
}

function saveSettings() {
    state.settings.ollamaUrl = document.getElementById('ollamaUrl').value;
    state.settings.maxPreviewRows = parseInt(document.getElementById('maxPreviewRows').value);
    
    // Save provider settings
    state.settings.aiProvider = document.getElementById('aiProvider').value;
    state.settings.customApiUrl = document.getElementById('customApiUrl').value;
    state.settings.customModelName = document.getElementById('customModelName').value;
    state.settings.dontSaveApiKey = document.getElementById('dontSaveApiKey').checked;
    
    const apiKey = document.getElementById('customApiKey').value;
    
    if (state.settings.dontSaveApiKey) {
        // Store in session only (memory), clear from persistent storage
        state.sessionApiKey = apiKey;
        state.settings.customApiKey = ''; // Don't persist
    } else {
        // Store in persistent storage
        state.settings.customApiKey = apiKey;
        state.sessionApiKey = '';
    }
    
    saveSettingsToStorage();
    closeSettings();
    showToast('✓ Settings saved' + (state.settings.dontSaveApiKey ? ' (API key in session only)' : ''));
    
    // Re-check connection with new settings
    checkConnection();
    
    if (state.stagedData.length > 0) renderData();
}

function resetSettings() {
    state.settings = { 
        theme: 'midnight', panelWidth: 400, chatHeight: 300, tableFont: 13, 
        ollamaUrl: 'http://localhost:11434', maxPreviewRows: 200,
        aiProvider: 'ollama', customApiUrl: '', customApiKey: '', customModelName: '',
        dontSaveApiKey: false
    };
    state.sessionApiKey = '';
    applySettings();
    renderThemeGrid();
    saveSettingsToStorage();
    openSettings();
    showToast('Settings reset — API key cleared from storage');
}

// ============================================
// CONTEXT WINDOW
// ============================================
function openContextWindow() {
    document.getElementById('projectName').value = state.context.projectName;
    document.getElementById('projectDescription').value = state.context.projectDescription;
    document.getElementById('dataDescription').value = state.context.dataDescription;
    document.getElementById('cleaningPrefs').value = state.context.cleaningPrefs;
    document.getElementById('contextModal').classList.remove('hidden');
}

function closeContextWindow() { document.getElementById('contextModal').classList.add('hidden'); }

function saveContext() {
    state.context = {
        projectName: document.getElementById('projectName').value,
        projectDescription: document.getElementById('projectDescription').value,
        dataDescription: document.getElementById('dataDescription').value,
        cleaningPrefs: document.getElementById('cleaningPrefs').value
    };
    try { localStorage.setItem('datascrub_context', JSON.stringify(state.context)); } catch (e) {}
    closeContextWindow();
    showToast('✓ Context saved');
    if (state.ollamaConnected) {
        addChatMessage('assistant', `Got it! I'll keep your project context in mind: "${state.context.projectName || 'Unnamed project'}". This will help me make better cleaning decisions.`);
    }
}

function clearContext() {
    state.context = { projectName: '', projectDescription: '', dataDescription: '', cleaningPrefs: '' };
    document.getElementById('projectName').value = '';
    document.getElementById('projectDescription').value = '';
    document.getElementById('dataDescription').value = '';
    document.getElementById('cleaningPrefs').value = '';
    try { localStorage.removeItem('datascrub_context'); } catch (e) {}
    showToast('Context cleared');
}

function getContextPrompt() {
    if (!state.context.projectName && !state.context.projectDescription && !state.context.dataDescription && !state.context.cleaningPrefs) {
        return '';
    }
    let ctx = '\n\nPROJECT CONTEXT PROVIDED BY USER:\n';
    if (state.context.projectName) ctx += `Project: ${state.context.projectName}\n`;
    if (state.context.projectDescription) ctx += `Description: ${state.context.projectDescription}\n`;
    if (state.context.dataDescription) ctx += `Data info: ${state.context.dataDescription}\n`;
    if (state.context.cleaningPrefs) ctx += `Cleaning rules: ${state.context.cleaningPrefs}\n`;
    return ctx;
}

// Helper to get the active API key
function getActiveApiKey() {
    return state.settings.dontSaveApiKey ? state.sessionApiKey : state.settings.customApiKey;
}

// ============================================
// OLLAMA CONNECTION
// ============================================
async function checkConnection() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const provider = state.settings.aiProvider;
    
    try {
        if (provider === 'ollama') {
            // Ollama connection check
            const response = await fetch(state.settings.ollamaUrl + '/api/tags');
            if (response.ok) {
                const data = await response.json();
                state.ollamaConnected = true;
                statusDot.classList.add('connected');
                statusText.textContent = 'Ollama';
                if (data.models && data.models.length > 0) {
                    modelSelect.innerHTML = data.models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
                    state.selectedModel = data.models[0].name;
                }
                showToast('✓ Connected to Ollama');
            } else { throw new Error('Failed'); }
        } else {
            // Custom API check - validate we have the required settings
            const apiKey = getActiveApiKey();
            if (!apiKey) {
                throw new Error('API key required');
            }
            if (!state.settings.customApiUrl) {
                throw new Error('API URL required');
            }
            
            state.ollamaConnected = true;
            statusDot.classList.add('connected');
            
            const providerNames = {
                openai: 'OpenAI', anthropic: 'Claude', groq: 'Groq',
                openrouter: 'OpenRouter', together: 'Together', custom: 'Custom'
            };
            statusText.textContent = providerNames[provider] || 'Connected';
            
            // Set model in dropdown
            const modelName = state.settings.customModelName || providerPresets[provider]?.models?.[0] || 'default';
            modelSelect.innerHTML = `<option value="${modelName}">${modelName}</option>`;
            state.selectedModel = modelName;
            
            showToast(`✓ Connected to ${providerNames[provider]}`);
        }
    } catch (error) {
        state.ollamaConnected = false;
        statusDot.classList.remove('connected');
        statusText.textContent = 'Disconnected';
        
        if (provider === 'ollama') {
            document.getElementById('setupModal').classList.remove('hidden');
        } else {
            showToast(`Connection failed: ${error.message}. Check settings.`);
        }
    }
}

function closeSetupModal() { document.getElementById('setupModal').classList.add('hidden'); }

// ============================================
// FILE PROCESSING
// ============================================
async function processFile(file) {
    state.fileName = file.name;
    state.fileType = file.name.split('.').pop().toLowerCase();
    
    try {
        const data = await readFile(file);
        state.originalData = data;
        state.stagedData = JSON.parse(JSON.stringify(data));
        state.columns = Object.keys(data[0] || {});
        
        analyzeAndClean();
        
        uploadZone.classList.add('hidden');
        workspace.classList.remove('hidden');
        
        document.getElementById('fileName').textContent = state.fileName;
        document.getElementById('fileMeta').textContent = `${state.originalData.length.toLocaleString()} rows × ${state.columns.length} columns`;
        
        renderData();
        renderStats();
        renderSuggestions();
        
        if (state.ollamaConnected) {
            addChatMessage('assistant', `Loaded **${state.fileName}** with ${state.originalData.length} rows and ${state.columns.length} columns. I've applied automatic fixes. Click "AI Auto-Clean" for smart suggestions, or ask me anything!`);
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        if (state.fileType === 'csv') {
            reader.onload = (e) => {
                const result = Papa.parse(e.target.result, { header: true, skipEmptyLines: true, dynamicTyping: false });
                resolve(result.data);
            };
            reader.readAsText(file);
        } else if (state.fileType === 'json') {
            reader.onload = (e) => {
                const data = JSON.parse(e.target.result);
                resolve(Array.isArray(data) ? data : [data]);
            };
            reader.readAsText(file);
        } else if (['xlsx', 'xls'].includes(state.fileType)) {
            reader.onload = (e) => {
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                resolve(XLSX.utils.sheet_to_json(firstSheet, { defval: '' }));
            };
            reader.readAsArrayBuffer(file);
        } else { reject(new Error('Unsupported file type')); }
    });
}

// ============================================
// DATA ANALYSIS & CLEANING
// ============================================
function analyzeAndClean() {
    state.issues = [];
    state.autoFixes = [];
    state.pendingSuggestions = [];
    
    const columnAnalysis = analyzeColumns();
    
    // Auto-fix: Trim whitespace
    let trimCount = 0;
    state.stagedData.forEach((row, i) => {
        state.columns.forEach(col => {
            if (typeof row[col] === 'string' && row[col] !== row[col].trim()) {
                state.stagedData[i][col] = row[col].trim();
                trimCount++;
            }
        });
    });
    if (trimCount > 0) {
        state.autoFixes.push({ type: 'whitespace', description: `Trimmed whitespace from ${trimCount} cells`, count: trimCount });
        saveSnapshot('auto', 'Trim whitespace', `Trimmed ${trimCount} cells`);
    }

    // Auto-fix: Standardize missing values
    const missingPatterns = ['', 'null', 'NULL', 'None', 'none', 'N/A', 'n/a', 'NA', 'na', '-', 'undefined', 'NaN', '#N/A', '#REF!', '#VALUE!'];
    let standardizedCount = 0;
    state.stagedData.forEach((row, i) => {
        state.columns.forEach(col => {
            const val = String(row[col]).trim();
            if (missingPatterns.includes(val)) {
                state.stagedData[i][col] = '';
                if (val !== '') standardizedCount++;
            }
        });
    });
    if (standardizedCount > 0) {
        state.autoFixes.push({ type: 'missing', description: `Standardized ${standardizedCount} missing values`, count: standardizedCount });
        saveSnapshot('auto', 'Standardize missing', `Converted ${standardizedCount} values`);
    }

    // Auto-fix: Remove duplicates
    const seen = new Set();
    const dupIndices = [];
    state.stagedData.forEach((row, idx) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) dupIndices.push(idx);
        else seen.add(key);
    });
    if (dupIndices.length > 0) {
        state.autoFixes.push({ type: 'duplicates', description: `Removed ${dupIndices.length} duplicates`, count: dupIndices.length });
        state.stagedData = state.stagedData.filter((_, idx) => !dupIndices.includes(idx));
        saveSnapshot('auto', 'Remove duplicates', `Removed ${dupIndices.length} rows`);
    }

    generateSuggestions(columnAnalysis);
    updateRevertButton();
}

function analyzeColumns() {
    const analysis = {};
    state.columns.forEach(col => {
        const values = state.stagedData.map(row => row[col]);
        const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);
        
        analysis[col] = {
            missingCount: values.length - nonEmpty.length,
            missingPercent: ((values.length - nonEmpty.length) / values.length * 100).toFixed(1),
            uniqueCount: new Set(nonEmpty).size,
            inferredType: inferType(nonEmpty),
            mode: getMode(nonEmpty),
            sample: nonEmpty.slice(0, 5)
        };

        if (analysis[col].inferredType === 'number') {
            const nums = nonEmpty.map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
            if (nums.length > 0) {
                analysis[col].mean = nums.reduce((a, b) => a + b, 0) / nums.length;
                analysis[col].median = nums[Math.floor(nums.length / 2)];
                analysis[col].min = nums[0];
                analysis[col].max = nums[nums.length - 1];
                const q1 = nums[Math.floor(nums.length * 0.25)];
                const q3 = nums[Math.floor(nums.length * 0.75)];
                const iqr = q3 - q1;
                analysis[col].bounds = { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
                analysis[col].outliers = [];
                analysis[col].outlierIndices = [];
                state.stagedData.forEach((row, idx) => {
                    const val = Number(row[col]);
                    if (!isNaN(val) && (val < analysis[col].bounds.lower || val > analysis[col].bounds.upper)) {
                        analysis[col].outliers.push(val);
                        analysis[col].outlierIndices.push(idx);
                    }
                });
            }
        }
        if (analysis[col].inferredType === 'string') {
            const numericLooking = nonEmpty.filter(v => !isNaN(Number(v)) && v !== '');
            if (numericLooking.length > nonEmpty.length * 0.8) analysis[col].suggestTypeConversion = 'number';
        }
    });
    return analysis;
}

function inferType(values) {
    if (values.length === 0) return 'unknown';
    const sample = values.slice(0, 100);
    const numericCount = sample.filter(val => !isNaN(Number(val)) && val !== '').length;
    return numericCount > sample.length * 0.8 ? 'number' : 'string';
}

function getMode(arr) {
    if (arr.length === 0) return null;
    const freq = {};
    let maxFreq = 0, mode = arr[0];
    arr.forEach(val => {
        freq[val] = (freq[val] || 0) + 1;
        if (freq[val] > maxFreq) { maxFreq = freq[val]; mode = val; }
    });
    return mode;
}

function generateSuggestions(columnAnalysis) {
    Object.entries(columnAnalysis).forEach(([col, analysis]) => {
        if (analysis.missingCount > 0 && analysis.missingCount < state.stagedData.length * 0.5) {
            const suggestion = {
                id: `impute_${col}`, type: 'imputation', column: col,
                title: `Impute missing in "${col}"`,
                description: `${analysis.missingCount} missing (${analysis.missingPercent}%)`,
                affectedRows: analysis.missingCount, options: [], selectedOption: null
            };
            if (analysis.inferredType === 'number') {
                suggestion.options = [
                    { value: 'mean', label: `Mean (${analysis.mean?.toFixed(2)})` },
                    { value: 'median', label: `Median (${analysis.median?.toFixed(2)})` },
                    { value: 'zero', label: 'Zero' }
                ];
                suggestion.selectedOption = 'median';
            } else {
                suggestion.options = [
                    { value: 'mode', label: `Mode: "${(analysis.mode || '').toString().slice(0, 12)}"` },
                    { value: 'unknown', label: '"Unknown"' }
                ];
                suggestion.selectedOption = 'mode';
            }
            state.pendingSuggestions.push(suggestion);
        }
        if (analysis.missingCount > state.stagedData.length * 0.5) {
            state.pendingSuggestions.push({
                id: `remove_${col}`, type: 'column_removal', column: col,
                title: `Remove "${col}"`, description: `${analysis.missingPercent}% missing`,
                affectedRows: analysis.missingCount
            });
        }
        if (analysis.outliers?.length > 0 && analysis.outliers.length < state.stagedData.length * 0.1) {
            state.pendingSuggestions.push({
                id: `outliers_${col}`, type: 'outlier_handling', column: col,
                title: `Handle outliers in "${col}"`, description: `${analysis.outliers.length} outliers (IQR)`,
                affectedRows: analysis.outliers.length,
                options: [{ value: 'cap', label: 'Cap' }, { value: 'remove', label: 'Remove' }, { value: 'median', label: 'Median' }],
                selectedOption: 'cap', bounds: analysis.bounds, outlierIndices: analysis.outlierIndices, median: analysis.median
            });
        }
        if (analysis.suggestTypeConversion) {
            state.pendingSuggestions.push({
                id: `convert_${col}`, type: 'type_conversion', column: col,
                title: `Convert "${col}" to number`, description: 'Appears numeric',
                affectedRows: state.stagedData.length - analysis.missingCount
            });
        }
    });
    state.issues = [...state.pendingSuggestions];
}

// ============================================
// HISTORY & UNDO SYSTEM
// ============================================
function saveSnapshot(changeType, title, description, reasoning = null) {
    state.changeHistory.push({
        id: Date.now(), timestamp: new Date().toISOString(), type: changeType,
        title, description, reasoning,
        dataSnapshot: JSON.parse(JSON.stringify(state.stagedData)),
        columnsSnapshot: [...state.columns]
    });
    updateRevertButton();
}

function updateRevertButton() {
    const btn = document.getElementById('revertBtn');
    if (btn) btn.disabled = state.changeHistory.length === 0;
}

function revertLastChange() {
    if (state.changeHistory.length === 0) { showToast('Nothing to undo'); return; }
    const lastChange = state.changeHistory.pop();
    if (state.changeHistory.length > 0) {
        const prev = state.changeHistory[state.changeHistory.length - 1];
        state.stagedData = JSON.parse(JSON.stringify(prev.dataSnapshot));
        state.columns = [...prev.columnsSnapshot];
    } else {
        state.stagedData = JSON.parse(JSON.stringify(state.originalData));
        state.columns = Object.keys(state.originalData[0] || {});
    }
    renderData(); renderStats(); updateRevertButton();
    showToast(`↶ Reverted: ${lastChange.title}`);
    addChatMessage('assistant', `Undone: "${lastChange.title}"`);
}

function revertToSnapshot(snapshotId) {
    const index = state.changeHistory.findIndex(s => s.id === snapshotId);
    if (index === -1) return;
    state.changeHistory.splice(index);
    if (state.changeHistory.length > 0) {
        const snapshot = state.changeHistory[state.changeHistory.length - 1];
        state.stagedData = JSON.parse(JSON.stringify(snapshot.dataSnapshot));
        state.columns = [...snapshot.columnsSnapshot];
    } else {
        state.stagedData = JSON.parse(JSON.stringify(state.originalData));
        state.columns = Object.keys(state.originalData[0] || {});
    }
    renderData(); renderStats(); updateRevertButton(); closeHistoryModal();
    showToast('↶ Reverted');
}

function revertAllChanges() {
    state.changeHistory = [];
    state.appliedChanges = [];
    state.stagedData = JSON.parse(JSON.stringify(state.originalData));
    state.columns = Object.keys(state.originalData[0] || {});
    analyzeAndClean();
    renderData(); renderStats(); renderSuggestions(); updateRevertButton(); closeHistoryModal();
    showToast('↶ Reverted all changes');
}

function showHistory() {
    const list = document.getElementById('historyList');
    if (state.changeHistory.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No changes yet</p></div>';
    } else {
        list.innerHTML = state.changeHistory.slice().reverse().map(c => `
            <div class="history-item">
                <div class="history-icon ${c.type}">${c.type === 'auto' ? '⚡' : c.type === 'ai' ? '🤖' : c.type === 'approved' ? '✓' : '⏭'}</div>
                <div class="history-content">
                    <div class="history-title"><span class="history-badge ${c.type}">${c.type}</span> ${escapeHtml(c.title)}</div>
                    <div class="history-desc">${escapeHtml(c.description)}</div>
                    ${c.reasoning ? `<div class="history-reasoning">"${escapeHtml(c.reasoning)}"</div>` : ''}
                </div>
                <button class="history-revert-btn" onclick="revertToSnapshot(${c.id})">Revert</button>
            </div>
        `).join('');
    }
    document.getElementById('historyModal').classList.remove('hidden');
}

function closeHistoryModal() { document.getElementById('historyModal').classList.add('hidden'); }

// ============================================
// AI INTEGRATION
// ============================================
async function queryOllama(prompt, systemPrompt = '') {
    if (!state.ollamaConnected) throw new Error('Not connected to AI provider');
    
    state.abortController = new AbortController();
    const provider = state.settings.aiProvider;
    
    if (provider === 'ollama') {
        // Ollama API
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(state.settings.ollamaUrl + '/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: state.selectedModel, messages, stream: false, options: { temperature: 0.7, num_predict: 1024 } }),
            signal: state.abortController.signal
        });
        
        if (!response.ok) throw new Error('Request failed');
        const data = await response.json();
        state.abortController = null;
        return data.message?.content || '';
    } else {
        // OpenAI-compatible API (works for OpenAI, Groq, Together, OpenRouter, etc.)
        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });
        
        const apiKey = getActiveApiKey();
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
        
        // OpenRouter requires additional headers
        if (provider === 'openrouter') {
            headers['HTTP-Referer'] = window.location.href;
            headers['X-Title'] = 'DataScrub';
        }
        
        // Anthropic uses different header
        if (provider === 'anthropic') {
            headers['x-api-key'] = apiKey;
            headers['anthropic-version'] = '2023-06-01';
            delete headers['Authorization'];
        }
        
        const modelName = state.settings.customModelName || state.selectedModel;
        
        let body, endpoint;
        
        if (provider === 'anthropic') {
            // Anthropic uses different API format
            endpoint = state.settings.customApiUrl + '/messages';
            body = JSON.stringify({
                model: modelName,
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: prompt }]
            });
        } else {
            // OpenAI-compatible format
            endpoint = state.settings.customApiUrl + '/chat/completions';
            body = JSON.stringify({
                model: modelName,
                messages: messages,
                temperature: 0.7,
                max_tokens: 1024
            });
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: body,
            signal: state.abortController.signal
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }
        
        const data = await response.json();
        state.abortController = null;
        
        // Handle different response formats
        if (provider === 'anthropic') {
            return data.content?.[0]?.text || '';
        } else {
            return data.choices?.[0]?.message?.content || '';
        }
    }
}

function stopAIRequest() {
    if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
        hideThinking();
        document.getElementById('sendBtn').classList.remove('hidden');
        document.getElementById('stopBtn').classList.add('hidden');
        showToast('AI request stopped');
    }
}

async function letAIClean() {
    if (!state.ollamaConnected) { showToast('Connect to Ollama first'); document.getElementById('setupModal').classList.remove('hidden'); return; }
    if (state.stagedData.length === 0) { showToast('Upload a file first'); return; }

    addChatMessage('user', 'Please auto-clean my data and explain your reasoning.');
    showThinking();

    try {
        const columnAnalysis = analyzeColumns();
        const dataSummary = buildDataSummary(columnAnalysis);
        const contextPrompt = getContextPrompt();
        
        const systemPrompt = `You are a data cleaning AI. Analyze and decide what actions to take.
${contextPrompt}
RESPOND ONLY WITH VALID JSON:
{"actions":[{"action":"impute|remove_column|handle_outliers|convert_type","column":"name","method":"median|mean|mode|cap|remove","reasoning":"why"}],"summary":"brief summary"}
Be conservative. Only confident changes.`;

        const response = await queryOllama(dataSummary, systemPrompt);
        hideThinking();
        
        let aiDecisions;
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            aiDecisions = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch (e) {
            addChatMessage('assistant', `Analysis complete:\n\n${response}`);
            return;
        }

        if (aiDecisions?.actions?.length > 0) {
            let applied = 0;
            for (const action of aiDecisions.actions) {
                if (applyAIAction(action)) applied++;
            }
            addChatMessage('assistant', `🤖 **Auto-Clean Complete** (${applied} changes)\n\n${aiDecisions.actions.map(a => `• **${a.column}**: ${a.action} — "${a.reasoning}"`).join('\n')}\n\n${aiDecisions.summary || ''}\n\nUse "Undo Last" or History to revert.`);
        } else {
            addChatMessage('assistant', aiDecisions?.summary || 'Your data looks good! No changes needed.');
        }
        renderData(); renderStats(); renderSuggestions();
    } catch (error) {
        hideThinking();
        if (error.name !== 'AbortError') addChatMessage('assistant', `Error: ${error.message}`);
    }
}

function applyAIAction(action) {
    const col = action.column;
    const analysis = analyzeColumns()[col];
    if (!analysis && action.action !== 'remove_column') return false;
    
    saveSnapshot('ai', `AI: ${action.action} "${col}"`, action.reasoning, action.reasoning);

    switch (action.action) {
        case 'impute':
            let fill = action.method === 'mean' ? analysis.mean : action.method === 'median' ? analysis.median : action.method === 'mode' ? (analysis.mode || '') : action.method === 'zero' ? 0 : 'Unknown';
            state.stagedData.forEach((row, i) => { if (row[col] === '' || row[col] == null) state.stagedData[i][col] = fill; });
            return true;
        case 'remove_column':
            if (!state.columns.includes(col)) return false;
            state.stagedData = state.stagedData.map(row => { const r = {...row}; delete r[col]; return r; });
            state.columns = state.columns.filter(c => c !== col);
            return true;
        case 'handle_outliers':
            if (!analysis?.bounds) return false;
            if (action.method === 'cap') {
                state.stagedData.forEach((row, i) => {
                    const val = Number(row[col]);
                    if (!isNaN(val)) {
                        if (val < analysis.bounds.lower) state.stagedData[i][col] = analysis.bounds.lower;
                        if (val > analysis.bounds.upper) state.stagedData[i][col] = analysis.bounds.upper;
                    }
                });
            } else if (action.method === 'remove') {
                state.stagedData = state.stagedData.filter(row => {
                    const val = Number(row[col]);
                    return isNaN(val) || (val >= analysis.bounds.lower && val <= analysis.bounds.upper);
                });
            }
            return true;
        case 'convert_type':
            state.stagedData.forEach((row, i) => {
                const val = row[col];
                if (val !== '' && val != null) { const num = Number(val); if (!isNaN(num)) state.stagedData[i][col] = num; }
            });
            return true;
        default: return false;
    }
}

function buildDataSummary(columnAnalysis) {
    let s = `Dataset: ${state.fileName}\nRows: ${state.stagedData.length}, Columns: ${state.columns.length}\n\nColumns:\n`;
    Object.entries(columnAnalysis).forEach(([col, info]) => {
        s += `\n- ${col} (${info.inferredType}): ${info.missingCount} missing (${info.missingPercent}%), ${info.uniqueCount} unique`;
        if (info.inferredType === 'number') s += `, range: ${info.min?.toFixed(2)}-${info.max?.toFixed(2)}, mean: ${info.mean?.toFixed(2)}`;
        if (info.outliers?.length) s += `, ${info.outliers.length} outliers`;
    });
    s += `\n\nAuto-fixes applied: ${state.autoFixes.map(f => f.description).join(', ') || 'none'}`;
    return s;
}

// ============================================
// CHAT
// ============================================
function handleChatKeypress(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    
    input.value = '';
    addChatMessage('user', msg);

    if (!state.ollamaConnected) {
        addChatMessage('assistant', "Not connected to Ollama. Click 'Connect' to set up.");
        return;
    }

    showThinking();
    try {
        const context = buildDataSummary(analyzeColumns());
        const contextPrompt = getContextPrompt();
        const systemPrompt = `You are DataScrub, a data cleaning assistant.
Dataset: ${context}
${contextPrompt}
Chat history: ${state.chatHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}
Be concise (<150 words). Be helpful and practical.`;

        const response = await queryOllama(msg, systemPrompt);
        hideThinking();
        addChatMessage('assistant', response);
    } catch (error) {
        hideThinking();
        if (error.name !== 'AbortError') addChatMessage('assistant', `Error: ${error.message}`);
    }
}

function addChatMessage(role, content) {
    state.chatHistory.push({ role, content });
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    div.innerHTML = `<div class="sender">${role === 'user' ? 'You' : 'DataScrub'}</div><div class="bubble">${content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showThinking() {
    document.getElementById('sendBtn').classList.add('hidden');
    document.getElementById('stopBtn').classList.remove('hidden');
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.id = 'thinkingIndicator';
    div.className = 'chat-message assistant';
    div.innerHTML = '<div class="thinking"><div class="thinking-dots"><span></span><span></span><span></span></div>Thinking...</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function hideThinking() {
    document.getElementById('sendBtn').classList.remove('hidden');
    document.getElementById('stopBtn').classList.add('hidden');
    const t = document.getElementById('thinkingIndicator');
    if (t) t.remove();
}

// ============================================
// SUGGESTION ACTIONS
// ============================================
function selectOption(id, value) {
    const s = state.pendingSuggestions.find(s => s.id === id);
    if (s) { s.selectedOption = value; renderSuggestions(); }
}

function approveSuggestion(id) {
    const suggestion = state.pendingSuggestions.find(s => s.id === id);
    if (!suggestion) return;
    
    saveSnapshot('approved', suggestion.title, `Applied on "${suggestion.column}"`);
    const analysis = analyzeColumns()[suggestion.column];

    switch (suggestion.type) {
        case 'imputation':
            let fill = suggestion.selectedOption === 'mean' ? analysis.mean : suggestion.selectedOption === 'median' ? analysis.median : suggestion.selectedOption === 'mode' ? (analysis.mode || '') : suggestion.selectedOption === 'zero' ? 0 : 'Unknown';
            state.stagedData.forEach((row, i) => { if (row[suggestion.column] === '' || row[suggestion.column] == null) state.stagedData[i][suggestion.column] = fill; });
            break;
        case 'column_removal':
            state.stagedData = state.stagedData.map(row => { const r = {...row}; delete r[suggestion.column]; return r; });
            state.columns = state.columns.filter(c => c !== suggestion.column);
            break;
        case 'outlier_handling':
            if (suggestion.selectedOption === 'cap') {
                state.stagedData.forEach((row, i) => {
                    const val = Number(row[suggestion.column]);
                    if (!isNaN(val)) {
                        if (val < suggestion.bounds.lower) state.stagedData[i][suggestion.column] = suggestion.bounds.lower;
                        if (val > suggestion.bounds.upper) state.stagedData[i][suggestion.column] = suggestion.bounds.upper;
                    }
                });
            } else if (suggestion.selectedOption === 'remove') {
                state.stagedData = state.stagedData.filter((_, idx) => !suggestion.outlierIndices.includes(idx));
            } else {
                suggestion.outlierIndices.forEach(idx => { if (state.stagedData[idx]) state.stagedData[idx][suggestion.column] = suggestion.median; });
            }
            break;
        case 'type_conversion':
            state.stagedData.forEach((row, i) => {
                const val = row[suggestion.column];
                if (val !== '' && val != null) { const num = Number(val); if (!isNaN(num)) state.stagedData[i][suggestion.column] = num; }
            });
            break;
    }
    
    state.appliedChanges.push(suggestion);
    state.pendingSuggestions = state.pendingSuggestions.filter(s => s.id !== id);
    renderData(); renderStats(); renderSuggestions(); updateRevertButton();
    showToast(`✓ Applied: ${suggestion.title}`);
}

function rejectSuggestion(id) {
    const suggestion = state.pendingSuggestions.find(s => s.id === id);
    if (!suggestion) return;
    saveSnapshot('rejected', `Skipped: ${suggestion.title}`, `Chose not to apply on "${suggestion.column}"`);
    state.rejectedChanges.push(suggestion);
    state.pendingSuggestions = state.pendingSuggestions.filter(s => s.id !== id);
    renderSuggestions(); updateRevertButton();
    showToast(`Skipped: ${suggestion.title}`);
}

// ============================================
// RENDERING
// ============================================
function renderData() {
    renderTable('originalTab', state.originalData);
    renderTable('stagedTab', state.stagedData);
    renderReport();
}

function renderTable(containerId, data) {
    const container = document.getElementById(containerId);
    if (data.length === 0) { container.innerHTML = '<div class="empty-state"><p>No data</p></div>'; return; }

    const columns = Object.keys(data[0]);
    const maxRows = state.settings.maxPreviewRows;
    const displayRows = data.slice(0, maxRows);
    
    let html = '<table class="data-table"><thead><tr><th class="row-num">#</th>';
    columns.forEach(col => html += `<th>${escapeHtml(col)}</th>`);
    html += '</tr></thead><tbody>';
    
    displayRows.forEach((row, idx) => {
        html += `<tr><td class="row-num">${idx + 1}</td>`;
        columns.forEach(col => {
            const val = row[col];
            const isEmpty = val === '' || val == null;
            html += `<td class="${isEmpty ? 'cell-empty' : ''}">${isEmpty ? '∅' : escapeHtml(String(val))}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    
    if (data.length > maxRows) {
        html += `<div style="padding:0.75rem;text-align:center;color:var(--text-muted);font-size:0.75rem;">Showing ${maxRows} of ${data.length.toLocaleString()} rows</div>`;
    }
    container.innerHTML = html;
}

function renderStats() {
    document.getElementById('statRows').textContent = state.stagedData.length.toLocaleString();
    document.getElementById('statCols').textContent = state.columns.length;
    document.getElementById('statIssues').textContent = state.issues.length;
    document.getElementById('statFixed').textContent = state.autoFixes.reduce((sum, f) => sum + f.count, 0);
}

function renderSuggestions() {
    const container = document.getElementById('suggestionsContainer');
    document.getElementById('pendingCount').textContent = state.pendingSuggestions.length;
    
    if (state.pendingSuggestions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>✓ All done!</p></div>';
        return;
    }
    
    container.innerHTML = state.pendingSuggestions.map(s => `
        <div class="suggestion-card">
            <span class="suggestion-badge">${s.type.replace('_', ' ')}</span>
            <div class="suggestion-title">${escapeHtml(s.title)}</div>
            <div class="suggestion-desc">${s.description}</div>
            <div class="suggestion-meta">Affects ${s.affectedRows} rows</div>
            ${s.options ? `<div class="suggestion-options">${s.options.map(opt => `<button class="option-btn ${s.selectedOption === opt.value ? 'selected' : ''}" onclick="selectOption('${s.id}', '${opt.value}')">${opt.label}</button>`).join('')}</div>` : ''}
            <div class="suggestion-actions">
                <button class="btn btn-approve" onclick="approveSuggestion('${s.id}')">✓ Apply</button>
                <button class="btn btn-reject" onclick="rejectSuggestion('${s.id}')">Skip</button>
            </div>
        </div>
    `).join('');
}

function renderReport() {
    const container = document.getElementById('reportTab');
    container.innerHTML = `
        <div class="report-view">
            <div class="report-section">
                <h3>📊 Summary</h3>
                <p style="color:var(--text-secondary);font-size:0.8rem;">Original: ${state.originalData.length} rows × ${Object.keys(state.originalData[0] || {}).length} cols<br>Cleaned: ${state.stagedData.length} rows × ${state.columns.length} cols</p>
            </div>
            <div class="report-section">
                <h3>⚡ Auto-Applied</h3>
                ${state.autoFixes.length ? state.autoFixes.map(f => `<div class="report-item"><span class="check-icon">✓</span> ${f.description}</div>`).join('') : '<p style="color:var(--text-muted);font-size:0.8rem;">None</p>'}
            </div>
            <div class="report-section">
                <h3>✅ Approved</h3>
                ${state.appliedChanges.length ? state.appliedChanges.map(c => `<div class="report-item"><span class="check-icon">✓</span> ${c.title}</div>`).join('') : '<p style="color:var(--text-muted);font-size:0.8rem;">None yet</p>'}
            </div>
            <div class="report-section">
                <h3>⏭️ Skipped</h3>
                ${state.rejectedChanges.length ? state.rejectedChanges.map(c => `<div class="report-item"><span class="skip-icon">–</span> ${c.title}</div>`).join('') : '<p style="color:var(--text-muted);font-size:0.8rem;">None</p>'}
            </div>
        </div>
    `;
}

// ============================================
// UTILITIES
// ============================================
function downloadCleanedData() {
    if (state.stagedData.length === 0) { showToast('No data'); return; }
    
    if (['xlsx', 'xls'].includes(state.fileType)) {
        const ws = XLSX.utils.json_to_sheet(state.stagedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cleaned');
        XLSX.writeFile(wb, `cleaned_${state.fileName}`);
    } else {
        const content = state.fileType === 'json' ? JSON.stringify(state.stagedData, null, 2) : Papa.unparse(state.stagedData);
        const blob = new Blob([content], { type: state.fileType === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cleaned_${state.fileName.replace(/\.[^/.]+$/, '')}.${state.fileType === 'json' ? 'json' : 'csv'}`;
        a.click();
        URL.revokeObjectURL(url);
    }
    showToast('✓ Downloaded!');
}

function resetApp() {
    state.originalData = []; state.stagedData = []; state.columns = [];
    state.fileName = ''; state.fileType = '';
    state.issues = []; state.autoFixes = []; state.pendingSuggestions = [];
    state.appliedChanges = []; state.rejectedChanges = [];
    state.chatHistory = []; state.changeHistory = [];
    
    workspace.classList.add('hidden');
    uploadZone.classList.remove('hidden');
    fileInput.value = '';
    
    document.getElementById('chatMessages').innerHTML = '<div class="chat-message assistant"><div class="sender">DataScrub</div><div class="bubble">Ready for a new dataset!</div></div>';
    renderStats();
    updateRevertButton();
    document.getElementById('suggestionsContainer').innerHTML = '<div class="empty-state"><p>Upload a file to start</p></div>';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
