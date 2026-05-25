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

    @staticmethod
    def _is_placeholder(value: str) -> bool:
        normalized = value.strip().lower()
        return normalized in {
            "",
            "your_key_here",
            "change-this-demo-key",
            "changeme",
            "replace-me",
            "replace_this",
        }

    @staticmethod
    def _first_nonempty(*values: str) -> str:
        for value in values:
            if value and value.strip() and not ModelRouter._is_placeholder(value):
                return value.strip()
        return ""

    @classmethod
    def from_env(cls) -> "ModelRouter":
        mode = os.getenv("LLM_MODE", "mock").strip().lower()
        if os.getenv("USE_MOCK_LLM", "false").strip().lower() == "true":
            mode = "mock"

        primary_provider = os.getenv("LLM_PROVIDER", "nvidia").strip().lower()
        fallback_provider = os.getenv("FALLBACK_PROVIDER", "openrouter").strip().lower()

        primary_api_key = cls._first_nonempty(
            os.getenv("LLM_API_KEY", ""),
            os.getenv(
                {
                    "nvidia": "NVIDIA_API_KEY",
                    "openrouter": "OPENROUTER_API_KEY",
                    "chutes": "CHUTES_API_KEY",
                }.get(primary_provider, ""),
                "",
            ),
        )
        fallback_api_key = cls._first_nonempty(
            os.getenv("FALLBACK_API_KEY", ""),
            os.getenv(
                {
                    "nvidia": "NVIDIA_API_KEY",
                    "openrouter": "OPENROUTER_API_KEY",
                    "chutes": "CHUTES_API_KEY",
                }.get(fallback_provider, ""),
                "",
            ),
        )

        primary_base_url = cls._first_nonempty(
            os.getenv("LLM_BASE_URL", ""),
            os.getenv(
                {
                    "nvidia": "NVIDIA_BASE_URL",
                    "openrouter": "OPENROUTER_BASE_URL",
                    "chutes": "CHUTES_BASE_URL",
                }.get(primary_provider, ""),
                "",
            ),
            "https://integrate.api.nvidia.com/v1",
        )
        fallback_base_url = cls._first_nonempty(
            os.getenv("FALLBACK_BASE_URL", ""),
            os.getenv(
                {
                    "nvidia": "NVIDIA_BASE_URL",
                    "openrouter": "OPENROUTER_BASE_URL",
                    "chutes": "CHUTES_BASE_URL",
                }.get(fallback_provider, ""),
                "",
            ),
            "https://openrouter.ai/api/v1",
        )

        primary = ProviderConfig(
            provider=primary_provider,
            base_url=primary_base_url,
            api_key=primary_api_key,
            model=os.getenv("LLM_MODEL", "meta/llama-3.1-70b-instruct"),
        )

        fallback = ProviderConfig(
            provider=fallback_provider,
            base_url=fallback_base_url,
            api_key=fallback_api_key,
            model=os.getenv("FALLBACK_MODEL", "meta/llama-3.1-70b-instruct"),
        )

        allow_fallback = os.getenv("ALLOW_PROVIDER_FALLBACK", "true").strip().lower() == "true"
        return cls(
            app_env=os.getenv("APP_ENV", "dev"),
            llm_mode=mode,
            allow_fallback=allow_fallback,
            primary=primary,
            fallback=fallback,
        )
