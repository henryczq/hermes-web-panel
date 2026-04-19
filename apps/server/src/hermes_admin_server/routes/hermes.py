from fastapi import APIRouter
from fastapi.responses import JSONResponse

from admin_contract.models import (
    ApiEnvelope,
    ProfileCreateRequest,
    ProfileCloneRequest,
    ProfileRenameRequest,
    ProfileMetaUpdateRequest,
    GatewayActionResponse,
    ConfigUpdateRequest,
    ConfigRollbackRequest,
    EnvKeyUpdateRequest,
    AIConfigUpdateRequest,
    CustomProviderUpdateRequest,
    CustomProviderTestRequest,
    OpenClawImportRequest,
    ChannelUpdateRequest,
    WorkspaceFileUpdateRequest,
    WorkspaceFileBackupRequest,
    WorkspaceFileRestoreRequest,
    ProfileBindingUpdateRequest,
    ConfigSourceCreateRequest,
    ConfigSourceUpdateRequest,
)
from admin_core.hermes_profiles import (
    list_profile_summaries,
    create_profile,
    clone_profile,
    delete_profile,
    rename_profile,
    update_profile_meta,
    get_profile_dir,
    profile_exists,
)
from admin_core.hermes_gateway import run_gateway_action
from admin_core.hermes_config import (
    read_config_raw,
    parse_config,
    write_config_raw,
    backup_config,
    list_backups,
    rollback_config,
)
from admin_core.hermes_env import (
    read_env,
    reveal_env_key,
    update_env_key,
    delete_env_key,
)
from admin_core.hermes_ai import (
    read_ai_config,
    write_ai_config,
)
from admin_core.hermes_custom_ai import (
    list_custom_providers,
    upsert_custom_provider,
    delete_custom_provider,
    test_custom_provider_connection,
    list_openclaw_import_candidates,
    import_openclaw_custom_providers,
)
from admin_core.hermes_channels import (
    list_channels,
    get_channel_snapshot,
    update_channel_config,
)
from admin_core.hermes_workspace import (
    list_files,
    read_file,
    write_file,
    backup_file,
    list_file_backups,
    restore_file_backup,
)
from admin_core.hermes_onboarding import (
    start_onboard_session,
    get_onboard_session,
    apply_onboard_session,
)
from admin_core.shared_china_registry import get_china_channels_bundle
from admin_core.hermes_sources import (
    list_config_sources,
    create_config_source,
    update_config_source,
    delete_config_source,
)
from admin_core.hermes_bindings import list_profile_bindings, set_profile_binding
from admin_core.hermes_overview import list_channels_overview, list_ai_overview


router = APIRouter()


def _resolve_profile(name: str):
    if not profile_exists(name):
        return None, JSONResponse(
            status_code=404,
            content={"success": False, "error": f"Profile '{name}' not found"},
        )
    return get_profile_dir(name), None


@router.get("/api/hermes/meta/china-channels")
def china_channels_meta():
    return ApiEnvelope(success=True, data=get_china_channels_bundle())


# Profiles


@router.get("/api/hermes/profiles")
def profiles_list():
    summaries = list_profile_summaries()
    return ApiEnvelope(success=True, data=[s.model_dump() for s in summaries])


@router.post("/api/hermes/profiles")
def profiles_create(body: ProfileCreateRequest):
    try:
        path = create_profile(
            body.name,
            clone_from=body.clone_from,
            display_name=body.display_name,
            note=body.note,
        )
        return ApiEnvelope(success=True, data={"path": str(path)})
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})
    except FileExistsError as e:
        return JSONResponse(status_code=409, content={"success": False, "error": str(e)})


@router.get("/api/hermes/config-sources")
def config_sources_list():
    items = list_config_sources()
    return ApiEnvelope(success=True, data=[item.model_dump() for item in items])


@router.post("/api/hermes/config-sources")
def config_sources_create(body: ConfigSourceCreateRequest):
    try:
        item = create_config_source(
            body.name,
            backing_profile=body.backing_profile,
            display_name=body.display_name,
            note=body.note,
        )
        return ApiEnvelope(success=True, data=item.model_dump())
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"success": False, "error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.put("/api/hermes/config-sources/{source_id}")
def config_sources_update(source_id: str, body: ConfigSourceUpdateRequest):
    try:
        item = update_config_source(
            source_id,
            name=body.name,
            backing_profile=body.backing_profile,
            display_name=body.display_name,
            note=body.note,
        )
        return ApiEnvelope(success=True, data=item.model_dump())
    except FileExistsError as e:
        return JSONResponse(status_code=409, content={"success": False, "error": str(e)})
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"success": False, "error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.delete("/api/hermes/config-sources/{source_id}")
def config_sources_delete(source_id: str):
    try:
        delete_config_source(source_id)
        return ApiEnvelope(success=True, data={"source_id": source_id})
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"success": False, "error": str(e)})
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.get("/api/hermes/profile-bindings")
def profile_bindings_list():
    summaries = list_profile_summaries()
    items = list_profile_bindings([s.name for s in summaries])
    return ApiEnvelope(success=True, data=[item.model_dump() for item in items])


@router.put("/api/hermes/profiles/{name}/binding")
def profile_binding_update(name: str, body: ProfileBindingUpdateRequest):
    if not profile_exists(name):
        return JSONResponse(status_code=404, content={"success": False, "error": f"Profile '{name}' not found"})
    try:
        set_profile_binding(None, name, body.mode, body.source_id)
        return ApiEnvelope(success=True, data={"profile_name": name, "mode": body.mode, "source_id": body.source_id})
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.get("/api/hermes/channels/overview")
def channels_overview():
    items = list_channels_overview()
    return ApiEnvelope(success=True, data=[item.model_dump() for item in items])


@router.get("/api/hermes/ai/overview")
def ai_overview():
    items = list_ai_overview()
    return ApiEnvelope(success=True, data=[item.model_dump() for item in items])


@router.post("/api/hermes/profiles/clone")
def profiles_clone(body: ProfileCloneRequest):
    try:
        path = clone_profile(
            body.name,
            body.clone_from,
            display_name=body.display_name,
            note=body.note,
        )
        return ApiEnvelope(success=True, data={"path": str(path)})
    except (ValueError, FileNotFoundError, FileExistsError) as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.delete("/api/hermes/profiles/{name}")
def profiles_delete(name: str):
    try:
        path = delete_profile(name)
        return ApiEnvelope(success=True, data={"deleted": str(path)})
    except (ValueError, FileNotFoundError) as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.put("/api/hermes/profiles/{name}/rename")
def profiles_rename(name: str, body: ProfileRenameRequest):
    try:
        path = rename_profile(name, body.new_name)
        return ApiEnvelope(success=True, data={"path": str(path)})
    except (ValueError, FileNotFoundError, FileExistsError) as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.put("/api/hermes/profiles/{name}/meta")
def profiles_meta_update(name: str, body: ProfileMetaUpdateRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        path = update_profile_meta(
            name,
            display_name=body.display_name,
            note=body.note,
        )
        return ApiEnvelope(success=True, data={"profile_name": name, "path": str(path)})
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"success": False, "error": str(e)})


@router.get("/api/hermes/profiles/{name}/summary")
def profiles_summary(name: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    from admin_core.hermes_profiles import (
        _read_config_model, _check_gateway_running, _has_api_server,
        _get_enabled_channels, _get_active_profile_name,
    )
    from admin_contract.models import HermesProfileSummary
    model, provider = _read_config_model(profile_dir)
    channels = _get_enabled_channels(profile_dir)
    summary = HermesProfileSummary(
        name=name,
        is_active=(_get_active_profile_name() == name),
        home_path=str(profile_dir),
        config_path=str(profile_dir / "config.yaml"),
        env_path=str(profile_dir / ".env"),
        has_gateway=_check_gateway_running(profile_dir),
        has_api_server=_has_api_server(profile_dir),
        channels=channels,
        default_model=model,
        provider=provider,
    )
    return ApiEnvelope(success=True, data=summary.model_dump())


@router.post("/api/hermes/profiles/{name}/gateway/{action}")
def profiles_gateway_action(name: str, action: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        result = run_gateway_action(name, action)
        payload = GatewayActionResponse(**result)
        return ApiEnvelope(success=True, data=payload.model_dump())
    except FileNotFoundError as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})
    except RuntimeError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


# Config


@router.get("/api/hermes/profiles/{name}/config/raw")
def config_raw(name: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    content = read_config_raw(profile_dir)
    parsed = parse_config(profile_dir / "config.yaml")
    return ApiEnvelope(success=True, data={
        "profile_name": name,
        "content": content,
        "parsed": parsed,
    })


@router.put("/api/hermes/profiles/{name}/config/raw")
def config_raw_update(name: str, body: ConfigUpdateRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        write_config_raw(profile_dir, body.content)
        return ApiEnvelope(success=True, data={"profile_name": name})
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": f"Invalid YAML: {e}"})


@router.post("/api/hermes/profiles/{name}/config/backup")
def config_backup(name: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        path = backup_config(profile_dir)
        return ApiEnvelope(success=True, data={"backup_path": path})
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"success": False, "error": str(e)})


@router.get("/api/hermes/profiles/{name}/config/backups")
def config_backups(name: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    items = list_backups(profile_dir)
    return ApiEnvelope(success=True, data=items)


@router.post("/api/hermes/profiles/{name}/config/rollback")
def config_rollback(name: str, body: ConfigRollbackRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        path = rollback_config(profile_dir, body.backup_filename)
        return ApiEnvelope(success=True, data={"restored_from": path})
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"success": False, "error": str(e)})


# Env


@router.get("/api/hermes/profiles/{name}/env")
def env_read(name: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    variables = read_env(profile_dir)
    return ApiEnvelope(success=True, data={"profile_name": name, "variables": variables})


@router.get("/api/hermes/profiles/{name}/env/reveal/{key}")
def env_reveal(name: str, key: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    value = reveal_env_key(profile_dir, key)
    if value is None:
        return JSONResponse(status_code=404, content={"success": False, "error": f"Key '{key}' not found"})
    return ApiEnvelope(success=True, data={"profile_name": name, "key": key, "value": value})


@router.put("/api/hermes/profiles/{name}/env/{key}")
def env_update(name: str, key: str, body: EnvKeyUpdateRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    update_env_key(profile_dir, key, body.value)
    return ApiEnvelope(success=True, data={"profile_name": name, "key": key})


@router.delete("/api/hermes/profiles/{name}/env/{key}")
def env_delete(name: str, key: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    delete_env_key(profile_dir, key)
    return ApiEnvelope(success=True, data={"profile_name": name, "key": key})


# AI


@router.get("/api/hermes/profiles/{name}/ai")
def ai_read(name: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    ai_data = read_ai_config(profile_dir)
    return ApiEnvelope(success=True, data={"profile_name": name, **ai_data})


@router.put("/api/hermes/profiles/{name}/ai")
def ai_update(name: str, body: AIConfigUpdateRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    ai_data = {
        "default_model": body.default_model,
        "provider": body.provider,
        "base_url": body.base_url,
        "auxiliary": body.auxiliary,
        "providers": body.providers,
        "fallback_providers": body.fallback_providers,
    }
    try:
        write_ai_config(profile_dir, ai_data)
        return ApiEnvelope(success=True, data={"profile_name": name})
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.get("/api/hermes/profiles/{name}/ai/custom-providers")
def ai_custom_providers_list(name: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    items = list_custom_providers(profile_dir)
    return ApiEnvelope(success=True, data={"profile_name": name, "providers": items})


@router.put("/api/hermes/profiles/{name}/ai/custom-providers/{provider_name}")
def ai_custom_providers_upsert(name: str, provider_name: str, body: CustomProviderUpdateRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    if provider_name != body.name:
        return JSONResponse(status_code=400, content={"success": False, "error": "Provider name mismatch"})
    try:
        upsert_custom_provider(profile_dir, body.model_dump())
        return ApiEnvelope(success=True, data={"profile_name": name, "name": provider_name})
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.delete("/api/hermes/profiles/{name}/ai/custom-providers/{provider_name}")
def ai_custom_providers_delete(name: str, provider_name: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        delete_custom_provider(profile_dir, provider_name)
        return ApiEnvelope(success=True, data={"profile_name": name, "name": provider_name})
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"success": False, "error": str(e)})


@router.post("/api/hermes/profiles/{name}/ai/custom-providers/test")
def ai_custom_providers_test(name: str, body: CustomProviderTestRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        result = test_custom_provider_connection(body.model_dump())
        return ApiEnvelope(success=True, data=result)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.get("/api/hermes/profiles/{name}/ai/custom-providers/import-openclaw/candidates")
def ai_custom_providers_import_openclaw_candidates(name: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        result = list_openclaw_import_candidates()
        return ApiEnvelope(success=True, data=result)
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"success": False, "error": str(e)})
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.post("/api/hermes/profiles/{name}/ai/custom-providers/import-openclaw")
def ai_custom_providers_import_openclaw(name: str, body: OpenClawImportRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        result = import_openclaw_custom_providers(profile_dir, body.names)
        return ApiEnvelope(success=True, data=result)
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"success": False, "error": str(e)})
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


# Channels


@router.get("/api/hermes/profiles/{name}/channels")
def channels_list(name: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    channels = list_channels(profile_dir)
    return ApiEnvelope(success=True, data={"profile_name": name, "channels": channels})


@router.get("/api/hermes/profiles/{name}/channels/{channel_id}")
def channels_get(name: str, channel_id: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    snapshot = get_channel_snapshot(profile_dir, channel_id)
    return ApiEnvelope(success=True, data=snapshot)


@router.put("/api/hermes/profiles/{name}/channels/{channel_id}")
def channels_update(name: str, channel_id: str, body: ChannelUpdateRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        update_channel_config(profile_dir, channel_id, body.config)
        return ApiEnvelope(success=True, data={"profile_name": name, "channel_id": channel_id})
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": f"Failed to update channel: {e}"})


# Channel Onboarding (QR-code based)


@router.post("/api/hermes/profiles/{name}/channels/{channel_id}/onboard/session")
def channels_onboard_start(name: str, channel_id: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        result = start_onboard_session(profile_dir, channel_id)
        return ApiEnvelope(success=True, data=result)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.get("/api/hermes/profiles/{name}/channels/{channel_id}/onboard/session/{session_id}")
def channels_onboard_get(name: str, channel_id: str, session_id: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    session = get_onboard_session(profile_dir, channel_id, session_id)
    if not session:
        return JSONResponse(status_code=404, content={"success": False, "error": "Session not found"})
    return ApiEnvelope(success=True, data=session)


@router.post("/api/hermes/profiles/{name}/channels/{channel_id}/onboard/session/{session_id}/apply")
def channels_onboard_apply(name: str, channel_id: str, session_id: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        result = apply_onboard_session(profile_dir, channel_id, session_id)
        return ApiEnvelope(success=True, data=result)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


# Workspace


@router.get("/api/hermes/profiles/{name}/workspace/files")
def workspace_files(name: str, subpath: str = ""):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    entries = list_files(profile_dir, subpath)
    return ApiEnvelope(success=True, data=entries)


@router.get("/api/hermes/profiles/{name}/workspace/file")
def workspace_file_read(name: str, file_path: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        content = read_file(profile_dir, file_path)
        return ApiEnvelope(success=True, data={
            "profile_name": name,
            "path": file_path,
            "content": content,
            "size": len(content),
        })
    except (ValueError, FileNotFoundError) as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.put("/api/hermes/profiles/{name}/workspace/file")
def workspace_file_write(name: str, body: WorkspaceFileUpdateRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        write_file(profile_dir, body.path, body.content)
        return ApiEnvelope(success=True, data={"profile_name": name, "path": body.path})
    except (ValueError, OSError) as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.post("/api/hermes/profiles/{name}/workspace/file/backup")
def workspace_file_backup(name: str, body: WorkspaceFileBackupRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        path = backup_file(profile_dir, body.path)
        return ApiEnvelope(success=True, data={"profile_name": name, "path": body.path, "backup_path": path})
    except (ValueError, FileNotFoundError, OSError) as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.get("/api/hermes/profiles/{name}/workspace/file/backups")
def workspace_file_backups(name: str, file_path: str):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        items = list_file_backups(profile_dir, file_path)
        return ApiEnvelope(success=True, data=items)
    except (ValueError, OSError) as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})


@router.post("/api/hermes/profiles/{name}/workspace/file/restore")
def workspace_file_restore(name: str, body: WorkspaceFileRestoreRequest):
    profile_dir, err = _resolve_profile(name)
    if err:
        return err
    try:
        path = restore_file_backup(profile_dir, body.path, body.backup_filename)
        return ApiEnvelope(success=True, data={"profile_name": name, "path": body.path, "restored_from": path})
    except (ValueError, FileNotFoundError, OSError) as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})
