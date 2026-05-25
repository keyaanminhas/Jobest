from pathlib import Path
import re

import fitz


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
