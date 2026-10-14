# 宋建豪 · 个人主页

法律 × AI 的个人作品集站点。定位是**一个真实的、可交互的工程产物**，而不是一份被搬到网页上的简历——
内容以 AI 项目为主，法律经历与教育背景作为支撑。

线上地址：`https://<用户名>.github.io/buyi/`（仓库名 `buyi`）

---

## 技术选型与取舍

**只用 React + Vite + TypeScript，运行时零依赖。**

这不是为了炫技。招聘场景下评审者可能在任意网络环境打开页面，所以：

- **没有动画库**（Framer Motion / GSAP 等）。弹簧动效是自己写的一个 130 行解析解内核（`src/lib/spring.ts`），
  因为它需要满足一个具体约束：**掉帧和后台标签页暂停时不能累积误差**。
  数值积分做不到这点，解析解可以——给定任意 `t` 直接算出位置，与帧率完全解耦。
- **没有 CSS 框架**。设计令牌集中在一个文件（`src/styles/tokens.css`），
  颜色、字号、间距、弹簧参数都是变量，改一处全站生效。
- **没有图标库**。用到的图标以内联 SVG 组件形式写在用它的地方。

产物：JS ~179 kB（gzip ~62 kB）+ CSS ~52 kB（gzip ~10 kB）。

---

## 设计原则

按 Apple 的人机界面规范实现，重点不是"看起来像"，而是几条可验证的规则：

| 规则 | 落地位置 |
| --- | --- |
| 按下即反馈（不等抬起） | 所有按钮 `:active` 立即缩放，用 `--dur-instant` |
| 动效可中断 | `springValue()` 的 `retarget()` 读取**当前位置与速度**作为新起点，中途反向不跳变 |
| X/Y 独立弹簧 | `springAxes()` 分轴驱动，单弹簧会让二维运动失同步 |
| 速度交接 | `VelocityTracker` 保留最近 100 ms 样本，手势结束时把速度交给弹簧 |
| 动量投影 | `project(v)` 用 `d ≈ 0.998` 预测滑动终点，而不是"滑多远算多远" |
| 边界回弹 | `rubberband()` 阻尼公式，越界越难拉 |
| 材质与深度 | 模糊分级 `--blur-chip/card/chrome/hero`，大面更厚；材料出现时 blur 与 scale 同动 |

### 无障碍三项降级

三条系统偏好都在 CSS 层切断，不靠 JS 判断：

- `prefers-reduced-motion` → 时长压缩到瞬时，`--motion-scale: 0` 令所有位移归零
- `prefers-reduced-transparency` → 玻璃转实心，所有 `backdrop-filter` 归零
- `prefers-contrast: more` → 近实底 + 加重文字 + 强调描边

另有 `@supports not (backdrop-filter: ...)` 兜底，老浏览器得到不透明卡片而不是糊掉的半透明块。

---

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5180
```

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 生产构建到 `dist/` |
| `npm run preview` | 预览构建产物（端口 4180） |
| `npm run typecheck` | 只跑 `tsc -b` |
| `npm run qa` | 真实浏览器渲染 QA（见下） |

---

## 渲染 QA

`scripts/qa-render.mjs` 用 CDP 驱动**真实 Chrome**，不引入 Puppeteer 之类的依赖。
每次运行产出 15 项 WCAG 对比度检查 + 结构/ARIA/溢出检查，任一不达标即以非零码退出：

```bash
npm run preview &            # 先起一个本地服务
node scripts/qa-render.mjs http://localhost:4180/ --shots
```

`--shots` 会把截图写到 `.qa-shots/`（已 gitignore）。

**一个必须知道的坑**：headless Chrome 的 `--virtual-time-budget` **不推进 CSS 动画时钟**，
入场动画会永久停在 `opacity: 0`。直接截图会得到"空白页面"的假象——
这不是页面坏了。QA 脚本为此在截图前显式把动画推进到终态。

---

## 内容维护

**所有文案与数字只在 `src/data/content.ts` 里改**，组件不写死任何内容。
文件顶部的维护约定：

- 项目按 `featured` 排序，数字越小越靠前
- 每个项目必须至少有一个 metric（可验证的数字），否则不该出现在站点上
- `tech` 只写真的用到的，不为了好看堆词
- 站点上的每个数字都必须能回溯到简历或项目本身——**不写不可验证的绝对化表述**

简历 PDF 放在 `public/resume/`，链接经 `assetUrl()` 处理以适配 GitHub Pages 子路径。

---

## 部署

推到 `main` 分支即由 GitHub Actions 自动构建部署（`.github/workflows/deploy.yml`）。

**项目站点部署在 `/<仓库名>/` 子路径下**，所以构建时的 `base` 必须是 `/buyi/`，
否则所有资源会 404、页面白屏。工作流里用 `github.event.repository.name` 动态取仓库名，
改仓库名不需要改配置；本地构建则通过 `BASE_PATH` 环境变量覆盖：

```bash
BASE_PATH=/buyi/ npm run build
```

同样地，`public/` 下的资源（简历 PDF、favicon）**不能写相对路径**——
相对路径会从站点根解析。统一走 `assetUrl()`。

### 仓库初始化（首次）

```bash
gh auth login                      # 需要先登录
git add -A && git commit -m "feat: 个人主页站点"
gh repo create buyi --public --source=. --push
```

然后在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

---

## 目录结构

```
src/
  data/content.ts        内容真源（文案、数字、排序）
  lib/
    spring.ts            弹簧内核（解析解、动量投影、回弹、速度追踪）
    useReveal.ts         滚动入场（IntersectionObserver）
    usePointerGlow.ts    指针跟随高光（仅精确指针 + 允许动效时启用）
    useParallax.ts       装饰层视差
    useTheme.ts          主题切换（localStorage 持久化）
    useScrolled.ts       滚动状态（rAF 节流）
  styles/
    tokens.css           设计令牌唯一真源 + 三项无障碍降级
    base.css             重置、光斑背景、颗粒层、排版
    glass.css            玻璃材质构造与厚度分级
    components.css       按钮、区块头、指标行等共享件
    {chrome,hero,work,journey,contact}.css
  components/
    ui/Kit.tsx           共享原语（Section/Button/GlassCard/MetricRow…）
    layout/Chrome.tsx    导航 + 页脚 + 移动端抽屉
    sections/            Hero / Work / Journey / Contact
```
