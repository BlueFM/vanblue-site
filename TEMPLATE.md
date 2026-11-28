# Moonlit Grimoire · 新模板使用说明

这是 vanblue.online 的完整 Zola 新模板：暮紫夜空、暖纸阅读区、星图藏书票、章节式学术内容，以及保留原有交互的巫师猫。无需 npm、React 或 Sass 即可构建。

**本轮在 `feat/moonlit-grimoire` 分支制作；交付模板不代表已经替换线上站点。**

## 先看什么

- `design/ui-board.png`：完整 UI 设计板，含首屏、tokens、字体与组件状态。
- `design/home-desktop.png` / `design/home-mobile.png`：实际 Zola 构建页面的桌面与手机首屏。
- `design/home-desktop-full.png`：完整首页长图。
- `design/offline-home.html`：可双击的自包含离线首页预览；无需联网下载字体、图片或脚本。
- `docs/magic-style-research.md`：九个真实网站／设计案例的调研、来源及核验边界。
- `docs/moonlit-ui.md`：完整页面族、响应式、交互和可访问性设计规范。

离线首页用于审阅设计：站内导航仍指向当前正式网站，不假装是已部署的新站。它不查询线上猫咪状态或访问统计；正式站状态逻辑不受影响。要查看全部新页面及真实的站内跳转，请运行 Zola 预览。

## 本地运行完整网站

使用 Zola **0.23.6**（与本次验证及现有 CI 一致），在项目根目录运行：

```bash
zola serve
# Open the URL printed by Zola, usually http://127.0.0.1:1111
```

当前工作区已经有 Zola 时也可运行：

```bash
../.tools/zola.exe serve
```

构建静态文件：

```bash
zola build
# Output: public/
```

`public/` 是生成产物，不直接编辑。`design/` 与 `docs/` 不会被 Zola 当成正式内容发布；线上页面只引用 `static/` 中的素材。

## 内容与主题入口

| 想改什么 | 入口 |
| --- | --- |
| 姓名、学校、邮箱、个人链接、分享图 | `config.toml` |
| 简介、研究标签、新闻、经历 | `content/_index.md` |
| 论文 / 研究故事 / 项目 / 博客 / 推荐 | `content/papers/`、`research/`、`projects/`、`blog/`、`share/` |
| 色彩、字体、间距、手机断点 | `static/css/moonlit.css` 开头的变量及响应式段 |
| 首页布局 | `templates/index.html` |
| 页眉、页脚与内页纸面 | `templates/base.html` |
| 原创星图与装饰 | `static/img/moonlit/` |
| 导航与三个轻量彩蛋 | `static/js/grimoire.js` |
| 猫与法术设置行为 | `static/js/guardian.js`，本轮不更改其既有逻辑 |
| 鱼的实色、深轮廓和光晕 | `static/css/guardian.css` 的 fish / trail / sparks 规则 |

Fraunces 只有一个约 35 KB 的本地 WOFF2 文件；来源与 SIL OFL 保存在 `static/fonts/`。新星图、书与羽笔、favicon 为原创 SVG；没有复制参考站的角色、纹样、照片或音乐。

## 三个小彩蛋

1. 点击首页头像的藏书印：星图短暂点亮。
2. 点击页脚 “A note from the margins”：在原处翻到下一句边注。
3. 点击页脚星星，或在非输入区键入小写 `lumos`：一次有限星光。

都支持键盘或触屏等效入口，不自动弹出，不改猫的法术选择；减少动态效果时用静态文字反馈。没有循环粒子、音频或新增行为统计。

## 分享图

新分享图为 `static/img/moonlit/og-cover.png`，对应可编辑源码 `design/og-cover.html`。以 1200 × 630 浏览器视口渲染该 HTML 即可更新图像。旧 `tools/make-og.py` 只生成原来的经典白蓝封面，不用于新主题。

## 审阅后再发布

先用上面的本地预览检查内容和视觉，确认后再合入 `main`。现有流程会在 push main 后自动构建、原子部署并执行线上 smoke test；**不要为了预览而推送 main**。

本轮的验证证据保存在 `design/` 的检查记录中；第三方参考截图和浏览器临时配置不属于模板素材。
