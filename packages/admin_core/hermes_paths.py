from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def hermes_agent_root() -> Path:
    return project_root().parent / "hermes-agent"


def default_hermes_home() -> Path:
    return Path.home() / ".hermes"
