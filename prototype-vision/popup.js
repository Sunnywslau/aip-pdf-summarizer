document.addEventListener('DOMContentLoaded', () => {
  const githubTokenInput = document.getElementById('githubToken');
  const startPageInput = document.getElementById('startPage');
  const endPageInput = document.getElementById('endPage');
  const runBtn = document.getElementById('runBtn');
  const statusContainer = document.getElementById('statusContainer');
  const resultContainer = document.getElementById('resultContainer');
  const resultText = document.getElementById('resultText');

  // Load saved token
  chrome.storage.sync.get(['githubApiKey'], (items) => {
    if (items.githubApiKey) {
      githubTokenInput.value = items.githubApiKey;
    }
  });

  // Watch token change to save it
  githubTokenInput.addEventListener('change', () => {
    const token = githubTokenInput.value.trim();
    chrome.storage.sync.set({ githubApiKey: token });
  });

  runBtn.addEventListener('click', async () => {
    const token = githubTokenInput.value.trim();
    if (!token) {
      alert('Please enter your GitHub PAT token.');
      return;
    }

    const startPage = parseInt(startPageInput.value) || 1;
    const endPage = parseInt(endPageInput.value) || 1;
    if (startPage > endPage) {
      alert('Start page cannot be greater than end page.');
      return;
    }

    showStatus('Detecting active PDF tab...');
    clearResult();
    runBtn.disabled = true;

    try {
      // 1. Get current tab URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab found.');
      const pdfUrl = tab.url;

      showStatus(`Fetching PDF binary data...`);
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error(`Fetch failed (HTTP ${response.status})`);
      const arrayBuffer = await response.arrayBuffer();

      // 2. Load PDF with PDF.js
      showStatus('Loading PDF into memory...');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages = pdf.numPages;
      const finalEndPage = Math.min(endPage, totalPages);
      const finalStartPage = Math.max(1, Math.min(startPage, finalEndPage));

      showStatus(`PDF loaded. Total pages: ${totalPages}. Processing range: ${finalStartPage} to ${finalEndPage}.`);

      // 3. Render PDF pages to canvases and get base64 PNGs
      const imageBlocks = [];
      
      for (let i = finalStartPage; i <= finalEndPage; i++) {
        showStatus(`Rendering page ${i} to image...`);
        const page = await pdf.getPage(i);
        
        // Render at 1.5x scale for good vision OCR resolution
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        const base64Data = canvas.toDataURL('image/png');
        
        imageBlocks.push({
          type: "image_url",
          image_url: {
            url: base64Data
          }
        });
      }

      // 4. Send images to GitHub Models Vision API
      showStatus('Sending page images to GitHub Models Vision API (gpt-4o-mini)...');
      const analysis = await callGithubVisionAPI(imageBlocks, token);

      showResult(analysis);
      hideStatus();
    } catch (err) {
      console.error(err);
      showResult(`Error: ${err.message || 'An unexpected error occurred.'}`);
      hideStatus();
    } finally {
      runBtn.disabled = false;
    }
  });

  async function callGithubVisionAPI(imageBlocks, token) {
    const endpoint = 'https://models.github.ai/inference/chat/completions';
    
    // Build user content prompt + images list
    const promptText = `Analyze these aviation AIC document pages. 
    1. Scan the margins (left or right side margins of the text columns) for vertical "change bars" (black vertical lines indicating that text on that line has been added or amended).
    2. Focus only on changes related to SIDs (Standard Instrument Departures), STARs (Standard Terminal Arrival Routes), and Instrument Approach procedures.
    3. For every edit indicated by a change bar, extract the NAME of the procedure(s) being modified.
    4. Provide the output in a clean, bulleted list. Only list the affected Airport (with ICAO code if possible) and the Procedure Name(s). If no changes are found, reply "No procedure changes detected on these pages."`;

    const contentArray = [
      {
        type: "text",
        text: promptText
      },
      ...imageBlocks
    ];

    const requestBody = {
      model: "gpt-4o-mini", // GitHub Models vision-supported model
      messages: [
        {
          role: "user",
          content: contentArray
        }
      ]
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    return data.choices?.[0]?.message?.content || 'No content returned.';
  }

  function showStatus(text) {
    statusContainer.style.display = 'block';
    statusContainer.textContent = text;
  }

  function hideStatus() {
    statusContainer.style.display = 'none';
  }

  function showResult(text) {
    resultContainer.style.display = 'block';
    resultText.textContent = text;
  }

  function clearResult() {
    resultContainer.style.display = 'none';
    resultText.textContent = '';
  }
});
