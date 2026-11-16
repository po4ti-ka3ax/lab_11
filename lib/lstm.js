import { regressionMetrics } from "./simulation";

// Небольшая LSTM на TensorFlow.js. Масштабирование вычисляется только по train.
export async function trainLstm(rows) {
  const tf = await import("@tensorflow/tfjs");
  await tf.ready();
  const trainEnd = Math.floor(rows.length * 0.7);
  const valEnd = Math.floor(rows.length * 0.85);
  const keys = [
    "milk_flow",
    "process_temperature",
    "pressure",
    "equipment_load",
    "ambient_temperature",
    "electricity_kwh",
  ];
  const trainRows = rows.slice(0, trainEnd);
  const means = keys.map(
    (k) => trainRows.reduce((s, r) => s + Number(r[k]), 0) / trainRows.length,
  );
  const stds = keys.map(
    (k, i) =>
      Math.sqrt(
        trainRows.reduce((s, r) => s + (Number(r[k]) - means[i]) ** 2, 0) /
          trainRows.length,
      ) || 1,
  );
  const encode = (r) => keys.map((k, i) => (Number(r[k]) - means[i]) / stds[i]);
  const make = (start, end) => {
    const xs = [],
      ys = [];
    for (let i = start + 12; i < end; i++) {
      xs.push(rows.slice(i - 12, i).map(encode));
      ys.push([(rows[i].electricity_kwh - means[5]) / stds[5]]);
    }
    return { xs, ys };
  };
  const tr = make(0, trainEnd),
    va = make(trainEnd, valEnd),
    te = make(valEnd, rows.length);
  // Ограничиваем объём для комфортного обучения в браузере.
  const sample = (a, limit) =>
    a.length > limit
      ? a
          .filter((_, i) => i % Math.ceil(a.length / limit) === 0)
          .slice(0, limit)
      : a;
  const tx = sample(tr.xs, 1100),
    ty = sample(tr.ys, 1100);
  const vx = sample(va.xs, 250),
    vy = sample(va.ys, 250);
  const model = tf.sequential();
  model.add(tf.layers.lstm({ units: 12, inputShape: [12, 6] }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: tf.train.adam(0.008), loss: "meanSquaredError" });
  const xTrain = tf.tensor3d(tx),
    yTrain = tf.tensor2d(ty);
  const xVal = tf.tensor3d(vx),
    yVal = tf.tensor2d(vy);
  await model.fit(xTrain, yTrain, {
    epochs: 5,
    batchSize: 32,
    validationData: [xVal, yVal],
    callbacks: [
      tf.callbacks.earlyStopping({
        monitor: "val_loss",
        patience: 2,
        restoreBestWeights: false,
      }),
    ],
    verbose: 0,
  });
  const testX = tf.tensor3d(te.xs);
  const output = model.predict(testX);
  const normalized = Array.from(await output.data());
  const predictions = normalized.map((v) => v * stds[5] + means[5]);
  const actual = te.ys.map((v) => v[0] * stds[5] + means[5]);
  const metrics = regressionMetrics(actual, predictions);
  tf.dispose([xTrain, yTrain, xVal, yVal, testX, output]);
  model.dispose();
  return { name: "LSTM (12 шагов)", ...metrics, predictions };
}
