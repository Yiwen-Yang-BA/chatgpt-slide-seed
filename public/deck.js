const THEMES = {
  sage: {
    background: "#eef2eb",
    paper: "#fbfdf8",
    ink: "#19352b",
    muted: "#67796c",
    accent: "#427557",
    line: "#d5dfd0",
  },
  ink: {
    background: "#111720",
    paper: "#1a2330",
    ink: "#eef3fc",
    muted: "#a5b2c8",
    accent: "#9ebfff",
    line: "#344254",
  },
  clay: {
    background: "#f4ece5",
    paper: "#fffaf4",
    ink: "#4d3028",
    muted: "#8d7569",
    accent: "#aa5e45",
    line: "#e7d6c9",
  },
};

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function checkedText(value, label, max, allowEmpty = false) {
  check(
    typeof value === "string" && value.length <= max,
    `${label}必须是 ${max} 个字符以内的文本。`,
  );
  const result = value.trim();
  check(allowEmpty || result.length > 0, `${label}不能为空。`);
  return result;
}

/** Shared browser validation for edited decks; returns a clean independent copy. */
export function validateDeck(deck) {
  check(
    deck && typeof deck === "object" && !Array.isArray(deck),
    "幻灯片文件格式无效。",
  );
  const title = checkedText(deck.title, "演示标题", 100);
  const subtitle = checkedText(deck.subtitle, "演示副标题", 160, true);
  check(
    Array.isArray(deck.slides) &&
      deck.slides.length >= 1 &&
      deck.slides.length <= 12,
    "编辑后的演示须包含 1–12 页。",
  );
  const slides = deck.slides.map((slide, index) => {
    check(
      slide && typeof slide === "object" && !Array.isArray(slide),
      `第 ${index + 1} 页格式无效。`,
    );
    check(
      Array.isArray(slide.bullets) &&
        slide.bullets.length >= 1 &&
        slide.bullets.length <= 4,
      `第 ${index + 1} 页须有 1–4 条要点。`,
    );
    return {
      title: checkedText(slide.title, `第 ${index + 1} 页标题`, 100),
      bullets: slide.bullets.map((bullet) =>
        checkedText(bullet, "幻灯片要点", 160),
      ),
      notes: checkedText(slide.notes, "讲者备注", 800, true),
    };
  });
  return { title, subtitle, slides };
}

function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}

// Fixed script: user content is written only into escaped HTML text nodes.
const NAVIGATION = `(() => {
  const slides = Array.from(document.querySelectorAll('section.slide'));
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const counter = document.getElementById('counter');
  let current = 0;
  function show(index) {
    current = Math.max(0, Math.min(index, slides.length - 1));
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === current);
      slide.setAttribute('aria-hidden', String(i !== current));
    });
    counter.textContent = (current + 1) + ' / ' + slides.length;
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
  }
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  document.addEventListener('keydown', event => {
    if (event.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const movements = {ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: slides.length - 1};
    if (Object.prototype.hasOwnProperty.call(movements, event.key)) {
      event.preventDefault();
      show(movements[event.key]);
    }
  });
  show(0);
})();`;

/** Produces a portable HTML deck with no external scripts, fonts, or requests. */
export function renderDeckHtml(value, theme = "sage") {
  const deck = validateDeck(value);
  check(Object.hasOwn(THEMES, theme), "配色仅支持 sage、ink 或 clay。");
  const colors = THEMES[theme];
  const pages = deck.slides
    .map(
      (slide, index) => `
<section class="slide${index === 0 ? " active" : ""}" aria-hidden="${index !== 0}" aria-label="${escapeHtml(slide.title)}">
  <div class="slide-label">${String(index + 1).padStart(2, "0")} / ${String(deck.slides.length).padStart(2, "0")} <span>SLIDE SEED</span></div>
  <h1>${escapeHtml(slide.title)}</h1>
  <ul>${slide.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
  ${slide.notes ? `<details class="notes"><summary>讲者备注</summary><p>${escapeHtml(slide.notes)}</p></details>` : ""}
</section>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; object-src 'none'; base-uri 'none'">
<title>${escapeHtml(deck.title)}</title>
<style>
:root{color-scheme:${theme === "ink" ? "dark" : "light"};--background:${colors.background};--paper:${colors.paper};--ink:${colors.ink};--muted:${colors.muted};--accent:${colors.accent};--line:${colors.line}}
*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;line-height:1.55}button{font:inherit}button:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:4px}.shell{max-width:1220px;margin:0 auto;padding:30px 38px}.masthead{display:flex;align-items:start;justify-content:space-between;gap:24px;margin-bottom:22px}.deck-name{font-size:16px;font-weight:700;overflow-wrap:anywhere}.subtitle{max-width:820px;margin:6px 0 0;font-size:13px;color:var(--muted);overflow-wrap:anywhere}.badge{flex-shrink:0;font-size:10px;letter-spacing:.17em;color:var(--muted);padding-top:5px}.slide{display:none;min-height:65vh;padding:clamp(28px,5vw,68px);background:var(--paper);border:1px solid var(--line);border-radius:22px;box-shadow:0 20px 60px #00000008}.slide.active{display:flex;flex-direction:column}.slide-label{display:flex;justify-content:space-between;gap:18px;color:var(--accent);font-size:11px;font-weight:700;letter-spacing:.2em}.slide-label span{color:var(--muted)}h1{max-width:970px;font-size:clamp(30px,4.6vw,62px);font-weight:650;line-height:1.15;letter-spacing:-.035em;margin:38px 0 30px;overflow-wrap:anywhere}ul{display:grid;gap:22px;margin:0;padding-left:1.15em;max-width:960px;font-size:clamp(18px,2.2vw,28px);line-height:1.6}li{padding-left:.25em;overflow-wrap:anywhere}li::marker{color:var(--accent)}.notes{margin-top:38px;padding-top:18px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}.notes summary{cursor:pointer;width:max-content;max-width:100%}.notes p{white-space:pre-wrap;overflow-wrap:anywhere;margin:14px 0 0}.controls{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:24px}.controls button{border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:12px;min-width:108px;padding:11px 18px;cursor:pointer}.controls button:disabled{opacity:.35;cursor:default}.controls button:not(:disabled):hover{border-color:var(--accent)}#counter{font-size:13px;font-variant-numeric:tabular-nums;color:var(--muted)}.hint{text-align:center;color:var(--muted);font-size:11px;margin:16px 0 0;letter-spacing:.04em}
@media(max-width:640px){.shell{padding:18px 16px}.masthead{gap:12px}.badge{display:none}.slide{border-radius:16px;min-height:65vh}h1{margin:28px 0 26px}ul{gap:18px}.controls button{min-width:92px;padding:10px 13px}}
@page{size:landscape;margin:12mm}@media print{body{background:white;color:#17261e}.shell{max-width:none;padding:0}.masthead{margin:0 0 12mm}.badge,.controls,.hint{display:none!important}.slide,.slide.active{display:flex!important;min-height:150mm;border:0;border-radius:0;box-shadow:none;background:white;color:#17261e;padding:8mm 0;break-after:page;page-break-after:always}.slide:last-child{break-after:auto;page-break-after:auto}h1{font-size:32pt;margin:18mm 0 12mm}ul{font-size:17pt;gap:8mm}.notes{color:#45534a;margin-top:10mm;break-inside:avoid}.notes:not([open])>*:not(summary){display:block!important}.slide-label{color:#45534a}}
</style></head><body><div class="shell"><header class="masthead"><div><div class="deck-name">${escapeHtml(deck.title)}</div>${deck.subtitle ? `<p class="subtitle">${escapeHtml(deck.subtitle)}</p>` : ""}</div><div class="badge">PORTABLE PRESENTATION</div></header><main>${pages}</main><nav class="controls" aria-label="幻灯片导航"><button type="button" id="previous" disabled>← 上一页</button><span id="counter" aria-live="polite">1 / ${deck.slides.length}</span><button type="button" id="next"${deck.slides.length === 1 ? " disabled" : ""}>下一页 →</button></nav><p class="hint">← → 翻页 · Home / End 跳转 · 浏览器打印可导出 PDF</p></div><script>${NAVIGATION}</script></body></html>`;
}

function markdownText(value) {
  return value.replace(/\\/g, "\\\\").replace(/([`*_{}\[\]<>#+!|])/g, "\\$1");
}

export function deckToMarkdown(value) {
  const deck = validateDeck(value);
  const lines = [`# ${markdownText(deck.title)}`, ""];
  if (deck.subtitle) lines.push(markdownText(deck.subtitle), "");
  deck.slides.forEach((slide, index) => {
    lines.push(`## ${index + 1}. ${markdownText(slide.title)}`, "");
    lines.push(
      ...slide.bullets.map(
        (bullet) => `- ${markdownText(bullet).replace(/\r?\n/g, "\n  ")}`,
      ),
      "",
    );
    if (slide.notes)
      lines.push("### 讲者备注", "", markdownText(slide.notes), "");
  });
  return lines.join("\n");
}
