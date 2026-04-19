from typing import Generic, TypeVar

from pydantic import BaseModel


T = TypeVar("T")


class ApiErrorInfo(BaseModel):
    code: str
    message: str
    hints: list[str] | None = None


class ApiEnvelope(BaseModel, Generic[T]):
    success: bool
    message: str | None = None
    error: str | None = None
    error_info: ApiErrorInfo | None = None
    data: T | None = None


class HermesProfileSummary(BaseModel):
    name: str
    display_name: str | None = None
    note: str | None = None
    is_active: bool = False
    home_path: str
    config_path: str
    env_path: str
    has_gateway: bool = False
    has_api_server: bool = False
    channels: list[str] = []
    default_model: str | None = None
    provider: str | None = None
    binding_mode: str | None = None
    source_id: str | None = None
    source_name: str | None = None


class ConfigSourceItem(BaseModel):
    id: str
    name: str
    kind: str
    backing_profile: str | None = None
    display_name: str | None = None
    note: str | None = None
    linked_profiles: list[str] = []


class ProfileBindingItem(BaseModel):
    profile_name: str
    mode: str
    source_id: str | None = None
    source_name: str | None = None


class ProfileBindingUpdateRequest(BaseModel):
    mode: str
    source_id: str | None = None


class ChannelOverviewItem(BaseModel):
    channel_id: str
    source_id: str | None = None
    source_name: str | None = None
    profile_name: str
    mode: str
    configured: bool = False
    enabled: bool = False


class AiOverviewItem(BaseModel):
    profile_name: str
    source_id: str | None = None
    source_name: str | None = None
    mode: str
    default_model: str | None = None
    provider: str | None = None


class ConfigSourceCreateRequest(BaseModel):
    name: str
    backing_profile: str | None = None
    display_name: str | None = None
    note: str | None = None


class ConfigSourceUpdateRequest(BaseModel):
    backing_profile: str | None = None
    display_name: str | None = None
    note: str | None = None


class HermesWorkspaceFileEntry(BaseModel):
    path: str
    kind: str
    editable: bool = True
    size: int | None = None


class ProfileCreateRequest(BaseModel):
    name: str
    display_name: str | None = None
    note: str | None = None
    clone_from: str | None = None


class ProfileRenameRequest(BaseModel):
    new_name: str


class ProfileCloneRequest(BaseModel):
    name: str
    display_name: str | None = None
    note: str | None = None
    clone_from: str


class ProfileMetaUpdateRequest(BaseModel):
    display_name: str | None = None
    note: str | None = None


class GatewayActionResponse(BaseModel):
    profile_name: str
    action: str
    has_gateway: bool
    command: list[str] = []
    stdout: str | None = None
    stderr: str | None = None


class ConfigRawResponse(BaseModel):
    profile_name: str
    content: str
    parsed: dict | None = None


class ConfigUpdateRequest(BaseModel):
    content: str


class ConfigRollbackRequest(BaseModel):
    backup_filename: str


class EnvResponse(BaseModel):
    profile_name: str
    variables: dict[str, bool]


class EnvKeyUpdateRequest(BaseModel):
    value: str


class EnvRevealRequest(BaseModel):
    key: str


class AIConfigResponse(BaseModel):
    profile_name: str
    default_model: str | None = None
    provider: str | None = None
    base_url: str | None = None
    embedding: dict | None = None
    auxiliary: dict | None = None
    providers: dict | None = None
    fallback_providers: list = []


class AIConfigUpdateRequest(BaseModel):
    default_model: str | None = None
    provider: str | None = None
    base_url: str | None = None
    embedding: dict | None = None
    auxiliary: dict | None = None
    providers: dict | None = None
    fallback_providers: list | None = None


class CustomProviderItem(BaseModel):
    name: str
    base_url: str
    api_key: str | None = None
    api_key_configured: bool = False
    api_mode: str | None = None
    models: dict | None = None


class CustomProviderListResponse(BaseModel):
    profile_name: str
    providers: list[CustomProviderItem] = []


class CustomProviderUpdateRequest(BaseModel):
    name: str
    base_url: str
    api_key: str | None = None
    api_mode: str | None = None
    models: dict | None = None


class CustomProviderTestRequest(BaseModel):
    base_url: str
    api_key: str | None = None
    api_mode: str | None = None
    model: str | None = None


class CustomProviderTestResponse(BaseModel):
    success: bool
    message: str
    details: dict | None = None


class OpenClawImportCandidateItem(BaseModel):
    name: str
    base_url: str
    api_mode: str | None = None
    api_key_configured: bool = False
    models_count: int = 0
    model_names: list[str] = []
    import_strategy: str = "custom"
    builtin_provider: str | None = None
    builtin_label: str | None = None
    reason: str | None = None


class OpenClawImportCandidatesResponse(BaseModel):
    source_path: str
    candidates: list[OpenClawImportCandidateItem] = []
    skipped: list[str] = []


class OpenClawImportRequest(BaseModel):
    names: list[str] = []


class OpenClawImportResponse(BaseModel):
    source_path: str
    imported: list[str] = []
    skipped: list[str] = []
    count: int = 0


class ChannelSnapshot(BaseModel):
    channel_id: str
    enabled: bool = False
    configured: bool = False
    config: dict | None = None


class ChannelListResponse(BaseModel):
    profile_name: str
    channels: dict[str, ChannelSnapshot]


class ChannelUpdateRequest(BaseModel):
    config: dict


class WorkspaceFileResponse(BaseModel):
    profile_name: str
    path: str
    content: str
    size: int


class WorkspaceFileUpdateRequest(BaseModel):
    path: str
    content: str


class WorkspaceFileBackupRequest(BaseModel):
    path: str


class WorkspaceFileRestoreRequest(BaseModel):
    path: str
    backup_filename: str


class WorkspaceFileBackupItem(BaseModel):
    filename: str
    path: str
    target_path: str
    size: int
    modified: float
