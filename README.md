# IDS Platform

**Intermediate Data System trading and Projects CC**

Full-stack internal management platform built with FastAPI (Python) + React.
Files are stored in **AWS S3**. All data is stored in **Supabase (PostgreSQL)**.

---

## Project Structure

```
ids-platform/
├── .env                          ← Your credentials (never commit)
├── .gitignore
├── README.md
├── supabase_schema.sql           ← Run this in Supabase SQL Editor first
│
├── backend/                      ← FastAPI Python API
│   ├── main.py                   ← App entry point, router registration
│   ├── config.py                 ← All settings loaded from .env
│   ├── supabase_client.py        ← Supabase client for database operations
│   ├── schemas.py                ← All Pydantic request/response schemas
│   ├── s3_service.py             ← All AWS S3 operations
│   ├── requirements.txt
│   └── routers/
│       ├── documents.py          ← Document upload, view, download, version control
│       └── settings.py           ← Company settings + business rules
│
└── frontend/                     ← React JavaScript UI
    ├── package.json
    ├── public/index.html
    └── src/
        ├── index.js
        ├── App.jsx               ← Sidebar layout, top-level navigation
        ├── api/
        │   ├── documents.js      ← All document API calls
        │   └── settings.js       ← All settings API calls
        └── components/
            ├── DocumentRepository.jsx   ← Document section container
            ├── DocumentList.jsx         ← Browse, filter, download, audit trail
            ├── UploadDocuments.jsx      ← Drag-and-drop batch file upload
            ├── VersionHistory.jsx       ← Replace documents, view version history
            ├── SystemConfiguration.jsx  ← Settings section container (admin only)
            ├── CompanySettings.jsx      ← Company details, logo, email signature
            └── BusinessRules.jsx        ← Loan rules, override flow, change log
```

---

## Supabase Setup

### Step 1 — Create a project
Go to https://supabase.com → New Project. Note your project password.

### Step 2 — Run the schema
Supabase Dashboard → **SQL Editor** → **New Query** → paste the full contents
of `supabase_schema.sql` → **Run**.

This creates all 7 tables, indexes, RLS policies, and seeds the default rows
for `company_settings` and `business_rules`.

### Step 3 — Get your credentials
Supabase Dashboard → **Project Settings** → **API**:

| Variable | Where to find it |
|----------|-----------------|
| `SUPABASE_URL` | Project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | `anon` `public` key |

---

## AWS S3 Setup

### Step 1 — Create an S3 bucket
- Block all public access: **ON**
- Region: choose closest to your users

### Step 2 — Create an IAM user with this policy
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject","s3:GetObject","s3:DeleteObject","s3:CopyObject","s3:HeadObject"],
    "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
  }]
}
```

### Step 3 — Add CORS to your bucket (Permissions → CORS)
```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET","PUT","POST","DELETE","HEAD"],
  "AllowedOrigins": ["http://localhost:3000","https://your-domain.com"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}]
```

---

## Configure .env

Fill in every value in the `.env` file at the project root:

```env
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

# AWS S3
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=af-south-1
S3_BUCKET_NAME=ids-client-documents
S3_SIGNED_URL_EXPIRY=300

# App
CORS_ORIGINS=http://localhost:3000
```

---

## Running the App

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/docs**

### Frontend
```bash
cd frontend
npm install
npm start
```

Runs at: **http://localhost:3000**

---

## API Reference

### Documents — `/api/documents`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/upload` | Batch upload files with metadata |
| `GET` | `/` | List documents (filter by client, type, description) |
| `GET` | `/meta/document-types` | Allowed document type values |
| `GET` | `/{id}` | Get single document with version list |
| `GET` | `/{id}/download-url` | Pre-signed S3 URL (download or inline view) |
| `POST` | `/batch-download` | Multiple documents streamed as ZIP |
| `POST` | `/{id}/replace` | Replace with new file — archives old version |
| `GET` | `/{id}/versions` | Full version history |
| `GET` | `/versions/{id}/download-url` | Pre-signed URL for an archived version |
| `GET` | `/{id}/audit` | Document activity log |

### Settings — `/api/settings`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/company` | Get company settings |
| `PATCH` | `/company` | Update company settings (partial) |
| `POST` | `/company/logo` | Upload company logo (PNG/JPG, max 2MB) |
| `DELETE` | `/company/logo` | Remove company logo |
| `GET` | `/company/audit` | Company settings change log |
| `GET` | `/rules` | Get business rules |
| `PATCH` | `/rules` | Update business rules (partial) |
| `POST` | `/rules/validate-loan` | Validate a loan against current rules |
| `GET` | `/rules/audit` | Business rules change log |

---

## Database Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `documents` | Current version of each client document (metadata only) |
| `document_versions` | All replaced versions — never deleted |
| `document_audit_logs` | Every view / download / upload / replace action |
| `company_settings` | Single-row company profile (name, address, logo, etc.) |
| `company_settings_audit` | Field-level change log for company settings |
| `business_rules` | Single-row configurable loan rules |
| `business_rules_audit` | Field-level change log for business rules |

---

## S3 Folder Structure

```
{bucket}/
└── clients/
│   └── {client_number}/
│       ├── active/
│       │   └── CLIENT001_ID_Copy_20250411_passport.pdf
│       └── archive/
│           └── v1_CLIENT001_ID_Copy_20250101_old.pdf
└── system/
    └── logo/
        └── company_logo.png
```

---

## Integration Notes

**Auth** — Pass `currentUser`, `clientNumber`, and `isAdmin` into the React components
from your auth/routing layer. These props are the only integration points.

**Admin gate** — `SystemConfiguration` renders an access-denied screen if `isAdmin=false`.
Enforce this at the API layer too by validating a role claim in your auth middleware.

**Loan validation** — Call `POST /api/settings/rules/validate-loan` from your loan
application flow before submission. Returns `{ valid, violations, overridable }`.

**Override flow** — When saving business rules with `override=true`, supply an
`override_reason` in the payload. The reason is appended to every changed-field
audit row so there is a permanent record.
