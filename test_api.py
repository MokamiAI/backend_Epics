"""
API test script — Test document fetch endpoints
"""
import requests
import json

BASE_URL = "http://localhost:8000/api/documents"


def test_list_documents():
    print("\n" + "=" * 80)
    print("TEST: List All Documents")
    print("=" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/")
        response.raise_for_status()
        
        docs = response.json()
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Found {len(docs)} documents:")
        
        for doc in docs:
            print(f"\n  ID: {doc['id']}")
            print(f"  File: {doc['original_filename']}")
            print(f"  Type: {doc['document_type']}")
            print(f"  Client: {doc['client_number']}")
            print(f"  Size: {doc['file_size']} bytes")
            print(f"  Uploaded: {doc['uploaded_at']}")
        
        return docs
    except requests.exceptions.RequestException as e:
        print(f"✗ Error: {e}")
        return None


def test_get_document(doc_id):
    print("\n" + "=" * 80)
    print(f"TEST: Get Document #{doc_id}")
    print("=" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/{doc_id}")
        response.raise_for_status()
        
        doc = response.json()
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Document Details:")
        print(f"  File: {doc['original_filename']}")
        print(f"  S3 Key: {doc['s3_key']}")
        print(f"  Versions: {len(doc.get('versions', []))}")
        
        return doc
    except requests.exceptions.RequestException as e:
        print(f"✗ Error: {e}")
        return None


def test_download_url(doc_id):
    print("\n" + "=" * 80)
    print(f"TEST: Get Download URL for Document #{doc_id}")
    print("=" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/{doc_id}/download-url")
        response.raise_for_status()
        
        data = response.json()
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Download URL Generated:")
        print(f"  File: {data['filename']}")
        print(f"  Expires in: {data['expires_in']} seconds")
        print(f"  URL: {data['url'][:100]}...(truncated)")
        
        return data['url']
    except requests.exceptions.RequestException as e:
        print(f"✗ Error: {e}")
        return None


def test_view_url(doc_id):
    print("\n" + "=" * 80)
    print(f"TEST: Get View URL for Document #{doc_id}")
    print("=" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/{doc_id}/download-url?inline=true")
        response.raise_for_status()
        
        data = response.json()
        print(f"✓ Status: {response.status_code}")
        print(f"✓ View URL Generated:")
        print(f"  File: {data['filename']}")
        print(f"  Expires in: {data['expires_in']} seconds")
        print(f"  URL: {data['url'][:100]}...(truncated)")
        
        return data['url']
    except requests.exceptions.RequestException as e:
        print(f"✗ Error: {e}")
        return None


def test_document_types():
    print("\n" + "=" * 80)
    print("TEST: Get Document Types")
    print("=" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/meta/document-types")
        response.raise_for_status()
        
        data = response.json()
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Allowed document types:")
        for dtype in data['document_types']:
            print(f"  - {dtype}")
        
        return data['document_types']
    except requests.exceptions.RequestException as e:
        print(f"✗ Error: {e}")
        return None


def test_filter_documents(client_number=None, doc_type=None):
    print("\n" + "=" * 80)
    print(f"TEST: Filter Documents (client={client_number}, type={doc_type})")
    print("=" * 80)
    
    params = {}
    if client_number:
        params['client_number'] = client_number
    if doc_type:
        params['document_type'] = doc_type
    
    try:
        response = requests.get(f"{BASE_URL}/", params=params)
        response.raise_for_status()
        
        docs = response.json()
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Found {len(docs)} matching documents")
        
        for doc in docs:
            print(f"  - {doc['original_filename']} ({doc['client_number']})")
        
        return docs
    except requests.exceptions.RequestException as e:
        print(f"✗ Error: {e}")
        return None


def main():
    print("\n🧪 Testing IDS Platform Document API Endpoints\n")
    
    # Check if backend is running
    try:
        response = requests.get("http://localhost:8000/health")
        print(f"✓ Backend is running: {response.json()}")
    except requests.exceptions.RequestException:
        print("✗ Backend is not running at http://localhost:8000")
        print("  Start it with: python -m uvicorn backend.main:app --reload\n")
        return
    
    # Run tests
    docs = test_list_documents()
    test_document_types()
    
    if docs and len(docs) > 0:
        doc_id = docs[0]['id']
        test_get_document(doc_id)
        test_download_url(doc_id)
        test_view_url(doc_id)
        
        # Test filtering
        if len(docs) > 0:
            client = docs[0]['client_number']
            doc_type = docs[0]['document_type']
            test_filter_documents(client_number=client)
            test_filter_documents(doc_type=doc_type)
    
    print("\n" + "=" * 80)
    print("TESTS COMPLETE")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
