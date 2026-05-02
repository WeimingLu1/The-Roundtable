import os
import sys

# Add the worktree root (parent of backend/) to sys.path so that
# "from backend import db" works as an absolute import.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

TEST_DB_PATH = ":memory:"


@pytest.fixture
def client():
    # Monkey-patch before importing main — main.py checks ANTHROPIC_API_KEY
    # at module level and will raise ValueError if it is missing.
    os.environ.setdefault("ANTHROPIC_API_KEY", "test-api-key-for-tests")

    from backend import db as db_module
    from backend import auth_utils as auth_utils_module

    original_path = db_module.DB_PATH
    original_jwt_secret = auth_utils_module.JWT_SECRET
    db_module.DB_PATH = TEST_DB_PATH
    db_module._connection = None
    auth_utils_module.JWT_SECRET = "test-secret-key-for-testing-32chars+"

    from backend.main import app

    with TestClient(app) as c:
        yield c

    db_module.DB_PATH = original_path
    db_module._connection = None
    auth_utils_module.JWT_SECRET = original_jwt_secret


class TestAuthEndpoints:

    def test_register_success(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "test1234",
            "name": "Test User",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "test@example.com"
        assert data["name"] == "Test User"
        assert "token" in data
        assert data["is_admin"] is True

    def test_register_duplicate_email(self, client):
        client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "password": "test1234",
            "name": "First",
        })
        resp = client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "password": "test1234",
            "name": "Second",
        })
        assert resp.status_code == 409

    def test_register_short_password(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "short@example.com",
            "password": "123",
            "name": "Short PW",
        })
        # Pydantic min_length=8 catches this before the route handler,
        # so FastAPI returns 422 (Unprocessable Entity).
        assert resp.status_code == 422

    def test_login_success(self, client):
        client.post("/api/auth/register", json={
            "email": "login@example.com",
            "password": "test1234",
            "name": "Login User",
        })
        resp = client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "test1234",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data

    def test_login_wrong_password(self, client):
        client.post("/api/auth/register", json={
            "email": "wrongpw@example.com",
            "password": "test1234",
            "name": "WP User",
        })
        resp = client.post("/api/auth/login", json={
            "email": "wrongpw@example.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_get_me(self, client):
        reg = client.post("/api/auth/register", json={
            "email": "me@example.com",
            "password": "test1234",
            "name": "Me User",
        })
        token = reg.json()["token"]
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "me@example.com"

    def test_get_me_invalid_token(self, client):
        resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid-token"})
        assert resp.status_code == 401

    def test_update_profile(self, client):
        reg = client.post("/api/auth/register", json={
            "email": "profile@example.com",
            "password": "test1234",
            "name": "Profile User",
        })
        token = reg.json()["token"]
        resp = client.put("/api/auth/me", json={
            "identity": "Software Engineer",
            "language": "English",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["identity"] == "Software Engineer"
        assert data["language"] == "English"


class TestAdminEndpoints:

    def _register_admin(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "admin@example.com",
            "password": "test1234",
            "name": "Admin",
        })
        return resp.json()["token"]

    def _register_user(self, client, email, admin_token=None, name="User"):
        if admin_token is None:
            admin_token = self._register_admin(client)
        resp = client.post("/api/auth/admin/users", json={
            "email": email,
            "password": "test1234",
            "name": name,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        return resp.json()

    def test_admin_list_users(self, client):
        token = self._register_admin(client)
        resp = client.get("/api/auth/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["users"]) >= 1

    def test_admin_create_user(self, client):
        token = self._register_admin(client)
        resp = client.post("/api/auth/admin/users", json={
            "email": "created@example.com",
            "password": "test1234",
            "name": "Created User",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "created@example.com"

    def test_admin_update_user(self, client):
        token = self._register_admin(client)
        user = self._register_user(client, "update@example.com", admin_token=token)
        resp = client.put(f"/api/auth/admin/users/{user['id']}", json={
            "name": "Updated Name",
            "is_admin": True,
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated Name"

    def test_admin_delete_user(self, client):
        token = self._register_admin(client)
        user = self._register_user(client, "delete@example.com", admin_token=token)
        resp = client.delete(f"/api/auth/admin/users/{user['id']}",
                             headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

    def test_non_admin_cannot_access(self, client):
        admin_token = self._register_admin(client)
        resp = client.post("/api/auth/admin/users", json={
            "email": "regular@example.com",
            "password": "test1234",
            "name": "Regular",
        }, headers={"Authorization": f"Bearer {admin_token}"})

        resp = client.post("/api/auth/login", json={
            "email": "regular@example.com",
            "password": "test1234",
        })
        regular_token = resp.json()["token"]

        resp = client.get("/api/auth/admin/users", headers={"Authorization": f"Bearer {regular_token}"})
        assert resp.status_code == 403
