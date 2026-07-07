# -*- coding: utf-8 -*-
"""把 CDC 鏡像的 WHO LMS CSV（0-24 月）轉成 065 App 用的 JS 資料模組，並驗證 LMS 公式。
來源：CDC/NCHS growthcharts（WHO Child Growth Standards）。公開國際標準，個人 App 使用。
"""
import csv, json, math, os

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = r"C:\Users\USER\Projects\065.cdi-vocab-tracker\js\growth-standards.js"

FILES = {
    "weight": {"boys": "wfa_boys.csv", "girls": "wfa_girls.csv", "unit": "kg", "name": "體重"},
    "length": {"boys": "lfa_boys.csv", "girls": "lfa_girls.csv", "unit": "cm", "name": "身長/身高"},
    "head":   {"boys": "hcfa_boys.csv", "girls": "hcfa_girls.csv", "unit": "cm", "name": "頭圍"},
}

def read_lms(path):
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            rows.append({
                "m": int(r["Month"]),
                "L": float(r["L"]),
                "M": float(r["M"]),
                "S": float(r["S"]),
                "_p2": float(r["2nd (2.3rd)"]),   # 供驗證用
                "_p50": float(r["50th"]),
            })
    return rows

def value_at_z(L, M, S, z):
    if abs(L) < 1e-9:
        return M * math.exp(S * z)
    return M * (1 + L * S * z) ** (1.0 / L)

# 驗證：50th 應=M；2nd(2.3rd) 應≈ value_at_z(z=-2)
max_err = 0.0
for ind, cfg in FILES.items():
    for sex in ("boys", "girls"):
        for row in read_lms(os.path.join(SRC, cfg[sex])):
            assert abs(row["_p50"] - row["M"]) < 1e-3, f"{ind} {sex} m{row['m']} 50th≠M"
            calc = value_at_z(row["L"], row["M"], row["S"], -2.0)
            err = abs(calc - row["_p2"]) / row["_p2"]
            max_err = max(max_err, err)
print(f"LMS 公式驗證：50th=M 全通過；2nd 百分位反算 vs CSV 最大相對誤差 = {max_err*100:.4f}%")

# 組 JS 資料（去掉驗證欄）
out = {"source": "WHO Child Growth Standards (0–24 months), via CDC/NCHS mirror",
       "citation": "WHO Multicentre Growth Reference Study Group (2006). WHO Child Growth Standards.",
       "indicators": {}}
for ind, cfg in FILES.items():
    out["indicators"][ind] = {"name": cfg["name"], "unit": cfg["unit"], "boys": [], "girls": []}
    for sex in ("boys", "girls"):
        for row in read_lms(os.path.join(SRC, cfg[sex])):
            out["indicators"][ind][sex].append({"m": row["m"], "L": row["L"], "M": row["M"], "S": row["S"]})

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("// WHO 生長標準 LMS 參數（0–24 月）。資料來源見 source/citation。\n")
    f.write("// 由 scratchpad/convert_growth.py 從 CDC/NCHS WHO 鏡像 CSV 產生，勿手改。\n")
    f.write("export const GROWTH_STANDARDS = ")
    f.write(json.dumps(out, ensure_ascii=False, indent=0).replace("\n", ""))
    f.write(";\n")
print(f"已輸出 {OUT}")
print(f"檔案大小約 {os.path.getsize(OUT)//1024} KB")
