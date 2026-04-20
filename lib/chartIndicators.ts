type Bar = { time: number; close: number };
type Point = { time: number; value: number };

/** Simple SMA for MA overlay (close-based). */
export function computeSma(bars: Bar[], period: number): Point[] {
  if (period <= 0 || bars.length < period) return [];
  const out: Point[] = [];
  for (let i = period - 1; i < bars.length; i += 1) {
    let sum = 0;
    for (let j = 0; j < period; j += 1) sum += bars[i - j]!.close;
    out.push({ time: bars[i]!.time, value: sum / period });
  }
  return out;
}

/** Wilder RSI (14) mapped to same timestamps as input bars (undefined until enough samples). */
export function computeRsi(bars: Bar[], period = 14): Point[] {
  if (bars.length < period + 1) return [];
  const out: Point[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i += 1) {
    const ch = bars[i]!.close - bars[i - 1]!.close;
    if (ch >= 0) avgGain += ch;
    else avgLoss -= ch;
  }
  avgGain /= period;
  avgLoss /= period;

  const pushRsi = (idx: number, ag: number, al: number) => {
    const rs = al === 0 ? 100 : ag / al;
    const rsi = 100 - 100 / (1 + rs);
    out.push({ time: bars[idx]!.time, value: rsi });
  };

  pushRsi(period, avgGain, avgLoss);

  for (let i = period + 1; i < bars.length; i += 1) {
    const ch = bars[i]!.close - bars[i - 1]!.close;
    const gain = ch > 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    pushRsi(i, avgGain, avgLoss);
  }
  return out;
}
