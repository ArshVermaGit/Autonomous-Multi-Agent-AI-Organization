# Amazon Nova AI Hackathon Roadmap: Project "Aden-Nova"

## 1. Hackathon & Amazon Nova Overview
**Goal:** Transform the existing Autonomous Multi-Agent AI Organization into an elite, head-to-head competitor to platforms like Aden-Hive and Devin, powered exclusively by the new **Amazon Nova** foundation models.

### The Arsenal: Amazon Nova Models Available
1. **Nova 2 Lite**: The workhorse. Extremely fast, 1M token context window, built-in controls for "thinking effort," and native support for **Code Interpreter**, **Web Grounding**, and **Remote MCP (Model Context Protocol)**. Perfect for our standard Agent nodes (Engineer, QA, DevOps).
2. **Nova 2 Pro (Preview)**: The heavy lifter. Designed for complex multi-step reasoning and long-range planning. This will act as our Orchestrator / CEO Agent.
3. **Nova 2 Omni (Preview)**: Multimodal reasoning (Native Text/Image/Video inputs & outputs).
4. **Nova 2 Sonic**: Speech-to-speech AI. (Optional, but could be a killer feature to allow users to "talk" to the terminal).
5. **Nova Multimodal Embeddings**: A single embedding model that handles text, documents, images, and video. We will use this to replace our current embedding setup in the Rust `moe-scoring` microservice for blazing-fast semantic search across the workspace.
6. **Amazon Nova Act**: A specialized AWS service that executes natural language commands directly on UIs/Browsers using `nova.act()`.

### Hackathon Specifics & Bounties
- **Core Requirement:** Must use Amazon Nova models (via Amazon Bedrock or nova.amazon.com/dev).
- **Free Credits:** We can apply for $100 in AWS Promotional Credits to cover Bedrock costs.
- **Bonus Prize 1 (Feedback):** Submit a feedback report to Amazon on how to improve Nova models.
- **Bonus Prize 2 (Blog Post):** Write a blog post on `builder.aws.com` explaining how our project positively impacts the developer community.

---

## 2. Strategic Upgrades (Beating Aden-Hive)

To make a true Aden-Hive competitor that opens from the terminal and executes fully autonomous tasks (report writing, building websites, analyzing research papers), we need to implement the following architectural shifts:

### A. The "Aden-Hive" Local Experience
- **CLI Launcher:** Wrap the startup script in a clean CLI. When the user types `nova-hive start`, it boots the Go-backend, Rust scoring, and Python Agents via Docker, and instantly opens a native macOS/Linux window (via Tauri/Electron or just an app-mode Chrome window) displaying the Next.js Dashboard.
- **Live Terminal Visualization:** The Next.js dashboard must stream real-time execution logs. When the "Engineer Agent" creates a React component, the user should physically see the code being written and terminal commands being safely executed.

### B. Swapping the Brain to Amazon Nova
- **LLM Client Refactor:** Strip out Gemini/OpenAI SDKs in `agents/model_registry.py` and replace them with `boto3` (Amazon Bedrock). 
- **Leveraging Nova's "Thinking controls":** Nova 2 allows us to explicitly set the thinking effort. We will set `effort="high"` for the Architect/Planning agent, and `effort="low"` for fast coding agents.
- **MCP Tooling:** Since Nova 2 Lite natively supports Remote MCP (Model Context Protocol), we can give the agents secure, standardized access to the local filesystem without writing custom, flaky bash-execution tools.

### C. Supercharging Web & UI Tasks with Nova Act
- Right now, web scraping for research papers or UI testing is hard. **Amazon Nova Act** solves this.
- We will integrate Nova Act into our `browser_tool.py`. Instead of writing complex Selenium scripts, our Agent will simply call `nova.act("Go to arxiv.org, search for Q-learning, and extract the abstract of the top 3 papers")`. Nova Act handles the browser automation natively.

---

## 3. Implementation Roadmap (Phases)

### Phase 1: Foundation & Model Cutover (Days 1-2)
- [ ] Get AWS credentials and Bedrock access set up in `.env`.
- [ ] Rewrite `agents/model_registry.py` to use `boto3.client('bedrock-runtime')`.
- [ ] Implement `Nova 2 Lite` for the base agent class.
- [ ] Update the Rust `moe-scoring` vectorizer to use `Amazon Nova Multimodal Embeddings` for calculating routing scores.

### Phase 2: Agentic Tools & MCP Refactor (Days 3-4)
- [ ] Implement the Model Context Protocol (MCP) server in the Go backend to safely expose local files to Nova.
- [ ] Integrate AWS Nova Act API for the `Browser/Research Agent`. This enables the "analyze whole research paper" and "web extraction" requirement flawlessly.

### Phase 3: The "Hive" UI & CLI Experience (Days 5-6)
- [ ] Build a sleek Next.js UI that feels like an IDE/Terminal hybrid.
- [ ] Create a CLI command (`ai-org run`) that opens the dashboard locally and connects to the websocket.
- [ ] Add the "Task Input" box where the user types: "Build me a website using Next.js and Tailwind," and the UI visualizes the Orchestrator breaking it down for the Nova models.

### Phase 4: Hackathon Submissions & Polish (Day 7)
- [ ] Record a 2-3 minute demo video showing a complex workflow (e.g., "Research AWS Nova Act and build me a landing page summarizing it").
- [ ] Write the Devpost Submission.
- [ ] Write the Builder.aws.com blog post to secure the bonus prize.
- [ ] Submit the feedback form to AWS based on our experience with the Bedrock API.
