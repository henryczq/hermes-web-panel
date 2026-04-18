# OpenClaw Channel Helper Overview

## 鐩爣

璁╀唬鐞嗚兘鐢ㄧ粺涓€鏂瑰紡澶勭悊 8 涓父鐢ㄦ笭閬撶殑锛?

- 鎻掍欢瀹夎鐘舵€?
- 鎻掍欢鍚敤鐘舵€?
- 鐗堟湰淇℃伅
- 閰嶇疆璇存槑
- 閰嶇疆绀轰緥
- 閰嶇疆澧炲垹鏀?

鎵€鏈夊啓鎿嶄綔閮戒紭鍏堣蛋瀹樻柟 CLI锛?

- `openclaw plugins install`
- `openclaw plugins update`
- `openclaw plugins uninstall`
- `openclaw config get`
- `openclaw config set`
- `openclaw config unset`

## 命令口径补充

- `openclaw config set` 已支持 `--dry-run`，需要只验证配置变更而不落盘时优先使用
- `preflight` 在 admin-suite 里指的是 helper 自带检查命令，不是 `openclaw` 主 CLI 官方子命令
