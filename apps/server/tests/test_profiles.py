import tempfile
from pathlib import Path

import admin_core.hermes_profiles as hermes_profiles


def test_create_profile_persists_display_name_and_note(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / ".hermes"
        root.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(hermes_profiles, "default_hermes_home", lambda: root)

        profile_dir = hermes_profiles.create_profile(
            "fangan-guanli",
            display_name="方案管理",
            note="飞书正式环境",
        )

        assert profile_dir == root / "profiles" / "fangan-guanli"

        summaries = hermes_profiles.list_profile_summaries()
        created = next(item for item in summaries if item.name == "fangan-guanli")
        assert created.display_name == "方案管理"
        assert created.note == "飞书正式环境"


def test_update_profile_meta_updates_existing_profile(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / ".hermes"
        root.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(hermes_profiles, "default_hermes_home", lambda: root)

        default_dir = root
        (default_dir / "config.yaml").write_text("model:\n  default: test-model\n")
        hermes_profiles.write_profile_meta(default_dir, display_name="主环境", note="默认档案")

        hermes_profiles.update_profile_meta("default", display_name="生产环境", note="微信+飞书")

        summaries = hermes_profiles.list_profile_summaries()
        default_summary = next(item for item in summaries if item.name == "default")
        assert default_summary.display_name == "生产环境"
        assert default_summary.note == "微信+飞书"
