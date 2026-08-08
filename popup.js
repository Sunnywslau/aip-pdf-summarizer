function parseMarkdown(md) {
  if (!md) return '';
  
  let lines = md.split('\n');
  let inList = false;
  let htmlResult = [];

  for (let line of lines) {
    let trimmed = line.trim();

    // Check for Headers
    if (trimmed.startsWith('### ')) {
      if (inList) { htmlResult.push('</ul>'); inList = false; }
      htmlResult.push(`<h3>${trimmed.slice(4)}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      if (inList) { htmlResult.push('</ul>'); inList = false; }
      htmlResult.push(`<h2>${trimmed.slice(3)}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      if (inList) { htmlResult.push('</ul>'); inList = false; }
      htmlResult.push(`<h1>${trimmed.slice(2)}</h1>`);
    }
    // Check for Bullet points
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) { htmlResult.push('<ul>'); inList = true; }
      let content = trimmed.slice(2);
      // Process formatting inside list item
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                       .replace(/`(.*?)`/g, '<code>$1</code>');
      htmlResult.push(`<li>${content}</li>`);
    }
    // Empty line
    else if (trimmed === '') {
      if (inList) { htmlResult.push('</ul>'); inList = false; }
    }
    // Standard paragraph line
    else {
      if (inList) { htmlResult.push('</ul>'); inList = false; }
      let content = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                           .replace(/`(.*?)`/g, '<code>$1</code>');
      htmlResult.push(`<p>${content}</p>`);
    }
  }

  if (inList) {
    htmlResult.push('</ul>');
  }

  return htmlResult.join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  const optionsLink = document.getElementById('optionsLink');
  const urlDisplay = document.getElementById('urlDisplay');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const statusContainer = document.getElementById('statusContainer');
  const statusText = document.getElementById('statusText');
  const errorContainer = document.getElementById('errorContainer');
  const resultContainer = document.getElementById('resultContainer');

  let currentTabUrl = '';
  let config = {};
  let tabLoaded = false;
  let configLoaded = false;
  let aiMode = 'auto'; // 'auto' | 'deepseek' | 'gemini'

  // --- AI Selector ---
  const aiAutoBtn    = document.getElementById('aiAutoBtn');
  const aiDeepSeekBtn = document.getElementById('aiDeepSeekBtn');
  const aiGeminiBtn  = document.getElementById('aiGeminiBtn');
  const aiBadge      = document.getElementById('aiBadge');

  function updateAiBadge() {
    const hasDeepSeek = !!config.deepseekApiKey;
    const hasGemini   = !!(config.geminiApiKey || config.apiKey);

    // Determine effective provider
    let effective = null;
    if (aiMode === 'deepseek') effective = hasDeepSeek ? 'deepseek' : null;
    else if (aiMode === 'gemini') effective = hasGemini ? 'gemini' : null;
    else effective = hasDeepSeek ? 'deepseek' : (hasGemini ? 'gemini' : null); // auto

    // Update badge
    aiBadge.className = 'ai-badge';
    if (effective === 'deepseek') {
      aiBadge.textContent = 'DeepSeek';
      aiBadge.classList.add('badge-deepseek');
    } else if (effective === 'gemini') {
      aiBadge.textContent = 'Gemini';
      aiBadge.classList.add('badge-gemini');
    } else {
      aiBadge.textContent = 'No key';
      aiBadge.classList.add('badge-none');
    }

    // Update button active states
    aiAutoBtn.className    = 'ai-toggle-btn' + (aiMode === 'auto' ? (effective === 'deepseek' ? ' active-deepseek' : ' active-gemini') : '');
    aiDeepSeekBtn.className = 'ai-toggle-btn' + (aiMode === 'deepseek' ? ' active-deepseek' : '');
    aiGeminiBtn.className  = 'ai-toggle-btn' + (aiMode === 'gemini' ? ' active-gemini' : '');
  }

  function setAiMode(mode) {
    aiMode = mode;
    updateAiBadge();
  }

  aiAutoBtn.addEventListener('click',     () => setAiMode('auto'));
  aiDeepSeekBtn.addEventListener('click', () => setAiMode('deepseek'));
  aiGeminiBtn.addEventListener('click',   () => setAiMode('gemini'));

  function buildApiHeaders() {
    const hasDeepSeek = !!config.deepseekApiKey;
    const geminiKey   = config.geminiApiKey || config.apiKey;
    const headers     = {};

    if (aiMode === 'deepseek') {
      if (config.deepseekApiKey) headers['X-DeepSeek-API-Key'] = config.deepseekApiKey;
    } else if (aiMode === 'gemini') {
      if (geminiKey) headers['X-Gemini-API-Key'] = geminiKey;
    } else {
      // auto: send both, backend picks DeepSeek first
      if (config.deepseekApiKey) headers['X-DeepSeek-API-Key'] = config.deepseekApiKey;
      if (geminiKey) headers['X-Gemini-API-Key'] = geminiKey;
    }
    return headers;
  }

  function getActiveKey() {
    if (config.provider === 'gemini') {
      return config.geminiApiKey || config.apiKey;
    } else {
      return config.deepseekApiKey || config.apiKey;
    }
  }

  function updateButtonState() {
    if (tabLoaded && configLoaded) {
      const hasDeepSeek = !!config.deepseekApiKey;
      const hasGemini   = !!(config.geminiApiKey || config.apiKey);
      if (hasDeepSeek || hasGemini) {
        summarizeBtn.disabled = false;
        clearError();
      } else {
        showError('Please set your API Key in the Settings page first.');
        summarizeBtn.disabled = true;
      }
      updateAiBadge();
    }
  }

  // Load config
  chrome.storage.sync.get({
    provider: 'gemini',
    apiKey: '', // legacy
    deepseekApiKey: '',
    geminiApiKey: '',
    model: 'gemini-3.5-flash',
    customModel: '',
    backendUrl: '',
    systemPrompt: ''
  }, (items) => {
    config = items;
    configLoaded = true;
    updateButtonState();
  });

  // Open settings
  optionsLink.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Open batch processor
  document.getElementById('batchBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'batch.html' });
  });

  // Get active tab details
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTabUrl = tab.url;
    urlDisplay.textContent = currentTabUrl;
    
    // Check if the URL seems like a PDF
    const isPdf = currentTabUrl.toLowerCase().endsWith('.pdf') || 
                  currentTabUrl.toLowerCase().includes('/pdf') ||
                  tab.title.toLowerCase().endsWith('.pdf');
                  
    if (!isPdf) {
      urlDisplay.textContent = `${currentTabUrl} (Not detected as PDF)`;
      urlDisplay.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    }
    
    tabLoaded = true;
    updateButtonState();
  }

  // Handle summarize click
  summarizeBtn.addEventListener('click', async () => {
    showStatus('Fetching document data...');
    clearError();
    resultContainer.style.display = 'none';
    summarizeBtn.disabled = true;

    try {
      // 1. Fetch the PDF binary
      const response = await fetch(currentTabUrl);
      if (!response.ok) {
        throw new Error(`Failed to load document (HTTP ${response.status})`);
      }
      
      const arrayBuffer = await response.arrayBuffer();

      // Check if it is an AIP Amendment (checks URL and Title)
      const lowerUrl = currentTabUrl.toLowerCase();
      const lowerTitle = tab ? tab.title.toLowerCase() : '';
      const isAmendment = lowerUrl.includes('amdt') || lowerUrl.includes('amendment') || 
                          lowerTitle.includes('amdt') || lowerTitle.includes('amendment');
      
      let summary = '';
      let modelUsed = '';
      
      if (isAmendment) {
        showStatus('Uploading and analyzing with backend...');
        const backendUrl = config.backendUrl || 'http://localhost:8000';

        const formData = new FormData();
        formData.append("file", new Blob([arrayBuffer]), "document.pdf");

        const headers = buildApiHeaders();
        // Content-Type must NOT be set for FormData (browser sets boundary automatically)

        const res = await fetch(`${backendUrl}/analyze`, {
          method: 'POST',
          headers: headers,
          body: formData
        });
        
        if (!res.ok) {
          const errorJson = await res.json().catch(() => ({}));
          const errorMsg = errorJson.detail || `HTTP ${res.status}`;
          throw new Error(`Backend Error: ${errorMsg}`);
        }
        
        const data = await res.json();
        summary = data.analysis;
        modelUsed = data.model_used;
      } else {
        // SUP/AIC: extract text locally, then send to backend for AI processing
        // This routes all AI calls through Hugging Face server, bypassing
        // HK Gemini restrictions and corporate DeepSeek firewall rules.
        showStatus('Parsing PDF text content...');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 30);

        for (let i = 1; i <= maxPages; i++) {
          showStatus(`Parsing PDF text content (Page ${i} of ${pdf.numPages})...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }

        if (!fullText.trim()) {
          throw new Error('Could not extract any readable text from the PDF. The document might be image-only / scanned without OCR.');
        }

        showStatus('Sending to backend for AI analysis...');
        const backendUrl = config.backendUrl || 'http://localhost:8000';
        const modelName = config.model === 'custom' ? config.customModel : config.model;

        const supHeaders = { 'Content-Type': 'application/json', ...buildApiHeaders() };

        const supRes = await fetch(`${backendUrl}/analyze-sup`, {
          method: 'POST',
          headers: supHeaders,
          body: JSON.stringify({
            text: fullText,
            system_prompt: config.systemPrompt || null,
            model: modelName || null
          })
        });

        if (!supRes.ok) {
          const errorJson = await supRes.json().catch(() => ({}));
          const errorMsg = errorJson.detail || `HTTP ${supRes.status}`;
          throw new Error(`Backend Error: ${errorMsg}`);
        }

        const supData = await supRes.json();
        summary = supData.summary;
        modelUsed = supData.model_used;
      }

      // 3. Show Result
      hideStatus();
      let metaHeader = '';
      if (modelUsed) {
        metaHeader = `<div style="font-size: 11px; color: var(--text-muted); background: rgba(255, 255, 255, 0.05); padding: 4px 8px; border-radius: 6px; margin-bottom: 12px; display: inline-block; border: 1px solid var(--border-color); font-weight: 500;">AI Engine: <strong style="color: #60a5fa;">${modelUsed}</strong></div>`;
      }
      resultContainer.innerHTML = metaHeader + parseMarkdown(summary);
      resultContainer.style.display = 'block';
    } catch (err) {
      hideStatus();
      showError(err.message || 'An unexpected error occurred.');
    } finally {
      summarizeBtn.disabled = false;
    }
  });


  function showStatus(text) {
    statusContainer.style.display = 'flex';
    statusText.textContent = text;
  }

  function hideStatus() {
    statusContainer.style.display = 'none';
  }

  function showError(text) {
    errorContainer.textContent = text;
    errorContainer.style.display = 'block';
  }

  function clearError() {
    errorContainer.textContent = '';
    errorContainer.style.display = 'none';
  }
});
