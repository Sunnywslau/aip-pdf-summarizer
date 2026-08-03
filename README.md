# AIP Amendment Parser

A Chrome Extension + Hugging Face backend system for analysing **ICAO AIP Amendments**, **AIP SUPs**, and **AICs**. It detects changed parameters from official aviation publications and produces structured Markdown summaries for flight operations teams.

---

## System Architecture

The project has two components with different processing paths depending on document type:

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                        │
│                                                             │
│  AIP SUP / AIC  ──► PDF.js (in-browser) ──► Gemini API    │
│                                             (direct call)   │
│                                                             │
│  AIP Amendment  ──► Upload to Hugging Face Backend         │
│                         │                                   │
│                         ▼                                   │
│              FastAPI + Python Engine                        │
│              (change bar detection,                         │
│               spatial annotation,                           │
│               page classification)                          │
│                         │                                   │
│                         ▼                                   │
│                   Gemini 3.5 Flash                          │
│                         │                                   │
│                         ▼                                   │
│              Markdown Report returned                       │
└─────────────────────────────────────────────────────────────┘
```

| Document Type | Processing Location | AI Model |
|---|---|---|
| AIP Amendment (large, 100–400 pages) | Hugging Face backend (Docker) | Gemini 3.5 Flash (hardcoded) |
| AIP SUP / AIC (short, 1–10 pages) | Browser (Chrome Extension JS) | Configurable (Gemini or DeepSeek) |

---

## Repository Structure

```
aip-pdf-summarizer/
│
├── manifest.json          # Chrome Extension manifest
├── popup.html / popup.js  # Single-document summarizer UI
├── batch.html / batch.js  # Batch processor for multiple URLs
├── options.html / options.js  # Settings page (provider, API key, model)
│
├── backend/               # Hugging Face Docker backend
│   ├── fastapi_app.py     # FastAPI entry point (/analyze endpoint)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── services/
│   │   └── intel_agent.py     # Core processing engine
│   └── utils/
│       ├── change_bar_detector.py   # Spatial line annotation
│       └── section_classifier.py   # Page category classifier
│
├── poc/                   # Local MacBook deployment helpers
│   ├── deploy_to_existing_wx.py   # Deploy backend to Hugging Face
│   ├── pause_and_deploy.py
│   ├── resume_space.py
│   └── get_space_logs.py
│
├── data/                  # Test PDF samples
├── ALGORITHM.md           # Detailed algorithm documentation
└── README.md              # This file
```

---

## Chrome Extension Setup

### 1. Load the Extension
1. Open Chrome → `chrome://extensions`
2. Enable **Developer Mode** (top-right)
3. Click **Load unpacked** → select the `aip-pdf-summarizer/` folder

### 2. Configure Settings
Click the extension icon → **Settings (⚙️)**:

| Setting | Value |
|---|---|
| **Provider** | `Google Gemini (Recommended)` |
| **Model** | `Gemini 3.5 Flash` |
| **Gemini API Key** | Your key from [aistudio.google.com](https://aistudio.google.com) |
| **Backend URL** | `https://sunnywslau-aip-amendment-parser.hf.space` |

> **Note**: Gemini API key is required for both SUP/AIC (direct) and Amendment (backend) processing. The key is sent securely via HTTP header to the backend — it is never stored on the server.

### 3. Alternative Provider: DeepSeek
DeepSeek can be used for **SUP/AIC only** (Amendment backend uses Gemini regardless):

| Setting | Value |
|---|---|
| **Provider** | `DeepSeek` |
| **Model** | `DeepSeek V4 Flash (Recommended)` |
| **DeepSeek API Key** | Your key from [platform.deepseek.com](https://platform.deepseek.com) |

---

## Supported AI Providers

| Provider | SUP / AIC | AIP Amendment |
|---|---|---|
| Google Gemini | ✅ | ✅ |
| DeepSeek | ✅ | ❌ (backend is Gemini-only) |

> **GitHub Models** was removed from this project on 2026-08-03 after the service was fully retired by GitHub on 2026-07-30.

---

## Backend Deployment (Hugging Face)

The backend runs as a Docker Space on Hugging Face at:
**`https://sunnywslau-aip-amendment-parser.hf.space`**

To redeploy after code changes, run from your Mac:
```bash
cd poc/
python deploy_to_existing_wx.py
```

Requires a `HF_TOKEN` environment variable set in your local `.env` file.

---

## Algorithm Documentation

See [`ALGORITHM.md`](./ALGORITHM.md) for a detailed breakdown of:
- Cover Sheet Summary Extraction
- Hybrid Page Selection (change bar vector math)
- Spatial Line-Level Annotation (the `[CHANGED]` tagging system)
- Classification & Intelligent Routing

---

## API Quota Notes

- **Google Gemini Free Tier**: 20 requests/day **per project** (not per API key). Creating a new key under the same Google Cloud project does not reset the quota — a new project is required.
- **DeepSeek**: Generous free tier with no daily hard limit. Suitable for high-volume SUP/AIC batch processing.
