"""Config source service backed by sqlite registry."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from admin_contract.models import ConfigSourceItem
from admin_core.hermes_registry import init_registry


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_default_source(conn: sqlite3.Connection) -> None:
    now = _now()
    conn.execute(
        """
        insert or ignore into config_sources
        (id, name, kind, backing_profile, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?)
        """,
        ("source:default", "default", "default", "default", now, now),
    )


def create_config_source(
    name: str,
    backing_profile: str | None = None,
    display_name: str | None = None,
    note: str | None = None,
    db_path: Path | None = None,
) -> ConfigSourceItem:
    source_id = f"source:{name}"
    now = _now()
    if backing_profile:
        from admin_core.hermes_profiles import profile_exists
        if not profile_exists(backing_profile):
            raise FileNotFoundError(f"Profile '{backing_profile}' does not exist")
    path = init_registry(db_path)
    with sqlite3.connect(path) as conn:
        _ensure_default_source(conn)
        conn.execute(
            """
            insert into config_sources (id, name, kind, backing_profile, display_name, note, created_at, updated_at)
            values (?, ?, 'custom', ?, ?, ?, ?, ?)
            """,
            (source_id, name, backing_profile or name, display_name, note, now, now),
        )
        conn.commit()
    return ConfigSourceItem(
        id=source_id,
        name=name,
        kind='custom',
        backing_profile=backing_profile or name,
        display_name=display_name,
        note=note,
        linked_profiles=[],
    )


def list_config_sources(db_path: Path | None = None) -> list[ConfigSourceItem]:
    path = init_registry(db_path)
    with sqlite3.connect(path) as conn:
        _ensure_default_source(conn)
        rows = conn.execute(
            """
            select id, name, kind, backing_profile, display_name, note
            from config_sources
            order by case when kind='default' then 0 else 1 end, name
            """
        ).fetchall()
        binding_rows = conn.execute(
            "select source_id, profile_name from profile_bindings where source_id is not null"
        ).fetchall()

    linked: dict[str, list[str]] = {}
    for source_id, profile_name in binding_rows:
        linked.setdefault(str(source_id), []).append(str(profile_name))

    return [
        ConfigSourceItem(
            id=str(row[0]),
            name=str(row[1]),
            kind=str(row[2]),
            backing_profile=row[3],
            display_name=row[4],
            note=row[5],
            linked_profiles=sorted(linked.get(str(row[0]), [])),
        )
        for row in rows
    ]
