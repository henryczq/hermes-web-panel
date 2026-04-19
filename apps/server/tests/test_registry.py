from pathlib import Path

from admin_core.hermes_registry import init_registry, list_tables, default_registry_path


def test_registry_init_creates_required_tables(tmp_path: Path):
    db_path = tmp_path / "admin.db"

    init_registry(db_path)

    tables = list_tables(db_path)
    assert "config_sources" in tables
    assert "profile_bindings" in tables


def test_default_registry_path_is_under_hermes_home(tmp_path: Path, monkeypatch):
    root = tmp_path / ".hermes"
    monkeypatch.setattr("admin_core.hermes_registry.default_hermes_home", lambda: root)

    assert default_registry_path() == root / "admin_registry.sqlite3"
