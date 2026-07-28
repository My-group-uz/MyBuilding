# === Выгрузка отчёта по объекту в XLSX ===
#
# Один файл на три листа — «Приход», «Бюджет», «Расходы», — потому что
# разбираться в объекте приходится целиком: приход без расхода
# не показывает остаток, а бюджет без факта — перерасход.
#
# Собирается на сервере, а не в браузере: те же цифры, что в базе,
# без библиотеки на фронте и без расхождений между вкладками.

import io
import re
import urllib.parse

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

XLSX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

# Денежный формат без символа валюты: суммы в сумах, и «сум» в каждой
# ячейке мешал бы считать по столбцу.
MONEY_FORMAT = "# ##0.00"
QTY_FORMAT = "# ##0.###"
DATE_FORMAT = "DD.MM.YYYY"

_HEADER_FILL = PatternFill("solid", fgColor="1F3A5F")
_HEADER_FONT = Font(color="FFFFFF", bold=True)
_TITLE_FONT = Font(bold=True, size=14)
_TOTAL_FONT = Font(bold=True)
_TOTAL_FILL = PatternFill("solid", fgColor="EEF2F7")
_THIN = Side(style="thin", color="D0D7E2")
_BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)


def _num(value) -> float:
    """NUMERIC приходит как Decimal, а openpyxl пишет его строкой."""
    return float(value) if value is not None else 0.0


def _write_sheet(ws, title: str, columns: list, rows: list) -> None:
    """Лист с названием объекта, шапкой и данными.

    columns — список (заголовок, ширина, формат). Формат пустой для текста.
    """
    ws.cell(row=1, column=1, value=title).font = _TITLE_FONT

    header_row = 3
    for col, (name, width, _fmt) in enumerate(columns, start=1):
        cell = ws.cell(row=header_row, column=col, value=name)
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = _BORDER
        ws.column_dimensions[get_column_letter(col)].width = width

    for r, values in enumerate(rows, start=header_row + 1):
        for c, (value, (_name, _w, fmt)) in enumerate(zip(values, columns), start=1):
            cell = ws.cell(row=r, column=c, value=value)
            cell.border = _BORDER
            if fmt:
                cell.number_format = fmt

    # Шапка остаётся на экране при прокрутке длинных смет
    ws.freeze_panes = ws.cell(row=header_row + 1, column=1)
    if rows:
        last_col = get_column_letter(len(columns))
        ws.auto_filter.ref = f"A{header_row}:{last_col}{header_row + len(rows)}"


def _add_total(ws, columns: list, row_count: int, totals: dict) -> None:
    """Строка «Итого» под таблицей. totals: номер колонки (с 1) -> значение."""
    if not row_count:
        return
    row = 3 + row_count + 1
    ws.cell(row=row, column=1, value="Итого")
    for col, (_name, _w, fmt) in enumerate(columns, start=1):
        cell = ws.cell(row=row, column=col)
        cell.font = _TOTAL_FONT
        cell.fill = _TOTAL_FILL
        cell.border = _BORDER
        if col in totals:
            cell.value = totals[col]
            cell.number_format = fmt or MONEY_FORMAT


def _content_disposition(name: str) -> str:
    """Имя файла для браузера.

    Кириллица в заголовке допустима только в filename* (RFC 5987),
    поэтому рядом кладётся ASCII-запасной вариант: старые браузеры
    иначе сохраняют файл с испорченным именем.
    """
    safe = re.sub(r'[\\/:*?"<>|]', "_", name).strip() or "report"
    ascii_name = re.sub(r"[^A-Za-z0-9._ -]", "_", safe) or "report"
    quoted = urllib.parse.quote(f"{safe}.xlsx")
    return f'attachment; filename="{ascii_name}.xlsx"; filename*=UTF-8\'\'{quoted}'


@app.get("/objects/{object_id}/export/xlsx")
async def export_object_xlsx(object_id: int):
    """Приход, бюджет и расходы объекта одной книгой."""
    async with app.state.db.acquire() as conn:
        obj = await conn.fetchrow(
            "SELECT id, name, customer, address, area, contract_sum FROM objects WHERE id=$1",
            object_id,
        )
        if not obj:
            raise HTTPException(status_code=404, detail="Объект не найден")

        incomes = await conn.fetch(
            """SELECT date, amount, sender, receiver, comment
               FROM incomes WHERE object_id=$1 ORDER BY date NULLS LAST, id""",
            object_id,
        )

        # Один запрос на всю смету вместо обхода дерева: листы всё равно
        # плоские, а вложенные выборки на большом объекте дают сотни
        # обращений к базе.
        budget = await conn.fetch(
            """
            SELECT s.name AS stage, s.order_index AS s_ord,
                   wt.name AS work_type, wt.unit AS wt_unit, wt.quantity AS wt_qty,
                   wt.order_index AS wt_ord,
                   r.id AS resource_id, r.resource_type, r.name AS resource,
                   r.unit, r.quantity, r.price, r.supplier, r.order_index AS r_ord
            FROM budget_stages s
            LEFT JOIN budget_work_types wt ON wt.stage_id = s.id
            LEFT JOIN budget_resources r ON r.work_type_id = wt.id
            WHERE s.object_id = $1
            ORDER BY s.order_index, wt.order_index, r.order_index
            """,
            object_id,
        )

        expenses = await conn.fetch(
            """
            SELECT s.name AS stage, wt.name AS work_type,
                   r.name AS resource, r.unit, r.quantity AS plan_qty, r.price AS plan_price,
                   e.date, e.actual_quantity, e.actual_price, e.comment
            FROM resource_expenses e
            JOIN budget_resources r ON r.id = e.resource_id
            JOIN budget_work_types wt ON wt.id = r.work_type_id
            JOIN budget_stages s ON s.id = wt.stage_id
            WHERE s.object_id = $1
            ORDER BY s.order_index, wt.order_index, r.order_index, e.date, e.id
            """,
            object_id,
        )

    title = obj["name"] or f"Объект {object_id}"
    wb = Workbook()

    # --- Приход ---
    ws = wb.active
    ws.title = "Приход"
    columns = [
        ("№", 6, ""),
        ("Дата", 14, DATE_FORMAT),
        ("Сумма (сум)", 18, MONEY_FORMAT),
        ("Кто передал", 24, ""),
        ("Кто получил", 24, ""),
        ("Комментарии", 40, ""),
    ]
    rows = [
        [i, r["date"], _num(r["amount"]), r["sender"] or "", r["receiver"] or "",
         r["comment"] or ""]
        for i, r in enumerate(incomes, start=1)
    ]
    _write_sheet(ws, f"{title} — приход", columns, rows)
    _add_total(ws, columns, len(rows), {3: sum(r[2] for r in rows)})

    # --- Бюджет ---
    ws = wb.create_sheet("Бюджет")
    columns = [
        ("Этап", 26, ""),
        ("Вид работ", 26, ""),
        ("Ед. изм. работ", 12, ""),
        ("Кол-во работ", 12, QTY_FORMAT),
        ("Тип ресурса", 16, ""),
        ("Ресурс", 30, ""),
        ("Ед. изм.", 10, ""),
        ("Кол-во", 12, QTY_FORMAT),
        ("Цена (сум)", 16, MONEY_FORMAT),
        ("Сумма (сум)", 18, MONEY_FORMAT),
        ("Поставщик", 24, ""),
    ]
    rows = []
    for r in budget:
        # LEFT JOIN оставляет пустые этапы и виды работ: в отчёте они
        # нужны — пустой этап это тоже факт, а не отсутствие строки.
        amount = _num(r["quantity"]) * _num(r["price"]) if r["resource_id"] else 0.0
        rows.append([
            r["stage"] or "",
            r["work_type"] or "",
            r["wt_unit"] or "" if r["work_type"] else "",
            _num(r["wt_qty"]) if r["work_type"] else None,
            r["resource_type"] or "",
            r["resource"] or "",
            r["unit"] or "",
            _num(r["quantity"]) if r["resource_id"] else None,
            _num(r["price"]) if r["resource_id"] else None,
            amount if r["resource_id"] else None,
            r["supplier"] or "",
        ])
    _write_sheet(ws, f"{title} — бюджет", columns, rows)
    _add_total(ws, columns, len(rows), {10: sum(x[9] or 0 for x in rows)})

    # --- Расходы ---
    ws = wb.create_sheet("Расходы")
    columns = [
        ("Этап", 26, ""),
        ("Вид работ", 26, ""),
        ("Ресурс", 30, ""),
        ("Ед. изм.", 10, ""),
        ("План кол-во", 13, QTY_FORMAT),
        ("План цена", 16, MONEY_FORMAT),
        ("План сумма", 18, MONEY_FORMAT),
        ("Дата", 14, DATE_FORMAT),
        ("Факт кол-во", 13, QTY_FORMAT),
        ("Факт цена", 16, MONEY_FORMAT),
        ("Факт сумма", 18, MONEY_FORMAT),
        ("Комментарий", 40, ""),
    ]
    rows = []
    for r in expenses:
        fact = _num(r["actual_quantity"]) * _num(r["actual_price"])
        rows.append([
            r["stage"] or "",
            r["work_type"] or "",
            r["resource"] or "",
            r["unit"] or "",
            _num(r["plan_qty"]),
            _num(r["plan_price"]),
            _num(r["plan_qty"]) * _num(r["plan_price"]),
            r["date"],
            _num(r["actual_quantity"]),
            _num(r["actual_price"]),
            fact,
            r["comment"] or "",
        ])
    _write_sheet(ws, f"{title} — расходы", columns, rows)
    _add_total(ws, columns, len(rows), {11: sum(x[10] for x in rows)})

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": _content_disposition(f"{title} — отчёт")},
    )
