"""Gateway control helpers for Hermes profiles."""

from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path

from admin_core.hermes_paths import default_hermes_home
from admin_core.hermes_profiles import _check_gateway_running, get_profile_dir

_ALLOWED_ACTIONS = {"start", "stop", "restart"}


def _resolve_hermes_command() -> list[str]:
    env_override = os.getenv("HERMES_WEB_PANEL_HERMES_BIN", "").strip() or os.getenv(
        "HERMES_ADMIN_HERMES_BIN", ""
    ).strip()
    if env_override:
        return [env_override]

    hermes_bin = shutil.which("hermes")
    if hermes_bin:
        return [hermes_bin]

    hermes_home = default_hermes_home()
    candidates = [
        hermes_home / "hermes-agent" / "venv" / "bin" / "hermes",
        hermes_home / "hermes-agent" / "venv" / "bin" / "python",
    ]
    for candidate in candidates:
        if candidate.exists():
            if candidate.name == "python":
                return [str(candidate), "-m", "hermes_cli.main"]
            return [str(candidate)]

    raise FileNotFoundError(
        "Hermes CLI executable not found. Set HERMES_WEB_PANEL_HERMES_BIN or ensure 'hermes' is in PATH."
    )


def _profile_env(name: str) -> dict[str, str]:
    env = dict(os.environ)
    if name == "default":
        env.pop("HERMES_HOME", None)
    else:
        env["HERMES_HOME"] = str(get_profile_dir(name))
    return env


def _build_gateway_command(name: str, action: str) -> list[str]:
    if action not in _ALLOWED_ACTIONS:
        raise ValueError(f"Unsupported gateway action: {action}")

    command = _resolve_hermes_command()
    if name != "default":
        command.extend(["--profile", name])
    command.extend(["gateway", action])
    return command


def _build_gateway_run_command(name: str) -> list[str]:
    command = _resolve_hermes_command()
    if name != "default":
        command.extend(["--profile", name])
    command.extend(["gateway", "run", "--replace"])
    return command


def _is_missing_service_error(text: str) -> bool:
    normalized = text.lower()
    return (
        "unit hermes-gateway" in normalized and "not found" in normalized
    ) or "gateway service is not installed" in normalized


def _manual_start_gateway(name: str) -> dict:
    profile_dir = get_profile_dir(name)
    logs_dir = profile_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_path = logs_dir / "gateway.log"
    command = _build_gateway_run_command(name)
    env = _profile_env(name)

    with open(log_path, "a", encoding="utf-8") as log_file:
        subprocess.Popen(
            command,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )

    for _ in range(20):
        if _check_gateway_running(profile_dir):
            break
        time.sleep(0.25)

    return {
        "profile_name": name,
        "action": "start",
        "has_gateway": _check_gateway_running(profile_dir),
        "command": command,
        "stdout": f"未检测到 systemd/launchd 服务，已改为后台手动启动。日志：{log_path}",
        "stderr": None,
    }


def run_gateway_action(name: str, action: str) -> dict:
    command = _build_gateway_command(name, action)
    env = _profile_env(name)
    profile_dir: Path = get_profile_dir(name)

    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=90,
        env=env,
    )

    if completed.returncode != 0:
        error_text = (completed.stderr or completed.stdout or "").strip() or f"Gateway {action} failed"
        if action in {"start", "restart"} and _is_missing_service_error(error_text):
            if action == "restart":
                stop_command = _build_gateway_command(name, "stop")
                subprocess.run(
                    stop_command,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=45,
                    env=env,
                )
            return _manual_start_gateway(name)
        raise RuntimeError(error_text)

    return {
        "profile_name": name,
        "action": action,
        "has_gateway": _check_gateway_running(profile_dir),
        "command": command,
        "stdout": (completed.stdout or "").strip() or None,
        "stderr": (completed.stderr or "").strip() or None,
    }
