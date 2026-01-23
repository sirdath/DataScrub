# 🧹 DataScrub

**AI-powered data cleaning agent for data scientists.**

DataScrub is a privacy-centric data cleaning utility that integrates rule-based automation with Large Language Model (LLM) insights. It allows users to upload raw datasets, automatically rectify common inconsistencies, and utilize an AI agent for advanced data profiling and cleaning tasks.

The application operates entirely within the client-side browser environment. It supports **Local Inference** via Ollama for air-gapped or privacy-sensitive workflows, as well as **Cloud APIs** (Groq, OpenAI, OpenRouter) for enhanced reasoning capabilities.

## Features

### Automatic Cleaning
* **Whitespace Trimming**: Automatically removes leading and trailing whitespace from string fields.
* **Standardization**: Unifies disparate missing value indicators (e.g., `NULL`, `N/A`, `None`, `-`) into standard empty cells.
* **Deduplication**: Identifies and removes exact duplicate records.

### AI Agent and Smart Suggestions
* **Imputation**: Generates statistical recommendations for missing values (mean, median, mode).
* **Outlier Management**: Detects statistical outliers using the Interquartile Range (IQR) method and suggests capping or removal strategies.
* **Context-Aware Processing**: Allows users to define project-specific context (e.g., domain rules) to guide the AI's decision-making process.
* **Natural Language Interface**: Facilitates data interrogation and cleaning through natural language queries.

### User Interface
* **Customization**: Includes nine professional color themes.
* **Adaptive Layout**: Features a resizable workspace and control panel to accommodate various screen configurations.
* **Version Control**: Implements a full history stack with undo/redo functionality for safe data manipulation.

### Multi-Provider Support
1.  **Local (Ollama)**: Ensures data sovereignty by keeping all processing on the local machine.
2.  **Groq**: Provides low-latency inference suitable for rapid iteration.
3.  **OpenRouter/OpenAI**: Enables connection to high-performance frontier models.

---

## Quick Start

### Option A: Privacy-First (Local Ollama)
Recommended for sensitive data. No internet connection is required post-configuration.

1.  **Install Ollama**: Download the installer from the official Ollama website.
2.  **Pull a Model**: Execute the following command in your terminal:
    ```bash
    ollama pull qwen2.5:7b
    # Alternatives: llama3.1:8b, mistral, gemma2
    ```
3.  **Configure CORS**:
    * **macOS/Linux**: `OLLAMA_ORIGINS="*" ollama serve`
    * **Windows (PowerShell)**: `$env:OLLAMA_ORIGINS="*"; ollama serve`
4.  Launch DataScrub and select **Ollama** in the settings menu.

### Option B: Cloud API (Groq / OpenAI)
Recommended for performance on hardware without dedicated GPUs.

1.  Obtain an API Key from your preferred provider (e.g., Groq Console or OpenAI).
2.  Navigate to **Settings** within DataScrub.
3.  Select the provider and input your API Key.
    * *Note: API keys are stored in the browser's local storage and are never transmitted to DataScrub servers.*

---

## Hosting

The application is a self-contained static file. It can be executed by opening `index.html` directly or hosted via GitHub Pages:

1.  Fork this repository.
2.  Navigate to **Settings** > **Pages**.
3.  Set the source branch to **main**.
4.  The application will be accessible at `https://yourusername.github.io/datascrub`.

---

## Privacy and Security

DataScrub is architected as a **client-side application**.

* **Local Mode**: When using Ollama, data processing is entirely local. No data leaves the user's device.
* **Cloud Mode**: When using third-party APIs (OpenAI, Groq), only necessary data snippets (schema, summaries, or specific queries) are transmitted to the provider for processing.
* **Credential Management**: API keys are persisted in the browser's `localStorage` for convenience but can be cleared at any time.

---

## Technical Stack

* **Core**: HTML5, CSS3, JavaScript (ES6+).
* **Data Parsing**: PapaParse (CSV), SheetJS (Excel).
* **Architecture**: Serverless, single-file deployment.

## License

MIT License - feel free to use this for personal or commercial projects.

---

Made with ❤️ for data scientists who are tired of messy data
