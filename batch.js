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

document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('emailInput');
  const processBtn = document.getElementById('processBtn');
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');
  const emptyState = document.getElementById('emptyState');
  const summariesContainer = document.getElementById('summariesContainer');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  let config = {};
  let queue = [];
  let summariesResults = []; // Stores { url, summaryText }
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
    chrome.storage.local.set({ aiMode: mode });
    updateAiBadge();
  }

  aiAutoBtn.addEventListener('click',     () => setAiMode('auto'));
  aiDeepSeekBtn.addEventListener('click', () => setAiMode('deepseek'));
  aiGeminiBtn.addEventListener('click',   () => setAiMode('gemini'));

  function buildApiHeaders() {
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
    const hasDeepSeek = !!config.deepseekApiKey;
    const hasGemini   = !!(config.geminiApiKey || config.apiKey);
    return hasDeepSeek || hasGemini;
  }

  // Load config
  function loadConfig() {
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
      
      // Load last selected AI mode from local storage
      chrome.storage.local.get({ aiMode: 'auto' }, (localItems) => {
        aiMode = localItems.aiMode;
        updateAiBadge();
      });
    });
  }
  loadConfig();

  // Check if there are links imported from a portal page
  function checkImportQueue() {
    chrome.storage.local.get(['importQueue'], (result) => {
      if (result.importQueue && result.importQueue.length > 0) {
        // Pre-populate input area
        const formattedText = result.importQueue.map(item => {
          if (item.text) {
            return `<a href="${item.url}">${item.text}</a>`;
          }
          return item.url;
        }).join('\n');
        
        emailInput.innerHTML = formattedText;
        
        // Clean storage item immediately
        chrome.storage.local.remove('importQueue');
      }
    });
  }
  
  // Delay check slightly to ensure config is loaded and buttons are fully wired
  setTimeout(checkImportQueue, 300);

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  processBtn.addEventListener('click', async () => {
    loadConfig(); // Reload config in case it changed
    if (!getActiveKey()) {
      alert('Please configure your API Key first.');
      return;
    }

    const text = emailInput.innerText.trim();
    if (!text) {
      alert('Please paste some text containing PDF URLs first.');
      return;
    }

    // Extract raw text URLs (handling potential spaces in filenames like "SUP 65/26.pdf" and trailing query parameters)
    const matches = [];
    const lines = text.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      const match = trimmed.match(/(https?:\/\/[^\r\n\t"']+)/i);
      if (match) {
        let potentialUrl = match[1];
        const lowerLine = trimmed.toLowerCase();
        const pdfIndex = lowerLine.indexOf('.pdf');
        
        if (pdfIndex !== -1) {
          const httpIndex = lowerLine.indexOf('http');
          // Find the first space after the .pdf extension to capture any trailing query parameters (e.g. ?token=123)
          const afterPdf = trimmed.substring(pdfIndex + 4);
          const spaceIndex = afterPdf.indexOf(' ');
          if (spaceIndex !== -1) {
            potentialUrl = trimmed.substring(httpIndex, pdfIndex + 4 + spaceIndex);
          } else {
            potentialUrl = trimmed.substring(httpIndex);
          }
        } else {
          // If no .pdf, cut off at the first space as standard URL behavior
          const spaceIndex = potentialUrl.indexOf(' ');
          if (spaceIndex !== -1) {
            potentialUrl = potentialUrl.substring(0, spaceIndex);
          }
        }
        matches.push(potentialUrl.trim());
      }
    });

    // Extract rich-text hyperlinks from pasted HTML
    const anchors = Array.from(emailInput.querySelectorAll('a')).map(a => ({
      url: a.href ? a.href.replace(/\\/g, '/') : '',
      text: a.textContent.trim()
    }));

    const rawMatches = matches.map(url => ({
      url: url.replace(/\\/g, '/'),
      text: ''
    }));

    // Merge and filter to likely PDF or aviation document URLs
    const allLinks = [...anchors, ...rawMatches];
    const pdfLinks = allLinks.filter(link => {
      if (!link.url) return false;
      const lowerUrl = link.url.toLowerCase();
      const lowerText = link.text.toLowerCase();
      
      // 1. Keep if URL indicates it is a PDF
      if (lowerUrl.endsWith('.pdf') || lowerUrl.includes('/pdf/') || lowerUrl.includes('.pdf?') || lowerUrl.includes('/pdfurl/')) {
        return true;
      }
      
      // 2. Keep if the link display text indicates it is an AIP/SUP/AIC document
      const keywords = ['sup', 'aic', 'amdt', 'amendment', 'pdf', 'aip'];
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return true;
      }
      
      return false;
    });

    // Group by URL to combine display names for identical URLs
    const urlGroups = {};
    pdfLinks.forEach(link => {
      const url = link.url;
      if (!urlGroups[url]) {
        urlGroups[url] = {
          url: url,
          names: new Set()
        };
      }
      if (link.text) {
        urlGroups[url].names.add(link.text);
      }
    });

    const uniquePdfLinks = Object.values(urlGroups).map(group => {
      const namesArray = Array.from(group.names);
      let combinedName = '';
      if (namesArray.length > 0) {
        if (namesArray.length > 3) {
          combinedName = namesArray.slice(0, 3).join(', ') + ` (+${namesArray.length - 3} more)`;
        } else {
          combinedName = namesArray.join(', ');
        }
      }
      return {
        url: group.url,
        name: combinedName || getFileName(group.url),
        linkText: namesArray.join(', ')
      };
    });

    if (uniquePdfLinks.length === 0) {
      alert('No PDF URLs detected. Make sure the pasted text contains PDF links or hyperlinks.');
      return;
    }

    // Initialize queue UI
    queueList.innerHTML = '';
    summariesContainer.innerHTML = '';
    summariesResults = [];
    exportAllBtn.disabled = true;
    
    queue = uniquePdfLinks.map((link, index) => {
      return {
        id: index,
        url: link.url,
        name: link.name,
        linkText: link.linkText,
        status: 'pending', // pending, active, completed, failed
        error: '',
        summary: '',
        modelUsed: ''
      };
    });

    queueCount.textContent = `${queue.length} items`;
    emptyState.style.display = 'none';
    summariesContainer.style.display = 'block';

    // Render queue items
    queue.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'queue-item';
      itemEl.id = `queue-item-${item.id}`;
      itemEl.innerHTML = `
        <div class="queue-item-header">
          <span class="queue-item-url" title="${item.url}">${item.name}</span>
          <span class="status-badge status-pending" id="badge-${item.id}">Pending</span>
        </div>
        <div class="queue-item-meta" id="meta-${item.id}" style="font-size: 10px; color: var(--text-muted); display: none; margin-top: 4px;"></div>
      `;
      queueList.appendChild(itemEl);
    });

    // Disable inputs
    processBtn.disabled = true;
    emailInput.contentEditable = 'false';
    emailInput.style.opacity = '0.6';

    // Process one by one
    for (let item of queue) {
      updateQueueItemStatus(item.id, 'active', 'Processing...');
      try {
        // 1. Fetch PDF
        updateQueueItemStatus(item.id, 'active', 'Downloading...');
        const response = await fetch(item.url);
        if (!response.ok) {
          throw new Error(`Download failed (HTTP ${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // Determine if it is an AIP Amendment based on URL and Link Text
        const linkTextLower = item.linkText.toLowerCase();
        const lowerUrl = item.url.toLowerCase();
        
        const isAmendment = lowerUrl.includes('amdt') || lowerUrl.includes('amendment') || 
                            linkTextLower.includes('amdt') || linkTextLower.includes('amendment');
        
        let summary = '';
        let modelUsed = '';
        
        if (isAmendment) {
          updateQueueItemStatus(item.id, 'active', 'Uploading to backend...');
          const backendUrl = config.backendUrl || 'http://localhost:8000';
          
          const formData = new FormData();
          formData.append("file", new Blob([arrayBuffer]), "document.pdf");
          
          const headers = buildApiHeaders();

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
          // 2. Parse PDF (local JS for SUP/AIC)
          updateQueueItemStatus(item.id, 'active', 'Parsing PDF...');
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          
          let fullText = '';
          const maxPages = Math.min(pdf.numPages, 30);
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(t => t.str).join(' ');
            fullText += pageText + '\n';
          }

          if (!fullText.trim()) {
            throw new Error('No readable text in PDF (image-only or scanned).');
          }

          // 3. Summarize via backend (bypasses HK Gemini block and corporate DeepSeek firewall)
          updateQueueItemStatus(item.id, 'active', 'Sending to backend AI...');
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
        
        item.summary = summary;
        item.modelUsed = modelUsed;
        summariesResults.push({ url: item.url, name: item.name, summaryText: summary });
        updateQueueItemStatus(item.id, 'completed', 'Completed', modelUsed);

        // Append to main view
        appendSummaryCard(item.url, item.name, summary, modelUsed);

      } catch (err) {
        console.error(err);
        item.status = 'failed';
        item.error = err.message || 'Error occurred';
        updateQueueItemStatus(item.id, 'failed', 'Failed');
        appendErrorCard(item.url, item.name, item.error);
      }
    }

    // Enable inputs
    processBtn.disabled = false;
    emailInput.contentEditable = 'true';
    emailInput.style.opacity = '1';
    
    if (summariesResults.length > 0) {
      exportAllBtn.disabled = false;
    }
  });

  // Export all as a single Markdown file
  exportAllBtn.addEventListener('click', () => {
    if (summariesResults.length === 0) return;
    
    let mdContent = `# AIP/AIC Batch Summary Report\nGenerated on: ${new Date().toLocaleString()}\n\n---\n\n`;
    
    summariesResults.forEach(res => {
      mdContent += `## Document: ${res.name}\n`;
      mdContent += `**Source URL:** [Link](${res.url})\n\n`;
      mdContent += `${res.summaryText}\n\n`;
      mdContent += `---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AIP_Batch_Summary_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  function getFileName(url) {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const part = pathname.substring(pathname.lastIndexOf('/') + 1);
      return part || url;
    } catch (e) {
      return url;
    }
  }

  function updateQueueItemStatus(id, status, text, modelUsed) {
    const badge = document.getElementById(`badge-${id}`);
    if (badge) {
      badge.className = `status-badge status-${status}`;
      badge.textContent = text;
    }
    if (modelUsed) {
      const meta = document.getElementById(`meta-${id}`);
      if (meta) {
        meta.textContent = `Resolved via: ${modelUsed}`;
        meta.style.display = 'block';
      }
    }
  }

  function appendSummaryCard(url, name, summaryMarkdown, modelUsed) {
    const card = document.createElement('div');
    card.className = 'summary-card';
    
    const htmlSummary = parseMarkdown(summaryMarkdown);

    card.innerHTML = `
      <div class="summary-card-header">
        <div class="summary-card-title">${name}</div>
        <div class="card-actions" style="display: flex; align-items: center; gap: 8px;">
          ${modelUsed ? `<span style="font-size: 11px; color: var(--text-muted); background: var(--border-color); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);">${modelUsed}</span>` : ''}
          <button class="btn-secondary copy-btn" style="padding: 4px 10px; font-size: 11px;">Copy</button>
          <a href="${url}" target="_blank" class="btn-secondary" style="padding: 4px 10px; font-size: 11px; text-decoration: none;">Open PDF</a>
        </div>
      </div>
      <div class="summary-card-body">
        ${htmlSummary}
      </div>
    `;

    // Copy action
    card.querySelector('.copy-btn').addEventListener('click', (e) => {
      navigator.clipboard.writeText(summaryMarkdown).then(() => {
        e.target.textContent = 'Copied!';
        setTimeout(() => {
          e.target.textContent = 'Copy';
        }, 1500);
      });
    });

    summariesContainer.appendChild(card);
  }

  function appendErrorCard(url, name, errorMessage) {
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.style.borderColor = 'var(--error)';
    card.innerHTML = `
      <div class="summary-card-header" style="border-bottom-color: rgba(239, 68, 68, 0.2)">
        <div class="summary-card-title" style="color: #fca5a5">${name}</div>
        <div class="card-actions">
          <a href="${url}" target="_blank" class="btn-secondary" style="padding: 4px 10px; font-size: 11px; text-decoration: none;">Open PDF</a>
        </div>
      </div>
      <div class="summary-card-body" style="color: #fca5a5;">
        <strong>Error Processing Document:</strong> ${errorMessage}
      </div>
    `;
    summariesContainer.appendChild(card);
  }

});
