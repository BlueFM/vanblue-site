+++
title = "vanblue.online —— 个人学术主页"
description = "用静态文件搭起的双语学术主页：Zola 构建、nginx 分发、软链原子切换的部署脚本。"
date = 2026-10-29
weight = 1

[extra]
tech = ["Zola", "Tera 模板", "nginx", "Let's Encrypt", "bash", "DNS"]
live = "https://vanblue.online"
repo = "https://github.com/BlueFM/vanblue-site"
+++

这就是你正在看的这个站点。它要回答关于我的三个问题——发表过什么、正在做什么、怎么联系
——同时也是我从 DNS 记录一路做到 TLS 证书的第一个完整项目。

## 约束条件

服务器是 2 核 1.7 GiB 的 VPS，上面还跑着别的东西，所以站点空闲时几乎不能占资源。这直接排
除了 WordPress 之类任何 PHP 栈：在小型服务器上，数据库加请求期解释器既是最重的部分，也是
最容易被攻击的部分。

所以这个站是**静态文件**。nginx 直接分发预先生成好的 HTML，请求之间只占约 10 MB 常驻内存；
没有应用服务器，也没有数据库，因此没有任何能被转化成代码执行的入口。

## 技术栈

- **构建**：Zola，单个静态二进制——两台机器上都不需要 Node、不需要 Ruby、没有依赖树。整站
  全量重建耗时 30–200 ms。
- **模板**：手写 Tera 模板，每类页面一个文件，另用片段复用论文条目、作者行和项目条目。
- **内容**：Markdown + TOML front-matter。新增一篇论文就是新增一个文件并填上 BibTeX；页面、
  引用元数据和列表条目都由它生成。
- **分发**：nginx，开启 HTTP/2、gzip、HSTS；HTML 不缓存，静态资源缓存 30 天。www 和明文
  HTTP 都 301 到主域的 HTTPS。
- **证书**：Let's Encrypt，由 certbot 申请、systemd timer 续期；信任它之前先跑过 dry-run。

## 部署方式

服务器上是带时间戳的发布目录，外面挂一个 `current` 软链：

    /var/www/vanblue/releases/20261029-151210/
    /var/www/vanblue/releases/20261029-144446/
    /var/www/vanblue/current -> releases/20261029-151210/

`deploy/deploy.sh` 在本地构建，把 tar 包经 SSH 流式写入新的发布目录，然后切换软链。
切换软链是原子操作，所以不会出现「文件写了一半就对外服务」的情况；**回滚就是把链接指到别处**
——不重新构建、不重新上传，立即生效。脚本会清理到只留最近 5 个版本，最后请求一次线上地址，
不是 200 就让这次部署失败。

## 踩过的坑

- **Zola 对按日期排序的分区，会静默丢弃没有日期的页面。** 我在投的那篇论文就这么从构建里消
  失了，只留一行警告。论文排序现在改成显式权重。
- **Zola 0.23 的模板引擎不认 import 标签**，宏用不了；共用标记只能放
  `templates/partials/`，用 include 引入。
- **内容文件里的 HTML 注释会被原样发到线上。** 我的编辑备注在网页源码里可读。现在改成
  front-matter 里的 TOML 注释。
- **certbot renew 看起来卡住了。** 其实没有：非交互续期会随机等待 0–8 分钟。去读日志而不是
  干等，省掉了这次困惑。
- **只 disable Docker 服务并不能真的停掉 Docker**——只要 `docker.socket` 还在 active，
  下一次客户端命令就会把它重新激活。

## 下一步

公开源码、生成区分语言的分区 feed、把构建搬进 CI，这样推一次仓库就能重新发布，不需要有一
台笔记本在线。
