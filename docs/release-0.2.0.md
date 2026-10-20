# 0.2.0 发行验证

验证日期：2026-10-19（America/New_York）。发行目标是同一源码版本的 Windows、macOS、
Android 和离线网页包。原版只做安装包静态分析，没有访问原版账户或用户记录。

| 范围 | 已完成 | 边界 |
| --- | --- | --- |
| 领域逻辑 | TypeScript 检查、18 项 Vitest 测试 | 时间线并集/空白、方向填满、跨日、版本冲突、暂停、导入等 |
| Windows 浏览器/桌面 | 9 项 Playwright 完整流程通过 | 隔离数据；含四面板、补记、填满、暂停恢复、备份、离线、暗色、API |
| Windows 发行 EXE | 重启持久化、鉴权 API 两项通过 | 运行实际便携包；未使用真实用户数据 |
| macOS arm64 | Mac 上打包、codesign 深度严格校验、实际 .app 重启与 API 测试通过 | ad-hoc 签名；没有 Developer ID/Apple 公证 |
| macOS x64 | Mac 上打包、codesign 深度严格校验 | 没有 Intel 硬件执行验证 |
| Android | assembleRelease、lintRelease 通过；apksigner verify 通过 | API 24+，target 36；没有真机安装/触控/后台生命周期验收 |
| 手机界面 | 390px 窄屏四面板与暗色无水平溢出 | 桌面 Chrome 模拟；不等于手机 WebView 或 iOS 验收 |
| 依赖 | npm audit --omit=dev：0 vulnerabilities | 只代表本次依赖审计结果 |

API 检查覆盖未鉴权、拒绝跨站 Origin、创建记录与界面联动、请求去重/冲突、版本前置条件、
时间线空白与填满、匹配计时控制、软删除恢复。桌面端仅监听回环地址，记录及令牌留在设备。

Android lint 无错误；仍有生成模板资源未使用、工具版本建议等警告。Capacitor 依赖采用其自身
随包 baseline；这不是本项目新加的豁免。APK 使用项目专用密钥，私钥与密码不随发行上传。

没有验证原版数据格式、官方同步兼容、跨设备自动同步；没有 iOS 原生包、系统提醒或前台服务。
