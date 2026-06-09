const DEFAULT_PROMPT = `You are an aviation operations expert. Summarize this AIP SUP / AIC document in a simple, clean, and highly scannable Markdown format.

Provide the summary using exactly these four sections, utilizing bold text, inline code, and formatting to highlight key information:
1. **Airport / Location**: State which airport(s) are affected. Use **bold** for airport names and \`inline code\` for ICAO/IATA codes (e.g., **Hong Kong International Airport** (\`VHHH\`)).
2. **Runway Impact**: State clearly "**YES**" or "**NO**". If YES, list the impacts using bullet points. Bold all runway designators (e.g., **RWY 07R/25L**) and dimensions/lengths (e.g., **2,500m**).
3. **Airspace Restriction**: State clearly "**YES**" or "**NO**". If YES, describe the airspace restrictions. Use \`inline code\` for altitudes/flight levels (e.g., \`FL120\` or \`3,000ft AMSL\`).
4. **Key Operational Summary & Dates**: Briefly summarize operational changes and effective dates/times. Use \`inline code\` for dates/times (e.g., \`2026-06-07 to 2026-06-20\`).`;

const PROVIDER_MODELS = {
  deepseek: [
    { value: 'deepseek-v4-flash', text: 'DeepSeek V4 Flash (Recommended - Fast)' },
    { value: 'deepseek-v4-pro', text: 'DeepSeek V4 Pro (Reasoning & Complex Tasks)' },
    { value: 'custom', text: 'Custom Model...' }
  ],
  github: [
    { value: 'gpt-4o-mini', text: 'GPT-4o Mini (Recommended - Fast & Accurate)' },
    { value: 'gpt-4o', text: 'GPT-4o (Powerful Reasoning)' },
    { value: 'meta-llama-3.1-70b-instruct', text: 'Llama 3.1 70B (Meta Open Source)' },
    { value: 'custom', text: 'Custom Model...' }
  ],
  gemini: [
    { value: 'gemini-2.5-flash', text: 'Gemini 2.5 Flash (Recommended - Fast & Modern)' },
    { value: 'gemini-2.5-pro', text: 'Gemini 2.5 Pro (Powerful reasoning)' },
    { value: 'gemini-1.5-flash', text: 'Gemini 1.5 Flash (Legacy)' },
    { value: 'gemini-1.5-pro', text: 'Gemini 1.5 Pro (Legacy)' },
    { value: 'custom', text: 'Custom Model...' }
  ]
};

const providerSelect = document.getElementById('provider');
const modelSelect = document.getElementById('model');
const customModelGroup = document.getElementById('customModelGroup');
const customModelInput = document.getElementById('customModel');

const deepseekKeyGroup = document.getElementById('deepseekKeyGroup');
const githubKeyGroup = document.getElementById('githubKeyGroup');
const geminiKeyGroup = document.getElementById('geminiKeyGroup');

function populateModels(provider, selectedModelValue) {
  modelSelect.innerHTML = '';
  const models = PROVIDER_MODELS[provider] || [];
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.text;
    modelSelect.appendChild(opt);
  });
  
  if (selectedModelValue) {
    modelSelect.value = selectedModelValue;
  }
}

function updateKeyVisibility(provider) {
  deepseekKeyGroup.style.display = 'none';
  githubKeyGroup.style.display = 'none';
  geminiKeyGroup.style.display = 'none';

  if (provider === 'gemini') {
    geminiKeyGroup.style.display = 'block';
  } else if (provider === 'github') {
    githubKeyGroup.style.display = 'block';
  } else {
    deepseekKeyGroup.style.display = 'block';
  }
}

// Watch provider selection change
providerSelect.addEventListener('change', (e) => {
  const provider = e.target.value;
  populateModels(provider);
  updateKeyVisibility(provider);
  modelSelect.dispatchEvent(new Event('change'));
});

// Watch model selection change
modelSelect.addEventListener('change', (e) => {
  if (e.target.value === 'custom') {
    customModelGroup.style.display = 'block';
  } else {
    customModelGroup.style.display = 'none';
  }
});

// Load settings on startup
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({
    provider: 'deepseek',
    apiKey: '', // legacy
    deepseekApiKey: '',
    githubApiKey: '',
    geminiApiKey: '',
    model: 'deepseek-v4-flash',
    customModel: '',
    systemPrompt: DEFAULT_PROMPT
  }, (items) => {
    providerSelect.value = items.provider;
    populateModels(items.provider, items.model);
    updateKeyVisibility(items.provider);
    
    // Migration helper: if legacy apiKey is set but provider-specific key is empty
    let dsKey = items.deepseekApiKey;
    let gemKey = items.geminiApiKey;
    if (items.apiKey) {
      if (items.provider === 'gemini' && !gemKey) {
        gemKey = items.apiKey;
      } else if (items.provider === 'deepseek' && !dsKey) {
        dsKey = items.apiKey;
      }
    }

    document.getElementById('deepseekApiKey').value = dsKey;
    document.getElementById('githubApiKey').value = items.githubApiKey || '';
    document.getElementById('geminiApiKey').value = gemKey;
    document.getElementById('systemPrompt').value = items.systemPrompt;
    customModelInput.value = items.customModel;
    
    if (items.model === 'custom') {
      customModelGroup.style.display = 'block';
    }
  });
});

// Save settings
document.getElementById('saveBtn').addEventListener('click', () => {
  const provider = providerSelect.value;
  const deepseekApiKey = document.getElementById('deepseekApiKey').value.trim();
  const githubApiKey = document.getElementById('githubApiKey').value.trim();
  const geminiApiKey = document.getElementById('geminiApiKey').value.trim();
  const model = modelSelect.value;
  const customModel = customModelInput.value.trim();
  const systemPrompt = document.getElementById('systemPrompt').value;

  chrome.storage.sync.set({
    provider,
    deepseekApiKey,
    githubApiKey,
    geminiApiKey,
    model,
    customModel,
    systemPrompt
  }, () => {
    const status = document.getElementById('status');
    status.classList.add('show');
    setTimeout(() => {
      status.classList.remove('show');
    }, 2000);
  });
});
