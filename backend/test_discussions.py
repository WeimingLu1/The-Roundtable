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
    original_jwt = auth_utils_module.JWT_SECRET
    db_module.DB_PATH = TEST_DB_PATH
    db_module._connection = None
    auth_utils_module.JWT_SECRET = "test-secret-key-for-testing-32chars+"

    from backend.main import app
    with TestClient(app) as c:
        yield c

    db_module.DB_PATH = original_path
    db_module._connection = None
    auth_utils_module.JWT_SECRET = original_jwt


def _register_and_get_token(client, email="disc_test@example.com", name="Disc User"):
    resp = client.post("/api/auth/register", json={
        "email": email, "password": "test1234", "name": name
    })
    return resp.json()["token"]


class TestDiscussionEndpoints:

    def test_create_discussion(self, client):
        token = _register_and_get_token(client)
        resp = client.post("/api/discussions", json={
            "topic": "Test Topic",
            "participants": [{"id": "expert_0", "name": "Alice", "title": "Scientist", "stance": "Pro", "color": "#FF0000", "roleType": "expert"}]
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["topic"] == "Test Topic"
        assert data["message_count"] == 0
        assert "id" in data

    def test_list_discussions(self, client):
        token = _register_and_get_token(client)
        client.post("/api/discussions", json={
            "topic": "Topic A", "participants": []
        }, headers={"Authorization": f"Bearer {token}"})
        client.post("/api/discussions", json={
            "topic": "Topic B", "participants": []
        }, headers={"Authorization": f"Bearer {token}"})
        resp = client.get("/api/discussions", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()["discussions"]) == 2

    def test_get_discussion_with_messages(self, client):
        token = _register_and_get_token(client)
        disc = client.post("/api/discussions", json={
            "topic": "Topic", "participants": []
        }, headers={"Authorization": f"Bearer {token}"}).json()

        client.post(f"/api/discussions/{disc['id']}/messages", json={
            "messages": [{"id": "1", "senderId": "user", "text": "Hello", "timestamp": 1000}]
        }, headers={"Authorization": f"Bearer {token}"})

        resp = client.get(f"/api/discussions/{disc['id']}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["messages"]) == 1
        assert data["messages"][0]["text"] == "Hello"

    def test_append_messages(self, client):
        token = _register_and_get_token(client)
        disc = client.post("/api/discussions", json={
            "topic": "Topic", "participants": []
        }, headers={"Authorization": f"Bearer {token}"}).json()

        resp = client.post(f"/api/discussions/{disc['id']}/messages", json={
            "messages": [
                {"id": "1", "senderId": "expert_0", "text": "Point A", "stance": "AGREE", "stanceIntensity": 4, "actionDescription": "nods", "timestamp": 1000},
                {"id": "2", "senderId": "expert_1", "text": "Point B", "timestamp": 2000}
            ]
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["message_count"] == 2

    def test_update_discussion_summary(self, client):
        token = _register_and_get_token(client)
        disc = client.post("/api/discussions", json={
            "topic": "Topic", "participants": []
        }, headers={"Authorization": f"Bearer {token}"}).json()

        resp = client.put(f"/api/discussions/{disc['id']}", json={
            "summary": {"topic": "Topic", "summary": "Great discussion", "conclusion": "Agreed"}
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["summary"]["conclusion"] == "Agreed"

    def test_archive_discussion(self, client):
        token = _register_and_get_token(client)
        disc = client.post("/api/discussions", json={
            "topic": "Topic", "participants": []
        }, headers={"Authorization": f"Bearer {token}"}).json()

        resp = client.delete(f"/api/discussions/{disc['id']}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

        # Archived discussion should not appear in list
        list_resp = client.get("/api/discussions", headers={"Authorization": f"Bearer {token}"})
        assert len(list_resp.json()["discussions"]) == 0

    def test_cannot_access_other_users_discussion(self, client):
        token_a = _register_and_get_token(client, "a@test.com", "User A")
        token_b = _register_and_get_token(client, "b@test.com", "User B")

        disc = client.post("/api/discussions", json={
            "topic": "A's Topic", "participants": []
        }, headers={"Authorization": f"Bearer {token_a}"}).json()

        resp = client.get(f"/api/discussions/{disc['id']}", headers={"Authorization": f"Bearer {token_b}"})
        assert resp.status_code == 404


class TestAdminDiscussionEndpoints:

    def _setup(self, client):
        """Create admin + regular user with a discussion. Returns (admin_token, user_disc_id)."""
        admin_token = _register_and_get_token(client, "admin@test.com", "Admin")
        user_token = _register_and_get_token(client, "user@test.com", "User")
        disc = client.post("/api/discussions", json={
            "topic": "User's Topic", "participants": [{"id": "expert_0", "name": "Bob", "title": "Prof", "stance": "Yes", "color": "#000", "roleType": "expert"}]
        }, headers={"Authorization": f"Bearer {user_token}"}).json()
        return admin_token, disc["id"]

    def test_admin_list_all_discussions(self, client):
        admin_token, disc_id = self._setup(client)
        resp = client.get("/api/admin/discussions", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["discussions"]) >= 1
        assert data["discussions"][0]["user_name"] == "User"

    def test_admin_get_any_discussion(self, client):
        admin_token, disc_id = self._setup(client)
        resp = client.get(f"/api/admin/discussions/{disc_id}", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["user_name"] == "User"

    def test_admin_append_messages(self, client):
        admin_token, disc_id = self._setup(client)
        resp = client.post(f"/api/admin/discussions/{disc_id}/messages", json={
            "messages": [{"id": "99", "senderId": "user", "text": "Admin speaking as host", "timestamp": 5000}]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["message_count"] == 1

    def test_non_admin_cannot_use_admin_endpoints(self, client):
        admin_token, disc_id = self._setup(client)
        resp = client.post("/api/auth/register", json={
            "email": "regular@test.com", "password": "test1234", "name": "Regular"
        })
        regular_token = resp.json()["token"]

        resp = client.get("/api/admin/discussions", headers={"Authorization": f"Bearer {regular_token}"})
        assert resp.status_code == 403
