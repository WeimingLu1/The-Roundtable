import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_topics_random_endpoint():
    mock_response = '{"topic": "Is AI dangerous?", "description": "Discuss AI safety"}'
    with patch("app.services.llm.LLMService.generate_content", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_response
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/api/topics/random")
            assert response.status_code == 200
            data = response.json()
            assert "topic" in data
            assert data["topic"] == "Is AI dangerous?"


@pytest.mark.asyncio
async def test_panel_generate_endpoint():
    mock_response = """[
        {"id": "p1", "name": "Alice Smith", "title": "AI Researcher", "stance": "Pro AI", "color": "#FF0000"},
        {"id": "p2", "name": "Bob Jones", "title": "Ethicist", "stance": "Cautious about AI", "color": "#00FF00"},
        {"id": "p3", "name": "Carol Lee", "title": "Engineer", "stance": "Neutral", "color": "#0000FF"}
    ]"""
    with patch("app.services.llm.LLMService.generate_content", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_response
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/api/panel/generate?topic=Is%20AI%20dangerous%3F")
            assert response.status_code == 200
            data = response.json()
            assert "participants" in data
            assert len(data["participants"]) == 3
