import os
from typing import AsyncGenerator
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "https://api.minimaxi.com/anthropic/v1")
MODEL = "MiniMax-M2.7"


class LLMService:
    def __init__(self):
        self._client = None

    @property
    def client(self) -> Anthropic:
        if self._client is None:
            self._client = Anthropic(
                api_key=ANTHROPIC_API_KEY,
                base_url=ANTHROPIC_BASE_URL,
            )
        return self._client

    async def generate_content(self, system: str, messages: list[dict], max_tokens: int = 1024) -> str:
        response = self.client.messages.create(
            model=MODEL,
            system=system,
            max_tokens=max_tokens,
            messages=messages,
        )
        return response.content[0].text

    async def stream_content(self, system: str, messages: list[dict], max_tokens: int = 1024) -> AsyncGenerator[str, None]:
        with self.client.messages.stream(
            model=MODEL,
            system=system,
            max_tokens=max_tokens,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text


_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


# Backward-compatible alias
llm_service = get_llm_service()
