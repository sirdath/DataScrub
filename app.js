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
    chatHistory: []
};

// ============================================
// DOM ELEMENTS
// ============================================
const uploadZone = document.getElementById('uploadZone');
const workspace = document.getElementById('workspace');
const fileInput = document.getElementById('fileInput');
const modelSelect = document.getElementById('modelSelect');

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setupFileUpload();
    setupTabs();
    checkConnection();
});

function setupFileUpload() {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    });
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
    });
    modelSelect.addEventListener('change', (e) => {
        state.selectedModel = e.target.value;
    });
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

// ============================================
// OLLAMA CONNECTION
// ============================================
async function checkConnection() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    try {
        const response = await fetch('http://localhost:11434/api/tags', {
            method: 'GET'
        });
        
        if (response.ok) {
            const data = await response.json();
            state.ollamaConnected = true;
            statusDot.classList.add('connected');
            statusText.textContent = 'Connected';
            
            if (data.models && data.models.length > 0) {
                modelSelect.innerHTML = data.models.map(m => 
                    `<option value="${m.name}">${m.name}</option>`
                ).join('');
                state.selectedModel = data.models[0].name;
            }
            
            showToast('✓ Connected to Ollama', 'success');
        } else {
            throw new Error('Connection failed');
        }
    } catch (error) {
        state.ollamaConnected = false;
        statusDot.classList.remove('connected');
        statusText.textContent = 'Disconnected';
        document.getElementById('setupModal').classList.remove('hidden');
    }
}

function closeSetupModal() {
    document.getElementById('setupModal').classList.add('hidden');
}

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
        document.getElementById('fileMeta').textContent = 
            `${state.originalData.length.toLocaleString()} rows × ${state.columns.length} columns`;
        
        renderData();
        renderStats();
        renderSuggestions();
        
        if (state.ollamaConnected) {
            addChatMessage('assistant', `I've loaded **${state.fileName}** with ${state.originalData.length} rows and ${state.columns.length} columns. I've already applied some automatic fixes. Click "AI Analysis" for deeper insights, or ask me anything about your data!`);
        }
        
    } catch (error) {
        console.error('Error processing file:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        if (state.fileType === 'csv') {
            reader.onload = (e) => {
                const result = Papa.parse(e.target.result, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: false
                });
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
                const data = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                resolve(data);
            };
            reader.readAsArrayBuffer(file);
        } else {
            reject(new Error('Unsupported file type'));
        }
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
    state.stagedData.forEach((row, rowIdx) => {
        state.columns.forEach(col => {
            if (typeof row[col] === 'string' && row[col] !== row[col].trim()) {
                state.stagedData[rowIdx][col] = row[col].trim();
                trimCount++;
            }
        });
    });
    if (trimCount > 0) {
        state.autoFixes.push({
            type: 'whitespace_trim',
            description: `Trimmed whitespace from ${trimCount} cells`,
            count: trimCount
        });
    }

    // Auto-fix: Standardize missing values
    const missingPatterns = ['', 'null', 'NULL', 'None', 'none', 'N/A', 'n/a', 'NA', 'na', '-', 'undefined', 'NaN', '#N/A', '#REF!', '#VALUE!'];
    let standardizedCount = 0;
    state.stagedData.forEach((row, rowIdx) => {
        state.columns.forEach(col => {
            const val = String(row[col]).trim();
            if (missingPatterns.includes(val)) {
                state.stagedData[rowIdx][col] = '';
                if (val !== '') standardizedCount++;
            }
        });
    });
    if (standardizedCount > 0) {
        state.autoFixes.push({
            type: 'missing_standardization',
            description: `Standardized ${standardizedCount} missing value formats`,
            count: standardizedCount
        });
    }

    // Auto-fix: Remove exact duplicate rows
    const seen = new Set();
    const duplicateIndices = [];
    state.stagedData.forEach((row, idx) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) {
            duplicateIndices.push(idx);
        } else {
            seen.add(key);
        }
    });
    if (duplicateIndices.length > 0) {
        state.autoFixes.push({
            type: 'duplicate_removal',
            description: `Removed ${duplicateIndices.length} duplicate rows`,
            count: duplicateIndices.length
        });
        state.stagedData = state.stagedData.filter((_, idx) => !duplicateIndices.includes(idx));
    }

    generateSuggestions(columnAnalysis);
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
            const nums = nonEmpty.map(Number).filter(n => !isNaN(n));
            if (nums.length > 0) {
                nums.sort((a, b) => a - b);
                analysis[col].mean = nums.reduce((a, b) => a + b, 0) / nums.length;
                analysis[col].median = nums[Math.floor(nums.length / 2)];
                analysis[col].min = nums[0];
                analysis[col].max = nums[nums.length - 1];
                
                const q1 = nums[Math.floor(nums.length * 0.25)];
                const q3 = nums[Math.floor(nums.length * 0.75)];
                const iqr = q3 - q1;
                const lowerBound = q1 - 1.5 * iqr;
                const upperBound = q3 + 1.5 * iqr;
                
                analysis[col].outliers = [];
                analysis[col].outlierIndices = [];
                analysis[col].bounds = { lower: lowerBound, upper: upperBound };
                
                state.stagedData.forEach((row, idx) => {
                    const val = Number(row[col]);
                    if (!isNaN(val) && (val < lowerBound || val > upperBound)) {
                        analysis[col].outliers.push(val);
                        analysis[col].outlierIndices.push(idx);
                    }
                });
            }
        }

        if (analysis[col].inferredType === 'string') {
            const numericLooking = nonEmpty.filter(v => !isNaN(Number(v)) && v !== '');
            if (numericLooking.length > nonEmpty.length * 0.8) {
                analysis[col].suggestTypeConversion = 'number';
            }
        }
    });
    
    return analysis;
}

function inferType(values) {
    if (values.length === 0) return 'unknown';
    const sample = values.slice(0, 100);
    let numericCount = 0;
    
    sample.forEach(val => {
        if (!isNaN(Number(val)) && val !== '') numericCount++;
    });
    
    if (numericCount > sample.length * 0.8) return 'number';
    return 'string';
}

function getMode(arr) {
    if (arr.length === 0) return null;
    const freq = {};
    let maxFreq = 0;
    let mode = arr[0];
    
    arr.forEach(val => {
        freq[val] = (freq[val] || 0) + 1;
        if (freq[val] > maxFreq) {
            maxFreq = freq[val];
            mode = val;
        }
    });
    return mode;
}

function generateSuggestions(columnAnalysis) {
    Object.entries(columnAnalysis).forEach(([col, analysis]) => {
        if (analysis.missingCount > 0 && analysis.missingCount < state.stagedData.length * 0.5) {
            const suggestion = {
                id: `impute_${col}`,
                type: 'imputation',
                column: col,
                title: `Impute missing values in "${col}"`,
                description: `${analysis.missingCount} missing (${analysis.missingPercent}%)`,
                affectedRows: analysis.missingCount,
                options: [],
                selectedOption: null
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
                    { value: 'mode', label: `Mode: "${(analysis.mode || 'N/A').toString().slice(0, 15)}"` },
                    { value: 'unknown', label: '"Unknown"' }
                ];
                suggestion.selectedOption = 'mode';
            }
            state.pendingSuggestions.push(suggestion);
        }

        if (analysis.missingCount > state.stagedData.length * 0.5) {
            state.pendingSuggestions.push({
                id: `remove_${col}`,
                type: 'column_removal',
                column: col,
                title: `Remove column "${col}"`,
                description: `${analysis.missingPercent}% missing — likely unusable`,
                affectedRows: analysis.missingCount
            });
        }

        if (analysis.outliers && analysis.outliers.length > 0 && analysis.outliers.length < state.stagedData.length * 0.1) {
            state.pendingSuggestions.push({
                id: `outliers_${col}`,
                type: 'outlier_handling',
                column: col,
                title: `Handle outliers in "${col}"`,
                description: `${analysis.outliers.length} outliers detected (IQR method)`,
                affectedRows: analysis.outliers.length,
                options: [
                    { value: 'cap', label: 'Cap to bounds' },
                    { value: 'remove', label: 'Remove rows' },
                    { value: 'median', label: 'Replace w/ median' }
                ],
                selectedOption: 'cap',
                bounds: analysis.bounds,
                outlierIndices: analysis.outlierIndices,
                median: analysis.median
            });
        }

        if (analysis.suggestTypeConversion) {
            state.pendingSuggestions.push({
                id: `convert_${col}`,
                type: 'type_conversion',
                column: col,
                title: `Convert "${col}" to number`,
                description: `Stored as text but appears numeric`,
                affectedRows: state.stagedData.length - analysis.missingCount
            });
        }
    });

    state.issues = [...state.pendingSuggestions];
}

// ============================================
// AI INTEGRATION
// ============================================
async function queryOllama(prompt, systemPrompt = '') {
    if (!state.ollamaConnected) {
        throw new Error('Ollama not connected');
    }

    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: state.selectedModel,
            messages: messages,
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 1024
            }
        })
    });

    if (!response.ok) {
        throw new Error('Ollama request failed');
    }

    const data = await response.json();
    return data.message?.content || '';
}

async function analyzeWithAI() {
    if (!state.ollamaConnected) {
        showToast('Please connect to Ollama first', 'error');
        document.getElementById('setupModal').classList.remove('hidden');
        return;
    }

    if (state.stagedData.length === 0) {
        showToast('Please upload a file first', 'error');
        return;
    }

    addChatMessage('user', 'Analyze this dataset and give me insights');
    showThinking();

    try {
        const columnAnalysis = analyzeColumns();
        const dataSummary = buildDataSummary(columnAnalysis);
        
        const systemPrompt = `You are a data cleaning expert assistant. Analyze the dataset summary provided and give actionable insights. Be concise and practical. Format your response with clear sections. Focus on:
1. Data quality issues found
2. Recommended cleaning actions  
3. Any patterns or anomalies noticed
Keep response under 300 words. Do not use markdown headers, just plain text with line breaks.`;

        const response = await queryOllama(dataSummary, systemPrompt);
        hideThinking();
        addChatMessage('assistant', response);
        
    } catch (error) {
        hideThinking();
        addChatMessage('assistant', `Sorry, I encountered an error: ${error.message}. Make sure Ollama is running with CORS enabled.`);
    }
}

function buildDataSummary(columnAnalysis) {
    let summary = `Dataset: ${state.fileName}\n`;
    summary += `Rows: ${state.stagedData.length}, Columns: ${state.columns.length}\n\n`;
    summary += `Column Analysis:\n`;
    
    Object.entries(columnAnalysis).forEach(([col, info]) => {
        summary += `\n- ${col} (${info.inferredType}):\n`;
        summary += `  Missing: ${info.missingCount} (${info.missingPercent}%)\n`;
        summary += `  Unique values: ${info.uniqueCount}\n`;
        if (info.inferredType === 'number') {
            summary += `  Range: ${info.min?.toFixed(2)} to ${info.max?.toFixed(2)}\n`;
            summary += `  Mean: ${info.mean?.toFixed(2)}, Median: ${info.median?.toFixed(2)}\n`;
            if (info.outliers?.length > 0) {
                summary += `  Outliers: ${info.outliers.length} detected\n`;
            }
        }
        summary += `  Sample values: ${info.sample?.slice(0, 3).join(', ')}\n`;
    });

    summary += `\nAuto-fixes already applied:\n`;
    state.autoFixes.forEach(fix => {
        summary += `- ${fix.description}\n`;
    });

    return summary;
}

// ============================================
// CHAT FUNCTIONALITY
// ============================================
function handleChatKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    input.value = '';
    addChatMessage('user', message);

    if (!state.ollamaConnected) {
        addChatMessage('assistant', "I'm not connected to Ollama yet. Please click 'Connect' to set up the AI backend, or I can only help with basic rule-based cleaning.");
        return;
    }

    showThinking();

    try {
        const columnAnalysis = analyzeColumns();
        const context = buildDataSummary(columnAnalysis);
        
        const systemPrompt = `You are a helpful data cleaning assistant called DataScrub. You help users clean and understand their data.

Current dataset context:
${context}

Recent chat:
${state.chatHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}

Instructions:
- Answer questions about the data concisely
- If asked to perform a cleaning action, explain what you would do
- Suggest specific columns and values when relevant
- Keep responses under 200 words
- Be friendly and practical
- Do not use markdown headers, just plain text`;

        const response = await queryOllama(message, systemPrompt);
        hideThinking();
        addChatMessage('assistant', response);
        
    } catch (error) {
        hideThinking();
        addChatMessage('assistant', `Error: ${error.message}. Please check that Ollama is running.`);
    }
}

function addChatMessage(role, content) {
    state.chatHistory.push({ role, content });
    
    const container = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    
    messageDiv.innerHTML = `
        <div class="sender">${role === 'user' ? 'You' : 'DataScrub Agent'}</div>
        <div class="bubble">${formattedContent}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function showThinking() {
    const container = document.getElementById('chatMessages');
    const thinkingDiv = document.createElement('div');
    thinkingDiv.id = 'thinkingIndicator';
    thinkingDiv.className = 'chat-message assistant';
    thinkingDiv.innerHTML = `
        <div class="thinking">
            <div class="thinking-dots">
                <span></span><span></span><span></span>
            </div>
            Thinking...
        </div>
    `;
    container.appendChild(thinkingDiv);
    container.scrollTop = container.scrollHeight;
}

function hideThinking() {
    const thinking = document.getElementById('thinkingIndicator');
    if (thinking) thinking.remove();
}

// ============================================
// SUGGESTION ACTIONS
// ============================================
function selectOption(suggestionId, value) {
    const suggestion = state.pendingSuggestions.find(s => s.id === suggestionId);
    if (suggestion) {
        suggestion.selectedOption = value;
        renderSuggestions();
    }
}

function approveSuggestion(id) {
    const suggestion = state.pendingSuggestions.find(s => s.id === id);
    if (!suggestion) return;
    
    const columnAnalysis = analyzeColumns();
    const col = suggestion.column;
    const analysis = columnAnalysis[col];

    switch (suggestion.type) {
        case 'imputation':
            let fillValue;
            switch (suggestion.selectedOption) {
                case 'mean': fillValue = analysis.mean; break;
                case 'median': fillValue = analysis.median; break;
                case 'mode': fillValue = analysis.mode || ''; break;
                case 'zero': fillValue = 0; break;
                case 'unknown': fillValue = 'Unknown'; break;
                default: fillValue = '';
            }
            state.stagedData.forEach((row, idx) => {
                if (row[col] === '' || row[col] === null || row[col] === undefined) {
                    state.stagedData[idx][col] = fillValue;
                }
            });
            break;

        case 'column_removal':
            state.stagedData = state.stagedData.map(row => {
                const newRow = { ...row };
                delete newRow[col];
                return newRow;
            });
            state.columns = state.columns.filter(c => c !== col);
            break;

        case 'outlier_handling':
            switch (suggestion.selectedOption) {
                case 'cap':
                    state.stagedData.forEach((row, idx) => {
                        const val = Number(row[col]);
                        if (!isNaN(val)) {
                            if (val < suggestion.bounds.lower) state.stagedData[idx][col] = suggestion.bounds.lower;
                            if (val > suggestion.bounds.upper) state.stagedData[idx][col] = suggestion.bounds.upper;
                        }
                    });
                    break;
                case 'remove':
                    state.stagedData = state.stagedData.filter((_, idx) => !suggestion.outlierIndices.includes(idx));
                    break;
                case 'median':
                    suggestion.outlierIndices.forEach(idx => {
                        if (state.stagedData[idx]) {
                            state.stagedData[idx][col] = suggestion.median;
                        }
                    });
                    break;
            }
            break;

        case 'type_conversion':
            state.stagedData.forEach((row, idx) => {
                const val = row[col];
                if (val !== '' && val !== null && val !== undefined) {
                    const num = Number(val);
                    if (!isNaN(num)) state.stagedData[idx][col] = num;
                }
            });
            break;
    }
    
    state.appliedChanges.push(suggestion);
    state.pendingSuggestions = state.pendingSuggestions.filter(s => s.id !== id);
    
    renderData();
    renderStats();
    renderSuggestions();
    showToast(`✓ Applied: ${suggestion.title}`, 'success');
}

function rejectSuggestion(id) {
    const suggestion = state.pendingSuggestions.find(s => s.id === id);
    if (!suggestion) return;
    
    state.rejectedChanges.push(suggestion);
    state.pendingSuggestions = state.pendingSuggestions.filter(s => s.id !== id);
    
    renderSuggestions();
    showToast(`Skipped: ${suggestion.title}`, 'info');
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
    if (data.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No data</p></div>';
        return;
    }

    const columns = Object.keys(data[0]);
    const displayRows = data.slice(0, 200);
    
    let html = '<table class="data-table"><thead><tr><th class="row-num">#</th>';
    columns.forEach(col => html += `<th>${escapeHtml(col)}</th>`);
    html += '</tr></thead><tbody>';
    
    displayRows.forEach((row, idx) => {
        html += `<tr><td class="row-num">${idx + 1}</td>`;
        columns.forEach(col => {
            const val = row[col];
            const isEmpty = val === '' || val === null || val === undefined;
            html += `<td class="${isEmpty ? 'cell-empty' : ''}">${isEmpty ? '∅' : escapeHtml(String(val))}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    
    if (data.length > 200) {
        html += `<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
            Showing 200 of ${data.length.toLocaleString()} rows
        </div>`;
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
        container.innerHTML = `<div class="empty-state"><p>✓ All done!</p></div>`;
        return;
    }
    
    container.innerHTML = state.pendingSuggestions.map(s => `
        <div class="suggestion-card">
            <div class="suggestion-header">
                <span class="suggestion-badge badge-approval">${s.type.replace('_', ' ')}</span>
            </div>
            <div class="suggestion-title">${escapeHtml(s.title)}</div>
            <div class="suggestion-desc">${s.description}</div>
            <div class="suggestion-meta">Affects ${s.affectedRows} rows</div>
            ${s.options ? `
                <div class="suggestion-options">
                    ${s.options.map(opt => `
                        <button class="option-btn ${s.selectedOption === opt.value ? 'selected' : ''}" 
                                onclick="selectOption('${s.id}', '${opt.value}')">
                            ${opt.label}
                        </button>
                    `).join('')}
                </div>
            ` : ''}
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
                <p style="color: var(--text-secondary); font-size: 0.85rem;">
                    Original: ${state.originalData.length} rows × ${Object.keys(state.originalData[0] || {}).length} cols<br>
                    Cleaned: ${state.stagedData.length} rows × ${state.columns.length} cols
                </p>
            </div>
            <div class="report-section">
                <h3>🤖 Auto-Applied</h3>
                ${state.autoFixes.length > 0 ? state.autoFixes.map(f => `
                    <div class="report-item"><span class="check-icon">✓</span> ${f.description}</div>
                `).join('') : '<p style="color: var(--text-muted); font-size: 0.85rem;">None</p>'}
            </div>
            <div class="report-section">
                <h3>✅ Approved</h3>
                ${state.appliedChanges.length > 0 ? state.appliedChanges.map(c => `
                    <div class="report-item"><span class="check-icon">✓</span> ${c.title}</div>
                `).join('') : '<p style="color: var(--text-muted); font-size: 0.85rem;">None yet</p>'}
            </div>
            <div class="report-section">
                <h3>⏭️ Skipped</h3>
                ${state.rejectedChanges.length > 0 ? state.rejectedChanges.map(c => `
                    <div class="report-item"><span class="skip-icon">–</span> ${c.title}</div>
                `).join('') : '<p style="color: var(--text-muted); font-size: 0.85rem;">None</p>'}
            </div>
        </div>
    `;
}

// ============================================
// UTILITIES
// ============================================
function downloadCleanedData() {
    if (state.stagedData.length === 0) {
        showToast('No data to download', 'error');
        return;
    }

    let content, mimeType, extension;
    
    if (state.fileType === 'json') {
        content = JSON.stringify(state.stagedData, null, 2);
        mimeType = 'application/json';
        extension = 'json';
    } else if (['xlsx', 'xls'].includes(state.fileType)) {
        const ws = XLSX.utils.json_to_sheet(state.stagedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cleaned');
        XLSX.writeFile(wb, `cleaned_${state.fileName}`);
        showToast('✓ Downloaded!', 'success');
        return;
    } else {
        content = Papa.unparse(state.stagedData);
        mimeType = 'text/csv';
        extension = 'csv';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleaned_${state.fileName.replace(/\.[^/.]+$/, '')}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('✓ Downloaded!', 'success');
}

function resetApp() {
    state.originalData = [];
    state.stagedData = [];
    state.columns = [];
    state.fileName = '';
    state.fileType = '';
    state.issues = [];
    state.autoFixes = [];
    state.pendingSuggestions = [];
    state.appliedChanges = [];
    state.rejectedChanges = [];
    state.chatHistory = [];
    
    workspace.classList.add('hidden');
    uploadZone.classList.remove('hidden');
    fileInput.value = '';
    
    document.getElementById('chatMessages').innerHTML = `
        <div class="chat-message assistant">
            <div class="sender">DataScrub Agent</div>
            <div class="bubble">Ready for a new dataset! Drop a file to get started.</div>
        </div>
    `;
    
    renderStats();
    document.getElementById('suggestionsContainer').innerHTML = `
        <div class="empty-state"><p>Upload a file to start cleaning</p></div>
    `;
}

function showToast(message, type = 'info') {
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
