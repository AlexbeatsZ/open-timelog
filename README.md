# 时迹 · Open Timelog

独立实现的开源时间记录应用，参考 UpTimer 的记录、回顾与自我反馈理念。
无需账号，离线保存，MIT 许可。支持 Windows 桌面端和响应式网页 / PWA。

**当前为 0.1.0：可使用的离线首版。** 尚未实现自动多设备同步、UpTimer 原生数据迁移、
计划与流程、定位/NFC、提醒和 Android 原生 APK。功能边界见
[参考研究](docs/research/uptimer.md)。

## 已实现

- 自定义活动、颜色、积极/日常/消极性质和积分速率；归档与恢复。
- 正向计时、暂停/继续、专注模式、关闭应用后恢复。
- 手动补记、多片段编辑、描述与标签、搜索、软删除与恢复。
- 全天时间条、每日记录、跨日分配、近 7/30 天统计、活动时长分布。
- 每日/每周时长目标，自动计算进度。
- 时间积分、奖励管理、积分兑换和兑换历史。
- JSON 完整备份、导入预览、按版本合并、完整恢复；CSV 与当日 Markdown 导出。
- 本地事务保存，多窗口更新通知；无账号、遥测和外部字体请求。

## 开始使用

Windows 发行包解压后运行 `Open Timelog.exe`，不需要安装 Node 或开发工具。
数据保存在应用自己的用户目录中，复制程序文件夹不会迁移数据。
需要迁移时先在「数据与设置」导出 JSON，再在另一端预览并导入。

若使用网页：部署 `dist/` 到独立静态站点，使用 HTTPS（或本机 localhost）。
首次在线打开并完成缓存后可以离线使用，在支持的浏览器中可安装为 PWA。
浏览器数据与桌面端数据相互独立；清除站点/应用数据前先备份。

### 从源码运行

需要 Node.js 24 LTS 与 npm。本仓库包含锁文件，推荐 `npm ci`。

```powershell
npm ci
npm run dev         # http://127.0.0.1:5173
npm run desktop     # 构建后打开 Windows 桌面端
```

首次运行 Electron 需要下载与锁定版本一致的项目运行时。使用已有 HTTP(S) 代理时，
可在当前终端中设置 `$env:ELECTRON_GET_USE_PROXY='1'`，再运行 `node node_modules/electron/install.js`。
这仅影响当前进程，不需要修改系统环境变量。

### 检查与打包

```powershell
npm run check
npm test
npm run build
npm run test:e2e     # 使用已安装的 Chrome；Windows 下另验证 Electron
npm run package:win # release/Open Timelog-win32-x64/
```

开发运行的桌面数据在仓库 `.runtime/desktop`，测试使用独立临时目录，不读取正式数据。
测试覆盖核心时间语义和用户完整流程；测试文件和截图都不进入发行包。
源码图标位于 `public/icon.svg`，`npm run icons` 重新生成 PNG 与 Windows ICO。

## 数据规则

计时包含关闭应用、系统睡眠时的经过时间；暂停期间排除。有效时长来自时间戳，
不依赖前台定时器回调。系统时间倒退会阻止保存；时钟前跳需要在保存后手工修正记录。

日界线跟随当前设备本地时区；移动时区会改变记录在本地日期的归属。
总记录时长合并重叠区间，活动累计和积分按每条记录计算，避免把不同口径混为一谈。
活动的性质与积分速率在开始计时/创建记录时保存快照，修改活动不会追溯重算历史。

合并保留较新版本，删除标记参与合并，同版本冲突直接报错。存在进行中计时时不能合并，
可以先保存计时，或者显式选择完整恢复。完整恢复会替换本机状态，导入前先下载本机备份。
定期保留 JSON；CSV 和 Markdown 是阅读/分析导出，不是无损恢复格式。

## 项目结构

```text
src/domain.ts          时间、积分、校验与迁移规则
src/storage.ts         IndexedDB 事务与更新通知
src/App.tsx            操作界面
src/styles.css         桌面与移动布局
electron/main.cjs      沙箱桌面壳与本地安全协议
public/sw.js           生产网页离线 app shell
tests/app.spec.ts      浏览器与 Windows 完整流程
docs/design/           领域和交互契约
docs/research/          原版参考证据与功能边界
```

原版研究仅检查用户安装包的元数据及指定关键字，不复制其实现、图标、字体或其他资产。
研究不涉及账户数据、认证绕过或连接官方服务。时迹不隶属于 UpTimer。

许可证：[MIT](LICENSE)。发行包保留 Web 依赖和 Electron 自身的第三方许可。
