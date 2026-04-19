export interface ApiErrorInfo {
  code: string
  message: string
  hints?: string[]
}

export interface ApiEnvelope<T = unknown> {
  success: boolean
  message?: string | null
  error?: string | null
  error_info?: ApiErrorInfo | null
  data?: T | null
}

export interface HermesProfileSummary {
  name: string
  display_name?: string | null
  note?: string | null
  is_active: boolean
  home_path: string
  config_path: string
  env_path: string
  has_gateway: boolean
  has_api_server: boolean
  channels: string[]
  default_model?: string | null
  provider?: string | null
  binding_mode?: string | null
  source_id?: string | null
  source_name?: string | null
}

export interface ConfigSourceItem {
  id: string
  name: string
  kind: string
  backing_profile?: string | null
  display_name?: string | null
  note?: string | null
  linked_profiles: string[]
}

export interface ProfileBindingItem {
  profile_name: string
  mode: string
  source_id?: string | null
  source_name?: string | null
}

export interface ProfileBindingUpdateRequest {
  mode: string
  source_id?: string | null
}

export interface ChannelOverviewItem {
  channel_id: string
  source_id?: string | null
  source_name?: string | null
  profile_name: string
  mode: string
  configured: boolean
  enabled: boolean
}

export interface AiOverviewItem {
  profile_name: string
  source_id?: string | null
  source_name?: string | null
  mode: string
  default_model?: string | null
  provider?: string | null
}

export interface ConfigSourceCreateRequest {
  name: string
  backing_profile?: string | null
  display_name?: string | null
  note?: string | null
}

export interface ConfigSourceUpdateRequest {
  backing_profile?: string | null
  display_name?: string | null
  note?: string | null
}

export interface WorkspaceFileEntry {
  path: string
  kind: 'file' | 'dir'
  editable: boolean
  size?: number | null
}

export interface ProfileCreateRequest {
  name: string
  display_name?: string | null
  note?: string | null
  clone_from?: string | null
}

export interface ProfileRenameRequest {
  new_name: string
}

export interface ProfileCloneRequest {
  name: string
  display_name?: string | null
  note?: string | null
  clone_from: string
}

export interface ProfileMetaUpdateRequest {
  display_name?: string | null
  note?: string | null
}

export interface GatewayActionResponse {
  profile_name: string
  action: string
  has_gateway: boolean
  command: string[]
  stdout?: string | null
  stderr?: string | null
}

export interface ConfigRawResponse {
  profile_name: string
  content: string
  parsed?: Record<string, unknown> | null
}

export interface ConfigUpdateRequest {
  content: string
}

export interface EnvResponse {
  profile_name: string
  variables: Record<string, boolean>
}

export interface EnvKeyUpdateRequest {
  value: string
}

export interface AIConfigResponse {
  profile_name: string
  default_model?: string | null
  provider?: string | null
  base_url?: string | null
  embedding?: Record<string, unknown> | null
  auxiliary?: Record<string, unknown> | null
  providers?: Record<string, unknown> | null
  fallback_providers?: unknown[]
}

export interface AIConfigUpdateRequest {
  default_model?: string | null
  provider?: string | null
  base_url?: string | null
  embedding?: Record<string, unknown> | null
  auxiliary?: Record<string, unknown> | null
  providers?: Record<string, unknown> | null
  fallback_providers?: unknown[] | null
}

export interface CustomProviderItem {
  name: string
  base_url: string
  api_key?: string | null
  api_key_configured: boolean
  api_mode?: string | null
  models?: Record<string, unknown> | null
}

export interface CustomProviderListResponse {
  profile_name: string
  providers: CustomProviderItem[]
}

export interface CustomProviderUpdateRequest {
  name: string
  base_url: string
  api_key?: string | null
  api_mode?: string | null
  models?: Record<string, unknown> | null
}

export interface CustomProviderTestRequest {
  base_url: string
  api_key?: string | null
  api_mode?: string | null
  model?: string | null
}

export interface CustomProviderTestResponse {
  success: boolean
  message: string
  details?: Record<string, unknown> | null
}

export interface OpenClawImportCandidateItem {
  name: string
  base_url: string
  api_mode?: string | null
  api_key_configured: boolean
  models_count: number
  model_names: string[]
  import_strategy: string
  builtin_provider?: string | null
  builtin_label?: string | null
  reason?: string | null
}

export interface OpenClawImportCandidatesResponse {
  source_path: string
  candidates: OpenClawImportCandidateItem[]
  skipped: string[]
}

export interface OpenClawImportRequest {
  names: string[]
}

export interface OpenClawImportResponse {
  source_path: string
  imported: string[]
  skipped: string[]
  count: number
}

export interface ChannelSnapshot {
  channel_id: string
  enabled: boolean
  configured: boolean
  config?: Record<string, unknown> | null
}

export interface ChannelListResponse {
  profile_name: string
  channels: Record<string, ChannelSnapshot>
}

export interface ChinaChannelDetailField {
  key: string
  label: string
  description?: string | null
}

export interface ChinaChannelDetail {
  id: string
  name: string
  intro?: string | null
  features?: string[]
  configKeys?: string[]
  fields?: ChinaChannelDetailField[]
  usageNotes?: string[]
}

export interface ChinaChannelMetaItem {
  id: string
  order?: number
  name: string
  packageName?: string | null
  packageAliases?: string[]
  installUrl?: string | null
  adminUrl?: string | null
  installSourceType?: string | null
  sourceDir?: string | null
  isEnterprise?: boolean
  description?: string | null
  channelKeys?: string[]
  pluginIds?: string[]
  summary?: string | null
  tags?: string[]
  detailDocId?: string | null
  detail?: ChinaChannelDetail | null
}

export interface ChinaChannelsBundle {
  source_root: string
  count: number
  items: ChinaChannelMetaItem[]
}

export interface WorkspaceFileResponse {
  profile_name: string
  path: string
  content: string
  size: number
}

export interface WorkspaceFileUpdateRequest {
  path: string
  content: string
}

export interface WorkspaceFileBackupRequest {
  path: string
}

export interface WorkspaceFileRestoreRequest {
  path: string
  backup_filename: string
}

export interface WorkspaceFileBackupItem {
  filename: string
  path: string
  target_path: string
  size: number
  modified: number
}

export interface ConfigBackupItem {
  filename: string
  path: string
  size: number
  modified: number
}
