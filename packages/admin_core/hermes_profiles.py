"""Expanded profile operations: create, clone, delete, rename, summary."""

import json
import os
import re
import shutil
from pathlib import Path

import yaml

from admin_contract.models import HermesProfileSummary
from admin_core.hermes_paths import default_hermes_home


_PROFILE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")

_PROFILE_DIRS = [
    "memories", "sessions", "skills", "skins", "logs",
    "plans", "workspace", "cron", "home",
]

_CLONE_CONFIG_FILES = ["config.yaml", ".env", "SOUL.md"]
_CLONE_SUBDIR_FILES = ["memories/MEMORY.md", "memories/USER.md"]
_PROFILE_META_FILE = ".admin_profile.json"


def _profiles_root() -> Path:
    return default_hermes_home() / "profiles"


def _profile_meta_path(profile_dir: Path) -> Path:
    return profile_dir / _PROFILE_META_FILE


def _read_profile_meta(profile_dir: Path) -> dict[str, str | None]:
    meta_path = _profile_meta_path(profile_dir)
    if not meta_path.exists():
        return {"display_name": None, "note": None}
    try:
        raw = json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError):
        return {"display_name": None, "note": None}
    if not isinstance(raw, dict):
        return {"display_name": None, "note": None}
    display_name = str(raw.get("display_name") or "").strip() or None
    note = str(raw.get("note") or "").strip() or None
    return {"display_name": display_name, "note": note}


def write_profile_meta(profile_dir: Path, *, display_name: str | None = None, note: str | None = None) -> None:
    payload = {
        "display_name": (display_name or "").strip() or None,
        "note": (note or "").strip() or None,
    }
    meta_path = _profile_meta_path(profile_dir)
    meta_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _get_active_profile_name() -> str:
    path = default_hermes_home() / "active_profile"
    try:
        name = path.read_text().strip()
        return name if name else "default"
    except (FileNotFoundError, OSError):
        return "default"


def _check_gateway_running(profile_dir: Path) -> bool:
    pid_file = profile_dir / "gateway.pid"
    if not pid_file.exists():
        return False
    try:
        raw = pid_file.read_text().strip()
        if not raw:
            return False
        data = json.loads(raw) if raw.startswith("{") else {"pid": int(raw)}
        pid = int(data["pid"])
        os.kill(pid, 0)
        return True
    except (json.JSONDecodeError, KeyError, ValueError, TypeError,
            ProcessLookupError, PermissionError, OSError):
        return False


def _has_api_server(profile_dir: Path) -> bool:
    gw_state = profile_dir / "gateway_state.json"
    if not gw_state.exists():
        return False
    try:
        data = json.loads(gw_state.read_text())
        platforms = data.get("platforms", {})
        return isinstance(platforms, dict) and bool(platforms.get("api_server", {}))
    except (json.JSONDecodeError, OSError):
        return False


def _get_enabled_channels(profile_dir: Path) -> list[str]:
    """Scan config.yaml and .env for enabled channel names."""
    channels: list[str] = []
    config_path = profile_dir / "config.yaml"
    if config_path.exists():
        try:
            with open(config_path, "r") as f:
                cfg = yaml.safe_load(f) or {}
            platforms = cfg.get("platforms", {}) or {}
            for name, pcfg in platforms.items():
                if isinstance(pcfg, dict) and pcfg.get("enabled"):
                    channels.append(str(name))
        except Exception:
            pass
    env_path = profile_dir / ".env"
    if env_path.exists():
        try:
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                key, _, _ = line.partition("=")
                key = key.strip().upper()
                for env_prefix, ch_name in [
                    ("TELEGRAM_BOT_TOKEN", "telegram"),
                    ("DISCORD_BOT_TOKEN", "discord"),
                    ("SLACK_BOT_TOKEN", "slack"),
                    ("WEIXIN_TOKEN", "weixin"),
                    ("FEISHU_APP_ID", "feishu"),
                    ("WECOM_BOT_ID", "wecom"),
                    ("WHATSAPP_ENABLED", "whatsapp"),
                    ("SIGNAL_HTTP_URL", "signal"),
                    ("MATRIX_ACCESS_TOKEN", "matrix"),
                    ("DINGTALK_CLIENT_ID", "dingtalk"),
                    ("API_SERVER_ENABLED", "api_server"),
                    ("WEBHOOK_ENABLED", "webhook"),
                ]:
                    if key == env_prefix and ch_name not in channels:
                        channels.append(ch_name)
        except Exception:
            pass
    return sorted(channels)


def _read_config_model(profile_dir: Path) -> tuple:
    config_path = profile_dir / "config.yaml"
    if not config_path.exists():
        return None, None
    try:
        with open(config_path, "r") as f:
            cfg = yaml.safe_load(f) or {}
        model_cfg = cfg.get("model", {})
        if isinstance(model_cfg, str):
            return model_cfg, None
        if isinstance(model_cfg, dict):
            return (model_cfg.get("default") or model_cfg.get("model"),
                    model_cfg.get("provider"))
        return None, None
    except Exception:
        return None, None


def validate_profile_name(name: str) -> None:
    if name == "default":
        return
    if not _PROFILE_ID_RE.match(name):
        raise ValueError(
            f"Invalid profile name {name!r}. Must match [a-z0-9][a-z0-9_-]{{0,63}}"
        )


def list_profile_summaries() -> list[HermesProfileSummary]:
    root = _profiles_root()
    items: list[HermesProfileSummary] = []
    active = _get_active_profile_name()

    default_home = default_hermes_home()
    if default_home.is_dir():
        model, provider = _read_config_model(default_home)
        channels = _get_enabled_channels(default_home)
        meta = _read_profile_meta(default_home)
        items.append(HermesProfileSummary(
            name="default",
            display_name=meta.get("display_name"),
            note=meta.get("note"),
            is_active=(active == "default"),
            home_path=str(default_home),
            config_path=str(default_home / "config.yaml"),
            env_path=str(default_home / ".env"),
            has_gateway=_check_gateway_running(default_home),
            has_api_server=_has_api_server(default_home),
            channels=channels,
            default_model=model,
            provider=provider,
        ))

    if root.exists():
        for p in sorted(path for path in root.iterdir() if path.is_dir()):
            name = p.name
            if not _PROFILE_ID_RE.match(name):
                continue
            model, provider = _read_config_model(p)
            channels = _get_enabled_channels(p)
            meta = _read_profile_meta(p)
            items.append(HermesProfileSummary(
                name=name,
                display_name=meta.get("display_name"),
                note=meta.get("note"),
                is_active=(active == name),
                home_path=str(p),
                config_path=str(p / "config.yaml"),
                env_path=str(p / ".env"),
                has_gateway=_check_gateway_running(p),
                has_api_server=_has_api_server(p),
                channels=channels,
                default_model=model,
                provider=provider,
            ))
    return items


def get_profile_dir(name: str) -> Path:
    if name == "default":
        return default_hermes_home()
    return _profiles_root() / name


def profile_exists(name: str) -> bool:
    if name == "default":
        return default_hermes_home().is_dir()
    return get_profile_dir(name).is_dir()


def create_profile(
    name: str,
    clone_from: str | None = None,
    display_name: str | None = None,
    note: str | None = None,
) -> Path:
    validate_profile_name(name)
    if name == "default":
        raise ValueError("Cannot create a profile named 'default'")

    profile_dir = get_profile_dir(name)
    if profile_dir.exists():
        raise FileExistsError(f"Profile '{name}' already exists")

    source_dir = None
    if clone_from:
        source_dir = get_profile_dir(clone_from)
        if not source_dir.is_dir():
            raise FileNotFoundError(f"Source profile '{clone_from}' does not exist")

    profile_dir.mkdir(parents=True, exist_ok=True)
    for subdir in _PROFILE_DIRS:
        (profile_dir / subdir).mkdir(parents=True, exist_ok=True)

    if source_dir:
        for filename in _CLONE_CONFIG_FILES:
            src = source_dir / filename
            if src.exists():
                shutil.copy2(src, profile_dir / filename)
        for relpath in _CLONE_SUBDIR_FILES:
            src = source_dir / relpath
            if src.exists():
                dst = profile_dir / relpath
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)

    soul_path = profile_dir / "SOUL.md"
    if not soul_path.exists():
        soul_path.write_text("# SOUL\n\n")

    if clone_from and source_dir:
        source_meta = _read_profile_meta(source_dir)
        if display_name is None:
            display_name = source_meta.get("display_name")
        if note is None:
            note = source_meta.get("note")

    write_profile_meta(profile_dir, display_name=display_name, note=note)

    return profile_dir


def clone_profile(
    name: str,
    clone_from: str,
    display_name: str | None = None,
    note: str | None = None,
) -> Path:
    return create_profile(name, clone_from=clone_from, display_name=display_name, note=note)


def delete_profile(name: str) -> Path:
    validate_profile_name(name)
    if name == "default":
        raise ValueError("Cannot delete the default profile")
    profile_dir = get_profile_dir(name)
    if not profile_dir.is_dir():
        raise FileNotFoundError(f"Profile '{name}' does not exist")
    if _check_gateway_running(profile_dir):
        try:
            pid_file = profile_dir / "gateway.pid"
            data = json.loads(pid_file.read_text().strip())
            pid = int(data.get("pid", 0))
            os.kill(pid, 9)
        except Exception:
            pass
    shutil.rmtree(profile_dir)
    active_file = default_hermes_home() / "active_profile"
    try:
        if active_file.exists() and active_file.read_text().strip() == name:
            active_file.unlink()
    except OSError:
        pass
    return profile_dir


def rename_profile(old_name: str, new_name: str) -> Path:
    validate_profile_name(old_name)
    validate_profile_name(new_name)
    if old_name == "default":
        raise ValueError("Cannot rename the default profile")
    if new_name == "default":
        raise ValueError("Cannot rename to 'default'")

    old_dir = get_profile_dir(old_name)
    new_dir = get_profile_dir(new_name)
    if not old_dir.is_dir():
        raise FileNotFoundError(f"Profile '{old_name}' does not exist")
    if new_dir.exists():
        raise FileExistsError(f"Profile '{new_name}' already exists")

    old_dir.rename(new_dir)
    active_file = default_hermes_home() / "active_profile"
    try:
        if active_file.exists() and active_file.read_text().strip() == old_name:
            active_file.write_text(new_name + "\n")
    except OSError:
        pass
    return new_dir


def update_profile_meta(name: str, *, display_name: str | None = None, note: str | None = None) -> Path:
    profile_dir = get_profile_dir(name)
    if not profile_dir.is_dir():
        raise FileNotFoundError(f"Profile '{name}' does not exist")
    write_profile_meta(profile_dir, display_name=display_name, note=note)
    return profile_dir
