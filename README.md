# Autonomous Multi-Agent AI Organization

> A production-grade, event-driven, AWS/Kubernetes-deployable system where AI agents autonomously build and deploy real software from a single business idea.

---

## 🚀 Key Features & Evolution

This project has evolved significantly from a sequential terminal script into a distributed, event-driven AI mesh architecture.

* **Google Gemini 2.5 Flash Core**: Replaced legacy providers with real-time, low-latency Gemini API interactions.
* **Event-Driven Agent Communication**: Agents (`CEO`, `CTO`, `Engineer`, `QA`, `DevOps`) now communicate asynchronously via **Kafka** (`messaging/kafka_client.py`).
* **High-Performance Routing (Rust)**: Included a Rust-based Mixture-of-Experts (MoE) scoring and routing engine (`moe-scoring/`) for lightning-fast sub-task delegation.
* **Kubernetes Native**: Fully deployable via helm charts (`infra/helm/ai-org/`).
* **Docker Workspace Sandboxing**: Execution of dynamic code testing and compilation is pushed into secure `docker` containers to protect host systems.
* **Next.js Dashboard**: Real-time observability UI for tracking AI agent metrics.

---

## 🔮 Upcoming Architectural Roadmap

Based on recent deep analyses of leading open-source agent frameworks (`hive`, `moltbot`, `cli`), our roadmap includes:

1. **Agent Rewinding & Checkpointing**: Implementing a shadow Git branch tracker (inspired by `cli`) to allow instant rollback of agent states if they spiral off course.
2. **Adaptive Self-Healing Loops**: Replacing static pipelines with a Goal-Driven Graph that automatically recalculates and retries on QA/DevOps failure (inspired by `hive`).
3. **Unified Control Gateway**: Moving beyond the CLI to a WebSockets-based Gateway exposing agents to Discord, Slack, and other channels (inspired by `moltbot/OpenClaw`).

---

## 🛠️ Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> "Autonomous Multi-Agent AI Organization"
cd "Autonomous Multi-Agent AI Organization"

# 2. Setup Environment Variables
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY, KAFKA_BROKERS, etc.

# 3. Quick Run (Docker)
docker-compose up --build

# 4. Access the Dashboard
open http://localhost:3000
```

---

## 🏗️ Architecture Layout

```text
├── agents/                # AI Agent Python implementations (CEO, CTO, Engineer, QA)
├── api/                   # FastAPI backend gateway
├── frontend/              # Next.js Dashboard
├── infra/                 # Infrastructure as Code
│   ├── helm/              # Kubernetes Helm Charts (ai-org)
│   └── terraform/         # AWS resource definitions
├── messaging/             # Kafka clients & event schemas
├── moe-scoring/           # Rust-based high-performance Expert routing Engine
├── tools/                 # Execution Tools (Git, Terminal, Sandboxing)
├── memory/                # Context & artifact retention 
└── tmp_repos/             # Analysis sandboxes for framework research
```

---

## 👥 Agents & Responsibilities

| Agent | Responsibility | Core Tools |
|-------|---------------|-------|
| **CEO** | Strategy, Vision mapping, User interactions | Planning |
| **CTO** | Architecture planning, tech stack, delegation | Design, Schema generators |
| **Engineer** | Writing actual application code | Git, Linters, Bash Sandboxes |
| **QA** | Testing, Static Analysis, Verification | Pytest, coverage, rustc |
| **DevOps** | Deployment pipelines, containerization | Docker, Kubernetes, AWS CLI |
| **Finance** | Cloud cost tracking & limits | Cost estimation APIs |

---

## 🛡️ Security & Sandboxing

* **Execution Sandboxes:** Agents execute code within temporary isolated Docker containers.
* **API Key Management:** Keys are injected via Kubernetes Secrets / AWS Secrets Manager.
* **Least Privilege:** AI agents strictly receive only the tools necessary for their explicitly defined scoped tasks.
