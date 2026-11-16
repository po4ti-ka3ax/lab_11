"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  ChevronRight,
  CircleGauge,
  Droplets,
  Factory,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Play,
  RefreshCw,
  Settings2,
  Thermometer,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  evaluateModels,
  generateDataset,
  getResourcePlans,
} from "../lib/simulation";
import { trainLstm } from "../lib/lstm";

const money = (n) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
const fmt = (n) => Number(n).toFixed(2);
const nav = [
  ["Обзор", LayoutDashboard],
  ["Аналитика", BarChart3],
  ["Модели ML", BrainCircuit],
  ["Управление", Settings2],
  ["Виртуальный цех", Factory],
  ["Сценарии", Activity],
];

export default function Home() {
  const [data, setData] = useState([]);
  const [active, setActive] = useState("Обзор");
  const [modelData, setModelData] = useState(null);
  const [lstm, setLstm] = useState(null);
  const [training, setTraining] = useState(false);
  const [selected, setSelected] = useState("Тепловая обработка");
  const [scenario, setScenario] = useState("Базовый");
  const [recommended, setRecommended] = useState(false);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const rows = generateDataset(5000, 42);
    setData(rows);
    setModelData(evaluateModels(rows));
  }, []);
  const latest = data[data.length - 1];
  const plans = getResourcePlans();
  const plan = plans[recommended ? 1 : 0];
  const chartData = useMemo(
    () =>
      data
        .filter((_, i) => i % 35 === 0)
        .slice(-70)
        .map((r, i) => ({
          step: i + 1,
          energy: r.electricity_kwh,
          water: r.water_l,
          output: r.output_l,
        })),
    [data],
  );
  const anomalies = data.filter((r) => r.anomaly).length;
  const thresholdValue = modelData && modelData.threshold;
  const startTraining = async () => {
    setTraining(true);
    try {
      const result = await trainLstm(data);
      setLstm(result);
    } catch (e) {
      console.error(e);
      window.alert(
        "Не удалось обучить LSTM. Проверьте установку зависимостей и повторите запуск.",
      );
    } finally {
      setTraining(false);
    }
  };
  const runScenario = (name) => {
    setScenario(name);
    setRunning(true);
    setTimeout(() => setRunning(false), 550);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Factory size={20} />
          </div>
          <div>
            <b>Lab11</b>
          </div>
        </div>
        <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              onClick={() => setActive(label)}
              className={active === label ? "nav-item active" : "nav-item"}
            >
              <Icon size={17} />
              <span>{label}</span>
              {active === label && (
                <ChevronRight size={15} className="nav-arrow" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="status-dot" />
          Симулятор активен
          <div className="version">Учебный прототип · v1.0.0</div>
        </div>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <div className="crumb">
            Производство <ChevronRight size={14} /> <b>{active}</b>
          </div>
          <div className="top-right">
            <span className="live-pill">
              <i /> LIVE SIMULATION
            </span>
            <div className="avatar">DF</div>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                МОЛОЧНЫЙ ЦЕХ / ПАСТЕРИЗОВАННОЕ МОЛОКО
              </div>
              <h1>{active}</h1>
              <p>
                Интеллектуальная система прогнозирования и управления
                производственными ресурсами
              </p>
            </div>
            <button
              className="secondary-btn"
              onClick={() => {
                const rows = generateDataset(5000, 42);
                setData(rows);
                setModelData(evaluateModels(rows));
                setLstm(null);
              }}
            >
              <RefreshCw size={15} /> Обновить данные
            </button>
          </div>
          {active === "Обзор" && (
            <>
              <div className="stats-grid">
                <Stat
                  icon={Zap}
                  label="Электроэнергия"
                  value={latest ? fmt(latest.electricity_kwh) : "—"}
                  unit="кВт·ч / интервал"
                  trend="Прогноз на следующий шаг"
                  tone="yellow"
                />
                <Stat
                  icon={Droplets}
                  label="Расход воды"
                  value={latest ? fmt(latest.water_l) : "—"}
                  unit="л / интервал"
                  trend="Текущее потребление"
                  tone="blue"
                />
                <Stat
                  icon={Gauge}
                  label="Загрузка линии"
                  value={latest ? latest.equipment_load.toFixed(1) : "—"}
                  unit="% оборудования"
                  trend="В пределах нормы"
                  tone="green"
                />
                <Stat
                  icon={AlertTriangle}
                  label="Аномальные интервалы"
                  value={anomalies}
                  unit="в датасете"
                  trend="Синтетическая разметка"
                  tone="red"
                />
              </div>
              <div className="two-col">
                <Panel
                  title="Потребление ресурсов"
                  subtitle="Динамика электроэнергии за выбранный период"
                  tag="ПОСЛЕДНИЕ 70 ТОЧЕК"
                >
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient
                            id="energyFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#77b99b"
                              stopOpacity={0.22}
                            />
                            <stop
                              offset="100%"
                              stopColor="#77b99b"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#edf1ef"
                        />
                        <XAxis
                          dataKey="step"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#94a39c" }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#94a39c" }}
                        />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="energy"
                          name="Энергия, кВт·ч"
                          stroke="#3f9875"
                          strokeWidth={2}
                          fill="url(#energyFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel
                  title="Состояние производства"
                  subtitle="Текущий статус оборудования"
                >
                  <div className="equipment-list">
                    <Equipment
                      name="Резервуар сырья"
                      state="Работает"
                      value="8 450 л"
                      percent={84}
                      color="green"
                    />
                    <Equipment
                      name="Тепловая обработка"
                      state="Работает"
                      value="74.2 °C"
                      percent={76}
                      color="green"
                    />
                    <Equipment
                      name="Охладитель"
                      state="Работает"
                      value="4.1 °C"
                      percent={61}
                      color="green"
                    />
                    <Equipment
                      name="Фасовочная линия"
                      state="Ожидание"
                      value="Пауза"
                      percent={12}
                      color="gray"
                    />
                  </div>
                </Panel>
              </div>
              <div className="two-col bottom-grid">
                <Panel
                  title="Последние измерения"
                  subtitle="Телеметрия производственного участка"
                >
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Время</th>
                          <th>Режим</th>
                          <th>Температура</th>
                          <th>Энергия</th>
                          <th>Вода</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data
                          .slice(-6)
                          .reverse()
                          .map((r, i) => (
                            <tr key={i}>
                              <td>
                                {new Date(r.timestamp).toLocaleTimeString(
                                  "ru-RU",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </td>
                              <td>
                                <span className="mode-tag">
                                  {r.operating_mode}
                                </span>
                              </td>
                              <td>{r.process_temperature} °C</td>
                              <td>{r.electricity_kwh} кВт·ч</td>
                              <td>{r.water_l} л</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <Panel
                  title="Системные уведомления"
                  subtitle="Автоматический мониторинг"
                >
                  <div className="notice-list">
                    <div className="notice warning">
                      <AlertTriangle size={17} />
                      <div>
                        <b>Контроль энергопотребления</b>
                        <span>
                          В датасете присутствуют {anomalies} интервалов с
                          искусственно повышенным расходом энергии.
                        </span>
                      </div>
                    </div>
                    <div className="notice success">
                      <Activity size={17} />
                      <div>
                        <b>Технологический режим соблюдается</b>
                        <span>
                          Температурные параметры симуляции находятся в заданном
                          диапазоне.
                        </span>
                      </div>
                    </div>
                  </div>
                </Panel>
              </div>
            </>
          )}
          {active === "Аналитика" && (
            <>
              <div className="stats-grid">
                <Stat
                  icon={Zap}
                  label="Средняя энергия"
                  value={
                    data.length
                      ? fmt(
                          data.reduce((s, r) => s + r.electricity_kwh, 0) /
                            data.length,
                        )
                      : "—"
                  }
                  unit="кВт·ч / интервал"
                  tone="yellow"
                />
                <Stat
                  icon={Droplets}
                  label="Средняя вода"
                  value={
                    data.length
                      ? fmt(
                          data.reduce((s, r) => s + r.water_l, 0) / data.length,
                        )
                      : "—"
                  }
                  unit="л / интервал"
                  tone="blue"
                />
                <Stat
                  icon={Factory}
                  label="Объём выборки"
                  value="5 000"
                  unit="наблюдений"
                  tone="green"
                />
                <Stat
                  icon={Activity}
                  label="Временной шаг"
                  value="5"
                  unit="минут"
                  tone="purple"
                />
              </div>
              <div className="two-col">
                <Panel
                  title="Электроэнергия и вода"
                  subtitle="Синтетические измерения, фиксированный seed = 42"
                >
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="step" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          dataKey="energy"
                          name="Энергия, кВт·ч"
                          stroke="#399675"
                          dot={false}
                        />
                        <Line
                          dataKey="water"
                          name="Вода, л"
                          stroke="#559bd1"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel
                  title="Выпуск продукции"
                  subtitle="Объём за интервал, литры"
                >
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="step" />
                        <YAxis />
                        <Tooltip />
                        <Bar
                          dataKey="output"
                          name="Выпуск, л"
                          fill="#83bda2"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>
              <Panel
                title="Структура исходного датасета"
                subtitle="Поля, используемые в модели"
              >
                <div className="data-fields">
                  {[
                    "timestamp",
                    "batch_id",
                    "product_type",
                    "milk_flow",
                    "inlet_temperature",
                    "process_temperature",
                    "pressure",
                    "equipment_load",
                    "ambient_temperature",
                    "operating_mode",
                    "electricity_kwh",
                    "water_l",
                    "output_l",
                    "downtime_min",
                  ].map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                </div>
                <p className="footnote">
                  Данные синтетические. Временной ряд сформирован с шагом 5
                  минут; пропуски и дубликаты не создаются. Сценарии отклонений
                  встроены в интервалы 820–835, 2910–2924 и 4210–4222.
                </p>
              </Panel>
            </>
          )}
          {active === "Модели ML" && (
            <>
              <div className="section-intro">
                <div>
                  <h2>Сравнение прогнозных моделей</h2>
                  <p>
                    Целевая переменная — потребление электроэнергии на следующий
                    интервал.
                  </p>
                </div>
                <span className="split-chip">
                  70% обучение · 15% валидация · 15% тест
                </span>
              </div>
              <Panel
                title="Качество моделей"
                subtitle="Метрики рассчитаны на одном тестовом периоде"
              >
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Модель</th>
                        <th>MAE, кВт·ч</th>
                        <th>RMSE, кВт·ч</th>
                        <th>R²</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelData?.results.map((r) => (
                        <tr key={r.name}>
                          <td>
                            <b>{r.name}</b>
                          </td>
                          <td>{fmt(r.mae)}</td>
                          <td>{fmt(r.rmse)}</td>
                          <td>{fmt(r.r2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="model-note">
                  <BrainCircuit size={18} />
                  <span>
                    Для глубокого обучения доступно обучение LSTM на
                    TensorFlow.js. Нажмите кнопку ниже — обучение выполняется
                    прямо в браузере.
                  </span>
                </div>
                <button
                  className="primary-btn"
                  disabled={training || !data.length}
                  onClick={startTraining}
                >
                  {training ? (
                    <>
                      <span className="spinner" /> Обучение LSTM…
                    </>
                  ) : (
                    <>
                      <BrainCircuit size={16} /> Обучить LSTM
                    </>
                  )}
                </button>
                {lstm && (
                  <div className="lstm-result">
                    <b>LSTM обучена</b>
                    <span>MAE: {fmt(lstm.mae)} кВт·ч</span>
                    <span>RMSE: {fmt(lstm.rmse)} кВт·ч</span>
                    <span>R²: {fmt(lstm.r2)}</span>
                  </div>
                )}
              </Panel>
              <Panel
                title="Факт и прогноз"
                subtitle="Линейная регрессия · тестовая выборка"
              >
                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={modelData?.chart || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="step" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        dataKey="actual"
                        name="Факт"
                        stroke="#283f35"
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        dataKey="forecast"
                        name="Прогноз"
                        stroke="#48a27c"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <div className="info-strip">
                <AlertTriangle size={18} />
                <div>
                  <b>
                    Порог обнаружения отклонений:{" "}
                    {thresholdValue ? fmt(thresholdValue) : "—"} кВт·ч
                  </b>
                  <span>
                    Порог установлен по 95-му процентилю абсолютной ошибки на
                    валидационном периоде. Само превышение не доказывает
                    неисправность оборудования.
                  </span>
                </div>
              </div>
            </>
          )}
          {active === "Управление" && (
            <>
              <div className="section-intro">
                <div>
                  <h2>Оптимизация производственной нагрузки</h2>
                  <p>
                    Сравнение допустимых режимов при одинаковом плане выпуска.
                  </p>
                </div>
                <span className="split-chip">План выпуска: 10 000 л</span>
              </div>
              <div className="plan-grid">
                {plans.map((p, i) => (
                  <button
                    key={p.name}
                    className={
                      recommended === (i === 1)
                        ? "plan-card selected"
                        : "plan-card"
                    }
                    onClick={() => setRecommended(i === 1)}
                  >
                    <span className="plan-kicker">ВАРИАНТ {i + 1}</span>
                    <b>{p.name}</b>
                    <span>{p.lines}</span>
                    <div className="plan-metrics">
                      <div>
                        <small>Энергия</small>
                        <strong>
                          {money(p.energy)} <i>кВт·ч</i>
                        </strong>
                      </div>
                      <div>
                        <small>Вода</small>
                        <strong>
                          {money(p.water)} <i>л</i>
                        </strong>
                      </div>
                    </div>
                    <span className="plan-foot">{p.note}</span>
                  </button>
                ))}
              </div>
              <Panel
                title="Сравнение исходного и выбранного режима"
                subtitle="Расчётные значения симулятора"
              >
                <div className="compare-grid">
                  <Compare label="Выпуск продукции" a="10 000 л" b="10 000 л" />
                  <Compare
                    label="Электроэнергия"
                    a="2 520 кВт·ч"
                    b={`${money(plan.energy)} кВт·ч`}
                    good={plan.energy < 2520}
                  />
                  <Compare
                    label="Вода"
                    a="5 200 л"
                    b={`${money(plan.water)} л`}
                    good={plan.water < 5200}
                  />
                  <Compare
                    label="Энергия на литр"
                    a="0,252"
                    b={fmt(plan.energy / 10000)}
                    good={plan.energy < 2520}
                  />
                  <Compare
                    label="Вода на литр"
                    a="0,520"
                    b={fmt(plan.water / 10000)}
                    good={plan.water < 5200}
                  />
                </div>
                <div className="recommendation">
                  <Lightbulb size={20} />
                  <div>
                    <b>Рекомендация системы</b>
                    <p>
                      {recommended
                        ? "Распределить партии между двумя линиями. Расчётная нагрузка становится более равномерной при сохранении планового выпуска."
                        : "Рассмотрите распределение партий между двумя линиями для уменьшения пиков потребления."}{" "}
                      Температурные и санитарные требования остаются
                      неизменными.
                    </p>
                  </div>
                </div>
              </Panel>
              <p className="footnote">
                Экономия является результатом учебной симуляции, а не
                подтверждённым эффектом на реальном предприятии. Для оценки
                стоимости в тенге необходимо задать актуальные тарифы.
              </p>
            </>
          )}
          {active === "Виртуальный цех" && (
            <>
              <div className="section-intro">
                <div>
                  <h2>Интерактивная модель цеха</h2>
                  <p>
                    Настольный прототип виртуальной среды · выберите
                    технологический участок.
                  </p>
                </div>
                <button
                  className="secondary-btn"
                  onClick={() => setRunning(!running)}
                >
                  {running ? (
                    "Приостановить"
                  ) : (
                    <>
                      <Play size={14} /> Запустить симуляцию
                    </>
                  )}
                </button>
              </div>
              <div className="factory-layout">
                <div className="factory-floor">
                  <div className="floor-label">
                    ПРОИЗВОДСТВЕННАЯ ЛИНИЯ / СХЕМА ПОТОКА
                  </div>
                  <div className="pipeline">
                    <div className="pipe-line" />
                  </div>
                  <div className="machine-row">
                    {[
                      {
                        name: "Резервуар сырья",
                        sub: "Приёмка",
                        icon: "◉",
                        value: "8 450 л",
                      },
                      {
                        name: "Тепловая обработка",
                        sub: "Пастеризация",
                        icon: "♨",
                        value: "74.2 °C",
                      },
                      {
                        name: "Охладитель",
                        sub: "Охлаждение",
                        icon: "❄",
                        value: "4.1 °C",
                      },
                      {
                        name: "Фасовочная линия",
                        sub: "Розлив",
                        icon: "▤",
                        value: "Ожидание",
                      },
                    ].map((m, i) => (
                      <button
                        key={m.name}
                        onClick={() => setSelected(m.name)}
                        className={
                          selected === m.name
                            ? "machine selected-machine"
                            : "machine"
                        }
                      >
                        <div className="machine-icon">{m.icon}</div>
                        <b>{m.name}</b>
                        <span>{m.sub}</span>
                        <strong>{m.value}</strong>
                        <em className={i === 3 ? "idle-dot" : "working-dot"} />
                      </button>
                    ))}
                  </div>
                  <div className="floor-footer">
                    <span>
                      <i className="working-dot" /> Работает
                    </span>
                    <span>
                      <i className="idle-dot" /> Ожидание
                    </span>
                    <span>
                      <i className="warning-dot" /> Предупреждение
                    </span>
                  </div>
                </div>
                <div className="equipment-detail">
                  <div className="eyebrow">ПАНЕЛЬ ОБОРУДОВАНИЯ</div>
                  <h3>{selected}</h3>
                  <span className="state-pill">
                    ●{" "}
                    {selected === "Фасовочная линия" ? "Ожидание" : "Работает"}
                  </span>
                  <div className="detail-list">
                    <Detail
                      label="Температура"
                      value={
                        selected === "Тепловая обработка"
                          ? "74.2 °C"
                          : selected === "Охладитель"
                            ? "4.1 °C"
                            : "20.5 °C"
                      }
                    />
                    <Detail
                      label="Загрузка"
                      value={selected === "Фасовочная линия" ? "12%" : "76%"}
                    />
                    <Detail label="Энергия" value="24.8 кВт·ч" />
                    <Detail label="Вода" value="38.5 л" />
                    <Detail label="Прогноз энергии" value="25.1 кВт·ч" />
                  </div>
                  <div className="operator-tip">
                    <Lightbulb size={16} />
                    <span>
                      Рекомендуемое действие: контролировать стабильность
                      параметров и загрузку выбранного участка.
                    </span>
                  </div>
                  <small className="updated">
                    Последнее обновление:{" "}
                    {new Date().toLocaleTimeString("ru-RU")}
                  </small>
                </div>
              </div>
            </>
          )}
          {active === "Сценарии" && (
            <>
              <div className="section-intro">
                <div>
                  <h2>Экспериментальные сценарии</h2>
                  <p>
                    Проверка поведения системы при изменении исходных условий.
                  </p>
                </div>
              </div>
              <div className="scenario-grid">
                {[
                  {
                    name: "Базовый",
                    desc: "Штатное выполнение производственного плана.",
                    metric: "100% плана",
                    icon: "◈",
                  },
                  {
                    name: "Повышенный спрос",
                    desc: "Увеличение планового выпуска при ограниченной мощности.",
                    metric: "План +20%",
                    icon: "↗",
                  },
                  {
                    name: "Ограничение сырья",
                    desc: "Уменьшение доступного молочного сырья.",
                    metric: "Сырьё −25%",
                    icon: "◉",
                  },
                  {
                    name: "Простой линии",
                    desc: "Временная недоступность одного участка.",
                    metric: "Линия недоступна",
                    icon: "Ⅱ",
                  },
                  {
                    name: "Избыточное потребление",
                    desc: "Искусственное увеличение расхода энергии.",
                    metric: "Энергия +55%",
                    icon: "⚡",
                  },
                  {
                    name: "Изменение расписания",
                    desc: "Перенос запуска отдельных партий.",
                    metric: "Сдвиг запуска",
                    icon: "◷",
                  },
                ].map((s) => (
                  <button
                    key={s.name}
                    onClick={() => runScenario(s.name)}
                    className={
                      scenario === s.name
                        ? "scenario-card scenario-active"
                        : "scenario-card"
                    }
                  >
                    <div className="scenario-icon">{s.icon}</div>
                    <b>{s.name}</b>
                    <p>{s.desc}</p>
                    <span>{s.metric}</span>
                  </button>
                ))}
              </div>
              <Panel
                title={`Результат сценария: ${scenario}`}
                subtitle="Условный расчёт для демонстрации логики системы"
              >
                <div className="scenario-result">
                  <div>
                    <small>Выполнимость плана</small>
                    <b>
                      {scenario === "Базовый"
                        ? "Да"
                        : scenario === "Повышенный спрос"
                          ? "Требуется проверка мощности"
                          : scenario === "Ограничение сырья"
                            ? "Ограничена сырьём"
                            : scenario === "Простой линии"
                              ? "Перераспределение партий"
                              : "Да, после проверки"}
                    </b>
                  </div>
                  <div>
                    <small>Состояние</small>
                    <b>{running ? "Пересчёт…" : "Симуляция завершена"}</b>
                  </div>
                  <div>
                    <small>Рекомендация</small>
                    <b>
                      {scenario === "Простой линии"
                        ? "Распределить партии по доступным линиям"
                        : scenario === "Избыточное потребление"
                          ? "Проверить режим и оборудование"
                          : "Сравнить допустимые варианты расписания"}
                    </b>
                  </div>
                </div>
              </Panel>
            </>
          )}
          <footer className="footer">
            DairyFlow · Учебная интеллектуальная система управления ресурсами{" "}
            <span>Синтетические данные · Seed 42 · Шаг 5 минут</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function Stat({ icon: Icon, label, value, unit, trend, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <Icon size={18} />
      </div>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
      {trend && <div className="stat-trend">{trend}</div>}
    </div>
  );
}
function Panel({ title, subtitle, tag, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {tag && <span className="panel-tag">{tag}</span>}
      </div>
      {children}
    </section>
  );
}
function Equipment({ name, state, value, percent, color }) {
  return (
    <div className="equipment-row">
      <div className="equip-top">
        <div>
          <b>{name}</b>
          <span>{value}</span>
        </div>
        <small className={color === "gray" ? "muted-state" : "green-state"}>
          {state}
        </small>
      </div>
      <div className="progress">
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
function Compare({ label, a, b, good }) {
  return (
    <div className="compare-row">
      <span>{label}</span>
      <b>{a}</b>
      <strong className={good ? "positive" : ""}>{b}</strong>
    </div>
  );
}
function Detail({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
