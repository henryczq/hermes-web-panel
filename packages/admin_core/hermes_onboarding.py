"""Channel onboarding session management with Hermes-native QR onboarding."""

from __future__ import annotations

import importlib
import json
import sys
import time
import uuid
from pathlib import Path
from typing import Optional
from urllib import error, parse, request

from admin_core.hermes_paths import hermes_agent_root


# In-memory session store (single-process only)
_sessions: dict[str, dict] = {}

# Channels that support QR onboarding
SCAN_CHANNELS = {"feishu", "wecom_bot", "weixin"}

_SESSION_TTL_SECONDS = 30 * 60

_QR_URL_TEMPLATES = {
    "wecom_bot": "https://open.work.weixin.qq.com/wwopen/sso/qrConnect?appid={appid}&agentid={agentid}",
}
_WECOM_QR_GENERATE_URL = "https://work.weixin.qq.com/ai/qc/generate"
_WECOM_QR_QUERY_URL = "https://work.weixin.qq.com/ai/qc/query_result"
_WECOM_DEFAULT_WS_URL = "wss://openws.work.weixin.qq.com"
_WEIXIN_DEFAULT_CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c"

def _make_session_id() -> str:
    return uuid.uuid4().hex[:12]


def _utc_now() -> float:
    return time.time()


def _load_native_feishu_module():
    root = str(hermes_agent_root())
    if root not in sys.path:
        sys.path.insert(0, root)
    return importlib.import_module("gateway.platforms.feishu")


def _load_native_weixin_module():
    root = str(hermes_agent_root())
    if root not in sys.path:
        sys.path.insert(0, root)
    return importlib.import_module("gateway.platforms.weixin")


def _http_get_json(url: str, timeout: int = 10) -> dict:
    req = request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "hermes-web-panel/0.1",
        },
        method="GET",
    )
    with request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    payload = json.loads(body or "{}")
    if not isinstance(payload, dict):
        raise ValueError("Unexpected response payload")
    return payload


def _wecom_platform_code() -> int:
    if sys.platform == "darwin":
        return 1
    if sys.platform == "win32":
        return 2
    if sys.platform.startswith("linux"):
        return 3
    return 0


def _cleanup_expired_sessions() -> None:
    now = _utc_now()
    expired_ids = [
        session_id
        for session_id, session in _sessions.items()
        if now - float(session.get("created_at", now)) > _SESSION_TTL_SECONDS
    ]
    for session_id in expired_ids:
        _sessions.pop(session_id, None)


def _start_feishu_session() -> dict:
    native_feishu = _load_native_feishu_module()
    native_feishu._init_registration("feishu")
    begin_result = native_feishu._begin_registration("feishu")
    device_code = str(begin_result.get("device_code") or "").strip()
    verification_url = str(begin_result.get("qr_url") or "").strip()
    if not device_code or not verification_url:
        raise ValueError("飞书接入流程未返回 device_code 或 verification_url")

    now = _utc_now()
    interval_seconds = max(int(begin_result.get("interval") or 5), 1)
    expire_in = max(int(begin_result.get("expire_in") or 600), 1)

    session_id = _make_session_id()
    session = {
        "session_id": session_id,
        "channel_id": "feishu",
        "qr_url": verification_url,
        "verification_url": verification_url,
        "device_code": device_code,
        "status": "pending",
        "credentials": None,
        "created_at": now,
        "updated_at": now,
        "next_poll_at": now + interval_seconds,
        "interval_seconds": interval_seconds,
        "expires_at": now + expire_in,
        "env": "prod",
        "domain_hint": "feishu",
        "error": None,
    }
    return session


def _start_wecom_bot_session() -> dict:
    payload = _http_get_json(
        f"{_WECOM_QR_GENERATE_URL}?source=hermes-admin&plat={_wecom_platform_code()}",
        timeout=15,
    )
    data = payload.get("data") or {}
    scode = str(data.get("scode") or "").strip()
    auth_url = str(data.get("auth_url") or "").strip()
    if not scode or not auth_url:
        raise ValueError("企业微信接入流程未返回 scode 或二维码地址")

    now = _utc_now()
    return {
        "session_id": _make_session_id(),
        "channel_id": "wecom_bot",
        "qr_url": auth_url,
        "verification_url": f"https://work.weixin.qq.com/ai/qc/gen?source=wecom-cli&scode={scode}",
        "scode": scode,
        "status": "pending",
        "credentials": None,
        "created_at": now,
        "updated_at": now,
        "next_poll_at": now + 3,
        "expires_at": now + 5 * 60,
        "error": None,
    }


def _start_weixin_session() -> dict:
    native_weixin = _load_native_weixin_module()
    if not native_weixin.check_weixin_requirements():
        raise ValueError("当前 Hermes 环境缺少 Weixin 扫码依赖，请先安装 aiohttp 和 cryptography")

    payload = _http_get_json(
        f"{native_weixin.ILINK_BASE_URL.rstrip('/')}/{native_weixin.EP_GET_BOT_QR}?bot_type=3",
        timeout=15,
    )
    qrcode_value = str(payload.get("qrcode") or "").strip()
    qrcode_url = str(payload.get("qrcode_img_content") or "").strip()
    if not qrcode_value:
        raise ValueError("微信接入流程未返回二维码信息")

    now = _utc_now()
    return {
        "session_id": _make_session_id(),
        "channel_id": "weixin",
        "qr_url": qrcode_url or qrcode_value,
        "verification_url": qrcode_url or qrcode_value,
        "qrcode": qrcode_value,
        "status": "pending",
        "credentials": None,
        "created_at": now,
        "updated_at": now,
        "next_poll_at": now + 1,
        "expires_at": now + 8 * 60,
        "current_base_url": str(native_weixin.ILINK_BASE_URL).rstrip("/"),
        "refresh_count": 0,
        "error": None,
    }


def _poll_feishu_session(session: dict) -> None:
    if session.get("status") in {"completed", "applied", "expired", "denied", "cancelled", "error"}:
        return

    now = _utc_now()
    if now >= float(session.get("expires_at") or 0):
        session["status"] = "expired"
        session["error"] = "二维码会话已过期"
        session["updated_at"] = now
        return

    if now < float(session.get("next_poll_at") or 0):
        return

    native_feishu = _load_native_feishu_module()
    current_domain = str(session.get("domain_hint") or "feishu")
    poll_result = native_feishu._post_registration(
        native_feishu._accounts_base_url(current_domain),
        {
            "action": "poll",
            "device_code": str(session.get("device_code") or ""),
            "tp": "ob_app",
        },
    )
    tenant_brand = (
        "lark"
        if (poll_result.get("user_info") or {}).get("tenant_brand") == "lark"
        else "feishu"
    )

    if tenant_brand == "lark" and current_domain != "lark":
        session["domain_hint"] = "lark"
        poll_result = native_feishu._post_registration(
            native_feishu._accounts_base_url("lark"),
            {
                "action": "poll",
                "device_code": str(session.get("device_code") or ""),
                "tp": "ob_app",
            },
        )

    now = _utc_now()
    client_id = str(poll_result.get("client_id") or "").strip()
    client_secret = str(poll_result.get("client_secret") or "").strip()
    if client_id and client_secret:
        user_info = poll_result.get("user_info") or {}
        bot_info = native_feishu.probe_bot(
            client_id,
            client_secret,
            str(session.get("domain_hint") or "feishu"),
        ) or {}
        user_info = poll_result.get("user_info") or {}
        session["status"] = "completed"
        session["credentials"] = {
            "app_id": client_id,
            "app_secret": client_secret,
            "domain": str(session.get("domain_hint") or "feishu"),
            "open_id": str(user_info.get("open_id") or "").strip(),
            "bot_name": str(bot_info.get("bot_name") or "").strip(),
            "bot_open_id": str(bot_info.get("bot_open_id") or "").strip(),
        }
        session["updated_at"] = now
        session["error"] = None
        return

    error = str(poll_result.get("error") or "").strip()
    error_description = str(poll_result.get("error_description") or "").strip()

    if not error or error == "authorization_pending":
        session["status"] = "pending"
        session["next_poll_at"] = now + int(session.get("interval_seconds") or 5)
        session["updated_at"] = now
        return

    if error == "slow_down":
        session["interval_seconds"] = int(session.get("interval_seconds") or 5) + 5
        session["next_poll_at"] = now + int(session["interval_seconds"])
        session["updated_at"] = now
        return

    if error == "access_denied":
        session["status"] = "denied"
        session["error"] = error_description or "用户拒绝了授权"
        session["updated_at"] = now
        return

    if error == "expired_token":
        session["status"] = "expired"
        session["error"] = error_description or "二维码会话已过期"
        session["updated_at"] = now
        return

    session["status"] = "error"
    session["error"] = error_description or error or "未知的飞书接入错误"
    session["updated_at"] = now


def _poll_wecom_bot_session(session: dict) -> None:
    if session.get("status") in {"completed", "applied", "expired", "cancelled", "error"}:
        return

    now = _utc_now()
    if now >= float(session.get("expires_at") or 0):
        session["status"] = "expired"
        session["error"] = "二维码会话已过期"
        session["updated_at"] = now
        return

    if now < float(session.get("next_poll_at") or 0):
        return

    scode = str(session.get("scode") or "").strip()
    if not scode:
        session["status"] = "error"
        session["error"] = "企业微信会话缺少 scode"
        session["updated_at"] = now
        return

    try:
        payload = _http_get_json(f"{_WECOM_QR_QUERY_URL}?scode={parse.quote(scode)}", timeout=10)
    except error.URLError as exc:
        session["next_poll_at"] = now + 3
        session["updated_at"] = now
        session["error"] = str(getattr(exc, "reason", exc))
        return
    except Exception as exc:
        session["next_poll_at"] = now + 3
        session["updated_at"] = now
        session["error"] = str(exc)
        return

    bot_info = payload.get("bot_info") or {}
    bot_id = str(bot_info.get("botid") or "").strip()
    secret = str(bot_info.get("secret") or "").strip()
    if str(payload.get("status") or "").strip().lower() == "success" and bot_id and secret:
        session["status"] = "completed"
        session["credentials"] = {
            "bot_id": bot_id,
            "secret": secret,
            "websocket_url": _WECOM_DEFAULT_WS_URL,
        }
        session["updated_at"] = now
        session["error"] = None
        return

    session["status"] = "pending"
    session["next_poll_at"] = now + 3
    session["updated_at"] = now


def _poll_weixin_session(session: dict) -> None:
    if session.get("status") in {"completed", "applied", "expired", "cancelled", "error"}:
        return

    now = _utc_now()
    if now >= float(session.get("expires_at") or 0):
        session["status"] = "expired"
        session["error"] = "二维码会话已过期"
        session["updated_at"] = now
        return

    if now < float(session.get("next_poll_at") or 0):
        return

    native_weixin = _load_native_weixin_module()
    qrcode_value = str(session.get("qrcode") or "").strip()
    current_base_url = str(session.get("current_base_url") or native_weixin.ILINK_BASE_URL).rstrip("/")
    if not qrcode_value:
        session["status"] = "error"
        session["error"] = "微信会话缺少二维码标识"
        session["updated_at"] = now
        return

    try:
        payload = _http_get_json(
            f"{current_base_url}/{native_weixin.EP_GET_QR_STATUS}?qrcode={parse.quote(qrcode_value)}",
            timeout=10,
        )
    except error.URLError as exc:
        session["next_poll_at"] = now + 1
        session["updated_at"] = now
        session["error"] = str(getattr(exc, "reason", exc))
        return
    except Exception as exc:
        session["next_poll_at"] = now + 1
        session["updated_at"] = now
        session["error"] = str(exc)
        return

    status = str(payload.get("status") or "wait").strip().lower()
    if status == "wait":
        session["status"] = "pending"
        session["error"] = None
    elif status == "scaned":
        session["status"] = "waiting_confirm"
        session["error"] = None
    elif status == "scaned_but_redirect":
        redirect_host = str(payload.get("redirect_host") or "").strip()
        if redirect_host:
            session["current_base_url"] = f"https://{redirect_host}"
        session["status"] = "waiting_confirm"
        session["error"] = None
    elif status == "expired":
        refresh_count = int(session.get("refresh_count") or 0) + 1
        session["refresh_count"] = refresh_count
        if refresh_count > 3:
            session["status"] = "expired"
            session["error"] = "二维码已多次过期，请重新发起扫码登录"
            session["updated_at"] = now
            return
        refreshed = _http_get_json(
            f"{native_weixin.ILINK_BASE_URL.rstrip('/')}/{native_weixin.EP_GET_BOT_QR}?bot_type=3",
            timeout=15,
        )
        new_qrcode = str(refreshed.get("qrcode") or "").strip()
        new_qr_url = str(refreshed.get("qrcode_img_content") or "").strip()
        if not new_qrcode:
            session["status"] = "error"
            session["error"] = "刷新微信二维码失败"
            session["updated_at"] = now
            return
        session["qrcode"] = new_qrcode
        session["qr_url"] = new_qr_url or new_qrcode
        session["verification_url"] = new_qr_url or new_qrcode
        session["current_base_url"] = str(native_weixin.ILINK_BASE_URL).rstrip("/")
        session["status"] = "pending"
        session["error"] = None
    elif status == "confirmed":
        account_id = str(payload.get("ilink_bot_id") or "").strip()
        token = str(payload.get("bot_token") or "").strip()
        base_url = str(payload.get("baseurl") or native_weixin.ILINK_BASE_URL).strip()
        user_id = str(payload.get("ilink_user_id") or "").strip()
        if not account_id or not token:
            session["status"] = "error"
            session["error"] = "微信返回的账号信息不完整"
            session["updated_at"] = now
            return
        session["status"] = "completed"
        session["credentials"] = {
            "account_id": account_id,
            "token": token,
            "base_url": base_url,
            "cdn_base_url": _WEIXIN_DEFAULT_CDN_BASE_URL,
            "user_id": user_id,
        }
        session["error"] = None
    else:
        session["status"] = "error"
        session["error"] = f"未知的微信扫码状态：{status}"

    session["next_poll_at"] = now + 1
    session["updated_at"] = now


def start_onboard_session(profile_dir: Path, channel_id: str) -> dict:
    _cleanup_expired_sessions()
    if channel_id not in SCAN_CHANNELS:
        raise ValueError(f"Channel '{channel_id}' does not support QR onboarding")

    if channel_id == "feishu":
        session = _start_feishu_session()
    elif channel_id == "wecom_bot":
        session = _start_wecom_bot_session()
    elif channel_id == "weixin":
        session = _start_weixin_session()
    else:
        session = {
            "session_id": _make_session_id(),
            "channel_id": channel_id,
            "qr_url": _QR_URL_TEMPLATES.get(channel_id, ""),
            "status": "pending",
            "credentials": None,
            "created_at": _utc_now(),
            "updated_at": _utc_now(),
        }

    session["profile_dir"] = str(profile_dir)
    _sessions[session["session_id"]] = session
    return {
        "session_id": session["session_id"],
        "qr_url": session.get("qr_url", ""),
    }


def get_onboard_session(profile_dir: Path, channel_id: str, session_id: str) -> Optional[dict]:
    _cleanup_expired_sessions()
    session = _sessions.get(session_id)
    if not session:
        return None
    if session["channel_id"] != channel_id or session["profile_dir"] != str(profile_dir):
        return None

    if channel_id == "feishu":
        _poll_feishu_session(session)
    elif channel_id == "wecom_bot":
        _poll_wecom_bot_session(session)
    elif channel_id == "weixin":
        _poll_weixin_session(session)

    return {
        "session_id": session["session_id"],
        "status": session["status"],
        "qr_url": session.get("qr_url"),
        "credentials": session.get("credentials"),
        "error": session.get("error"),
    }


def apply_onboard_session(profile_dir: Path, channel_id: str, session_id: str) -> dict:
    session = _sessions.get(session_id)
    if not session:
        raise ValueError(f"Session '{session_id}' not found")
    if session["channel_id"] != channel_id:
        raise ValueError(f"Session channel mismatch: expected {channel_id}, got {session['channel_id']}")
    if session["profile_dir"] != str(profile_dir):
        raise ValueError("Session profile mismatch")
    if session["status"] != "completed":
        raise ValueError(f"Session not completed: {session['status']}")

    credentials = session.get("credentials")
    if not credentials:
        raise ValueError("No credentials in session")

    from admin_core.hermes_channels import update_channel_config
    from admin_core.hermes_env import read_env, update_env_key

    update_payload = dict(credentials)
    if channel_id == "feishu":
        owner_open_id = str(update_payload.pop("open_id", "") or "").strip()
        update_payload.setdefault("connection_mode", "websocket")
        if owner_open_id:
            current_env = read_env(profile_dir)
            existing = str(current_env.get("FEISHU_ALLOWED_USERS") or "").strip()
            allowed = [item.strip() for item in existing.split(",") if item.strip()]
            if owner_open_id not in allowed:
                allowed.append(owner_open_id)
            update_env_key(profile_dir, "FEISHU_ALLOWED_USERS", ",".join(allowed))
    elif channel_id == "weixin":
        update_payload.pop("user_id", None)
    update_channel_config(profile_dir, channel_id, update_payload)

    session["status"] = "applied"
    del _sessions[session_id]
    return {"profile_name": profile_dir.name, "channel_id": channel_id}


# For testing / simulation only
def _simulate_scan_complete(session_id: str, credentials: dict) -> None:
    session = _sessions.get(session_id)
    if session:
        session["status"] = "completed"
        session["credentials"] = credentials
        session["updated_at"] = _utc_now()
