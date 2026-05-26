from __future__ import annotations

from dataclasses import dataclass
import html
import os
import re
from typing import Any
from urllib.parse import urlparse

import httpx


@dataclass
class GithubTarget:
    owner: str
    repo: str | None


IGNORED_HOSTS: set[str] = {
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


def _normalize_fetch_url(raw_url: str) -> str | None:
    cleaned = str(raw_url or "").strip().strip(".,;)")
    if not cleaned:
        return None

    parsed = urlparse(cleaned)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return cleaned
    if "://" in cleaned:
        return None
    if " " in cleaned or "@" in cleaned:
        return None
    if "." not in cleaned:
        return None
    return f"https://{cleaned}"


def _hostname(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def _is_ignored_host(url: str) -> bool:
    host = _hostname(url)
    if not host:
        return True
    return host in IGNORED_HOSTS or any(host.endswith(f".{domain}") for domain in IGNORED_HOSTS)


def _github_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "jobest-professional-link-fetcher",
    }
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _extract_github_target(url: str) -> GithubTarget | None:
    parsed = urlparse(url)
    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        return None
    segments = [segment for segment in parsed.path.split("/") if segment]
    if not segments:
        return None
    owner = segments[0]
    if owner.lower() in {"features", "topics", "collections", "marketplace", "events", "explore", "settings"}:
        return None
    repo = segments[1] if len(segments) > 1 else None
    return GithubTarget(owner=owner, repo=repo)


def _parse_repo_names_from_github_html(html: str, owner: str) -> list[dict[str, Any]]:
    pattern = re.compile(rf'href="/{re.escape(owner)}/([A-Za-z0-9_.\-]+)"')
    found: dict[str, dict[str, Any]] = {}
    for match in pattern.findall(html):
        repo_name = str(match).strip()
        if not repo_name or repo_name.lower() in {"tab", "followers", "following", "stars"}:
            continue
        found[repo_name.lower()] = {
            "name": repo_name,
            "description": "",
            "language": "",
            "stars": 0,
            "url": f"https://github.com/{owner}/{repo_name}",
        }
        if len(found) >= 30:
            break
    return list(found.values())


def _main_front_page_url(url: str) -> str:
    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    host = parsed.netloc
    return f"{scheme}://{host}/"


def _normalize_text(value: str, limit: int) -> str:
    collapsed = " ".join((value or "").split()).strip()
    if not collapsed:
        return ""
    if len(collapsed) <= limit:
        return collapsed
    return collapsed[: limit - 3] + "..."


def _extract_frontpage_summary(html_text: str) -> str:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html_text, flags=re.IGNORECASE | re.DOTALL)
    title = _normalize_text(html.unescape(title_match.group(1) if title_match else ""), 120)

    meta_match = re.search(
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
        html_text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not meta_match:
        meta_match = re.search(
            r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']',
            html_text,
            flags=re.IGNORECASE | re.DOTALL,
        )
    meta_description = _normalize_text(html.unescape(meta_match.group(1) if meta_match else ""), 220)

    heading_match = re.search(r"<h1[^>]*>(.*?)</h1>", html_text, flags=re.IGNORECASE | re.DOTALL)
    if not heading_match:
        heading_match = re.search(r"<h2[^>]*>(.*?)</h2>", html_text, flags=re.IGNORECASE | re.DOTALL)
    heading_raw = heading_match.group(1) if heading_match else ""
    heading_text = re.sub(r"<[^>]+>", " ", heading_raw)
    heading = _normalize_text(html.unescape(heading_text), 120)

    parts: list[str] = []
    if title:
        parts.append(f"title={title}")
    if meta_description:
        parts.append(f"description={meta_description}")
    if heading:
        parts.append(f"heading={heading}")
    return " | ".join(parts) if parts else "Front page fetched; no clear title/description extracted."


async def _fetch_github_profile(
    client: httpx.AsyncClient,
    target: GithubTarget,
) -> dict[str, Any]:
    headers = _github_headers()
    repos: list[dict[str, Any]] = []
    details: list[str] = []

    user_url = f"https://api.github.com/users/{target.owner}"
    user_resp = await client.get(user_url, headers=headers)
    profile_ok = user_resp.status_code < 400 and isinstance(user_resp.json(), dict)
    if profile_ok:
        user_data = user_resp.json()
        login = str(user_data.get("login") or target.owner)
        display_name = str(user_data.get("name") or "").strip()
        details.append(f"github profile={login}")
        if display_name:
            details.append(f"name={display_name}")
    else:
        details.append(f"github profile={target.owner}")
        details.append(f"profile_api_status={user_resp.status_code}")

    repos_url = f"https://api.github.com/users/{target.owner}/repos"
    repos_resp = await client.get(
        repos_url,
        headers=headers,
        params={"sort": "updated", "per_page": 30, "type": "owner"},
    )
    if repos_resp.status_code < 400:
        for repo in repos_resp.json():
            if not isinstance(repo, dict):
                continue
            repo_name = str(repo.get("name") or "").strip()
            if not repo_name:
                continue
            repos.append(
                {
                    "name": repo_name,
                    "description": str(repo.get("description") or "").strip(),
                    "language": str(repo.get("language") or "").strip(),
                    "stars": int(repo.get("stargazers_count") or 0),
                    "url": str(repo.get("html_url") or "").strip(),
                }
            )
    else:
        details.append(f"repos_api_status={repos_resp.status_code}")

    if target.repo:
        repo_url = f"https://api.github.com/repos/{target.owner}/{target.repo}"
        repo_resp = await client.get(repo_url, headers=headers)
        if repo_resp.status_code < 400 and isinstance(repo_resp.json(), dict):
            repo = repo_resp.json()
            focused_name = str(repo.get("name") or "").strip()
            if focused_name and all(existing.get("name") != focused_name for existing in repos):
                repos.insert(
                    0,
                    {
                        "name": focused_name,
                        "description": str(repo.get("description") or "").strip(),
                        "language": str(repo.get("language") or "").strip(),
                        "stars": int(repo.get("stargazers_count") or 0),
                        "url": str(repo.get("html_url") or "").strip(),
                    },
                )

    if not repos:
        html_resp = await client.get(
            f"https://github.com/{target.owner}?tab=repositories",
            headers={"User-Agent": headers["User-Agent"]},
        )
        if html_resp.status_code < 400:
            repos = _parse_repo_names_from_github_html(html_resp.text, target.owner)
            if repos:
                details.append("repo_source=github_html_fallback")

    if repos:
        sample = ", ".join(item["name"] for item in repos[:5])
        details.append(f"repos={sample}")
    else:
        details.append("repos=none_detected")
        if not profile_ok:
            raise RuntimeError(f"github user fetch failed ({user_resp.status_code})")

    return {
        "summary": " | ".join(details),
        "github_repos": repos,
    }


async def fetch_professional_profiles(profile_links: dict[str, str]) -> dict[str, Any]:
    visited_links: list[dict[str, Any]] = []
    github_repos: list[dict[str, Any]] = []
    fetch_failures: list[dict[str, str]] = []

    timeout = httpx.Timeout(connect=10.0, read=15.0, write=15.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for link_type, raw_url in profile_links.items():
            link_kind = link_type.split("_")[0].lower()
            original_url = str(raw_url or "").strip()
            if not original_url:
                continue
            normalized_url = _normalize_fetch_url(original_url)
            if not normalized_url:
                visited_links.append(
                    {
                        "link_type": link_type,
                        "original_url": original_url,
                        "final_url": original_url,
                        "status": "failed",
                        "http_status": None,
                        "summary": "Invalid URL format. Use a domain like example.com or a full URL.",
                    }
                )
                fetch_failures.append({"link_type": link_type, "url": original_url, "reason": "invalid_url"})
                continue

            if _is_ignored_host(normalized_url):
                visited_links.append(
                    {
                        "link_type": link_type,
                        "original_url": original_url,
                        "final_url": normalized_url,
                        "status": "skipped",
                        "http_status": None,
                        "summary": "Skipped non-professional domain (email/provider host).",
                    }
                )
                continue

            if link_kind == "linkedin":
                visited_links.append(
                    {
                        "link_type": link_type,
                        "original_url": original_url,
                        "final_url": normalized_url,
                        "status": "skipped",
                        "http_status": None,
                        "summary": "Skipped by policy: LinkedIn is not scraped by default.",
                    }
                )
                continue

            github_target = _extract_github_target(normalized_url)
            if _hostname(normalized_url) in {"github.com", "www.github.com"} and github_target is None:
                visited_links.append(
                    {
                        "link_type": link_type,
                        "original_url": original_url,
                        "final_url": normalized_url,
                        "status": "failed",
                        "http_status": None,
                        "summary": "Invalid GitHub link. Provide a profile or repository URL.",
                    }
                )
                fetch_failures.append({"link_type": link_type, "url": normalized_url, "reason": "invalid_github_link"})
                continue
            if github_target is not None:
                try:
                    github_result = await _fetch_github_profile(client, github_target)
                    repos = github_result.get("github_repos", [])
                    if isinstance(repos, list):
                        github_repos.extend(repos)
                    visited_links.append(
                        {
                            "link_type": link_type,
                            "original_url": original_url,
                            "final_url": f"https://github.com/{github_target.owner}",
                            "status": "visited",
                            "http_status": 200,
                            "summary": str(github_result.get("summary") or "Fetched GitHub profile."),
                        }
                    )
                except Exception as exc:
                    visited_links.append(
                        {
                            "link_type": link_type,
                            "original_url": original_url,
                            "final_url": normalized_url,
                            "status": "failed",
                            "http_status": None,
                            "summary": f"Failed to fetch GitHub profile: {exc}",
                        }
                    )
                    fetch_failures.append({"link_type": link_type, "url": normalized_url, "reason": str(exc)})
                continue

            try:
                main_url = _main_front_page_url(normalized_url)
                response = await client.get(
                    main_url,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
                        )
                    },
                )
                final_url = str(response.url)
                if response.status_code >= 400:
                    reason = f"http_status_{response.status_code}"
                    visited_links.append(
                        {
                            "link_type": link_type,
                            "original_url": original_url,
                            "final_url": final_url,
                            "status": "failed",
                            "http_status": response.status_code,
                            "summary": f"Front page GET failed ({response.status_code}).",
                        }
                    )
                    fetch_failures.append({"link_type": link_type, "url": normalized_url, "reason": reason})
                    continue

                content_type = response.headers.get("content-type", "").split(";")[0].strip()
                if "html" in content_type.lower():
                    extracted = _extract_frontpage_summary(response.text)
                    summary = (
                        f"Front page scraped ({response.status_code}), content_type={content_type or 'unknown'} | {extracted}"
                    )
                else:
                    summary = (
                        f"Front page GET succeeded ({response.status_code}), content_type={content_type or 'unknown'}."
                    )
                visited_links.append(
                    {
                        "link_type": link_type,
                        "original_url": original_url,
                        "final_url": final_url,
                        "status": "visited",
                        "http_status": response.status_code,
                        "summary": summary,
                    }
                )
            except Exception as exc:
                visited_links.append(
                    {
                        "link_type": link_type,
                        "original_url": original_url,
                        "final_url": normalized_url,
                        "status": "failed",
                        "http_status": None,
                        "summary": f"GET request failed: {exc}",
                    }
                )
                fetch_failures.append({"link_type": link_type, "url": normalized_url, "reason": str(exc)})

    return {
        "visited_links": visited_links,
        "github_repos": github_repos,
        "fetch_failures": fetch_failures,
    }
