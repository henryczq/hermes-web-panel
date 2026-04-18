import tempfile
from pathlib import Path
from types import SimpleNamespace

import pytest
import admin_core.hermes_onboarding as hermes_onboarding

from admin_core.hermes_channels import (
    list_channels,
    get_channel_snapshot,
    update_channel_config,
    _parse_profile_env,
)
from admin_core.hermes_onboarding import (
    start_onboard_session,
    get_onboard_session,
    apply_onboard_session,
    _simulate_scan_complete,
)


@pytest.fixture
def profile_dir():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp)
        (p / "config.yaml").write_text("platforms:\n  telegram:\n    enabled: true\n")
        (p / ".env").write_text("TELEGRAM_BOT_TOKEN=test_token_123\nDISCORD_BOT_TOKEN=\n")
        yield p


def test_parse_profile_env(profile_dir):
    env = _parse_profile_env(profile_dir)
    assert env.get("TELEGRAM_BOT_TOKEN") == "test_token_123"
    assert env.get("DISCORD_BOT_TOKEN") == ""


def test_get_channel_snapshot_telegram(profile_dir):
    snapshot = get_channel_snapshot(profile_dir, "telegram")
    assert snapshot["channel_id"] == "telegram"
    assert snapshot["enabled"] is True
    assert snapshot["configured"] is True


def test_get_channel_snapshot_discord_disabled(profile_dir):
    snapshot = get_channel_snapshot(profile_dir, "discord")
    assert snapshot["channel_id"] == "discord"
    assert snapshot["enabled"] is False


def test_get_channel_snapshot_token_only_env_marks_enabled():
    with tempfile.TemporaryDirectory() as tmp:
        profile_dir = Path(tmp)
        (profile_dir / "config.yaml").write_text("platforms: {}\n")
        (profile_dir / ".env").write_text("TELEGRAM_BOT_TOKEN=token_only_value\n")

        snapshot = get_channel_snapshot(profile_dir, "telegram")

        assert snapshot["enabled"] is True
        assert snapshot["configured"] is True


def test_list_channels_returns_active(profile_dir):
    channels = list_channels(profile_dir)
    assert "telegram" in channels
    assert "discord" not in channels


def test_update_channel_config_env_keys(profile_dir):
    update_channel_config(profile_dir, "telegram", {"token": "new_token_456"})
    env = _parse_profile_env(profile_dir)
    assert env.get("TELEGRAM_BOT_TOKEN") == "new_token_456"


def test_update_channel_config_yaml_keys(profile_dir):
    update_channel_config(profile_dir, "telegram", {"webhook_url": "https://example.com/webhook"})
    import yaml
    with open(profile_dir / "config.yaml") as f:
        cfg = yaml.safe_load(f)
    assert cfg["platforms"]["telegram"]["webhook_url"] == "https://example.com/webhook"


def test_update_channel_config_unknown_channel(profile_dir):
    with pytest.raises(ValueError, match="Unknown channel"):
        update_channel_config(profile_dir, "unknown_channel", {"key": "value"})


def test_update_channel_config_wecom_bot_yaml_keys(profile_dir):
    update_channel_config(profile_dir, "wecom_bot", {"websocket_url": "wss://custom.wecom/ws"})
    env = _parse_profile_env(profile_dir)
    assert env["WECOM_WEBSOCKET_URL"] == "wss://custom.wecom/ws"


def test_onboard_session_wecom_bot_roundtrip(profile_dir):
    now = hermes_onboarding._utc_now()
    monkeypatch_session = {
        "session_id": "wecom-session-1",
        "channel_id": "wecom_bot",
        "qr_url": "https://work.weixin.qq.com/ai/qc/mock",
        "verification_url": "https://work.weixin.qq.com/ai/qc/mock",
        "scode": "mock-scode",
        "status": "pending",
        "credentials": None,
        "created_at": now,
        "updated_at": now,
        "next_poll_at": now + 1,
        "expires_at": now + 300,
        "error": None,
    }
    hermes_onboarding._sessions.clear()
    hermes_onboarding._sessions[monkeypatch_session["session_id"]] = {
        **monkeypatch_session,
        "profile_dir": str(profile_dir),
    }
    session = {"session_id": "wecom-session-1", "qr_url": "https://work.weixin.qq.com/ai/qc/mock"}
    assert session["session_id"]

    _simulate_scan_complete(session["session_id"], {"bot_id": "wecom-bot-2", "secret": "wecom-secret-2"})
    current = get_onboard_session(profile_dir, "wecom_bot", session["session_id"])
    assert current is not None
    assert current["status"] == "completed"

    result = apply_onboard_session(profile_dir, "wecom_bot", session["session_id"])
    assert result["channel_id"] == "wecom_bot"

    snapshot = get_channel_snapshot(profile_dir, "wecom_bot")
    assert snapshot["enabled"] is True
    assert snapshot["configured"] is True
    assert snapshot["config"]["bot_id"] == "wecom-bot-2"
    assert snapshot["config"]["secret"] == "wecom-secret-2"

    env = _parse_profile_env(profile_dir)
    assert env["WECOM_BOT_ID"] == "wecom-bot-2"
    assert env["WECOM_SECRET"] == "wecom-secret-2"


def test_feishu_onboard_session_uses_real_device_flow(profile_dir, monkeypatch):
    native_feishu = SimpleNamespace(
        _init_registration=lambda domain: None,
        _begin_registration=lambda domain: {
            "device_code": "device-code-1",
            "qr_url": "https://accounts.feishu.cn/verify?ticket=abc&from=hermes&tp=hermes",
            "interval": 1,
            "expire_in": 600,
        },
    )
    monkeypatch.setattr(hermes_onboarding, "_load_native_feishu_module", lambda: native_feishu)

    session = start_onboard_session(profile_dir, "feishu")

    assert session["session_id"]
    assert "from=hermes" in session["qr_url"]
    assert "tp=hermes" in session["qr_url"]


def test_feishu_onboard_session_poll_and_apply(profile_dir, monkeypatch):
    fake_time = {"value": 1000.0}
    monkeypatch.setattr(hermes_onboarding, "_utc_now", lambda: fake_time["value"])
    native_feishu = SimpleNamespace(
        _init_registration=lambda domain: None,
        _begin_registration=lambda domain: {
            "device_code": "device-code-2",
            "qr_url": "https://accounts.feishu.cn/verify?ticket=xyz&from=hermes&tp=hermes",
            "interval": 0,
            "expire_in": 600,
        },
        _accounts_base_url=lambda domain: f"https://accounts.{domain}.cn",
        _post_registration=lambda base_url, body: {
            "client_id": "feishu-app-id",
            "client_secret": "feishu-app-secret",
            "user_info": {"open_id": "ou_test", "tenant_brand": "feishu"},
        },
        probe_bot=lambda client_id, client_secret, domain: {
            "bot_name": "Hermes Bot",
            "bot_open_id": "ou_bot_test",
        },
    )
    monkeypatch.setattr(hermes_onboarding, "_load_native_feishu_module", lambda: native_feishu)

    session = start_onboard_session(profile_dir, "feishu")
    fake_time["value"] += 6
    current = get_onboard_session(profile_dir, "feishu", session["session_id"])

    assert current is not None
    assert current["status"] == "completed"
    assert current["credentials"]["app_id"] == "feishu-app-id"
    assert current["credentials"]["bot_name"] == "Hermes Bot"

    result = apply_onboard_session(profile_dir, "feishu", session["session_id"])
    assert result["channel_id"] == "feishu"

    snapshot = get_channel_snapshot(profile_dir, "feishu")
    assert snapshot["enabled"] is True
    assert snapshot["configured"] is True
    assert snapshot["config"]["app_id"] == "feishu-app-id"
    assert snapshot["config"]["bot_name"] == "Hermes Bot"
    assert snapshot["config"]["connection_mode"] == "websocket"

    env = _parse_profile_env(profile_dir)
    assert env["FEISHU_APP_ID"] == "feishu-app-id"
    assert env["FEISHU_APP_SECRET"] == "feishu-app-secret"
    assert env["FEISHU_DOMAIN"] == "feishu"
    assert env["FEISHU_BOT_OPEN_ID"] == "ou_bot_test"
    assert env["FEISHU_BOT_NAME"] == "Hermes Bot"
    assert env["FEISHU_CONNECTION_MODE"] == "websocket"
    assert env["FEISHU_ALLOWED_USERS"] == "ou_test"

    import yaml
    with open(profile_dir / "config.yaml") as f:
        cfg = yaml.safe_load(f)
    assert cfg["platforms"]["feishu"]["enabled"] is True


def test_update_channel_config_dingtalk_env_marks_configured(profile_dir):
    update_channel_config(
        profile_dir,
        "dingtalk",
        {"client_id": "ding-client-id", "client_secret": "ding-client-secret"},
    )

    snapshot = get_channel_snapshot(profile_dir, "dingtalk")

    assert snapshot["enabled"] is True
    assert snapshot["configured"] is True
    assert snapshot["config"]["client_id"] == "ding-client-id"


def test_update_channel_config_qq_env_marks_configured(profile_dir):
    update_channel_config(
        profile_dir,
        "qq",
        {"app_id": "qq-app-id", "token": "qq-token"},
    )

    snapshot = get_channel_snapshot(profile_dir, "qq")

    assert snapshot["enabled"] is True
    assert snapshot["configured"] is True
    assert snapshot["config"]["app_id"] == "qq-app-id"


def test_update_channel_config_feishu_env_marks_configured(profile_dir):
    update_channel_config(
        profile_dir,
        "feishu",
        {
            "app_id": "feishu-app-id",
            "app_secret": "feishu-app-secret",
            "domain": "feishu",
            "connection_mode": "websocket",
            "bot_open_id": "ou_bot_manual",
            "bot_name": "Manual Bot",
        },
    )

    snapshot = get_channel_snapshot(profile_dir, "feishu")

    assert snapshot["enabled"] is True
    assert snapshot["configured"] is True
    assert snapshot["config"]["app_id"] == "feishu-app-id"
    assert snapshot["config"]["domain"] == "feishu"
    assert snapshot["config"]["connection_mode"] == "websocket"
    assert snapshot["config"]["bot_open_id"] == "ou_bot_manual"
    assert snapshot["config"]["bot_name"] == "Manual Bot"

    env = _parse_profile_env(profile_dir)
    assert env["FEISHU_DOMAIN"] == "feishu"
    assert env["FEISHU_CONNECTION_MODE"] == "websocket"
    assert env["FEISHU_BOT_OPEN_ID"] == "ou_bot_manual"
    assert env["FEISHU_BOT_NAME"] == "Manual Bot"

    import yaml
    with open(profile_dir / "config.yaml") as f:
        cfg = yaml.safe_load(f)
    assert cfg["platforms"]["feishu"]["enabled"] is True


def test_update_channel_config_wecom_bot_env_marks_configured(profile_dir):
    update_channel_config(profile_dir, "wecom_bot", {"bot_id": "wecom-bot-id", "secret": "wecom-secret-id"})

    snapshot = get_channel_snapshot(profile_dir, "wecom_bot")

    assert snapshot["enabled"] is True
    assert snapshot["configured"] is True
    assert snapshot["config"]["bot_id"] == "wecom-bot-id"
    assert snapshot["config"]["secret"] == "wecom-secret-id"


def test_update_channel_config_weixin_env_marks_configured(profile_dir):
    update_channel_config(
        profile_dir,
        "weixin",
        {
            "account_id": "wx-account-id",
            "token": "wx-token",
            "base_url": "https://ilinkai.weixin.qq.com",
            "cdn_base_url": "https://novac2c.cdn.weixin.qq.com/c2c",
        },
    )

    snapshot = get_channel_snapshot(profile_dir, "weixin")

    assert snapshot["enabled"] is True
    assert snapshot["configured"] is True
    assert snapshot["config"]["account_id"] == "wx-account-id"
    assert snapshot["config"]["token"] == "wx-token"


def test_weixin_onboard_session_poll_and_apply(profile_dir, monkeypatch):
    qr_calls = {"count": 0}
    fake_now = {"value": 1000.0}

    native_weixin = SimpleNamespace(
        ILINK_BASE_URL="https://ilinkai.weixin.qq.com",
        EP_GET_BOT_QR="ilink/bot/get_bot_qrcode",
        EP_GET_QR_STATUS="ilink/bot/get_qrcode_status",
        check_weixin_requirements=lambda: True,
    )

    def fake_http_get_json(url: str, timeout: int = 10):
        if "get_bot_qrcode" in url:
            qr_calls["count"] += 1
            return {
                "qrcode": f"qr-token-{qr_calls['count']}",
                "qrcode_img_content": f"https://weixin.qq.com/qr/{qr_calls['count']}",
            }
        if "get_qrcode_status" in url:
            return {
                "status": "confirmed",
                "ilink_bot_id": "wx-bot-1",
                "bot_token": "wx-token-1",
                "baseurl": "https://ilinkai.weixin.qq.com",
                "ilink_user_id": "wx-user-1",
            }
        raise AssertionError(f"unexpected url: {url}")

    monkeypatch.setattr(hermes_onboarding, "_load_native_weixin_module", lambda: native_weixin)
    monkeypatch.setattr(hermes_onboarding, "_http_get_json", fake_http_get_json)
    monkeypatch.setattr(hermes_onboarding, "_utc_now", lambda: fake_now["value"])

    session = start_onboard_session(profile_dir, "weixin")
    assert session["session_id"]
    assert "weixin.qq.com/qr/1" in session["qr_url"]

    fake_now["value"] += 2
    current = get_onboard_session(profile_dir, "weixin", session["session_id"])
    assert current is not None
    assert current["status"] == "completed"
    assert current["credentials"]["account_id"] == "wx-bot-1"
    assert current["credentials"]["token"] == "wx-token-1"

    result = apply_onboard_session(profile_dir, "weixin", session["session_id"])
    assert result["channel_id"] == "weixin"

    snapshot = get_channel_snapshot(profile_dir, "weixin")
    assert snapshot["enabled"] is True
    assert snapshot["configured"] is True
    assert snapshot["config"]["account_id"] == "wx-bot-1"
    assert snapshot["config"]["token"] == "wx-token-1"

    env = _parse_profile_env(profile_dir)
    assert env["WEIXIN_ACCOUNT_ID"] == "wx-bot-1"
    assert env["WEIXIN_TOKEN"] == "wx-token-1"
    assert env["WEIXIN_BASE_URL"] == "https://ilinkai.weixin.qq.com"
    assert env["WEIXIN_CDN_BASE_URL"] == "https://novac2c.cdn.weixin.qq.com/c2c"
