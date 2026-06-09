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

  function getActiveKey() {
    return config.provider === 'gemini' 
      ? (config.geminiApiKey || config.apiKey) 
      : (config.deepseekApiKey || config.apiKey);
  }

  function updateButtonState() {
    if (tabLoaded && configLoaded) {
      if (getActiveKey()) {
        summarizeBtn.disabled = false;
        clearError();
      } else {
        showError('Please set your API Key in the Settings page first.');
        summarizeBtn.disabled = true;
      }
    }
  }

  // Load config
  chrome.storage.sync.get({
    provider: 'deepseek',
    apiKey: '', // legacy
    deepseekApiKey: '',
    geminiApiKey: '',
    model: 'deepseek-v4-flash',
    customModel: '',
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
      
      showStatus('Parsing PDF text content...');
      const arrayBuffer = await response.arrayBuffer();

      // Set worker source for PDFJS
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const maxPages = Math.min(pdf.numPages, 30); // Cap at 30 pages for performance/token limits
      
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

      // 2. Invoke LLM API
      showStatus('Analyzing with AI...');
      const summary = await callLLMAPI(fullText, config);

      // 3. Show Result
      hideStatus();
      resultContainer.innerHTML = parseMarkdown(summary);
      resultContainer.style.display = 'block';
    } catch (err) {
      hideStatus();
      showError(err.message || 'An unexpected error occurred.');
    } finally {
      summarizeBtn.disabled = false;
    }
  });

  async function callLLMAPI(text, config) {
    const provider = config.provider || 'deepseek';
    const modelName = config.model === 'custom' ? config.customModel : config.model;
    const apiKey = provider === 'gemini'
      ? (config.geminiApiKey || config.apiKey)
      : (config.deepseekApiKey || config.apiKey);

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
