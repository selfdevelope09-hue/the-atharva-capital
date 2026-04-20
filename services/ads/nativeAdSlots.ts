/**
 * Scalable native ad slot registry — add script+container when each network is onboarded.
 * Slot 1: CEO-provided ProfitableCPM network (invoke.js + container).
 */

export type NativeSlotId = 1 | 2 | 3 | 4;

export const NATIVE_AD_HEIGHT = 250;

export type NativeSlotConfig = {
  /** External script URL; null = placeholder slot */
  scriptSrc: string | null;
  /** DOM/container id expected by the network script */
  containerId: string | null;
  /** Human label for debugging */
  networkLabel: string;
};

/** A-ADS adaptive iframe (Slot 2) — web + WebView HTML */
export const A_ADS_SLOT_2 = {
  dataAa: '2435144',
  iframeSrc: 'https://acceptable.a-ads.com/2435144/?size=Adaptive',
} as const;

export function buildAAdsAdaptiveSlot2Html(): string {
  const { dataAa, iframeSrc } = A_ADS_SLOT_2;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"/>
  <style>
    html,body{margin:0;padding:0;width:100%;height:100%;background:#0a0a0a;}
    #frame{width:100%;margin:auto;position:relative;z-index:99998;height:100%;min-height:100px;max-height:250px;}
    iframe{border:0;padding:0;width:100%;height:100%;overflow:hidden;display:block;margin:auto;background-color:transparent;}
  </style>
</head>
<body>
<div id="frame">
  <iframe data-aa="${dataAa}" src="${iframeSrc}"></iframe>
</div>
</body>
</html>`;
}

export const NATIVE_AD_SLOTS: Record<NativeSlotId, NativeSlotConfig> = {
  1: {
    scriptSrc: 'https://pl29181549.profitablecpmratenetwork.com/796979ffd5b209e5f69589f5e8e656dd/invoke.js',
    containerId: 'container-796979ffd5b209e5f69589f5e8e656dd',
    networkLabel: 'ProfitableCPM',
  },
  2: {
    scriptSrc: null,
    containerId: null,
    networkLabel: 'A-ADS',
  },
  3: {
    scriptSrc: null,
    containerId: null,
    networkLabel: 'Pending',
  },
  4: {
    scriptSrc: null,
    containerId: null,
    networkLabel: 'Pending',
  },
};

export function buildSlotHtml(cfg: NativeSlotConfig): string {
  if (!cfg.scriptSrc || !cfg.containerId) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style="margin:0;background:#0f0f12;color:#7b8390;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;">Ad slot</body></html>`;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
  <style>html,body{margin:0;padding:0;background:#0f0f12;min-height:100%;}</style>
</head>
<body>
<script async="async" data-cfasync="false" src="${cfg.scriptSrc}"></script>
<div id="${cfg.containerId}"></div>
</body>
</html>`;
}
