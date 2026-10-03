// CSV from Papa Parse (github.com/mholt/PapaParse).
export async function downloadCountCsv(rows, name) {
  await new Promise((res, rej) => {
    if (window.Papa) return res();
    const s = document.createElement("script"); s.src = "vendor/papaparse.min.js"; s.onload = res; s.onerror = rej;
    document.head.append(s);
  });
  const csv = window.Papa.unparse(rows);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
}
