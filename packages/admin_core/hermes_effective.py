"""Effective config helpers for inherited profile settings."""

from __future__ import annotations

from pathlib import Path

from admin_core.hermes_bindings import list_profile_bindings
from admin_core.hermes_profiles import get_profile_dir
from admin_core.hermes_sources import list_config_sources


def get_bound_source_profile(profile_name: str, db_path: Path | None = None) -> str | None:
    binding = list_profile_bindings([profile_name], db_path=db_path)[0]
    if binding.mode != "inherit" or not binding.source_id:
        return None
    sources = {item.id: item for item in list_config_sources(db_path=db_path)}
    source = sources.get(binding.source_id)
    if not source:
        return None
    return source.backing_profile or source.name


def get_bound_source_dir(profile_name: str, db_path: Path | None = None) -> Path | None:
    source_profile = get_bound_source_profile(profile_name, db_path=db_path)
    if not source_profile or source_profile == profile_name:
        return None
    try:
        return get_profile_dir(source_profile)
    except Exception:
        return None


def merge_dicts(base: dict, override: dict) -> dict:
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge_dicts(result[key], value)
        elif value is None and key in result:
            continue
        else:
            result[key] = value
    return result
