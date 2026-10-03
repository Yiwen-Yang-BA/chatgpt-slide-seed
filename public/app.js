import {
  $,
  escape,
  load,
  save,
  toast,
  download,
  init,
  run,
  busy,
  resultMeta,
  fileText,
} from "./ui.js";
import { validateDeck, renderDeckHtml, deckToMarkdown } from "./deck.js";
let deck = null;
let current = 0;
let pending = false;
let importing = false;
let presenting = 0;
let generationMeta = null;
let warnings = [];
const themes = ["sage", "ink", "clay"];
function check() {
  if (!deck) throw Error("请先生成或导入幻灯片");
  return validateDeck(deck);
}
function slideHTML(slide, index) {
  return `<div class="slide-surface theme-${$("#theme").value}"><div class="slide-kicker">${escape(deck.title)} <span>${String(index + 1).padStart(2, "0")}</span></div><h2>${escape(slide.title)}</h2><ul>${slide.bullets.map((b) => `<li>${escape(b)}</li>`).join("")}</ul><div class="slide-footer">${escape(deck.subtitle)}<span>${index + 1} / ${deck.slides.length}</span></div></div>`;
}
function renderPreview() {
  $("#preview").innerHTML = slideHTML(deck.slides[current], current);
  $("#slide-number").textContent =
    `PAGE ${current + 1} / ${deck.slides.length}`;
  $("#up").disabled = pending || importing || current === 0;
  $("#down").disabled =
    pending || importing || current === deck.slides.length - 1;
  $("#remove").disabled = pending || importing || deck.slides.length === 1;
  $("#add-slide").disabled = pending || importing || deck.slides.length >= 12;
}
function renderList() {
  $("#slide-list").innerHTML = deck.slides
    .map(
      (slide, i) =>
        `<button data-slide="${i}" class="slide-item ${i === current ? "active" : ""}" ${pending || importing ? "disabled" : ""}><span class="number">${String(i + 1).padStart(2, "0")}</span><strong>${escape(slide.title || "未命名页面")}</strong></button>`,
    )
    .join("");
}
function renderEditor() {
  const slide = deck.slides[current];
  $("#slide-title").value = slide.title;
  $("#slide-bullets").value = slide.bullets.join("\n");
  $("#slide-notes").value = slide.notes;
  renderPreview();
  renderList();
}
function controls() {
  const locked = pending || importing;
  document
    .querySelectorAll(
      "#deck-form input,#deck-form textarea,#deck-form select,#generate,#sample,#mode,#import,#theme,#workspace input,#workspace textarea,#workspace button",
    )
    .forEach((el) => (el.disabled = locked));
  document
    .querySelectorAll("#save,#export-html,#export-md,#export-json,#play")
    .forEach((el) => (el.disabled = locked || !deck));
  if (deck) renderPreview();
}
function renderDeck() {
  $("#empty").hidden = Boolean(deck);
  $("#workspace").hidden = !deck;
  if (!deck) {
    controls();
    return;
  }
  $("#deck-title").value = deck.title;
  $("#deck-subtitle").value = deck.subtitle;
  $("#meta").innerHTML = generationMeta
    ? resultMeta(generationMeta)
    : '<span class="pill">已载入保存的幻灯片 · 内容请自行核实</span>';
  $("#warnings").textContent = warnings.join(" ");
  renderEditor();
  controls();
}
function editSlide() {
  const slide = deck.slides[current];
  slide.title = $("#slide-title").value;
  slide.bullets = $("#slide-bullets")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  slide.notes = $("#slide-notes").value;
  renderPreview();
  renderList();
}
$("#slide-title").oninput = editSlide;
$("#slide-bullets").oninput = editSlide;
$("#slide-notes").oninput = editSlide;
$("#deck-title").oninput = () => {
  if (deck) {
    deck.title = $("#deck-title").value;
    renderPreview();
  }
};
$("#deck-subtitle").oninput = () => {
  if (deck) {
    deck.subtitle = $("#deck-subtitle").value;
    renderPreview();
  }
};
$("#slide-list").onclick = (e) => {
  const b = e.target.closest("[data-slide]");
  if (b && !pending && !importing) {
    current = Number(b.dataset.slide);
    renderEditor();
  }
};
$("#add-slide").onclick = () => {
  if (!deck || pending || importing || deck.slides.length >= 12) return;
  deck.slides.splice(current + 1, 0, {
    title: "新的观点",
    bullets: ["写下希望听众记住的内容"],
    notes: "",
  });
  current++;
  renderEditor();
};
$("#remove").onclick = () => {
  if (!deck || pending || importing || deck.slides.length === 1) return;
  deck.slides.splice(current, 1);
  current = Math.min(current, deck.slides.length - 1);
  renderEditor();
};
function move(direction) {
  const next = current + direction;
  if (!deck || pending || importing || next < 0 || next >= deck.slides.length)
    return;
  [deck.slides[current], deck.slides[next]] = [
    deck.slides[next],
    deck.slides[current],
  ];
  current = next;
  renderEditor();
}
$("#up").onclick = () => move(-1);
$("#down").onclick = () => move(1);
$("#theme").onchange = () => {
  if (deck) renderPreview();
};
$("#sample").onclick = () => {
  $("#topic").value = "让团队知识更易查找";
  $("#audience").value = "产品与研发团队";
  $("#brief").value =
    "现状：文档分散，重复提问较多。\n方法：统一入口、明确负责人、定期检查失效内容。\n行动：选择一个团队试点，收集反馈后调整。";
  $("#count").value = "5";
};
$("#deck-form").onsubmit = async (e) => {
  e.preventDefault();
  if (pending || importing) return;
  pending = true;
  busy($("#generate"), true, "组织内容中…");
  controls();
  try {
    const r = await run({
      topic: $("#topic").value,
      audience: $("#audience").value,
      brief: $("#brief").value,
      count: Number($("#count").value),
    });
    const next = validateDeck(r.data.deck);
    deck = next;
    current = 0;
    generationMeta = r.meta;
    warnings = r.data.warnings;
    renderDeck();
  } catch (err) {
    toast(err.message, true);
  } finally {
    pending = false;
    busy($("#generate"), false);
    controls();
  }
};
$("#save").onclick = () => {
  try {
    check();
    if (
      save("slide-seed-v1", {
        version: 1,
        deck,
        theme: $("#theme").value,
        meta: generationMeta,
        warnings,
      })
    )
      toast("本地草稿已保存");
  } catch (err) {
    toast(err.message, true);
  }
};
$("#export-html").onclick = () => {
  try {
    download(
      "slide-seed.html",
      renderDeckHtml(check(), $("#theme").value),
      "text/html;charset=utf-8",
    );
  } catch (err) {
    toast(err.message, true);
  }
};
$("#export-md").onclick = () => {
  try {
    download(
      "slide-outline.md",
      deckToMarkdown(check()),
      "text/markdown;charset=utf-8",
    );
  } catch (err) {
    toast(err.message, true);
  }
};
$("#export-json").onclick = () => {
  try {
    download(
      "slide-deck.json",
      JSON.stringify(
        {
          version: 1,
          deck: check(),
          theme: $("#theme").value,
          meta: generationMeta,
          warnings,
        },
        null,
        2,
      ),
      "application/json",
    );
  } catch (err) {
    toast(err.message, true);
  }
};
$("#import").onchange = async (e) => {
  if (pending || importing) return;
  importing = true;
  controls();
  try {
    const file = e.target.files[0];
    if (!file) return;
    const parsed = JSON.parse(await fileText(file, 150000));
    if (parsed.version !== 1 || !themes.includes(parsed.theme))
      throw Error("这不是支持的 Slide Seed 备份");
    const next = validateDeck(parsed.deck);
    deck = structuredClone(next);
    current = 0;
    generationMeta = null;
    warnings = ["从 JSON 导入的内容，请确认事实与来源。"];
    $("#theme").value = parsed.theme;
    renderDeck();
    toast("幻灯片已导入，可保存到本地");
  } catch (err) {
    toast(err.message, true);
  } finally {
    importing = false;
    e.target.value = "";
    controls();
  }
};
function showPresentation() {
  const s = deck.slides[presenting];
  $("#present-slide").innerHTML = slideHTML(s, presenting);
  $("#present-count").textContent = `${presenting + 1} / ${deck.slides.length}`;
  $("#previous").disabled = presenting === 0;
  $("#next").disabled = presenting === deck.slides.length - 1;
}
$("#play").onclick = () => {
  try {
    check();
    presenting = current;
    $("#present-title").textContent = deck.title;
    showPresentation();
    $("#presenter").showModal();
  } catch (err) {
    toast(err.message, true);
  }
};
$("#exit").onclick = () => $("#presenter").close();
$("#previous").onclick = () => {
  presenting = Math.max(0, presenting - 1);
  showPresentation();
};
$("#next").onclick = () => {
  presenting = Math.min(deck.slides.length - 1, presenting + 1);
  showPresentation();
};
$("#presenter").addEventListener("keydown", (e) => {
  if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
    e.preventDefault();
    if (e.key === "ArrowRight")
      presenting = Math.min(deck.slides.length - 1, presenting + 1);
    if (e.key === "ArrowLeft") presenting = Math.max(0, presenting - 1);
    if (e.key === "Home") presenting = 0;
    if (e.key === "End") presenting = deck.slides.length - 1;
    showPresentation();
  }
});
await init();
try {
  const saved = load("slide-seed-v1", null);
  if (saved) {
    deck = validateDeck(saved.deck);
    $("#theme").value = themes.includes(saved.theme) ? saved.theme : "sage";
    generationMeta =
      saved.meta && ["demo", "live"].includes(saved.meta.mode)
        ? saved.meta
        : null;
    warnings = Array.isArray(saved.warnings)
      ? saved.warnings.filter((w) => typeof w === "string")
      : [];
  }
} catch {
  deck = null;
  toast("本地草稿格式无效，可重新导入备份。", true);
}
renderDeck();
