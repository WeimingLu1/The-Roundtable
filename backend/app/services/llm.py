import os
from typing import AsyncGenerator
from anthropic import Anthropic
from anthropic.types import TextBlock
from dotenv import load_dotenv

# Load .env file with override to ensure we get the correct values
load_dotenv(override=True)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
# SDK appends /v1/messages to base_url, so strip /v1 from the env URL
_RAW_BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "https://api.minimaxi.com/anthropic")
# Remove /v1 suffix if present since SDK adds it
if _RAW_BASE_URL.endswith("/v1"):
    ANTHROPIC_BASE_URL = _RAW_BASE_URL[:-3].rstrip("/")
else:
    ANTHROPIC_BASE_URL = _RAW_BASE_URL.rstrip("/")
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
        # Extract text from all content blocks, skipping thinking blocks
        texts = []
        for block in response.content:
            if isinstance(block, TextBlock):
                texts.append(block.text)
        return "\n".join(texts)

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
