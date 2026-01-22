# 🧹 DataScrub

**AI-powered data cleaning agent for data scientists**

DataScrub is a local-first, privacy-focused data cleaning tool that combines rule-based automation with LLM-powered insights. Upload your messy data, get automatic fixes for common issues, and chat with an AI agent to understand and clean your data.

![DataScrub Screenshot](screenshot.png)

## Features

### Automatic Cleaning (No Approval Needed)
- ✅ Whitespace trimming
- ✅ Missing value standardization (NULL, N/A, None, etc. → empty)
- ✅ Duplicate row removal

### Smart Suggestions (With Approval)
- 🔄 Missing value imputation (mean, median, mode, custom)
- 🗑️ Column removal for high-missing columns
- 📊 Outlier detection and handling (IQR method)
- 🔢 Type conversion (string → number)

### AI-Powered Chat
- 💬 Ask questions about your data
- 🔍 Get insights and recommendations
- 🤖 Powered by local LLMs via Ollama (your data never leaves your machine)

## Quick Start

### 1. Install Ollama

Download from [ollama.com](https://ollama.com)

### 2. Pull a model

```bash
ollama pull qwen3:8b
```

Other recommended models:
- `gemma3:12b` - Good reasoning, needs ~9GB RAM
- `llama3.1:8b` - Great all-rounder
- `mistral:7b` - Fast and capable

### 3. Start Ollama with CORS enabled

**macOS/Linux:**
```bash
OLLAMA_ORIGINS="*" ollama serve
```

**Windows (PowerShell):**
```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```

**Windows (Command Prompt):**
```cmd
set OLLAMA_ORIGINS=* && ollama serve
```

### 4. Open DataScrub

Open `index.html` in your browser, or host it on GitHub Pages.

## Hosting on GitHub Pages

1. Fork this repository
2. Go to Settings → Pages
3. Set source to "main" branch
4. Your app will be live at `https://yourusername.github.io/datascrub`

## Supported File Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| CSV | `.csv` | Comma-separated values |
| Excel | `.xlsx`, `.xls` | First sheet only |
| JSON | `.json` | Array of objects |

## System Requirements

- **Browser:** Chrome, Firefox, Safari, Edge (modern versions)
- **For AI features:** Ollama running locally
- **RAM for Ollama:**
  - 8B models: ~6GB
  - 12B models: ~9GB

## Privacy

DataScrub is designed with privacy in mind:
- 🔒 All data processing happens in your browser
- 🏠 AI runs locally via Ollama (no cloud APIs)
- 📡 No data is sent to external servers
- 💾 Nothing is stored between sessions

## Tech Stack

- Vanilla HTML/CSS/JS (no build step required)
- [Papa Parse](https://www.papaparse.com/) for CSV parsing
- [SheetJS](https://sheetjs.com/) for Excel files
- [Ollama](https://ollama.com/) for local LLM inference

## Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## License

MIT License - feel free to use this for personal or commercial projects.

---

Made with ❤️ for data scientists who are tired of messy data
