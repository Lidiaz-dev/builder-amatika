"""Importe les sources Word/Excel d'Amatika vers les JSON du site.

Usage :
    python scripts/import_data.py "<dossier Amatika>"

Le dossier doit contenir : Bandes.docx, Règles.docx, Compendium.xlsx, Cartes.xlsx,
Fluff.docx et « Liste des objets de trésors et marché noir.docx ».

Génère dans src/data/ : factions.json, skills.json, rules.json, spells.json, items.json, lore.json,
et met à jour les prix de equipment.json (le reste de ce fichier est maintenu à la main).
Attention : relancer le script écrase les corrections faites à la main dans les fichiers générés.
"""
import html
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data"

STAT_KEYS = ["mou", "com", "tir", "for", "end", "agi", "att", "pv", "cmd", "svg"]
STAT_LABELS = ["Mou", "Com", "Tir", "For", "End", "Agi", "Att", "PV", "Comm", "Svg"]
TREES = {
    "general": "general", "général": "general", "générique": "general", "generique": "general",
    "force": "force", "combat": "combat", "tir": "tir",
    "érudition": "erudition", "erudition": "erudition",
    "agilité": "agilite", "agilite": "agilite", "reconnaissance": "reconnaissance",
}


def slug(s: str) -> str:
    s = s.replace("œ", "oe").replace("Œ", "Oe")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def clean(s: str) -> str:
    return re.sub(r"[ \t]+", " ", s.replace(" ", " ").replace("’", "'")).strip()


# Surlignage Word -> rareté de l'objet (même code couleur que les paquets de cartes).
HIGHLIGHT_RARITY = {None: "blanc", "darkGray": "gris", "lightGray": "gris", "green": "vert", "yellow": "jaune"}


def docx_paragraphs_rarity(path):
    """[(texte, rareté)] : la rareté vient du surlignage du premier morceau de texte du paragraphe."""
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf8")
    out = []
    for m in re.finditer(r"<w:p[ >].*?</w:p>", xml, re.S):
        p = m.group(0)
        text = html.unescape("".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", p)))
        first = next((r for r in re.findall(r"<w:r[ >].*?</w:r>", p, re.S) if "<w:t" in r), "")
        hl = re.search(r'<w:highlight w:val="([^"]+)"', first)
        out.append((text.replace(" ", " "), HIGHLIGHT_RARITY.get(hl.group(1) if hl else None, "blanc")))
    return out


def docx_paragraphs(path):
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf8")
    paras = []
    for m in re.finditer(r"<w:p[ >].*?</w:p>", xml, re.S):
        p = m.group(0)
        p = re.sub(r"<w:br(?: [^>]*)?/>", "<w:t>\n</w:t>", p)
        p = re.sub(r"<w:tab(?: [^>]*)?/>", "<w:t>\t</w:t>", p)
        text = html.unescape("".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", p)))
        paras.append(text.replace(" ", " "))
    return paras


def xlsx_sheets(path):
    """{nom de feuille: [ {colonne: valeur} par ligne ]}."""
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode("utf8"), re.S):
            shared.append(html.unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))))
    rels = {}
    for rel in re.findall(r"<Relationship [^>]*/>", z.read("xl/_rels/workbook.xml.rels").decode("utf8")):
        rels[re.search(r'Id="([^"]+)"', rel).group(1)] = re.search(r'Target="([^"]+)"', rel).group(1)
    sheets = {}
    wb = z.read("xl/workbook.xml").decode("utf8")
    for name, rid in re.findall(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', wb):
        target = rels[rid].lstrip("/")
        target = target if target.startswith("xl/") else "xl/" + target
        rows = []
        for row in re.findall(r"<row[^>]*>(.*?)</row>", z.read(target).decode("utf8"), re.S):
            cells = {}
            for ref, attrs, body in re.findall(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', row, re.S):
                v = re.search(r"<v>(.*?)</v>", body or "")
                if v:
                    val = shared[int(v.group(1))] if 't="s"' in attrs else v.group(1)
                else:
                    inline = re.findall(r"<t[^>]*>(.*?)</t>", body or "", re.S)
                    if not inline:
                        continue
                    val = "".join(inline)
                cells[ref] = clean(html.unescape(val))
            if cells:
                rows.append(cells)
        sheets[clean(html.unescape(name))] = rows
    return sheets


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ------------------------------------------------------------------- Bandes
HEADER_RE = re.compile(r"^(?:(\d+)(?:-(\d+))?\s+)?(.+?)\s*:\s*(\d+)\s*PO$")


def parse_stat(raw: str):
    raw = raw.strip()
    if raw in ("/", "-", ""):
        return None
    return int(raw.rstrip("+"))


def split_list(s: str):
    return [clean(x) for x in re.split(r"[,;]", s) if clean(x).strip(" .")]


def parse_upkeep(s: str):
    """« 2PO par niveauXP apporté : 4 par point de vie. » -> (entretien, xp apporté)."""
    xp = None
    m = re.search(r"XP apport[ée]\s*:\s*(\d+)", s, re.I)
    if m:
        xp = int(m.group(1))
        s = s[: m.start()]
    low = s.lower()
    if "cristal" in low:
        return {"po": 0, "perLevel": False, "cristaux": int(re.search(r"\d+", low).group())}, xp
    m = re.search(r"(\d+)\s*po", low)
    po = int(m.group(1)) if m else 0
    return {"po": po, "perLevel": "niveau" in low and po > 0, "cristaux": 0}, xp


def parse_skills(s: str):
    fixed, choices = [], []
    for item in split_list(s):
        item = item.strip(" .")
        if item.lower() == "aucune":
            continue
        if re.search(r"\s+OU\s+", item):
            choices.append([x.strip() for x in re.split(r"\s+OU\s+", item)])
        else:
            fixed.append(item[0].upper() + item[1:])
    return fixed, choices


def parse_equipment(s: str):
    names = []
    for chunk in s.split("-"):
        for item in split_list(chunk):
            item = item.strip(" .")
            if item:
                names.append(slug(item))
    return names


def parse_bandes(paras, hyp):
    lines = [clean(p) for p in paras]

    def is_header(k):
        return 0 <= k and k + 1 < len(lines) and HEADER_RE.match(lines[k]) and lines[k + 1] == "Mou"

    def next_nonblank(k):
        while k < len(lines) and not lines[k]:
            k += 1
        return k

    factions, current, i = [], None, 0
    while i < len(lines):
        line = lines[i]
        if is_header(i):
            mn, mx, name, cost = HEADER_RE.match(line).groups()
            if current is None:
                hyp.append(f"Bandes.docx : le premier bloc « {line} » n'a pas de faction, il est ignoré.")
                i += 21
                while i < len(lines) and not lines[i].startswith("Arbre"):
                    i += 1
                continue
            name = name.strip()
            name = name[0].upper() + name[1:]
            profile = {
                "id": slug(name), "name": name, "cost": int(cost),
                "min": int(mn) if mn is not None else None,
                "max": int(mx) if mx is not None else (int(mn) if mn is not None else None),
                "stats": dict(zip(STAT_KEYS, [parse_stat(v) for v in lines[i + 11:i + 21]])),
                "skills": [], "skillChoices": [], "equipment": [], "trees": [],
                "upkeep": {"po": 0, "perLevel": False, "cristaux": 0}, "xpValue": None, "notes": [],
            }
            j, seen_equipment = i + 21, False
            while j < len(lines) and not is_header(j):
                l = lines[j]
                if l.startswith("Compétence"):
                    profile["skills"], profile["skillChoices"] = parse_skills(l.split(":", 1)[1])
                elif l.startswith("Equipement accessible"):
                    profile["equipment"] = parse_equipment(l.split(":", 1)[1])
                    seen_equipment = True
                elif l.startswith("Entretien"):
                    profile["upkeep"], profile["xpValue"] = parse_upkeep(l.split(":", 1)[1])
                elif l.startswith("Arbre"):
                    raw = l.split(":", 1)[1].replace("tir reconnaissance", "tir, reconnaissance")
                    profile["trees"] = [TREES.get(t.lower().strip(" ."), slug(t)) for t in split_list(raw)]
                elif l and not seen_equipment:
                    profile["notes"].append(l)
                elif l:
                    break  # début de la faction suivante
                j += 1
            current["profiles"].append(profile)
            i = j
            continue
        if line and not HEADER_RE.match(line):
            k = next_nonblank(i + 1)
            if is_header(k):
                if len(line) > 40:
                    # Règle de faction placée entre le nom de la faction et son premier profil.
                    prev = i - 1
                    while prev >= 0 and not lines[prev]:
                        prev -= 1
                    current = {"id": slug(lines[prev]), "name": lines[prev], "notes": [line], "profiles": []}
                else:
                    current = {"id": slug(line), "name": line, "notes": [], "profiles": []}
                factions.append(current)
            elif len(line) <= 40 and k < len(lines) and len(lines[k]) > 40 and is_header(next_nonblank(k + 1)):
                pass  # nom de faction suivi d'une règle : traité à la ligne suivante
        i += 1
    return factions


def classify(f, p, hyp):
    """Rôle de chaque profil + hypothèses sur les données floues."""
    skills = [s.lower() for s in p["skills"]]
    if "chef" in skills:
        p["role"] = "chef"
    elif p["id"].startswith("recrue") or p["id"] == "squelette":
        p["role"] = "recrue"
    elif (p["stats"]["pv"] or 0) >= 3:
        p["role"] = "monstre"
    else:
        p["role"] = "specialiste"

    if p["min"] is None:
        if f["id"] == "necromant" and p["id"] == "vampire":
            p["min"], p["max"] = 1, 1
            hyp.append("Nécromant : le Vampire n'a pas d'effectif, il est fixé à 1 (c'est le chef).")
        else:
            p["min"], p["max"] = 0, 1
            hyp.append(f"{f['name']} / {p['name']} : pas d'effectif indiqué, fixé à 0-1.")
    if p["skillChoices"]:
        hyp.append(f"{f['name']} / {p['name']} : « {' OU '.join(p['skillChoices'][0])} » se choisit à la création.")
    if p["role"] == "specialiste" and (p["max"] or 0) > 2:
        hyp.append(f"{f['name']} / {p['name']} : spécialiste en {p['min']}-{p['max']}, conservé tel quel (à confirmer).")
    for n in p["notes"]:
        if "une seule main libre" in n:
            p["hands"] = 1
        if "obligé" in n:
            p["min"] = max(p["min"] or 0, 1)
        if "ne commence qu" in n and "seul sort" in n:
            p["startingSpells"] = 1


# ---------------------------------------------------------------- Compendium
COMPENDIUM_FACTIONS = {
    "cites-etats": "cites-etats", "nain": "nains", "orque": "orques", "gobelin": "gobelins",
    "haut-elfe": "haut-elfe", "elfe-des-bois": "elfe-des-bois", "drow": "drow", "ogre": "ogre",
    "skaven": "skaven", "drakeide": "drakeide", "mangechair": "mangechair", "la-harde": "la-harde",
    "halfling": "halfling", "tieffelin": "tieffelin", "nain-d-ashut": "nain-d-ashut", "necromant": "necromant",
    "bretonnien": "bretonniens", "cathay": "cathay", "khajiit": "khajiit", "ondin": "ondin",
}
STOP = {"du", "des", "de", "d", "la", "le", "les"}


def toks(s):
    return {t[:-1] if t.endswith("s") and len(t) > 3 else t for t in slug(s).split("-") if t not in STOP}


def match_score(pid, row_type, row_race):
    if slug(row_type) == pid:
        return 3
    want, have = toks(pid), toks(row_type) | toks(row_race)
    if want <= have:
        return 2
    if all(any(w[:4] == h[:4] for h in have) for w in want):
        return 1
    return 0


def apply_compendium(factions, rows, hyp):
    header = rows[0]
    cols = {v: k for k, v in header.items()}
    by_faction = {}
    for r in rows[1:]:
        if num(r.get(cols["Coût en PO"])) is None:
            continue
        fid = COMPENDIUM_FACTIONS.get(slug(r.get("A", "")))
        if not fid:
            hyp.append(f"Compendium : faction « {r.get('A')} » inconnue, ligne ignorée.")
            continue
        by_faction.setdefault(fid, []).append(r)

    for f in factions:
        crow = by_faction.get(f["id"], [])
        used = set()
        for p in f["profiles"]:
            scored = sorted(((match_score(p["id"], r.get("C", ""), r.get("B", "")), n) for n, r in enumerate(crow) if n not in used), reverse=True)
            if not scored or scored[0][0] == 0:
                hyp.append(f"Compendium : pas de ligne pour {f['name']} / {p['name']}, coût de Bandes.docx conservé ({p['cost']} PO).")
                continue
            n = scored[0][1]
            used.add(n)
            r = crow[n]
            cost = int(round(num(r[cols["Coût en PO"]])))
            stats = {}
            for k, col in zip(STAT_KEYS, ["Mou", "Com", "Tir", "For", "End", "Agi", "Att", "PV", "Cmd", "Svg"]):
                v = num(r.get(cols[col]))
                stats[k] = None if v is None or (k in ("tir", "com") and v >= 11) else int(v)
            # Valeurs impossibles dans le Compendium (ex. Commandement de 1) : on garde Bandes.docx.
            if stats["cmd"] is not None and stats["cmd"] < 2 and p["stats"]["cmd"] is not None:
                hyp.append(f"Compendium : Commandement {stats['cmd']} impossible pour {f['name']} / {p['name']}, "
                           f"valeur de Bandes.docx conservée ({p['stats']['cmd']}+).")
                stats["cmd"] = p["stats"]["cmd"]
            diffs = []
            if p["cost"] != cost:
                diffs.append(f"coût {p['cost']} → {cost} PO")
            for k, lbl in zip(STAT_KEYS, STAT_LABELS):
                if p["stats"][k] != stats[k]:
                    diffs.append(f"{lbl} {p['stats'][k]} → {stats[k]}")
            if diffs:
                hyp.append(f"Écart Bandes / Compendium pour {f['name']} / {p['name']} : " + ", ".join(diffs) + " (Compendium retenu).")
            p["cost"], p["stats"] = cost, stats
            if p["xpValue"] is None and num(r.get(cols["XP"])) is not None:
                p["xpValue"] = int(num(r[cols["XP"]]))
            comp_skills = [r[c] for c in "PQRST" if r.get(c) and not r[c].startswith("-")]
            p["_compSkills"] = comp_skills
        for n, r in enumerate(crow):
            if n not in used:
                hyp.append(f"Compendium : « {r.get('B')} / {r.get('C')} » ({f['name']}) sans profil dans Bandes.docx.")


# -------------------------------------------------------------------- Règles
H2 = ["Introduction", "Ce dont vous aurez besoin", "Caractéristiques de figurines", "La fiche personnage",
      "Le round", "Tour de joueur", "Moral et commandement", "Mise en place d'une partie", "Équipement commun",
      "Organiser une campagne", "Phase d'après bataille", "Les Mages et les sorts"]


def parse_rules(paras):
    sections, cur = [], None
    for raw in paras:
        t = clean(raw)
        if not t:
            continue
        title = t.rstrip(" :.").strip()
        is_heading = len(t) < 60 and (t.endswith(":") or t.rstrip(".") in H2) and "\n" not in t
        if is_heading:
            cur = {"id": slug(title), "title": title, "level": 2 if title in H2 else 3, "paragraphs": []}
            sections.append(cur)
            continue
        if cur is None:
            cur = {"id": "preambule", "title": "Préambule", "level": 2, "paragraphs": []}
            sections.append(cur)
        cur["paragraphs"].append(t)
    return sections


def parse_skills_from_rules(paras):
    cats = {"Générique": "general", "Combat": "combat", "Tir": "tir", "Erudition": "erudition",
            "Force": "force", "Agilité": "agilite", "Reconnaissance": "reconnaissance", "Divers": "divers"}
    skills, cat = [], None
    for raw in paras:
        t = clean(raw)
        head = t.rstrip(" :")
        if head in cats:
            cat = cats[head]
            continue
        if t.startswith("La fiche personnage"):
            break
        if cat and ":" in t:
            name, desc = t.split(":", 1)
            sid = slug(name)
            if not any(s["id"] == sid for s in skills):
                skills.append({"id": sid, "name": name.strip(), "tree": cat, "description": desc.strip()})
    return skills


def canonical_skill(name, canon, missing):
    m = re.match(r"^[EÉ]claireur\s*(\d+)$", name, re.I)
    if m:
        return f"Éclaireur {m.group(1)}"
    sid = slug(name)
    for cand in (sid, sid + "s", sid.rstrip("s")):
        if cand in canon:
            return canon[cand]
    missing.add(name)
    return name


# --------------------------------------------------------------------- Sorts
SPELL_FACTIONS = {
    "skaven": ["skaven"], "hauts-elfes": ["haut-elfe"], "elfes-des-bois": ["elfe-des-bois"], "drow": ["drow"],
    "tieffelin": ["tieffelin"], "mangechair": ["mangechair"], "halfling": ["halfling"], "orque": ["orques"],
    "gobelin": ["gobelins"], "gobelin-capuchard": ["gobelins"], "drakeide": ["drakeide"], "la-harde": ["la-harde"],
    "necromant": ["necromant"], "necromant-bonus": ["necromant"], "khajiit": ["khajiit"], "ondin": ["ondin"],
    "bretonniens": ["bretonniens"], "cathay": ["cathay"],
}


def parse_spells(rows, hyp):
    spells = []
    for r in rows[1:]:
        name = r.get("A")
        if not name:
            continue
        racial = r.get("G", "")
        key = slug(racial)
        spell = {
            "id": slug(name), "name": name.capitalize() if name.isupper() else name, "type": r.get("B", ""),
            "value": int(num(r["C"])) if num(r.get("C")) is not None else None,
            "range": int(num(r["D"])) if num(r.get("D")) is not None else None,
            "target": r.get("E", ""), "description": r.get("F", ""),
            "racial": racial or None,
            "factions": SPELL_FACTIONS.get(key, []) if racial and key != "tous-les-mages" else [],
            "universal": key == "tous-les-mages",
            "bonus": key.endswith("-bonus"),
        }
        if key == "gobelin-capuchard":
            spell["profiles"] = ["chaman-capuchard"]
        if racial and key not in SPELL_FACTIONS and key != "tous-les-mages":
            hyp.append(f"Sort « {name} » : race « {racial} » non reconnue.")
        if spell["type"] == "Invocation":
            st = [num(r.get(c)) for c in "HIJKLMNOPQ"]
            spell["summon"] = {k: (None if v is None or (k in ("tir", "com") and v >= 11) else int(v)) for k, v in zip(STAT_KEYS, st)}
            spell["description"] = ""
            spell["summonSkills"] = r.get("F", "")
        spells.append(spell)
    return spells


# -------------------------------------------------------------------- Objets
COMMON_IDS = {
    "dague": "dague", "baton": "baton", "marteau-massue": "marteau", "marteau-lourd-massue-lourde": "marteau-lourd",
    "hache": "hache", "hache-lourde": "hache-lourde", "epee": "epee", "epee-lourde": "epee-lourde",
    "morgenstern": "morgenstern", "fleau": "fleau", "hallebarde": "hallebarde", "lance": "lance",
    "arc-court": "arc-court", "arc": "arc", "arc-long": "arc-long", "arbalete": "arbalete", "fronde": "fronde",
    "etoiles-couteaux-et-haches-de-jet": "arme-de-jet", "arbalete-de-poing": "arbalete-de-poing",
    "sarbacane": "sarbacane", "javelot": "javelot", "pistolet": "pistolet", "arquebuse": "arquebuse",
    "armure-de-cuir": "armure-de-cuir", "armure-legere": "armure-legere", "armure-lourde": "armure-lourde",
    "armure-complete": "armure-complete", "bouclier": "bouclier", "casque": "casque",
}
PRICE_RE = re.compile(r"(\d+)\s*PO\.?\s*$")
CATEGORY_RE = re.compile(r"^(.+?)\s*\((\d+)-(\d+)-(\d+)-(\d+)\)\s*$")



# Effets des objets de trésor sur la fiche (objets portés uniquement).
# Pour Com, Tir, Agi, Comm et Svg (scores « X+ »), un bonus fait baisser le score à obtenir.
CONSUMABLE_CATEGORIES = {"fioles", "poisons", "renomme", "ustensiles"}
MELEE_CATEGORIES = {"dagues", "batons", "marteaux-et-massues", "marteaux-lourds", "haches", "haches-lourdes", "epees",
                    "epees-lourdes", "morgenstern", "fleaux", "hallebardes", "lances"}
RANGED_CATEGORIES = {"arcs-courts", "arcs", "arcs-longs", "arbaletes", "arbaletes-de-poings", "frondes",
                     "etoiles-couteaux-et-haches-de-jet", "sarbacanes", "javelots", "pistolets", "arquebuses"}
DICE_STATS = {"svg", "agi", "cmd", "com", "tir"}


def item_effects(cat_id, desc):
    # Effet tiré au dé à chaque partie : rien d'automatique.
    if cat_id in CONSUMABLE_CATEGORIES or "jette 1d10" in desc.lower():
        return {}, []
    d = desc.lower().replace("’", "'")
    mods = {}

    def add(stat, value):
        v = -value if stat in DICE_STATS else value
        mods[stat] = mods.get(stat, 0) + v

    N = r"([+-]\d+)"
    for m in re.finditer(N + r" à la sauvegarde(?: d'armure)?(?!\s*(?:adverse|ennemie))", d):
        add("svg", int(m.group(1)))
    for m in re.finditer(N + r" en armure", d):
        add("svg", int(m.group(1)))
    for m in re.finditer(N + r" (?:au|en) mouvement", d):
        add("mou", int(m.group(1)))
    for m in re.finditer(N + r" en force", d):
        add("for", int(m.group(1)))
    for m in re.finditer(N + r" en endurance", d):
        add("end", int(m.group(1)))
    for m in re.finditer(N + r" en agilité", d):
        add("agi", int(m.group(1)))
    for m in re.finditer(N + r" en commandement(?! si)", d):
        add("cmd", int(m.group(1)))
    for m in re.finditer(N + r" en combat", d):
        add("com", int(m.group(1)))
    for m in re.finditer(N + r" en tir", d):
        add("tir", int(m.group(1)))
    for m in re.finditer(N + r" pour toucher au tir et au corps à corps", d):
        add("tir", int(m.group(1)))
        add("com", int(m.group(1)))
    for m in re.finditer(N + r" pour toucher au corps à corps", d):
        add("com", int(m.group(1)))
    for m in re.finditer(N + r" pour toucher au tir(?! et)", d):
        add("tir", int(m.group(1)))
    # « +1 pour toucher » sans précision : s'applique à l'arme elle-même.
    for m in re.finditer(N + r" pour toucher(?! au)(?! et)(?! le)(?! les)", d):
        if cat_id in MELEE_CATEGORIES:
            add("com", int(m.group(1)))
        elif cat_id in RANGED_CATEGORIES:
            add("tir", int(m.group(1)))
    for m in re.finditer(N + r" attaques?", d):
        add("att", int(m.group(1)))
    mods = {k: v for k, v in mods.items() if v}

    skills = []
    for m in re.finditer(r"gagne (?:les compétences|la compétence|les règles spéciales|la règle spéciale|la règle|les règles)\s*:?\s*((?:«[^»]+»[\s,et]*)+)", desc):
        raw = re.sub(r"[«»]", ",", m.group(1))
        skills += [clean(x).strip(" .") for x in re.split(r",|\s+et\s+", raw) if clean(x).strip(" .")]
    for m in re.finditer(r"gagne [ée]claireur\s*(\d+)", desc, re.I):
        skills.append(f"Éclaireur {m.group(1)}")
    if re.search(r"provoque la peur", d):
        skills.append("Peur")
    skills = [x[0].upper() + x[1:] for x in skills]
    return mods, skills


# Objets consommables : bouton « Utiliser » pendant la partie, défausse automatique après la bataille.
SINGLE_USE = {"trefle-a-4-feuilles", "outils-de-crochetage"}
USE_STATS = [("force", "for"), ("agilité", "agi"), ("commandement", "cmd"), ("armure", "svg"), ("endurance", "end"),
             ("mouvement", "mou")]


def consumable_effects(cat_id, item_id, desc):
    """(type, effet sur la fiche jusqu'à la fin de la partie, compétences, D10 d'XP gagnés)."""
    d = desc.lower()
    if cat_id == "poisons":
        return "poison", {}, [], 0
    if cat_id == "ustensiles":
        return ("single", {}, [], 0) if item_id in SINGLE_USE else (None, {}, [], 0)
    if cat_id != "fioles":
        return None, {}, [], 0
    mods = {}
    if "jusque la fin de la partie" in d:
        for word, stat in USE_STATS:
            m = re.search(r"([+-]\d+) en " + word, d)
            if m:
                v = int(m.group(1))
                mods[stat] = -v if stat in DICE_STATS else v
    skills = [clean(x) for x in re.findall(r"gagne la règle (\w+) jusque la fin de la partie", desc)]
    xp = re.search(r"obtiendra (\d+)d10 points d'expérience", d)
    return "potion", mods, skills, int(xp.group(1)) if xp else 0

def parse_items(paras, hyp):
    """Prix des objets communs + liste des objets de trésor / marché noir, avec leur rareté."""
    common, categories, mode, cat = {}, [], None, None
    for raw, rarity in paras:
        t = clean(raw)
        if not t:
            continue
        if t.startswith("Liste des objets communs"):
            mode = "common"
            continue
        if t.startswith("Liste des objets de trésors"):
            mode = "treasure"
            continue
        if mode == "common":
            m = re.match(r"^\d+\s+(.+?)\s*:", t)
            price = PRICE_RE.search(t)
            if m and price:
                eid = COMMON_IDS.get(slug(m.group(1)))
                if eid:
                    common[eid] = int(price.group(1))
                else:
                    hyp.append(f"Objet commun « {m.group(1)} » non relié à l'équipement du builder.")
        elif mode == "treasure":
            cm = CATEGORY_RE.match(t)
            if cm:
                cat = {"id": slug(cm.group(1)), "name": cm.group(1), "items": []}
                categories.append(cat)
                continue
            if cat is None:
                continue
            if ":" in t:
                name, desc = t.split(":", 1)
            elif PRICE_RE.search(t):
                # Objet sans description (ex. « Potion de rapidité. 50PO »).
                name, desc = PRICE_RE.sub("", t).strip(" ."), PRICE_RE.search(t).group(0)
            else:
                continue
            price = PRICE_RE.search(desc)
            desc = PRICE_RE.sub("", desc).strip().rstrip(".") + "." if desc.strip() else ""
            mods, granted = item_effects(cat["id"], desc)
            entry = {
                "id": slug(name), "name": name.strip(), "description": desc.strip() if desc.strip(" .") else "",
                "price": int(price.group(1)) if price else None,
                "rarity": rarity,
            }
            if mods:
                entry["mods"] = mods
            if granted:
                entry["skills"] = granted
            kind, use_mods, use_skills, xp_dice = consumable_effects(cat["id"], entry["id"], desc)
            if kind:
                entry["consumable"] = kind
                if use_mods:
                    entry["useMods"] = use_mods
                if use_skills:
                    entry["useSkills"] = use_skills
                if xp_dice:
                    entry["xpDice"] = xp_dice
                if kind == "potion" and not desc.strip(" ."):
                    hyp.append(f"Objet « {entry['name']} » : pas de description, son effet n'est pas appliqué.")
            cat["items"].append(entry)
    return common, categories


def parse_lore(paras):
    out = []
    for raw in paras:
        t = clean(raw)
        if t.startswith("Factions"):
            break
        if t:
            out.append(t)
    return {"title": out[0] if out else "Amatika", "paragraphs": out[1:]}



# ---------------------------------------------------------------- Blessures
# Effets durables des cartes Blessure, appliqués après la bataille.
# « mods » modifie la valeur brute de la carac : pour Com, Tir, Agi et Comm (jets « X+ »), perdre 1 point = +1 au score à obtenir.
INJURY_EFFECTS = {
    "ce-qui-ne-me-tue-pas-me-rend-plus-fort": {"gainSkill": "Sans Peur"},
    "defigure": {"gainSkill": "Peur"},
    "blessure-grave": {"missNextGame": True},
    "negociation-avec-la-mort": {"special": "negotiate"},
    "blessure-multiple": {"special": "multiple"},
    "sauve-par-son-sac": {"special": "bag"},
    "jambe-emputee": {"mods": {"mou": -2}, "mark": "jambe", "leavesOnSecond": True},
    "bras-empute": {"mark": "bras", "leavesOnSecond": True, "handsLost": 1},
    "jambe-cassee": {"mods": {"mou": -1}},
    "cheville-tordue": {"mods": {"agi": 1}},
    "folie": {"mods": {"cmd": 1}},
    "main-ecrasee": {"mods": {"com": 1}},
    "oeil-creve": {"mods": {"tir": 1}, "mark": "oeil", "leavesOnSecond": True},
    "cote-cassee": {"mods": {"end": -1}},
    "bras-casse": {"mods": {"for": -1}},
    "morte": {"dead": True},
}


def parse_injuries(rows, hyp):
    cards = []
    for r in rows[1:]:
        name, qty = r.get("B"), num(r.get("D"))
        if not name or qty is None:
            continue
        key = slug(name)
        effect = INJURY_EFFECTS.get(key, {})
        cards.append({
            "id": f"{key}-{r.get('A', '')}", "kind": key, "name": name, "value": int(num(r.get("A")) or 0),
            "description": r.get("C", ""), "quantity": int(qty), **effect,
            "lasting": bool(effect.get("mods") or effect.get("gainSkill") or effect.get("missNextGame")
                            or effect.get("dead") or effect.get("mark")),
        })
    total = sum(c["quantity"] for c in cards)
    if total != 72:
        hyp.append(f"Paquet Blessure : {total} cartes au lieu des 72 annoncées.")
    return cards



# ------------------------------------------------------- Paquets de cartes
# Paquets de lieux d'intérêt : une ligne par carte. Couleurs des dos de cartes (Fluff.docx).
LOCATION_DECKS = [
    ("Coffre", "coffre", "Coffre", "#d9b43a"),
    ("Naturel", "naturel", "Naturel", "#8fbf5a"),
    ("Magique", "magique", "Magique", "#d77fb0"),
    ("Ville", "ville", "Ville", "#f2ede1"),
    ("Cimetierre", "cimetiere", "Cimetière", "#7d5a9e"),
    ("Ruine", "ruines", "Ruines", "#d9822b"),
    ("Rivage", "rivage", "Rivage", "#2f5fae"),
]


def parse_location_decks(sheets, hyp):
    decks = []
    for sheet, deck_id, name, color in LOCATION_DECKS:
        rows = sheets.get(sheet)
        if rows is None:
            hyp.append(f"Cartes.xlsx : feuille « {sheet} » introuvable.")
            continue
        cards = [{"id": f"{deck_id}-{r['A']}", "text": r["B"]} for r in rows if r.get("A") and r.get("B")]
        decks.append({"id": deck_id, "name": name, "color": color, "cards": cards})
        if len(cards) != 42:
            hyp.append(f"Paquet {name} : {len(cards)} cartes au lieu de 42.")
    return decks


def parse_creatures(rows):
    """Créatures de la faune d'Amatika (une carte chacune), jusqu'à la première ligne vide."""
    out = []
    for r in rows[1:]:
        if not r.get("A") or r.get("B") != "Créature":
            if out:
                break
            continue
        stats = [num(r.get(c)) for c in "CDEFGHIJKL"]
        out.append({
            "id": slug(r["A"]), "name": r["A"],
            "stats": {k: (None if v is None or (k in ("tir", "com") and v >= 11) else int(v)) for k, v in zip(STAT_KEYS, stats)},
            "skills": [r[c] for c in "NOPQRS" if r.get(c) and r[c] != "Demon d'Amatika"],
            "gifts": r.get("V", ""),
        })
    return out


def main():
    src = Path(sys.argv[1])
    hyp = []

    factions = parse_bandes(docx_paragraphs(src / "Bandes.docx"), hyp)
    for f in factions:
        for p in f["profiles"]:
            classify(f, p, hyp)
    apply_compendium(factions, xlsx_sheets(src / "Compendium.xlsx")["Compendium"], hyp)

    rules_paras = docx_paragraphs(src / "Règles.docx")
    skills = parse_skills_from_rules(rules_paras)
    canon = {s["id"]: s["name"] for s in skills}
    missing = set()
    for f in factions:
        for p in f["profiles"]:
            p["skills"] = [canonical_skill(n, canon, missing) for n in p["skills"]]
            p["skillChoices"] = [[canonical_skill(n, canon, missing) for n in c] for c in p["skillChoices"]]
            comp = p.pop("_compSkills", None)
            if comp is None:
                continue
            # Le Compendium fait foi pour les compétences ; « A ou B » devient un choix à la création.
            fixed, choices = [], []
            for n in comp:
                parts = [x.strip() for x in re.split(r"\s+ou\s+", n, flags=re.I)]
                if len(parts) > 1:
                    choices.append([canonical_skill(x, canon, missing) for x in parts])
                else:
                    fixed.append(canonical_skill(n, canon, missing))
            before = {slug(x) for x in p["skills"]} | {slug(x) for c in p["skillChoices"] for x in c}
            after = {slug(x) for x in fixed} | {slug(x) for c in choices for x in c}
            if before != after:
                detail = []
                if after - before:
                    detail.append("ajoutées : " + ", ".join(sorted(after - before)))
                if before - after:
                    detail.append("retirées : " + ", ".join(sorted(before - after)))
                hyp.append(f"Compétences de {f['name']} / {p['name']} alignées sur le Compendium ({'; '.join(detail)}).")
            p["skills"], p["skillChoices"] = fixed, choices
    used = {n for f in factions for p in f["profiles"] for n in p["skills"] + [x for c in p["skillChoices"] for x in c]}
    for n in sorted(missing & used):
        hyp.append(f"Compétence « {n} » sans description dans Règles.docx.")

    cartes = xlsx_sheets(src / "Cartes.xlsx")
    spells = parse_spells(cartes["Sorts"], hyp)
    injuries = parse_injuries(cartes["Blessures"], hyp)
    location_decks = parse_location_decks(cartes, hyp)
    creatures = parse_creatures(cartes["Créatures et invocations"])
    common_prices, item_categories = parse_items(docx_paragraphs_rarity(src / "Liste des objets de trésors et marché noir.docx"), hyp)

    eq_path = OUT / "equipment.json"
    equipment = json.loads(eq_path.read_text(encoding="utf8"))
    for e in equipment:
        if e["id"] in common_prices:
            e["price"] = common_prices[e["id"]]
        else:
            hyp.append(f"Équipement « {e['name']} » : pas de prix dans la liste des objets.")

    OUT.mkdir(parents=True, exist_ok=True)

    def dump(name, data):
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")

    dump("factions.json", factions)
    dump("skills.json", skills)
    dump("rules.json", parse_rules(rules_paras))
    dump("spells.json", spells)
    dump("injuries.json", injuries)
    dump("locations.json", location_decks)
    dump("creatures.json", creatures)
    dump("items.json", item_categories)
    dump("lore.json", parse_lore(docx_paragraphs(src / "Fluff.docx")))
    dump("equipment.json", equipment)
    (ROOT / "scripts" / "import-hypotheses.txt").write_text("\n".join(hyp) + "\n", encoding="utf8")
    print(f"{len(factions)} factions, {sum(len(f['profiles']) for f in factions)} profils, "
          f"{len(spells)} sorts, {sum(len(c['items']) for c in item_categories)} objets, {len(hyp)} remarques")


if __name__ == "__main__":
    main()
