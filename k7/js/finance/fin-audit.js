// Cash office audit: the system's RDR Exception Register against the DCS sheets.
// For every F&B shift: what the POS sold, what the cashier dropped, what the team leader verified,
// and what the DCS sheet recorded. Gaps are explained by cause, not just totalled.
import { isOpen, unlock } from "../core/lock.js?v=103";
import { nameKey } from "./fin-dcs.js?v=103";

const MONEY = ["cash", "card", "prepaid", "voucher", "others"];
const TN = { cash: ["Cash", "كاش"], card: ["Card", "شبكة"], prepaid: ["Pre-paid / online", "مسبق الدفع / أونلاين"], voucher: ["Voucher", "قسائم"], others: ["Others", "أخرى"], comp: ["Comp", "ضيافة"] };
const SHARED = /system users|test user/i;
const r2 = n => Math.round(n * 100) / 100;
const fmt = (n, d = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n || 0);
const sgn = (n, d = 0) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n), d)}`;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const LV = a => a >= 500 ? "committee" : a >= 100 ? "audit" : a >= 5 ? "inquiry" : "note";

// ── engine ───────────────────────────────────────────────────
export function audit(rdr, days) {
  const byDay = new Map(days.map(d => [d.date, d]));
  const shifts = rdr.shifts.filter(s => s.o === "F&B").map(s => {
    const g = k => s.t[k] || [0, 0, 0];
    const pos = r2(MONEY.reduce((a, k) => a + g(k)[0], 0)), ud = r2(MONEY.reduce((a, k) => a + g(k)[1], 0)), tl = r2(MONEY.reduce((a, k) => a + g(k)[2], 0));
    const gap = Object.fromEntries(MONEY.map(k => [k, r2(g(k)[2] - g(k)[0])]));
    const net = r2(tl - pos), gross = r2(MONEY.reduce((a, k) => a + Math.abs(gap[k]), 0)), swap = r2((gross - Math.abs(net)) / 2);
    const comp = r2(g("comp")[2] - g("comp")[0]);
    // the DCS row for the same cashier and day
    const day = byDay.get(s.d), c = day?.cashiers?.find(x => nameKey(x.user) === nameKey(s.u));
    let dcs = null;
    if (c) {
      const sysNet = r2(tl + g("comp")[2] - pos - g("comp")[0]), dNet = r2((c.total || 0) - (c.report || 0));
      dcs = { total: c.total || 0, report: c.report || 0, net: dNet, sysNet, gap: r2(dNet - sysNet),
        t: { cash: c.cash || 0, card: c.card || 0, prepaid: (c.online || 0) + (c.prepaid || 0), voucher: c.voucher || 0, others: (c.other || 0) + (c.jahez || 0) + (c.hunger || 0) + (c.bogo || 0), comp: c.comp || 0 } };
    }
    const why = [];
    if (pos > 0 && !ud && !tl) why.push("nodrop");
    else if (tl > 0 && tl < pos * 0.6 && pos - tl > 50) why.push("partial");
    if (net <= -5 && !why.length) why.push("short");
    if (net >= 5) why.push("over");
    if (swap >= 5) why.push("swap");
    if (Math.abs(tl - ud) >= 1) why.push("tlfix");
    if (g("others")[2] > 0 && !g("others")[0]) why.push("others");
    if (Math.abs(comp) >= 1) why.push("comp");
    if (dcs && Math.abs(dcs.gap) > 1) why.push("dcs");
    if (!dcs && day) why.push("nodcs");
    if (SHARED.test(s.u) && pos) why.push("shared");
    if (s.f) why.push("flag");
    const size = Math.max(Math.abs(net), Math.abs(comp), dcs ? Math.abs(dcs.gap) : 0);
    const level = why.some(w => ["nodrop", "partial", "short", "over", "dcs", "shared", "comp"].includes(w)) ? LV(size) : why.length ? "note" : "ok";
    const driver = MONEY.slice().sort((a, b) => gap[a] - gap[b])[0];
    const amt = [net, comp, dcs ? dcs.gap : 0].reduce((a, v) => Math.abs(v) > Math.abs(a) ? v : a, 0);
    return { ...s, pos, ud, tl, net, gross, swap, gap, comp, dcs, why, level, size, amt, driver, month: s.d.slice(0, 7) };
  });
  const sum = (f, L = shifts) => r2(L.reduce((a, s) => a + f(s), 0));
  const tender = [...MONEY, "comp"].map(k => {
    const v = j => sum(s => s.t[k]?.[j] || 0);
    return { k, pos: v(0), ud: v(1), tl: v(2), gapU: r2(v(1) - v(0)), gap: r2(v(2) - v(0)), shifts: shifts.filter(s => Math.abs((s.t[k]?.[2] || 0) - (s.t[k]?.[0] || 0)) >= 1).length };
  });
  const T = Object.fromEntries(tender.map(t => [t.k, t]));
  const months = [...new Set(shifts.map(s => s.month))].sort().map(m => { const L = shifts.filter(s => s.month === m);
    return { m, shifts: L.length, pos: sum(s => s.pos, L), net: sum(s => s.net, L), short: sum(s => Math.min(0, s.net), L), over: sum(s => Math.max(0, s.net), L), swap: sum(s => s.swap, L), dcs: L.filter(s => s.why.includes("dcs")).length }; });
  const cashiers = [...new Set(shifts.map(s => s.u))].map(u => { const L = shifts.filter(s => s.u === u);
    const absNet = sum(s => Math.abs(s.net), L), pos = sum(s => s.pos, L);
    return { u, shifts: L.length, pos, net: sum(s => s.net, L), short: sum(s => Math.min(0, s.net), L), over: sum(s => Math.max(0, s.net), L), swap: sum(s => s.swap, L), comp: sum(s => s.comp, L),
      balanced: L.filter(s => Math.abs(s.net) < 5).length, worst: L.reduce((a, s) => s.net < a.net ? s : a, L[0]), acc: pos ? 1 - absNet / pos : 1,
      flags: L.filter(s => ["committee", "audit"].includes(s.level)).length, dcs: L.filter(s => s.why.includes("dcs")).length, tlfix: L.filter(s => s.why.includes("tlfix")).length };
  }).sort((a, b) => a.net - b.net);
  const matched = shifts.filter(s => s.dcs);
  const of = w => shifts.filter(s => s.why.includes(w));
  const rdrDays = new Set(shifts.map(s => s.d));
  const lastDcs = days.length ? days[days.length - 1].date : null;
  const noDcsDays = [...rdrDays].filter(d => !byDay.has(d)).sort();
  // DCS cashier rows (not the kiosk) with no matching shift in the register
  const shiftKeys = new Set(shifts.map(s => `${s.d}|${nameKey(s.u)}`));
  const from = rdr.from, to = rdr.to;
  const dcsOnly = days.filter(d => d.date >= from && d.date <= to).flatMap(d => (d.cashiers || []).filter(c => !/kiosk|unpunch/i.test(c.user) && (c.total || c.report) && !shiftKeys.has(`${d.date}|${nameKey(c.user)}`)).map(c => ({ d: d.date, u: c.user, total: c.total || 0 })));
  const totals = {
    shifts: shifts.length, pos: sum(s => s.pos), ud: sum(s => s.ud), tl: sum(s => s.tl), net: sum(s => s.net), gross: sum(s => s.gross), swap: sum(s => s.swap),
    exact: shifts.filter(s => Math.abs(s.net) < 0.01).length, within: shifts.filter(s => Math.abs(s.net) < 5).length,
    short: sum(s => Math.min(0, s.net)), over: sum(s => Math.max(0, s.net)), shortN: shifts.filter(s => s.net <= -5).length, overN: shifts.filter(s => s.net >= 5).length,
    tlfixN: of("tlfix").length, tlfix: sum(s => s.tl - s.ud, of("tlfix")), nodropN: of("nodrop").length + of("partial").length, nodrop: sum(s => s.net, [...of("nodrop"), ...of("partial")]),
    dcsN: of("dcs").length, dcsAbs: sum(s => Math.abs(s.dcs.gap), of("dcs")), dcsNet: sum(s => s.dcs.net, matched), sysNet: sum(s => s.dcs.sysNet, matched), matched: matched.length,
    dcsHide: of("dcs").filter(s => Math.abs(s.dcs.net) < 1 && Math.abs(s.dcs.sysNet) >= 1).length,
    sharedPos: sum(s => s.pos, of("shared")), sharedN: of("shared").length, flagged: shifts.filter(s => s.f).length
  };
  totals.acc = totals.pos ? 1 - sum(s => Math.abs(s.net)) / totals.pos : 1;
  // where the net gap comes from
  const causes = [
    { k: "swap", amt: totals.swap, n: of("swap").length },
    { k: "others", amt: T.others.tl, n: of("others").length },
    { k: "card", amt: T.card.gap, n: T.card.shifts },
    { k: "nodrop", amt: totals.nodrop, n: totals.nodropN },
    { k: "comp", amt: T.comp.gap, n: of("comp").length },
    { k: "dcs", amt: totals.dcsAbs, n: totals.dcsN, hide: totals.dcsHide },
    { k: "tlfix", amt: totals.tlfix, n: totals.tlfixN }
  ];
  const checks = [
    { k: "acc", ok: rdr.accUsed > 0 },
    { k: "diff", ok: rdr.diffUsed > 0 },
    { k: "ticket", ok: (rdr.outlets?.Ticketing?.money || 0) > 0 },
    { k: "shared", ok: !totals.sharedN, n: totals.sharedN, amt: totals.sharedPos },
    { k: "dcsdays", ok: !noDcsDays.length, list: noDcsDays },
    { k: "dcsonly", ok: !dcsOnly.length, list: dcsOnly },
    { k: "tlfix", ok: totals.tlfixN === 0, n: totals.tlfixN }
  ];
  return { shifts, tender, T, months, cashiers, totals, causes, checks, lastDcs, from, to };
}

// ── words ────────────────────────────────────────────────────
const W = {
  en: {
    title: "Cash office audit", sub: "System (RDR Exception Register) against the DCS sheet, shift by shift. F&B drops.",
    sys: "System sales (POS)", ud: "Cashier drop", tl: "Verified drop (TL)", net: "Net over / short", acc: "Drop accuracy", bal: "Balanced shifts", dcsk: "DCS ≠ system",
    of: "of", shifts: "shifts", why: "Why the gaps happened", bridge: "Tender by tender", month: "Month by month", board: "Cashiers", list: "Exceptions", checks: "Control checks",
    th: ["Tender", "System", "Cashier", "TL", "Gap", "Shifts"], cth: ["Cashier", "Shifts", "Sales", "Net", "Short", "Over", "Swaps", "Comp gap", "Accuracy", "DCS ≠"],
    lock: "Cashier names and shifts open with the Settings PIN.", pin: "PIN", open: "Open", bad: "Wrong PIN", all: "All", none: "Nothing here",
    lv: { committee: "Committee ≥ 500", audit: "Audit ≥ 100", inquiry: "Inquiry", note: "Note" },
    rs: { nodrop: "No drop entered", partial: "Drop far below sales", short: "Shortage", over: "Excess", swap: "Tender swap", tlfix: "TL changed count", others: "Others, no system sale", comp: "Comp not matched", dcs: "DCS ≠ system", nodcs: "Not on DCS", shared: "Shared/test account", flag: "TC SC" },
    cause: {
      swap: a => [`Tender swaps: ${fmt(a.amt)} SAR moved between tenders`, `${a.n} shifts. Money was right but rung on the wrong tender, mostly a card sale paid in cash or the reverse. It does not lose money, but it breaks the card settlement and the cash count.`, "Ask the guest how they pay before closing the sale; void and re-ring on the right tender."],
      others: a => [`“Others”: ${fmt(a.amt)} SAR dropped with no system sale`, `${a.n} shifts. Cashiers declare money under Others while the POS shows zero on that tender. That money was sold on another tender (usually card or delivery) and lands in Others at drop time.`, "Map delivery apps and found money to their own POS tender, or drop them under the tender they were sold on."],
      card: a => [`Card: ${sgn(a.amt)} SAR against the system`, `${a.n} shifts. Card slips came in below the POS. Part is explained by the swaps and Others above; the rest needs the terminal settlement (mada report) for those days: voids, refunds, a second terminal, or a slip not printed.`, "Match each short day with the bank settlement before closing the month."],
      nodrop: a => [`Drops missing: ${sgn(a.amt)} SAR`, `${a.n} shifts have sales but no drop, or a drop far below sales.`, "Every shift with sales must be closed with a full drop the same night."],
      comp: a => [`Comp: ${sgn(a.amt)} SAR not matched`, `${a.n} shifts. Complimentary items were rung on the POS (mostly on managers' shifts) but no comp slips were dropped for them.`, "Keep a signed comp slip for each comp and drop it with the shift."],
      dcs: a => [`DCS sheet ≠ system: ${fmt(a.amt)} SAR`, `${a.n} shifts where the DCS sheet does not show the same over/short as the system drop. In ${a.hide} of them the DCS shows the shift balanced while the system drop is short or over, so the sheet hides the difference.`, "The DCS must be filled from the verified drop, not from the POS report."],
      tlfix: a => [`TL corrections: ${sgn(a.amt)} SAR`, `${a.n} shifts where the team leader's verified count differs from what the cashier declared.`, "Normal when a miscount is caught; repeated corrections for one cashier need coaching."]
    },
    chk: {
      acc: c => [c.ok ? "Accountant drop entered" : "Accountant drop never entered", c.ok ? "The third check is recorded." : "The Accountant RDR Drop column is zero on every line, so the third check is not done in the system."],
      diff: c => [c.ok ? "Difference column used" : "System Difference column is always 0", c.ok ? "" : "The register's own Difference column is not used. This page works the difference out from POS and TL instead."],
      ticket: c => [c.ok ? "Ticketing drops recorded" : "No ticketing drops in the register", c.ok ? "" : "Ticketing rows are all zero: box office cash is not dropped through RDR."],
      shared: c => [c.ok ? "No sales on shared accounts" : `Sales on shared/test accounts: ${fmt(c.amt)} SAR`, c.ok ? "" : `${c.n} shifts were sold on System Users or a test user. Each sale should sit under a named cashier.`],
      dcsdays: c => [c.ok ? "Every system day is on the DCS" : `${c.list.length} system days missing from the DCS`, c.ok ? "" : c.list.join(", ") + ". Upload the DCS workbook for that month."],
      dcsonly: c => [c.ok ? "Every DCS cashier is in the system" : `${c.list.length} DCS rows with no shift in the register`, c.ok ? "" : c.list.slice(0, 8).map(x => `${x.d} ${x.u} (${fmt(x.total)})`).join(" · ")],
      tlfix: c => [c.ok ? "No TL corrections" : `${c.n} TL corrections`, ""]
    }
  },
  ar: {
    title: "تدقيق الخزنة", sub: "النظام (RDR Exception Register) مقابل شيت الـDCS، وردية وردية. دروب الكونسيشن.",
    sys: "مبيعات النظام (POS)", ud: "دروب الكاشير", tl: "الدروب المعتمد (TL)", net: "صافي الزيادة / العجز", acc: "دقة الدروب", bal: "ورديات مضبوطة", dcsk: "DCS ≠ النظام",
    of: "من", shifts: "وردية", why: "ليش صارت الفروقات", bridge: "حسب طريقة الدفع", month: "شهر بشهر", board: "الكاشيرية", list: "الاستثناءات", checks: "فحوصات الرقابة",
    th: ["الطريقة", "النظام", "الكاشير", "TL", "الفرق", "ورديات"], cth: ["الكاشير", "ورديات", "المبيعات", "الصافي", "عجز", "زيادة", "تبديل", "فرق الضيافة", "الدقة", "DCS ≠"],
    lock: "أسماء الكاشيرية والورديات تفتح بالرقم السري حق الإعدادات.", pin: "الرقم السري", open: "فتح", bad: "الرقم غلط", all: "الكل", none: "لا يوجد",
    lv: { committee: "لجنة ≥ 500", audit: "أوديت ≥ 100", inquiry: "تساؤل", note: "ملاحظة" },
    rs: { nodrop: "ما فيه دروب", partial: "دروب أقل بكثير من المبيعات", short: "عجز", over: "زيادة", swap: "تبديل طريقة دفع", tlfix: "التيم ليدر عدّل", others: "أخرى بدون مبيعات", comp: "ضيافة غير مطابقة", dcs: "DCS ≠ النظام", nodcs: "مو موجود بالـDCS", shared: "حساب مشترك/تجريبي", flag: "TC SC" },
    cause: {
      swap: a => [`تبديل طرق الدفع: ${fmt(a.amt)} ريال انتقلت بين الطرق`, `${a.n} وردية. المبلغ صحيح لكن انسجل على طريقة دفع غلط، غالباً بيع شبكة انتقد كاش أو العكس. ما يضيع فلوس لكنه يخرب تسوية الشبكة وعدّ الكاش.`, "اسأل العميل عن طريقة الدفع قبل إغلاق الطلب، وإذا انسجل غلط سوّ فويد وأعد التسجيل."],
      others: a => [`"أخرى": ${fmt(a.amt)} ريال بالدروب بدون مبيعات بالنظام`, `${a.n} وردية. الكاشير يحط مبالغ تحت "أخرى" والنظام ما فيه ولا ريال على هالطريقة. المبلغ انباع على طريقة ثانية (غالباً شبكة أو تطبيقات التوصيل) وانحط بأخرى وقت الدروب.`, "خصص طريقة دفع بالنظام لتطبيقات التوصيل، أو دروبها على نفس الطريقة اللي انباعت عليها."],
      card: a => [`الشبكة: ${sgn(a.amt)} ريال مقابل النظام`, `${a.n} وردية. إيصالات الشبكة أقل من النظام. جزء منه يفسره التبديل و"أخرى" اللي فوق، والباقي يحتاج تقرير تسوية الشبكة (مدى) لهالأيام: فويد، مرتجع، جهاز ثاني، أو إيصال ما انطبع.`, "طابق كل يوم فيه عجز شبكة مع كشف البنك قبل إقفال الشهر."],
      nodrop: a => [`دروب ناقص: ${sgn(a.amt)} ريال`, `${a.n} وردية فيها مبيعات بدون دروب، أو دروب أقل بكثير من المبيعات.`, "كل وردية فيها مبيعات لازم تتقفل بدروب كامل بنفس الليلة."],
      comp: a => [`الضيافة: ${sgn(a.amt)} ريال غير مطابقة`, `${a.n} وردية. أصناف ضيافة انسجلت بالنظام (غالباً بورديات المدراء) وما انحط لها إيصالات ضيافة بالدروب.`, "لكل ضيافة إيصال موقّع ينحط مع دروب الوردية."],
      dcs: a => [`شيت الـDCS ≠ النظام: ${fmt(a.amt)} ريال`, `${a.n} وردية الـDCS فيها زيادة/عجز مختلف عن دروب النظام. منها ${a.hide} الـDCS يبينها مضبوطة والنظام فيه عجز أو زيادة، يعني الشيت يخفي الفرق.`, "الـDCS لازم ينعبى من الدروب المعتمد، مو من تقرير النظام."],
      tlfix: a => [`تعديلات التيم ليدر: ${sgn(a.amt)} ريال`, `${a.n} وردية عدّ التيم ليدر فيها يختلف عن اللي صرّح فيه الكاشير.`, "طبيعي لما ينكشف خطأ عدّ، لكن التكرار لنفس الكاشير يحتاج تدريب."]
    },
    chk: {
      acc: c => [c.ok ? "دروب المحاسب مسجل" : "دروب المحاسب ما انسجل أبد", c.ok ? "" : "عمود Accountant RDR Drop صفر بكل السطور، يعني التدقيق الثالث ما يتم بالنظام."],
      diff: c => [c.ok ? "عمود الفرق مستخدم" : "عمود Difference بالنظام دايماً صفر", c.ok ? "" : "عمود الفرق بالتقرير ما يُستخدم، فهالصفحة تحسب الفرق من النظام والـTL."],
      ticket: c => [c.ok ? "دروب التذاكر مسجل" : "ما فيه دروب تذاكر بالتقرير", c.ok ? "" : "سطور التذاكر كلها صفر: كاش شباك التذاكر ما ينحط دروب عن طريق RDR."],
      shared: c => [c.ok ? "ما فيه مبيعات على حسابات مشتركة" : `مبيعات على حسابات مشتركة/تجريبية: ${fmt(c.amt)} ريال`, c.ok ? "" : `${c.n} وردية انباعت على System Users أو مستخدم تجريبي. كل بيع لازم يكون باسم كاشير.`],
      dcsdays: c => [c.ok ? "كل أيام النظام موجودة بالـDCS" : `${c.list.length} يوم بالنظام ناقص من الـDCS`, c.ok ? "" : c.list.join("، ") + ". ارفع ملف الـDCS لهالشهر."],
      dcsonly: c => [c.ok ? "كل كاشير بالـDCS موجود بالنظام" : `${c.list.length} سطر بالـDCS بدون وردية بالنظام`, c.ok ? "" : c.list.slice(0, 8).map(x => `${x.d} ${x.u} (${fmt(x.total)})`).join(" · ")],
      tlfix: c => [c.ok ? "ما فيه تعديلات تيم ليدر" : `${c.n} تعديل تيم ليدر`, ""]
    }
  }
};

// ── view ─────────────────────────────────────────────────────
const state = { level: "all", reason: "all", open: null };
export function renderRdrAudit(host, { rdr, days, ar, echarts }) {
  if (!host) return;
  const t = W[ar ? "ar" : "en"];
  if (!rdr) { host.innerHTML = `<div class="uz-h"><div><h3>${t.title}</h3><p>${ar ? "ارفع تقرير RDR Exception Register من الإعدادات." : "Upload the RDR Exception Register from Settings."}</p></div></div>`; return; }
  const A = audit(rdr, days), S = A.totals, admin = isOpen();
  const tn = k => TN[k][ar ? 1 : 0];
  const causes = A.causes.filter(c => Math.abs(c.amt) >= 1).sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt));
  host.innerHTML = `
    <div class="uz-h"><div><h3>${t.title}</h3><p>${t.sub}</p></div>
      <div class="ra-src"><span class="data">RDR ${A.from} → ${A.to}</span><span class="data">DCS → ${A.lastDcs || "—"}</span></div></div>
    <div class="ra-kpis">
      <article><span>${t.sys}</span><b class="data">${fmt(S.pos)}</b><em>${S.shifts} ${t.shifts}</em></article>
      <article><span>${t.tl}</span><b class="data">${fmt(S.tl)}</b><em>${t.ud} ${fmt(S.ud)}</em></article>
      <article class="${S.net < 0 ? "neg" : "pos"}"><span>${t.net}</span><b class="data">${sgn(S.net, 2)}</b><em><i class="neg">${sgn(S.short)}</i> · <i class="pos">${sgn(S.over)}</i></em></article>
      <article><span>${t.acc}</span><b class="data">${(S.acc * 100).toFixed(2)}%</b><em>${t.bal} ${S.within} ${t.of} ${S.shifts}</em></article>
      <article class="${S.dcsN ? "warn" : ""}"><span>${t.dcsk}</span><b class="data">${S.dcsN}</b><em>${fmt(S.dcsAbs)} SAR · DCS ${sgn(S.dcsNet)} / ${ar ? "النظام" : "system"} ${sgn(S.sysNet)}</em></article>
    </div>
    <h4 class="ra-h">${t.why}</h4>
    <div class="ra-causes">${causes.map((c, i) => { const [h, p, act] = t.cause[c.k](c);
      return `<article class="ra-cause ${c.amt < 0 ? "neg" : ""}"><span class="ra-n data">${String(i + 1).padStart(2, "0")}</span><div><b>${h}</b><p>${p}</p><p class="act">→ ${act}</p></div></article>`; }).join("")}</div>
    <div class="ra-two">
      <div><h4 class="ra-h">${t.bridge}</h4>
        <div class="ra-tw"><table class="ra-t"><thead><tr>${t.th.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>
        ${A.tender.filter(x => x.pos || x.tl || x.ud).map(x => `<tr><td>${tn(x.k)}</td><td class="data">${fmt(x.pos)}</td><td class="data">${fmt(x.ud)}</td><td class="data">${fmt(x.tl)}</td><td class="data ${x.gap < -0.5 ? "neg" : x.gap > 0.5 ? "pos" : ""}">${sgn(x.gap)}</td><td class="data">${x.shifts}</td></tr>`).join("")}
        </tbody><tfoot><tr><td>${ar ? "المجموع (بدون الضيافة)" : "Total (money)"}</td><td class="data">${fmt(S.pos)}</td><td class="data">${fmt(S.ud)}</td><td class="data">${fmt(S.tl)}</td><td class="data ${S.net < 0 ? "neg" : "pos"}">${sgn(S.net)}</td><td></td></tr></tfoot></table></div></div>
      <div><h4 class="ra-h">${t.month}</h4><div class="ra-chart" id="ra-month"></div></div>
    </div>
    <h4 class="ra-h">${t.checks}</h4>
    <div class="ra-checks">${A.checks.map(c => { const [h, p] = t.chk[c.k](c); return `<div class="ra-chk ${c.ok ? "ok" : "bad"}"><i>${c.ok ? "✓" : "!"}</i><div><b>${h}</b>${p ? `<p>${esc(p)}</p>` : ""}</div></div>`; }).join("")}</div>
    <div id="ra-private"></div>`;
  paintPrivate(host.querySelector("#ra-private"), A, t, ar, admin, () => renderRdrAudit(host, { rdr, days, ar, echarts }));
  if (echarts) monthChart(echarts, host.querySelector("#ra-month"), A, ar);
}

function paintPrivate(el, A, t, ar, admin, rerender) {
  if (!admin) {
    el.innerHTML = `<div class="ra-lock"><p><svg class="ic-lock" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> ${t.lock}</p><form id="ra-lock"><input class="input" name="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="${t.pin}" aria-label="${t.pin}"><button class="uz-btn" type="submit">${t.open}</button></form></div>`;
    el.querySelector("#ra-lock").onsubmit = e => { e.preventDefault(); if (!unlock(e.target.pin.value)) { e.target.pin.value = ""; e.target.pin.placeholder = t.bad; return; } rerender(); };
    return;
  }
  const tn = k => TN[k][ar ? 1 : 0];
  const list = A.shifts.filter(s => s.level !== "ok" && (state.level === "all" || s.level === state.level) && (state.reason === "all" || s.why.includes(state.reason)))
    .sort((a, b) => b.size - a.size || Math.abs(b.swap) - Math.abs(a.swap));
  const counts = k => A.shifts.filter(s => s.level === k).length;
  const reasons = Object.keys(t.rs).filter(r => A.shifts.some(s => s.why.includes(r)));
  el.innerHTML = `
    <h4 class="ra-h">${t.board}</h4>
    <div class="ra-tw"><table class="ra-t ra-board"><thead><tr>${t.cth.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>
      ${A.cashiers.map(c => `<tr><td><b>${esc(c.u)}</b></td><td class="data">${c.shifts}</td><td class="data">${fmt(c.pos)}</td><td class="data ${c.net < -0.5 ? "neg" : c.net > 0.5 ? "pos" : ""}">${sgn(c.net)}</td><td class="data neg">${c.short ? sgn(c.short) : "—"}</td><td class="data pos">${c.over ? sgn(c.over) : "—"}</td><td class="data">${fmt(c.swap)}</td><td class="data ${c.comp < -0.5 ? "neg" : ""}">${c.comp ? sgn(c.comp) : "—"}</td>
        <td><span class="ra-acc ${c.acc >= 0.995 ? "hi" : c.acc >= 0.98 ? "mid" : "lo"} data">${(c.acc * 100).toFixed(1)}%</span></td><td class="data">${c.dcs || "—"}</td></tr>`).join("")}
    </tbody></table></div>
    <h4 class="ra-h">${t.list} <small class="data">${list.length}</small></h4>
    <div class="ra-filters">
      <div class="uz-seg" id="ra-lv">${["all", "committee", "audit", "inquiry", "note"].map(k => `<button data-v="${k}" class="${state.level === k ? "on" : ""}" aria-pressed="${state.level === k}">${k === "all" ? t.all : t.lv[k]}${k === "all" ? "" : ` <small>${counts(k)}</small>`}</button>`).join("")}</div>
      <div class="ra-chips">${["all", ...reasons].map(r => `<button data-r="${r}" class="${state.reason === r ? "on" : ""}">${r === "all" ? t.all : t.rs[r]}</button>`).join("")}</div>
    </div>
    <div class="ra-list">${list.slice(0, 80).map((s, i) => {
      const id = `${s.d}|${s.id}|${s.p}`, open = state.open === id;
      return `<article class="ra-row lv-${s.level}${open ? " open" : ""}" data-id="${esc(id)}">
        <button class="ra-row-h" type="button" aria-expanded="${open}"><span class="data">${s.d}</span><b>${esc(s.u)}</b>
          <span class="ra-tags">${s.why.map(w => `<i class="w-${w}">${t.rs[w]}</i>`).join("")}</span>
          <em class="data ${s.amt < -0.5 ? "neg" : s.amt > 0.5 ? "pos" : ""}">${sgn(s.amt, 2)}</em></button>
        ${open ? `<div class="ra-row-b"><div class="ra-tw"><table class="ra-t mini"><thead><tr><th></th><th>${ar ? "النظام" : "System"}</th><th>${ar ? "الكاشير" : "Cashier"}</th><th>TL</th><th>DCS</th><th>${ar ? "الفرق" : "Gap"}</th></tr></thead><tbody>
          ${[...MONEY, "comp"].filter(k => s.t[k] || s.dcs?.t[k]).map(k => { const v = s.t[k] || [0, 0, 0], g = r2(v[2] - v[0]);
            return `<tr><td>${tn(k)}</td><td class="data">${fmt(v[0], 2)}</td><td class="data">${fmt(v[1], 2)}</td><td class="data">${fmt(v[2], 2)}</td><td class="data">${s.dcs ? fmt(s.dcs.t[k], 2) : "—"}</td><td class="data ${g < -0.005 ? "neg" : g > 0.005 ? "pos" : ""}">${sgn(g, 2)}</td></tr>`; }).join("")}
          </tbody></table></div>
          ${s.dcs ? `<p class="ra-note">DCS: ${ar ? "المحصّل" : "collected"} ${fmt(s.dcs.total, 2)} · ${ar ? "حسب التقرير" : "as per report"} ${fmt(s.dcs.report, 2)} → ${sgn(s.dcs.net, 2)} · ${ar ? "النظام" : "system"} ${sgn(s.dcs.sysNet, 2)}</p>` : ""}
          ${s.swap >= 5 ? `<p class="ra-note">${ar ? "تبديل" : "Swap"}: ${MONEY.filter(k => Math.abs(s.gap[k]) >= 1).map(k => `${tn(k)} ${sgn(s.gap[k])}`).join(" · ")}</p>` : ""}
        </div>` : ""}
      </article>`; }).join("") || `<p class="uz-empty">${t.none}</p>`}</div>`;
  el.querySelectorAll("#ra-lv button").forEach(b => b.onclick = () => { state.level = b.dataset.v; state.open = null; paintPrivate(el, A, t, ar, admin, rerender); });
  el.querySelectorAll(".ra-chips button").forEach(b => b.onclick = () => { state.reason = b.dataset.r; state.open = null; paintPrivate(el, A, t, ar, admin, rerender); });
  el.querySelectorAll(".ra-row-h").forEach(b => b.onclick = () => { const id = b.parentElement.dataset.id; state.open = state.open === id ? null : id; paintPrivate(el, A, t, ar, admin, rerender); });
}

function monthChart(ec, el, A, ar) {
  if (!el) return;
  const c = ec.init(el, null, { renderer: "canvas" });
  const L = A.months, lab = L.map(m => m.m.slice(5) + "/" + m.m.slice(2, 4));
  c.setOption({
    animationDuration: 700, grid: { left: 48, right: 12, top: 34, bottom: 26 }, tooltip: { trigger: "axis", valueFormatter: v => fmt(v) + " SAR" },
    legend: { top: 0, textStyle: { color: "#a3adbf", fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    xAxis: { type: "category", data: lab, axisLabel: { color: "#a3adbf", fontSize: 10 }, axisLine: { lineStyle: { color: "rgba(150,170,210,.2)" } } },
    yAxis: { type: "value", axisLabel: { color: "#808a9d", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(150,170,210,.08)" } } },
    series: [
      { name: ar ? "عجز" : "Short", type: "bar", stack: "n", data: L.map(m => m.short), itemStyle: { color: "#ff5468", borderRadius: [0, 0, 5, 5] } },
      { name: ar ? "زيادة" : "Over", type: "bar", stack: "n", data: L.map(m => m.over), itemStyle: { color: "#3ed69e", borderRadius: [5, 5, 0, 0] } },
      { name: ar ? "تبديل" : "Swaps", type: "line", smooth: true, symbol: "circle", symbolSize: 6, data: L.map(m => m.swap), lineStyle: { color: "#ffb547", width: 2 }, itemStyle: { color: "#ffb547" } },
      { name: ar ? "الصافي" : "Net", type: "line", data: L.map(m => m.net), lineStyle: { color: "#fff", width: 2, type: "dashed" }, itemStyle: { color: "#fff" }, symbolSize: 5 }
    ]
  });
  new ResizeObserver(() => { if (!c.isDisposed()) c.resize(); }).observe(el);
}
