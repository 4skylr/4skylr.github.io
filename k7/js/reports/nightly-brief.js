// Team Brief — yesterday in one bilingual web3 card, rendered to a PNG with bubkoo/html-to-image,
// shared straight to WhatsApp (Web Share API) or downloaded. The tone follows the numbers.
const fmt = (n, d = 0) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n) || 0);
const pct = (n, d = 0) => `${((Number(n) || 0) * 100).toFixed(d)}%`;
const sgn = n => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(0)}%`;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dayD = iso => new Date(iso + "T00:00:00");
const WD_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], WD_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const sum = (r, k) => r.reduce((s, x) => s + (Number(x[k]) || 0), 0);

const TONES = {
  fire: { emoji: "🔥", c1: "#ff9f43", c2: "#dce6ff", en: "ON FIRE! Yesterday smashed it", ar: "ليلة نارية! أمس كسرنا الأرقام",
    en2: "Same energy today: every guest hears about the combos.", ar2: "نفس الحماس اليوم: كل عميل يسمع عن الكومبو." },
  strong: { emoji: "🚀", c1: "#3ed69e", c2: "#6ccbff", en: "Strong night, great work team", ar: "أداء قوي، شغل عظيم يا فريق",
    en2: "Keep the momentum: upsell large sizes and slush.", ar2: "كمّلوا على نفس الزخم: اعرضوا الأحجام الكبيرة والسلاش." },
  steady: { emoji: "✅", c1: "#5b7bff", c2: "#6ccbff", en: "Steady day, room to grow", ar: "يوم ثابت، وعندنا مجال نكبر",
    en2: "Today's focus: combos and one extra item per order.", ar2: "تركيز اليوم: الكومبو وصنف إضافي مع كل طلب." },
  low: { emoji: "⚡", c1: "#ffb547", c2: "#ff5468", en: "Quiet night, today we bounce back", ar: "ليلة هادية، واليوم نرجع أقوى",
    en2: "Greet every guest, offer the combo, and push the slush.", ar2: "رحّبوا بكل عميل، اعرضوا الكومبو، وركّزوا على السلاش." }
};

function figures(d, D) {
  const wd = dayD(d.date).getDay();
  const same = D.filter(x => dayD(x.date).getDay() === wd && x.date < d.date).slice(-4);
  const avg = same.length ? sum(same, "total") / same.length : 0, vs = avg ? d.total / avg - 1 : 0;
  const tone = !avg ? "steady" : vs >= 0.25 ? "fire" : vs >= 0.05 ? "strong" : vs >= -0.1 ? "steady" : "low";
  const m = d.date.slice(0, 7), dom = Number(d.date.slice(8));
  const mtdRows = D.filter(x => x.date.startsWith(m) && x.date <= d.date);
  const pm = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 2, 1), pk = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, "0")}`;
  const pmRows = D.filter(x => x.date.startsWith(pk) && Number(x.date.slice(8)) <= dom);
  const y = d.date.slice(0, 4), ytdRows = D.filter(x => x.date.startsWith(y) && x.date <= d.date);
  return { tone, vs, avg, mtd: sum(mtdRows, "total"), pmtd: sum(pmRows, "total"), ytd: sum(ytdRows, "total"), ytdAdmits: sum(ytdRows, "admits"), mtdAdmits: sum(mtdRows, "admits") };
}

function cardHtml(d, F, budget) {
  const t = TONES[F.tone], wd = dayD(d.date).getDay();
  const topFilm = (d.films || []).slice().sort((a, b) => (b.admits || 0) - (a.admits || 0))[0];
  const items = (d.groups || []).flatMap(g => g.items), merged = {};
  items.forEach(i => { const k = i.name.replace(/\s*-\s*\d+\s*oz$/i, "").trim(); merged[k] = (merged[k] || 0) + (i.qty || 0); });
  const topItem = Object.entries(merged).sort((a, b) => b[1] - a[1])[0];
  const trx = d.transactions ?? d.trx, ydays = Number(d.date.slice(0, 4)) % 4 ? 365 : 366;
  const doy = (dayD(d.date) - dayD(`${d.date.slice(0, 4)}-01-01`)) / 86400000 + 1, pace = budget * doy / ydays;
  const stat = (en, ar, v, sub = "") => `<div class="b-stat"><span>${en}<i>${ar}</i></span><b>${v}</b>${sub ? `<em>${sub}</em>` : ""}</div>`;
  return `<div class="b-card" style="--c1:${t.c1};--c2:${t.c2}">
    <div class="b-glow"></div><div class="b-grid"></div>
    <header class="b-top"><img src="assets/pay/noir.webp" alt=""><div><b>TEAM BRIEF</b><i>بريف الفريق</i></div>
      <span class="b-date">${WD_EN[wd]} · ${WD_AR[wd]}<br><b>${d.date}</b></span></header>
    <section class="b-tone"><span class="b-emoji">${t.emoji}</span><div><h1>${t.en}</h1><h2>${t.ar}</h2></div></section>
    <section class="b-hero"><span>TOTAL REVENUE · إجمالي الإيراد</span><b>${fmt(d.total)}<small> SAR</small></b>
      ${F.avg ? `<em class="${F.vs >= 0 ? "up" : "dn"}">${sgn(F.vs)} vs usual ${WD_EN[wd]} · عن ${WD_AR[wd]} المعتاد</em>` : ""}</section>
    <section class="b-stats">
      ${stat("Guests", "العملاء", fmt(d.admits))}
      ${stat("Transactions", "العمليات", fmt(trx))}
      ${stat("Items sold", "المنتجات المباعة", fmt(d.items))}
      ${stat("Box office", "التذاكر", fmt(d.bor))}
      ${stat("Concessions", "الكونسيشن", fmt(d.conc))}
      ${stat("Spend / head", "صرف الفرد", fmt(d.admits ? d.conc / d.admits : 0, 2))}
    </section>
    <section class="b-bars">
      <div class="b-bar"><span>Month to date · منذ بداية الشهر</span><b>${fmt(F.mtd)} SAR</b>
        ${F.pmtd ? `<em class="${F.mtd >= F.pmtd ? "up" : "dn"}">${sgn(F.mtd / F.pmtd - 1)} vs last month · عن الشهر الماضي</em>` : ""}
        <i><u style="width:${Math.min(100, F.pmtd ? F.mtd / F.pmtd * 100 : 100).toFixed(1)}%"></u></i></div>
      <div class="b-bar"><span>Year to date · منذ بداية السنة</span><b>${fmt(F.ytd)} SAR</b>
        <em class="${F.ytd >= pace ? "up" : "dn"}">${pct(F.ytd / budget)} of budget · من الميزانية</em>
        <i><u style="width:${Math.min(100, F.ytd / budget * 100).toFixed(1)}%"></u><s style="left:${Math.min(100, doy / ydays * 100).toFixed(1)}%"></s></i></div>
    </section>
    ${topFilm || topItem ? `<section class="b-tops">${topFilm ? `<div><span>🎬 Top film · الفيلم الأول</span><b>${esc(topFilm.name)}</b><em>${fmt(topFilm.admits)} guests</em></div>` : ""}
      ${topItem ? `<div><span>🍿 Top item · الصنف الأول</span><b>${esc(topItem[0])}</b><em>×${fmt(topItem[1])}</em></div>` : ""}</section>` : ""}
    <footer class="b-foot"><p>${t.en2}</p><p dir="rtl">${t.ar2}</p><span>NOIR CINEMA · UNAIZAH</span></footer>
  </div>`;
}

const CSS = `
.b-stage{position:fixed;left:-99999px;top:0;z-index:-1}
.b-card{position:relative;width:1080px;height:1350px;overflow:hidden;box-sizing:border-box;padding:46px 56px 40px;color:#fff;font-family:-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",Tahoma,sans-serif;
 background:radial-gradient(90% 60% at 0% 0%,color-mix(in srgb,var(--c1) 45%,transparent),transparent 60%),radial-gradient(90% 60% at 100% 100%,color-mix(in srgb,var(--c2) 40%,transparent),transparent 60%),#0b0716;display:flex;flex-direction:column;gap:14px;border:3px solid transparent;background-clip:padding-box}
.b-glow{position:absolute;inset:16px;border-radius:40px;box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--c1) 70%,#5b7bff),0 0 60px color-mix(in srgb,var(--c2) 40%,transparent)}
.b-grid{position:absolute;inset:0;opacity:.18;background-image:linear-gradient(rgba(255,255,255,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.25) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(80% 60% at 50% 30%,#000,transparent 75%)}
.b-card>:not(.b-glow):not(.b-grid){position:relative}
.b-top{display:flex;align-items:center;gap:22px}.b-top img{width:72px;height:72px;border-radius:22px}
.b-top div{display:grid}.b-top b{font-size:34px;letter-spacing:.18em}.b-top i{font-style:normal;font-size:26px;color:#d3dae6}
.b-date{margin-left:auto;text-align:right;font-size:24px;color:#d3dae6;line-height:1.35}.b-date b{font-size:32px;color:#fff;font-family:ui-monospace,Menlo,monospace}
.b-tone{display:flex;align-items:center;gap:20px;padding:12px 24px;border-radius:28px;background:linear-gradient(120deg,color-mix(in srgb,var(--c1) 30%,transparent),rgba(255,255,255,.04));border:2px solid color-mix(in srgb,var(--c1) 60%,transparent)}
.b-emoji{font-size:64px;line-height:1}.b-tone h1{margin:0;font-size:36px;line-height:1.1}.b-tone h2{margin:4px 0 0;font-size:32px;color:#f2e9ff;direction:rtl}
.b-hero{display:grid;gap:4px}.b-hero span{font-size:24px;letter-spacing:.14em;color:#d3dae6}
.b-hero b{font-size:92px;line-height:1;font-family:ui-monospace,Menlo,monospace;background:linear-gradient(90deg,#fff,color-mix(in srgb,var(--c1) 60%,#fff));-webkit-background-clip:text;background-clip:text;color:transparent}
.b-hero b small{font-size:40px;color:#d3dae6;-webkit-text-fill-color:#d3dae6}
.b-card em{font-style:normal;font-size:24px}.b-card em.up{color:#3ed69e}.b-card em.dn{color:#ff8a98}
.b-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.b-stat{padding:10px 18px;border-radius:22px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.12);display:grid;gap:0}
.b-stat span{font-size:21px;color:#d3dae6;display:flex;justify-content:space-between;gap:8px}.b-stat span i{font-style:normal;color:#fff}
.b-stat b{font-size:38px;font-family:ui-monospace,Menlo,monospace}
.b-bars{display:grid;gap:10px}
.b-bar{display:grid;grid-template-columns:1fr auto;gap:2px 14px;padding:10px 22px 14px;border-radius:22px;background:rgba(0,0,0,.28);border:1.5px solid rgba(255,255,255,.1)}
.b-bar span{font-size:23px;color:#d3dae6}.b-bar b{font-size:30px;font-family:ui-monospace,Menlo,monospace;text-align:right}.b-bar em{grid-column:1/-1;font-size:22px!important;margin-bottom:6px}
.b-bar i{grid-column:1/-1;position:relative;height:16px;border-radius:99px;background:rgba(255,255,255,.1);overflow:visible}
.b-bar u{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--c2),var(--c1));box-shadow:0 0 18px var(--c1)}
.b-bar s{position:absolute;top:-6px;width:4px;height:28px;border-radius:4px;background:#fff}
.b-tops{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.b-tops div{padding:10px 18px;border-radius:22px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.1);display:grid;gap:4px}
.b-tops span{font-size:21px;color:#d3dae6}.b-tops div{min-width:0;gap:0!important}.b-tops b{font-size:25px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.b-foot{margin-top:auto;display:grid;gap:2px;text-align:center}.b-foot p{margin:0;font-size:22px;color:#f2e9ff}.b-foot span{margin-top:4px;font-size:18px;letter-spacing:.3em;color:#a99bbf}
`;

export async function openBrief(d, D, H) {
  if (!d) return;
  const ar = (sessionStorage.getItem("noir-lang") || "en") === "ar";
  const budget = await fetch("nightly/days.json").then(r => r.json()).then(j => (j.budget.bor || 0) + (j.budget.conc || 0)).catch(() => 1782500);
  const F = figures(d, D);
  if (!document.getElementById("brief-css")) { const st = document.createElement("style"); st.id = "brief-css"; st.textContent = CSS; document.head.append(st); }
  const stage = document.createElement("div"); stage.className = "b-stage"; stage.innerHTML = cardHtml(d, F, budget); document.body.append(stage);
  const card = stage.firstElementChild;
  await Promise.all([...card.querySelectorAll("img")].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const { toPng } = await import("../../vendor/html-to-image.mjs");
  let url;
  try { url = await toPng(card, { pixelRatio: 1, skipFonts: true, cacheBust: true, width: 1080, height: 1350 }); }
  finally { stage.remove(); }
  const t = TONES[F.tone];
  const text = `${t.emoji} ${t.en} · ${t.ar}\n${d.date}\n` +
    `Total ${fmt(d.total)} SAR · الإجمالي\nGuests ${fmt(d.admits)} العملاء · Items ${fmt(d.items)} المنتجات · Transactions ${fmt(d.transactions ?? d.trx)} العمليات\n` +
    `MTD ${fmt(F.mtd)} · YTD ${fmt(F.ytd)} (${pct(F.ytd / budget)} of budget)\n${t.en2}\n${t.ar2}`;
  const m = H.openModal(`<div class="brief-sheet"><h2>${ar ? "بريف الفريق" : "Team brief"}</h2>
    <img class="brief-img" src="${url}" alt="Team brief">
    <div class="actions"><div class="end">
      <button class="btn" id="br-copy">${ar ? "نسخ النص" : "Copy text"}</button>
      <button class="btn" id="br-dl">${ar ? "تحميل الصورة" : "Download image"}</button>
      <button class="btn hot" id="br-share">${ar ? "إرسال للفريق" : "Send to team"}</button></div></div></div>`, "wide");
  const name = `team-brief-${d.date}.png`;
  m.querySelector("#br-dl").onclick = () => { const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); };
  m.querySelector("#br-copy").onclick = async () => { try { await navigator.clipboard.writeText(text); H.toast(ar ? "انسخ النص" : "Copied"); } catch { H.toast("Clipboard blocked", true); } };
  m.querySelector("#br-share").onclick = async () => {
    try {
      const blob = await (await fetch(url)).blob(), file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); m.querySelector("#br-dl").click(); }
    } catch (e) { if (e.name !== "AbortError") H.toast(e.message, true); }
  };
}
