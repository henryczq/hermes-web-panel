"""Read bundled China channel definitions for Hermes Web Panel."""

from __future__ import annotations

import json
import os
from pathlib import Path

from admin_core.hermes_paths import project_root


def bundled_china_definitions_root() -> Path:
    return project_root() / "vendor" / "openclaw-china-definitions"


def china_definitions_root() -> Path:
    override = os.getenv("HERMES_WEB_PANEL_CHINA_DEFINITIONS_ROOT", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return bundled_china_definitions_root()


def _read_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_china_channel_registry() -> list[dict]:
    registry_path = china_definitions_root() / "channel-plugins.registry.json"
    if not registry_path.exists():
        return []
    return _read_json(registry_path)


def get_china_channel_detail(detail_doc_id: str) -> dict | None:
    if not detail_doc_id.strip():
        return None
    detail_path = china_definitions_root() / "channel-plugin-details" / f"{detail_doc_id}.json"
    if not detail_path.exists():
        return None
    return _read_json(detail_path)


def get_china_channels_bundle() -> dict:
    registry = get_china_channel_registry()
    items: list[dict] = []
    for entry in registry:
        detail_doc_id = str(entry.get("detailDocId") or "").strip()
        items.append(
            {
                **entry,
                "detail": get_china_channel_detail(detail_doc_id) if detail_doc_id else None,
            }
        )
    return {
        "source_root": str(china_definitions_root()),
        "count": len(items),
        "items": items,
    }
