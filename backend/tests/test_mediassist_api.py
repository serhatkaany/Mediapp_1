"""MediAssist Backend API Tests"""
import os
import time
import uuid
import base64
import requests
import pytest
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    fe_path = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if fe_path.exists():
        fe_env = fe_path.read_text()
        for line in fe_env.splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
    if not BASE_URL:
        BASE_URL = "http://localhost:8000"



# ---------- Health ----------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_register_new_user(self, api_client):
        unique = f"TEST_{uuid.uuid4().hex[:8]}@ex.com"
        payload = {
            "name": "TEST_FN", "surname": "TEST_LN",
            "email": unique, "password": "secret123",
            "date_of_birth": "1995-05-05", "phone_number": "+905551234567",
        }
        r = api_client.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique.lower()
        # Cleanup using token
        tok = data["access_token"]
        api_client.delete(f"{BASE_URL}/api/auth/account", headers={"Authorization": f"Bearer {tok}"}, timeout=10)

    def test_register_duplicate_email(self, api_client, auth_token):
        payload = {
            "name": "Test", "surname": "User",
            "email": "test@example.com", "password": "test123",
            "date_of_birth": "1990-01-01", "phone_number": "+905551112233",
        }
        r = api_client.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=10)
        assert r.status_code == 409

    def test_login_success(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": "test@example.com", "password": "test123"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["token_type"] == "bearer"
        assert d["user"]["email"] == "test@example.com"

    def test_login_wrong_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": "test@example.com", "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_me_with_token(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == "test@example.com"

    def test_me_without_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code in (401, 403)


# ---------- Medication Search ----------
class TestMedicationSearch:
    def test_search_medications(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/medications/search?q=parol", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert any("parol" in item["name"].lower() for item in data)


# ---------- Hospital Search ----------
class TestHospitalSearch:
    def test_search_hospitals(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/hospitals/search?city=istanbul&query=memorial", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert any("memorial" in item["name"].lower() for item in data)
