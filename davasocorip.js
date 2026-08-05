const app = document.getElementById('app');
let state = {
  pastes: JSON.parse(localStorage.getItem('miniseres_pastes')) || [],
  currentId: null,
  view: 'editor',
  rawMode: false,
  nameInput: '',
  language: 'auto',
  content: '',
  wordWrap: true,
  securityWarnings: [],
  searchQuery: '',
  sortBy: 'newest',
  theme: 'dark',
  currentRepo: null,
  currentFile: null
};

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function saveState() {
  localStorage.setItem('miniseres_pastes', JSON.stringify(state.pastes));
}

function getDeviceId() {
  let deviceId = localStorage.getItem('miniseres_device_id');
  if (!deviceId) {
    const ua = navigator.userAgent;
    const res = window.screen.width + 'x' + window.screen.height;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hash = btoa(ua + res + tz).substring(0, 12);
    deviceId = 'user_' + hash;
    localStorage.setItem('miniseres_device_id', deviceId);
  }
  return deviceId;
}

function getUsername() {
  let username = localStorage.getItem('miniseres_username');
  if (!username) {
    username = prompt('Nhap ten thiet bi (A-Z, a-z, 0-9, ._-):', 'my-device');
    if (!username || !/^[A-Za-z0-9._-]+$/.test(username)) {
      alert('Ten chi duoc chua A-Z, a-z, 0-9, . _ -');
      username = 'user_' + Date.now().toString(36);
    }
    localStorage.setItem('miniseres_username', username);
  }
  return username;
}

function getRepos() {
  const raw = localStorage.getItem('miniseres_repos');
  return raw ? JSON.parse(raw) : {};
}

function saveRepos(repos) {
  localStorage.setItem('miniseres_repos', JSON.stringify(repos));
}

function createRepo(repoName) {
  const username = getUsername();
  const repos = getRepos();
  if (repos[repoName]) {
    alert('Repo "' + repoName + '" da ton tai!');
    return false;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(repoName)) {
    alert('Ten repo chi duoc chua A-Z, a-z, 0-9, . _ -');
    return false;
  }
  repos[repoName] = {
    name: repoName,
    owner: username,
    deviceId: getDeviceId(),
    created: new Date().toISOString(),
    files: {}
  };
  saveRepos(repos);
  return true;
}

function listRepos() {
  const repos = getRepos();
  return Object.keys(repos);
}

function getFiles(repoName) {
  const repos = getRepos();
  if (!repos[repoName]) return null;
  return repos[repoName].files;
}

function createFile(repoName, fileName, content, language) {
  const repos = getRepos();
  if (!repos[repoName]) {
    alert('Repo khong ton tai!');
    return false;
  }
  if (repos[repoName].files[fileName]) {
    alert('File "' + fileName + '" da ton tai trong repo nay!');
    return false;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(fileName)) {
    alert('Ten file chi duoc chua A-Z, a-z, 0-9, . _ -');
    return false;
  }
  repos[repoName].files[fileName] = {
    content: content,
    language: language,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    views: 0,
    rawViews: 0
  };
  saveRepos(repos);
  return true;
}

function getFile(repoName, fileName) {
  const repos = getRepos();
  if (!repos[repoName]) return null;
  return repos[repoName].files[fileName] || null;
}

function deleteFile(repoName, fileName) {
  const repos = getRepos();
  if (!repos[repoName]) return false;
  delete repos[repoName].files[fileName];
  saveRepos(repos);
  return true;
}

function deleteRepo(repoName) {
  const repos = getRepos();
  if (!repos[repoName]) return false;
  delete repos[repoName];
  saveRepos(repos);
  return true;
}

function navigate(path) {
  if (!path || path === '/') {
    showDashboard();
    return;
  }
  
  const parts = path.split('/').filter(p => p);
  
  if (parts[0] === 'raw' && parts.length >= 3) {
    const repo = parts[1];
    const file = parts.slice(2).join('/');
    showRawFile(repo, file);
    return;
  }
  
  if (parts.length >= 2) {
    const repo = parts[0];
    const file = parts.slice(1).join('/');
    showViewFile(repo, file);
    return;
  }
  
  if (parts[0] === 'history') {
    showHistory();
    return;
  }
  
  if (parts[0] === 'stats') {
    showStats();
    return;
  }
  
  showDashboard();
}

function render() {
  const path = window.location.pathname.replace(/^\/+/, '');
  navigate(path || '/');
}

function scanForSecurityIssues(content, language) {
  const warnings = [];
  
  if (language === 'lua' || language === 'auto') {
    const luaPatterns = [
      { pattern: /loadstring\s*\(/i, msg: 'loadstring() - co the thuc thi ma doc' },
      { pattern: /load\s*\(/i, msg: 'load() - co the thuc thi ma doc' },
      { pattern: /dofile\s*\(/i, msg: 'dofile() - co the doc file he thong' },
      { pattern: /io\.open\s*\(/i, msg: 'io.open() - co the truy cap file he thong' },
      { pattern: /os\.execute\s*\(/i, msg: 'os.execute() - co the thuc thi lenh he thong' },
      { pattern: /os\.remove\s*\(/i, msg: 'os.remove() - co the xoa file' },
      { pattern: /debug\./i, msg: 'debug library - co the truy cap noi bo' }
    ];
    
    for (const p of luaPatterns) {
      if (p.pattern.test(content)) {
        warnings.push(p.msg);
      }
    }
  }
  
  if (language === 'javascript' || language === 'typescript' || language === 'auto') {
    const jsPatterns = [
      { pattern: /eval\s*\(/i, msg: 'eval() - co the thuc thi ma doc' },
      { pattern: /Function\s*\(/i, msg: 'Function() - co the thuc thi ma doc' },
      { pattern: /document\.write\s*\(/i, msg: 'document.write() - co the gay XSS' },
      { pattern: /innerHTML\s*=/i, msg: 'innerHTML - co the gay XSS' }
    ];
    
    for (const p of jsPatterns) {
      if (p.pattern.test(content)) {
        warnings.push(p.msg);
      }
    }
  }
  
  if (language === 'python' || language === 'auto') {
    const pyPatterns = [
      { pattern: /eval\s*\(/i, msg: 'eval() - co the thuc thi ma doc' },
      { pattern: /exec\s*\(/i, msg: 'exec() - co the thuc thi ma doc' },
      { pattern: /__import__\s*\(/i, msg: '__import__() - co the import module nguy hiem' },
      { pattern: /os\.system\s*\(/i, msg: 'os.system() - co the thuc thi lenh he thong' }
    ];
    
    for (const p of pyPatterns) {
      if (p.pattern.test(content)) {
        warnings.push(p.msg);
      }
    }
  }
  
  if (language === 'php' || language === 'auto') {
    const phpPatterns = [
      { pattern: /eval\s*\(/i, msg: 'eval() - co the thuc thi ma doc' },
      { pattern: /system\s*\(/i, msg: 'system() - co the thuc thi lenh he thong' },
      { pattern: /exec\s*\(/i, msg: 'exec() - co the thuc thi lenh he thong' },
      { pattern: /shell_exec\s*\(/i, msg: 'shell_exec() - co the thuc thi lenh he thong' },
      { pattern: /passthru\s*\(/i, msg: 'passthru() - co the thuc thi lenh he thong' }
    ];
    
    for (const p of phpPatterns) {
      if (p.pattern.test(content)) {
        warnings.push(p.msg);
      }
    }
  }
  
  return warnings;
}

function showSecurityWarning(warnings) {
  if (warnings.length === 0) return;
  
  const warningDiv = document.createElement('div');
  warningDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #1a0e0e;
    border: 1px solid #f85149;
    border-radius: 8px;
    padding: 16px 24px;
    max-width: 600px;
    z-index: 9999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    animation: slideDown 0.3s ease;
  `;
  
  warningDiv.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="font-size:20px;color:#f85149;">⚠️</div>
      <div>
        <div style="font-weight:600;color:#f85149;margin-bottom:8px;">Canh bao bao mat</div>
        ${warnings.map(w => `<div style="color:#ffa28b;font-size:13px;margin:4px 0;">• ${w}</div>`).join('')}
        <div style="color:#8b949e;font-size:12px;margin-top:8px;">Day chi la canh bao, code van duoc luu</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(warningDiv);
  
  setTimeout(() => {
    warningDiv.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => warningDiv.remove(), 300);
  }, 8000);
}

function showDashboard() {
  const username = getUsername();
  const deviceId = getDeviceId();
  const repos = getRepos();
  const repoList = Object.keys(repos);
  
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="header-left">
          <div class="logo" onclick="navigate('/')">
            <i class="fas fa-bolt"></i>
            MiniSeres<span>.Raw</span>
          </div>
          <nav class="header-nav">
            <button class="active" onclick="navigate('/')"><i class="fas fa-folder"></i> Dashboard</button>
            <button onclick="navigate('history')"><i class="fas fa-history"></i> History</button>
            <button onclick="navigate('stats')"><i class="fas fa-chart-bar"></i> Stats</button>
          </nav>
        </div>
        <div class="header-actions">
          <span style="color:var(--text-secondary);font-size:13px;display:flex;align-items:center;gap:6px;">
            <i class="fas fa-user"></i> ${username}
          </span>
          <button class="btn" onclick="showNewRepo()"><i class="fas fa-plus"></i> <span>New Repo</span></button>
          <button class="btn" onclick="navigate('/')"><i class="fas fa-sync"></i> <span>Refresh</span></button>
        </div>
      </header>
      <div class="editor-container">
        <div style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 0;">
          <div style="flex:1;min-width:200px;">
            <h3 style="color:var(--text-secondary);font-size:14px;margin-bottom:8px;">📁 Repositories</h3>
            ${repoList.length === 0 ? `
              <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:24px;text-align:center;">
                <i class="fas fa-inbox" style="font-size:32px;color:var(--text-muted);"></i>
                <p style="color:var(--text-secondary);margin-top:8px;">Chua co repo nao</p>
                <button class="btn btn-primary" onclick="showNewRepo()" style="margin-top:12px;">
                  <i class="fas fa-plus"></i> Tao repo dau tien
                </button>
              </div>
            ` : ''}
            ${repoList.map(repoName => {
              const repo = repos[repoName];
              const fileCount = Object.keys(repo.files).length;
              return `
                <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                  <div style="cursor:pointer;" onclick="openRepo('${repoName}')">
                    <div style="font-weight:500;color:var(--text-primary);">
                      <i class="fas fa-folder" style="color:var(--accent-orange);"></i> ${repoName}
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary);">
                      ${fileCount} file${fileCount !== 1 ? 's' : ''} • ${new Date(repo.created).toLocaleDateString()}
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;">
                    <button class="btn" onclick="openRepo('${repoName}')" style="padding:4px 10px;font-size:12px;">
                      <i class="fas fa-folder-open"></i>
                    </button>
                    <button class="btn btn-danger" onclick="deleteRepo('${repoName}')" style="padding:4px 10px;font-size:12px;">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="status-bar">
        <span><i class="fas fa-shield-alt" style="color:var(--accent-green);"></i> ${deviceId}</span>
        <span>${repoList.length} repo${repoList.length !== 1 ? 's' : ''}</span>
        <span><i class="fas fa-circle" style="color:var(--accent-green);font-size:8px;"></i> Ready</span>
      </div>
    </div>
  `;
}

function showNewRepo() {
  const name = prompt('Nhap ten repo (A-Z, a-z, 0-9, ._-):');
  if (!name) return;
  if (createRepo(name)) {
    showToast('Da tao repo "' + name + '"!');
    showDashboard();
  }
}

function openRepo(repoName) {
  state.currentRepo = repoName;
  showRepoFiles(repoName);
}

function showRepoFiles(repoName) {
  const repos = getRepos();
  const repo = repos[repoName];
  if (!repo) {
    showDashboard();
    return;
  }
  
  const files = Object.keys(repo.files);
  const username = getUsername();
  
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="header-left">
          <div class="logo" onclick="navigate('/')">
            <i class="fas fa-bolt"></i>
            MiniSeres<span>.Raw</span>
          </div>
          <nav class="header-nav">
            <button onclick="navigate('/')"><i class="fas fa-folder"></i> Dashboard</button>
            <button class="active"><i class="fas fa-folder-open"></i> ${repoName}</button>
            <button onclick="navigate('history')"><i class="fas fa-history"></i> History</button>
          </nav>
        </div>
        <div class="header-actions">
          <button class="btn btn-success" onclick="showNewFile('${repoName}')"><i class="fas fa-plus"></i> <span>New File</span></button>
          <button class="btn" onclick="navigate('/')"><i class="fas fa-arrow-left"></i> <span>Back</span></button>
        </div>
      </header>
      <div class="editor-container">
        <div style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 0;">
          <div style="flex:1;min-width:200px;">
            <h3 style="color:var(--text-secondary);font-size:14px;margin-bottom:8px;">
              📄 Files in <span style="color:var(--text-primary);">${repoName}</span>
            </h3>
            ${files.length === 0 ? `
              <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:24px;text-align:center;">
                <i class="fas fa-file" style="font-size:32px;color:var(--text-muted);"></i>
                <p style="color:var(--text-secondary);margin-top:8px;">Chua co file nao</p>
                <button class="btn btn-primary" onclick="showNewFile('${repoName}')" style="margin-top:12px;">
                  <i class="fas fa-plus"></i> Tao file dau tien
                </button>
              </div>
            ` : ''}
            ${files.map(fileName => {
              const file = repo.files[fileName];
              return `
                <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                  <div style="cursor:pointer;" onclick="navigate('${repoName}/${fileName}')">
                    <div style="font-weight:500;color:var(--text-primary);">
                      <i class="fas fa-file-code" style="color:var(--accent-blue);"></i> ${fileName}
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary);">
                      ${file.language} • ${file.content.length} chars • 👁 ${file.views || 0}
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;">
                    <button class="btn" onclick="navigate('${repoName}/${fileName}')" style="padding:4px 10px;font-size:12px;">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn" onclick="navigate('raw/${repoName}/${fileName}')" style="padding:4px 10px;font-size:12px;">
                      <i class="fas fa-link"></i>
                    </button>
                    <button class="btn btn-danger" onclick="deleteFile('${repoName}', '${fileName}')" style="padding:4px 10px;font-size:12px;">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="status-bar">
        <span><i class="fas fa-folder"></i> ${repoName}</span>
        <span>${files.length} file${files.length !== 1 ? 's' : ''}</span>
        <span><i class="fas fa-circle" style="color:var(--accent-green);font-size:8px;"></i> Ready</span>
      </div>
    </div>
  `;
}

function showNewFile(repoName) {
  const fileName = prompt('Nhap ten file (A-Z, a-z, 0-9, ._-):');
  if (!fileName) return;
  
  state.currentRepo = repoName;
  state.currentFile = fileName;
  state.content = '';
  state.language = 'auto';
  state.nameInput = fileName;
  
  showEditor(repoName, fileName);
}

function showEditor(repoName, fileName) {
  state.view = 'editor';
  state.rawMode = false;
  state.content = '';
  state.language = 'auto';
  state.nameInput = fileName || 'untitled';
  state.securityWarnings = [];
  
  const existing = fileName ? getFile(repoName, fileName) : null;
  if (existing) {
    state.content = existing.content;
    state.language = existing.language;
  }
  
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="header-left">
          <div class="logo" onclick="navigate('/')">
            <i class="fas fa-bolt"></i>
            MiniSeres<span>.Raw</span>
          </div>
          <nav class="header-nav">
            <button onclick="navigate('/')"><i class="fas fa-folder"></i> Dashboard</button>
            <button onclick="openRepo('${repoName}')"><i class="fas fa-folder-open"></i> ${repoName}</button>
            <button class="active"><i class="fas fa-edit"></i> ${fileName || 'Editor'}</button>
          </nav>
        </div>
        <div class="header-actions">
          <button class="btn" onclick="openRepo('${repoName}')"><i class="fas fa-arrow-left"></i> <span>Back</span></button>
        </div>
      </header>
      <div class="editor-container">
        <div class="toolbar">
          <select id="langSelect">
            <option value="auto">Auto-detect</option>
            <option value="python">Python</option>
            <option value="lua">Lua</option>
            <option value="cpp">C++</option>
            <option value="ruby">Ruby</option>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="sql">SQL</option>
            <option value="bash">Bash</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
            <option value="php">PHP</option>
          </select>
          <input type="text" id="nameInput" placeholder="Ten file..." value="${fileName || 'untitled'}">
          <button class="btn" onclick="loadFromFile()"><i class="fas fa-folder-open"></i> File</button>
          <button class="btn btn-success" onclick="saveFileToRepo('${repoName}')"><i class="fas fa-save"></i> Save</button>
          <button class="btn" onclick="toggleWordWrap()"><i class="fas ${state.wordWrap ? 'fa-wrap' : 'fa-arrows-alt'}"></i></button>
          <button class="btn" onclick="formatCode()"><i class="fas fa-magic"></i></button>
          <button class="btn" onclick="copyContent()"><i class="fas fa-copy"></i></button>
          <button class="btn" onclick="downloadContent()"><i class="fas fa-download"></i></button>
          <button class="btn" onclick="scanCode()" style="background:#1a0e0e;border-color:#f85149;color:#f85149;">
            <i class="fas fa-shield-alt"></i> Scan
          </button>
        </div>
        <div class="editor-wrapper">
          <div class="line-numbers" id="lineNumbers">1</div>
          <div class="code-area">
            <textarea id="codeEditor" spellcheck="false" placeholder="// Viet code cua ban o day..."></textarea>
            <pre><code id="highlightCode" class=""></code></pre>
          </div>
        </div>
      </div>
      <div class="status-bar">
        <span id="securityStatus"><i class="fas fa-shield-alt" style="color:var(--accent-green);"></i> Safe</span>
        <span id="charCount">0 characters</span>
        <span id="lineCount">0 lines</span>
        <span><i class="fas fa-circle" style="color:var(--accent-green);font-size:8px;"></i> Ready</span>
      </div>
    </div>
  `;
  
  const editor = document.getElementById('codeEditor');
  const lineNumbers = document.getElementById('lineNumbers');
  const highlightCode = document.getElementById('highlightCode');
  const langSelect = document.getElementById('langSelect');
  const nameInput = document.getElementById('nameInput');
  
  if (state.content) {
    editor.value = state.content;
  }
  
  if (state.language) {
    langSelect.value = state.language;
  }
  
  if (state.nameInput) {
    nameInput.value = state.nameInput;
  }
  
  editor.addEventListener('input', function() {
    state.content = this.value;
    const lang = langSelect.value;
    updateHighlight(this.value, lang);
    updateLineNumbers(this.value);
    updateStats(this.value);
    
    const warnings = scanForSecurityIssues(this.value, lang);
    state.securityWarnings = warnings;
    updateSecurityStatus(warnings);
  });
  
  editor.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.selectionStart;
      const end = this.selectionEnd;
      this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
      this.selectionStart = this.selectionEnd = start + 2;
      state.content = this.value;
      updateHighlight(this.value, langSelect.value);
      updateLineNumbers(this.value);
      updateStats(this.value);
    }
    
    if (e.key === 'Enter') {
      const start = this.selectionStart;
      const lineStart = this.value.lastIndexOf('\n', start - 1) + 1;
      const lineText = this.value.substring(lineStart, start);
      const indent = lineText.match(/^(\s*)/)[0];
      const extraIndent = lineText.trim().endsWith('{') || lineText.trim().endsWith('(') || lineText.trim().endsWith('[') ? '  ' : '';
      this.value = this.value.substring(0, start) + '\n' + indent + extraIndent + this.value.substring(start);
      this.selectionStart = this.selectionEnd = start + indent.length + extraIndent.length + 1;
      state.content = this.value;
      updateHighlight(this.value, langSelect.value);
      updateLineNumbers(this.value);
      updateStats(this.value);
      e.preventDefault();
    }
  });
  
  editor.addEventListener('scroll', function() {
    lineNumbers.scrollTop = this.scrollTop;
  });
  
  langSelect.addEventListener('change', function() {
    state.language = this.value;
    updateHighlight(editor.value, this.value);
    const warnings = scanForSecurityIssues(editor.value, this.value);
    state.securityWarnings = warnings;
    updateSecurityStatus(warnings);
  });
  
  nameInput.addEventListener('input', function() {
    state.nameInput = this.value || 'untitled';
  });
  
  updateHighlight(editor.value, langSelect.value);
  updateLineNumbers(editor.value);
  updateStats(editor.value);
  
  const initialWarnings = scanForSecurityIssues(editor.value, langSelect.value);
  state.securityWarnings = initialWarnings;
  updateSecurityStatus(initialWarnings);
  
  editor.focus();
}

function saveFileToRepo(repoName) {
  const editor = document.getElementById('codeEditor');
  const nameInput = document.getElementById('nameInput');
  const langSelect = document.getElementById('langSelect');
  
  const content = editor ? editor.value : state.content;
  const fileName = nameInput ? nameInput.value.trim() || 'untitled' : 'untitled';
  const language = langSelect ? langSelect.value : state.language;
  
  if (!content.trim()) {
    showToast('Vui long nhap noi dung!');
    return;
  }
  
  const warnings = scanForSecurityIssues(content, language);
  if (warnings.length > 0) {
    const confirmSave = confirm(
      'Phat hien ' + warnings.length + ' van de bao mat:\n\n' + warnings.join('\n') + '\n\nVan muon luu file?'
    );
    if (!confirmSave) return;
  }
  
  const repos = getRepos();
  if (!repos[repoName]) {
    showToast('Repo khong ton tai!');
    return;
  }
  
  if (repos[repoName].files[fileName]) {
    const confirmOverwrite = confirm('File "' + fileName + '" da ton tai. Ghi de?');
    if (!confirmOverwrite) return;
  }
  
  repos[repoName].files[fileName] = {
    content: content,
    language: language,
    created: repos[repoName].files[fileName] ? repos[repoName].files[fileName].created : new Date().toISOString(),
    updated: new Date().toISOString(),
    views: repos[repoName].files[fileName] ? repos[repoName].files[fileName].views || 0 : 0,
    rawViews: repos[repoName].files[fileName] ? repos[repoName].files[fileName].rawViews || 0 : 0
  };
  
  saveRepos(repos);
  showToast('Da luu file "' + fileName + '"!');
  
  const url = '/' + repoName + '/' + encodeURIComponent(fileName);
  window.history.pushState({}, '', url);
  openRepo(repoName);
}

function showViewFile(repoName, fileName) {
  const file = getFile(repoName, fileName);
  if (!file) {
    showDashboard();
    return;
  }
  
  const repos = getRepos();
  repos[repoName].files[fileName].views = (repos[repoName].files[fileName].views || 0) + 1;
  saveRepos(repos);
  
  const rawUrl = '/raw/' + repoName + '/' + encodeURIComponent(fileName);
  const warnings = scanForSecurityIssues(file.content, file.language);
  
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="header-left">
          <div class="logo" onclick="navigate('/')">
            <i class="fas fa-bolt"></i>
            MiniSeres<span>.Raw</span>
          </div>
          <nav class="header-nav">
            <button onclick="navigate('/')"><i class="fas fa-folder"></i> Dashboard</button>
            <button onclick="openRepo('${repoName}')"><i class="fas fa-folder-open"></i> ${repoName}</button>
            <button class="active"><i class="fas fa-file-code"></i> ${fileName}</button>
          </nav>
        </div>
        <div class="header-actions">
          <button class="btn" onclick="openRepo('${repoName}')"><i class="fas fa-arrow-left"></i> <span>Back</span></button>
        </div>
      </header>
      <div class="view-container">
        <div class="view-header">
          <div class="info">
            <span class="badge"><i class="fas fa-code"></i> ${file.language}</span>
            <span class="badge"><i class="fas fa-eye"></i> ${file.views || 0}</span>
            <span class="badge"><i class="fas fa-calendar"></i> ${new Date(file.created).toLocaleDateString()}</span>
            <span class="badge"><i class="fas fa-tag"></i> ${fileName}</span>
            ${warnings.length > 0 ? `<span class="badge" style="border-color:#f85149;color:#f85149;"><i class="fas fa-exclamation-triangle"></i> ${warnings.length} warnings</span>` : ''}
          </div>
          <div class="actions">
            <button class="btn" onclick="copyViewContent()"><i class="fas fa-copy"></i></button>
            <button class="btn" onclick="downloadViewContent()"><i class="fas fa-download"></i></button>
            <button class="btn btn-primary" onclick="window.open('${rawUrl}', '_blank')"><i class="fas fa-link"></i> RAW</button>
            <button class="btn" onclick="copyRawLink('${rawUrl}')"><i class="fas fa-copy"></i> Link</button>
            <button class="btn" onclick="editFile('${repoName}', '${fileName}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger" onclick="deleteFile('${repoName}', '${fileName}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        ${warnings.length > 0 ? `
          <div style="background:#1a0e0e;border:1px solid #f85149;border-radius:8px;padding:12px 16px;flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:8px;color:#f85149;font-weight:600;font-size:13px;">
              <i class="fas fa-shield-alt"></i>
              Canh bao bao mat: ${warnings.length} van de
            </div>
            ${warnings.map(w => `<div style="color:#ffa28b;font-size:12px;margin:4px 0 0 24px;">• ${w}</div>`).join('')}
          </div>
        ` : ''}
        <div class="view-content">
          <pre><code class="${file.language}">${escapeHtml(file.content)}</code></pre>
        </div>
      </div>
      <div class="status-bar">
        <span><i class="fas fa-link"></i> ${window.location.origin}${rawUrl}</span>
        <span><i class="fas fa-circle" style="color:var(--accent-green);font-size:8px;"></i> ${file.views || 0} views</span>
        <span>${file.content.length} chars</span>
      </div>
    </div>
  `;
  
  const codeEl = document.querySelector('.view-content code');
  if (codeEl && window.hljs) {
    try {
      window.hljs.highlightElement(codeEl);
    } catch(e) {}
  }
}

function showRawFile(repoName, fileName) {
  const file = getFile(repoName, fileName);
  if (!file) {
    document.body.innerHTML = '<div style="padding:20px;font-family:monospace;">404 - File not found</div>';
    return;
  }
  
  const repos = getRepos();
  repos[repoName].files[fileName].rawViews = (repos[repoName].files[fileName].rawViews || 0) + 1;
  saveRepos(repos);
  
  document.body.innerHTML = `
    <div class="raw-container">
      <div class="raw-content">${escapeHtml(file.content)}</div>
    </div>
  `;
  
  document.body.style.margin = '0';
  document.body.style.background = '#ffffff';
}

function editFile(repoName, fileName) {
  const file = getFile(repoName, fileName);
  if (!file) return;
  state.content = file.content;
  state.language = file.language;
  state.nameInput = fileName;
  showEditor(repoName, fileName);
}

function deleteFile(repoName, fileName) {
  if (!confirm('Xoa file "' + fileName + '"?')) return;
  if (deleteFile(repoName, fileName)) {
    showToast('Da xoa file!');
    openRepo(repoName);
  }
}

function deleteRepo(repoName) {
  if (!confirm('Xoa repo "' + repoName + '" va tat ca file trong do?')) return;
  if (deleteRepo(repoName)) {
    showToast('Da xoa repo!');
    showDashboard();
  }
}

function updateStats(content) {
  const charCount = document.getElementById('charCount');
  const lineCount = document.getElementById('lineCount');
  if (charCount) charCount.textContent = content.length + ' characters';
  if (lineCount) lineCount.textContent = content.split('\n').length + ' lines';
}

function updateSecurityStatus(warnings) {
  const statusEl = document.getElementById('securityStatus');
  if (!statusEl) return;
  
  if (warnings.length === 0) {
    statusEl.innerHTML = '<i class="fas fa-shield-alt" style="color:var(--accent-green);"></i> Safe';
    statusEl.style.color = 'var(--text-secondary)';
  } else {
    statusEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:#f85149;"></i> ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`;
    statusEl.style.color = '#f85149';
  }
}

function scanCode() {
  const editor = document.getElementById('codeEditor');
  const langSelect = document.getElementById('langSelect');
  if (!editor) return;
  
  const content = editor.value;
  const lang = langSelect ? langSelect.value : 'auto';
  const warnings = scanForSecurityIssues(content, lang);
  state.securityWarnings = warnings;
  updateSecurityStatus(warnings);
  
  if (warnings.length > 0) {
    showSecurityWarning(warnings);
  } else {
    showToast('Khong phat hien van de bao mat!');
  }
}

function updateHighlight(content, language) {
  const codeEl = document.getElementById('highlightCode');
  if (!codeEl) return;
  
  let lang = language;
  if (lang === 'auto') {
    const detected = detectLanguage(content);
    lang = detected || 'plaintext';
  }
  
  codeEl.className = lang;
  codeEl.textContent = content;
  
  if (window.hljs) {
    try {
      window.hljs.highlightElement(codeEl);
    } catch(e) {
      codeEl.className = 'plaintext';
    }
  }
}

function detectLanguage(content) {
  if (!content.trim()) return 'plaintext';
  const patterns = {
    python: /^\s*(import|from|def|class|if|elif|else|for|while|return|print|lambda|async|await)\s/,
    lua: /^\s*(function|local|if|then|else|for|while|do|end|return|print|require|loadstring|load|dofile)\s/,
    cpp: /^\s*(#include|using namespace|int main|class|public:|private:|protected:|std::|template)/,
    ruby: /^\s*(def|class|if|elsif|else|unless|while|until|for|do|end|puts|print|require|attr_)/,
    typescript: /^\s*(interface|type|enum|namespace|export|import|class|function|const|let|var|:)\s/,
    javascript: /^\s*(function|const|let|var|if|else|for|while|return|console\.|document\.|window\.|=>|eval)\s/,
    html: /^\s*<!DOCTYPE html>|<html|<head|<body|<div|<span|<p|<a|<img|<script|<style/,
    css: /^\s*[.#][a-zA-Z]+\s*\{|\s*@media|@keyframes|@import|@font-face/,
    json: /^(\s*\{(\s*".*"\s*:.*\s*,?\s*)*\s*\}|\s*\[(\s*.*\s*,?\s*)*\s*\])/,
    sql: /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING)/i,
    bash: /^\s*(#!\/bin\/bash|echo|export|cd|ls|pwd|grep|sed|awk|if|then|else|fi|for|while|do|done|chmod)/,
    go: /^\s*(package|import|func|type|struct|interface|map|chan|go|defer|return|if|else|for|switch)/,
    rust: /^\s*(use|fn|let|mut|pub|struct|enum|impl|trait|match|if|else|loop|while|for|return|println!|macro_rules!)/,
    php: /^\s*(<\?php|<\?|echo|print|function|class|if|else|foreach|while|return|\$[a-zA-Z]|namespace|use|eval|system)/
  };
  
  const lines = content.split('\n').filter(l => l.trim());
  for (const line of lines) {
    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(line)) {
        return lang;
      }
    }
  }
  return 'plaintext';
}

function updateLineNumbers(content) {
  const lineNumbers = document.getElementById('lineNumbers');
  if (!lineNumbers) return;
  const lines = content.split('\n');
  const count = lines.length || 1;
  lineNumbers.textContent = Array.from({length: count}, (_, i) => i + 1).join('\n');
}

function loadFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.js,.py,.lua,.cpp,.c,.rb,.ts,.html,.css,.json,.sql,.sh,.go,.rs,.php,.md,.yml,.yaml,.toml';
  input.onchange = function(e) {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      const content = ev.target.result;
      const editor = document.getElementById('codeEditor');
      if (editor) {
        editor.value = content;
        state.content = content;
        const lang = document.getElementById('langSelect').value;
        updateHighlight(content, lang);
        updateLineNumbers(content);
        updateStats(content);
        
        const warnings = scanForSecurityIssues(content, lang);
        state.securityWarnings = warnings;
        updateSecurityStatus(warnings);
        if (warnings.length > 0) {
          showSecurityWarning(warnings);
        }
      }
      const nameInput = document.getElementById('nameInput');
      if (nameInput) {
        nameInput.value = file.name.replace(/\.[^/.]+$/, '');
        state.nameInput = nameInput.value;
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function showHistory() {
  const username = getUsername();
  const repos = getRepos();
  let allFiles = [];
  
  for (const [repoName, repo] of Object.entries(repos)) {
    for (const [fileName, file] of Object.entries(repo.files)) {
      allFiles.push({
        repo: repoName,
        fileName: fileName,
        ...file
      });
    }
  }
  
  allFiles.sort((a, b) => new Date(b.updated) - new Date(a.updated));
  
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="header-left">
          <div class="logo" onclick="navigate('/')">
            <i class="fas fa-bolt"></i>
            MiniSeres<span>.Raw</span>
          </div>
          <nav class="header-nav">
            <button onclick="navigate('/')"><i class="fas fa-folder"></i> Dashboard</button>
            <button class="active"><i class="fas fa-history"></i> History</button>
            <button onclick="navigate('stats')"><i class="fas fa-chart-bar"></i> Stats</button>
          </nav>
        </div>
        <div class="header-actions">
          <button class="btn" onclick="navigate('/')"><i class="fas fa-plus"></i> <span>New</span></button>
          <button class="btn" onclick="exportAllPastes()"><i class="fas fa-download"></i> <span>Export</span></button>
          <button class="btn" onclick="clearAllPastes()"><i class="fas fa-trash"></i> <span>Clear</span></button>
        </div>
      </header>
      <div class="history-container">
        <div class="history-header">
          <h2><i class="fas fa-history"></i> Lich su Paste</h2>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" class="search-box" id="searchBox" placeholder="Tim kiem...">
          </div>
        </div>
        <div class="history-list" id="historyList">
          ${allFiles.length === 0 ? `
            <div class="history-empty">
              <i class="fas fa-inbox"></i>
              <h3>Chua co paste nao</h3>
              <p>Tao paste dau tien cua ban ngay bay gio!</p>
              <button class="btn btn-primary" onclick="navigate('/')" style="margin-top:16px;"><i class="fas fa-plus"></i> Tao paste</button>
            </div>
          ` : ''}
          ${allFiles.map(p => {
            const warnings = scanForSecurityIssues(p.content, p.language);
            return `
            <div class="history-item">
              <div class="info">
                <div class="name">
                  <i class="fas fa-file-code"></i>
                  ${p.fileName}
                  <span style="font-size:11px;color:var(--text-muted);font-weight:400;">${p.language}</span>
                  <span style="font-size:11px;color:var(--accent-orange);">📁 ${p.repo}</span>
                  ${warnings.length > 0 ? `<span style="font-size:11px;color:#f85149;"><i class="fas fa-exclamation-triangle"></i> ${warnings.length}</span>` : ''}
                </div>
                <div class="meta">
                  <span><i class="far fa-calendar-alt"></i> ${new Date(p.created).toLocaleString()}</span>
                  <span><i class="fas fa-eye"></i> ${p.views || 0}</span>
                  <span><i class="fas fa-link"></i> ${p.rawViews || 0}</span>
                  <span><i class="fas fa-code"></i> ${p.content.length} chars</span>
                  <span><i class="fas fa-clock"></i> ${timeAgo(p.updated)}</span>
                </div>
              </div>
              <div class="actions">
                <button class="btn" onclick="navigate('${p.repo}/${p.fileName}')"><i class="fas fa-eye"></i></button>
                <button class="btn" onclick="navigate('raw/${p.repo}/${p.fileName}')"><i class="fas fa-link"></i></button>
                <button class="btn" onclick="copyPasteLink('${p.repo}', '${p.fileName}')"><i class="fas fa-copy"></i></button>
                <button class="btn btn-danger" onclick="deleteFile('${p.repo}', '${p.fileName}')"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `}).join('')}
        </div>
      </div>
    </div>
  `;
}

function showStats() {
  const repos = getRepos();
  let totalFiles = 0;
  let totalViews = 0;
  let totalRawViews = 0;
  let totalChars = 0;
  const languages = {};
  let totalRepos = Object.keys(repos).length;
  
  for (const [repoName, repo] of Object.entries(repos)) {
    for (const [fileName, file] of Object.entries(repo.files)) {
      totalFiles++;
      totalViews += file.views || 0;
      totalRawViews += file.rawViews || 0;
      totalChars += file.content.length;
      languages[file.language] = (languages[file.language] || 0) + 1;
    }
  }
  
  const mostUsedLang = Object.entries(languages).sort((a, b) => b[1] - a[1])[0];
  
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="header-left">
          <div class="logo" onclick="navigate('/')">
            <i class="fas fa-bolt"></i>
            MiniSeres<span>.Raw</span>
          </div>
          <nav class="header-nav">
            <button onclick="navigate('/')"><i class="fas fa-folder"></i> Dashboard</button>
            <button onclick="navigate('history')"><i class="fas fa-history"></i> History</button>
            <button class="active"><i class="fas fa-chart-bar"></i> Stats</button>
          </nav>
        </div>
        <div class="header-actions">
          <button class="btn" onclick="navigate('/')"><i class="fas fa-plus"></i> <span>New</span></button>
          <button class="btn" onclick="navigate('history')"><i class="fas fa-clock"></i> <span>History</span></button>
        </div>
      </header>
      <div class="history-container">
        <h2 style="font-size:18px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
          <i class="fas fa-chart-bar"></i> Thong ke
        </h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="number">${totalRepos}</div>
            <div class="label">📁 Repos</div>
          </div>
          <div class="stat-card">
            <div class="number">${totalFiles}</div>
            <div class="label">📄 Files</div>
          </div>
          <div class="stat-card">
            <div class="number">${totalViews}</div>
            <div class="label">👁 Views</div>
          </div>
          <div class="stat-card">
            <div class="number">${totalRawViews}</div>
            <div class="label">🔗 Raw views</div>
          </div>
          <div class="stat-card">
            <div class="number">${formatSize(totalChars)}</div>
            <div class="label">📦 Tong du lieu</div>
          </div>
          <div class="stat-card">
            <div class="number">${mostUsedLang ? mostUsedLang[0] : 'N/A'}</div>
            <div class="label">🏆 Ngon ngu pho bien</div>
          </div>
        </div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:16px;">
          <h3 style="font-size:14px;color:var(--text-secondary);margin-bottom:12px;">📊 Ngon ngu su dung</h3>
          ${Object.entries(languages).map(([lang, count]) => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);font-size:13px;">
              <span>${lang}</span>
              <span style="color:var(--text-secondary);">${count} file${count > 1 ? 's' : ''}</span>
            </div>
          `).join('')}
          ${Object.keys(languages).length === 0 ? '<div style="color:var(--text-muted);font-size:13px;">Chua co du lieu</div>' : ''}
        </div>
      </div>
    </div>
  `;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return seconds + 's';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h';
  const days = Math.floor(hours / 24);
  if (days < 30) return days + 'd';
  return Math.floor(days / 30) + 'mo';
}

function clearAllPastes() {
  if (!confirm('Xoa TAT CA paste? Khong the hoan tac!')) return;
  state.pastes = [];
  saveState();
  showHistory();
  showToast('Da xoa tat ca!');
}

function copyPasteLink(repo, file) {
  const url = window.location.origin + '/' + repo + '/' + file;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Da copy link!');
  }).catch(() => {});
}

function exportAllPastes() {
  const data = JSON.stringify(getRepos(), null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'miniseres_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Da export!');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyContent() {
  const editor = document.getElementById('codeEditor');
  if (editor) {
    navigator.clipboard.writeText(editor.value).then(() => {
      showToast('Da copy noi dung!');
    }).catch(() => {
      editor.select();
      document.execCommand('copy');
      showToast('Da copy noi dung!');
    });
  }
}

function copyViewContent() {
  const content = document.querySelector('.view-content');
  if (content) {
    navigator.clipboard.writeText(content.textContent).then(() => {
      showToast('Da copy noi dung!');
    }).catch(() => {});
  }
}

function copyRawLink(rawUrl) {
  const fullUrl = window.location.origin + rawUrl;
  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast('Da copy link RAW!');
  }).catch(() => {
    showToast('Link RAW: ' + fullUrl);
  });
}

function downloadContent() {
  const editor = document.getElementById('codeEditor');
  if (editor) {
    const blob = new Blob([editor.value], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = document.getElementById('nameInput');
    a.download = (name ? name.value : 'paste') + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
}

function downloadViewContent() {
  const content = document.querySelector('.view-content');
  if (content) {
    const blob = new Blob([content.textContent], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paste.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
}

function toggleWordWrap() {
  state.wordWrap = !state.wordWrap;
  const editor = document.getElementById('codeEditor');
  if (editor) {
    editor.style.whiteSpace = state.wordWrap ? 'pre-wrap' : 'pre';
    editor.style.wordWrap = state.wordWrap ? 'break-word' : 'normal';
  }
  const pre = document.querySelector('.code-area pre');
  if (pre) {
    pre.style.whiteSpace = state.wordWrap ? 'pre-wrap' : 'pre';
    pre.style.wordWrap = state.wordWrap ? 'break-word' : 'normal';
  }
  showToast(state.wordWrap ? 'Word wrap: ON' : 'Word wrap: OFF');
}

function formatCode() {
  const editor = document.getElementById('codeEditor');
  const langSelect = document.getElementById('langSelect');
  if (!editor) return;
  
  const content = editor.value;
  const lang = langSelect ? langSelect.value : 'auto';
  
  let formatted = content;
  
  if (lang === 'json') {
    try {
      formatted = JSON.stringify(JSON.parse(content), null, 2);
    } catch(e) {
      showToast('Loi format JSON!');
      return;
    }
  } else if (lang === 'html' || lang === 'xml') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      formatted = doc.documentElement.outerHTML;
    } catch(e) {}
  } else {
    formatted = content.split('\n').map(line => line.trim()).join('\n');
  }
  
  editor.value = formatted;
  state.content = formatted;
  updateHighlight(formatted, langSelect ? langSelect.value : 'auto');
  updateLineNumbers(formatted);
  updateStats(formatted);
  showToast('Da format!');
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 9999;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    animation: slideIn 0.3s ease;
    max-width: 400px;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes slideUp {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(20px); }
  }
`;
document.head.appendChild(style);

window.addEventListener('popstate', render);

render();
