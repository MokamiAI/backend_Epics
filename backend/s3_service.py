"""
s3_service.py — All AWS S3 operations.
Swap this file to change storage providers without touching routers.

S3 key structure:
  clients/{client_number}/active/{stored_filename}
  clients/{client_number}/archive/v{n}_{stored_filename}
  system/logo/company_logo.{ext}
"""
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException
from backend.config import get_settings

settings = get_settings()
_client = None


def get_s3():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
            config=Config(signature_version="s3v4"),
        )
    return _client


BUCKET = settings.s3_bucket_name


def build_active_key(client_number: str, stored_filename: str) -> str:
    return f"clients/{client_number}/active/{stored_filename}"


def build_archive_key(client_number: str, version: int, stored_filename: str) -> str:
    return f"clients/{client_number}/archive/v{version}_{stored_filename}"


def upload_file(file_bytes: bytes, s3_key: str, content_type: str) -> str:
    try:
        get_s3().put_object(
            Bucket=BUCKET, Key=s3_key, Body=file_bytes,
            ContentType=content_type, ServerSideEncryption="AES256",
        )
        return s3_key
    except ClientError as e:
        raise HTTPException(500, f"S3 upload failed: {e.response['Error']['Message']}")


def copy_file(source_key: str, dest_key: str) -> str:
    try:
        get_s3().copy_object(
            Bucket=BUCKET,
            CopySource={"Bucket": BUCKET, "Key": source_key},
            Key=dest_key,
            ServerSideEncryption="AES256",
        )
        return dest_key
    except ClientError as e:
        raise HTTPException(500, f"S3 copy failed: {e.response['Error']['Message']}")


def delete_file(s3_key: str) -> None:
    try:
        get_s3().delete_object(Bucket=BUCKET, Key=s3_key)
    except ClientError:
        pass


def get_presigned_download_url(s3_key: str, filename: str, expiry: int | None = None) -> str:
    expiry = expiry or settings.s3_signed_url_expiry
    try:
        return get_s3().generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": s3_key,
                    "ResponseContentDisposition": f'attachment; filename="{filename}"'},
            ExpiresIn=expiry,
        )
    except ClientError as e:
        raise HTTPException(500, f"Could not generate download URL: {e.response['Error']['Message']}")


def get_presigned_view_url(s3_key: str, content_type: str, expiry: int | None = None) -> str:
    expiry = expiry or settings.s3_signed_url_expiry
    try:
        return get_s3().generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": s3_key,
                    "ResponseContentType": content_type,
                    "ResponseContentDisposition": "inline"},
            ExpiresIn=expiry,
        )
    except ClientError as e:
        raise HTTPException(500, f"Could not generate view URL: {e.response['Error']['Message']}")


def download_file_bytes(s3_key: str) -> bytes:
    try:
        return get_s3().get_object(Bucket=BUCKET, Key=s3_key)["Body"].read()
    except ClientError as e:
        raise HTTPException(404, f"File not found: {e.response['Error']['Message']}")
