# AgentHub – AI Agent Workflow Automation Platform

AgentHub is a full-stack AI Agent Workflow Automation Platform built using Python Flask and JavaScript. It allows users to create, configure, manage, and execute task-specific AI agents and connect multiple agents into automated workflows.

## Features

- Create and configure task-specific AI agents
- Manage AI agents through a centralized interface
- Build multi-step AI agent pipelines
- Connect multiple agents into automated workflows
- Execute workflows and track their progress
- Human-in-the-Loop (HITL) workflow support
- Pause workflow execution for user review and approval
- Support configurable LLM providers and models
- REST API integration
- PDF, DOCX, and XLSX file processing
- Dataset and file management
- Execution tracking and run history
- Token usage monitoring
- AI-generated outputs

## Technologies Used

- Python
- Flask
- HTML
- CSS
- JavaScript
- REST APIs
- LLM APIs
- JSON
- PDF/DOCX/XLSX Processing

## Supported LLM Providers

AgentHub is designed to support configurable LLM providers, including:

- OpenAI-compatible providers
- Groq
- Gemini
- Claude
- Ollama

## Project Structure

```text
AgentHub/
│
├── app.py
├── repo_parser.py
├── requirements.txt
│
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
│
├── templates/
│   └── index.html
│
├── data/
├── runs/
├── tmp/
└── uploads/
```

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/SankarapuKavya/AgentHub.git
```

### 2. Navigate to the project

```bash
cd AgentHub
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the application

```bash
python app.py
```

### 5. Open in browser

```text
http://127.0.0.1:5000
```

## API

The application provides REST API endpoints for managing agents, workflows, files, settings, and execution history.

Examples include:

```text
/api/settings
/api/agents
/api/super_agents
/api/files
/api/runs
```


## Author

**Kavya Sankarapu**

Computer Science and Engineering

## License

This project is for educational and portfolio purposes.
