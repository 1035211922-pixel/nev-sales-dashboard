# 部署成公开链接

这个仪表盘是静态站点，适合部署到 GitHub Pages、Vercel、Netlify、公司内网静态服务器或对象存储。

## GitHub Pages 推荐方案

1. 新建一个 GitHub 仓库。
2. 把本目录所有文件提交到仓库。
3. 在 GitHub 仓库设置里启用 Pages，来源选择 GitHub Actions。
4. 工作流 `.github/workflows/pages.yml` 会：
   - 定时运行 `multi_brand_sales_monitor.py`
   - 生成 `data/auto_sales_history.json`
   - 运行 `build_site.py`
   - 发布 `dist/` 到 GitHub Pages

工作流默认每月 20 日 02:30 UTC 跑一次，也可以在 GitHub Actions 页面手动点 `Run workflow`。

## 后续更新别人能不能看到？

可以。只要部署平台重新发布了新的 `data/auto_sales_history.json`，别人刷新网页就能看到更新。

需要注意：

- GitHub Pages 的自动更新依赖 GitHub Actions 能联网访问盖世汽车页面。
- 如果数据源页面结构变化，工作流可能需要调整解析脚本。
- 如果你只把文件发给别人本地打开，他们不会自动收到你这边后续更新。

## 本地构建

```bash
python3 multi_brand_sales_monitor.py --end 2026-04
python3 build_site.py
```

构建后的静态站点在 `dist/`。
