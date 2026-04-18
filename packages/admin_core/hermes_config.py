"""Config.yaml read/write with backup and rollback."""

import shutil
from datetime import datetime
from pathlib import Path

import yaml


def read_config_raw(profile_dir: Path) -> str:
    config_path = profile_dir / "config.yaml"
    if not config_path.exists():
        return ""
    return config_path.read_text()


def parse_config(config_path: Path) -> dict | None:
    if not config_path.exists():
        return None
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def write_config_raw(profile_dir: Path, content: str) -> None:
    yaml.safe_load(content)
    config_path = profile_dir / "config.yaml"
    tmp = config_path.with_suffix(".yaml.tmp")
    tmp.write_text(content)
    tmp.replace(config_path)


def _backup_dir(profile_dir: Path) -> Path:
    bdir = profile_dir / ".admin_backups"
    bdir.mkdir(parents=True, exist_ok=True)
    return bdir


def backup_config(profile_dir: Path) -> str:
    config_path = profile_dir / "config.yaml"
    if not config_path.exists():
        raise FileNotFoundError("config.yaml does not exist")
    bdir = _backup_dir(profile_dir)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = bdir / f"config_{ts}.yaml"
    shutil.copy2(config_path, dest)
    return str(dest)


def list_backups(profile_dir: Path) -> list[dict]:
    bdir = _backup_dir(profile_dir)
    if not bdir.exists():
        return []
    items = []
    for f in sorted(bdir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if f.name.startswith("config_") and f.name.endswith(".yaml"):
            items.append({
                "filename": f.name,
                "path": str(f),
                "size": f.stat().st_size,
                "modified": f.stat().st_mtime,
            })
    return items


def rollback_config(profile_dir: Path, backup_filename: str) -> str:
    bdir = _backup_dir(profile_dir)
    src = bdir / backup_filename
    if not src.exists():
        raise FileNotFoundError(f"Backup '{backup_filename}' not found")
    config_path = profile_dir / "config.yaml"
    tmp = bdir / "rollback_tmp.yaml"
    if config_path.exists():
        shutil.copy2(config_path, tmp)
    shutil.copy2(src, config_path)
    return str(src)


def delete_backup(profile_dir: Path, backup_filename: str) -> None:
    bdir = _backup_dir(profile_dir)
    target = bdir / backup_filename
    if not target.exists():
        raise FileNotFoundError(f"Backup '{backup_filename}' not found")
    target.unlink()
