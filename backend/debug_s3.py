"""
Debug script for S3 document fetching.
Tests connection to AWS S3 and Supabase.
"""
import sys
from backend.config import get_settings
from backend.s3_service import get_s3, BUCKET
from backend.supabase_client import get_supabase
from botocore.exceptions import ClientError

def debug_s3():
    print("=" * 80)
    print("S3 DEBUG")
    print("=" * 80)
    
    cfg = get_settings()
    print(f"\n✓ Config loaded")
    print(f"  - AWS Region: {cfg.aws_region}")
    print(f"  - S3 Bucket: {BUCKET}")
    print(f"  - S3 Expiry: {cfg.s3_signed_url_expiry}s")
    
    try:
        s3 = get_s3()
        print(f"\n✓ S3 client initialized")
        
        # Test bucket access
        s3.head_bucket(Bucket=BUCKET)
        print(f"✓ S3 bucket accessible: {BUCKET}")
        
        # List objects in bucket
        try:
            response = s3.list_objects_v2(Bucket=BUCKET, MaxKeys=10)
            if 'Contents' in response:
                print(f"\n✓ Found {len(response['Contents'])} objects in bucket (showing first 10):")
                for obj in response['Contents']:
                    print(f"  - {obj['Key']} ({obj['Size']} bytes)")
            else:
                print(f"\n⚠ Bucket is empty")
        except ClientError as e:
            print(f"✗ Error listing objects: {e}")
            
    except ClientError as e:
        print(f"✗ S3 error: {e.response['Error']['Message']}")
        return False
    
    return True


def debug_supabase():
    print("\n" + "=" * 80)
    print("SUPABASE DEBUG")
    print("=" * 80)
    
    try:
        sb = get_supabase()
        print(f"\n✓ Supabase client initialized")
        
        # Check documents table
        try:
            response = sb.table("documents").select("*").limit(5).execute()
            print(f"✓ Documents table accessible")
            print(f"  - Found {len(response.data)} documents (limit 5):")
            for doc in response.data:
                print(f"    - ID: {doc['id']}, File: {doc['original_filename']}, S3 Key: {doc['s3_key']}")
            
            return len(response.data) > 0
        except Exception as e:
            print(f"✗ Error querying documents: {e}")
            return False
            
    except Exception as e:
        print(f"✗ Supabase error: {e}")
        return False


def debug_document_fetch():
    print("\n" + "=" * 80)
    print("DOCUMENT FETCH DEBUG")
    print("=" * 80)
    
    try:
        sb = get_supabase()
        response = sb.table("documents").select("*").limit(1).execute()
        
        if not response.data:
            print("⚠ No documents in database to test fetch")
            return None
        
        doc = response.data[0]
        print(f"\nTesting fetch for: {doc['original_filename']} (ID: {doc['id']})")
        print(f"  S3 Key: {doc['s3_key']}")
        
        # Try to fetch file bytes
        try:
            from backend.s3_service import download_file_bytes
            file_bytes = download_file_bytes(doc['s3_key'])
            print(f"✓ Successfully downloaded {len(file_bytes)} bytes")
            return True
        except Exception as e:
            print(f"✗ Error downloading file: {e}")
            return False
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def main():
    print("\n🔍 Debugging IDS Platform S3 Integration\n")
    
    s3_ok = debug_s3()
    sb_ok = debug_supabase()
    
    if s3_ok and sb_ok:
        fetch_ok = debug_document_fetch()
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"S3 Connection: {'✓ OK' if s3_ok else '✗ FAILED'}")
    print(f"Supabase Connection: {'✓ OK' if sb_ok else '✗ FAILED'}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
