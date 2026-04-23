from pydantic import BaseModel, field_validator, model_validator
from datetime import datetime
from typing import Optional, List
from decimal import Decimal


# ════════════════════════════════════════════════════════════════════════════
# Document Repository
# ════════════════════════════════════════════════════════════════════════════

ALLOWED_DOCUMENT_TYPES = [
    "ID Copy", "Proof of Address", "Payslip",
    "Bank Statement", "Contract", "Other",
]

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class DocumentVersionOut(BaseModel):
    id: int
    version_number: int
    original_filename: str
    stored_filename: str
    file_size: int
    mime_type: str
    uploaded_by: str
    uploaded_at: datetime
    archived_at: datetime

    class Config:
        from_attributes = True


class DocumentOut(BaseModel):
    id: int
    client_number: str
    document_type: str
    description: Optional[str]
    original_filename: str
    stored_filename: str
    s3_key: str
    file_size: int
    mime_type: str
    document_date: datetime
    uploaded_by: str
    uploaded_at: datetime
    version_number: int
    is_active: bool
    versions: List[DocumentVersionOut] = []

    class Config:
        from_attributes = True


class DocumentListOut(BaseModel):
    id: int
    client_number: str
    document_type: str
    description: Optional[str]
    original_filename: str
    stored_filename: str
    file_size: int
    mime_type: str
    document_date: datetime
    uploaded_by: str
    uploaded_at: datetime
    version_number: int

    class Config:
        from_attributes = True


class DocumentAuditLogOut(BaseModel):
    id: int
    document_id: Optional[int]
    action: str
    performed_by: str
    performed_at: datetime
    details: Optional[str]
    ip_address: Optional[str]

    class Config:
        from_attributes = True


class UploadResult(BaseModel):
    filename: str
    success: bool
    document_id: Optional[int] = None
    error: Optional[str] = None


class BatchUploadResponse(BaseModel):
    total: int
    succeeded: int
    failed: int
    results: List[UploadResult]


# ════════════════════════════════════════════════════════════════════════════
# Company Settings
# ════════════════════════════════════════════════════════════════════════════

LOGO_ALLOWED_MIME_TYPES = {"image/png", "image/jpeg"}
LOGO_MAX_SIZE_BYTES     = 2 * 1024 * 1024  # 2 MB


class CompanySettingsUpdate(BaseModel):
    company_name:            Optional[str] = None
    registration_number:     Optional[str] = None
    physical_address:        Optional[str] = None
    contact_phone:           Optional[str] = None
    contact_email:           Optional[str] = None
    email_signature:         Optional[str] = None
    default_currency:        Optional[str] = None
    fiscal_year_start_month: Optional[int] = None

    @field_validator("fiscal_year_start_month")
    @classmethod
    def valid_month(cls, v):
        if v is not None and not (1 <= v <= 12):
            raise ValueError("fiscal_year_start_month must be between 1 and 12")
        return v

    @field_validator("default_currency")
    @classmethod
    def valid_currency(cls, v):
        if v is not None and len(v) != 3:
            raise ValueError("default_currency must be a 3-letter ISO code e.g. ZAR")
        return v.upper() if v else v


class CompanySettingsOut(BaseModel):
    id: int
    company_name: str
    registration_number: Optional[str]
    physical_address: Optional[str]
    contact_phone: Optional[str]
    contact_email: Optional[str]
    logo_s3_key: Optional[str]
    logo_url: Optional[str]
    email_signature: Optional[str]
    default_currency: str
    fiscal_year_start_month: int
    updated_by: Optional[str]
    updated_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CompanySettingsAuditOut(BaseModel):
    id: int
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    changed_by: str
    changed_at: datetime

    class Config:
        from_attributes = True


# ════════════════════════════════════════════════════════════════════════════
# Business Rules
# ════════════════════════════════════════════════════════════════════════════

INTEREST_METHODS   = {"reducing_balance", "flat_rate", "add_on"}
PAYMENT_PRIORITIES = {"interest_first", "principal_first", "proportional"}


class BusinessRulesUpdate(BaseModel):
    min_loan_amount:                 Optional[Decimal] = None
    max_loan_amount:                 Optional[Decimal] = None
    min_loan_term_months:            Optional[int]     = None
    max_loan_term_months:            Optional[int]     = None
    max_concurrent_loans_per_client: Optional[int]     = None
    min_credit_score_auto_approve:   Optional[int]     = None
    days_to_default:                 Optional[int]     = None
    interest_calculation_method:     Optional[str]     = None
    payment_allocation_priority:     Optional[str]     = None
    override_reason:                 Optional[str]     = None

    @field_validator("interest_calculation_method")
    @classmethod
    def valid_interest(cls, v):
        if v and v not in INTEREST_METHODS:
            raise ValueError(f"Must be one of: {INTEREST_METHODS}")
        return v

    @field_validator("payment_allocation_priority")
    @classmethod
    def valid_payment(cls, v):
        if v and v not in PAYMENT_PRIORITIES:
            raise ValueError(f"Must be one of: {PAYMENT_PRIORITIES}")
        return v

    @field_validator("min_loan_amount", "max_loan_amount")
    @classmethod
    def positive_amount(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Must be greater than zero")
        return v

    @field_validator("min_credit_score_auto_approve")
    @classmethod
    def valid_score(cls, v):
        if v is not None and not (0 <= v <= 100):
            raise ValueError("Must be between 0 and 100")
        return v

    @model_validator(mode="after")
    def ranges_valid(self):
        if self.min_loan_amount and self.max_loan_amount:
            if self.min_loan_amount >= self.max_loan_amount:
                raise ValueError("min_loan_amount must be less than max_loan_amount")
        if self.min_loan_term_months and self.max_loan_term_months:
            if self.min_loan_term_months > self.max_loan_term_months:
                raise ValueError("min_loan_term_months must be <= max_loan_term_months")
        return self


class BusinessRulesOut(BaseModel):
    id: int
    min_loan_amount: Decimal
    max_loan_amount: Decimal
    min_loan_term_months: int
    max_loan_term_months: int
    max_concurrent_loans_per_client: int
    min_credit_score_auto_approve: int
    days_to_default: int
    interest_calculation_method: str
    payment_allocation_priority: str
    updated_by: Optional[str]
    updated_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class BusinessRulesAuditOut(BaseModel):
    id: int
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    changed_by: str
    changed_at: datetime

    class Config:
        from_attributes = True


class LoanValidationRequest(BaseModel):
    amount: Decimal
    term_months: int
    client_id: str
    credit_score: Optional[int] = None


class LoanValidationResult(BaseModel):
    valid: bool
    violations: List[str] = []
    overridable: bool = True
