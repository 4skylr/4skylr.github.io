#!/usr/bin/env python3
"""Rebuild unaizah/ledger.json from the DCS workbooks in unaizah/files/.

Each DCS workbook holds one sheet per business day. A sheet has a header row
that starts with "User", one row per cashier, then a totals row. Column names
drift between months, so they are mapped onto one fixed set of tenders here.

Run:  python3 noir-stock/unaizah/build.py
"""
import datetime as dt
import glob
import json
import os
import re
from collections import defaultdict

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = os.path.join(HERE, "files")
OUT = os.path.join(HERE, "ledger.json")

TENDERS = ["cash", "card", "online", "prepaid", "voucher", "other", "jahez", "hunger", "bogo", "comp"]
FIELDS = TENDERS + ["total", "report", "excess", "shortage"]
MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def column_key(name):
    n = re.sub(r"\s+", " ", str(name)).strip().lower()
    if n in ("", "nan"):
        return None
    rules = [
        ("as per report", "report"), ("excess", "excess"), ("shortage", "shortage"),
        ("credit", "card"), ("online", "online"), ("pre-paid", "prepaid"), ("prepaid", "prepaid"),
        ("voucher", "voucher"), ("jahez", "jahez"), ("hunger", "hunger"),
        ("buy one", "bogo"), ("bogo", "bogo"), ("comp", "comp"),
        ("lucky seat", "other"), ("found", "other"), ("other", "other"),
        ("cash", "cash"), ("total", "total"),
    ]
    for needle, key in rules:
        if needle in n:
            return key
    return None


ALIASES = {"waleed alotaibi": "Waleed Hammed Alotaibi", "ghonim alghonim": "Ghonim Abdulrahman Alghonim",
           "walid alanaz": "Walid Alanazi", "mohamed alrouqyi": "Mohamed Fahad Alrouqayi", "unpunch": "Unpunched"}


def name_key(name):
    t = re.sub(r"[^a-z ]", "", name.lower()).split()
    return (t[0], t[1][:5]) if len(t) > 1 else tuple(t)


def unify_names(days):
    """Cashier names are typed by hand each day; fold truncated spellings into one name."""
    groups = defaultdict(lambda: defaultdict(int))
    for day in days:
        for c in day["cashiers"]:
            groups[name_key(ALIASES.get(c["user"].lower(), c["user"]))][c["user"]] += 1
    best = {}
    for key, names in groups.items():
        top = max(names.values())
        pick = max((n for n, k in names.items() if k >= top * 0.25), key=len)
        pick = re.sub(r"[^A-Za-z ]", "", pick).strip()
        for n in names:
            best[n] = pick
    for day in days:
        merged = {}
        for c in day["cashiers"]:
            u = ALIASES.get(c["user"].lower(), best[c["user"]])
            if u in merged:
                for k in FIELDS:
                    merged[u][k] = round(merged[u][k] + c[k], 2)
            else:
                merged[u] = {**c, "user": u}
        day["cashiers"] = list(merged.values())


def num(v):
    try:
        f = float(v)
        return 0.0 if f != f else f
    except (TypeError, ValueError):
        return 0.0


def sheet_date(name):
    m = re.match(r"^\s*(\d{1,2})\s*[._-]+\s*(\d{1,2})\s*[._-]+\s*(\d{2,4})\s*$", str(name))
    if not m:
        return None
    d, mo, y = (int(x) for x in m.groups())
    if y < 100:
        y += 2000
    if y == 205:
        y = 2025
    try:
        return dt.date(y, mo, d)
    except ValueError:
        return None


def file_month(path):
    """(year, month) the workbook is named for, e.g. '9 DCS - Sep 2025' -> (2025, 9)."""
    base = os.path.basename(path).lower()
    y = re.search(r"20\d\d", base)
    year = int(y.group()) if y else int(os.path.basename(os.path.dirname(path)))
    for word, idx in MONTHS.items():
        if re.search(word, base):
            return year, idx
    return year, None


def parse_sheet(df):
    hdr = None
    for i in range(min(12, len(df))):
        if str(df.iat[i, 0]).strip().lower() == "user":
            hdr = i
            break
    if hdr is None:
        return None
    cols = {}
    for j, v in enumerate(df.iloc[hdr]):
        k = column_key(v)
        if k and j > 0:
            cols.setdefault(k, []).append(j)
    cashiers = []
    for i in range(hdr + 1, len(df)):
        user = df.iat[i, 0]
        if pd.isna(user) or str(user).strip() == "":
            break
        row = {"user": re.sub(r"\s+", " ", str(user)).strip().title()}
        for k in FIELDS:
            row[k] = round(sum(num(df.iat[i, j]) for j in cols.get(k, [])), 2)
        if row["user"].lower().startswith("denomination"):
            break
        cashiers.append(row)
    return cashiers


def main():
    days = {}
    for path in sorted(glob.glob(os.path.join(FILES, "*", "*")) + glob.glob(os.path.join(FILES, "*.*"))):
        if not re.search(r"\.(xlsx|xls|ods)$", path, re.I):
            continue
        fy, fm = file_month(path)
        book = pd.read_excel(path, sheet_name=None, header=None)
        prev = None
        for name, df in book.items():
            cashiers = parse_sheet(df)
            if not cashiers:
                continue
            d = sheet_date(name)
            # Sheet names carry typos (05.06 inside February, 31-9 inside August).
            # Trust the name when it moves forward by a few days; otherwise take the next day.
            if prev and (d is None or not (0 < (d - prev).days <= 3)):
                d = prev + dt.timedelta(days=1)
            if d is None:
                continue
            prev = d
            own = fm is not None and (d.year, d.month) == (fy, fm)
            rank = (own, os.path.getmtime(path), path)
            if d.isoformat() in days and days[d.isoformat()]["_rank"] >= rank:
                continue
            tot = {k: round(sum(c[k] for c in cashiers), 2) for k in FIELDS}
            # The "Total" column is collected money; rebuild it when the sheet left it blank.
            if not tot["total"]:
                tot["total"] = round(sum(tot[t] for t in TENDERS), 2)
            days[d.isoformat()] = {
                "date": d.isoformat(), **tot,
                "cashiers": [c for c in cashiers if any(c[k] for k in FIELDS)],
                "source": os.path.relpath(path, HERE), "_rank": rank,
            }

    out_days = []
    for k in sorted(days):
        day = days[k]
        day.pop("_rank")
        out_days.append(day)

    unify_names(out_days)
    for day in out_days:  # keep the file small: cashier rows carry only non-zero fields
        day["cashiers"] = [{k: v for k, v in c.items() if k == "user" or v} for c in day["cashiers"]]
    # Calendar days between the first and last sheet that no workbook covers.
    have = {d["date"] for d in out_days}
    first, last = dt.date.fromisoformat(out_days[0]["date"]), dt.date.fromisoformat(out_days[-1]["date"])
    missing = [(first + dt.timedelta(n)).isoformat() for n in range((last - first).days + 1)
               if (first + dt.timedelta(n)).isoformat() not in have]

    json.dump({
        "branch": "Unaizah", "currency": "SAR", "built": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "tenders": TENDERS, "missing_days": missing, "days": out_days,
    }, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out_days)} days ({out_days[0]['date']} → {out_days[-1]['date']}), {len(missing)} days without a sheet → {OUT}")


if __name__ == "__main__":
    main()
