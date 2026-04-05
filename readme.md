# 🔐 Decoupled Authentication & Authorization on AWS

> A production-pattern Proof of Concept demonstrating complete separation of authentication and authorization concerns using AWS Cognito, OPA (Open Policy Agent), and EKS — transforming security from a *code problem* into an *infrastructure contract*.

---

## 📌 Overview

This repository contains the full POC implementation for a **Decoupled Auth Architecture** on AWS, featuring:

- **Frontend** — React (MERN stack) SPA with Cognito OIDC integration
- **Backend** — Node.js API server with OPA middleware
- **OPA** — Rego policy as a sidecar container
- **K8s** — Kubernetes manifests for EKS deployment

The application simulates an enterprise multi-tenant platform where users authenticate via federated IDPs and are authorized at the policy layer — keeping all access control logic out of business code.

---

## 🏗️ Architecture

```
User Browser
    │
    ├── 1. Auth Request ──────────────────► AWS Cognito (Hosted UI)
    │                                            │
    │                                   Google / Microsoft IDP
    │                                            │
    │                               Pre-Token Generation Lambda
    │                               (injects: roles, tenant_id,
    │                                user_id, auth_method)
    │
    ├── 2. Get Frontend ──► Route 53 ──► External ALB ──► Frontend Pods (EKS)
    │
    └── 3. API Call + JWT ──► API Gateway (JWT Authorizer)
                                    │
                              Validate JWKS
                                    │
                              VPC Link ──► Internal ALB ──► Backend Pod (EKS)
                                                                   │
                                                         ┌─────────┴─────────┐
                                                    Backend Container    OPA Sidecar
                                                         │                   │
                                                         └── localhost:8181 ──┘
                                                              (local query)
```

### Request Flow

| Step | Component | Action |
|------|-----------|--------|
| 1 | Cognito + IDP | Authenticate user, issue JWT with custom claims |
| 2 | Pre-Token Lambda | Inject `roles`, `tenant_id`, `user_id`, `auth_method` |
| 3 | API Gateway | Validate JWT signature via JWKS |
| 4 | Internal ALB | Route to backend pod via VPC Link |
| 5 | OPA Sidecar | Evaluate Rego policy → `allow: true/false` |
| 6 | Backend | Serve response or return `403 Forbidden` |

---

## 📁 Repository Structure

```
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── backend/
│   ├── app/
│   │   └── server.js          # Express server with OPA middleware
│   ├── Dockerfile
│   └── package.json
│
├── opa/
│   ├── policy.rego            # Rego authorization policy
│   └── opa-config.yaml        # OPA runtime configuration
│
└── k8s/
    ├── backend/
    │   ├── deployment.yaml    # Backend + OPA sidecar pod spec
    │   └── service.yaml
    ├── frontend/
    │   ├── deployment.yaml
    │   └── service.yaml
    ├── configmap.yaml          # Mounts Rego policy into cluster (etcd)
    ├── ingress.yaml            # Internal ALB (backend)
    ├── ingress-ext.yaml        # Internet-facing ALB + HTTPS (frontend)
    ├── service-account.yaml    # IRSA annotation for ALB controller
    └── fluent-values.yaml      # FluentBit Helm values (OPA log filtering)
```

---

## 🔑 Authentication Setup (Phase 1)

### AWS Cognito User Pool

Cognito acts as the **Unified Identity Hub** — a single entry gate that translates logins from any IDP into a standardized JWT.

**Federated IDPs configured:**

| Provider | Protocol | Notes |
|----------|----------|-------|
| Google | OAuth2 (native adapter) | Scopes: `openid email profile` |
| Microsoft Entra ID | OIDC | Issuer: `login.microsoftonline.com/9188040d.../v2.0` (common tenant) |
| Cognito native | Email/password | Self-registration enabled |

**Why not Auth0?** For this POC, direct IDP integration was preferred for reduced latency, lower attack surface, cost savings, full protocol transparency, and cleaner Pre-Token Lambda visibility per IDP source.

### Pre-Token Generation Lambda

Triggered at every sign-in (v2, to allow access token modification). Injects custom claims into the access token based on Cognito group membership:

```python
# Claims injected into access token
{
  "user_id":     "<cognito sub>",
  "tenant_id":   "demo-tenant",
  "roles":       ["admin"],        # derived from Cognito group
  "auth_method": "google",         # derived from IDP group name
  "user_name":   "user@email.com"
}
```

**Default role mapping (POC):**

| Sign-in Method | Assigned Role |
|----------------|---------------|
| Google IDP | `admin` |
| Microsoft IDP | `developer` |
| Self sign-up | `viewer` (via Post Confirmation Lambda) |

**Production-grade logic** uses Cognito group membership directly — users can be assigned any role via the `/userManage` API endpoints by a `superAdmin`.

### Token Generation Flow

```
USER → Cognito → IDP → Cognito → Pre-Token Lambda → Cognito issues tokens
                                  (custom claims)    (Identity, Access, Refresh + Auth Code)
                                                           ↓
                                                     Auth Code → USER
                                                           ↓
                                                    USER exchanges for tokens
```

---

## 🛡️ Authorization Setup (Phase 2)

### OPA Policy (`opa/policy.rego`)

The Rego policy is entirely decoupled from application code. It receives `input.roles` and `input.path` and returns `allow: true/false`.

```rego
package httpapi.authz

default allow = false

# Admin → full access to all endpoints
allow if { "admin" in input.roles }

# Developer → /dev only
allow if { "developer" in input.roles; input.path == "/dev" }

# Tester → /tester only
allow if { "tester" in input.roles; input.path == "/tester" }

# Viewer → /viewer only
allow if { "viewer" in input.roles; input.path == "/viewer" }

# SuperAdmin → full access including /userManage
allow if { "superAdmin" in input.roles }
```

### OPA as Sidecar

OPA runs in the **same pod** as the backend container and is queried over `http://localhost:8181`.

**Why sidecar over centralized OPA service?**

| Concern | Sidecar | Centralized |
|---------|---------|-------------|
| Latency | ~microseconds (loopback) | Network hop |
| Failure blast radius | Per-pod | Entire cluster |
| Scalability | Scales with backend pods | Single point of failure |

### Backend Middleware Flow

```
Request arrives at backend
    │
    ├── Extract JWT claims (roles, path)
    │
    ├── POST http://localhost:8181/v1/data/httpapi/authz
    │       { "input": { "roles": [...], "path": "/dev" } }
    │
    ├── { "allow": true }  → proceed to route handler
    └── { "allow": false } → return 403 Forbidden
```

---

## ☸️ Kubernetes Deployment

### EKS Cluster Configuration

- **Kubernetes version:** 1.35
- **Node group:** On-demand EC2 (2 desired, min 2, max 4)
- **Endpoint access:** Public + Private (restricted to admin IP during setup)
- **Add-ons:** AWS VPC CNI, CoreDNS, kube-proxy, Node Monitoring Agent, EKS Pod Identity Agent

### Key K8s Resources

**`k8s/backend/deployment.yaml`** — Defines the backend pod with two containers:
- `backend` — Node.js app on port 3000
- `opa` — OPA sidecar on port 8181, with mounted Rego policy and config volumes

**`k8s/configmap.yaml`** — Loads the Rego policy into the cluster's etcd, mounted as a volume into OPA.

**`k8s/ingress.yaml`** — Creates an **internal ALB** (backend only reachable via API Gateway VPC Link).

**`k8s/ingress-ext.yaml`** — Creates an **internet-facing ALB** for the frontend with HTTPS (ACM certificate + SSL redirect).

### Deployment Commands

```bash
# Set kubectl context
aws eks update-kubeconfig --name opa-eks-cluster --region us-east-1

# Deploy OPA config and policy
kubectl apply -f opa/opa-config.yaml
kubectl apply -f k8s/configmap.yaml

# Deploy backend (with OPA sidecar)
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/backend/service.yaml

# Deploy frontend
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/frontend/service.yaml

# Create load balancers
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/ingress-ext.yaml

# Verify
kubectl get pods
kubectl get ingress
```

### AWS Load Balancer Controller (IRSA)

The ALB controller uses IAM Roles for Service Accounts (IRSA) to provision load balancers:

```bash
# Associate OIDC provider
eksctl utils associate-iam-oidc-provider \
  --region us-east-1 \
  --cluster opa-eks-cluster \
  --approve

# Install controller
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=opa-eks-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

---

## 👥 User Management

The backend exposes `/userManage` endpoints (protected by OPA) for role assignment. Only `superAdmin` can access these.

**Roles hierarchy (Cognito groups with precedence):**

| Group | Precedence | Can manage |
|-------|-----------|------------|
| `superAdmin` | 0 | All users |
| `admin` | 1 | developer, tester, viewer |
| `developer` | 2 | — |
| `tester` | 2 | — |
| `viewer` | 2 | — |

The backend uses `@aws-sdk/client-cognito-identity-provider` to call Cognito Admin APIs (`AdminAddUserToGroupCommand`, `AdminRemoveUserFromGroupCommand`, etc.) via an IRSA-backed service account (`backend-service-account`).

**Post Confirmation Lambda** — auto-assigns every new self-signup user to the `viewer` group.

---

## 📊 Observability

OPA decision logs are shipped to **CloudWatch** via **FluentBit** running as a DaemonSet.

```
OPA (decisions.log) → FluentBit DaemonSet → CloudWatch Log Group (fluentbit)
```

**Why DaemonSet over sidecar for FluentBit?**
- Avoids multiple failure points as backend pods scale
- Filtering config (`fluent-values.yaml`) is managed by infra team via Helm upgrade — not tied to app deployments

**FluentBit filter config (`k8s/fluent-values.yaml`):**

```yaml
extraFilters:
  - Name: grep
    Match: kube.*
    Regex: kubernetes.container_name opa
  - Name: grep
    Match: kube.*
    Regex: log decision_id
```

Install and upgrade:

```bash
helm install aws-for-fluent-bit aws-observability/aws-for-fluent-bit \
  --namespace amazon-cloudwatch --create-namespace

# Apply OPA log filters
helm upgrade aws-for-fluent-bit aws-observability/aws-for-fluent-bit \
  -n amazon-cloudwatch \
  -f k8s/fluent-values.yaml
```

Each CloudWatch log entry captures: `decision_id`, `input.roles`, `input.path`, `input.method`, `input.user`, and `result.allow`.

---

## 🌐 DNS & SSL

| Record | Type | Target |
|--------|------|--------|
| `eks-fe.learnc.online` | A (Alias) | External ALB DNS |

- **ACM certificate** provisioned for `learnc.online` and attached to `ingress-ext.yaml`
- **SSL redirect** configured: HTTP:80 → HTTPS:443
- Cognito callback/redirect URLs updated to `https://eks-fe.learnc.online`
- Google and Microsoft redirect URIs updated to match

---

## ☁️ AWS Services Used

| Service | Purpose |
|---------|---------|
| Cognito User Pool | Centralized identity hub, JWT issuance |
| API Gateway (HTTP) | JWT validation, VPC Link routing |
| Lambda | Pre-Token Generation, Post Confirmation |
| EKS | Container orchestration |
| ECR | Container image registry |
| ALB | External (frontend) and Internal (backend) load balancers |
| IAM / IRSA | Pod-level AWS permissions without static credentials |
| Route 53 | DNS — custom domain to ALB |
| ACM | TLS certificate for HTTPS |
| CloudWatch | OPA decision log storage |

**External tools:** GCP (Google OAuth), Azure Entra ID (Microsoft OIDC), OPA, FluentBit, Helm, Docker

---

## 🔮 Production Considerations

Things intentionally simplified for this POC that should be hardened for production:

- **Pre-Token Lambda role logic** — should derive roles purely from Cognito group membership, not IDP group names (updated version already included)
- **ECR** — use private ECR with IRSA pull permissions instead of public ECR
- **EKS endpoint** — switch to private-only after setup; access via Bastion or VPN
- **OPA policy distribution** — consider S3 bundle polling for dynamic policy updates without pod restarts
- **Tenant ID** — currently hardcoded as `"demo-tenant"`; should be resolved from user attributes or a tenant registry
- **Secrets** — IDP client secrets should be stored in AWS Secrets Manager

---

## 🧠 Key Design Principle

> This architecture transforms **Security from a Code Problem** (where developers make mistakes) into an **Infrastructure Contract** (where the platform guarantees safety).

Requests are rejected early — at the gateway (invalid JWT signature) or at the policy engine (authorization failure) — ensuring only authenticated and authorized requests ever reach business logic.

---

*Implemented by Aayushi Joshi*
