#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LexiMind - Akıllı İngilizce Kelime Defteri & Öğrenme Stüdyosu
Masaüstü Uygulama Sunucusu, Çok Katmanlı Güvenilir Sözlük Motoru ve Simge Üreticisi
"""

import http.server
import json
import math
import os
import re
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
import zlib
from datetime import datetime
from pathlib import Path

# Windows konsolunda UTF-8 / IPA fonetik karakter hatalarını önle
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
BACKUPS_DIR = DATA_DIR / "backups"
ASSETS_DIR = BASE_DIR / "assets"
DATA_FILE = DATA_DIR / "kelime_defteri_yedek.json"

DATA_DIR.mkdir(exist_ok=True)
BACKUPS_DIR.mkdir(exist_ok=True)
ASSETS_DIR.mkdir(exist_ok=True)


def ensure_app_icons():
    """
    Uygulama için modern vektörel (SVG), PNG ve çoklu çözünürlüklü Windows (.ICO)
    simgelerini otomatik oluşturur.
    """
    svg_path = ASSETS_DIR / "icon.svg"
    ico_path = ASSETS_DIR / "icon.ico"
    png_path = ASSETS_DIR / "icon.png"

    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="50%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e0e7ff"/>
    </linearGradient>
  </defs>
  <rect x="12" y="12" width="232" height="232" rx="56" fill="url(#bg)"/>
  <rect x="68" y="46" width="132" height="156" rx="20" transform="rotate(8 134 124)" fill="rgba(255,255,255,0.25)"/>
  <rect x="52" y="52" width="136" height="158" rx="20" fill="url(#card)"/>
  <circle cx="74" cy="82" r="6" fill="#4f46e5"/>
  <circle cx="74" cy="116" r="6" fill="#4f46e5"/>
  <circle cx="74" cy="150" r="6" fill="#4f46e5"/>
  <circle cx="74" cy="184" r="6" fill="#4f46e5"/>
  <path d="M102 88 V162 H152" stroke="#4f46e5" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="184" cy="184" r="36" fill="#10b981"/>
  <path d="M168 184 L179 195 L202 172" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>"""

    if not svg_path.exists():
        svg_path.write_text(svg_content, encoding="utf-8")

    if ico_path.exists() and png_path.exists():
        return

    def make_png(size: int) -> bytes:
        width = height = size
        raw_rows = []
        cx, cy = size / 2.0, size / 2.0
        r_outer = size * 0.45
        r_corner = size * 0.22

        for y in range(height):
            row = bytearray([0])
            for x in range(width):
                dx = max(abs(x - cx) - (r_outer - r_corner), 0.0)
                dy = max(abs(y - cy) - (r_outer - r_corner), 0.0)
                dist = math.hypot(dx, dy)
                if dist > r_corner + 0.8:
                    row.extend((0, 0, 0, 0))
                    continue
                alpha = 255 if dist <= r_corner - 0.5 else int(255 * (r_corner + 0.8 - dist) / 1.3)

                t = (x + y) / (2.0 * size)
                r = int(79 * (1 - t) + 236 * t)
                g = int(70 * (1 - t) + 72 * t)
                b = int(229 * (1 - t) + 153 * t)

                nx, ny = x / size, y / size
                if 0.22 <= nx <= 0.74 and 0.20 <= ny <= 0.80:
                    r, g, b = 248, 250, 255
                    for hy in (0.32, 0.46, 0.60, 0.72):
                        if math.hypot(nx - 0.29, ny - hy) < 0.028:
                            r, g, b = 79, 70, 229
                    if (0.39 <= nx <= 0.45 and 0.33 <= ny <= 0.65) or (0.39 <= nx <= 0.62 and 0.59 <= ny <= 0.65):
                        r, g, b = 79, 70, 229

                if math.hypot(nx - 0.72, ny - 0.72) <= 0.16:
                    r, g, b = 16, 185, 129
                    if abs((nx - 0.69) - (ny - 0.72)) < 0.025 and 0.65 <= nx <= 0.70 and 0.70 <= ny <= 0.76:
                        r, g, b = 255, 255, 255
                    elif abs((nx - 0.70) + (ny - 0.76)) < 0.025 and 0.70 <= nx <= 0.79 and 0.66 <= ny <= 0.76:
                        r, g, b = 255, 255, 255

                row.extend((r, g, b, alpha))
            raw_rows.append(bytes(row))

        raw = b"".join(raw_rows)

        def chunk(tag: bytes, data: bytes) -> bytes:
            return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
        return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")

    png_256 = make_png(256)
    png_64 = make_png(64)
    png_32 = make_png(32)
    png_16 = make_png(16)
    png_path.write_bytes(png_256)

    images = [(16, png_16), (32, png_32), (64, png_64), (0, png_256)]
    ico_header = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries = []
    data_blobs = []
    for sz, blob in images:
        entries.append(struct.pack("<BBBBHHII", sz, sz, 0, 0, 1, 32, len(blob), offset))
        data_blobs.append(blob)
        offset += len(blob)

    ico_path.write_bytes(ico_header + b"".join(entries) + b"".join(data_blobs))


def fetch_json(url: str, timeout: float = 4.5):
    """Yardımcı HTTP JSON çekici."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


# Akademik olmayan argo / sokak ağzı / aşırı nadir arkaik eş anlamlılar filtresi
SLANG_SYNONYM_BLACKLIST = {
    "bitch", "bellyache", "beef", "grouch", "sound off", "monkey business",
    "funny business", "hanky-panky", "jiggery-pokery", "crookedness",
    "off beam", "bogus", "phoney", "phony", "way out", "out", "on the trot",
    "spooky", "scary", "creepy", "gobbet", "divvy up", "tubbiness",
    "pudginess", "podginess", "claggy", "swanky", "bestrew", "besprinkle",
    "commination", "contumely", "disannul", "disfeature", "betake oneself",
    "abstract oneself", "by the book", "legit", "off-the-cuff", "devoir",
}


def extract_headword(term: str) -> str:
    """
    'susceptible to', 'indifferent to', 'content with' gibi edatlı ifadelerden
    ana kök kelimeyi ('susceptible', 'indifferent', 'content') ayıklar.
    """
    cleaned = term.strip()
    m = re.match(
        r"^([a-zA-Z\-]+)\s+(to|with|of|in|on|for|from|at|about|by|into|over|against|upon)$",
        cleaned,
        re.IGNORECASE,
    )
    if m:
        return m.group(1)
    return cleaned


def filter_academic_synonyms(synonyms: list, query_word: str = "") -> list:
    """Argo ve gürültülü ifadeleri eleyip temiz akademik eş anlamlıları döndürür."""
    q_low = query_word.strip().lower()
    head_low = extract_headword(q_low).lower()
    clean_list = []
    seen = set()
    for s in synonyms:
        if not isinstance(s, str):
            continue
        s_clean = s.strip()
        s_low = s_clean.lower()
        if not s_clean or s_low in seen or s_low == q_low or s_low == head_low:
            continue
        if s_low in SLANG_SYNONYM_BLACKLIST:
            continue
        # 3 kelimeden uzun açıklamalı deyimleri eş anlamlı listesinden çıkar
        if len(s_clean.split()) > 2:
            continue
        seen.add(s_low)
        clean_list.append(s_clean)
    return clean_list[:8]


def translate_and_analyze_gtx(text: str, source_lang: str = "en", target_lang: str = "tr") -> dict:
    """
    Katman 1: Google Oxford/GTX Yapılandırılmış Sözlük Servisi (dj=1).
    Birincil çeviri, kelime türlerine göre Türkçe alternatifler, fonetik okunuş,
    İngilizce sözlük tanımları (gloss), örnek cümleler ve eş anlamlıları tek seferde getirir.
    """
    result = {
        "primary": "",
        "combinedMeaning": "",
        "phonetic": "",
        "pos": "",
        "alternatives": [],
        "definitions": [],
        "synonyms": [],
        "examples": [],
    }
    try:
        q = urllib.parse.quote(text.strip())
        url = (
            f"https://translate.googleapis.com/translate_a/single"
            f"?client=gtx&sl={source_lang}&tl={target_lang}"
            f"&dt=t&dt=bd&dt=ex&dt=md&dt=ss&dt=rm&dj=1&q={q}"
        )
        data = fetch_json(url, timeout=4.5)
        if isinstance(data, dict):
            # 1. Ana çeviri ve fonetik (translit)
            parts = []
            for s in data.get("sentences", []):
                if isinstance(s, dict):
                    if s.get("trans"):
                        parts.append(s["trans"])
                    if s.get("src_translit") and not result["phonetic"]:
                        result["phonetic"] = f"/{s['src_translit'].strip('/')}/"
            result["primary"] = "".join(parts).strip()

            # 2. Kelime türüne göre Türkçe sözlük anlamları (dict)
            for d_entry in data.get("dict", []):
                if isinstance(d_entry, dict):
                    pos_name = d_entry.get("pos", "")
                    terms = [t for t in d_entry.get("terms", []) if isinstance(t, str) and t.strip()]
                    if terms:
                        if not result["pos"] and pos_name:
                            result["pos"] = pos_name
                        result["alternatives"].append({
                            "pos": pos_name or "kelime",
                            "meanings": terms[:8],
                        })

            # Birincil anlam ile sözlükteki en güçlü 3 anlamı tekilleştirerek birleştir
            combined = []
            if result["primary"]:
                combined.append(result["primary"])
            if result["alternatives"]:
                for m in result["alternatives"][0].get("meanings", [])[:4]:
                    if m.lower() not in [c.lower() for c in combined]:
                        combined.append(m)
            result["combinedMeaning"] = ", ".join(combined[:4]) if combined else result["primary"]

            # 3. İngilizce Sözlük Tanımları (definitions)
            for def_group in data.get("definitions", []):
                if isinstance(def_group, dict):
                    pos_label = def_group.get("pos", "")
                    if not result["pos"] and pos_label:
                        result["pos"] = pos_label
                    for entry in def_group.get("entry", [])[:3]:
                        if isinstance(entry, dict):
                            gloss = entry.get("gloss", "")
                            ex = entry.get("example", "")
                            if gloss:
                                result["definitions"].append({
                                    "pos": pos_label,
                                    "definition": gloss,
                                    "example": ex,
                                })
                            if ex and ex not in result["examples"]:
                                result["examples"].append(ex)

            # 4. Ek Örnek Cümleler (examples)
            ex_obj = data.get("examples", {})
            if isinstance(ex_obj, dict):
                for ex_item in ex_obj.get("example", [])[:5]:
                    if isinstance(ex_item, dict) and ex_item.get("text"):
                        clean_ex = re.sub(r"<[^>]+>", "", ex_item["text"]).strip()
                        if clean_ex and clean_ex not in result["examples"]:
                            result["examples"].append(clean_ex)

            # 5. Eş Anlamlılar (synsets) - Argo filtresinden geçirilmiş
            syns = []
            for syn_group in data.get("synsets", []):
                if isinstance(syn_group, dict):
                    for entry in syn_group.get("entry", []):
                        if isinstance(entry, dict):
                            for s in entry.get("synonym", []):
                                if isinstance(s, str) and s not in syns:
                                    syns.append(s)
            result["synonyms"] = filter_academic_synonyms(syns, text)
    except Exception:
        pass

    # Katman 3 Yedek Çeviri: MyMemory API
    if not result["primary"]:
        try:
            q = urllib.parse.quote(text.strip())
            mm_url = f"https://api.mymemory.translated.net/get?q={q}&langpair={source_lang}|{target_lang}"
            mm_data = fetch_json(mm_url, timeout=4.0)
            if isinstance(mm_data, dict):
                translated = mm_data.get("responseData", {}).get("translatedText", "")
                if translated:
                    result["primary"] = translated.strip()
                    result["combinedMeaning"] = result["primary"]
        except Exception:
            pass

    return result


def lookup_datamuse_and_wiktionary(word: str) -> dict:
    """
    Katman 2: Datamuse Lexical API & WordNet üzerinden akademik eş anlamlılar,
    zıt anlamlılar (antonyms), ek tanımlar ve telaffuz verilerini tamamlar.
    """
    extra = {
        "phonetic": "",
        "pos": "",
        "definitions": [],
        "synonyms": [],
        "antonyms": [],
        "audio": "",
    }
    clean = extract_headword(word).strip().lower()
    if not clean:
        return extra

    # Oxford Google Dictionary ses dosyası (kök kelime için)
    if " " not in clean and clean.isalpha():
        extra["audio"] = f"https://ssl.gstatic.com/dictionary/static/sounds/oxford/{clean}--_us_1.mp3"

    pos_map = {"n": "noun", "v": "verb", "adj": "adjective", "adv": "adverb"}

    try:
        q = urllib.parse.quote(clean)
        dm_data = fetch_json(f"https://api.datamuse.com/words?sp={q}&qe=sp&md=dprf&max=1", timeout=3.5)
        if isinstance(dm_data, list) and len(dm_data) > 0:
            item = dm_data[0]
            for tag in item.get("tags", []):
                if tag in pos_map and not extra["pos"]:
                    extra["pos"] = pos_map[tag]
            for d in item.get("defs", [])[:4]:
                if "\t" in d:
                    p_code, d_text = d.split("\t", 1)
                    extra["definitions"].append({
                        "pos": pos_map.get(p_code, p_code),
                        "definition": d_text,
                        "example": "",
                    })
    except Exception:
        pass

    # WordNet Akademik Eş Anlamlılar (rel_syn) ve Zıt Anlamlılar (rel_ant)
    if " " not in clean:
        try:
            q = urllib.parse.quote(clean)
            syn_data = fetch_json(f"https://api.datamuse.com/words?rel_syn={q}&max=8", timeout=2.5)
            if isinstance(syn_data, list):
                extra["synonyms"] = filter_academic_synonyms(
                    [s["word"] for s in syn_data if isinstance(s, dict) and s.get("word")],
                    clean,
                )
        except Exception:
            pass
        try:
            q = urllib.parse.quote(clean)
            ant_data = fetch_json(f"https://api.datamuse.com/words?rel_ant={q}&max=6", timeout=2.5)
            if isinstance(ant_data, list):
                extra["antonyms"] = [a["word"] for a in ant_data if isinstance(a, dict) and a.get("word")]
        except Exception:
            pass

    return extra


def get_browser_candidates():
    return [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
    ]


def render_html_to_pdf_bytes(html_content: str) -> bytes:
    """
    Verilen HTML dokümanını sistemdeki Chromium/Edge motoruyla
    vektörel, yüksek çözünürlüklü ve tam Türkçe/IPA fonetik destekli PDF'e dönüştürür.
    """
    for exe in get_browser_candidates():
        if os.path.exists(exe):
            try:
                with tempfile.TemporaryDirectory() as td:
                    td_path = Path(td)
                    html_file = td_path / "export_document.html"
                    pdf_file = td_path / "export_document.pdf"
                    html_file.write_text(html_content, encoding="utf-8")

                    cmd = [
                        exe,
                        "--headless=new",
                        "--disable-gpu",
                        "--no-pdf-header-footer",
                        "--print-to-pdf-no-header",
                        f"--print-to-pdf={pdf_file}",
                        html_file.as_uri(),
                    ]
                    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
                    subprocess.run(
                        cmd,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=20,
                        check=False,
                        creationflags=creationflags,
                    )
                    if pdf_file.exists() and pdf_file.stat().st_size > 500:
                        return pdf_file.read_bytes()
            except Exception:
                continue
    raise RuntimeError("PDF motoru bulunamadi.")


class LexiMindRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Yerel masaüstü HTTP sunucusu ve API yönlendiricisi."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()

    def _send_json(self, payload: dict, status: int = 200):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/ping":
            return self._send_json({"ok": True, "mode": "desktop-python"})

        if parsed.path == "/api/storage":
            if DATA_FILE.exists():
                try:
                    content = json.loads(DATA_FILE.read_text(encoding="utf-8"))
                    return self._send_json({"ok": True, "data": content})
                except Exception as exc:
                    return self._send_json({"ok": False, "error": str(exc)}, 500)
            return self._send_json({"ok": True, "data": None})

        if parsed.path == "/api/backups":
            files = sorted(BACKUPS_DIR.glob("kelime_defteri_*.json"), reverse=True)
            items = [
                {
                    "name": f.name,
                    "size": f.stat().st_size,
                    "modified": datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M"),
                }
                for f in files[:15]
            ]
            return self._send_json({"ok": True, "backups": items})

        if parsed.path == "/api/dictionary":
            params = urllib.parse.parse_qs(parsed.query)
            query = (params.get("q", [""])[0] or "").strip()
            direction = (params.get("dir", ["en-tr"])[0] or "en-tr").strip()
            if not query:
                return self._send_json({"ok": False, "error": "Sorgu boş olamaz."}, 400)

            if direction == "tr-en":
                tr_to_en = translate_and_analyze_gtx(query, "tr", "en")
                en_word = tr_to_en.get("primary") or query
                en_gtx = translate_and_analyze_gtx(en_word, "en", "tr")
                dm_extra = lookup_datamuse_and_wiktionary(en_word)

                example_tr = ""
                examples = en_gtx.get("examples") or []
                if examples:
                    ex_t = translate_and_analyze_gtx(examples[0], "en", "tr")
                    example_tr = ex_t.get("primary", "")

                merged_syns = filter_academic_synonyms(
                    (dm_extra.get("synonyms") or []) + (en_gtx.get("synonyms") or []),
                    en_word,
                )

                return self._send_json({
                    "ok": True,
                    "query": query,
                    "direction": direction,
                    "translation": {
                        "primary": en_word,
                        "combinedMeaning": query,
                        "alternatives": tr_to_en.get("alternatives") or en_gtx.get("alternatives") or [],
                    },
                    "englishDetails": {
                        "word": en_word,
                        "phonetic": en_gtx.get("phonetic") or dm_extra.get("phonetic") or "",
                        "pos": en_gtx.get("pos") or dm_extra.get("pos") or "noun",
                        "audio": dm_extra.get("audio") or "",
                        "definitions": en_gtx.get("definitions") or dm_extra.get("definitions") or [],
                        "synonyms": merged_syns,
                        "antonyms": dm_extra.get("antonyms") or [],
                        "examples": examples,
                    },
                    "exampleTranslation": example_tr,
                })
            else:
                gtx_res = {}
                head_gtx_res = {}
                dm_res = {}
                headword = extract_headword(query)

                def task_gtx():
                    nonlocal gtx_res
                    gtx_res = translate_and_analyze_gtx(query, "en", "tr")

                def task_head_gtx():
                    nonlocal head_gtx_res
                    if headword.lower() != query.lower():
                        head_gtx_res = translate_and_analyze_gtx(headword, "en", "tr")

                def task_dm():
                    nonlocal dm_res
                    dm_res = lookup_datamuse_and_wiktionary(headword)

                t1 = threading.Thread(target=task_gtx)
                t2 = threading.Thread(target=task_dm)
                t3 = threading.Thread(target=task_head_gtx)
                t1.start()
                t2.start()
                t3.start()
                t1.join(timeout=5.0)
                t2.join(timeout=5.0)
                t3.join(timeout=5.0)

                examples = gtx_res.get("examples") or head_gtx_res.get("examples") or []
                example_tr = ""
                if examples:
                    ex_trans = translate_and_analyze_gtx(examples[0], "en", "tr")
                    example_tr = ex_trans.get("primary", "")

                # Önce Datamuse WordNet akademik eş anlamlılarını, ardından filtrelenmiş GTX eş anlamlılarını birleştir
                merged_syns = filter_academic_synonyms(
                    (dm_res.get("synonyms") or [])
                    + (gtx_res.get("synonyms") or [])
                    + (head_gtx_res.get("synonyms") or []),
                    query,
                )

                return self._send_json({
                    "ok": True,
                    "query": query,
                    "direction": direction,
                    "translation": {
                        "primary": gtx_res.get("combinedMeaning") or gtx_res.get("primary") or head_gtx_res.get("combinedMeaning") or "",
                        "alternatives": gtx_res.get("alternatives") or head_gtx_res.get("alternatives") or [],
                    },
                    "englishDetails": {
                        "word": query,
                        "phonetic": gtx_res.get("phonetic") or head_gtx_res.get("phonetic") or dm_res.get("phonetic") or "",
                        "pos": gtx_res.get("pos") or head_gtx_res.get("pos") or dm_res.get("pos") or "noun",
                        "audio": dm_res.get("audio") or "",
                        "definitions": gtx_res.get("definitions") or head_gtx_res.get("definitions") or dm_res.get("definitions") or [],
                        "synonyms": merged_syns,
                        "antonyms": dm_res.get("antonyms") or [],
                        "examples": examples,
                    },
                    "exampleTranslation": example_tr,
                })

        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/storage":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length).decode("utf-8")
                data = json.loads(body)
                formatted_json = json.dumps(data, ensure_ascii=False, indent=2)
                DATA_FILE.write_text(formatted_json, encoding="utf-8")

                # Otomatik günlük yedek rotasyonu (son 15 günü data/backups/ içinde saklar)
                try:
                    today_str = datetime.now().strftime("%Y-%m-%d")
                    daily_backup = BACKUPS_DIR / f"kelime_defteri_{today_str}.json"
                    daily_backup.write_text(formatted_json, encoding="utf-8")
                    old_backups = sorted(BACKUPS_DIR.glob("kelime_defteri_*.json"), reverse=True)
                    for old_f in old_backups[15:]:
                        old_f.unlink(missing_ok=True)
                except Exception:
                    pass

                return self._send_json({"ok": True, "savedAt": str(DATA_FILE)})
            except Exception as exc:
                return self._send_json({"ok": False, "error": str(exc)}, 500)

        if parsed.path == "/api/export-pdf":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length).decode("utf-8")
                payload = json.loads(body)
                html_doc = payload.get("html", "")
                if not html_doc:
                    return self._send_json({"ok": False, "error": "HTML icerigi bos."}, 400)
                pdf_bytes = render_html_to_pdf_bytes(html_doc)
                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header("Content-Length", str(len(pdf_bytes)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(pdf_bytes)
                return
            except Exception as exc:
                return self._send_json({"ok": False, "error": str(exc)}, 500)

        self.send_error(404, "Bulunamadı")


def find_free_port(preferred: int = 8765) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", preferred)) != 0:
            return preferred
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def open_desktop_window(url: str):
    """
    Sistemdeki Chromium tabanlı tarayıcılardan birini kullanarak adres çubuksuz,
    bağımsız bir Masaüstü Uygulama Penceresi (--app modu) açar.
    """
    profile_dir = DATA_DIR / "desktop_window_profile"
    profile_dir.mkdir(exist_ok=True)

    candidates = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        os.path.expandvars(r"%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"),
        # macOS ve Linux desteği
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
    ]

    for exe in candidates:
        if os.path.exists(exe):
            try:
                proc = subprocess.Popen(
                    [
                        exe,
                        f"--app={url}",
                        f"--user-data-dir={profile_dir}",
                        "--window-size=1360,860",
                        "--new-window",
                        "--no-first-run",
                        "--no-default-browser-check",
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return proc
            except Exception:
                pass

    try:
        if hasattr(os, "startfile"):
            os.startfile(url)
        else:
            webbrowser.open(url)
    except Exception:
        webbrowser.open(url)
    return None


def is_already_running(port: int = 8765) -> bool:
    try:
        data = fetch_json(f"http://127.0.0.1:{port}/api/ping", timeout=0.8)
        return bool(data and data.get("ok"))
    except Exception:
        return False


def main():
    ensure_app_icons()
    preferred_port = 8765
    if is_already_running(preferred_port):
        url = f"http://127.0.0.1:{preferred_port}"
        print(f"LexiMind sunucusu zaten aktif: {url}")
        print("Masaustu penceresi aciliyor...")
        if "--no-window" not in sys.argv:
            open_desktop_window(url)
        return

    port = find_free_port(preferred_port)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), LexiMindRequestHandler)
    url = f"http://127.0.0.1:{port}"

    print("=" * 62)
    print("  LexiMind - Akilli Ingilizce Kelime Defteri & Ogrenme Studyosu")
    print(f"  Calisma Adresi : {url}")
    print(f"  Yedek Dosyasi  : {DATA_FILE}")
    print("  Bu pencere acik kaldigi surece canli sozluk ve otomatik yedekleme aktiftir.")
    print("=" * 62)

    if "--no-window" not in sys.argv:
        threading.Timer(0.3, lambda: open_desktop_window(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nUygulama kapatiliyor...")
        server.server_close()


if __name__ == "__main__":
    main()
