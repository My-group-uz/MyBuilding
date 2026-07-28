# === Expense API Endpoints ===
from fastapi import Request, HTTPException
import time
from datetime import date as dtdate, datetime
import os

# Get budget tree with expense data
@app.get("/objects/{object_id}/expenses/tree")
async def get_expenses_tree(object_id: int):
    """Получить дерево бюджета с данными о расходах"""
    async with app.state.db.acquire() as conn:
        # Получаем этапы
        stages = await conn.fetch(
            "SELECT * FROM budget_stages WHERE object_id=$1 ORDER BY order_index",
            object_id
        )
        
        result = []
        for stage in stages:
            stage_dict = dict(stage)
            
            # Получаем виды работ для этапа
            work_types = await conn.fetch(
                "SELECT * FROM budget_work_types WHERE stage_id=$1 ORDER BY order_index",
                stage['id']
            )
            
            stage_dict['work_types'] = []
            for wt in work_types:
                wt_dict = dict(wt)
                
                # Получаем ресурсы для вида работ
                resources = await conn.fetch(
                    "SELECT * FROM budget_resources WHERE work_type_id=$1 ORDER BY order_index",
                    wt['id']
                )
                
                wt_dict['resources'] = []
                for res in resources:
                    res_dict = dict(res)
                    
                    # Получаем расходы для ресурса
                    expenses = await conn.fetch(
                        "SELECT * FROM resource_expenses WHERE resource_id=$1 ORDER BY date DESC",
                        res['id']
                    )
                    res_dict['expenses'] = [dict(exp) for exp in expenses]
                    
                    wt_dict['resources'].append(res_dict)
                
                stage_dict['work_types'].append(wt_dict)
            
            result.append(stage_dict)
        
        return result

# Add expense for resource
@app.post("/budget/resources/{resource_id}/expenses/")
async def add_expense(resource_id: int, request: Request):
    """Добавить расход для ресурса"""
    try:
        data = await request.json()
        print(f"Adding expense for resource {resource_id}: {data}")
        
        # Robust Date Handling
        date_str = data.get("date")
        date_val = dtdate.today()
        
        if date_str:
            try:
                # Try ISO format YYYY-MM-DD
                date_val = dtdate.fromisoformat(date_str)
            except ValueError:
                try:
                    # Try DD.MM.YYYY (common in some locales)
                    date_val = datetime.strptime(date_str, "%d.%m.%Y").date()
                except ValueError:
                    print(f"Date parse failed for '{date_str}', using today")
                    date_val = dtdate.today()
            
        # Handle potential None/Null values safely
        qty_raw = data.get("actual_quantity")
        price_raw = data.get("actual_price")
        
        actual_quantity = float(qty_raw) if qty_raw is not None else 0.0
        actual_price = float(price_raw) if price_raw is not None else 0.0
        comment = data.get("comment", "") or ""
        
        async with app.state.db.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO resource_expenses 
                (resource_id, date, actual_quantity, actual_price, comment)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            """, resource_id, date_val, actual_quantity, actual_price, comment)
        
        return dict(row)
    except Exception as e:
        print(f"Error adding expense: {e}")
        # Return a 400 error with the message so the frontend can show it
        raise HTTPException(status_code=400, detail=f"Server Error: {str(e)}")

@app.post("/objects/{object_id}/expenses/fill-from-budget")
async def fill_expenses_from_budget(object_id: int):
    """Проставить факт по плану для ресурсов, где расхода ещё нет.

    Смета заводится один раз, а расход по большинству позиций совпадает
    с планом — вручную это сотни одинаковых вводов. Кнопка закрывает
    рутину, оставляя ручной правкой только те позиции, где факт
    разошёлся с планом.

    Ресурсы, по которым расход уже заведён, не трогаем: иначе повторное
    нажатие удвоило бы факт. Нулевые строки пропускаем — это заготовки,
    а не работа.
    """
    async with app.state.db.acquire() as conn:
        resources = await conn.fetch(
            """
            SELECT r.id, r.quantity, r.price
            FROM budget_resources r
            JOIN budget_work_types wt ON wt.id = r.work_type_id
            JOIN budget_stages s ON s.id = wt.stage_id
            WHERE s.object_id = $1
              AND (r.quantity > 0 OR r.price > 0)
              AND NOT EXISTS (SELECT 1 FROM resource_expenses e WHERE e.resource_id = r.id)
            ORDER BY r.id
            """,
            object_id,
        )

        if resources:
            today = dtdate.today()
            await conn.executemany(
                """INSERT INTO resource_expenses
                   (resource_id, date, actual_quantity, actual_price, comment)
                   VALUES ($1, $2, $3, $4, $5)""",
                [(r["id"], today, r["quantity"], r["price"], "Заполнено по бюджету")
                 for r in resources],
            )

    return {"created": len(resources)}


# Update expense
@app.put("/expenses/{expense_id}")
async def update_expense(expense_id: int, request: Request):
    """Обновить расход"""
    try:
        data = await request.json()
        
        updates = []
        params = []
        param_count = 1
        
        if "date" in data:
            updates.append(f"date=${param_count}")
            # Try to parse date if provided
            d_val = data["date"]
            try:
                d_obj = dtdate.fromisoformat(d_val)
            except:
                try:
                    d_obj = datetime.strptime(d_val, "%d.%m.%Y").date()
                except:
                    d_obj = dtdate.today()
            params.append(d_obj)
            param_count += 1
            
        if "actual_quantity" in data:
            updates.append(f"actual_quantity=${param_count}")
            val = data["actual_quantity"]
            params.append(float(val) if val is not None else 0.0)
            param_count += 1
        if "actual_price" in data:
            updates.append(f"actual_price=${param_count}")
            val = data["actual_price"]
            params.append(float(val) if val is not None else 0.0)
            param_count += 1
        if "comment" in data:
            updates.append(f"comment=${param_count}")
            params.append(data["comment"])
            param_count += 1
        
        if updates:
            params.append(expense_id)
            query = f"UPDATE resource_expenses SET {', '.join(updates)} WHERE id=${param_count} RETURNING *"
            async with app.state.db.acquire() as conn:
                row = await conn.fetchrow(query, *params)
            return dict(row) if row else {"error": "Not found"}
        
        return {"error": "No updates"}
    except Exception as e:
        print(f"Error updating expense: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Upload receipt photo
@app.put("/expenses/{expense_id}/receipt/{receipt_num}")
async def upload_receipt(expense_id: int, receipt_num: int, request: Request):
    """Загрузить фото чека"""
    try:
        form = await request.form()
        file = form.get(f"receipt_{receipt_num}")
        
        if not file:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Save file
        filename = f"receipt_{expense_id}_{receipt_num}_{int(time.time() * 1000)}.jpg"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        
        # Update database
        field_name = f"receipt_photo_{receipt_num}"
        async with app.state.db.acquire() as conn:
            row = await conn.fetchrow(
                f"UPDATE resource_expenses SET {field_name}=$1 WHERE id=$2 RETURNING *",
                f"/uploads/{filename}", expense_id
            )
        
        return dict(row) if row else {"error": "Not found"}
    except Exception as e:
        print(f"Error uploading receipt: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Delete receipt photo
@app.delete("/expenses/{expense_id}/receipt/{receipt_num}")
async def delete_receipt(expense_id: int, receipt_num: int):
    """Удалить фото чека: очищает поле в БД и удаляет файл с диска."""
    if receipt_num not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Неверный номер чека")

    field_name = f"receipt_photo_{receipt_num}"
    async with app.state.db.acquire() as conn:
        # Путь читаем до очистки: RETURNING отдал бы уже NULL
        old = await conn.fetchval(
            f"SELECT {field_name} FROM resource_expenses WHERE id=$1", expense_id
        )
        row = await conn.fetchrow(
            f"UPDATE resource_expenses SET {field_name}=NULL WHERE id=$1 RETURNING id",
            expense_id
        )

    if not row:
        raise HTTPException(status_code=404, detail="Расход не найден")

    # Файл удаляем только если на него больше никто не ссылается:
    # один и тот же снимок мог быть подставлен в несколько записей.
    if old:
        async with app.state.db.acquire() as conn:
            still_used = await conn.fetchval(
                "SELECT 1 FROM resource_expenses WHERE receipt_photo_1=$1 "
                "OR receipt_photo_2=$1 OR receipt_photo_3=$1 LIMIT 1",
                old
            )
        if not still_used:
            path = os.path.join(UPLOAD_DIR, os.path.basename(old))
            try:
                if os.path.exists(path):
                    os.remove(path)
            except OSError as e:
                # Запись в БД уже очищена — для пользователя чек удалён.
                # Осиротевший файл не повод возвращать ошибку.
                print(f"Не удалось удалить файл чека {path}: {e}")

    return {"status": "deleted"}

# Delete expense
@app.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: int):
    """Удалить расход"""
    async with app.state.db.acquire() as conn:
        await conn.execute("DELETE FROM resource_expenses WHERE id=$1", expense_id)
    return {"status": "deleted"}
