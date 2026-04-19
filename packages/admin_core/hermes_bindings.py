"""Profile binding service for config sources."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from admin_contract.models import ProfileBindingItem
from admin_core.hermes_registry import init_registry
from admin_core.hermes_sources import list_config_sources


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def set_profile_binding(db_path: Path | None, profile_name: str, mode: str, source_id: str | None) -> None:
    if mode not in ("inherit", "standalone"):
        raise ValueError("invalid mode")
    if mode == "inherit" and not source_id:
        raise ValueError("source_id required")

    path = init_registry(db_path)
    now = _now()
    with sqlite3.connect(path) as conn:
        conn.execute(
            """
            insert into profile_bindings (profile_name, source_id, mode, created_at, updated_at)
            values (?, ?, ?, ?, ?)
            on conflict(profile_name) do update set
              source_id=excluded.source_id,
              mode=excluded.mode,
              updated_at=excluded.updated_at
            """,
            (profile_name, source_id, mode, now, now),
        )
        conn.commit()


def list_profile_bindings(profile_names: list[str], db_path: Path | None = None) -> list[ProfileBindingItem]:
    path = init_registry(db_path)
    sources = {item.id: item.name for item in list_config_sources(path)}
    with sqlite3.connect(path) as conn:
        rows = conn.execute(
            "select profile_name, mode, source_id from profile_bindings"
        ).fetchall()

    mapping = {
        str(row[0]): ProfileBindingItem(
            profile_name=str(row[0]),
            mode=str(row[1]),
            source_id=row[2],
            source_name=sources.get(row[2]) if row[2] else None,
        )
        for row in rows
    }

    result: list[ProfileBindingItem] = []
    for name in profile_names:
        item = mapping.get(name)
        if item is None:
            item = ProfileBindingItem(profile_name=name, mode="standalone", source_id=None, source_name=None)
        result.append(item)
    return result
