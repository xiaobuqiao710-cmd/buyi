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

## 设计语言：纸本档案

整页只有一种隐喻：**一份有编号的档案**。首屏右侧一条装订线（01–05）是它的脊柱；
往下每个区块都由细线分隔的条目构成，而不是一张张浮动的卡片。

关键判断（都有具体依据，不是审美偏好）：

- **液态玻璃只用在控件层。** 抓取 apple.com.cn 的真实首屏可以看到，
  Apple 的玻璃只出现在按钮与工具条上，从不作为装饰铺在内容面上。
  把每段内容装进浮空玻璃会造出多个与正文无关的视觉重心，也压低了文字可读性。
  因此内容面用 `.panel`（纸面 + 一道细边），`.glass` 只留给导航与抽屉。
- **不用紫蓝弥散光斑。** 原实现的背景是 28px 模糊的蓝紫径向光（`--aura-1/2/3`），
  这正是「AI 与开发者工具」类页面的通用样貌，且对内容零贡献。
  底层肌理改为一道约 4% 不透明度的网格 —— 语汇是档案纸，不是发光。
- **不用渐变文字。** 强调用单色 + 字重；渐变会让对比度随位置浮动，不利于无障碍复核。
- **项目标记是记号，不是主视觉。** 每卡顶部原有一块 16:7 的渐变面板，
  占卡片约四成面积却零信息量；现改为小尺寸单色描边记号（大卡 5.5rem）。
- **条目，不是盒子。** 项目、经历、教育、技能四处原本都是圆角卡片。
  底色变浅之后，白卡压在近白页面上会退化成一整块"什么都不做的平板"——
  内容浮在里面，卡片只贡献了一条边框。现改为**上下细线分隔的条目**，
  与首屏装订线共用同一套语汇；同时取消整块 hover 上浮，
  因为条目不该暗示"我是一张会浮起来的卡片"。

### 中文排版的三条硬约束

这三条是用 `scripts/qa-typography.mjs` 量出来的，不是估的：

| 约束 | 原因 | 取值 |
| --- | --- | --- |
| 行宽 | `ch` 是数字 `0` 的宽度，**一个汉字约占 1.58ch**，照拉丁文习惯写的 `68ch` 在中文里等于 43 字/行 | `--measure: 54ch`（≈34 字/行） |
| 行高 | 汉字字面率大、笔画密，拉丁文海报式的 `1.02` 会上下相撞 | 展示字 `--leading-display: 1.14`，正文 `--leading-body: 1.72` |
| 正文字号 | 承担连续阅读职责的文字不小于 15px；12–14px 只用于标签与控制 | `--text-base-sm: 0.9375rem` |

### Apple 动效规则（可验证的部分）

| 规则 | 落地位置 |
| --- | --- |
| 按下即反馈（不等抬起） | 所有按钮 `:active` 立即缩放，用 `--dur-instant` |
| 动效可中断 | `springValue()` 的 `retarget()` 读取**当前位置与速度**作为新起点，中途反向不跳变 |
| X/Y 独立弹簧 | `springAxes()` 分轴驱动，单弹簧会让二维运动失同步 |
| 速度交接 | `VelocityTracker` 保留最近 100 ms 样本，手势结束时把速度交给弹簧 |
| 动量投影 | `project(v)` 用 `d ≈ 0.998` 预测滑动终点，而不是"滑多远算多远" |
| 边界回弹 | `rubberband()` 阻尼公式，越界越难拉 |
| 材质与深度 | 模糊分级 `--blur-chip/card/chrome/hero`；材料出现时 blur 与 scale 同动 |

### 无障碍三项降级

三条系统偏好都在 CSS 层切断，不靠 JS 判断：

- `prefers-reduced-motion` → 时长压缩到瞬时，`--motion-scale: 0` 令所有位移归零
- `prefers-reduced-transparency` → 面板转实底、边框加重，所有 `backdrop-filter` 归零
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
    glass.css            控件层玻璃 + 内容面板 .panel
    components.css       按钮、区块头、指标行等共享件
    {chrome,hero,work,journey,contact}.css
  components/
    ui/Kit.tsx           共享原语（Section/Button/PanelCard/GlassCard/MetricRow…）
    layout/Chrome.tsx    导航 + 页脚 + 移动端抽屉
    sections/            Hero / Work / Journey / Contact
```

### 真实界面截图 vs 抽象记号

每个项目在卡面上有一枚**单色描边记号**（nodes / grid / pipeline / bars / rings），
职责是「一眼区分这是哪个项目」；而在展开详情里，**确实有真实界面截图的项目**
会多一张截图 + 一句说明，职责是「证明它真的在跑」。

两者不互相替代：记号保证卡面整齐、可扫读；截图保证可信度。
没有真实截图的项目**不补画抽象图充数** —— 假图比没有更糟。

截图放在 `public/shots/`，同样经 `assetUrl()` 拼接以适配子路径部署。
素材来自项目真实运行界面，按显示尺寸导出为 JPEG（单张 ≤ 170KB）。
