// ===== EXPENSE TAB LOGIC =====

let expenseData = [];
let selectedExpenseObjectId = null;

const EXP_RESOURCE_TYPES = {
    'Трудоресурсы': { color: '#9C27B0', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hard-hat-icon lucide-hard-hat"><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M14 6a6 6 0 0 1 6 6v3"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><rect x="2" y="15" width="20" height="4" rx="1"/></svg>' },
    'Материал': { color: '#8BC34A', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package-icon lucide-package"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/></svg>' },
    'Доставка': { color: '#2196F3', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm1.5-9H17V12h4.46L19.5 9.5zM6 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM20 8l3 4v5h-2c0 1.66-1.34 3-3 3s-3-1.34-3-3H9c0 1.66-1.34 3-3 3s-3-1.34-3-3H1V6c0-1.1.9-2 2-2h14v4h3zM3 6v9h.76c.55-.61 1.35-1 2.24-1 .89 0 1.69.39 2.24 1H15V6H3z"/></svg>' },
    'Оборудование': { color: '#673AB7', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-router-icon lucide-router"><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6.01 18H6"/><path d="M10.01 18H10"/><path d="M15 10v4"/><path d="M17.84 7.17a4 4 0 0 0-5.66 0"/><path d="M20.66 4.34a8 8 0 0 0-11.31 0"/></svg>' },
    'Мебель': { color: '#00BCD4', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-armchair-icon lucide-armchair"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/></svg>' },
    'Инструменты': { color: '#4CAF50', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-drill-icon lucide-drill"><path d="M10 18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a3 3 0 0 1-3-3 1 1 0 0 1 1-1z"/><path d="M13 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1l-.81 3.242a1 1 0 0 1-.97.758H8"/><path d="M14 4h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3"/><path d="M18 6h4"/><path d="m5 10-2 8"/><path d="m7 18 2-8"/></svg>' },
    'Коммуналка': { color: '#E91E63', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flame-kindling-icon lucide-flame-kindling"><path d="M12 2c1 3 2.5 3.5 3.5 4.5A5 5 0 0 1 17 10a5 5 0 1 1-10 0c0-.3 0-.6.1-.9a2 2 0 1 0 3.3-2C8 4.5 11 2 12 2Z"/><path d="m5 22 14-4"/><path d="m5 18 14 4"/></svg>' },
    'Документация': { color: '#FF9800', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>' },
    'Расходные материалы': { color: '#FFEB3B', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-fan-icon lucide-fan"><path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z"/><path d="M12 12v.01"/></svg>' },
    'Питание': { color: '#FF5722', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-utensils-icon lucide-utensils"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>' }
};

async function loadExpenses(objectId) {
    if (!objectId) return;
    selectedExpenseObjectId = objectId;

    try {
        const res = await fetch(`/objects/${objectId}/expenses/tree`);
        if (!res.ok) throw new Error('Failed');
        expenseData = await res.json();
        renderExpenseTree();
    } catch (err) {
        console.error('Error:', err);
        document.getElementById('expense-container').innerHTML = '<p style="padding:20px;text-align:center;color:#999;">Ошибка загрузки</p>';
    }
}

function renderExpenseTree() {
    const container = document.getElementById('expense-container');
    if (!container) return;

    if (!expenseData || expenseData.length === 0) {
        container.innerHTML = '<p style="padding:20px;text-align:center;color:#999;">Нет данных. Добавьте ресурсы в Бюджет.</p>';
        return;
    }

    container.innerHTML = '';

    expenseData.forEach((stage, idx) => {
        const stageEl = createExpenseStageElement(stage, idx + 1);
        container.appendChild(stageEl);
    });

    const totalBudget = expenseData.reduce((sum, s) => sum + calcStageBudget(s), 0);
    const totalActual = expenseData.reduce((sum, s) => sum + calcStageActual(s), 0);
    const totalRow = document.createElement('div');
    totalRow.className = 'budget-total-row';
    totalRow.innerHTML = `
        <span>ИТОГО:</span>
        <span>Бюджет: ${fmt(totalBudget)} | Факт: <span class="${totalActual > totalBudget ? 'over-budget' : ''}">${fmt(totalActual)}</span></span>
    `;
    container.appendChild(totalRow);

    // Дерево пересобрано — применяем действующий фильтр заново
    if (window.reapplySearch) window.reapplySearch('expense');
}

function createExpenseStageElement(stage, stageNum) {
    const div = document.createElement('div');
    div.className = 'budget-stage';

    const stageBudget = calcStageBudget(stage);
    const stageActual = calcStageActual(stage);

    const header = document.createElement('div');
    header.className = 'budget-stage-header';
    header.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <span class="collapse-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-icon lucide-arrow-down"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
            </span>
            <strong>${stage.name}</strong>
        </div>
        <div style="display:flex;gap:20px;">
            <span>Бюджет: ${fmt(stageBudget)}</span>
            <span class="${stageActual > stageBudget ? 'over-budget' : ''}">Факт: ${fmt(stageActual)}</span>
        </div>
    `;

    const workTypesContainer = document.createElement('div');
    workTypesContainer.className = 'budget-work-types-container';

    if (stage.work_types && stage.work_types.length > 0) {
        stage.work_types.forEach((wt, wtIdx) => {
            const wtEl = createExpenseWorkTypeElement(wt, wtIdx + 1);
            workTypesContainer.appendChild(wtEl);
        });
    }

    const collapseIcon = header.querySelector('.collapse-icon');
    collapseIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = workTypesContainer.style.display === 'none';
        workTypesContainer.style.display = isCollapsed ? '' : 'none';
        collapseIcon.innerHTML = isCollapsed ?
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-icon lucide-arrow-down"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>' :
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right-icon lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    });

    div.appendChild(header);
    div.appendChild(workTypesContainer);
    return div;
}

function createExpenseWorkTypeElement(workType, wtNum) {
    const div = document.createElement('div');
    div.className = 'budget-work-type';

    const wtBudget = calcWTBudget(workType);
    const wtActual = calcWTActual(workType);

    const header = document.createElement('div');
    header.className = 'budget-work-type-header';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <span class="collapse-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-icon lucide-arrow-down"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
            </span>
            <span>${workType.name} (${workType.unit})</span>
        </div>
        <div style="display:flex;gap:20px;">
            <span>Бюджет: ${fmt(wtBudget)}</span>
            <span class="${wtActual > wtBudget ? 'over-budget' : ''}">Факт: ${fmt(wtActual)}</span>
        </div>
    `;

    const resourcesContainer = document.createElement('div');
    resourcesContainer.className = 'budget-resources-container';

    const resHeader = document.createElement('div');
    resHeader.className = 'budget-resource-header';
    resHeader.innerHTML = `
        <span></span>
        <span>№</span>
        <span>Фото</span>
        <span>Тип</span>
        <span>Название</span>
        <span>Ед.изм</span>
        <span>Кол-во (план)</span>
        <span>Цена (план)</span>
        <span>Сумма (план)</span>
        <span>Сумма (факт)</span>
        <span></span>
    `;
    resourcesContainer.appendChild(resHeader);

    if (workType.resources && workType.resources.length > 0) {
        workType.resources.forEach((res, resIdx) => {
            const resEl = createExpenseResourceElement(res, wtNum, resIdx + 1);
            resourcesContainer.appendChild(resEl);
        });
    }

    const collapseIcon = header.querySelector('.collapse-icon');
    collapseIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = resourcesContainer.style.display === 'none';
        resourcesContainer.style.display = isCollapsed ? '' : 'none';
        collapseIcon.innerHTML = isCollapsed ?
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-icon lucide-arrow-down"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>' :
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right-icon lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    });

    div.appendChild(header);
    div.appendChild(resourcesContainer);
    return div;
}

function createExpenseResourceElement(resource, wtNum, resNum) {
    const container = document.createElement('div');

    const div = document.createElement('div');
    div.className = 'budget-resource';
    div.dataset.resourceId = resource.id;

    const budgetSum = (resource.quantity || 0) * (resource.price || 0);
    const resType = EXP_RESOURCE_TYPES[resource.resource_type] || EXP_RESOURCE_TYPES['Материал'];
    const resIcon = `<div class="res-type-icon" style="background-color: ${resType.color}" title="${resource.resource_type}">${resType.icon}</div>`;

    // Calculate totals from expenses
    const expenses = resource.expenses || [];
    const totalActualSum = expenses.reduce((sum, e) => sum + ((e.actual_quantity || 0) * (e.actual_price || 0)), 0);

    const isOverBudget = totalActualSum > budgetSum && totalActualSum > 0;

    div.innerHTML = `
        <button class="expand-btn" title="Раскрыть детали">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-narrow-wide-icon lucide-arrow-down-narrow-wide"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h4"/><path d="M11 8h7"/><path d="M11 12h10"/></svg>
        </button>
        <span class="res-num">${wtNum}.${resNum}</span>
        <span class="res-photo">
            ${resource.photo ? `<img src="${resource.photo}" alt="Фото" class="res-photo-thumb">` : '<span style="color:#ccc;"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-camera-off-icon lucide-camera-off"><path d="M14.564 14.558a3 3 0 1 1-4.122-4.121"/><path d="m2 2 20 20"/><path d="M20 20H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 .819-.175"/><path d="M9.695 4.024A2 2 0 0 1 10.004 4h3.993a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v7.344"/></svg></span>'}
        </span>
        <span class="res-type">${resIcon}</span>
        <span class="res-name">${resource.name}</span>
        <span class="res-unit">${resource.unit}</span>
        <span class="res-quantity">${fmt(resource.quantity)}</span>
        <span class="res-price">${fmt(resource.price)}</span>
        <span class="res-sum">${fmt(budgetSum)}</span>
        <span class="res-actual-sum ${isOverBudget ? 'over-budget' : ''}">${totalActualSum > 0 ? fmt(totalActualSum) : '—'}</span>
        <span></span>
    `;

    // Details Row
    const detailsRow = document.createElement('div');
    detailsRow.className = 'details-row';
    detailsRow.innerHTML = renderResourceDetails(resource, expenses);

    // Expand Logic
    const expandBtn = div.querySelector('.expand-btn');
    div.addEventListener('click', () => {
        const isExpanded = detailsRow.classList.contains('active');
        if (isExpanded) {
            detailsRow.classList.remove('active');
            expandBtn.classList.remove('expanded');
            expandBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-narrow-wide-icon lucide-arrow-down-narrow-wide"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h4"/><path d="M11 8h7"/><path d="M11 12h10"/></svg>';
        } else {
            detailsRow.classList.add('active');
            expandBtn.classList.add('expanded');
            expandBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-right-icon lucide-arrow-down-right"><path d="m7 7 10 10"/><path d="M17 7v10H7"/></svg>';
        }
    });

    // Setup Add Form Listeners
    setupAddFormListeners(detailsRow, resource.id);

    container.appendChild(div);
    container.appendChild(detailsRow);
    return container;
}

function renderResourceDetails(resource, expenses) {
    const today = new Date().toISOString().split('T')[0];

    return `
        <table class="expense-history-table">
            <thead>
                <tr>
                    <th style="width:120px;">Дата</th>
                    <th style="width:100px;">Кол-во</th>
                    <th style="width:100px;">Цена</th>
                    <th style="width:120px;">Сумма</th>
                    <th style="width:120px;">Чеки</th>
                    <th>Комментарий</th>
                    <th style="width:50px;"></th>
                </tr>
            </thead>
            <tbody>
                ${expenses.map(exp => `
                    <tr>
                        <td>${exp.date || '—'}</td>
                        <td>${fmt(exp.actual_quantity)}</td>
                        <td>${fmt(exp.actual_price)}</td>
                        <td>${fmt(exp.actual_quantity * exp.actual_price)}</td>
                        <td class="receipt-cell">
                            ${renderReceiptThumb(exp.receipt_photo_1, exp.id, 1)}
                            ${renderReceiptThumb(exp.receipt_photo_2, exp.id, 2)}
                            ${renderReceiptThumb(exp.receipt_photo_3, exp.id, 3)}
                        </td>
                        <td>${exp.comment || ''}</td>
                        <td>
                            <button class="btn-icon btn-delete" onclick="deleteExpense(${exp.id})" title="Удалить">✕</button>
                        </td>
                    </tr>
                `).join('')}
                
                <!-- Add New Row -->
                <tr class="add-row">
                    <td><input type="date" class="table-input exp-date" value="${today}"></td>
                    <td><input type="number" step="0.001" class="table-input exp-qty" placeholder="0"></td>
                    <td><input type="number" step="0.01" class="table-input exp-price" placeholder="0"></td>
                    <td class="exp-sum-display">0</td>
                    <td class="receipt-cell">
                        <div class="receipt-thumb-box add-receipt-box" data-idx="1"><span>+</span></div>
                        <div class="receipt-thumb-box add-receipt-box" data-idx="2"><span>+</span></div>
                        <div class="receipt-thumb-box add-receipt-box" data-idx="3"><span>+</span></div>
                        <input type="file" class="exp-file-1" style="display:none;" accept="image/*">
                        <input type="file" class="exp-file-2" style="display:none;" accept="image/*">
                        <input type="file" class="exp-file-3" style="display:none;" accept="image/*">
                    </td>
                    <td><input type="text" class="table-input exp-comment" placeholder="Комментарий"></td>
                    <td><button class="btn-save-row" title="Сохранить">Сохранить</button></td>
                </tr>
            </tbody>
        </table>
    `;
}

// Миниатюра чека. Раньше это была ссылка target="_blank": браузер
// открывал сырой файл отдельной вкладкой, без масштабирования и
// без возможности удалить снимок.
function renderReceiptThumb(url, expenseId, idx) {
    if (!url) return '';
    return `
        <div class="receipt-thumb-box receipt-thumb-box--filled">
            <img src="${url}" alt="Чек ${idx}" class="receipt-view" data-url="${url}">
            <button type="button" class="receipt-del" title="Удалить чек" aria-label="Удалить чек"
                    data-expense="${expenseId}" data-idx="${idx}">
                <svg class="icon icon--sm" viewBox="0 0 24 24">
                    <path d="M18 6 6 18M6 6l12 12" />
                </svg>
            </button>
        </div>
    `;
}

function setupAddFormListeners(container, resourceId) {
    const qtyInput = container.querySelector('.exp-qty');
    const priceInput = container.querySelector('.exp-price');
    const sumDisplay = container.querySelector('.exp-sum-display');
    const saveBtn = container.querySelector('.btn-save-row');

    // Auto-calc sum
    const updateSum = () => {
        const q = parseFloat(qtyInput.value) || 0;
        const p = parseFloat(priceInput.value) || 0;
        sumDisplay.textContent = fmt(q * p);
    };
    qtyInput.addEventListener('input', updateSum);
    priceInput.addEventListener('input', updateSum);

    // Receipt boxes
    container.querySelectorAll('.add-receipt-box').forEach(box => {
        box.addEventListener('click', () => {
            const idx = box.dataset.idx;
            const input = container.querySelector(`.exp-file-${idx}`);
            input.click();
        });
    });

    // Просмотр чека в полноэкранном просмотрщике
    container.querySelectorAll('.receipt-view').forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            openPhotoViewer(img.dataset.url);
        });
    });

    // Удаление чека
    container.querySelectorAll('.receipt-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!await uiConfirm('Фото чека будет удалено безвозвратно.', {
                title: 'Удалить чек?', confirmText: 'Удалить', danger: true
            })) return;

            const { expense, idx } = btn.dataset;
            try {
                const res = await fetch(`/expenses/${expense}/receipt/${idx}`, { method: 'DELETE' });
                if (!res.ok) throw new Error('Не удалось удалить');
                // Перерисовываем всю вкладку: суммы не меняются, но
                // строка чеков должна обновиться из данных сервера.
                await loadExpenses(selectedExpenseObjectId);
            } catch (err) {
                uiAlert('Ошибка удаления чека: ' + err.message);
            }
        });
    });

    // File inputs change
    [1, 2, 3].forEach(idx => {
        const input = container.querySelector(`.exp-file-${idx}`);
        input.addEventListener('change', (e) => {
            const box = container.querySelector(`.add-receipt-box[data-idx="${idx}"]`);
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    box.innerHTML = `<img src="${ev.target.result}">`;
                };
                reader.readAsDataURL(e.target.files[0]);
            } else {
                box.innerHTML = `<span>+</span>`;
            }
        });
    });

    // Save Button
    saveBtn.addEventListener('click', async () => {
        await saveNewExpense(resourceId, container);
    });
}

async function saveNewExpense(resourceId, container) {
    const dateVal = container.querySelector('.exp-date').value;
    const qtyVal = container.querySelector('.exp-qty').value;
    const priceVal = container.querySelector('.exp-price').value;
    const commentVal = container.querySelector('.exp-comment').value;

    if (!dateVal || !qtyVal || !priceVal) {
        uiAlert('Заполните дату, количество и цену');
        return;
    }

    const data = {
        date: dateVal,
        actual_quantity: parseFloat(qtyVal),
        actual_price: parseFloat(priceVal),
        comment: commentVal
    };

    try {
        // 1. Create expense
        const res = await fetch(`/budget/resources/${resourceId}/expenses/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || 'Failed to save expense');
        }
        const expense = await res.json();

        // 2. Upload photos
        for (let i = 1; i <= 3; i++) {
            const input = container.querySelector(`.exp-file-${i}`);
            if (input.files && input.files[0]) {
                const formData = new FormData();
                formData.append(`receipt_${i}`, input.files[0]);
                await fetch(`/expenses/${expense.id}/receipt/${i}`, {
                    method: 'PUT',
                    body: formData
                });
            }
        }

        // 3. Reload
        await loadExpenses(selectedExpenseObjectId);

    } catch (err) {
        console.error('Save error:', err);
        uiAlert('Ошибка сохранения: ' + err.message);
    }
}

async function deleteExpense(expenseId) {
    if (!await uiConfirm('Запись о расходе будет удалена.', { title: 'Удалить запись?', confirmText: 'Удалить', danger: true })) return;
    try {
        const res = await fetch(`/expenses/${expenseId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        await loadExpenses(selectedExpenseObjectId);
    } catch (err) {
        console.error(err);
        uiAlert('Ошибка удаления');
    }
}

function calcStageBudget(stage) {
    if (!stage.work_types) return 0;
    return stage.work_types.reduce((sum, wt) => sum + calcWTBudget(wt), 0);
}

function calcStageActual(stage) {
    if (!stage.work_types) return 0;
    return stage.work_types.reduce((sum, wt) => sum + calcWTActual(wt), 0);
}

function calcWTBudget(wt) {
    if (!wt.resources) return 0;
    return wt.resources.reduce((sum, r) => sum + ((r.quantity || 0) * (r.price || 0)), 0);
}

function calcWTActual(wt) {
    if (!wt.resources) return 0;
    return wt.resources.reduce((sum, r) => {
        if (!r.expenses) return sum;
        const resTotal = r.expenses.reduce((s, e) => s + (e.actual_quantity * e.actual_price), 0);
        return sum + resTotal;
    }, 0);
}

function findResourceById(id) {
    for (const stage of expenseData) {
        if (!stage.work_types) continue;
        for (const wt of stage.work_types) {
            if (!wt.resources) continue;
            const res = wt.resources.find(r => r.id === id);
            if (res) return res;
        }
    }
    return null;
}

function fmt(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Генерация HTML для скачивания/печати расходов
function downloadExpense() {
    if (!selectedExpenseObjectId || !expenseData || expenseData.length === 0) {
        uiAlert('Нет данных для скачивания');
        return;
    }

    // Получаем название объекта
    const objectName = document.querySelector('#object-list li.selected')?.textContent.trim() || 'Объект';

    // Форматируем дату
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Генерируем HTML таблицы
    let tableHTML = '';
    let workTypeCounter = 1;

    expenseData.forEach((stage) => {
        const stageBudget = calcStageBudget(stage);
        const stageActual = calcStageActual(stage);

        tableHTML += `
            <tr class="stage-row">
                <td colspan="8"><strong>${stage.name}</strong></td>
                <td class="text-right"><strong>Бюджет: ${fmt(stageBudget)}</strong></td>
                <td class="text-right"><strong class="${stageActual > stageBudget ? 'over-budget' : ''}">Факт: ${fmt(stageActual)}</strong></td>
                <td colspan="3"></td>
            </tr>
        `;

        if (stage.work_types && stage.work_types.length > 0) {
            stage.work_types.forEach((wt) => {
                const wtBudget = calcWTBudget(wt);
                const wtActual = calcWTActual(wt);

                tableHTML += `
                    <tr class="work-type-row">
                        <td>${workTypeCounter}.</td>
                        <td colspan="3"><strong>${wt.name} (${wt.unit})</strong></td>
                        <td colspan="4"></td>
                        <td class="text-right"><strong>Бюджет: ${fmt(wtBudget)}</strong></td>
                        <td class="text-right"><strong class="${wtActual > wtBudget ? 'over-budget' : ''}">Факт: ${fmt(wtActual)}</strong></td>
                        <td colspan="3"></td>
                    </tr>
                `;

                if (wt.resources && wt.resources.length > 0) {
                    wt.resources.forEach((res, resIdx) => {
                        const budgetSum = (res.quantity || 0) * (res.price || 0);
                        const expenses = res.expenses || [];
                        const totalActualSum = expenses.reduce((sum, e) => sum + ((e.actual_quantity || 0) * (e.actual_price || 0)), 0);
                        const resType = EXP_RESOURCE_TYPES[res.resource_type] || EXP_RESOURCE_TYPES['Материал'];
                        const photoHtml = res.photo
                            ? `<img src="${res.photo}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 3px;" alt="Фото">`
                            : '<span style="color: #ccc; font-size: 10px;">—</span>';

                        tableHTML += `
                            <tr class="resource-row">
                                <td>${workTypeCounter}.${resIdx + 1}</td>
                                <td>${photoHtml}</td>
                                <td><span class="type-badge" style="background-color: ${resType.color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold;">${res.resource_type}</span></td>
                                <td>${res.name}</td>
                                <td>${res.unit}</td>
                                <td class="text-right">${fmt(res.quantity)}</td>
                                <td class="text-right">${fmt(res.price)}</td>
                                <td class="text-right">${fmt(budgetSum)}</td>
                                <td class="text-right ${totalActualSum > budgetSum ? 'over-budget' : ''}">${totalActualSum > 0 ? fmt(totalActualSum) : '—'}</td>
                                <td colspan="3"></td>
                            </tr>
                        `;

                        // Добавляем строки расходов
                        if (expenses.length > 0) {
                            expenses.forEach((exp, expIdx) => {
                                const expSum = (exp.actual_quantity || 0) * (exp.actual_price || 0);
                                const receiptHtml = [
                                    exp.receipt_photo_1,
                                    exp.receipt_photo_2,
                                    exp.receipt_photo_3
                                ].filter(Boolean).map(url =>
                                    `<img src="${url}" style="width: 30px; height: 30px; object-fit: cover; border-radius: 2px; margin-right: 2px;" alt="Чек">`
                                ).join('') || '—';

                                tableHTML += `
                                    <tr class="expense-row">
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                        <td class="text-right" style="font-size: 11px;">${fmt(exp.actual_quantity)}</td>
                                        <td class="text-right" style="font-size: 11px;">${fmt(exp.actual_price)}</td>
                                        <td class="text-right" style="font-size: 11px;">${fmt(expSum)}</td>
                                        <td></td>
                                        <td style="font-size: 11px; color: #666;">${exp.date || '—'}</td>
                                        <td style="font-size: 11px;">${receiptHtml}</td>
                                        <td style="font-size: 11px; color: #666;">${exp.comment || ''}</td>
                                    </tr>
                                `;
                            });
                        }
                    });
                }

                workTypeCounter++;
            });
        }
    });

    const totalBudget = expenseData.reduce((sum, s) => sum + calcStageBudget(s), 0);
    const totalActual = expenseData.reduce((sum, s) => sum + calcStageActual(s), 0);

    // Полный HTML документ
    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Расход - ${objectName}</title>
    <link rel="stylesheet" href="/frontend/report.css?v=16">
    <!-- Таблица широкая — печатаем альбомно -->
    <style>@page { size: A4 landscape; margin: 10mm; }</style>
</head>
<body>
    <div class="header">
        <div>
            <h1>${objectName}</h1>
            <p>Расход · сформировано ${dateStr}</p>
        </div>
        <img class="pdf-logo" src="/frontend/assets/design_key.png" alt="">
    </div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 30px;">№</th>
                <th style="width: 40px;">Фото</th>
                <th style="width: 80px;">Тип</th>
                <th>Название</th>
                <th style="width: 60px;">Ед.изм</th>
                <th style="width: 70px;">Кол-во (план)</th>
                <th style="width: 80px;">Цена (план)</th>
                <th style="width: 90px;">Сумма (план)</th>
                <th style="width: 90px;">Сумма (факт)</th>
                <th style="width: 100px;">Дата</th>
                <th style="width: 100px;">Чеки</th>
                <th>Комментарий</th>
            </tr>
        </thead>
        <tbody>
            ${tableHTML}
            <tr class="total-row">
                <td colspan="8">ИТОГО:</td>
                <td class="text-right"><strong>Бюджет: ${fmt(totalBudget)}</strong></td>
                <td class="text-right"><strong class="${totalActual > totalBudget ? 'over-budget' : ''}">Факт: ${fmt(totalActual)}</strong></td>
                <td colspan="3"></td>
            </tr>
        </tbody>
    </table>
</body>
</html>
    `;

    // Открываем в новом окне
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();

    // Автоматически открываем диалог печати
    printWindow.onload = function () {
        printWindow.print();
    };
}

/* ---------------------------------------------------------------------
   Заполнение расхода по бюджету

   Позиции, где расход уже заведён, сервер не трогает — повторное
   нажатие ничего не удвоит.
   --------------------------------------------------------------------- */
async function fillExpensesFromBudget(btn) {
    if (!selectedExpenseObjectId) {
        uiAlert('Сначала выберите объект');
        return;
    }

    const ok = await uiConfirm(
        'Проставить план как факт по всем позициям, где расход ещё не заведён? ' +
        'Уже введённые расходы останутся без изменений.',
        { title: 'Заполнить по бюджету', confirmText: 'Заполнить' }
    );
    if (!ok) return;

    btn.disabled = true;
    try {
        const res = await fetch(
            `/objects/${selectedExpenseObjectId}/expenses/fill-from-budget`, { method: 'POST' }
        );
        if (!res.ok) {
            const detail = await res.json().catch(() => null);
            throw new Error(detail?.detail || `Ошибка ${res.status}`);
        }

        const { created } = await res.json();
        await loadExpenses(selectedExpenseObjectId);
        uiAlert(created
            ? `Заполнено позиций: ${created}`
            : 'Все позиции уже заполнены — добавлять нечего');
    } catch (err) {
        uiAlert('Не удалось заполнить: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

// Обработчики кнопок
document.addEventListener('DOMContentLoaded', () => {
    const fillBtn = document.getElementById('fill-expenses');
    if (fillBtn) {
        fillBtn.onclick = () => fillExpensesFromBudget(fillBtn);
    }

    // Кнопка "Скачать" для расходов
    const downloadBtn = document.getElementById('download-expense');
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            downloadExpense();
        };
    }
});

window.loadExpenses = loadExpenses;
window.deleteExpense = deleteExpense;
