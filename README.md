# AIP Amendment & SUP Parser

A Chrome Extension + Hugging Face backend gateway system for analyzing **ICAO AIP Amendments**, **AIP SUPs**, and **AICs**. It parses document contents, detects changed sections using Margins Change Bar vector math, overlays line-level spatial annotations, and summaries the key differences using Generative AI models.

---

## 🌍 The Gateway Architecture

To bypass regional restrictions (e.g. Gemini block in Hong Kong) and corporate proxy rules (e.g. firewall blocking direct DeepSeek API endpoints in the office), **all AI queries are routed through the Hugging Face backend gateway**. 

```
                       ┌─────────────────────────────┐
                       │      Chrome Extension       │
                       │                             │
                       │   Local PDF.js Parsing      │
                       └──────────────┬──────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              │ Upload PDF / Send Text (HTTP Post with keys)  │
              ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│     Backend: /analyze         │               │     Backend: /analyze-sup     │
│  (AIP Amendment PDF Parser)   │               │   (AIP SUP & AIC Text Parser) │
└─────────────┬─────────────────┘               └──────────────┬────────────────┘
              │                                                │
              └───────────────────────┬────────────────────────┘
                                      ▼
                      ┌──────────────────────────────┐
                      │    Hugging Face Gateway      │
                      │   (Located in USA Region)    │
                      └──────────────┬───────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
     ┌───────────────────────┐               ┌───────────────────────┐
     │   DeepSeek V4 API     │               │   Google Gemini API   │
     │ (deepseek-v4-flash)   │               │  (gemini-3.5-flash)   │
     └───────────────────────┘               └───────────────────────┘
```

---

## 🎛️ AI Mode Quick Selector

The extension interface includes a quick selector that lets you override the active AI engine instantly:

```
AI: [ Auto ] [ DeepSeek ] [ Gemini ]    ● DeepSeek
```

- **Auto** (Recommended): Sends both DeepSeek and Gemini keys. The Hugging Face backend will automatically prefer DeepSeek (fast & cost-effective) and fallback to Gemini if needed.
- **DeepSeek**: Forces the query to run on `deepseek-v4-flash`.
- **Gemini**: Forces the query to run on `gemini-3.5-flash`.
- **Live Indicator Badge**: The color-coded badge dynamically indicates which AI model will resolve the query based on the active mode and available keys.

---

## ⚙️ Configuration Setup

In the Extension **Settings (⚙️)** page:

1. **LLM Provider**: Choose your preferred main model (Gemini or DeepSeek).
2. **Gemini API Key**: Get a key from [Google AI Studio](https://aistudio.google.com). Used directly by Gemini mode and as a fallback.
3. **DeepSeek API Key**: Get a key from [DeepSeek Platform](https://platform.deepseek.com). Used directly by DeepSeek mode.
4. **Backend URL**: Point to your Hugging Face Space: `https://sunnywslau-aip-amendment-parser.hf.space`

---

## ⚡ Robustness & Error Handling

### Transient Error Auto-Recovery (Exponential Backoff)
To handle API rate limits (`429`) and server load spikes (`503`), the Hugging Face gateway implements a 3-tier retry algorithm for both DeepSeek and Gemini queries:

$$\text{Wait Duration} = 2^{\text{attempt}} \text{ seconds}$$

- **1st Attempt Failure**: Waits 2 seconds, retries.
- **2nd Attempt Failure**: Waits 4 seconds, retries.
- **3rd Attempt Failure**: Fails and returns the detailed exception report to the extension.

### Automatic Model Name Sanitization
The gateway validates model names sent by the extension. If a model name is mismatched (e.g. extension sends `gemini-3.5-flash` parameters but the user selects `DeepSeek` mode), the backend sanitizes the request and automatically routes to the provider's correct native model (`deepseek-v4-flash`), avoiding 400 Bad Request API crashes.

---

## 🔍 Declarative Link Extractor & PDF Resolver

The extension uses a configuration-driven link extraction engine to scan AIP pages, extract document tables/lists, and resolve them to their corresponding print PDFs.

- **Modular Scraper Engine**: [`aipExtractor.js`](file:///Users/wsl/Code/AIP_Reader/aip-pdf-summarizer/aipExtractor.js) contains the core matching, filtering, and resolution strategies.
- **Config-Driven**: Add support for a new country by simply adding its matching rules and keywords to `AIP_CONFIGS` in `aipExtractor.js`.
- **All-Frames Injection**: DOM scanning runs inside all active page frames concurrently using Chrome's `allFrames: true` scripting injection API, bypassing cross-frame same-origin security barriers.
- **Print Alternate Resolving**: Automatically fetches and parses target subpages to extract print PDF references and automatically pulls in the descriptive subpage title (e.g. `SUP 23/26 PHUKET AIRPORT...`) if the link text on the index page was short or generic.

For detailed design specifications and extension guidelines, see [`docs/design/architecture.md`](file:///Users/wsl/Code/AIP_Reader/aip-pdf-summarizer/docs/design/architecture.md).

---

## 📂 Repository Structure

```
aip-pdf-summarizer/
│
├── manifest.json          # Chrome Extension manifest
├── popup.html / popup.js  # Main UI with AI Mode selector
├── aipExtractor.js        # Declarative Config-Driven Extraper Module
├── batch.html / batch.js  # Batch URL runner
├── options.html / options.js  # Dual-key settings page
│
├── docs/
│   └── design/
│       └── architecture.md # Detailed technical architecture & design spec
│
├── backend/               # FastAPI Gateway (Docker)
│   ├── fastapi_app.py     # Endpoints (/analyze, /analyze-sup)
│   ├── requirements.txt
│   ├── services/
│   │   ├── intel_agent.py # AIP Amendment parser service (Gemini/DeepSeek)
│   │   └── sup_agent.py   # AIP SUP/AIC parser service (Gemini/DeepSeek)
│   └── utils/
│       ├── change_bar_detector.py  # Spatial line change-bar detection
│       └── section_classifier.py  # Page layout classifier
│
├── poc/                   # local tools & deploy scripts
├── ALGORITHM.md           # Visual math and classification rules doc
└── README.md              # This file
```

---

## 🚀 Backend Deployment (Hugging Face)

The backend runs as a Docker container on Hugging Face Spaces. To deploy changes:

```bash
cd poc/
python3 deploy_to_existing_wx.py
```
*(Requires `HF_TOKEN` configuration in your local environment)*
