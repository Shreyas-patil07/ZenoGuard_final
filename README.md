# ZenoGuard — AI-Powered Blockchain Micro-Insurance

> End-to-end micro-insurance platform for gig workers combining AI-assisted risk and claim verification, a FastAPI backend, PostgreSQL, digital payments, and blockchain-backed policy/claim state.

## Why this project

ZenoGuard is designed for delivery riders, cab drivers, and freelance couriers who face variable income and work-related risks. The system connects onboarding, KYC, personalized pricing, policy management, work sessions, claims, verification, payments, and blockchain state into one application.

## System Architecture

```text
React Frontend
      │ REST / Axios
      ▼
FastAPI Backend
      ├── PostgreSQL
      ├── ML / AI Services
      │     ├── Risk / Premium Model
      │     ├── Claim Verification
      │     └── DL Detection + OCR
      ├── Cloudinary
      ├── Razorpay / RazorpayX
      └── web3.py / JSON-RPC
                    │
                    ▼
            Solidity Contracts
```

## Engineering Highlights

- **Full-stack architecture:** React frontend connected to FastAPI services through REST APIs.
- **Backend engineering:** PostgreSQL-backed application state with SQLAlchemy, migrations, Pydantic schemas, and JWT authentication.
- **AI-assisted workflows:** Risk/pricing signals, claim verification, driving-licence field detection, and OCR-assisted extraction.
- **Blockchain integration:** Solidity contracts connected through a `web3.py` gateway for policy and claim state.
- **Payment integration:** Razorpay for premium collection and RazorpayX for INR payout workflows.
- **Security-minded design:** Sensitive documents and large evidence files remain off-chain; blockchain stores the identifiers/state needed for verifiable execution.

## End-to-End Flow

```text
Register → Authenticate → Driving Licence KYC
        ↓
Risk / Premium Calculation
        ↓
Plan Selection → Premium Payment
        ↓
Policy State → PostgreSQL + Blockchain
        ↓
Work Session / Earnings
        ↓
Accident / Breakdown / Weather Event
        ↓
Claim Submission → Automated Verification
        ↓
VALID / REVIEW / REJECT
        ↓
VALID → Blockchain Authorization → Eligible Payout
```

## Core Modules

| Module | Implementation |
|---|---|
| Rider onboarding | React + FastAPI + JWT |
| KYC | Driving Licence detection + OCR |
| Premium engine | ML signal + deterministic pricing logic |
| Policy management | PostgreSQL + blockchain policy record |
| Payments | Razorpay / RazorpayX |
| Claims | Accident, breakdown, and weather workflows |
| Claim verification | Rules, evidence, and anomaly signals |
| Blockchain | Solidity + web3.py + JSON-RPC |
| Company view | Insurer/company interface |

## Blockchain Layer

The repository contains five core contracts:

- `DriverRegistry.sol` — driver registration
- `SafetyScoreOracle.sol` — safety-score state
- `InsurancePolicy.sol` — policy state
- `InsurancePool.sol` — insurance-pool state
- `ClaimManager.sol` — claim submission and authorization state

The backend `web3.py` gateway handles RPC connectivity, contract ABIs/addresses, transaction construction, signing, and receipt confirmation.

> A live blockchain transaction still requires the appropriate RPC endpoint, deployed contract addresses, signer configuration, and environment variables.

## AI / ML Layer

The system uses AI/ML as an input to decision-making rather than as an unconstrained payout controller. Examples include:

- Personalized risk and premium estimation
- Claim evidence analysis and anomaly signals
- Driving-licence field detection
- OCR-assisted extraction and profile matching

Explicit application and policy rules remain responsible for eligibility and authorization conditions.

## Tech Stack

**Frontend:** React, Vite, React Router, Tailwind CSS, Axios  
**Backend:** FastAPI, SQLAlchemy, Alembic, Pydantic, JWT  
**Database:** PostgreSQL  
**AI/ML:** scikit-learn, pandas, NumPy, joblib, Ultralytics YOLO, Tesseract OCR  
**Blockchain:** Solidity, Hardhat, ethers.js, OpenZeppelin, web3.py  
**Payments:** Razorpay, RazorpayX  
**Storage:** Cloudinary

## Repository Structure

```text
frontend/      React application and user interfaces
backend/       FastAPI application, routers, services, models, and migrations
ml/            Premium and claim-fraud components
blockchain/    Solidity contracts, deployment scripts, and tests
```

## Getting Started

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
python scripts/migrate_postgres.py
uvicorn app.main:app --reload
```

API documentation is available at `http://127.0.0.1:8000/docs` when the backend is running.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Configure the frontend API URL with:

```env
VITE_API_URL=http://127.0.0.1:8000
```

### Blockchain

```bash
cd blockchain
npm install
npx hardhat compile
npx hardhat test
```

For a configured testnet deployment, use the repository's deployment scripts and environment configuration.

## Responsible Engineering Notes

This is a project prototype. Automated KYC, risk, fraud/anomaly analysis, and blockchain workflows should be treated as engineering components rather than authoritative real-world decisions. Production deployment would require appropriate security review, privacy controls, model validation, monitoring, and payment/blockchain configuration.
