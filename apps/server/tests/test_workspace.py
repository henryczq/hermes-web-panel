import tempfile
from pathlib import Path

import pytest

from admin_core.hermes_workspace import (
    list_files,
    read_file,
    write_file,
    backup_file,
    list_file_backups,
    restore_file_backup,
    _is_editable,
    _EDITABLE_FILES,
)


@pytest.fixture
def profile_dir():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp)
        (p / "MEMORY.md").write_text("# Memory\n")
        (p / "USER.md").write_text("# User\n")
        (p / "AGENTS.md").write_text("# Agents\n")
        (p / "SOUL.md").write_text("# Soul\n")
        (p / "config.yaml").write_text("key: value\n")
        (p / ".env").write_text("KEY=value\n")
        (p / "script.py").write_text("print('hello')\n")
        (p / "data.json").write_text("{}\n")
        (p / "README.md").write_text("# Readme\n")
        (p / "RULES.md").write_text("# Rules\n")
        (p / "notes").mkdir()
        (p / "notes" / "handoff.md").write_text("# Handoff\n")
        (p / "docs").mkdir()
        (p / "docs" / "faq.md").write_text("# FAQ\n")
        (p / "sessions").mkdir()
        (p / "sessions" / "hidden.md").write_text("# Hidden\n")
        yield p


def test_list_files_shows_all_entries(profile_dir):
    entries = list_files(profile_dir)
    names = [e["path"] for e in entries]
    assert "MEMORY.md" in names
    assert "USER.md" in names
    assert "script.py" in names
    assert "data.json" in names


def test_editable_only_whitelist_files(profile_dir):
    entries = list_files(profile_dir)
    editable = {e["path"] for e in entries if e.get("editable")}
    assert "MEMORY.md" in editable
    assert "USER.md" in editable
    assert "AGENTS.md" in editable
    assert "SOUL.md" in editable
    assert "config.yaml" in editable
    assert ".env" in editable
    assert "README.md" in editable
    assert "RULES.md" in editable
    assert "script.py" not in editable
    assert "data.json" not in editable


def test_read_editable_file(profile_dir):
    content = read_file(profile_dir, "MEMORY.md")
    assert "# Memory" in content


def test_read_nonexistent_file(profile_dir):
    with pytest.raises(FileNotFoundError):
        read_file(profile_dir, "nonexistent.md")


def test_write_editable_file(profile_dir):
    write_file(profile_dir, "MEMORY.md", "# Updated Memory\n")
    content = read_file(profile_dir, "MEMORY.md")
    assert "# Updated Memory" in content


def test_write_non_editable_file_raises(profile_dir):
    with pytest.raises(ValueError, match="File not editable"):
        write_file(profile_dir, "script.py", "print('hack')\n")


def test_read_non_editable_file_raises(profile_dir):
    with pytest.raises(ValueError, match="File not readable"):
        read_file(profile_dir, "script.py")


def test_is_editable_respects_whitelist(profile_dir):
    assert _is_editable(profile_dir / "MEMORY.md", profile_dir) is True
    assert _is_editable(profile_dir / "config.yaml", profile_dir) is True
    assert _is_editable(profile_dir / ".env", profile_dir) is True
    assert _is_editable(profile_dir / "README.md", profile_dir) is True
    assert _is_editable(profile_dir / "RULES.md", profile_dir) is True
    assert _is_editable(profile_dir / "notes" / "handoff.md", profile_dir) is True
    assert _is_editable(profile_dir / "docs" / "faq.md", profile_dir) is True
    assert _is_editable(profile_dir / "script.py", profile_dir) is False
    assert _is_editable(profile_dir / "data.json", profile_dir) is False
    assert _is_editable(profile_dir / "notes.txt", profile_dir) is False
    assert _is_editable(profile_dir / "sessions" / "hidden.md", profile_dir) is False


def test_list_files_supports_custom_doc_subdirs(profile_dir):
    note_entries = list_files(profile_dir, "notes")
    note_names = [e["path"] for e in note_entries]
    assert "notes/handoff.md" in note_names
    assert next(e for e in note_entries if e["path"] == "notes/handoff.md")["editable"] is True

    docs_entries = list_files(profile_dir, "docs")
    docs_names = [e["path"] for e in docs_entries]
    assert "docs/faq.md" in docs_names


def test_backup_and_restore_workspace_file(profile_dir):
    backup_path = backup_file(profile_dir, "SOUL.md")
    assert Path(backup_path).exists()

    write_file(profile_dir, "SOUL.md", "# Changed Soul\n")
    restore_file_backup(profile_dir, "SOUL.md", Path(backup_path).name)
    content = read_file(profile_dir, "SOUL.md")
    assert "# Soul" in content


def test_list_workspace_file_backups(profile_dir):
    backup_path = backup_file(profile_dir, "USER.md")
    items = list_file_backups(profile_dir, "USER.md")
    assert len(items) == 1
    assert items[0]["filename"] == Path(backup_path).name
    assert items[0]["target_path"] == "USER.md"
