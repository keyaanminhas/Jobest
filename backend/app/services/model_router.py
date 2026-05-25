from dataclasses import dataclass
import os


@dataclass
class ProviderConfig:
    provider: str
    base_url: str
    api_key: str
    model: str


@dataclass
class ModelRouter:
    app_env: str
    llm_mode: str
    allow_fallback: bool
    primary: ProviderConfig
    fallback: ProviderConfig | None

    @classmethod
    def from_env(cls) -> "ModelRouter":
        mode = os.getenv("LLM_MODE", "mock").strip().lower()
        if os.getenv("USE_MOCK_LLM", "false").strip().lower() == "true":
            mode = "mock"

        primary = ProviderConfig(
            provider=os.getenv("LLM_PROVIDER", "nvidia"),
            base_url=os.getenv("LLM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
            api_key=os.getenv("LLM_API_KEY", ""),
            model=os.getenv("LLM_MODEL", "minimaxai/minimax-m2.7"),
        )

        fallback = ProviderConfig(
            provider=os.getenv("FALLBACK_PROVIDER", "openrouter"),
            base_url=os.getenv("FALLBACK_BASE_URL", "https://openrouter.ai/api/v1"),
            api_key=os.getenv("FALLBACK_API_KEY", ""),
            model=os.getenv("FALLBACK_MODEL", "nousresearch/hermes-3-llama-3.1-405b:free"),
        )

        allow_fallback = os.getenv("ALLOW_PROVIDER_FALLBACK", "true").strip().lower() == "true"
        return cls(
            app_env=os.getenv("APP_ENV", "dev"),
            llm_mode=mode,
            allow_fallback=allow_fallback,
            primary=primary,
            fallback=fallback,
        )
