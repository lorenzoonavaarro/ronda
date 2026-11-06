# Ronda

A digital ROSCA (Rotating Savings and Credit Association) that helps users save in groups while building credit history and earning better yield.

## Core Concept

Ronda is a modern ROSCA — the formal term for traditional rotating savings groups such as juntas de dinero (Peru), tandas (Mexico), or chamas (East Africa).

In a classic ROSCA, members contribute a fixed amount on a regular schedule and take turns receiving the full pot. Ronda keeps this social savings mechanic and adds two layers that traditional ROSCAs lack:

- **Credit history building** — on-time contributions create a visible, improvable credit score
- **Improved yield** — part of the pooled funds earns interest instead of sitting idle

## Features

### 1. Rotating Group Savings
- Create or join small groups (6–12 people)
- Fixed monthly contribution
- One member receives the full pot each cycle
- Clear view of current cycle, members, and payment status

### 2. Credit History Building
- Tracks on-time contributions
- Personal credit score that improves with consistency
- Streak tracking
- Early payouts treated as short-term loans repaid through future contributions

### 3. Improved Savings Yield
- Part of the pooled money earns interest (high-yield or simulated)
- Yield is shared with the group or shown as a bonus
- Transparent breakdown of earning vs. available funds

### 4. PayPal-powered Money Movement
- Collect monthly contributions
- Send the pot to the current recipient
- Full transaction history
- Real-time payment status

### 5. AI Layer
- Risk scoring for group matching
- Suggested fair payout order
- Personalized coaching messages
- Early warnings for potential late payments
- Credit progress explanations

## Tech Stack

### Web App (Next.js)
- Next.js (App Router)
- shadcn/ui + Tailwind CSS
- Clean Architecture (feature-first) on the frontend where practical

### Backend (NestJS)
- DDD + Clean Architecture
- TypeScript

### PayPal Tools
- **Orders API** — collect monthly contributions
- **Payouts API** — send the pot to the current recipient
- **Webhooks** — real-time payment and payout status updates

### Sponsor Tools
- **APIMatic** — Context Plugin for accurate PayPal API code generation
- **Render** — deploy and host the NestJS backend
- **Postman** — test PayPal APIs during development

### AI
- Scoring logic (risk, credit, payout order)
- Optional: PayPal Agent Toolkit
