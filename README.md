# 路径追踪工作室 Path Tracer Studio

蒙特卡洛路径追踪动画渲染器。相机 360° 轨道运动，每帧渐进式完整路径追踪，支持运动模糊、金属/玻璃/漫反射材质、实时预览、帧锁定、断点续算与 PNG/视频导出。

## 能力

- **完整路径追踪**：漫反射余弦重要采样、金属 Schlick Fresnel + 粗糙微扰、玻璃折射 + Fresnel + Beer-Lambert 吸收、俄罗斯轮盘赌终止、渐变环境光
- **运动模糊**：快门窗口内每 sample 随机时间，同时积分相机轨道运动与场景物体的平移/圆周运动
- **渐进预览**：每个 pass 后画布刷新，画面随 SPP 由噪变净
- **帧锁定与时间线**：达目标 SPP 的帧锁定不再重算，时间线显示锁定/渲染态与缩略图
- **断点续算**：浮点累积缓冲落盘（非 8-bit 图），确定性 RNG 保证续算采样流严格衔接
- **导出**：PNG 序列（合同级保底）与 WebM（WebCodecs，环境不支持时自动置灰）

## 架构

WebGL2 渲染核心，浏览器 UI 与 Playwright 无头 CLI 共享同一份渲染代码。

- 累积用双 RGBA32F 纹理 ping-pong（shader 内 `old + new_sample`），不依赖 `EXT_float_blend`
- RNG 为 PCG32，种子 = `hash(pixel, frame, globalSampleIndex, configHash)`
- `sppPerPass`、场景、shader/rng 版本纳入 config hash；目标 SPP 不纳入（提高 SPP 是合法续算）
- 浏览器存 IndexedDB；Node 存 `output/session-<hash>/`，浮点为 PTF1 格式、`checkpoint.json` 原子写
- CLI 经 127.0.0.1 HTTP 服务回传数据，Playwright 驱动本机完整 Chromium

```
src/core    平台无关数学/场景/配置/引擎状态机/存储接口
src/shaders GLSL 片段（common/rng/scene/intersect/camera/materials/tracer/display）
src/gl      WebGL2 上下文、ping-pong 纹理、UBO 上传、渲染器
src/ui      控制面板、时间线、导出、window.__pt CLI 契约
src/encode  WebCodecs 探测与 WebM 编码、PNG
src/storage IndexedDB 与 Node HTTP 桥接适配器
src/node    CLI、Playwright 启动、本地服务、PTF1 落盘
scripts     探针与续算验证
```

## 使用

### 安装

```bash
pnpm install
pnpm playwright install chromium   # 浏览器二进制，按需手动安装
```

### 浏览器界面

```bash
pnpm dev
```

打开 open 后选择预设（preview/demo/final），调帧数/分辨率/SPP/快门，点开始。渲染中可停止，刷新页面后同 config 自动续算。导出可选目录写 PNG 序列，或导出 WebM。

### 无头 CLI

```bash
pnpm build
node dist-node/src/node/cli.js render --preset preview
node dist-node/src/node/cli.js render --frames 40 --spp 256 --width 854 --height 480
node dist-node/src/node/cli.js resume --preset preview   # 同 hash 从断点继续
node dist-node/src/node/cli.js export                     # 导出最近会话 PNG
```

软件渲染（SwiftShader）加 `--swift-shader`，会自动把 SPP 降到 128 以防单帧过久。

## 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 核心单测（RNG/hash/校验/PTF1） | `pnpm test` | 11 通过 |
| 双端类型检查 | `tsc -p tsconfig.web.json` / `tsconfig.node.json` | 通过 |
| 无头端到端渲染 | `pnpm probe` | 帧锁定、PTF1/缩略图/checkpoint 落盘 |
| 运动模糊目检 | `node dist-node/scripts/probe_motion.js` | 红球横向拖影 + 地面相机拉丝 |
| 续算按位一致 | `pnpm verify-resume` | 20736 浮点逐通道相等，最大误差 0 |

### PTF1 浮点格式

`magic "PTF1"(u32) | width(u16) | height(u16) | spp(u32) | reserved(u32)`，后接 `width*height*4` 个 little-endian float32（RGBA）。checkpoint 记录每帧状态、SPP、config hash、shader/rng 版本与渲染器字符串。

## 约束与已知项

- float32 累积实用上限约 2k–4k SPP，更高需要 Kahan/分层累积（接口预留 `accumulationFormat`）
- 浏览器标签页切后台会触发 rAF 节流，渲染时建议保持前台（UI 有提示）
- 浏览器 IndexedDB 与 Node 磁盘两种会话一期不互通
- 无头 WebCodecs 支持因环境而异，WebM 失败时以 PNG 序列为准
