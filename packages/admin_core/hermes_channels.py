"""Channel snapshot generation from config.yaml and .env (file-based, per-profile)."""

from pathlib import Path

import yaml


_KNOWN_CHANNELS = [
    "feishu", "telegram", "slack", "discord", "api_server",
    "wecom", "wecom_bot", "wecom_app", "wecom_kf", "wecom_callback",
    "weixin", "weixin_mp", "qq", "whatsapp", "signal",
    "matrix", "dingtalk", "email", "webhook",
]

_ENV_KEYS: dict[str, list[tuple[str, str]]] = {
    "telegram": [("TELEGRAM_BOT_TOKEN", "token")],
    "discord": [("DISCORD_BOT_TOKEN", "token")],
    "slack": [("SLACK_BOT_TOKEN", "token")],
    "feishu": [
        ("FEISHU_APP_ID", "app_id"),
        ("FEISHU_APP_SECRET", "app_secret"),
        ("FEISHU_DOMAIN", "domain"),
        ("FEISHU_CONNECTION_MODE", "connection_mode"),
        ("FEISHU_BOT_OPEN_ID", "bot_open_id"),
        ("FEISHU_BOT_NAME", "bot_name"),
    ],
    "wecom": [("WECOM_BOT_ID", "bot_id"), ("WECOM_SECRET", "secret"), ("WECOM_WEBSOCKET_URL", "websocket_url")],
    "wecom_bot": [("WECOM_BOT_ID", "bot_id"), ("WECOM_SECRET", "secret"), ("WECOM_WEBSOCKET_URL", "websocket_url")],
    "weixin": [
        ("WEIXIN_TOKEN", "token"),
        ("WEIXIN_ACCOUNT_ID", "account_id"),
        ("WEIXIN_BASE_URL", "base_url"),
        ("WEIXIN_CDN_BASE_URL", "cdn_base_url"),
        ("WEIXIN_HOME_CHANNEL", "home_channel"),
    ],
    "weixin_mp": [("WEIXIN_MP_APP_ID", "app_id"), ("WEIXIN_MP_APP_SECRET", "app_secret"), ("WEIXIN_MP_TOKEN", "token")],
    "api_server": [("API_SERVER_ENABLED", "enabled"), ("API_SERVER_PORT", "port")],
    "webhook": [("WEBHOOK_ENABLED", "enabled"), ("WEBHOOK_URL", "url")],
    "whatsapp": [("WHATSAPP_ENABLED", "enabled"), ("WHATSAPP_TOKEN", "token")],
    "signal": [("SIGNAL_HTTP_URL", "url")],
    "matrix": [("MATRIX_ACCESS_TOKEN", "token")],
    "dingtalk": [("DINGTALK_CLIENT_ID", "client_id"), ("DINGTALK_CLIENT_SECRET", "client_secret")],
    "qq": [("QQ_APP_ID", "app_id"), ("QQ_TOKEN", "token")],
}


def update_channel_config(profile_dir: Path, channel_id: str, updates: dict) -> None:
    if channel_id not in _KNOWN_CHANNELS:
        raise ValueError(f"Unknown channel: {channel_id}")

    config_path = profile_dir / "config.yaml"

    yaml_cfg: dict = {}
    if config_path.exists():
        with open(config_path, "r") as f:
            yaml_cfg = yaml.safe_load(f) or {}

    if "platforms" not in yaml_cfg:
        yaml_cfg["platforms"] = {}
    if channel_id not in yaml_cfg["platforms"]:
        yaml_cfg["platforms"][channel_id] = {}
    platform_cfg = yaml_cfg["platforms"][channel_id]

    env_updates: dict[str, str] = {}
    env_mapping = _ENV_KEYS.get(channel_id, [])
    for env_name, config_key in env_mapping:
        if config_key in updates:
            val = updates[config_key]
            if isinstance(val, bool):
                env_updates[env_name] = "true" if val else "false"
            else:
                env_updates[env_name] = str(val) if val is not None else ""

    for key, value in updates.items():
        is_env_key = any(key == ck for _, ck in env_mapping)
        if not is_env_key:
            platform_cfg[key] = value

    if channel_id == "feishu":
        # Hermes gateway only treats Feishu as active when the platform is
        # explicitly enabled in config.yaml or discovered from env at startup.
        platform_cfg["enabled"] = bool(
            updates.get("enabled", True)
            if updates
            else platform_cfg.get("enabled", False)
        )
        # Older admin versions wrote Hermes-specific runtime keys at the
        # platform top level, but Hermes reads them from env / extra instead.
        for stale_key in ("domain", "connection_mode", "bot_open_id", "bot_name"):
            if stale_key in platform_cfg and stale_key not in updates:
                env_name = next((name for name, config_key in env_mapping if config_key == stale_key), None)
                if env_name and platform_cfg.get(stale_key) not in (None, ""):
                    env_updates.setdefault(env_name, str(platform_cfg.get(stale_key)))
                platform_cfg.pop(stale_key, None)

    if platform_cfg:
        with open(config_path, "w") as f:
            yaml.safe_dump(yaml_cfg, f, default_flow_style=False, allow_unicode=True)

    if env_updates:
        from admin_core.hermes_env import update_env_key
        for env_name, value in env_updates.items():
            update_env_key(profile_dir, env_name, value)


def _platform_config_from_yaml(cfg: dict, platform: str) -> dict:
    platforms = cfg.get("platforms", {}) or {}
    plat = platforms.get(platform, {})
    if isinstance(plat, dict):
        base = {
            k: v for k, v in plat.items()
            if k not in ("token", "api_key", "app_secret", "secret", "corp_secret", "extra")
        }
        extra = plat.get("extra", {})
        if isinstance(extra, dict):
            base.update(extra)
        return base
    return {}


def _parse_profile_env(profile_dir: Path) -> dict[str, str]:
    env_path = profile_dir / ".env"
    if not env_path.exists():
        return {}
    result: dict[str, str] = {}
    for line in env_path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        key, sep, value = stripped.partition("=")
        if sep:
            result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def _platform_config_from_env(profile_env: dict[str, str], platform: str) -> dict:
    result: dict = {}
    env_map: dict[str, list[tuple[str, str, str]]] = {
        "telegram": [
            ("enabled", "TELEGRAM_BOT_TOKEN", "bool"),
        ],
        "discord": [
            ("enabled", "DISCORD_BOT_TOKEN", "bool"),
        ],
        "slack": [
            ("enabled", "SLACK_BOT_TOKEN", "bool"),
        ],
        "feishu": [
            ("app_id", "FEISHU_APP_ID", "str"),
            ("app_secret", "FEISHU_APP_SECRET", "str"),
            ("domain", "FEISHU_DOMAIN", "str"),
            ("connection_mode", "FEISHU_CONNECTION_MODE", "str"),
            ("bot_open_id", "FEISHU_BOT_OPEN_ID", "str"),
            ("bot_name", "FEISHU_BOT_NAME", "str"),
            ("enabled", "FEISHU_APP_ID", "presence"),
        ],
        "wecom": [
            ("enabled", "WECOM_BOT_ID", "presence"),
            ("bot_id", "WECOM_BOT_ID", "str"),
            ("secret", "WECOM_SECRET", "str"),
            ("websocket_url", "WECOM_WEBSOCKET_URL", "str"),
        ],
        "wecom_bot": [
            ("enabled", "WECOM_BOT_ID", "presence"),
            ("bot_id", "WECOM_BOT_ID", "str"),
            ("secret", "WECOM_SECRET", "str"),
            ("websocket_url", "WECOM_WEBSOCKET_URL", "str"),
        ],
        "weixin": [
            ("enabled", "WEIXIN_ACCOUNT_ID", "presence"),
            ("token", "WEIXIN_TOKEN", "str"),
            ("account_id", "WEIXIN_ACCOUNT_ID", "str"),
            ("base_url", "WEIXIN_BASE_URL", "str"),
            ("cdn_base_url", "WEIXIN_CDN_BASE_URL", "str"),
            ("home_channel", "WEIXIN_HOME_CHANNEL", "str"),
        ],
        "weixin_mp": [
            ("enabled", "WEIXIN_MP_APP_ID", "presence"),
            ("app_id", "WEIXIN_MP_APP_ID", "str"),
        ],
        "api_server": [
            ("enabled", "API_SERVER_ENABLED", "bool"),
            ("port", "API_SERVER_PORT", "str"),
        ],
        "webhook": [
            ("enabled", "WEBHOOK_ENABLED", "bool"),
        ],
        "whatsapp": [
            ("enabled", "WHATSAPP_ENABLED", "bool"),
        ],
        "signal": [
            ("enabled", "SIGNAL_HTTP_URL", "presence"),
            ("url", "SIGNAL_HTTP_URL", "str"),
        ],
        "matrix": [
            ("enabled", "MATRIX_ACCESS_TOKEN", "presence"),
            ("token", "MATRIX_ACCESS_TOKEN", "str"),
        ],
        "dingtalk": [
            ("enabled", "DINGTALK_CLIENT_ID", "presence"),
            ("client_id", "DINGTALK_CLIENT_ID", "str"),
        ],
        "qq": [
            ("enabled", "QQ_APP_ID", "presence"),
            ("app_id", "QQ_APP_ID", "str"),
        ],
    }
    if platform not in env_map:
        return result

    for key, env_name, coerce in env_map[platform]:
        val = profile_env.get(env_name, "")
        if coerce == "bool":
            result[key] = bool(val and val.lower() in ("true", "1", "yes"))
        elif coerce == "presence":
            result[key] = bool(val)
        else:
            result[key] = val if val else None
    return result


def get_channel_snapshot(profile_dir: Path, channel_id: str) -> dict:
    config_path = profile_dir / "config.yaml"
    yaml_cfg: dict = {}
    if config_path.exists():
        with open(config_path, "r") as f:
            yaml_cfg = yaml.safe_load(f) or {}

    profile_env = _parse_profile_env(profile_dir)
    yaml_config = _platform_config_from_yaml(yaml_cfg, channel_id)
    env_config = _platform_config_from_env(profile_env, channel_id)

    yaml_enabled = isinstance(yaml_config, dict) and yaml_config.get("enabled", False)
    env_enabled = env_config.get("enabled", False)

    token_enabled = False
    if channel_id == "telegram" and profile_env.get("TELEGRAM_BOT_TOKEN"):
        token_enabled = True
    elif channel_id == "discord" and profile_env.get("DISCORD_BOT_TOKEN"):
        token_enabled = True
    elif channel_id == "slack" and profile_env.get("SLACK_BOT_TOKEN"):
        token_enabled = True

    enabled = yaml_enabled or env_enabled or token_enabled

    merged_config = {**env_config}
    for k, v in yaml_config.items():
        if k != "enabled" or not merged_config.get("enabled"):
            merged_config[k] = v
    merged_config["enabled"] = enabled

    configured = False
    if channel_id in ("telegram", "discord", "slack"):
        configured = bool(yaml_config.get("token")) or bool(yaml_config.get("api_key")) or env_enabled
        if channel_id == "telegram":
            configured = configured or bool(profile_env.get("TELEGRAM_BOT_TOKEN"))
        elif channel_id == "discord":
            configured = configured or bool(profile_env.get("DISCORD_BOT_TOKEN"))
        elif channel_id == "slack":
            configured = configured or bool(profile_env.get("SLACK_BOT_TOKEN"))
    elif channel_id == "feishu":
        configured = bool(env_config.get("app_id")) and bool(env_config.get("app_secret"))
    elif channel_id == "weixin":
        configured = env_enabled
    elif channel_id in ("wecom", "wecom_bot", "wecom_app", "wecom_kf", "wecom_callback"):
        configured = env_enabled
    elif channel_id == "weixin_mp":
        configured = env_enabled or bool(yaml_config.get("app_id"))
    elif channel_id == "api_server":
        configured = enabled
    elif channel_id in ("webhook", "whatsapp"):
        configured = enabled
    elif channel_id in ("signal", "matrix", "dingtalk", "qq"):
        configured = env_enabled
    else:
        configured = enabled

    return {
        "channel_id": channel_id,
        "enabled": enabled,
        "configured": configured,
        "config": merged_config,
    }


def list_channels(profile_dir: Path) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for ch in _KNOWN_CHANNELS:
        snapshot = get_channel_snapshot(profile_dir, ch)
        if snapshot["enabled"] or snapshot["configured"]:
            result[ch] = snapshot
    return result
