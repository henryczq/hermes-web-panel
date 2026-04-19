from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def hermes_agent_root() -> Path:
    candidates = [
        project_root().parent / "hermes-agent",
        Path.home() / ".hermes" / "hermes-agent",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def default_hermes_home() -> Path:
    return Path.home() / ".hermes"
