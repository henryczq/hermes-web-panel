"""AI config extraction and save from config.yaml."""

from pathlib import Path

import yaml

from admin_core.hermes_effective import get_bound_source_dir, merge_dicts


def _read_ai_config_from_dir(profile_dir: Path) -> dict:
    config_path = profile_dir / "config.yaml"
    if not config_path.exists():
        return {}
    with open(config_path, "r") as f:
        cfg = yaml.safe_load(f) or {}

    model_cfg = cfg.get("model", {})
    if isinstance(model_cfg, str):
        model_cfg = {"default": model_cfg}

    result: dict = {
        "default_model": (model_cfg.get("default") or model_cfg.get("model")
                          if isinstance(model_cfg, dict) else None),
        "provider": model_cfg.get("provider") if isinstance(model_cfg, dict) else None,
        "base_url": model_cfg.get("base_url") if isinstance(model_cfg, dict) else None,
        "embedding": cfg.get("embedding"),
        "auxiliary": cfg.get("auxiliary"),
        "providers": cfg.get("providers"),
        "fallback_providers": cfg.get("fallback_providers", []),
    }
    return result


def read_ai_config(profile_dir: Path) -> dict:
    current = _read_ai_config_from_dir(profile_dir)
    source_dir = get_bound_source_dir(profile_dir.name)
    if not source_dir:
        return current
    base = _read_ai_config_from_dir(source_dir)
    return merge_dicts(base, current)


def write_ai_config(profile_dir: Path, ai_data: dict) -> None:
    config_path = profile_dir / "config.yaml"
    if not config_path.exists():
        cfg: dict = {}
    else:
        with open(config_path, "r") as f:
            cfg = yaml.safe_load(f) or {}

    model_cfg: dict = cfg.get("model", {})
    if isinstance(model_cfg, str):
        model_cfg = {"default": model_cfg}
    if not isinstance(model_cfg, dict):
        model_cfg = {}

    if "default_model" in ai_data and ai_data["default_model"] is not None:
        model_cfg["default"] = ai_data["default_model"]
    if "provider" in ai_data and ai_data["provider"] is not None:
        model_cfg["provider"] = ai_data["provider"]
    if "base_url" in ai_data and ai_data["base_url"] is not None:
        model_cfg["base_url"] = ai_data["base_url"]

    cfg["model"] = model_cfg

    if "embedding" in ai_data:
        if ai_data["embedding"] is not None:
            cfg["embedding"] = ai_data["embedding"]
        else:
            cfg.pop("embedding", None)

    if "auxiliary" in ai_data:
        if ai_data["auxiliary"] is not None:
            cfg["auxiliary"] = ai_data["auxiliary"]
        else:
            cfg.pop("auxiliary", None)

    if "providers" in ai_data:
        if ai_data["providers"] is not None:
            cfg["providers"] = ai_data["providers"]
        else:
            cfg.pop("providers", None)

    if "fallback_providers" in ai_data:
        if ai_data["fallback_providers"] is not None:
            cfg["fallback_providers"] = ai_data["fallback_providers"]
        else:
            cfg.pop("fallback_providers", None)

    tmp = config_path.with_suffix(".yaml.tmp")
    with open(tmp, "w") as f:
        yaml.dump(cfg, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
    tmp.replace(config_path)
