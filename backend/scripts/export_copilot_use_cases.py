from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "docs" / "copilot-use-cases.md"
OUTPUT = ROOT / "app" / "storage" / "demo" / "copilot_use_cases.json"


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized[:80] or "copilot-case"


def _scope_hint(prompt: str) -> str:
    lower = prompt.lower()
    if any(token in lower for token in ("this candidate", "for alex", "for priya", "for keyaan", "candidate report")):
        return "candidate"
    if any(token in lower for token in ("this posting", "this role", "this job", "job listing")):
        return "job"
    return "workspace"


def _action_class(prompt: str) -> str:
    lower = prompt.lower()
    if any(token in lower for token in ("api key", "credentials", "delete all", "secret")):
        return "guardrail"
    if any(
        token in lower
        for token in (
            "create ",
            "update ",
            "rename ",
            "change ",
            "add ",
            "run ",
            "analyze ",
            "queue ",
            "increase ",
            "set ",
            "refresh ",
            "re-run ",
        )
    ):
        return "write_or_confirmation"
    return "read_or_direct_answer"


def parse_cases(source_text: str) -> list[dict[str, str]]:
    cases: list[dict[str, str]] = []
    current_section = ""
    line_pattern = re.compile(r"^(\d+)\.\s+Prompt:\s+(.+?)\s+Expected:\s+(.+)$")

    for raw_line in source_text.splitlines():
        line = raw_line.strip()
        if line.startswith("## "):
            current_section = line[3:].strip()
            continue
        match = line_pattern.match(line)
        if not match:
            continue
        case_id = int(match.group(1))
        prompt = match.group(2).strip().replace("`", "")
        expected = match.group(3).strip()
        cases.append(
            {
                "id": case_id,
                "slug": f"{case_id:03d}-{_slugify(prompt)}",
                "section": current_section,
                "prompt": prompt,
                "expected": expected,
                "scope_hint": _scope_hint(prompt),
                "action_class": _action_class(prompt),
            }
        )
    return cases


def main() -> None:
    source_text = SOURCE.read_text(encoding="utf-8")
    cases = parse_cases(source_text)
    payload = {
        "source": str(SOURCE.relative_to(ROOT.parent)),
        "generated_case_count": len(cases),
        "cases": cases,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(cases)} cases to {OUTPUT}")


if __name__ == "__main__":
    main()
