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

  function getActiveKey() {
    if (config.provider === 'gemini') {
      return config.geminiApiKey || config.apiKey;
    } else if (config.provider === 'github') {
      return config.githubApiKey;
    } else {
      return config.deepseekApiKey || config.apiKey;
    }
  }

  // Load config
  function loadConfig() {
    chrome.storage.sync.get({
      provider: 'deepseek',
      apiKey: '', // legacy
      deepseekApiKey: '',
      githubApiKey: '',
      geminiApiKey: '',
      model: 'deepseek-v4-flash',
      customModel: '',
      backendUrl: '',
      systemPrompt: ''
    }, (items) => {
      config = items;
      if (!getActiveKey()) {
        alert('Please configure your API Key in the Settings page before processing.');
      }
    });
  }
  loadConfig();

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

    // Extract raw text URLs
    const urlRegex = /https?:\/\/[^\s\r\n\t"']+/g;
    const matches = text.match(urlRegex) || [];

    // Extract rich-text hyperlinks from pasted HTML
    const anchorHrefs = Array.from(emailInput.querySelectorAll('a')).map(a => a.href);

    // Merge and deduplicate
    const combinedUrls = [...new Set([...matches, ...anchorHrefs])];

    // Filter to likely PDF URLs (ends with .pdf or contains /pdf/ or pdf in path)
    const pdfUrls = combinedUrls.filter(url => {
      const lower = url.toLowerCase();
      return lower.endsWith('.pdf') || lower.includes('/pdf') || lower.includes('pdf');
    });

    if (pdfUrls.length === 0) {
      alert('No PDF URLs detected. Make sure the pasted text contains PDF links or hyperlinks.');
      return;
    }

    // Initialize queue UI
    queueList.innerHTML = '';
    summariesContainer.innerHTML = '';
    summariesResults = [];
    exportAllBtn.disabled = true;
    
    queue = pdfUrls.map((url, index) => ({
      id: index,
      url: url,
      status: 'pending', // pending, active, completed, failed
      error: '',
      summary: ''
    }));

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
          <span class="queue-item-url" title="${item.url}">${getFileName(item.url)}</span>
          <span class="status-badge status-pending" id="badge-${item.id}">Pending</span>
        </div>
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
        const anchorEl = emailInput.querySelector(`a[href="${item.url}"]`);
        const linkText = anchorEl ? anchorEl.textContent.toLowerCase() : '';
        const lowerUrl = item.url.toLowerCase();
        
        const isAmendment = lowerUrl.includes('amdt') || lowerUrl.includes('amendment') || 
                            linkText.includes('amdt') || linkText.includes('amendment');
        
        let summary = '';
        
        if (isAmendment) {
          updateQueueItemStatus(item.id, 'active', 'Uploading to backend...');
          const backendUrl = config.backendUrl || 'http://localhost:8000';
          
          const formData = new FormData();
          formData.append("file", new Blob([arrayBuffer]), "document.pdf");
          
          const res = await fetch(`${backendUrl}/analyze`, {
            method: 'POST',
            headers: {
              'X-Gemini-API-Key': getActiveKey()
            },
            body: formData
          });
          
          if (!res.ok) {
            const errorJson = await res.json().catch(() => ({}));
            const errorMsg = errorJson.detail || `HTTP ${res.status}`;
            throw new Error(`Backend Error: ${errorMsg}`);
          }
          
          const data = await res.json();
          summary = data.analysis;
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

          // 3. Summarize
          updateQueueItemStatus(item.id, 'active', 'Analyzing AI...');
          summary = await callLLMAPI(fullText, config);
        }
        
        item.summary = summary;
        summariesResults.push({ url: item.url, summaryText: summary });
        updateQueueItemStatus(item.id, 'completed', 'Completed');

        // Append to main view
        appendSummaryCard(item.url, summary);

      } catch (err) {
        console.error(err);
        item.status = 'failed';
        item.error = err.message || 'Error occurred';
        updateQueueItemStatus(item.id, 'failed', 'Failed');
        appendErrorCard(item.url, item.error);
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
      mdContent += `## Document: ${getFileName(res.url)}\n`;
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

  function updateQueueItemStatus(id, status, text) {
    const badge = document.getElementById(`badge-${id}`);
    if (badge) {
      badge.className = `status-badge status-${status}`;
      badge.textContent = text;
    }
  }

  function appendSummaryCard(url, summaryMarkdown) {
    const card = document.createElement('div');
    card.className = 'summary-card';
    
    const htmlSummary = parseMarkdown(summaryMarkdown);

    card.innerHTML = `
      <div class="summary-card-header">
        <div class="summary-card-title">${getFileName(url)}</div>
        <div class="card-actions">
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

  function appendErrorCard(url, errorMessage) {
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.style.borderColor = 'var(--error)';
    card.innerHTML = `
      <div class="summary-card-header" style="border-bottom-color: rgba(239, 68, 68, 0.2)">
        <div class="summary-card-title" style="color: #fca5a5">${getFileName(url)}</div>
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

  async function callLLMAPI(text, config) {
    const provider = config.provider || 'deepseek';
    const modelName = config.model === 'custom' ? config.customModel : config.model;
    const apiKey = provider === 'gemini'
      ? (config.geminiApiKey || config.apiKey)
      : (provider === 'github' ? config.githubApiKey : (config.deepseekApiKey || config.apiKey));

    if (provider === 'gemini') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: text
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: config.systemPrompt
            }
          ]
        }
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const errorMsg = errorJson.error?.message || `HTTP ${res.status}`;
        throw new Error(`Gemini API Error: ${errorMsg}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response content from model.';
    } else if (provider === 'github') {
      // GitHub Models API (OpenAI Compatible)
      const endpoint = 'https://models.github.ai/inference/chat/completions';
      const requestBody = {
        model: modelName,
        messages: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: `Analyze the following document and provide a summary:\n\n${text}` }
        ]
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/vnd.github+json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const errorMsg = errorJson.message || `HTTP ${res.status}`;
        throw new Error(`GitHub Models API Error: ${errorMsg}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || 'No response content from model.';
    } else {
      // DeepSeek API (OpenAI Compatible)
      const endpoint = 'https://api.deepseek.com/chat/completions';
      const requestBody = {
        model: modelName,
        messages: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: `Analyze the following document and provide a summary:\n\n${text}` }
        ]
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const errorMsg = errorJson.error?.message || `HTTP ${res.status}`;
        throw new Error(`DeepSeek API Error: ${errorMsg}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || 'No response content from model.';
    }
  }
});
