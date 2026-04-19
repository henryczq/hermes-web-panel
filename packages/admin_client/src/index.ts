import { request } from './http.js'
import type {
  HermesProfileSummary,
  ProfileCreateRequest,
  ProfileCloneRequest,
  ProfileRenameRequest,
  ProfileMetaUpdateRequest,
  GatewayActionResponse,
  ConfigRawResponse,
  ConfigUpdateRequest,
  EnvResponse,
  AIConfigResponse,
  AIConfigUpdateRequest,
  CustomProviderListResponse,
  CustomProviderUpdateRequest,
  CustomProviderTestRequest,
  CustomProviderTestResponse,
  OpenClawImportCandidatesResponse,
  OpenClawImportRequest,
  OpenClawImportResponse,
  ChannelListResponse,
  ChannelSnapshot,
  ChinaChannelsBundle,
  WorkspaceFileEntry,
  WorkspaceFileResponse,
  WorkspaceFileUpdateRequest,
  ConfigBackupItem,
  ConfigSourceItem,
  ConfigSourceCreateRequest,
  ProfileBindingItem,
  ProfileBindingUpdateRequest,
  ChannelOverviewItem,
  AiOverviewItem,
} from 'hermes_web_panel_contract'

const BASE = '/api/hermes'

export class HermesAdminClient {
  async listProfiles(): Promise<HermesProfileSummary[]> {
    return request(`${BASE}/profiles`)
  }

  async createProfile(body: ProfileCreateRequest): Promise<{ path: string }> {
    return request(`${BASE}/profiles`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async cloneProfile(
    body: ProfileCloneRequest,
  ): Promise<{ path: string }> {
    return request(`${BASE}/profiles/clone`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async renameProfile(
    name: string,
    newName: string,
  ): Promise<{ path: string }> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ new_name: newName }),
    })
  }

  async updateProfileMeta(
    name: string,
    body: ProfileMetaUpdateRequest,
  ): Promise<{ profile_name: string; path: string }> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/meta`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  async deleteProfile(name: string): Promise<{ deleted: string }> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  }

  async getProfileSummary(name: string): Promise<HermesProfileSummary> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/summary`)
  }

  async startGateway(name: string): Promise<GatewayActionResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/gateway/start`, {
      method: 'POST',
    })
  }

  async stopGateway(name: string): Promise<GatewayActionResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/gateway/stop`, {
      method: 'POST',
    })
  }

  async restartGateway(name: string): Promise<GatewayActionResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/gateway/restart`, {
      method: 'POST',
    })
  }

  async getConfigRaw(name: string): Promise<ConfigRawResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/config/raw`)
  }

  async saveConfigRaw(
    name: string,
    body: ConfigUpdateRequest,
  ): Promise<{ profile_name: string }> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/config/raw`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  async backupConfig(name: string): Promise<{ backup_path: string }> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/config/backup`,
      { method: 'POST' },
    )
  }

  async listConfigBackups(name: string): Promise<ConfigBackupItem[]> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/config/backups`,
    )
  }

  async rollbackConfig(
    name: string,
    backupFilename: string,
  ): Promise<{ restored_from: string }> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/config/rollback`,
      {
        method: 'POST',
        body: JSON.stringify({ backup_filename: backupFilename }),
      },
    )
  }

  async getEnvState(name: string): Promise<EnvResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/env`)
  }

  async revealEnvKey(
    name: string,
    key: string,
  ): Promise<{ profile_name: string; key: string; value: string }> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/env/reveal/${encodeURIComponent(key)}`,
    )
  }

  async updateEnvKey(
    name: string,
    key: string,
    value: string,
  ): Promise<{ profile_name: string; key: string }> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/env/${encodeURIComponent(key)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ value }),
      },
    )
  }

  async deleteEnvKey(
    name: string,
    key: string,
  ): Promise<{ profile_name: string; key: string }> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/env/${encodeURIComponent(key)}`,
      { method: 'DELETE' },
    )
  }

  async getAiConfig(name: string): Promise<AIConfigResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/ai`)
  }

  async saveAiConfig(
    name: string,
    body: AIConfigUpdateRequest,
  ): Promise<{ profile_name: string }> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/ai`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  async getCustomProviders(name: string): Promise<CustomProviderListResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/ai/custom-providers`)
  }

  async saveCustomProvider(
    name: string,
    body: CustomProviderUpdateRequest,
  ): Promise<{ profile_name: string; name: string }> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/ai/custom-providers/${encodeURIComponent(body.name)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  async deleteCustomProvider(
    name: string,
    providerName: string,
  ): Promise<{ profile_name: string; name: string }> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/ai/custom-providers/${encodeURIComponent(providerName)}`, {
      method: 'DELETE',
    })
  }

  async testCustomProvider(
    name: string,
    body: CustomProviderTestRequest,
  ): Promise<CustomProviderTestResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/ai/custom-providers/test`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async getOpenClawImportCandidates(name: string): Promise<OpenClawImportCandidatesResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/ai/custom-providers/import-openclaw/candidates`)
  }

  async importOpenClawCustomProviders(
    name: string,
    body: OpenClawImportRequest,
  ): Promise<OpenClawImportResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/ai/custom-providers/import-openclaw`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async listConfigSources(): Promise<ConfigSourceItem[]> {
    return request(`${BASE}/config-sources`)
  }

  async createConfigSource(body: ConfigSourceCreateRequest): Promise<ConfigSourceItem> {
    return request(`${BASE}/config-sources`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async listProfileBindings(): Promise<ProfileBindingItem[]> {
    return request(`${BASE}/profile-bindings`)
  }

  async updateProfileBinding(
    name: string,
    body: ProfileBindingUpdateRequest,
  ): Promise<{ profile_name: string; mode: string; source_id?: string | null }> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/binding`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  async getChannelsOverview(): Promise<ChannelOverviewItem[]> {
    return request(`${BASE}/channels/overview`)
  }

  async getAiOverview(): Promise<AiOverviewItem[]> {
    return request(`${BASE}/ai/overview`)
  }

  async getChannels(name: string): Promise<ChannelListResponse> {
    return request(`${BASE}/profiles/${encodeURIComponent(name)}/channels`)
  }

  async getChinaChannelsMeta(): Promise<ChinaChannelsBundle> {
    return request(`${BASE}/meta/china-channels`)
  }

  async getChannel(
    name: string,
    channelId: string,
  ): Promise<ChannelSnapshot> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/channels/${encodeURIComponent(channelId)}`,
    )
  }

  async updateChannel(
    name: string,
    channelId: string,
    config: Record<string, unknown>,
  ): Promise<{ profile_name: string; channel_id: string }> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/channels/${encodeURIComponent(channelId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ config }),
      },
    )
  }

  async getWorkspaceFiles(
    name: string,
    subpath?: string,
  ): Promise<WorkspaceFileEntry[]> {
    const params = subpath ? `?subpath=${encodeURIComponent(subpath)}` : ''
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/workspace/files${params}`,
    )
  }

  async readWorkspaceFile(
    name: string,
    filePath: string,
  ): Promise<WorkspaceFileResponse> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/workspace/file?file_path=${encodeURIComponent(filePath)}`,
    )
  }

  async writeWorkspaceFile(
    name: string,
    body: WorkspaceFileUpdateRequest,
  ): Promise<{ profile_name: string; path: string }> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/workspace/file`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
    )
  }

  async startOnboardSession(
    name: string,
    channelId: string,
  ): Promise<{ session_id: string; qr_url?: string; verification_url?: string }> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/channels/${encodeURIComponent(channelId)}/onboard/session`,
      { method: 'POST' },
    )
  }

  async getOnboardSession(
    name: string,
    channelId: string,
    sessionId: string,
  ): Promise<{ status: string; qr_url?: string; credentials?: Record<string, string> | null; error?: string | null }> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/channels/${encodeURIComponent(channelId)}/onboard/session/${encodeURIComponent(sessionId)}`,
    )
  }

  async applyOnboardSession(
    name: string,
    channelId: string,
    sessionId: string,
  ): Promise<{ profile_name: string; channel_id: string }> {
    return request(
      `${BASE}/profiles/${encodeURIComponent(name)}/channels/${encodeURIComponent(channelId)}/onboard/session/${encodeURIComponent(sessionId)}/apply`,
      { method: 'POST' },
    )
  }
}
