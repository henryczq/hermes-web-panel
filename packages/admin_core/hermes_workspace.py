"""Workspace file tree, read, and write with path whitelist."""
from pathlib import Path

_EDITABLE_FILES = {
    "SOUL.md",
    "MEMORY.md",
    "USER.md",
    "AGENTS.md",
    "config.yaml",
    ".env",
}

_MAX_EDITABLE_SIZE = 500 * 1024  # 500KB


def _workspace_root(profile_dir: Path) -> Path:
    return profile_dir


def _is_editable(path: Path, profile_dir: Path) -> bool:
    try:
        abs_path = path.resolve()
        abs_root = profile_dir.resolve()
        if str(abs_path) == str(abs_root):
            return True
        if not str(abs_path).startswith(str(abs_root)):
            return False
        rel = abs_path.relative_to(abs_root)
        parts = rel.parts
        for skip in ("__pycache__", ".git", "node_modules", ".admin_backups"):
            if skip in parts:
                return False
        if abs_path.is_file() and abs_path.stat().st_size > _MAX_EDITABLE_SIZE:
            return False
        return path.name in _EDITABLE_FILES
    except (ValueError, OSError):
        return False


def list_files(profile_dir: Path, subpath: str = "") -> list[dict]:
    root = _workspace_root(profile_dir)
    target = root / subpath if subpath else root
    if not target.exists() or not target.is_dir():
        return []

    try:
        abs_root = root.resolve()
        abs_target = target.resolve()
        if not str(abs_target).startswith(str(abs_root)):
            return []
    except (ValueError, OSError):
        return []

    entries: list[dict] = []
    try:
        for entry in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            try:
                rel = str(entry.relative_to(root))
            except ValueError:
                continue
            is_editable = _is_editable(entry, root)
            entries.append({
                "path": rel,
                "kind": "dir" if entry.is_dir() else "file",
                "editable": is_editable,
                "size": entry.stat().st_size if entry.is_file() else None,
            })
    except PermissionError:
        pass
    return entries


def read_file(profile_dir: Path, file_path: str) -> str:
    root = _workspace_root(profile_dir)
    target = (root / file_path).resolve()
    abs_root = root.resolve()
    if not str(target).startswith(str(abs_root)):
        raise ValueError("Path outside profile directory")
    if not target.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    if not target.is_file():
        raise ValueError("Not a file")
    if not _is_editable(target, root):
        raise ValueError(f"File not readable: {file_path}")
    if target.stat().st_size > _MAX_EDITABLE_SIZE:
        raise ValueError("File too large to display")
    return target.read_text(encoding="utf-8", errors="replace")


def write_file(profile_dir: Path, file_path: str, content: str) -> None:
    root = _workspace_root(profile_dir)
    target = root / file_path
    abs_root = root.resolve()
    abs_target = target.resolve()
    if not str(abs_target).startswith(str(abs_root)):
        raise ValueError("Path outside profile directory")
    if not _is_editable(target, root):
        raise ValueError(f"File not editable: {file_path}")
    abs_target.parent.mkdir(parents=True, exist_ok=True)
    tmp = abs_target.with_suffix(abs_target.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(abs_target)
