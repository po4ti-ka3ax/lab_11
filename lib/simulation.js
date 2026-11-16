// Синтетическая телеметрия: фиксированный seed обеспечивает воспроизводимость.
export function seededRandom(seed = 42) {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
}

export function generateDataset(count = 5000, seed = 42) {
  const rand = seededRandom(seed);
  const rows = [];
  let batch = 1;
  for (let i = 0; i < count; i++) {
    const mode = i % 180 < 145 ? 'Производство' : i % 180 < 160 ? 'Ожидание' : 'Мойка';
    if (i % 145 === 0) batch++;
    const hour = (i * 5 / 60) % 24;
    const ambient = 18 + 8 * Math.sin((hour - 7) * Math.PI / 12) + (rand() - .5) * 2;
    const flow = mode === 'Производство' ? 850 + 100 * Math.sin(i / 34) + rand() * 65 : mode === 'Мойка' ? 90 + rand() * 20 : 0;
    const inlet = 5 + rand() * 2;
    const process = mode === 'Производство' ? 74 + (rand() - .5) * 2 : mode === 'Мойка' ? 62 + rand() * 3 : ambient;
    const pressure = mode === 'Производство' ? 2.4 + rand() * .25 : mode === 'Мойка' ? 1.7 + rand() * .2 : .2;
    const load = mode === 'Производство' ? 68 + rand() * 22 : mode === 'Мойка' ? 35 + rand() * 12 : 8 + rand() * 5;
    const output = mode === 'Производство' ? flow * .078 : 0;
    let electricity = mode === 'Производство' ? 18 + load * .17 + (process - 74) * .6 : mode === 'Мойка' ? 12 + rand() * 2 : 2 + rand();
    let water = mode === 'Производство' ? 22 + flow * .018 : mode === 'Мойка' ? 115 + rand() * 18 : 3 + rand() * 2;
    // Встроенные отклонения: несколько интервалов повышенного энергопотребления.
    const anomaly = (i >= 820 && i <= 835) || (i >= 2910 && i <= 2924) || (i >= 4210 && i <= 4222);
    if (anomaly) electricity *= 1.55;
    electricity += (rand() - .5) * 1.4;
    water += (rand() - .5) * 2;
    rows.push({
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, i * 5)).toISOString(), batch_id: batch,
      product_type: 'Пастеризованное молоко', milk_flow: +flow.toFixed(1),
      inlet_temperature: +inlet.toFixed(1), process_temperature: +process.toFixed(1),
      pressure: +pressure.toFixed(2), equipment_load: +load.toFixed(1),
      ambient_temperature: +ambient.toFixed(1), operating_mode: mode,
      electricity_kwh: +Math.max(0, electricity).toFixed(2), water_l: +Math.max(0, water).toFixed(2),
      output_l: +output.toFixed(1), downtime_min: mode === 'Ожидание' ? 5 : 0, anomaly
    });
  }
  return rows;
}

const FEATURES = ['milk_flow', 'process_temperature', 'pressure', 'equipment_load', 'ambient_temperature'];
function vector(r) { return [1, ...FEATURES.map(k => Number(r[k]) || 0), r.operating_mode === 'Производство' ? 1 : 0, r.operating_mode === 'Мойка' ? 1 : 0]; }
function solve(A, b) {
  const n = b.length; const m = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let pivot = i; for (let j = i + 1; j < n; j++) if (Math.abs(m[j][i]) > Math.abs(m[pivot][i])) pivot = j;
    [m[i], m[pivot]] = [m[pivot], m[i]];
    const div = m[i][i] || 1e-9; for (let k = i; k <= n; k++) m[i][k] /= div;
    for (let j = 0; j < n; j++) if (j !== i) { const f = m[j][i]; for (let k = i; k <= n; k++) m[j][k] -= f * m[i][k]; }
  }
  return m.map(row => row[n]);
}
function fitLinear(rows, target) {
  const n = 8; const A = Array.from({ length: n }, () => Array(n).fill(0)); const b = Array(n).fill(0);
  rows.forEach(r => { const x = vector(r); for (let i = 0; i < n; i++) { b[i] += x[i] * r[target]; for (let j = 0; j < n; j++) A[i][j] += x[i] * x[j]; } });
  for (let i = 1; i < n; i++) A[i][i] += .001;
  const w = solve(A, b); return r => vector(r).reduce((s, x, i) => s + x * w[i], 0);
}
function fitStumps(rows, target) {
  const features = ['milk_flow', 'process_temperature', 'pressure', 'equipment_load', 'ambient_temperature'];
  const trees = [];
  for (let t = 0; t < 35; t++) {
    const feature = features[t % features.length];
    const sorted = rows.map(r => r[feature]).sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length * (.25 + (t % 3) * .25))];
    const left = rows.filter(r => r[feature] <= threshold); const right = rows.filter(r => r[feature] > threshold);
    const mean = a => a.length ? a.reduce((s, r) => s + r[target], 0) / a.length : 0;
    trees.push({ feature, threshold, left: mean(left), right: mean(right) });
  }
  return r => trees.reduce((s, t) => s + (r[t.feature] <= t.threshold ? t.left : t.right), 0) / trees.length;
}
export function regressionMetrics(actual, predicted) {
  const n = actual.length; const mean = actual.reduce((a, b) => a + b, 0) / n;
  const mae = actual.reduce((s, v, i) => s + Math.abs(v - predicted[i]), 0) / n;
  const mse = actual.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0) / n;
  const total = actual.reduce((s, v) => s + (v - mean) ** 2, 0);
  return { mae, rmse: Math.sqrt(mse), r2: total ? 1 - n * mse / total : 0 };
}
export function evaluateModels(rows) {
  const trainEnd = Math.floor(rows.length * .7), valEnd = Math.floor(rows.length * .85);
  const train = rows.slice(0, trainEnd), val = rows.slice(trainEnd, valEnd), test = rows.slice(valEnd);
  const models = [
    { name: 'Базовый прогноз', predict: r => r.electricity_kwh },
    { name: 'Линейная регрессия', predict: fitLinear(train, 'electricity_kwh') },
    { name: 'Случайный лес (35 stumps)', predict: fitStumps(train, 'electricity_kwh') }
  ];
  // JS-вариант временной модели: авторегрессионный прогноз по окну из 12 значений.
  // Это прозрачный baseline для временного окна, а не LSTM.
  const temporal = (idx) => { const w = rows.slice(Math.max(0, idx - 12), idx); return w.length ? w.reduce((s, r, j) => s + r.electricity_kwh * (j + 1), 0) / w.reduce((s, _, j) => s + j + 1, 0) : rows[idx].electricity_kwh; };
  const actual = test.map(r => r.electricity_kwh);
  const results = models.map(m => {
    const pred = test.map(m.predict); return { name: m.name, ...regressionMetrics(actual, pred), predictions: pred };
  });
  const temporalPred = test.map((_, j) => temporal(valEnd + j));
  results.push({ name: 'Временное окно (12 шагов)', ...regressionMetrics(actual, temporalPred), predictions: temporalPred });
  const valPred = val.map(models[1].predict); const errors = val.map((r, i) => Math.abs(r.electricity_kwh - valPred[i])).sort((a, b) => a - b);
  const threshold = errors[Math.floor(errors.length * .95)] || 3;
  const chart = test.filter((_, i) => i % 12 === 0).slice(0, 100).map((r, i) => ({ step: i + 1, actual: r.electricity_kwh, forecast: results[1].predictions[i * 12] ?? r.electricity_kwh }));
  return { results, threshold, chart, split: { train: train.length, validation: val.length, test: test.length }, val, test };
}
export function getResourcePlans() {
  return [
    { name: 'Исходный режим', output: 10000, energy: 2520, water: 5200, lines: 'Одна линия · 100%', note: 'Без изменений' },
    { name: 'Распределение партий', output: 10000, energy: 2310, water: 4980, lines: 'Две линии · 65% / 35%', note: 'Сбалансированная загрузка' },
    { name: 'Сдвиг запуска', output: 10000, energy: 2375, water: 5050, lines: 'Две линии · запуск со сдвигом', note: 'Снижение пиков нагрузки' }
  ];
}
