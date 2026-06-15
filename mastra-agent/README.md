# Mastra AI Agents & Studio Platform

This is a TypeScript-based AI Agent platform built using the **Mastra.ai** framework. It comes with a built-in visual admin dashboard called **Mastra Studio** for testing and debugging.

## 🤖 Integrated Agents
1. **AI Hiring Copilot:** Evaluates candidates and matches resumes against job descriptions.
2. **Personal Finance & Debt Advisor:** Compares Snowball vs. Avalanche payoff strategies and allocates budgets.
3. **Legal Document Review Agent:** Audits contracts for clauses, risk indicators, and protective gaps.
4. **Student Document Solver:** Breaks down educational homework, lessons, and calculus queries step-by-step.

---

## 🚀 Getting Started & Mastra Studio UI

### 1. Configure API Key
Rename `.env.example` to `.env` or set up the environment:
```env
OPENAI_API_KEY=your_openai_api_key
```

### 2. Boot Services via Docker Compose
Build and run the services inside containerized environments:
```bash
docker compose up --build
```
This launches:
* **Mastra Studio (Visual UI Console):** Running on `http://localhost:5678`
* **Mastra API Server:** Running on `http://localhost:4000`
* **Qdrant DB Instance:** Running on port `6335`

---

## 🎨 Testing via Mastra Studio UI
1. Once running, open **`http://localhost:5678`** in your browser.
2. You will be greeted by the **Mastra Studio** console.
3. Go to the **Agents** tab on the sidebar.
4. Select any of your registered agents (e.g. `hiringCopilotAgent` or `legalAgent`).
5. Type your inputs and talk directly to the agent in the interactive chat window!