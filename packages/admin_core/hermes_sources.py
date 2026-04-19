"""Config source service backed by sqlite registry."""

from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from admin_contract.models import ConfigSourceItem
from admin_core.hermes_registry import init_registry


_PROFILE_SLUG_RE = re.compile(r"[^a-z0-9_-]+")


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


def _source_id(name: str) -> str:
    return f"source:{name}"


def _default_backing_profile_name(name: str) -> str:
    normalized = _PROFILE_SLUG_RE.sub("-", (name or "").strip().lower())
    normalized = normalized.strip("-_")
    if not normalized:
        normalized = "shared-config"
    if normalized == "default":
        normalized = "shared-default"
    if not normalized[0].isalnum():
        normalized = f"shared-{normalized}"
    return normalized[:64]


def _ensure_backing_profile_exists(
    source_name: str,
    backing_profile: str | None,
    display_name: str | None,
) -> str:
    from admin_core.hermes_profiles import create_profile, profile_exists

    effective_backing_profile = (backing_profile or "").strip() or _default_backing_profile_name(source_name)
    if backing_profile:
        if not profile_exists(effective_backing_profile):
            raise FileNotFoundError(f"Profile '{effective_backing_profile}' does not exist")
        return effective_backing_profile

    if not profile_exists(effective_backing_profile):
        create_profile(
            effective_backing_profile,
            display_name=display_name or source_name,
            note=f"Backing profile for shared config source '{source_name}'",
        )
    return effective_backing_profile


def create_config_source(
    name: str,
    backing_profile: str | None = None,
    display_name: str | None = None,
    note: str | None = None,
    db_path: Path | None = None,
) -> ConfigSourceItem:
    name = (name or "").strip()
    if not name:
        raise ValueError("Config source name is required")
    source_id = _source_id(name)
    now = _now()
    effective_backing_profile = _ensure_backing_profile_exists(name, backing_profile, display_name)
    path = init_registry(db_path)
    with sqlite3.connect(path) as conn:
        _ensure_default_source(conn)
        conn.execute(
            """
            insert into config_sources (id, name, kind, backing_profile, display_name, note, created_at, updated_at)
            values (?, ?, 'custom', ?, ?, ?, ?, ?)
            """,
            (source_id, name, effective_backing_profile, display_name, note, now, now),
        )
        conn.commit()
    return ConfigSourceItem(
        id=source_id,
        name=name,
        kind='custom',
        backing_profile=effective_backing_profile,
        display_name=display_name,
        note=note,
        linked_profiles=[],
    )


def update_config_source(
    source_id: str,
    name: str | None = None,
    backing_profile: str | None = None,
    display_name: str | None = None,
    note: str | None = None,
    db_path: Path | None = None,
) -> ConfigSourceItem:
    path = init_registry(db_path)
    now = _now()
    with sqlite3.connect(path) as conn:
        cur = conn.execute(
            "select id, name, kind, backing_profile, display_name, note from config_sources where id=?",
            (source_id,),
        )
        row = cur.fetchone()
        if not row:
            raise FileNotFoundError(f"Config source '{source_id}' not found")
        current_name = str(row[1])
        current_display_name = row[4]
        next_name = (name or "").strip() or current_name
        next_source_id = _source_id(next_name)
        next_backing_profile = _ensure_backing_profile_exists(
            next_name,
            backing_profile if backing_profile is not None else row[3],
            display_name if display_name is not None else current_display_name,
        )
        if next_source_id != source_id:
            duplicate = conn.execute(
                "select 1 from config_sources where id=?",
                (next_source_id,),
            ).fetchone()
            if duplicate:
                raise FileExistsError(f"Config source '{next_name}' already exists")
        conn.execute(
            """
            update config_sources
            set id=?, name=?, backing_profile=?, display_name=?, note=?, updated_at=?
            where id=?
            """,
            (
                next_source_id,
                next_name,
                next_backing_profile,
                display_name,
                note,
                now,
                source_id,
            ),
        )
        if next_source_id != source_id:
            conn.execute(
                "update profile_bindings set source_id=?, updated_at=? where source_id=?",
                (next_source_id, now, source_id),
            )
        conn.commit()
    items = list_config_sources(path)
    for item in items:
        if item.id == next_source_id:
            return item
    raise FileNotFoundError(f"Config source '{next_source_id}' not found")


def delete_config_source(source_id: str, db_path: Path | None = None) -> None:
    path = init_registry(db_path)
    with sqlite3.connect(path) as conn:
        row = conn.execute(
            "select kind from config_sources where id=?",
            (source_id,),
        ).fetchone()
        if not row:
            raise FileNotFoundError(f"Config source '{source_id}' not found")
        if str(row[0]) == "default":
            raise ValueError("Default config source cannot be deleted")
        conn.execute("delete from profile_bindings where source_id=?", (source_id,))
        conn.execute("delete from config_sources where id=?", (source_id,))
        conn.commit()


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


def repair_missing_backing_profiles(db_path: Path | None = None) -> list[dict[str, str]]:
    from admin_core.hermes_profiles import create_profile, profile_exists, validate_profile_name

    repaired: list[dict[str, str]] = []
    path = init_registry(db_path)
    for item in list_config_sources(db_path):
        backing_profile = (item.backing_profile or item.name or "").strip()
        if not backing_profile:
            continue
        target_backing_profile = backing_profile
        try:
            validate_profile_name(target_backing_profile)
        except ValueError:
            target_backing_profile = _default_backing_profile_name(item.name)

        if target_backing_profile != backing_profile:
            with sqlite3.connect(path) as conn:
                conn.execute(
                    "update config_sources set backing_profile=?, updated_at=? where id=?",
                    (target_backing_profile, _now(), item.id),
                )
                conn.commit()

        if profile_exists(backing_profile):
            if target_backing_profile != backing_profile:
                repaired.append({
                    "source_id": item.id,
                    "source_name": item.name,
                    "backing_profile": target_backing_profile,
                })
            continue

        create_profile(
            target_backing_profile,
            display_name=item.display_name or item.name,
            note=f"Backing profile repaired for shared config source '{item.name}'",
        )
        repaired.append({
            "source_id": item.id,
            "source_name": item.name,
            "backing_profile": target_backing_profile,
        })

    return repaired
