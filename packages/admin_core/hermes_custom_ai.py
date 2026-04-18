"""Custom AI provider management backed by config.yaml."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib import error, parse, request

import yaml

_BUILTIN_PROVIDER_RULES = [
    {
        "provider": "openai",
        "aliases": {"openai"},
        "official_base_urls": {"https://api.openai.com/v1"},
        "label": "OpenAI",
    },
    {
        "provider": "openrouter",
        "aliases": {"openrouter"},
        "official_base_urls": {"https://openrouter.ai/api/v1"},
        "label": "OpenRouter",
    },
    {
        "provider": "anthropic",
        "aliases": {"anthropic"},
        "official_base_urls": {"https://api.anthropic.com"},
        "label": "Anthropic",
    },
    {
        "provider": "google",
        "aliases": {"google", "gemini"},
        "official_base_urls": {
            "https://generativelanguage.googleapis.com",
            "https://generativelanguage.googleapis.com/v1beta",
        },
        "label": "Google Gemini",
    },
    {
        "provider": "minimax",
        "aliases": {"minimax"},
        "official_base_urls": {"https://api.minimax.io/anthropic"},
        "label": "MiniMax 国际版",
    },
    {
        "provider": "minimax-cn",
        "aliases": {"minimax-cn", "minimax_cn"},
        "official_base_urls": {"https://api.minimaxi.com/anthropic"},
        "label": "MiniMax 国内版",
    },
    {
        "provider": "zai",
        "aliases": {"zai", "glm"},
        "official_base_urls": {"https://api.z.ai/api/coding/paas/v4"},
        "label": "GLM / z.ai",
    },
    {
        "provider": "kimi-coding",
        "aliases": {"kimi", "moonshot", "kimi-coding", "kimi_coding"},
        "official_base_urls": {
            "https://api.moonshot.cn/v1",
            "https://platform.moonshot.cn/anthropic",
        },
        "label": "Kimi / Moonshot",
    },
]


def _read_config(profile_dir: Path) -> dict:
    config_path = profile_dir / "config.yaml"
    if not config_path.exists():
        return {}
    with open(config_path, "r") as f:
        return yaml.safe_load(f) or {}


def _write_config(profile_dir: Path, cfg: dict) -> None:
    config_path = profile_dir / "config.yaml"
    tmp = config_path.with_suffix(".yaml.tmp")
    with open(tmp, "w") as f:
        yaml.dump(cfg, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
    tmp.replace(config_path)


def _normalize_provider(item: dict) -> dict:
    models = item.get("models")
    if not isinstance(models, dict):
        models = {}
    api_key = item.get("api_key")
    return {
        "name": str(item.get("name") or ""),
        "base_url": str(item.get("base_url") or ""),
        "api_key": str(api_key) if api_key is not None else None,
        "api_key_configured": bool(api_key),
        "api_mode": str(item.get("api_mode") or "") or None,
        "models": models,
    }


def list_custom_providers(profile_dir: Path) -> list[dict]:
    cfg = _read_config(profile_dir)
    custom_providers = cfg.get("custom_providers") or []
    if not isinstance(custom_providers, list):
        return []
    return [_normalize_provider(item) for item in custom_providers if isinstance(item, dict)]


def upsert_custom_provider(profile_dir: Path, provider_data: dict) -> None:
    cfg = _read_config(profile_dir)
    custom_providers = cfg.get("custom_providers") or []
    if not isinstance(custom_providers, list):
        custom_providers = []

    name = str(provider_data.get("name") or "").strip()
    if not name:
        raise ValueError("Provider name is required")

    normalized = {
        "name": name,
        "base_url": str(provider_data.get("base_url") or "").strip(),
    }
    if not normalized["base_url"]:
        raise ValueError("base_url is required")

    api_key = provider_data.get("api_key")
    if api_key:
        normalized["api_key"] = str(api_key)

    api_mode = provider_data.get("api_mode")
    if api_mode:
        normalized["api_mode"] = str(api_mode)

    models = provider_data.get("models")
    if models is not None:
        if not isinstance(models, dict):
            raise ValueError("models must be an object")
        normalized["models"] = models

    replaced = False
    updated_items: list[dict] = []
    for item in custom_providers:
        if isinstance(item, dict) and str(item.get("name") or "").strip() == name:
            updated_items.append(normalized)
            replaced = True
        else:
            updated_items.append(item)
    if not replaced:
        updated_items.append(normalized)

    cfg["custom_providers"] = updated_items
    _write_config(profile_dir, cfg)


def delete_custom_provider(profile_dir: Path, name: str) -> None:
    cfg = _read_config(profile_dir)
    custom_providers = cfg.get("custom_providers") or []
    if not isinstance(custom_providers, list):
        raise FileNotFoundError(f"Custom provider '{name}' not found")

    filtered = [
        item for item in custom_providers
        if not (isinstance(item, dict) and str(item.get("name") or "").strip() == name)
    ]
    if len(filtered) == len(custom_providers):
        raise FileNotFoundError(f"Custom provider '{name}' not found")

    if filtered:
        cfg["custom_providers"] = filtered
    else:
        cfg.pop("custom_providers", None)
    _write_config(profile_dir, cfg)


def test_custom_provider_connection(payload: dict) -> dict:
    base_url = str(payload.get("base_url") or "").strip().rstrip("/")
    if not base_url:
        raise ValueError("base_url is required")

    api_key = str(payload.get("api_key") or "").strip()
    api_mode = str(payload.get("api_mode") or "").strip() or None
    model = str(payload.get("model") or "").strip() or None

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "hermes-web-panel/0.1",
    }
    if api_key and api_key != "no-key-required":
        headers["Authorization"] = f"Bearer {api_key}"
        headers["x-api-key"] = api_key
    if api_mode == "anthropic_messages":
        headers["anthropic-version"] = "2023-06-01"

    def _build_endpoint_candidates(url: str, endpoint: str) -> list[str]:
        normalized = url.rstrip("/")
        if normalized.endswith(f"/{endpoint}"):
            return [normalized]

        candidates = [f"{normalized}/{endpoint}"]
        parsed_url = parse.urlparse(normalized)
        if "/v1" not in parsed_url.path and api_mode != "anthropic_messages":
            candidates.append(f"{normalized}/v1/{endpoint}")

        seen: set[str] = set()
        unique_candidates: list[str] = []
        for candidate in candidates:
            if candidate not in seen:
                unique_candidates.append(candidate)
                seen.add(candidate)
        return unique_candidates

    def _probe_stream() -> dict | None:
        if not model:
            return None

        if api_mode == "responses":
            endpoint = "responses"
            body = {
                "model": model,
                "input": "ping",
                "max_output_tokens": 16,
                "stream": True,
            }
        elif api_mode == "anthropic_messages":
            endpoint = "messages"
            body = {
                "model": model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 16,
                "stream": True,
            }
        else:
            endpoint = "chat/completions"
            body = {
                "model": model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 16,
                "stream": True,
            }

        tested_urls: list[str] = []
        last_error = "流式测试失败"
        for url in _build_endpoint_candidates(base_url, endpoint):
            tested_urls.append(url)
            req = request.Request(
                url,
                headers=headers,
                data=json.dumps(body).encode("utf-8"),
                method="POST",
            )
            try:
                with request.urlopen(req, timeout=10) as resp:
                    status = getattr(resp, "status", 200)
                    first_chunk = resp.read(1)
                    if first_chunk:
                        preview = first_chunk.decode("utf-8", errors="replace")
                        return {
                            "success": True,
                            "message": f"流式测试成功，已收到首个响应片段（HTTP {status}）",
                            "details": {
                                "tested_url": url,
                                "status": status,
                                "mode": api_mode or "chat_completions",
                                "model": model,
                                "first_chunk_preview": preview,
                                "strategy": "stream-first-chunk",
                            },
                        }
                    return {
                        "success": True,
                        "message": f"流式测试成功，服务端已建立连接（HTTP {status}）",
                        "details": {
                            "tested_url": url,
                            "status": status,
                            "mode": api_mode or "chat_completions",
                            "model": model,
                            "strategy": "stream-opened",
                        },
                    }
            except error.HTTPError as exc:
                body_text = exc.read().decode("utf-8", errors="replace")
                last_error = f"HTTP {exc.code}"
                if exc.code in (401, 403):
                    return {
                        "success": False,
                        "message": f"接口可达，但鉴权失败（HTTP {exc.code}）",
                        "details": {
                            "tested_url": url,
                            "status": exc.code,
                            "body": body_text[:500],
                            "mode": api_mode or "chat_completions",
                            "model": model,
                            "strategy": "stream-first-chunk",
                        },
                    }
            except error.URLError as exc:
                last_error = str(getattr(exc, "reason", exc))
            except Exception as exc:  # pragma: no cover - defensive
                last_error = str(exc)

        return {
            "success": False,
            "message": f"流式测试失败：{last_error}",
            "details": {
                "tested_urls": tested_urls,
                "mode": api_mode or "chat_completions",
                "model": model,
                "strategy": "stream-first-chunk",
            },
        }

    stream_result = _probe_stream()
    if stream_result and stream_result.get("success"):
        return stream_result

    candidates = []
    if base_url.endswith("/models"):
        candidates.append(base_url)
    else:
        candidates.append(f"{base_url}/models")
        parsed_url = parse.urlparse(base_url)
        if "/v1" not in parsed_url.path:
            candidates.append(f"{base_url}/v1/models")

    seen: set[str] = set()
    unique_candidates = []
    for url in candidates:
        if url not in seen:
            unique_candidates.append(url)
            seen.add(url)

    last_error = "连接失败"
    tested_urls: list[str] = []
    for url in unique_candidates:
        tested_urls.append(url)
        req = request.Request(url, headers=headers, method="GET")
        try:
            with request.urlopen(req, timeout=8) as resp:
                status = getattr(resp, "status", 200)
                body = resp.read().decode("utf-8", errors="replace")
                try:
                    parsed_body = json.loads(body) if body else {}
                except json.JSONDecodeError:
                    parsed_body = {"raw": body[:500]}
                model_count = None
                if isinstance(parsed_body, dict) and isinstance(parsed_body.get("data"), list):
                    model_count = len(parsed_body["data"])
                return {
                    "success": True,
                    "message": f"接口可访问（HTTP {status}）",
                    "details": {
                        "tested_url": url,
                        "status": status,
                        "model_count": model_count,
                        "response": parsed_body,
                        "model": model,
                        "strategy": "models-probe",
                    },
                }
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            last_error = f"HTTP {exc.code}"
            if exc.code in (401, 403):
                return {
                    "success": False,
                    "message": f"接口可达，但鉴权失败（HTTP {exc.code}）",
                    "details": {
                        "tested_url": url,
                        "status": exc.code,
                        "body": body[:500],
                        "model": model,
                        "strategy": "models-probe",
                    },
                }
        except error.URLError as exc:
            reason = getattr(exc, "reason", exc)
            last_error = str(reason)
        except Exception as exc:  # pragma: no cover - defensive
            last_error = str(exc)

    return {
        "success": False,
        "message": (
            f"未能连通自定义接口：{last_error}"
            if not stream_result
            else f"{stream_result.get('message')}；并且 /models 探测也失败：{last_error}"
        ),
        "details": {
            "tested_urls": tested_urls,
            "api_mode": api_mode,
            "model": model,
            "stream_result": stream_result,
            "strategy": "models-probe",
        },
    }


def _map_openclaw_api_mode(api_value: Any) -> str | None:
    api = str(api_value or "").strip().lower()
    if api in {"anthropic", "anthropic-messages", "anthropic_messages"}:
        return "anthropic_messages"
    if api in {"openai-responses", "responses", "openai_responses"}:
        return "responses"
    if api in {"openai-completions", "openai", "chat_completions", "openai_completions", "ollama"}:
        return "chat_completions"
    return None


def _normalize_openclaw_base_url(base_url: Any, api_value: Any) -> str:
    url = str(base_url or "").strip()
    api = str(api_value or "").strip().lower()
    if not url:
        return ""
    if api == "ollama" and "/v1" not in url.rstrip("/"):
        return f"{url.rstrip('/')}/v1"
    return url


def _normalize_url_for_compare(url: str) -> str:
    return url.rstrip("/").lower()


def _classify_openclaw_provider(name: str, base_url: str) -> dict | None:
    normalized_name = name.strip().lower()
    normalized_url = _normalize_url_for_compare(base_url)
    for rule in _BUILTIN_PROVIDER_RULES:
        if normalized_name in rule["aliases"]:
            if not normalized_url or normalized_url in {
                _normalize_url_for_compare(item) for item in rule["official_base_urls"]
            }:
                return {
                    "builtin_provider": rule["provider"],
                    "builtin_label": rule["label"],
                    "import_strategy": "builtin",
                    "reason": "该项已属于管理台内置支持的官方 provider，建议直接通过 AI 提供方密钥和主模型切换使用。",
                }
    return None


def _read_openclaw_provider_candidates() -> dict:
    openclaw_path = Path.home() / ".openclaw" / "openclaw.json"
    if not openclaw_path.exists():
        raise FileNotFoundError(f"{openclaw_path} not found")

    raw = json.loads(openclaw_path.read_text())
    providers = ((raw.get("models") or {}).get("providers") or {})
    if not isinstance(providers, dict):
        raise ValueError("Invalid OpenClaw config: models.providers must be an object")

    candidates: list[dict] = []
    skipped: list[str] = []
    for name, item in providers.items():
        if not isinstance(item, dict):
            skipped.append(str(name))
            continue

        provider_name = str(name).strip()
        base_url = _normalize_openclaw_base_url(item.get("baseUrl"), item.get("api"))
        if not provider_name or not base_url:
            skipped.append(str(name))
            continue

        models_list = item.get("models")
        models_map: dict[str, dict[str, Any]] = {}
        model_names: list[str] = []
        if isinstance(models_list, list):
            for model in models_list:
                if not isinstance(model, dict):
                    continue
                model_id = str(model.get("id") or model.get("name") or "").strip()
                if not model_id:
                    continue
                model_names.append(model_id)
                entry: dict[str, Any] = {}
                if model.get("contextWindow") is not None:
                    entry["context_length"] = model.get("contextWindow")
                if model.get("maxTokens") is not None:
                    entry["max_tokens"] = model.get("maxTokens")
                models_map[model_id] = entry

        api_mode = _map_openclaw_api_mode(item.get("api"))
        payload = {
            "name": provider_name,
            "base_url": base_url,
            "api_key": str(item.get("apiKey") or "").strip() or None,
            "api_mode": api_mode,
            "models": models_map or None,
        }
        classification = _classify_openclaw_provider(provider_name, base_url)
        candidate = {
            "name": provider_name,
            "base_url": base_url,
            "api_mode": api_mode,
            "api_key_configured": bool(payload["api_key"]),
            "models_count": len(model_names),
            "model_names": model_names,
            "import_strategy": "custom",
            "builtin_provider": None,
            "builtin_label": None,
            "reason": "将作为自定义 API 导入到当前 profile。",
            "payload": payload,
        }
        if classification:
            candidate.update(classification)
        candidates.append(candidate)

    return {
        "source_path": str(openclaw_path),
        "candidates": candidates,
        "skipped": skipped,
    }


def list_openclaw_import_candidates() -> dict:
    return _read_openclaw_provider_candidates()


def import_openclaw_custom_providers(profile_dir: Path, names: list[str]) -> dict:
    result = _read_openclaw_provider_candidates()
    candidates = {item["name"]: item for item in result["candidates"]}
    selected = []
    missing = []
    imported: list[str] = []
    skipped_builtin: list[str] = []

    for name in names:
        item = candidates.get(name)
        if not item:
            missing.append(name)
            continue
        selected.append(item)

    for item in selected:
        if item["import_strategy"] == "builtin":
            skipped_builtin.append(item["name"])
            continue
        upsert_custom_provider(profile_dir, item["payload"])
        imported.append(item["name"])

    return {
        "source_path": result["source_path"],
        "imported": imported,
        "skipped": result["skipped"] + skipped_builtin + missing,
        "count": len(imported),
    }
