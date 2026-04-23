# IDS Platform API Endpoints

**Base URL:** `http://localhost:8000`

---

## 📋 Table of Contents
1. [Health & Status](#health--status)
2. [Documents](#documents)
3. [Settings](#settings)

---

## Health & Status

### Health Check
- **Method:** `GET`
- **Endpoint:** `/health`
- **Description:** Check API and service health
- **Response:**
```json
{
  "api": "ok",
  "supabase": "ok",
  "s3": "ok",
  "bucket": "intermediate-apex-bucket"
}
```

### Root
- **Method:** `GET`
- **Endpoint:** `/`
- **Description:** Get API information
- **Response:**
```json
{
  "service": "IDS Platform API",
  "version": "2.0.0",
  "status": "running"
}
```

---

## Documents

### Upload Documents
- **Method:** `POST`
- **Endpoint:** `/api/documents/upload`
- **Description:** Upload one or more documents for a client
- **Request Body:** `multipart/form-data`
  - `client_number` (string, required)
  - `document_type` (string, required) - Must be from allowed types
  - `description` (string, optional)
  - `document_date` (string, optional) - Format: YYYY-MM-DD
  - `uploaded_by` (string, optional) - Default: "system"
  - `files` (file[], required) - One or more files
- **Response:**
```json
{
  "total": 2,
  "succeeded": 2,
  "failed": 0,
  "results": [
    {
      "filename": "document.pdf",
      "success": true,
      "document_id": 1
    }
  ]
}
```

### List Documents
- **Method:** `GET`
- **Endpoint:** `/api/documents/`
- **Description:** List all active documents with optional filters
- **Query Parameters:**
  - `client_number` (string, optional) - Filter by client
  - `document_type` (string, optional) - Filter by type
  - `search` (string, optional) - Search in description
- **Response:**
```json
[
  {
    "id": 1,
    "client_number": "CLIENT001",
    "document_type": "ID Copy",
    "description": "April ID",
    "original_filename": "INV-000075.pdf",
    "stored_filename": "CLIENT001_ID_Copy_20260414_INV-000075.pdf",
    "file_size": 63424,
    "mime_type": "application/pdf",
    "document_date": "2026-04-14T00:00:00Z",
    "uploaded_by": "admin@ids.co.za",
    "uploaded_at": "2026-04-14T13:21:44.525035Z",
    "version_number": 1
  }
]
```

### Get Document Types
- **Method:** `GET`
- **Endpoint:** `/api/documents/meta/document-types`
- **Description:** Get list of allowed document types
- **Response:**
```json
{
  "document_types": [
    "ID Copy",
    "Proof of Address",
    "Payslip",
    "Bank Statement",
    "Contract",
    "Other"
  ]
}
```

### Get Document Details
- **Method:** `GET`
- **Endpoint:** `/api/documents/{document_id}`
- **Description:** Get a single document with its full version history
- **Path Parameters:**
  - `document_id` (integer, required)
- **Response:**
```json
{
  "id": 1,
  "client_number": "CLIENT001",
  "document_type": "ID Copy",
  "original_filename": "INV-000075.pdf",
  "stored_filename": "CLIENT001_ID_Copy_20260414_INV-000075.pdf",
  "s3_key": "clients/CLIENT001/active/CLIENT001_ID_Copy_20260414_INV-000075.pdf",
  "file_size": 63424,
  "mime_type": "application/pdf",
  "version_number": 1,
  "versions": []
}
```

### Get Download URL
- **Method:** `GET`
- **Endpoint:** `/api/documents/{document_id}/download-url`
- **Description:** Generate a pre-signed S3 URL for downloading or viewing a document
- **Path Parameters:**
  - `document_id` (integer, required)
- **Query Parameters:**
  - `performed_by` (string, optional) - User performing action (for audit)
  - `inline` (boolean, optional) - Set to true to view PDF/images in browser
- **Response:**
```json
{
  "url": "https://intermediate-apex-bucket.s3.amazonaws.com/...",
  "expires_in": 300,
  "filename": "INV-000075.pdf"
}
```

### Batch Download
- **Method:** `POST`
- **Endpoint:** `/api/documents/batch-download`
- **Description:** Download multiple documents as a ZIP file
- **Query Parameters:**
  - `performed_by` (string, optional) - User performing action
- **Request Body:** `application/json`
```json
[1, 2, 3]
```
- **Response:** Binary ZIP file stream

### Replace Document
- **Method:** `POST`
- **Endpoint:** `/api/documents/{document_id}/replace`
- **Description:** Replace a document with a new version. Current file is archived.
- **Path Parameters:**
  - `document_id` (integer, required)
- **Request Body:** `multipart/form-data`
  - `file` (file, required) - New document file
  - `uploaded_by` (string, optional) - User uploading
  - `description` (string, optional) - New description
- **Response:** Updated document object with version history

### Get Version History
- **Method:** `GET`
- **Endpoint:** `/api/documents/{document_id}/versions`
- **Description:** Get full version history for a document
- **Path Parameters:**
  - `document_id` (integer, required)
- **Response:**
```json
{
  "current": {
    "version_number": 1,
    "original_filename": "INV-000075.pdf",
    "stored_filename": "CLIENT001_ID_Copy_20260414_INV-000075.pdf",
    "s3_key": "clients/CLIENT001/active/...",
    "file_size": 63424,
    "uploaded_by": "admin@ids.co.za",
    "uploaded_at": "2026-04-14T13:21:44.525035Z",
    "is_current": true
  },
  "history": []
}
```

### Get Version Download URL
- **Method:** `GET`
- **Endpoint:** `/api/documents/versions/{version_id}/download-url`
- **Description:** Get pre-signed URL for a specific archived version
- **Path Parameters:**
  - `version_id` (integer, required)
- **Query Parameters:**
  - `performed_by` (string, optional) - User performing action
- **Response:**
```json
{
  "url": "https://intermediate-apex-bucket.s3.amazonaws.com/...",
  "expires_in": 300,
  "version": 1,
  "filename": "INV-000075.pdf"
}
```

### Get Audit Trail
- **Method:** `GET`
- **Endpoint:** `/api/documents/{document_id}/audit`
- **Description:** Get activity/audit log for a document
- **Path Parameters:**
  - `document_id` (integer, required)
- **Response:**
```json
[
  {
    "id": 1,
    "document_id": 1,
    "action": "UPLOAD",
    "performed_by": "admin@ids.co.za",
    "performed_at": "2026-04-14T13:21:44.525035Z",
    "details": "{\"filename\": \"INV-000075.pdf\", \"size\": 63424}",
    "ip_address": "127.0.0.1"
  }
]
```

---

## Settings

### Get Company Settings
- **Method:** `GET`
- **Endpoint:** `/api/settings/company`
- **Description:** Get current company settings
- **Response:**
```json
{
  "company_name": "Intermediate Data System",
  "registration_number": "2024/123456",
  "industry": "Finance",
  "contact_email": "info@ids.co.za",
  "phone": "+27-11-000-0000",
  "website": "https://ids.co.za",
  "logo_s3_key": null
}
```

### Update Company Settings
- **Method:** `PATCH`
- **Endpoint:** `/api/settings/company`
- **Description:** Update company settings
- **Query Parameters:**
  - `changed_by` (string, optional) - User making changes
- **Request Body:**
```json
{
  "company_name": "New Name",
  "registration_number": "2024/123456",
  "industry": "Technology",
  "contact_email": "new@ids.co.za",
  "phone": "+27-11-111-1111",
  "website": "https://newsite.com"
}
```

### Upload Company Logo
- **Method:** `POST`
- **Endpoint:** `/api/settings/company/logo`
- **Description:** Upload company logo
- **Query Parameters:**
  - `changed_by` (string, optional) - User making changes
- **Request Body:** `multipart/form-data`
  - `file` (file, required) - Logo image file
- **Response:**
```json
{
  "logo_s3_key": "system/logo/company_logo.png"
}
```

### Delete Company Logo
- **Method:** `DELETE`
- **Endpoint:** `/api/settings/company/logo`
- **Description:** Delete company logo
- **Query Parameters:**
  - `changed_by` (string, optional) - User making changes
- **Response:**
```json
{
  "message": "Logo deleted"
}
```

### Get Company Settings Audit
- **Method:** `GET`
- **Endpoint:** `/api/settings/company/audit`
- **Description:** Get audit trail for company settings changes
- **Response:**
```json
[
  {
    "id": 1,
    "action": "UPDATE",
    "performed_by": "admin@ids.co.za",
    "changed_at": "2026-04-14T13:21:44.525035Z",
    "details": "{\"field\": \"company_name\", \"old_value\": \"...\", \"new_value\": \"...\"}"
  }
]
```

### Get Business Rules
- **Method:** `GET`
- **Endpoint:** `/api/settings/business-rules`
- **Description:** Get business rules configuration
- **Response:**
```json
{
  "rules": [
    {
      "id": 1,
      "rule_name": "Max Upload Size",
      "rule_description": "Maximum file size for uploads",
      "value": "10485760"
    }
  ]
}
```

### Update Business Rules
- **Method:** `PATCH`
- **Endpoint:** `/api/settings/business-rules`
- **Description:** Update business rules
- **Query Parameters:**
  - `changed_by` (string, optional)
- **Request Body:**
```json
{
  "rules": [
    {"id": 1, "rule_name": "Max Upload Size", "value": "52428800"}
  ]
}
```

### Get System Configuration
- **Method:** `GET`
- **Endpoint:** `/api/settings/system`
- **Description:** Get system configuration
- **Response:**
```json
{
  "version": "2.0.0",
  "s3_bucket": "intermediate-apex-bucket",
  "s3_region": "af-south-1",
  "max_file_size_mb": 10,
  "allowed_file_types": [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".xlsx"]
}
```

---

## Error Responses

All endpoints return error responses in this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes:
- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
- `502` - Bad Gateway (backend unavailable)
- `503` - Service Unavailable

---

## Notes

- All timestamps are in UTC (ISO-8601 format)
- Document file size is limited to 10 MB
- Allowed document types: ID Copy, Proof of Address, Payslip, Bank Statement, Contract, Other
- Allowed file formats: PDF, JPG, PNG, DOCX, XLSX
- Pre-signed URLs expire after 300 seconds (5 minutes)
- CORS is enabled for: `http://localhost:3000`, `http://localhost:3001`

---

## Testing

### Quick Test Commands

**Check API Health:**
```bash
curl http://localhost:8000/health
```

**List Documents:**
```bash
curl "http://localhost:8000/api/documents/?client_number=CLIENT001"
```

**Get Document Types:**
```bash
curl http://localhost:8000/api/documents/meta/document-types
```

**Get Company Settings:**
```bash
curl http://localhost:8000/api/settings/company
```

---

**API Version:** 2.0.0  
**Last Updated:** April 14, 2026
