# ZenoGuard

## AI-Powered Blockchain Micro-Insurance for Gig Workers

> **HackLabs 2026 · Problem Statement 1**
>
> **AI × Automated Verification × Smart Contracts × Digital Payments**

ZenoGuard is an end-to-end micro-insurance platform designed for gig workers such as delivery riders, cab drivers and freelance couriers. It combines personalized risk-based pricing, automated KYC and claim verification, digital payments, PostgreSQL-backed policy state, and blockchain-enforced policy/claim settlement.

The platform is built as a connected system rather than a collection of isolated demos:

```text
React Frontend
      │
      │ REST / Axios
      ▼
FastAPI Backend
      │
      ├──────────────► PostgreSQL
      │
      ├──────────────► ML / AI Services
      │                 ├─ Premium / Risk Model
      │                 ├─ Claim Verification
      │                 └─ DL Detector + OCR
      │
      ├──────────────► Cloudinary
      │                 └─ KYC / claim evidence storage
      │
      ├──────────────► Razorpay / RazorpayX
      │                 └─ Premium payment / INR payout rail
      │
      └──────────────► web3.py
                        │ JSON-RPC
                        ▼
                 Solidity Smart Contracts
                        ├─ DriverRegistry
                        ├─ SafetyScoreOracle
                        ├─ InsurancePolicy
                        ├─ InsurancePool
                        └─ ClaimManager
```

---

## 🚀 Solution Showcase

| Module | Implementation | Integration |
|---|---|---|
| Rider onboarding | React + FastAPI + JWT | ✅ Connected |
| KYC | Driving Licence-only AI verification | ✅ Connected |
| DL detection | Local `dl_detector.pt` + OCR | ✅ Backend integrated |
| Premium engine | ML + deterministic risk/pricing engine | ✅ Backend integrated |
| Policy management | PostgreSQL + blockchain policy record | ✅ Connected |
| Payments | Razorpay / RazorpayX | ✅ Backend integrated |
| Work sessions | Location/time/activity tracking | ✅ Backend integrated |
| Claims | Accident / breakdown / weather | ✅ Connected |
| Claim verification | Rules + evidence + anomaly analysis | ✅ Connected |
| Blockchain claims | ClaimManager synchronization | ✅ Connected |
| Smart-contract authorization | Verify → authorize → payout eligibility | ✅ Connected |
| On-chain policy state | InsurancePolicy | ✅ Connected |
| On-chain premium pool | InsurancePool | ✅ Connected |
| Driver registry | DriverRegistry | ✅ Connected |
| Safety score | SafetyScoreOracle | ✅ Connected |
| Insurer/company view | Company interface | ✅ Implemented |

> **Important:** "Connected" means the application contains the integration path in the repository. A live blockchain transaction still requires the RPC endpoint, deployed contract addresses, signer and other environment variables to be configured correctly.

---

# 1. The Problem

Gig workers face variable income and unpredictable work-related risks. Traditional insurance is often built around fixed-income customers, longer policy periods and manual claim processing.

### ZenoGuard addresses this with

- **Variable-income pricing** — recent earnings are a primary pricing input.
- **Risk-aware premiums** — work, vehicle, location, activity and claim-history signals influence risk.
- **Automated evidence verification** — claims are checked using policy, timestamp, location, work-session and incident evidence.
- **Fraud/anomaly controls** — duplicate, inconsistent and suspicious claims are detected.
- **Blockchain-backed policy state** — policy and claim identifiers are synchronized with smart contracts.
- **Automated contract authorization** — verified claims can be authorized through `ClaimManager` before the INR payout rail is triggered.

---

# 2. End-to-End Product Flow

```text
REGISTER
   ↓
AUTHENTICATE RIDER
   ↓
DRIVING LICENCE KYC
   ↓
dl_detector + OCR + credential matching
   ↓
RISK / PREMIUM CALCULATION
   ↓
SELECT PLAN + DURATION
   ↓
RAZORPAY PREMIUM PAYMENT
   ↓
POLICY CREATED IN POSTGRES
   ↓
POLICY SYNCHRONIZED ON-CHAIN
   ↓
WORK SESSION + EARNINGS
   ↓
ACCIDENT / BREAKDOWN / WEATHER EVENT
   ↓
CLAIM SUBMITTED
   ↓
AUTOMATED CLAIM VERIFICATION
   ↓
VALID / REVIEW / REJECT
   ↓
VALID CLAIM → ClaimManager
   ↓
BLOCKCHAIN VERIFY + AUTHORIZE
   ↓
ELIGIBLE PAYOUT
   ↓
RAZORPAYX INR PAYOUT
   ↓
CLAIM + BENEFIT HISTORY UPDATED
   ↓
NEXT RISK / RENEWAL CYCLE
```

This is the core ZenoGuard architecture: **AI determines and validates risk/evidence; explicit business rules constrain the decision; blockchain records and enforces the on-chain policy/claim state; Razorpay handles real-world INR movement.**

---

# 3. AI-Powered Personalized Insurance

ZenoGuard separates the ML risk estimate from deterministic pricing logic so the premium remains explainable and controlled.

### Pricing inputs

- Recent earnings
- Income consistency / volatility
- Work activity
- Worker category / platform
- Vehicle information
- Location and exposure risk
- Working hours / night-work ratio
- Safety score
- Validated claim history
- Claim frequency and severity
- Selected coverage
- Selected duration

### Pricing pipeline

```text
Recent Earnings
      ↓
Risk Features
      ↓
ML Risk Estimate
      ↓
Income Adjustment
      ↓
Coverage Adjustment
      ↓
Duration Adjustment
      ↓
Final Personalized Premium
```

Conceptually:

```text
Final Premium
= Risk Cost
× Income Factor
× Coverage Factor
× Duration Factor
+ Pricing Loadings
```

The implementation keeps AI as a risk/pricing signal rather than allowing an unconstrained model to directly control policy execution.

---

# 4. Insurance Plans

| Plan | Accident | Breakdown | Weather | Positioning |
|---|---:|---:|---:|---|
| Basic | ₹2,500 | ₹750 | ₹500 | Lower-cost protection |
| Standard | ₹5,000 | ₹1,500 | ₹1,000 | Regular gig workers |
| Plus | ₹10,000 | ₹3,000 | ₹2,000 | Higher coverage requirement |

### Available durations

- **7 days** — short-term protection
- **30 days** — standard monthly protection
- **90 days** — longer-duration protection

---

# 5. KYC — Driving Licence Only

The current product flow intentionally uses **Driving Licence as the only identity document**.

```text
Frontend Profile
      ↓
Upload Driving Licence
      ↓
Cloudinary document storage
      ↓
POST /kyc/submit
      ↓
dl_detector.pt
      ↓
Detected fields
      ├─ Name
      ├─ DL number
      └─ DOB
      ↓
OCR
      ↓
Cross-check against rider profile
      ↓
Verification result
```

### DL AI stack

- Local YOLO-based `dl_detector.pt`
- CPU inference supported
- Field detection for name, DL number and DOB
- OCR fallback using Tesseract
- DL number normalization and matching
- Name consistency check
- DOB extraction and matching
- Detection confidence tracking

The backend loads the model from:

```text
backend/models/dl_detector.pt
```

The frontend does **not** receive the model or any model/API secret. Verification is executed by the backend.

> This is an automated document consistency check, not an authoritative government authenticity service.

---

# 6. Claims Engine

Supported insured event types:

- `accident`
- `breakdown`
- `weather`

A claim is first evaluated by the backend verification engine. Only a `VALID` claim enters the blockchain authorization path.

### Verification signals

- Active policy
- Policy period
- Event timestamp
- Event location
- Work-session context
- Incident evidence
- Vehicle context
- Claim history
- Duplicate claim detection
- Anomaly/inconsistency signals

### Claim states

```text
VALID
REVIEW
REJECT
```

The architecture intentionally keeps the AI/risk output as a signal. Explicit policy and eligibility rules remain responsible for the final authorization conditions.

---

# 7. Blockchain Integration

ZenoGuard uses Solidity smart contracts and a backend `web3.py` gateway to connect the application to an Ethereum-compatible network.

### Active contracts

| Contract | Responsibility |
|---|---|
| `DriverRegistry.sol` | Registers riders/drivers on-chain |
| `SafetyScoreOracle.sol` | Stores trusted off-chain-computed safety scores |
| `InsurancePolicy.sol` | Creates and tracks on-chain policies |
| `InsurancePool.sol` | Holds the on-chain insurance pool / payout funds |
| `ClaimManager.sol` | Handles claim submission, verification, authorization and payout state |

### Backend → Blockchain bridge

```text
FastAPI
  │
  ▼
web3_gateway.py
  │
  ├─ RPC connection
  ├─ Contract ABI
  ├─ Contract addresses
  ├─ Backend signer
  ├─ Transaction building
  ├─ Transaction signing
  └─ Receipt confirmation
  │
  ▼
Ethereum-compatible RPC
  │
  ▼
Smart Contracts
```

The backend exposes:

```text
GET  /contract/status
POST /contract/driver/register
POST /contract/policy/purchase
GET  /contract/policy/{policy_id}
POST /contract/claim/submit
POST /contract/claim/authorize
GET  /contract/claim/{claim_id}
```

`/contract/status` reports RPC connectivity, configured contract addresses, network chain ID and backend signer configuration.

---

# 8. Policy → Blockchain Connection

After the corresponding premium payment is confirmed, the backend can synchronize the policy with `InsurancePolicy`.

The PostgreSQL policy stores blockchain references including:

```text
blockchain_policy_id
purchase_tx_hash
blockchain_status
```

The backend then reads the on-chain policy and synchronizes its active/start/end state back into the application.

```text
Razorpay Premium = PAID
        ↓
FastAPI
        ↓
web3_gateway.purchase_policy_for()
        ↓
InsurancePolicy.purchasePolicyFor()
        ↓
Blockchain receipt
        ↓
blockchain_policy_id + purchase_tx_hash
        ↓
PostgreSQL policy marked CONFIRMED
```

This prevents the application from treating a policy as blockchain-confirmed merely because a database record exists.

---

# 9. Claim → Blockchain → Payout Connection

The claim integration is designed as a connected chain rather than a simulated blockchain flag.

```text
Claim Submitted
      ↓
ML / Rule Verification
      ↓
VALID
      ↓
Check blockchain policy
      ↓
ClaimManager.submitClaimFor()
      ↓
blockchain_claim_id
      ↓
submit_tx_hash
      ↓
ClaimManager verification
      ↓
ClaimManager authorization
      ↓
AUTHORIZED
      ↓
RazorpayX INR payout
```

The claim record stores:

```text
blockchain_claim_id
submit_tx_hash
payout_tx_hash
blockchain_status
```

The backend claim flow is explicitly designed so a claim cannot be blockchain-authorized before it has passed the application verification stage.

---

# 10. Blockchain vs Database vs Payment Rail

ZenoGuard deliberately separates responsibilities.

| Layer | Responsibility |
|---|---|
| PostgreSQL | Application state, profiles, policies, claims, payouts and audit metadata |
| Cloudinary | KYC documents and claim evidence files |
| ML services | Risk, premium, document and claim analysis |
| Blockchain | Verifiable policy/claim state and contract-enforced authorization |
| Razorpay | Premium payment / payment collection |
| RazorpayX | Real-world INR payout rail |
| Frontend | Rider and insurer user experience |
| FastAPI | Orchestration and business rules |

**Sensitive personal information, GPS history and large evidence files are not placed directly on-chain.** Blockchain stores the state/identifiers needed for verifiable policy execution.

---

# 11. Fraud & Anomaly Controls

The claim verification architecture supports:

- Duplicate claim detection
- Duplicate evidence detection
- Location inconsistency
- Timestamp inconsistency
- Impossible movement patterns
- Abnormal claim frequency
- Evidence inconsistency
- Historical claim-pattern analysis

The design rule is:

> **AI provides risk/anomaly signals; explicit policy rules constrain the payout decision.**

---

# 12. Why Blockchain?

ZenoGuard uses blockchain where verifiability and deterministic enforcement add value:

- Tamper-evident policy state
- Verifiable policy and claim transactions
- On-chain policy identifiers
- On-chain claim identifiers
- Contract-enforced benefit limits
- Duplicate-payout protection
- Policy-active checks
- Covered-event checks
- Authorized-claim checks
- Independent transaction verification on the configured network

---

# 13. Why AI?

AI/ML is used for the parts of insurance that benefit from probabilistic analysis:

- Personalized premium/risk estimation
- Variable-income analysis
- Claim evidence analysis
- Document field detection
- OCR-assisted credential extraction
- Fraud/anomaly signals
- Explainable pricing factors

Blockchain and deterministic rules then handle the parts that require predictable execution.

---

# 14. Repository Architecture

```text
ZenoGuard_final/
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Signup.jsx
│       │   ├── KYC.jsx
│       │   ├── Wallet.jsx
│       │   └── Company.jsx
│       ├── Profile.jsx
│       ├── WalletPayments.jsx
│       └── App.jsx
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── kyc.py
│   │   │   ├── claims.py
│   │   │   ├── contract.py
│   │   │   ├── wallet.py
│   │   │   ├── premium.py
│   │   │   ├── earnings.py
│   │   │   ├── sessions.py
│   │   │   ├── payments.py
│   │   │   └── webhooks.py
│   │   └── services/
│   │       ├── document_verification.py
│   │       ├── claim_verification.py
│   │       ├── risk_engine.py
│   │       ├── ml_service.py
│   │       ├── razorpay_service.py
│   │       └── web3_gateway.py
│   │
│   ├── models/
│   │   └── dl_detector.pt
│   └── scripts/
│
├── ml/
│   ├── premium/
│   └── claim_fraud/
│
└── blockchain/
    ├── contracts/
    │   ├── DriverRegistry.sol
    │   ├── SafetyScoreOracle.sol
    │   ├── InsurancePolicy.sol
    │   ├── InsurancePool.sol
    │   └── ClaimManager.sol
    ├── scripts/
    └── test/
```

---

# 15. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, React Router, Tailwind CSS, Axios |
| Backend | FastAPI, SQLAlchemy, Alembic, Pydantic, JWT |
| Database | PostgreSQL |
| AI / ML | scikit-learn, pandas, numpy, joblib, Ultralytics YOLO, Tesseract OCR |
| Blockchain | Solidity, Hardhat, ethers.js, OpenZeppelin |
| Web3 bridge | web3.py + JSON-RPC |
| Payments | Razorpay + RazorpayX |
| Storage | Cloudinary |
| Authentication | JWT |

---

# 16. Getting Started

## Backend

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

API documentation:

```text
http://127.0.0.1:8000/docs
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Set:

```env
VITE_API_URL=http://127.0.0.1:8000
```

## Blockchain

```bash
cd blockchain
npm install
npx hardhat compile
npx hardhat test
```

For a live testnet deployment, configure the network in `.env` and deploy:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Then configure the deployed addresses in the backend environment.

---

# 17. Required Backend Environment

The exact deployment values depend on the environment, but the Web3 integration expects values such as:

```env
WEB3_RPC_URL=
WEB3_CHAIN_ID=
INSURANCE_COMPANY_PRIVATE_KEY=

DRIVER_REGISTRY_ADDRESS=
SAFETY_SCORE_ORACLE_ADDRESS=
INSURANCE_POOL_ADDRESS=
INSURANCE_POLICY_ADDRESS=
CLAIM_MANAGER_ADDRESS=
```

Other services use:

```env
DATABASE_URL=
SECRET_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAYX_ACCOUNT_NUMBER=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Never commit

- Private keys
- API secrets
- Database passwords
- Cloudinary secrets
- Razorpay secrets
- JWT secrets

Use `.env.example` templates instead.

---

# 18. Blockchain Verification Checklist

Before calling the deployment **live**, verify:

```text
[ ] WEB3_RPC_URL configured
[ ] Correct WEB3_CHAIN_ID configured
[ ] All 5 contract addresses configured
[ ] Backend signer configured
[ ] RPC /contract/status returns rpc_connected=true
[ ] Driver registration transaction succeeds
[ ] Policy purchase transaction succeeds
[ ] blockchain_policy_id is stored
[ ] purchase_tx_hash is stored
[ ] Claim submission creates blockchain_claim_id
[ ] submit_tx_hash is stored
[ ] Claim authorization succeeds
[ ] authorize transaction is confirmed
[ ] RazorpayX payout succeeds when configured
```

This checklist is deliberately included so the README does not confuse **code integration** with a claim of a live transaction that has not actually been verified.

---

# 19. PS1 Requirement Mapping

| PS1 requirement | ZenoGuard implementation |
|---|---|
| AI premium based on recent earnings | ML-assisted personalized premium engine |
| Income-aware pricing | Controlled income factor in pricing engine |
| Automatic accident verification | Policy + timestamp + location + work activity + evidence + anomaly checks |
| Automatic breakdown verification | Vehicle/evidence + policy + location/time validation |
| Extreme-weather verification | Weather + geographic + time + work-state + policy validation |
| Fraud detection | Duplicate and anomaly analysis |
| Smart-contract payout | ClaimManager authorization + InsurancePool / policy checks |
| Automatic payout | Blockchain authorization followed by configured RazorpayX payout rail |
| Fair / explainable AI | Explicit pricing factors and deterministic pricing logic |
| Verifiable blockchain state | On-chain policy and claim IDs + transaction hashes |
| End-to-end demo | Registration → pricing → payment → policy → event → verification → blockchain → payout |

---

# 20. Demo Scenario

A clean demonstration can follow this sequence:

### Step 1 — Rider onboarding

Create a gig-worker account and authenticate.

### Step 2 — Driving Licence KYC

Upload the rider's Driving Licence and save the profile credentials.

On **Submit for verification**:

```text
DL image
 → dl_detector
 → OCR
 → DL number match
 → name match
 → DOB match
 → KYC result
```

### Step 3 — Earnings and risk

Enter recent earnings and worker/risk information.

### Step 4 — Premium

Run the ML-assisted pricing engine and show the premium factors.

### Step 5 — Policy purchase

Select a plan and duration, complete the configured payment flow, and create the policy.

### Step 6 — Blockchain policy record

Synchronize the policy with `InsurancePolicy` and display:

```text
Blockchain Policy ID
Transaction Hash
Blockchain Status
```

### Step 7 — Controlled claim

Submit an accident/breakdown/weather scenario with evidence.

### Step 8 — Automated verification

Show the verification result and claim status.

### Step 9 — Blockchain authorization

For a `VALID` claim:

```text
ClaimManager.submitClaim
        ↓
Claim verification
        ↓
ClaimManager.authorizeClaim
```

### Step 10 — Payout

The eligible amount is released through the configured payout rail and the claim record retains the transaction references.

---

# 21. Design Principle

ZenoGuard is intentionally **not** "AI decides everything" and it is not "blockchain stores everything."

Instead:

```text
AI / ML
  → estimates risk and analyzes evidence

Business Rules
  → enforce eligibility and policy constraints

PostgreSQL
  → maintains application state

Blockchain
  → provides verifiable policy / claim execution state

Razorpay / RazorpayX
  → moves real-world INR
```

This separation makes the system easier to explain, test and audit.

---

# 22. Final Product Positioning

> **ZenoGuard turns variable gig-worker income into personalized insurance pricing and turns verified claims into transparent, blockchain-backed payouts.**

### EARN → PRICE → PROTECT → VERIFY → PAY

Built for **HackLabs 2026 — Problem Statement 1**.

---

## Team

**Numero Uno**

---

## License

No open-source license is currently specified. Add a license file before distributing the project publicly under an open-source license.
