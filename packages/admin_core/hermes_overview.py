"""Overview builders for channels and AI across profiles and config sources."""

from __future__ import annotations

from pathlib import Path

from admin_contract.models import AiOverviewItem, ChannelOverviewItem
from admin_core.hermes_ai import read_ai_config
from admin_core.hermes_bindings import list_profile_bindings
from admin_core.hermes_channels import list_channels
from admin_core.hermes_profiles import list_profile_summaries
from admin_core.hermes_sources import list_config_sources


def list_channels_overview(db_path: Path | None = None) -> list[ChannelOverviewItem]:
    profiles = list_profile_summaries(db_path=db_path)
    bindings = {item.profile_name: item for item in list_profile_bindings([p.name for p in profiles], db_path=db_path)}
    result: list[ChannelOverviewItem] = []
    for profile in profiles:
        snapshot = list_channels(Path(profile.home_path))
        binding = bindings.get(profile.name)
        if not snapshot:
            result.append(ChannelOverviewItem(
                channel_id='-',
                source_id=binding.source_id if binding else None,
                source_name=binding.source_name if binding else None,
                profile_name=profile.name,
                mode=binding.mode if binding else 'standalone',
                configured=False,
                enabled=False,
            ))
            continue
        for channel_id, channel in snapshot.items():
            result.append(ChannelOverviewItem(
                channel_id=channel_id,
                source_id=binding.source_id if binding else None,
                source_name=binding.source_name if binding else None,
                profile_name=profile.name,
                mode=binding.mode if binding else 'standalone',
                configured=bool(channel.get('configured')),
                enabled=bool(channel.get('enabled')),
            ))
    return result


def list_ai_overview(db_path: Path | None = None) -> list[AiOverviewItem]:
    profiles = list_profile_summaries(db_path=db_path)
    bindings = {item.profile_name: item for item in list_profile_bindings([p.name for p in profiles], db_path=db_path)}
    result: list[AiOverviewItem] = []
    for profile in profiles:
        ai = read_ai_config(Path(profile.home_path))
        binding = bindings.get(profile.name)
        result.append(AiOverviewItem(
            profile_name=profile.name,
            source_id=binding.source_id if binding else None,
            source_name=binding.source_name if binding else None,
            mode=binding.mode if binding else 'standalone',
            default_model=ai.get('default_model'),
            provider=ai.get('provider'),
        ))
    return result


def list_sources_with_profiles(db_path: Path | None = None):
    return list_config_sources(db_path=db_path)
