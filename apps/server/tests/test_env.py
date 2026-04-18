import tempfile
from pathlib import Path

import pytest

from admin_core.hermes_env import (
    read_env,
    reveal_env_key,
    update_env_key,
    delete_env_key,
    write_env,
)


@pytest.fixture
def profile_dir():
    with tempfile.TemporaryDirectory() as tmp:
        yield Path(tmp)


def test_read_env_empty(profile_dir):
    result = read_env(profile_dir)
    assert result == {}


def test_read_env_with_file(profile_dir):
    (profile_dir / ".env").write_text("KEY1=value1\nKEY2=\n# comment\nKEY3=value3\n")
    result = read_env(profile_dir)
    assert result == {"KEY1": True, "KEY2": False, "KEY3": True}


def test_reveal_env_key_exists(profile_dir):
    (profile_dir / ".env").write_text("SECRET_KEY=my_secret_value\nOTHER=other_value\n")
    assert reveal_env_key(profile_dir, "SECRET_KEY") == "my_secret_value"


def test_reveal_env_key_not_found(profile_dir):
    (profile_dir / ".env").write_text("KEY1=value1\n")
    assert reveal_env_key(profile_dir, "NONEXISTENT") is None


def test_update_env_key_new(profile_dir):
    (profile_dir / ".env").write_text("KEY1=value1\n")
    update_env_key(profile_dir, "NEW_KEY", "new_value")
    assert reveal_env_key(profile_dir, "NEW_KEY") == "new_value"


def test_update_env_key_existing(profile_dir):
    (profile_dir / ".env").write_text("KEY1=old_value\n")
    update_env_key(profile_dir, "KEY1", "new_value")
    assert reveal_env_key(profile_dir, "KEY1") == "new_value"


def test_delete_env_key(profile_dir):
    (profile_dir / ".env").write_text("KEY1=value1\nKEY2=value2\n")
    delete_env_key(profile_dir, "KEY1")
    assert reveal_env_key(profile_dir, "KEY1") is None
    assert reveal_env_key(profile_dir, "KEY2") == "value2"


def test_write_env(profile_dir):
    write_env(profile_dir, {"KEY1": "value1", "KEY2": "value with spaces"})
    content = (profile_dir / ".env").read_text()
    assert "KEY1=value1" in content
    assert 'KEY2="value with spaces"' in content
