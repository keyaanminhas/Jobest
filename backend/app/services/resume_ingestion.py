from pathlib import Path
import re
from urllib.parse import urlparse

import fitz

IGNORED_EMAIL_HOSTS: set[str] = {
    "gmail.com",
    "googlemail.com",
    "mail.google.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
    "gmx.com",
    "yandex.com",
}


class ResumeIngestionError(ValueError):
    pass


def assert_pdf_upload(filename: str | None) -> None:
    if not filename:
        raise ResumeIngestionError("Missing CV file name.")
    if not filename.lower().endswith(".pdf"):
        raise ResumeIngestionError("Only PDF uploads are supported. Please upload a .pdf file.")


def extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            text_parts = [page.get_text("text") for page in document]
    except Exception as exc:
        raise ResumeIngestionError("Could not read PDF. Please upload a valid, readable PDF.") from exc

    text = "\n".join(text_parts).strip()
    if not text:
        raise ResumeIngestionError("Uploaded PDF has no extractable text. Please upload a text-based CV PDF.")
    return text


def extract_professional_urls_from_pdf(pdf_bytes: bytes) -> list[str]:
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            text_parts = [page.get_text("text") for page in document]
            embedded_links: list[str] = []
            for page in document:
                for link in page.get_links() or []:
                    uri = str(link.get("uri") or "").strip()
                    if uri:
                        embedded_links.append(uri)
    except Exception:
        return []

    candidates: list[str] = []
    candidates.extend(embedded_links)

    text = "\n".join(text_parts)
    url_pattern = re.compile(
        r"(https?://[^\s<>()\[\]{}\"']+|www\.[^\s<>()\[\]{}\"']+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:/[^\s<>()\[\]{}\"']*)?)",
        re.IGNORECASE,
    )
    candidates.extend(url_pattern.findall(text))

    blocked_tokens = {
        "node.js",
        "next.js",
        "react.js",
        "vue.js",
        "nuxt.js",
        "express.js",
        "nestjs.com",
        "b.sc",
        "m.sc",
    }

    normalized: list[str] = []
    seen: set[str] = set()
    for raw in candidates:
        value = str(raw).strip().strip(".,;:)]}>\"'")
        if not value:
            continue
        lower_value = value.lower()
        if lower_value.startswith("mailto:"):
            continue
        if "@" in value and "://" not in value and not lower_value.startswith("www."):
            continue
        if lower_value in blocked_tokens:
            continue
        if lower_value.startswith("www."):
            value = f"https://{value}"
            lower_value = value.lower()
        elif "://" not in value:
            value = f"https://{value}"
            lower_value = value.lower()
        if not lower_value.startswith(("http://", "https://")):
            continue
        parsed = urlparse(value)
        host = (parsed.hostname or "").lower()
        if not host:
            continue
        if host in IGNORED_EMAIL_HOSTS or any(host.endswith(f".{domain}") for domain in IGNORED_EMAIL_HOSTS):
            continue
        path = parsed.path or ""
        if path == "/":
            path = ""
        canonical = f"{parsed.scheme}://{host}{path}"
        if parsed.query:
            canonical = f"{canonical}?{parsed.query}"
        if parsed.fragment:
            canonical = f"{canonical}#{parsed.fragment}"
        canonical_key = canonical.lower()
        if canonical_key in seen:
            continue
        seen.add(canonical_key)
        normalized.append(canonical)

    return normalized


def derive_candidate_name(
    *,
    resume_text: str,
    filename: str | None,
    name_override: str | None,
) -> str:
    if name_override and name_override.strip():
        return name_override.strip()

    name_from_text = _extract_name_from_text(resume_text)
    if name_from_text:
        return name_from_text

    if filename:
        stem = Path(filename).stem.strip()
        if stem:
            return stem.replace("_", " ").replace("-", " ").title()

    return "Uploaded Candidate"


def _extract_name_from_text(resume_text: str) -> str | None:
    lines = [line.strip() for line in resume_text.splitlines() if line.strip()]
    if not lines:
        return None

    prefix_patterns = [
        re.compile(r"^name\s*:\s*(.+)$", re.IGNORECASE),
        re.compile(r"^candidate\s*name\s*:\s*(.+)$", re.IGNORECASE),
    ]
    for line in lines[:20]:
        for pattern in prefix_patterns:
            match = pattern.match(line)
            if match:
                candidate = _normalize_name(match.group(1))
                if candidate:
                    return candidate

    for line in lines[:8]:
        candidate = _normalize_name(line)
        if candidate:
            return candidate

    return None


def _normalize_name(value: str) -> str | None:
    cleaned = re.sub(r"\s+", " ", value).strip()
    if not cleaned:
        return None
    if len(cleaned) < 3 or len(cleaned) > 70:
        return None
    if "@" in cleaned or "http" in cleaned.lower() or any(char.isdigit() for char in cleaned):
        return None
    words = cleaned.split(" ")
    if len(words) < 2 or len(words) > 4:
        return None
    if not re.fullmatch(r"[A-Za-z .'-]+", cleaned):
        return None
    return " ".join(word.capitalize() for word in words)
