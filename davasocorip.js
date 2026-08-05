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
  theme: 'dark'
};

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function saveState() {
  localStorage.setItem('miniseres_pastes', JSON.stringify(state.pastes));
}

function navigate(path) {
  if (!path || path === '/') {
    showEditor();
    return;
  }
  
  const parts = path.split('/').filter(p => p);
  
  if (parts[0] === 'raw' && parts.length >= 2) {
    const id = parts[1];
    const name = parts.slice(2).join('/') || '';
    showRaw(id, name);
    return;
  }
  
  if (parts[0] === 'view' && parts.length >= 2) {
    const id = parts[1];
    const name = parts.slice(2).join('/') || '';
    showView(id, name);
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
  
  showEditor();
}

function render() {
  const path = window.location.pathname;
  navigate(path);
}

function scanForSecurityIssues(content, language) {
  const warnings = [];
  
  if (language === 'lua' || language === 'auto') {
    const luaPatterns = [
      { pattern: /loadstring\s*\(/i, msg: '⚠️ loadstring() - có thể thực thi mã độc' },
      { pattern: /load\s*\(/i, msg: '⚠️ load() - có thể thực thi mã độc' },
      { pattern: /dofile\s*\(/i, msg: '⚠️ dofile() - có thể đọc file hệ thống' },
      { pattern: /io\.open\s*\(/i, msg: '⚠️ io.open() - có thể truy cập file hệ thống' },
      { pattern: /os\.execute\s*\(/i, msg: '⚠️ os.execute() - có thể thực thi lệnh hệ thống' },
      { pattern: /os\.remove\s*\(/i, msg: '⚠️ os.remove() - có thể xóa file' },
      { pattern: /debug\./i, msg: '⚠️ debug library - có thể truy cập nội bộ' }
    ];
    
    for (const p of luaPatterns) {
      if (p.pattern.test(content)) {
        warnings.push(p.msg);
      }
    }
  }
  
  if (language === 'javascript' || language === 'typescript' || language === 'auto') {
    const jsPatterns = [
      { pattern: /eval\s*\(/i, msg: '⚠️ eval() - có thể thực thi mã độc' },
      { pattern: /Function\s*\(/i, msg: '⚠️ Function() - có thể thực thi mã độc' },
      { pattern: /document\.write\s*\(/i, msg: '⚠️ document.write() - có thể gây XSS' },
      { pattern: /innerHTML\s*=/i, msg: '⚠️ innerHTML - có thể gây XSS' }
    ];
    
    for (const p of jsPatterns) {
      if (p.pattern.test(content)) {
        warnings.push(p.msg);
      }
    }
  }
  
  if (language === 'python' || language === 'auto') {
    const pyPatterns = [
      { pattern: /eval\s*\(/i, msg: '⚠️ eval() - có thể thực thi mã độc' },
      { pattern: /exec\s*\(/i, msg: '⚠️ exec() - có thể thực thi mã độc' },
      { pattern: /__import__\s*\(/i, msg: '⚠️ __import__() - có thể import module nguy hiểm' },
      { pattern: /os\.system\s*\(/i, msg: '⚠️ os.system() - có thể thực thi lệnh hệ thống' }
    ];
    
    for (const p of pyPatterns) {
      if (p.pattern.test(content)) {
        warnings.push(p.msg);
      }
    }
  }
  
  if (language === 'php' || language === 'auto') {
    const phpPatterns = [
      { pattern: /eval\s*\(/i, msg: '⚠️ eval() - có thể thực thi mã độc' },
      { pattern: /system\s*\(/i, msg: '⚠️ system() - có thể thực thi lệnh hệ thống' },
      { pattern: /exec\s*\(/i, msg: '⚠️ exec() - có thể thực thi lệnh hệ thống' },
      { pattern: /shell_exec\s*\(/i, msg: '⚠️ shell_exec() - có thể thực thi lệnh hệ thống' },
      { pattern: /passthru\s*\(/i, msg: '⚠️ passthru() - có thể thực thi lệnh hệ thống' }
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
        <div style="font-weight:600;color:#f85149;margin-bottom:8px;">Cảnh báo bảo mật</div>
        ${warnings.map(w => `<div style="color:#ffa28b;font-size:13px;margin:4px 0;">• ${w}</div>`).join('')}
        <div style="color:#8b949e;font-size:12px;margin-top:8px;">💡 Đây chỉ là cảnh báo, code vẫn được lưu</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(warningDiv);
  
  setTimeout(() => {
    warningDiv.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => warningDiv.remove(), 300);
  }, 8000);
}

function showEditor() {
  state.view = 'editor';
  state.rawMode = false;
  state.currentId = null;
  state.content = '';
  state.language = 'auto';
  state.nameInput = '';
  state.securityWarnings = [];
  
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="header-left">
          <div class="logo" onclick="navigate('/')">
            <i class="fas fa-bolt"></i>
            MiniSeres<span>.Raw</span>
          </div>
          <nav class="header-nav">
            <button class="active" onclick="navigate('/')"><i class="fas fa-edit"></i> Editor</button>
            <button onclick="navigate('/history')"><i class="fas fa-history"></i> History</button>
            <button onclick="navigate('/stats')"><i class="fas fa-chart-bar"></i> Stats</button>
          </nav>
        </div>
        <div class="header-actions">
          <button class="btn" onclick="navigate('/')"><i class="fas fa-plus"></i> <span>New</span></button>
          <button class="btn" onclick="navigate('/history')"><i class="fas fa-clock"></i> <span>History</span></button>
          <button class="btn" onclick="exportAllPastes()"><i class="fas fa-download"></i> <span>Export</span></button>
          <button class="btn" onclick="importPastes()"><i class="fas fa-upload"></i> <span>Import</span></button>
        </div>
      </header>
      <div class="editor-container">
        <div class="toolbar">
          <select id="langSelect">
            <option value="auto">🔍 Auto-detect</option>
            <option value="python">🐍 Python</option>
            <option value="lua">📜 Lua</option>
            <option value="cpp">⚙️ C++</option>
            <option value="ruby">💎 Ruby</option>
            <option value="typescript">📘 TypeScript</option>
            <option value="javascript">🟨 JavaScript</option>
            <option value="html">🌐 HTML</option>
            <option value="css">🎨 CSS</option>
            <option value="json">📦 JSON</option>
            <option value="sql">🗄️ SQL</option>
            <option value="bash">💻 Bash</option>
            <option value="go">🐹 Go</option>
            <option value="rust">🦀 Rust</option>
            <option value="php">🐘 PHP</option>
          </select>
          <input type="text" id="nameInput" placeholder="📝 Tên paste..." value="untitled">
          <button class="btn" onclick="loadFromFile()"><i class="fas fa-folder-open"></i> <span>File</span></button>
          <button class="btn btn-success" onclick="createPaste()"><i class="fas fa-cloud-upload-alt"></i> <span>Paste</span></button>
          <button class="btn" onclick="toggleWordWrap()"><i class="fas ${state.wordWrap ? 'fa-wrap' : 'fa-arrows-alt'}"></i></button>
          <button class="btn" onclick="formatCode()"><i class="fas fa-magic"></i></button>
          <button class="btn" onclick="copyContent()"><i class="fas fa-copy"></i></button>
          <button class="btn" onclick="downloadContent()"><i class="fas fa-download"></i></button>
          <button class="btn" onclick="scanCode()" style="background:#1a0e0e;border-color:#f85149;color:#f85149;">
            <i class="fas fa-shield-alt"></i> <span>Scan</span>
          </button>
          <button class="btn" onclick="minifyCode()"><i class="fas fa-compress-alt"></i></button>
          <button class="btn" onclick="sharePaste()"><i class="fas fa-share-alt"></i></button>
        </div>
        <div class="editor-wrapper">
          <div class="line-numbers" id="lineNumbers">1</div>
          <div class="code-area">
            <textarea id="codeEditor" spellcheck="false" placeholder="// Viết code của bạn ở đây..."></textarea>
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
    showToast('✅ Không phát hiện vấn đề bảo mật!');
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

function createPaste() {
  const editor = document.getElementById('codeEditor');
  const nameInput = document.getElementById('nameInput');
  const langSelect = document.getElementById('langSelect');
  
  const content = editor ? editor.value : state.content;
  const name = nameInput ? nameInput.value.trim() || 'untitled' : 'untitled';
  const language = langSelect ? langSelect.value : state.language;
  
  if (!content.trim()) {
    showToast('⚠️ Vui lòng nhập nội dung!');
    return;
  }
  
  const warnings = scanForSecurityIssues(content, language);
  if (warnings.length > 0) {
    const confirmSave = confirm(
      `⚠️ Phát hiện ${warnings.length} vấn đề bảo mật:\n\n${warnings.join('\n')}\n\nVẫn muốn lưu paste?`
    );
    if (!confirmSave) return;
  }
  
  const id = generateId();
  const paste = {
    id: id,
    name: name,
    content: content,
    language: language,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    views: 0,
    rawViews: 0,
    securityWarnings: warnings
  };
  
  state.pastes.push(paste);
  saveState();
  state.currentId = id;
  
  const url = `/view/${id}/${encodeURIComponent(name)}`;
  window.history.pushState({}, '', url);
  navigate(url);
}

function showView(id, name) {
  state.view = 'view';
  state.rawMode = false;
  
  const paste = state.pastes.find(p => p.id === id);
  if (!paste) {
    navigate('/');
    return;
  }
  
  paste.views = (paste.views || 0) + 1;
  saveState();
  
  const displayName = name || paste.name;
  const rawUrl = `/raw/${id}/${encodeURIComponent(paste.name)}`;
  const warnings = paste.securityWarnings || [];
  
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="header-left">
          <div class="logo" onclick="navigate('/')">
            <i class="fas fa-bolt"></i>
            MiniSeres<span>.Raw</span>
          </div>
          <nav class="header-nav">
            <button onclick="navigate('/')"><i class="fas fa-edit"></i> Editor</button>
            <button onclick="navigate('/history')"><i class="fas fa-history"></i> History</button>
            <button onclick="navigate('/stats')"><i class="fas fa-chart-bar"></i> Stats</button>
          </nav>
        </div>
        <div class="header-actions">
          <button class="btn" onclick="navigate('/')"><i class="fas fa-plus"></i> <span>New</span></button>
          <button class="btn" onclick="navigate('/history')"><i class="fas fa-clock"></i> <span>History</span></button>
        </div>
      </header>
      <div class="view-container">
        <div class="view-header">
          <div class="info">
            <span class="badge"><i class="fas fa-code"></i> ${paste.language}</span>
            <span class="badge"><i class="fas fa-eye"></i> ${paste.views}</span>
            <span class="badge"><i class="fas fa-calendar"></i> ${new Date(paste.createdAt).toLocaleDateString()}</span>
            <span class="badge"><i class="fas fa-tag"></i> ${displayName}</span>
            ${warnings.length > 0 ? `<span class="badge" style="border-color:#f85149;color:#f85149;"><i class="fas fa-exclamation-triangle"></i> ${warnings.length} warnings</span>` : ''}
          </div>
          <div class="actions">
            <button class="btn" onclick="copyViewContent()"><i class="fas fa-copy"></i></button>
            <button class="btn" onclick="downloadViewContent()"><i class="fas fa-download"></i></button>
            <button class="btn btn-primary" onclick="window.open('${rawUrl}', '_blank')"><i class="fas fa-link"></i> RAW</button>
            <button class="btn" onclick="copyRawLink('${rawUrl}')"><i class="fas fa-copy"></i> Link</button>
            <button class="btn" onclick="editPaste('${paste.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger" onclick="deletePaste('${paste.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        ${warnings.length > 0 ? `
          <div style="background:#1a0e0e;border:1px solid #f85149;border-radius:8px;padding:12px 16px;flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:8px;color:#f85149;font-weight:600;font-size:13px;">
              <i class="fas fa-shield-alt"></i>
              Cảnh báo bảo mật: ${warnings.length} vấn đề
            </div>
            ${warnings.map(w => `<div style="color:#ffa28b;font-size:12px;margin:4px 0 0 24px;">• ${w}</div>`).join('')}
          </div>
        ` : ''}
        <div class="view-content">
          <pre><code class="${paste.language}">${escapeHtml(paste.content)}</code></pre>
        </div>
      </div>
      <div class="status-bar">
        <span><i class="fas fa-link"></i> ${window.location.origin}${rawUrl}</span>
        <span><i class="fas fa-circle" style="color:var(--accent-green);font-size:8px;"></i> ${paste.views} views</span>
        <span>${paste.content.length} chars</span>
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

function showRaw(id, name) {
  const paste = state.pastes.find(p => p.id === id);
  if (!paste) {
    document.body.innerHTML = '<div style="padding:20px;font-family:monospace;">404 - Paste not found</div>';
    return;
  }
  
  paste.rawViews = (paste.rawViews || 0) + 1;
  saveState();
  
  document.body.innerHTML = `
    <div class="raw-container">
      <div class="raw-content">${escapeHtml(paste.content)}</div>
    </div>
  `;
  
  document.body.style.margin = '0';
  document.body.style.background = '#ffffff';
}

function showHistory() {
  state.view = 'history';
  state.rawMode = false;
  
  app.innerHTML = `
    <div class="app">
      <header class="header">
        <div class="header-left">
          <div class="logo" onclick="navigate('/')">
            <i class="fas fa-bolt"></i>
            MiniSeres<span>.Raw</span>
          </div>
          <nav class="header-nav">
            <button onclick="navigate('/')"><i class="fas fa-edit"></i> Editor</button>
            <button class="active" onclick="navigate('/history')"><i class="fas fa-history"></i> History</button>
            <button onclick="navigate('/stats')"><i class="fas fa-chart-bar"></i> Stats</button>
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
          <h2><i class="fas fa-history"></i> Lịch sử Paste</h2>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="text" class="search-box" id="searchBox" placeholder="🔍 Tìm kiếm...">
            <select id="sortSelect" style="background:var(--bg-secondary);border:1px solid var(--border-color);color:var(--text-secondary);padding:6px 12px;border-radius:6px;font-size:13px;outline:none;cursor:pointer;">
              <option value="newest">🕐 Mới nhất</option>
              <option value="oldest">🕐 Cũ nhất</option>
              <option value="views">👁 Nhiều view</option>
              <option value="name">📝 Tên A-Z</option>
            </select>
          </div>
        </div>
        <div class="history-list" id="historyList">
          ${state.pastes.length === 0 ? `
            <div class="history-empty">
              <i class="fas fa-inbox"></i>
              <h3>Chưa có paste nào</h3>
              <p>Tạo paste đầu tiên của bạn ngay bây giờ!</p>
              <button class="btn btn-primary" onclick="navigate('/')" style="margin-top:16px;"><i class="fas fa-plus"></i> Tạo paste</button>
            </div>
          ` : ''}
          ${getFilteredAndSortedPastes().map(p => {
            const warnings = p.securityWarnings || [];
            return `
            <div class="history-item">
              <div class="info">
                <div class="name">
                  <i class="fas fa-file-code"></i>
                  ${p.name}
                  <span style="font-size:11px;color:var(--text-muted);font-weight:400;">${p.language}</span>
                  ${warnings.length > 0 ? `<span style="font-size:11px;color:#f85149;"><i class="fas fa-exclamation-triangle"></i> ${warnings.length}</span>` : ''}
                  ${p.content.length > 500 ? `<span style="font-size:11px;color:var(--accent-orange);">📄 ${Math.round(p.content.length/1024)}KB</span>` : ''}
                </div>
                <div class="meta">
                  <span><i class="far fa-calendar-alt"></i> ${new Date(p.createdAt).toLocaleString()}</span>
                  <span><i class="fas fa-eye"></i> ${p.views || 0}</span>
                  <span><i class="fas fa-link"></i> ${p.rawViews || 0}</span>
                  <span><i class="fas fa-code"></i> ${p.content.length} chars</span>
                  <span><i class="fas fa-clock"></i> ${timeAgo(p.createdAt)}</span>
                </div>
              </div>
              <div class="actions">
                <button class="btn" onclick="navigate('/view/${p.id}/${encodeURIComponent(p.name)}')"><i class="fas fa-eye"></i></button>
                <button class="btn" onclick="navigate('/raw/${p.id}/${encodeURIComponent(p.name)}')"><i class="fas fa-link"></i></button>
                <button class="btn" onclick="copyPasteLink('${p.id}')"><i class="fas fa-copy"></i></button>
                <button class="btn btn-danger" onclick="deletePaste('${p.id}')"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `}).join('')}
        </div>
      </div>
    </div>
  `;
  
  const searchBox = document.getElementById('searchBox');
  const sortSelect = document.getElementById('sortSelect');
  
  if (searchBox) {
    searchBox.value = state.searchQuery || '';
    searchBox.addEventListener('input', function() {
      state.searchQuery = this.value;
      showHistory();
    });
  }
  
  if (sortSelect) {
    sortSelect.value = state.sortBy || 'newest';
    sortSelect.addEventListener('change', function() {
      state.sortBy = this.value;
      showHistory();
    });
  }
}

function getFilteredAndSortedPastes() {
  let filtered = state.pastes;
  
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.content.toLowerCase().includes(query) ||
      p.language.toLowerCase().includes(query)
    );
  }
  
  switch(state.sortBy) {
    case 'newest':
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'oldest':
      filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      break;
    case 'views':
      filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
      break;
    case 'name':
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  
  return filtered;
}

function showStats() {
  state.view = 'stats';
  state.rawMode = false;
  
  const total = state.pastes.length;
  const totalViews = state.pastes.reduce((sum, p) => sum + (p.views || 0), 0);
  const totalRawViews = state.pastes.reduce((sum, p) => sum + (p.rawViews || 0), 0);
  const totalChars = state.pastes.reduce((sum, p) => sum + p.content.length, 0);
  const languages = {};
  state.pastes.forEach(p => {
    languages[p.language] = (languages[p.language] || 0) + 1;
  });
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
            <button onclick="navigate('/')"><i class="fas fa-edit"></i> Editor</button>
            <button onclick="navigate('/history')"><i class="fas fa-history"></i> History</button>
            <button class="active" onclick="navigate('/stats')"><i class="fas fa-chart-bar"></i> Stats</button>
          </nav>
        </div>
        <div class="header-actions">
          <button class="btn" onclick="navigate('/')"><i class="fas fa-plus"></i> <span>New</span></button>
          <button class="btn" onclick="navigate('/history')"><i class="fas fa-clock"></i> <span>History</span></button>
        </div>
      </header>
      <div class="history-container">
        <h2 style="font-size:18px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
          <i class="fas fa-chart-bar"></i> Thống kê
        </h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="number">${total}</div>
            <div class="label">📄 Tổng paste</div>
          </div>
          <div class="stat-card">
            <div class="number">${totalViews}</div>
            <div class="label">👁 Tổng view</div>
          </div>
          <div class="stat-card">
            <div class="number">${totalRawViews}</div>
            <div class="label">🔗 Tổng raw view</div>
          </div>
          <div class="stat-card">
            <div class="number">${formatSize(totalChars)}</div>
            <div class="label">📦 Tổng dữ liệu</div>
          </div>
          <div class="stat-card">
            <div class="number">${mostUsedLang ? mostUsedLang[0] : 'N/A'}</div>
            <div class="label">🏆 Ngôn ngữ phổ biến</div>
          </div>
          <div class="stat-card">
            <div class="number">${state.pastes.length > 0 ? Math.round(totalChars / state.pastes.length) : 0}</div>
            <div class="label">📝 Trung bình/paste</div>
          </div>
        </div>
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:16px;">
          <h3 style="font-size:14px;color:var(--text-secondary);margin-bottom:12px;">📊 Ngôn ngữ sử dụng</h3>
          ${Object.entries(languages).map(([lang, count]) => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);font-size:13px;">
              <span>${lang}</span>
              <span style="color:var(--text-secondary);">${count} paste${count > 1 ? 's' : ''}</span>
            </div>
          `).join('')}
          ${Object.keys(languages).length === 0 ? '<div style="color:var(--text-muted);font-size:13px;">Chưa có dữ liệu</div>' : ''}
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

function deletePaste(id) {
  if (!confirm('Xóa paste này?')) return;
  state.pastes = state.pastes.filter(p => p.id !== id);
  saveState();
  if (state.currentId === id) {
    state.currentId = null;
  }
  navigate(window.location.pathname || '/');
}

function clearAllPastes() {
  if (!confirm('Xóa TẤT CẢ paste? Không thể hoàn tác!')) return;
  state.pastes = [];
  saveState();
  showHistory();
  showToast('🗑 Đã xóa tất cả!');
}

function editPaste(id) {
  const paste = state.pastes.find(p => p.id === id);
  if (!paste) return;
  state.content = paste.content;
  state.language = paste.language;
  state.nameInput = paste.name;
  navigate('/');
  setTimeout(() => {
    const editor = document.getElementById('codeEditor');
    if (editor) {
      editor.value = paste.content;
      updateHighlight(paste.content, paste.language);
      updateLineNumbers(paste.content);
      updateStats(paste.content);
    }
    const langSelect = document.getElementById('langSelect');
    if (langSelect) langSelect.value = paste.language;
    const nameInput = document.getElementById('nameInput');
    if (nameInput) nameInput.value = paste.name;
  }, 100);
}

function copyPasteLink(id) {
  const url = window.location.origin + `/view/${id}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('🔗 Đã copy link!');
  }).catch(() => {});
}

function exportAllPastes() {
  const data = JSON.stringify(state.pastes, null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'miniseres_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📦 Đã export!');
}

function importPastes() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Invalid data');
        const count = data.length;
        state.pastes = state.pastes.concat(data);
        saveState();
        showToast(`✅ Đã import ${count} paste!`);
        navigate('/history');
      } catch(e) {
        showToast('❌ Lỗi import! File không hợp lệ');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function minifyCode() {
  const editor = document.getElementById('codeEditor');
  if (!editor) return;
  
  let content = editor.value;
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  content = content.replace(/\/\/.*$/gm, '');
  content = content.replace(/\s+/g, ' ');
  content = content.replace(/;\s*/g, ';');
  content = content.replace(/{\s*/g, '{');
  content = content.replace(/\s*}/g, '}');
  content = content.replace(/\(\s*/g, '(');
  content = content.replace(/\s*\)/g, ')');
  content = content.trim();
  
  editor.value = content;
  state.content = content;
  updateHighlight(content, document.getElementById('langSelect').value);
  updateLineNumbers(content);
  updateStats(content);
  showToast('📦 Đã minify!');
}

function sharePaste() {
  const editor = document.getElementById('codeEditor');
  const nameInput = document.getElementById('nameInput');
  if (!editor || !editor.value.trim()) {
    showToast('⚠️ Không có nội dung để share');
    return;
  }
  
  const content = editor.value;
  const name = nameInput ? nameInput.value || 'untitled' : 'untitled';
  const language = document.getElementById('langSelect').value;
  
  if (navigator.share) {
    navigator.share({
      title: name,
      text: content.slice(0, 1000) + (content.length > 1000 ? '...' : ''),
      url: window.location.href
    }).catch(() => {});
  } else {
    const id = generateId();
    const paste = {
      id: id,
      name: name,
      content: content,
      language: language,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0,
      rawViews: 0,
      securityWarnings: []
    };
    state.pastes.push(paste);
    saveState();
    const url = window.location.origin + `/view/${id}/${encodeURIComponent(name)}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('🔗 Đã tạo và copy link share!');
    }).catch(() => {
      showToast('🔗 Link: ' + url);
    });
  }
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
      showToast('📋 Đã copy nội dung!');
    }).catch(() => {
      editor.select();
      document.execCommand('copy');
      showToast('📋 Đã copy nội dung!');
    });
  }
}

function copyViewContent() {
  const content = document.querySelector('.view-content');
  if (content) {
    navigator.clipboard.writeText(content.textContent).then(() => {
      showToast('📋 Đã copy nội dung!');
    }).catch(() => {});
  }
}

function copyRawLink(rawUrl) {
  const fullUrl = window.location.origin + rawUrl;
  navigator.clipboard.writeText(fullUrl).then(() => {
    showToast('🔗 Đã copy link RAW!');
  }).catch(() => {
    showToast('🔗 Link RAW: ' + fullUrl);
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
  showToast(state.wordWrap ? '📏 Word wrap: ON' : '📏 Word wrap: OFF');
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
      showToast('❌ Lỗi format JSON!');
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
  showToast('✨ Đã format!');
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
