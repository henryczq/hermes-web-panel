import tempfile
from pathlib import Path

import pytest

from admin_core.hermes_workspace import (
    list_files,
    read_file,
    write_file,
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
    assert _is_editable(profile_dir / "script.py", profile_dir) is False
    assert _is_editable(profile_dir / "data.json", profile_dir) is False
    assert _is_editable(profile_dir / "notes.txt", profile_dir) is False
