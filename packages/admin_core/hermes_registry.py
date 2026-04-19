"""SQLite registry for config sources and profile bindings."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from admin_core.hermes_paths import default_hermes_home


SCHEMA = """
create table if not exists config_sources (
  id text primary key,
  name text not null unique,
  kind text not null,
  backing_profile text,
  display_name text,
  note text,
  created_at text not null,
  updated_at text not null
);
create table if not exists profile_bindings (
  profile_name text primary key,
  source_id text,
  mode text not null,
  created_at text not null,
  updated_at text not null
);
"""


def default_registry_path() -> Path:
    return default_hermes_home() / "admin_registry.sqlite3"


def init_registry(db_path: Path | None = None) -> Path:
    path = db_path or default_registry_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA)
        conn.commit()
    return path


def list_tables(db_path: Path | None = None) -> list[str]:
    path = init_registry(db_path)
    with sqlite3.connect(path) as conn:
        rows = conn.execute(
            "select name from sqlite_master where type='table' order by name"
        ).fetchall()
    return [str(row[0]) for row in rows]
