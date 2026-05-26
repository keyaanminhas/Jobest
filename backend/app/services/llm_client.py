import json
import asyncio
import os
from pathlib import Path
from typing import Any

import httpx

from app.services.cache_service import CacheService
from app.services.model_router import ModelRouter, ProviderConfig


class LLMClient:
    def __init__(self) -> None:
        self.app_dir = Path(__file__).resolve().parents[1]
        self.demo_dir = self.app_dir / "storage" / "demo"
        self.cache = CacheService(self.app_dir / "storage" / "cache")
        self.router = ModelRouter.from_env()
        self.cache_enabled = self._as_bool("CACHE_LLM_RESPONSES", default=True)
        self._last_meta_by_agent: dict[str, dict[str, Any]] = {}

    @staticmethod
    def _as_bool(name: str, default: bool = False) -> bool:
        import os

        raw = os.getenv(name)
        if raw is None:
            return default
        return raw.strip().lower() == "true"

    def get_last_call_meta(self, agent_name: str) -> dict[str, Any]:
        return dict(self._last_meta_by_agent.get(agent_name, {}))

    def _select_provider_for_agent(self, agent_name: str) -> ProviderConfig:
        provider = self.router.primary
        fast_model = os.getenv("LLM_FAST_MODEL", "").strip()
        fast_agents_raw = os.getenv("LLM_FAST_AGENTS", "").strip()
        if not fast_model or not fast_agents_raw:
            return provider

        fast_agents = {item.strip() for item in fast_agents_raw.split(",") if item.strip()}
        if agent_name not in fast_agents:
            return provider

        return ProviderConfig(
            provider=provider.provider,
            base_url=provider.base_url,
            api_key=provider.api_key,
            model=fast_model,
        )

    async def call_agent(
        self,
        agent_name: str,
        system_prompt: str,
        user_payload: dict,
        temperature: float = 0.2,
    ) -> dict:
        result, meta = await self.call_agent_with_meta(
            agent_name=agent_name,
            system_prompt=system_prompt,
            user_payload=user_payload,
            temperature=temperature,
        )
        self._last_meta_by_agent[agent_name] = meta
        return result

    async def call_agent_with_meta(
        self,
        agent_name: str,
        system_prompt: str,
        user_payload: dict,
        temperature: float = 0.2,
    ) -> tuple[dict, dict[str, Any]]:
        mode = self.router.llm_mode
        primary = self._select_provider_for_agent(agent_name)
        cache_key = self.cache.make_cache_key(
            agent_name=agent_name,
            model=primary.model,
            payload=user_payload,
        )

        if mode != "mock" and self.cache_enabled:
            cached = self.cache.read(cache_key)
            if cached is not None:
                return cached, {
                    "status": "completed",
                    "source": "cache",
                    "provider": primary.provider,
                    "model": primary.model,
                    "cache_key": cache_key,
                    "repaired": False,
                    "errors": [],
                }

        if mode == "mock":
            data = self._read_mock(agent_name)
            return data, {
                "status": "completed",
                "source": "mock",
                "provider": "mock",
                "model": "mock",
                "cache_key": cache_key,
                "repaired": False,
                "errors": [],
            }

        if mode == "cached":
            raise RuntimeError(f"Cache miss for agent '{agent_name}' in CACHED mode")

        errors: list[str] = []
        candidates: list[ProviderConfig] = [primary]
        if self.router.allow_fallback and self.router.fallback is not None:
            candidates.append(self.router.fallback)

        for idx, provider in enumerate(candidates):
            try:
                parsed, repaired = await self._call_provider_with_repair(
                    provider=provider,
                    system_prompt=system_prompt,
                    user_payload=user_payload,
                    temperature=temperature,
                )
                provider_cache_key = self.cache.make_cache_key(
                    agent_name=agent_name,
                    model=provider.model,
                    payload=user_payload,
                )
                if self.cache_enabled:
                    self.cache.write(provider_cache_key, parsed)
                return parsed, {
                    "status": "completed",
                    "source": "live" if idx == 0 else "live_fallback_provider",
                    "provider": provider.provider,
                    "model": provider.model,
                    "cache_key": provider_cache_key,
                    "repaired": repaired,
                    "errors": errors,
                }
            except Exception as exc:
                detail = str(exc).strip() or repr(exc)
                errors.append(f"provider={provider.provider} error={type(exc).__name__}: {detail}")

        mock_data = self._read_mock(agent_name)
        return mock_data, {
            "status": "completed_with_fallback",
            "source": "mock_fallback",
            "provider": "mock",
            "model": "mock",
            "cache_key": cache_key,
            "repaired": False,
            "errors": errors,
        }

    async def _call_provider_with_repair(
        self,
        provider: ProviderConfig,
        system_prompt: str,
        user_payload: dict,
        temperature: float,
    ) -> tuple[dict, bool]:
        raw = await self._call_provider_raw(
            provider=provider,
            system_prompt=system_prompt,
            user_payload=user_payload,
            temperature=temperature,
        )

        try:
            return self._parse_json_strict(raw), False
        except Exception:
            repair_prompt = (
                "You must output valid JSON only. Repair invalid JSON content while preserving meaning. "
                "Do not add explanations or markdown fences."
            )
            repair_payload = {
                "invalid_json_output": raw,
                "original_input_payload": user_payload,
            }
            repaired = await self._call_provider_raw(
                provider=provider,
                system_prompt=repair_prompt,
                user_payload=repair_payload,
                temperature=0.0,
            )
            return self._parse_json_strict(repaired), True

    def _read_mock(self, agent_name: str) -> dict:
        path = self.demo_dir / f"{agent_name}.json"
        if not path.exists():
            raise RuntimeError(f"Mock file not found: {path}")
        return json.loads(path.read_text(encoding="utf-8"))

    async def _call_provider_raw(
        self,
        provider: ProviderConfig,
        system_prompt: str,
        user_payload: dict,
        temperature: float,
    ) -> str:
        if not provider.base_url:
            raise RuntimeError("Provider base URL is not configured")

        url = provider.base_url.rstrip("/") + "/chat/completions"
        headers = {"Content-Type": "application/json"}
        if provider.api_key:
            headers["Authorization"] = f"Bearer {provider.api_key}"

        body = {
            "model": provider.model,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload, ensure_ascii=True)},
            ],
        }

        last_error: Exception | None = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(url, headers=headers, json=body)

                if resp.status_code in {408, 409, 429, 500, 502, 503, 504} and attempt < 2:
                    await asyncio.sleep(1.2 * (attempt + 1))
                    continue

                if resp.status_code >= 400:
                    excerpt = resp.text[:300].replace("\n", " ").strip()
                    raise RuntimeError(f"LLM provider error {resp.status_code}: {excerpt}")

                data = resp.json()
                return self._extract_content(data)
            except (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError) as exc:
                last_error = exc
                if attempt < 2:
                    await asyncio.sleep(1.2 * (attempt + 1))
                    continue
                raise RuntimeError(f"LLM transport error after retries: {exc}") from exc
            except json.JSONDecodeError as exc:
                last_error = exc
                if attempt < 2:
                    await asyncio.sleep(0.8 * (attempt + 1))
                    continue
                raise RuntimeError(f"LLM response was not valid JSON: {exc}") from exc

        if last_error is not None:
            raise RuntimeError(f"LLM request failed: {last_error}") from last_error
        raise RuntimeError("LLM request failed without a captured exception")

    @staticmethod
    def _extract_content(data: dict[str, Any]) -> str:
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("LLM response missing choices")
        message = choices[0].get("message", {})
        content = message.get("content", "")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    parts.append(str(item.get("text", "")))
            return "\n".join(parts)
        return str(content)

    @staticmethod
    def _strip_json_fences(content: str) -> str:
        text = content.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()
            if text.lower().startswith("json"):
                text = text[4:].strip()
        return text

    def _parse_json_strict(self, content: str) -> dict:
        text = self._strip_json_fences(content)
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            raise RuntimeError("Agent output must be a JSON object")
        return parsed
