from pathlib import Path

from admin_core.shared_china_registry import (
    bundled_china_definitions_root,
    get_china_channel_detail,
    get_china_channel_registry,
    get_china_channels_bundle,
)


def test_bundled_china_definitions_exist():
    root = bundled_china_definitions_root()

    assert root.exists()
    assert (root / "channel-plugins.registry.json").exists()
    assert (root / "channel-plugin-details").exists()


def test_china_registry_reads_bundled_data():
    registry = get_china_channel_registry()

    assert registry
    channel_ids = {str(item.get("id") or "") for item in registry}
    assert "feishu" in channel_ids


def test_china_channel_detail_reads_bundled_file():
    detail = get_china_channel_detail("feishu")

    assert detail is not None
    assert str(detail.get("id") or "") == "feishu"


def test_china_channels_bundle_uses_bundled_source():
    bundle = get_china_channels_bundle()

    assert bundle["count"] > 0
    assert Path(bundle["source_root"]) == bundled_china_definitions_root()
