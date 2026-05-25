import hashlib
import json
from pathlib import Path
from typing import Any


class CacheService:
    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def make_cache_key(agent_name: str, model: str, payload: dict[str, Any]) -> str:
        payload_raw = json.dumps(payload, sort_keys=True, ensure_ascii=True)
        payload_hash = hashlib.sha256(payload_raw.encode("utf-8")).hexdigest()
        raw = f"{agent_name}:{model}:{payload_hash}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def read(self, key: str) -> dict[str, Any] | None:
        path = self.cache_dir / f"{key}.json"
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def write(self, key: str, value: dict[str, Any]) -> None:
        path = self.cache_dir / f"{key}.json"
        path.write_text(json.dumps(value, indent=2, ensure_ascii=True), encoding="utf-8")
