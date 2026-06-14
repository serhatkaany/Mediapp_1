import pytest

BASE_URL = "http://127.0.0.1:8000"

def test_profile_requires_auth(api_client):
    r = api_client.get(f"{BASE_URL}/api/profile", timeout=10)
    assert r.status_code in (401, 403)
