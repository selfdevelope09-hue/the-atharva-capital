/**
 * TradingView Advanced Chart — free embed via `embed-widget-advanced-chart.js`.
 * Live data is served by TradingView; pass a valid `EXCHANGE:SYMBOL` string.
 * @see https://www.tradingview.com/widget/advanced-chart/
 */

export const TRADINGVIEW_ADVANCED_CHART_SCRIPT =
  'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

export type AdvancedChartWidgetOptions = {
  symbol: string;
  interval: string;
  theme: 'dark' | 'light';
  locale: string;
  timezone: string;
  /** Trade UI often locks symbol; explorers allow search. */
  allowSymbolChange?: boolean;
};

export function buildAdvancedChartWidgetConfig(
  opts: AdvancedChartWidgetOptions,
): Record<string, unknown> {
  return {
    autosize: true,
    symbol: opts.symbol,
    interval: opts.interval,
    timezone: opts.timezone,
    theme: opts.theme,
    style: '1',
    locale: opts.locale,
    enable_publishing: false,
    hide_top_toolbar: false,
    hide_legend: false,
    hide_side_toolbar: false,
    allow_symbol_change: opts.allowSymbolChange ?? false,
    save_image: false,
    calendar: false,
    hide_volume: false,
    support_host: 'https://www.tradingview.com',
    withdateranges: true,
  };
}

/** Paper-trading terminal: richer widget settings (TradingView may ignore unknown keys). */
export type PaperTradingChartOptions = AdvancedChartWidgetOptions & {
  studies?: string[];
};

export function buildPaperTradingChartConfig(opts: PaperTradingChartOptions): Record<string, unknown> {
  const base = buildAdvancedChartWidgetConfig({
    ...opts,
    allowSymbolChange: opts.allowSymbolChange ?? true,
  });
  return {
    ...base,
    backgroundColor: 'rgba(13, 17, 28, 1)',
    gridColor: 'rgba(255, 255, 255, 0.06)',
    studies: opts.studies ?? ['BB@tv-basicstudies', 'MASimple@tv-basicstudies'],
    show_popup_button: true,
    popup_width: '1000',
    popup_height: '650',
  };
}

/**
 * Mount the Advanced Chart widget (web DOM). The script tag contains JSON config
 * as text (TradingView reads it from the same &lt;script&gt; node).
 */
export function mountTradingViewAdvancedChartWeb(
  host: HTMLElement,
  config: Record<string, unknown>,
  onLoaded?: () => void,
): () => void {
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'tradingview-widget-container';
  wrap.style.height = '100%';
  wrap.style.width = '100%';

  const widget = document.createElement('div');
  widget.className = 'tradingview-widget-container__widget';
  widget.style.height = '100%';
  widget.style.width = '100%';
  wrap.appendChild(widget);

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = TRADINGVIEW_ADVANCED_CHART_SCRIPT;
  script.async = true;
  script.appendChild(document.createTextNode(JSON.stringify(config)));
  script.onload = () => {
    onLoaded?.();
  };
  script.onerror = () => {
    onLoaded?.();
  };
  wrap.appendChild(script);
  host.appendChild(wrap);

  return () => {
    host.innerHTML = '';
  };
}

/**
 * Full HTML document for React Native WebView.
 */
export function buildTradingViewAdvancedChartHtmlPage(config: Record<string, unknown>): string {
  const json = JSON.stringify(config);
  const body = json.replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: #0a0a0a; overflow: hidden; }
    .tradingview-widget-container { height: 100%; width: 100%; }
    .tradingview-widget-container__widget { height: 100%; width: 100%; }
  </style>
</head>
<body>
  <div class="tradingview-widget-container">
    <div class="tradingview-widget-container__widget"></div>
    <script type="text/javascript" src="${TRADINGVIEW_ADVANCED_CHART_SCRIPT}" async>${body}</script>
  </div>
</body>
</html>`;
}
