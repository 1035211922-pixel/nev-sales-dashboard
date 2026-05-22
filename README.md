# 新能源车企销量监测小工具

这个小工具用于跟踪赛力斯/问界、理想、小鹏、蔚来、零跑的车型销量时间序列，并把结果做成网页仪表盘。

## 使用

```bash
python3 seres_sales_monitor.py
```

生成多品牌时间序列：

```bash
python3 multi_brand_sales_monitor.py
```

如果当前网络不可用，可以使用内置的最新快照生成报告：

```bash
python3 seres_sales_monitor.py --offline
```

## 输出

- `data/seres_sales_snapshot.json`: 当前结构化快照
- `data/seres_sales_history.json`: 时间序列数据
- `data/auto_sales_history.json`: 多品牌/多车型时间序列数据
- `reports/seres_sales_latest.md`: 可读报告
- `reports/seres_sales_latest.csv`: 分车型销量 CSV
- `dashboard.html`: 动态时间序列仪表盘

## 当前监测口径

- 官方口径：赛力斯产销快报，跟踪公司新能源汽车/其他车型/合计产销数据。
- 分车型口径：盖世汽车车型销量榜单，跟踪问界 M5、M6、M7、M8、M9 等车型批发销量，并按基础车型聚合增程/纯电版本。
- 多品牌口径：盖世汽车单车型销量页，覆盖 2024-01 到当前最新缓存期数；EV/BEV/REEV 版本按基础车型聚合。
- 均价口径：按车型指导价区间中位数和当月销量加权估算，不代表真实成交均价。

这两个口径的统计范围可能不同，因此报告中会分开展示，不做强行合并。

## 打开仪表盘

建议用本地静态服务器打开，这样浏览器能读取 `data/` 里的 JSON：

```bash
python3 -m http.server 8765
```

然后访问：

```text
http://127.0.0.1:8765/dashboard.html
```

图表支持点击查看明细：在主图上点击某个月附近，会弹出该月已选车企/车型的具体销量或估算均价。

## 公开分享

这个项目已经带了 GitHub Pages 部署工作流：

- `.github/workflows/pages.yml`: 定时抓取数据、构建并发布静态站点
- `build_site.py`: 生成 `dist/` 静态站点
- `DEPLOY.md`: 部署说明

部署到 GitHub Pages 后，别人可以通过公开链接访问。后续数据更新后，只要 GitHub Actions 重新发布成功，别人刷新网页就能看到新数据。
