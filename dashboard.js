const BRAND_COLORS = {
  "赛力斯": "#126d7c",
  "理想": "#2f6fb2",
  "小鹏": "#7c5fb3",
  "蔚来": "#b84c34",
  "零跑": "#d28b2c"
};

const MODEL_PALETTE = [
  "#126d7c", "#2f6fb2", "#b84c34", "#d28b2c", "#7c5fb3",
  "#28836f", "#9b4d7b", "#53616f", "#c16f3d", "#4b84a6"
];

const FALLBACK_HISTORY = {
  updated_at: "2026-05-22T00:00:00+00:00",
  source_note: "本地备用数据；请运行 multi_brand_sales_monitor.py 生成完整数据。",
  brands: ["赛力斯", "理想", "小鹏", "蔚来", "零跑"],
  models_by_brand: {},
  price_midpoint_wan: {},
  periods: []
};

const state = {
  history: FALLBACK_HISTORY,
  metric: "sales",
  scope: "brand",
  activeIndex: 0,
  startIndex: 0,
  endIndex: 0,
  selected: {
    sales: new Set(),
    asp: new Set()
  },
  lastChart: null,
  tooltipIndex: null,
  playing: false,
  timer: null
};

const $ = (selector) => document.querySelector(selector);
const fmt = (value) => Number(value || 0).toLocaleString("zh-CN");
const money = (value) => value == null ? "--" : `${Number(value).toFixed(1)} 万`;

async function loadHistory() {
  try {
    const response = await fetch("./data/auto_sales_history.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    return FALLBACK_HISTORY;
  }
}

function setupState(history) {
  state.history = history;
  const last = Math.max(0, (history.periods || []).length - 1);
  state.activeIndex = last;
  state.startIndex = 0;
  state.endIndex = last;
  state.selected.sales = new Set((history.brands || []).map((brand) => seriesId("brand", brand, null)));
  state.selected.asp = new Set((history.brands || []).map((brand) => seriesId("brand", brand, null)));
}

function seriesId(scope, brand, model) {
  return scope === "brand" ? `brand::${brand}` : `model::${brand}::${model}`;
}

function parseSeriesId(id) {
  const parts = id.split("::");
  return { scope: parts[0], brand: parts[1], model: parts[2] || null };
}

function activePeriod() {
  return state.history.periods[state.activeIndex] || { period: "--", brands: {} };
}

function periodLabel(index) {
  return state.history.periods[index]?.period || "--";
}

function visiblePeriods() {
  return state.history.periods.slice(state.startIndex, state.endIndex + 1);
}

function visibleActiveOffset() {
  return Math.max(0, state.activeIndex - state.startIndex);
}

function brandEntry(period, brand) {
  return period.brands?.[brand] || { models: {}, brand_total: 0, estimated_asp_wan: null };
}

function brandTotal(period, brand) {
  const entry = brandEntry(period, brand);
  return Number(entry.brand_total || Object.values(entry.models || {}).reduce((sum, value) => sum + Number(value || 0), 0));
}

function modelSales(period, brand, model) {
  return Number(brandEntry(period, brand).models?.[model] || 0);
}

function selectedActiveSeries() {
  return [...state.selected[state.metric]].filter((id) => parseSeriesId(id).scope === state.scope);
}

function allModelItems() {
  return (state.history.brands || []).flatMap((brand) =>
    (state.history.models_by_brand?.[brand] || []).map((model) => ({ brand, model }))
  );
}

function modelColor(brand, model) {
  const models = state.history.models_by_brand?.[brand] || [];
  return MODEL_PALETTE[models.indexOf(model) % MODEL_PALETTE.length] || BRAND_COLORS[brand] || "#596579";
}

function seriesLabel(item) {
  return item.scope === "brand" ? item.brand : item.model;
}

function seriesColor(item) {
  return item.scope === "brand" ? BRAND_COLORS[item.brand] : modelColor(item.brand, item.model);
}

function seriesValue(period, item, metric = state.metric) {
  if (metric === "sales") {
    return item.scope === "brand" ? brandTotal(period, item.brand) : modelSales(period, item.brand, item.model);
  }
  if (item.scope === "brand") {
    return brandEntry(period, item.brand).estimated_asp_wan;
  }
  return state.history.price_midpoint_wan?.[item.model] ?? null;
}

function updateMetrics() {
  const period = activePeriod();
  const activeItems = selectedActiveSeries().map(parseSeriesId);
  const salesTotal = activeItems.reduce((sum, item) => sum + (item.scope === "brand" ? brandTotal(period, item.brand) : modelSales(period, item.brand, item.model)), 0);
  const leader = activeItems
    .map((item) => ({ label: seriesLabel(item), value: seriesValue(period, item, "sales") || 0 }))
    .sort((a, b) => b.value - a.value)[0];
  const aspItems = activeItems
    .map((item) => ({ value: seriesValue(period, item, "asp"), units: seriesValue(period, item, "sales") || 0 }))
    .filter((item) => item.value != null && item.units > 0);
  const asp = aspItems.length
    ? aspItems.reduce((sum, item) => sum + item.value * item.units, 0) / aspItems.reduce((sum, item) => sum + item.units, 0)
    : null;
  $("#latestPeriod").textContent = period.period;
  $("#activePeriod").textContent = period.period;
  $("#modelTotal").textContent = `${fmt(salesTotal)} 辆`;
  $("#officialTotal").textContent = money(asp);
  $("#leaderModel").textContent = leader ? `${leader.label} ${fmt(leader.value)}` : "--";
  $("#updatedAt").textContent = state.history.updated_at ? `更新 ${state.history.updated_at.slice(0, 10)}` : "--";
  $("#sourceNote").textContent = state.history.source_note || "";
}

function pickerItems() {
  if (state.scope === "brand") {
    return (state.history.brands || []).map((brand) => ({ scope: "brand", brand, model: null }));
  }
  return allModelItems().map(({ brand, model }) => ({ scope: "model", brand, model }));
}

function pickerItemIds() {
  return pickerItems().map((item) => seriesId(item.scope, item.brand, item.model));
}

function ensureSelection() {
  if (selectedActiveSeries().length > 0) return;
  const defaults = pickerItems().slice(0, state.scope === "brand" ? 5 : 8);
  defaults.forEach((item) => state.selected[state.metric].add(seriesId(item.scope, item.brand, item.model)));
}

function renderSeriesPicker() {
  const period = activePeriod();
  const current = state.selected[state.metric];
  $("#seriesPicker").innerHTML = pickerItems().map((item) => {
    const id = seriesId(item.scope, item.brand, item.model);
    const active = current.has(id);
    const value = seriesValue(period, item);
    const badge = state.metric === "sales" ? fmt(value) : money(value);
    return `
      <button class="series-chip ${active ? "is-active" : ""}" type="button" data-series-id="${id}" style="--chip-color:${seriesColor(item)}">
        <span><i></i>${seriesLabel(item)}</span>
        <em>${item.scope === "model" ? item.brand : ""}</em>
        <strong>${badge}</strong>
      </button>
    `;
  }).join("");
}

function renderQuickSelect() {
  const container = $("#brandQuickSelect");
  if (state.scope !== "model") {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = (state.history.brands || []).map((brand) => `
    <button class="quick-btn" type="button" data-brand-quick="${brand}" style="--chip-color:${BRAND_COLORS[brand]}">${brand}车型</button>
  `).join("");
}

function renderLegend(items) {
  $("#legend").innerHTML = items.slice(0, 18).map((item) => `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${seriesColor(item)}"></span>${seriesLabel(item)}
    </span>
  `).join("");
}

function getChart() {
  const svg = $("#salesChart");
  const rect = svg.getBoundingClientRect();
  const width = Math.max(900, Math.floor(rect.width));
  const height = Math.max(420, Math.floor(rect.height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";
  return { svg, width, height };
}

function svgEl(name, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function xFor(index, bounds, count) {
  return bounds.left + ((bounds.right - bounds.left) * index) / Math.max(count - 1, 1);
}

function yFor(value, bounds, maxValue, minValue = 0) {
  return bounds.bottom - ((bounds.bottom - bounds.top) * (value - minValue)) / Math.max(maxValue - minValue, 1);
}

function drawAxes(svg, bounds, periods, minValue, maxValue, unit) {
  const { left, top, right, bottom } = bounds;
  for (let i = 0; i <= 4; i += 1) {
    const y = bottom - ((bottom - top) * i) / 4;
    const value = minValue + ((maxValue - minValue) * i) / 4;
    svg.appendChild(svgEl("line", { x1: left, y1: y, x2: right, y2: y, stroke: "#d9e0e7", "stroke-width": 1 }));
    svg.appendChild(svgEl("text", { x: 8, y: y + 4, fill: "#637180", "font-size": 12, "font-family": "Arial" })).textContent =
      unit === "万" ? value.toFixed(1) : fmt(Math.round(value));
  }
  periods.forEach((period, index) => {
    if (index % 2 !== 0 && periods.length > 16) return;
    svg.appendChild(svgEl("text", {
      x: xFor(index, bounds, periods.length) - 18,
      y: bottom + 24,
      fill: "#637180",
      "font-size": 12,
      "font-family": "Arial"
    })).textContent = period.period.slice(2);
  });
}

function drawLineChart() {
  const { svg, width, height } = getChart();
  const periods = visiblePeriods();
  const items = selectedActiveSeries().map(parseSeriesId);
  const bounds = { left: 78, top: 28, right: width - 28, bottom: height - 58 };
  const allValues = items.flatMap((item) => periods.map((period) => seriesValue(period, item)).filter((value) => value != null));
  const unit = state.metric === "asp" ? "万" : "辆";
  const minValue = state.metric === "asp" && allValues.length ? Math.max(0, Math.min(...allValues) * 0.86) : 0;
  const maxValue = Math.max(state.metric === "asp" ? 10 : 1000, ...(allValues.length ? allValues : [0])) * 1.12;
  drawAxes(svg, bounds, periods, minValue, maxValue, unit);
  items.forEach((item) => {
    const values = periods.map((period) => seriesValue(period, item) ?? 0);
    const points = values.map((value, index) => ({
      x: xFor(index, bounds, periods.length),
      y: yFor(value, bounds, maxValue, minValue)
    }));
    svg.appendChild(svgEl("polyline", {
      points: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
      fill: "none",
      stroke: seriesColor(item),
      "stroke-width": 3,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    }));
    const activeOffset = visibleActiveOffset();
    if (activeOffset >= 0 && activeOffset < points.length) {
      svg.appendChild(svgEl("circle", { cx: points[activeOffset].x, cy: points[activeOffset].y, r: 5, fill: seriesColor(item) }));
    }
  });
  renderLegend(items);
  state.lastChart = { bounds, periods, items, minValue, maxValue, unit, width, height };
  if (state.tooltipIndex != null && state.tooltipIndex < periods.length) {
    showTooltip(state.tooltipIndex);
  } else {
    hideTooltip();
  }
}

function showTooltip(index) {
  const chart = state.lastChart;
  const tooltip = $("#chartTooltip");
  if (!chart || !chart.periods[index]) {
    hideTooltip();
    return;
  }
  state.tooltipIndex = index;
  const period = chart.periods[index];
  const x = xFor(index, chart.bounds, chart.periods.length);
  const rows = chart.items.map((item) => {
    const value = seriesValue(period, item);
    return {
      label: seriesLabel(item),
      color: seriesColor(item),
      value: state.metric === "sales" ? `${fmt(value)} 辆` : money(value)
    };
  });
  tooltip.hidden = false;
  tooltip.innerHTML = `
    <strong>${period.period}</strong>
    ${rows.map((row) => `
      <span>
        <i style="background:${row.color}"></i>
        <em>${row.label}</em>
        <b>${row.value}</b>
      </span>
    `).join("")}
  `;
  const stage = document.querySelector(".chart-stage").getBoundingClientRect();
  const tipWidth = Math.min(280, stage.width - 24);
  tooltip.style.width = `${tipWidth}px`;
  const left = Math.max(12, Math.min(stage.width - tipWidth - 12, x - tipWidth / 2));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = "18px";
}

function hideTooltip() {
  const tooltip = $("#chartTooltip");
  if (tooltip) tooltip.hidden = true;
  state.tooltipIndex = null;
}

function renderTable() {
  const items = selectedActiveSeries().map(parseSeriesId);
  const label = state.metric === "sales" ? "销量" : "均价";
  $("#salesHead").innerHTML = `<tr><th>月份</th>${items.map((item) => `<th>${seriesLabel(item)}${label}</th>`).join("")}</tr>`;
  $("#salesBody").innerHTML = visiblePeriods().map((period) => `
    <tr class="${period.period === activePeriod().period ? "is-active" : ""}">
      <td>${period.period}</td>
      ${items.map((item) => {
        const value = seriesValue(period, item);
        return `<td>${state.metric === "sales" ? fmt(value) : money(value)}</td>`;
      }).join("")}
    </tr>
  `).join("");
}

function renderAll() {
  updateMetrics();
  renderQuickSelect();
  renderSeriesPicker();
  renderTable();
  $("#chartTitle").textContent = state.metric === "sales" ? "销量对比" : "估算销售均价对比";
  $("#chartSubtitle").textContent = state.scope === "brand"
    ? "车企维度：直接对比品牌销量或产品组合估算均价"
    : "车型维度：对比车型销量；车型均价为指导价区间中位数估算";
  drawLineChart();
}

function syncRangeInputs() {
  const max = Math.max(0, state.history.periods.length - 1);
  ["periodRange", "startRange", "endRange"].forEach((id) => {
    const input = $(`#${id}`);
    input.max = String(max);
  });
  $("#periodRange").value = String(state.activeIndex);
  $("#startRange").value = String(state.startIndex);
  $("#endRange").value = String(state.endIndex);
  $("#currentMonthLabel").textContent = periodLabel(state.activeIndex);
  $("#startMonthLabel").textContent = periodLabel(state.startIndex);
  $("#endMonthLabel").textContent = periodLabel(state.endIndex);
}

function bindControls() {
  syncRangeInputs();
  $("#periodRange").addEventListener("input", () => {
    state.activeIndex = Number($("#periodRange").value);
    if (state.activeIndex < state.startIndex) state.startIndex = state.activeIndex;
    if (state.activeIndex > state.endIndex) state.endIndex = state.activeIndex;
    syncRangeInputs();
    renderAll();
  });
  $("#startRange").addEventListener("input", () => {
    state.startIndex = Math.min(Number($("#startRange").value), state.endIndex);
    if (state.activeIndex < state.startIndex) state.activeIndex = state.startIndex;
    syncRangeInputs();
    renderAll();
  });
  $("#endRange").addEventListener("input", () => {
    state.endIndex = Math.max(Number($("#endRange").value), state.startIndex);
    if (state.activeIndex > state.endIndex) state.activeIndex = state.endIndex;
    syncRangeInputs();
    renderAll();
  });

  $("#playButton").addEventListener("click", () => {
    state.playing = !state.playing;
    $("#playButton").textContent = state.playing ? "Ⅱ" : "▶";
    clearInterval(state.timer);
    if (!state.playing) return;
    state.timer = setInterval(() => {
      state.activeIndex = state.activeIndex >= state.endIndex ? state.startIndex : state.activeIndex + 1;
      syncRangeInputs();
      renderAll();
    }, 900);
  });

  document.querySelectorAll(".option-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".option-tab").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      state.metric = button.dataset.metric;
      ensureSelection();
      renderAll();
    });
  });

  document.querySelectorAll(".scope-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".scope-tab").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      state.scope = button.dataset.scope;
      ensureSelection();
      renderAll();
    });
  });

  $("#seriesPicker").addEventListener("click", (event) => {
    const button = event.target.closest("[data-series-id]");
    if (!button) return;
    const set = state.selected[state.metric];
    const id = button.dataset.seriesId;
    if (set.has(id)) set.delete(id);
    else set.add(id);
    renderAll();
  });

  document.querySelector(".bulk-toolbar").addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    const quickButton = event.target.closest("[data-brand-quick]");
    const set = state.selected[state.metric];
    if (actionButton) {
      const ids = pickerItemIds();
      if (actionButton.dataset.action === "selectAll") {
        ids.forEach((id) => set.add(id));
      } else if (actionButton.dataset.action === "clearAll") {
        ids.forEach((id) => set.delete(id));
      } else if (actionButton.dataset.action === "invert") {
        ids.forEach((id) => set.has(id) ? set.delete(id) : set.add(id));
      }
      renderAll();
      return;
    }
    if (quickButton) {
      const brand = quickButton.dataset.brandQuick;
      [...set].forEach((id) => {
        if (parseSeriesId(id).scope === state.scope) set.delete(id);
      });
      (state.history.models_by_brand?.[brand] || []).forEach((model) => {
        set.add(seriesId("model", brand, model));
      });
      renderAll();
    }
  });

  window.addEventListener("resize", drawLineChart);

  $("#salesChart").addEventListener("click", (event) => {
    const chart = state.lastChart;
    if (!chart || chart.periods.length === 0) return;
    event.stopPropagation();
    const rect = $("#salesChart").getBoundingClientRect();
    const viewBoxWidth = chart.width;
    const x = (event.clientX - rect.left) * (viewBoxWidth / rect.width);
    const ratio = (x - chart.bounds.left) / Math.max(chart.bounds.right - chart.bounds.left, 1);
    const index = Math.max(0, Math.min(chart.periods.length - 1, Math.round(ratio * (chart.periods.length - 1))));
    if (state.tooltipIndex === index) {
      hideTooltip();
      return;
    }
    state.activeIndex = state.startIndex + index;
    syncRangeInputs();
    renderAll();
    showTooltip(index);
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".chart-tooltip")) return;
    if (event.target.closest("#salesChart")) return;
    hideTooltip();
  });
}

async function init() {
  setupState(await loadHistory());
  bindControls();
  renderAll();
}

init();
