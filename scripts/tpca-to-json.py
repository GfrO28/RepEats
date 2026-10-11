"""
Convierte las Tablas Peruanas de Composición de Alimentos (INS/CENAN, 2023) al JSON
que importa la app (Alimentos -> Importar JSON).

Uso (desde la raíz del proyecto):
    pip install pypdf
    python scripts/tpca-to-json.py

Lee:      docs/tpca-2025-2.pdf
Escribe:  docs/seed-data/tpca-2023-alimentos.json
          docs/seed-data/tpca-2023-revision.txt   (datos asumidos en 0 y filas omitidas, con el motivo)
          docs/seed-data/tpca-2023-platos.json    (grupo S: 1 registro por plato, promedio de estratos A-E,
                                                   con el sufijo " (restaurante)" en el nombre)
          docs/seed-data/tpca-2023-platos-revision.txt

Decisiones:
- Solo los grupos A-U (1125 alimentos). El grupo S (preparaciones por estrato) queda fuera.
- Valores por 100 g de porción comestible, tal como los publica la tabla.
- Carbohidratos = disponibles (CHOAVL) si existen; si no, totales (CHOCDF). Es la base con la que
  el INS calcula la energía, así que kcal y macros cuadran (salvo unos pocos alimentos con mucha
  fibra o con datos inconsistentes en la propia tabla, que la app marca en "Revisar").
- "•" significa "no medido". Si kcal es desconocido, la fila se omite. Si falta proteína, grasa o
  carbohidratos, se toma como 0 SOLO cuando las kcal publicadas se explican con los macros
  conocidos (4·P + 4·C + 9·G, misma tolerancia que el importador de la app: max(25, 20 %)).
  Si no se explican (p. ej. vinos, cuya energía viene del alcohol), la fila se omite.
- Ambos casos quedan listados en tpca-2023-revision.txt para poder revisarlos.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT / "docs" / "tpca-2025-2.pdf"
OUT_DIR = ROOT / "docs" / "seed-data"

# Páginas (base 1) de las tablas de alimentos A-U; el grupo S empieza en la 106.
FIRST_PAGE, LAST_PAGE = 16, 104

# Conteo oficial por grupo (Tabla 1 del documento), para verificar que no se perdió nada.
EXPECTED = {
    "A": 198, "B": 133, "C": 170, "D": 49, "E": 103, "F": 134, "G": 38,
    "H": 32, "J": 16, "K": 8, "L": 51, "Q": 18, "T": 88, "U": 87,
}

VALUE = r"(?:\d+(?:\.\d+)?|•)"
# código + posición, nombre (lo más corto posible), 22 columnas y el mismo código repetido al final
ROW = re.compile(rf"\b([A-U]) (\d+) (.+?) ((?:{VALUE} ){{22}})\1 \2(?= |$)")

# Índices de las 22 columnas numéricas
KCAL, PROTEIN, FAT, CARBS_TOTAL, CARBS_AVAILABLE = 0, 3, 4, 5, 6


def to_number(token: str) -> float | None:
    return None if token == "•" else float(token)


def energy_is_explained(kcal: float, protein: float, fat: float, carbs: float) -> bool:
    estimated = 4 * protein + 4 * carbs + 9 * fat
    return abs(kcal - estimated) <= max(25, 0.2 * kcal)


def clean_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", raw).strip()
    name = name.replace("*", "")  # marcas de "imputado de otra tabla"
    name = re.sub(r"\s+([,.)])", r"\1", name)  # "arroz , cocido" -> "arroz, cocido"
    return name.strip()


# ---------------------------------------------------------------------------------------------
# Grupo S: alimentos preparados (platos completos). Cada plato viene repetido por estrato
# socioeconómico (A-E) del restaurante; aquí se promedian en un solo registro por plato.
# ---------------------------------------------------------------------------------------------
S_FIRST_PAGE, S_LAST_PAGE = 106, 185
S_EXPECTED_DISHES = 567  # 144 entradas + 377 segundos + 20 refrescos + 9 bebidas de desayuno + 17 postres
S_HEADER = "kcal kJ g g g g g g g mg mg mg mg mg mg µg mg mg mg mg µg"
S_SUFFIX = " (restaurante)"  # distingue estos platos de los alimentos y de tus propias recetas

# nombre + 21 columnas + estrato (A-E, o un guion en los platos analizados en laboratorio)
S_ROW = re.compile(rf"(?P<name>.+?) (?P<vals>(?:{VALUE} ){{21}})(?P<stratum>[A-E]|[-–•·])(?= |$)")
S_CODE = re.compile(r"\b(?:SE|SS|SR|SB|SP)\b(?: \d+)?")  # SE 7, SS 12...
S_HEADINGS = re.compile(r"\b(?:ENTRADAS|SEGUNDOS|REFRESCOS|BEBIDAS PARA DESAYUNO|POSTRES)\b")
S_SECTION_LABELS = {
    "ENTRADAS": "entrada",
    "SEGUNDOS": "segundo",
    "REFRESCOS": "refresco",
    "BEBIDAS PARA DESAYUNO": "bebida de desayuno",
    "POSTRES": "postre",
}
WIDE_RANGE_RATIO = 1.5


def clean_dish_name(raw: str) -> str:
    name = S_CODE.sub(" ", raw)
    name = S_HEADINGS.sub(" ", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"^(?:\d+ )+", "", name + " ").strip()  # número del código partido, al inicio ("SE SE 7 8 Caldo...")
    name = re.sub(r"(?: \d+)+$", "", name)  # ...o al final ("SR 2 Emoliente 2"); ningún plato termina en número
    return clean_name(name)


def dish_key(name: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[.,]", "", name.lower())).strip()


def pick_carbs(values: list[float | None]) -> float | None:
    """En los platos, elige la cifra (disponibles o totales) que mejor concilia con las kcal publicadas."""
    kcal, protein, fat = values[KCAL], values[PROTEIN], values[FAT]
    candidates = [c for c in (values[CARBS_AVAILABLE], values[CARBS_TOTAL]) if c is not None]
    if not candidates or kcal is None or protein is None or fat is None:
        return candidates[0] if candidates else None
    return min(candidates, key=lambda c: abs(kcal - (4 * protein + 4 * c + 9 * fat)))


def write_prepared_dishes(reader: PdfReader) -> None:
    dishes: dict[tuple[str, str], dict] = {}
    unusable: list[str] = []
    record_count = 0
    section = ""  # entrada, segundo, refresco... (el encabezado aparece pegado a la primera fila de cada sección)

    for page_number in range(S_FIRST_PAGE, S_LAST_PAGE + 1):
        text = re.sub(r"\s+", " ", reader.pages[page_number - 1].extract_text()) + " "
        start = text.find(S_HEADER)
        body = text[start + len(S_HEADER):] if start >= 0 else text

        for match in S_ROW.finditer(body):
            heading = S_HEADINGS.search(match.group("name"))
            if heading:
                section = S_SECTION_LABELS[heading.group(0)]
            name = clean_dish_name(match.group("name"))
            values = [to_number(v) for v in match.group("vals").split()]
            record_count += 1

            carbs = pick_carbs(values)
            row = (values[KCAL], values[PROTEIN], values[FAT], carbs)
            if name == "" or any(v is None for v in row):
                unusable.append(f"{name or '(sin nombre)'}: fila con datos incompletos")
                continue

            entry = dishes.setdefault((section, dish_key(name)), {"section": section, "names": Counter(), "rows": []})
            entry["names"][name] += 1
            entry["rows"].append(row)

    unique_dishes = len(dishes)
    if unique_dishes != S_EXPECTED_DISHES:
        print(f"ATENCIÓN: se agruparon {unique_dishes} platos y debían ser {S_EXPECTED_DISHES} ({record_count} filas leídas).")
        sys.exit(1)

    # Si el mismo nombre existe en dos secciones (p. ej. "Cebiche de pescado" como entrada y como segundo),
    # se distinguen con la sección para que el importador no descarte uno como repetido.
    name_sections: dict[str, set[str]] = {}
    for (sec, _), entry in dishes.items():
        name_sections.setdefault(entry["names"].most_common(1)[0][0].lower(), set()).add(sec)

    foods: list[dict] = []
    wide: list[str] = []
    off: list[str] = []
    for entry in sorted(dishes.values(), key=lambda e: e["names"].most_common(1)[0][0].lower()):
        display_name = entry["names"].most_common(1)[0][0]
        if len(name_sections[display_name.lower()]) > 1:
            display_name = f"{display_name} ({entry['section']})"
        rows = entry["rows"]
        mean = [sum(r[i] for r in rows) / len(rows) for i in range(4)]
        kcal, protein, fat, carbs = int(round(mean[0])), round(mean[1], 1), round(mean[2], 1), round(mean[3], 1)
        # "prepared": plato de restaurante ya terminado; la app lo excluye de los ingredientes de una receta
        foods.append({
            "name": display_name + S_SUFFIX,
            "kcal": kcal,
            "proteinG": protein,
            "fatG": fat,
            "carbsG": carbs,
            "unit": None,
            "prepared": True,
        })

        kcals = [r[0] for r in rows]
        if len(rows) > 1 and max(kcals) > WIDE_RANGE_RATIO * min(kcals) and max(kcals) - min(kcals) > 30:
            wide.append(f"{display_name}: {int(min(kcals))} a {int(max(kcals))} kcal/100 g según estrato ({len(rows)} versiones)")
        if not energy_is_explained(kcal, protein, fat, carbs):
            off.append(f"{display_name}: {kcal} kcal publicadas vs ~{round(4 * protein + 4 * carbs + 9 * fat)} por sus macros")

    payload = {
        "_fuente": "Tablas Peruanas de Composición de Alimentos, 11.ª ed. digital (2023), grupo S (alimentos preparados). "
                   "Instituto Nacional de Salud, CENAN, Ministerio de Salud del Perú. Por 100 g de preparación; "
                   "promedio de los estratos socioeconómicos A-E de restaurantes de Lima y Callao (encuesta INEI-CENAN). "
                   "La tabla no indica ingredientes ni el peso del plato.",
        "foods": foods,
    }
    (OUT_DIR / "tpca-2023-platos.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    review = (
        f"PLATOS CON RANGO AMPLIO ENTRE ESTRATOS ({len(wide)}): el promedio es solo una referencia\n"
        + "\n".join(wide)
        + f"\n\nPLATOS CUYAS KCAL NO CUADRAN CON SUS MACROS ({len(off)}): datos de la propia tabla\n"
        + "\n".join(off)
        + f"\n\nFILAS NO USABLES ({len(unusable)})\n"
        + "\n".join(unusable)
        + "\n"
    )
    (OUT_DIR / "tpca-2023-platos-revision.txt").write_text(review, encoding="utf-8")

    print(f"Platos: {record_count} filas leídas -> {unique_dishes} platos (coincide con las {S_EXPECTED_DISHES} preparaciones oficiales)")
    print(f"        {len(wide)} con rango amplio entre estratos, {len(off)} con kcal que no cuadran, {len(unusable)} filas no usables")
    print("Detalle:      docs/seed-data/tpca-2023-platos-revision.txt")


def main() -> None:
    reader = PdfReader(str(PDF_PATH))
    foods: list[dict] = []
    skipped: list[str] = []
    assumed: list[str] = []
    count_by_group: Counter[str] = Counter()

    for page_number in range(FIRST_PAGE, LAST_PAGE + 1):
        text = re.sub(r"\s+", " ", reader.pages[page_number - 1].extract_text()) + " "
        for match in ROW.finditer(text):
            group, position, raw_name, values_text = match.groups()
            code = f"{group}{position}"
            name = clean_name(raw_name)
            values = [to_number(v) for v in values_text.split()]
            count_by_group[group] += 1

            carbs = values[CARBS_AVAILABLE] if values[CARBS_AVAILABLE] is not None else values[CARBS_TOTAL]
            kcal = values[KCAL]
            macros = {"proteína": values[PROTEIN], "grasa": values[FAT], "carbohidratos": carbs}
            missing = [label for label, value in macros.items() if value is None]

            if kcal is None:
                skipped.append(f"{code} {name}: sin dato de kcal")
                continue
            if missing:
                protein, fat, carbs_g = (macros[k] or 0.0 for k in ("proteína", "grasa", "carbohidratos"))
                if not energy_is_explained(kcal, protein, fat, carbs_g):
                    skipped.append(f"{code} {name}: sin dato de {', '.join(missing)} y las kcal no se explican con el resto")
                    continue
                assumed.append(f"{code} {name}: {', '.join(missing)} = 0 (kcal {int(kcal)} ≈ 4·{protein} + 4·{carbs_g} + 9·{fat})")

            foods.append({
                "name": name,
                "kcal": kcal,
                "proteinG": macros["proteína"] or 0.0,
                "fatG": macros["grasa"] or 0.0,
                "carbsG": macros["carbohidratos"] or 0.0,
                "unit": None,
            })

    problems = [f"grupo {g}: se leyeron {count_by_group[g]} y debían ser {n}" for g, n in EXPECTED.items() if count_by_group[g] != n]
    if problems:
        print("ATENCIÓN, no coinciden los conteos oficiales:")
        print("\n".join(problems))
        sys.exit(1)

    # kcal en enteros (la tabla los publica sin decimales)
    for food in foods:
        food["kcal"] = int(food["kcal"])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "_fuente": "Tablas Peruanas de Composición de Alimentos, 11.ª ed. digital (2023). Instituto Nacional de Salud, "
                   "Centro Nacional de Alimentación, Nutrición y Vida Saludable (CENAN), Ministerio de Salud del Perú. "
                   "Valores por 100 g de parte comestible; carbohidratos disponibles cuando la tabla los reporta, "
                   "si no, totales.",
        "foods": foods,
    }
    (OUT_DIR / "tpca-2023-alimentos.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    review = (
        f"ASUMIDOS EN 0 ({len(assumed)}): el dato es '•' (no medido) y las kcal publicadas lo respaldan\n"
        + "\n".join(assumed)
        + f"\n\nOMITIDOS ({len(skipped)}): no se pueden importar sin inventar datos\n"
        + "\n".join(skipped)
        + "\n"
    )
    (OUT_DIR / "tpca-2023-revision.txt").write_text(review, encoding="utf-8")

    print(f"Filas leídas: {sum(count_by_group.values())} (todos los grupos coinciden con el conteo oficial)")
    print(f"Convertidas:  {len(foods)} (de ellas {len(assumed)} con algún dato asumido en 0)")
    print(f"Omitidas:     {len(skipped)}")
    print("Detalle:      docs/seed-data/tpca-2023-revision.txt")
    write_prepared_dishes(reader)


if __name__ == "__main__":
    main()
