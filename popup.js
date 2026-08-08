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
      urlDisplay.textContent = "Scanning page for documents...";
      
      // Inject content script to scan DOM
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanPageForLinks
      }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
          console.error("Failed to inject script: ", chrome.runtime.lastError);
          urlDisplay.textContent = `${currentTabUrl} (Not detected as PDF)`;
          urlDisplay.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          return;
        }

        const { url, links } = results[0].result;
        const filteredLinks = filterAipLinks(url, links);

        if (filteredLinks.length === 0) {
          urlDisplay.textContent = `${currentTabUrl} (No publications detected)`;
          urlDisplay.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          return;
        }

        urlDisplay.textContent = "Resolving document links...";
        
        // Resolve HTML eAIP folder links to their PDF targets
        const resolvePromises = filteredLinks.map(async (link) => {
          const lowerUrl = link.url.toLowerCase();
          const isPdf = lowerUrl.endsWith('.pdf') || lowerUrl.includes('/pdf/') || lowerUrl.includes('.pdf?') || lowerUrl.includes('/pdfurl/');
          
          if (!isPdf) {
            const resolvedUrl = await resolveAipAmdtPdf(link.url);
            return {
              ...link,
              url: resolvedUrl
            };
          }
          return link;
        });

        Promise.all(resolvePromises).then((resolvedLinks) => {
          // Filter out links that failed to resolve to a PDF link (if they still end in .html)
          const validPdfLinks = resolvedLinks.filter(link => {
            const lower = link.url.toLowerCase();
            return lower.endsWith('.pdf') || lower.includes('/pdf/') || lower.includes('.pdf?') || lower.includes('/pdfurl/');
          });

          if (validPdfLinks.length === 0) {
            urlDisplay.textContent = `${currentTabUrl} (Failed to find PDF versions)`;
            urlDisplay.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            return;
          }

          urlDisplay.textContent = `AIP Page: ${new URL(url).hostname}`;
          urlDisplay.style.borderColor = 'rgba(16, 185, 129, 0.4)'; // green border
          renderExtractedLinks(validPdfLinks);
        });
      });
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


  function scanPageForLinks() {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const links = anchors.map(a => {
      let absoluteUrl = '';
      try {
        absoluteUrl = new URL(a.getAttribute('href'), document.baseURI).href;
      } catch(e) {
        absoluteUrl = a.href;
      }
      return {
        url: absoluteUrl.replace(/\\/g, '/'),
        text: a.textContent.trim()
      };
    });
    return {
      url: window.location.href,
      links: links
    };
  }

  async function resolveAipAmdtPdf(htmlUrl) {
    try {
      const res = await fetch(htmlUrl);
      if (!res.ok) return htmlUrl;
      const htmlText = await res.text();
      
      // Parse links from HTML text
      const pdfRegex = /href=["']([^"']+\.pdf(?:[^"']*)?)["']/gi;
      let match;
      const pdfUrls = [];
      while ((match = pdfRegex.exec(htmlText)) !== null) {
        try {
          const absolute = new URL(match[1], htmlUrl).href;
          pdfUrls.push(absolute);
        } catch (e) {}
      }
      
      if (pdfUrls.length === 0) return htmlUrl;
      
      // Find the best match: prefer one that has "amdt", "complete", "pkg", or "eaip" in it
      const bestMatch = pdfUrls.find(url => {
        const lower = url.toLowerCase();
        return lower.includes('amdt') || lower.includes('complete') || lower.includes('eaip');
      });
      
      return bestMatch || pdfUrls[0];
    } catch (err) {
      console.error("Failed to resolve HTML eAIP link:", err);
      return htmlUrl;
    }
  }

  function filterAipLinks(pageUrl, links) {
    const isHkAis = pageUrl.toLowerCase().includes('ais.gov.hk');
    let filtered = [];

    if (isHkAis) {
      // Tier 2: HK CAD specific adapter (looks for Latest Publications list items)
      filtered = links.filter(link => {
        const text = link.text.toLowerCase();
        const url = link.url.toLowerCase();
        
        // Match standard HK CAD list item text headers (AIP AMDT, AIP SUP, AIC)
        const isAipDoc = text.includes('aip amdt') || text.includes('aip sup') || text.includes('aic');
        if (!isAipDoc) return false;
        
        // Match PDF links OR HTML eAIP folder links (which contain hkaip, eaip, amdt, history, or index)
        const isPdf = url.endsWith('.pdf') || url.includes('/pdf/') || url.includes('.pdf?') || url.includes('/pdfurl/');
        const isHtmlEaip = url.includes('/eaip/') || url.includes('/hkaip/') || url.includes('amdt') || url.includes('history') || url.includes('index') || url.endsWith('.html') || url.endsWith('/');
        
        return isPdf || isHtmlEaip;
      });
    }

    // Tier 1: Generic scanner (fallback if HK CAD returned empty or if it's another country)
    if (filtered.length === 0) {
      const seenUrls = new Set();
      filtered = links.filter(link => {
        if (!link.url) return false;
        const lowerUrl = link.url.toLowerCase();
        const lowerText = link.text.toLowerCase();
        
        if (seenUrls.has(link.url)) return false;

        const isPdf = lowerUrl.endsWith('.pdf') || lowerUrl.includes('/pdf/') || lowerUrl.includes('.pdf?') || lowerUrl.includes('/pdfurl/');
        const isHtmlEaip = (lowerUrl.includes('/eaip/') || lowerUrl.includes('/hkaip/') || lowerUrl.includes('/amdt/')) && 
                           (lowerUrl.endsWith('.html') || lowerUrl.endsWith('/') || lowerUrl.includes('history') || lowerUrl.includes('index'));
        if (!isPdf && !isHtmlEaip) return false;

        const keywords = ['sup', 'aic', 'amdt', 'amendment', 'pdf', 'aip', 'circular', 'supplement'];
        const matchesKeyword = keywords.some(kw => lowerUrl.includes(kw) || lowerText.includes(kw));

        if (matchesKeyword) {
          seenUrls.add(link.url);
          return true;
        }
        return false;
      });
    }

    return filtered;
  }

  const extractorPanel = document.getElementById('extractorPanel');
  const extractedLinksList = document.getElementById('extractedLinksList');
  const aiSelectorGroup = document.getElementById('aiSelectorGroup');
  const importSelectedBtn = document.getElementById('importSelectedBtn');
  let selectedLinks = [];

  function renderExtractedLinks(links) {
    extractedLinksList.innerHTML = '';
    selectedLinks = [...links]; // Default select all
    
    links.forEach((link, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'extractor-link-item';
      const checkboxId = `chk-link-${idx}`;
      
      itemEl.innerHTML = `
        <input type="checkbox" id="${checkboxId}" checked style="cursor: pointer;">
        <div style="flex: 1; cursor: pointer;">
          <label for="${checkboxId}" class="extractor-link-label" style="cursor: pointer;">${link.text || 'Untitled Document'}</label>
          <span class="extractor-link-url" title="${link.url}">${link.url}</span>
        </div>
      `;
      
      itemEl.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!selectedLinks.some(l => l.url === link.url)) {
            selectedLinks.push(link);
          }
        } else {
          selectedLinks = selectedLinks.filter(l => l.url !== link.url);
        }
        importSelectedBtn.disabled = selectedLinks.length === 0;
      });
      
      extractedLinksList.appendChild(itemEl);
    });

    extractorPanel.style.display = 'block';
    aiSelectorGroup.style.display = 'none';
    summarizeBtn.style.display = 'none';
  }

  importSelectedBtn.addEventListener('click', () => {
    if (selectedLinks.length === 0) return;
    chrome.storage.local.set({
      importQueue: selectedLinks
    }, () => {
      chrome.tabs.create({ url: 'batch.html' });
    });
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
