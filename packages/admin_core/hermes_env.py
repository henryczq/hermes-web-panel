""".env read/write/delete/reveal."""

from pathlib import Path


def _parse_env(profile_dir: Path) -> list[tuple[str, str]]:
    env_path = profile_dir / ".env"
    if not env_path.exists():
        return []
    lines: list[tuple[str, str]] = []
    for line in env_path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        key, sep, value = stripped.partition("=")
        if sep:
            lines.append((key.strip(), value.strip()))
    return lines


def read_env(profile_dir: Path) -> dict[str, bool]:
    entries = _parse_env(profile_dir)
    return {k: (bool(v) and v != '""' and v != "''") for k, v in entries}


def reveal_env_key(profile_dir: Path, key: str) -> str | None:
    entries = _parse_env(profile_dir)
    for k, v in entries:
        if k == key:
            return v
    return None


def write_env(profile_dir: Path, variables: dict[str, str]) -> None:
    env_path = profile_dir / ".env"
    lines: list[str] = []
    for k, v in variables.items():
        if v and " " in v:
            lines.append(f'{k}="{v}"')
        else:
            lines.append(f"{k}={v}")
    tmp = env_path.with_suffix(".env.tmp")
    tmp.write_text("\n".join(lines) + "\n")
    tmp.replace(env_path)


def update_env_key(profile_dir: Path, key: str, value: str) -> None:
    env_path = profile_dir / ".env"
    lines = env_path.read_text().splitlines() if env_path.exists() else []
    found = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith(f"{key}=") or stripped.startswith(f"{key} ="):
            if value and " " in value:
                lines[i] = f'{key}="{value}"'
            else:
                lines[i] = f"{key}={value}"
            found = True
            break
    if not found:
        if value and " " in value:
            lines.append(f'{key}="{value}"')
        else:
            lines.append(f"{key}={value}")
    tmp = env_path.with_suffix(".env.tmp")
    tmp.write_text("\n".join(lines) + "\n")
    tmp.replace(env_path)


def delete_env_key(profile_dir: Path, key: str) -> None:
    env_path = profile_dir / ".env"
    if not env_path.exists():
        return
    lines = env_path.read_text().splitlines()
    filtered = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(f"{key}=") or stripped.startswith(f"{key} ="):
            continue
        filtered.append(line)
    tmp = env_path.with_suffix(".env.tmp")
    tmp.write_text("\n".join(filtered) + "\n")
    tmp.replace(env_path)
