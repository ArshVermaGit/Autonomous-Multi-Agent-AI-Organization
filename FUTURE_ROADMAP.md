# Future Roadmap (Post-Hackathon)

This document outlines the strategic vision and technical roadmap for the **Autonomous Multi-Agent AI Organization** following the **Amazon Nova AI Hackathon** (after March 17, 2026).

## Post-Submission Objectives

- [ ] **SaaS Scaling**: Transition from Single-Node Docker Compose to a multi-node Kubernetes cluster (EKS) for production scale.
- [ ] **Advanced Cloud Infrastructure**: Re-enable full Terraform automation for ECS Fargate, RDS (Aurora), and MSK managed services.
- [ ] **Multi-Model Expert Scoring**: Refine the Rust-based MoE (Mixture of Experts) scoring engine to dynamically route between providers based on real-time performance and cost metrics.
- [ ] **Integrated Billing**: Implement the Finance Agent's full SaaS billing and subscription logic using Stripe.

---

## Ultra-Budget Deployment (SaaS Path)

*The following content was originally detailed in `SAAS_BUDGET_ROADMAP.md` and remains the primary plan for a low-cost SaaS rollout.*

Deploying a multi-agent system with Kafka, Postgres, Redis, and a Go+Next.js microservice architecture usually costs **₹20,000 to ₹40,000+ per month** on managed AWS.

**Proposal**: Use a Single-Node Docker Compose approach on **Oracle Cloud "Always Free" Ampere A1 Compute** (4 Cores, 24GB RAM).

### Phase 1: Infrastructure & Domain (Cost: ~₹500 - ₹800 / year)

1. **Oracle Cloud**: Always Free ARM instance (24GB RAM). Ubuntu 22.04.
2. **Domain**: Cheap `.in` or `.xyz` domain (~₹500/year).
3. **Cloudflare** Cost: 100% Free Forever.
for DNS and SSL.

### Phase 2: Server Prep (Cost: ₹0)

- Install Docker / Docker Compose.
- Clone repository.
- Configure Swapfile (4GB).

### Phase 3: Setup Google Auth & HTTPS (Cost: ₹0)

- Set Authorized Redirect URI: `https://your-domain.in/v1/auth/google/callback`.

### Phase 4: Launch (Cost: ₹0)

- Configure `AUTH_DISABLED=false` and Google OAuth credentials.
- Run: `docker-compose -f go-backend/deploy/docker-compose.yml up -d --build`.

---

## Long-Term Vision

Beyond the initial SaaS rollout, we aim to build:

- **Autonomous Self-Healing**: Agents that detect their own infrastructure failures and fix them via DevOps Agent.
- **Visual Intelligence**: Full integration of Nova's multimodal capabilities for Frontend Agents to "see" and "critique" their own UI designs.
- **Universal LLM Adapter**: A zero-latency proxy for all foundation models.
