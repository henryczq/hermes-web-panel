import tempfile
import subprocess
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

import admin_core.hermes_gateway as hermes_gateway
import admin_core.hermes_profiles as hermes_profiles
from hermes_admin_server.main import app


client = TestClient(app)


def test_gateway_action_route(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / ".hermes"
        root.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(hermes_profiles, "default_hermes_home", lambda: root)

        profile_dir = hermes_profiles.create_profile("fangan-guanli", display_name="方案管理")
        (profile_dir / "config.yaml").write_text("model:\n  default: test-model\n", encoding="utf-8")

        def fake_run_gateway_action(name: str, action: str) -> dict:
            return {
                "profile_name": name,
                "action": action,
                "has_gateway": True,
                "command": ["hermes", "--profile", name, "gateway", action],
                "stdout": "ok",
                "stderr": None,
            }

        monkeypatch.setattr(
            "hermes_admin_server.routes.hermes.run_gateway_action",
            fake_run_gateway_action,
        )

        response = client.post("/api/hermes/profiles/fangan-guanli/gateway/restart")
        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["data"]["profile_name"] == "fangan-guanli"
        assert payload["data"]["action"] == "restart"
        assert payload["data"]["has_gateway"] is True


def test_gateway_action_route_returns_400_on_runtime_error(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / ".hermes"
        root.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(hermes_profiles, "default_hermes_home", lambda: root)

        hermes_profiles.create_profile("fangan-guanli")

        def fake_run_gateway_action(name: str, action: str) -> dict:
            raise RuntimeError("gateway failed")

        monkeypatch.setattr(
            "hermes_admin_server.routes.hermes.run_gateway_action",
            fake_run_gateway_action,
        )

        response = client.post("/api/hermes/profiles/fangan-guanli/gateway/start")
        assert response.status_code == 400
        payload = response.json()
        assert payload["success"] is False
        assert payload["error"] == "gateway failed"


def test_run_gateway_action_falls_back_to_manual_start_when_service_missing(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / ".hermes"
        root.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(hermes_profiles, "default_hermes_home", lambda: root)
        monkeypatch.setattr(hermes_gateway, "default_hermes_home", lambda: root)

        profile_dir = hermes_profiles.create_profile("fangan-make")
        started_commands: list[list[str]] = []

        def fake_run(*args, **kwargs):
            command = args[0]
            if command[-2:] == ["gateway", "start"]:
                return subprocess.CompletedProcess(
                    args=command,
                    returncode=5,
                    stdout="",
                    stderr="Failed to start hermes-gateway-fangan-make.service: Unit hermes-gateway-fangan-make.service not found.",
                )
            return subprocess.CompletedProcess(
                args=command,
                returncode=0,
                stdout="ok",
                stderr="",
            )

        def fake_popen(command, **kwargs):
            started_commands.append(command)
            (profile_dir / "gateway.pid").write_text("12345", encoding="utf-8")
            return SimpleNamespace(pid=12345)

        monkeypatch.setattr(hermes_gateway.subprocess, "run", fake_run)
        monkeypatch.setattr(hermes_gateway.subprocess, "Popen", fake_popen)
        monkeypatch.setattr(hermes_gateway.time, "sleep", lambda *_args, **_kwargs: None)
        monkeypatch.setattr(hermes_gateway.os, "kill", lambda pid, sig: None)

        result = hermes_gateway.run_gateway_action("fangan-make", "start")
        assert result["has_gateway"] is True
        assert result["command"][-3:] == ["gateway", "run", "--replace"]
        assert "后台手动启动" in (result["stdout"] or "")
        assert started_commands
