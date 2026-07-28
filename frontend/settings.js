// ===== ВКЛАДКА «НАСТРОЙКИ» =====
//
// Здесь правятся паспортные данные объекта: название, площадь, сроки
// и фоторендеры. Раньше этот блок открывал вкладку «Аналитика» и занимал
// первый экран полями, к которым возвращаются раз в жизни объекта.
//
// Состояние и работа с фото переиспользуются из analysis.js
// (общий объект analysisData, renderImageUploadGrid, loadAnalysisPhotos):
// фото — те же самые, дублировать логику незачем.

async function loadSettings(objectId) {
    if (!objectId) return;
    analysisData.objectId = objectId;

    await loadAnalysisPhotos(objectId);
    renderSettings();

    // Метаданные подтягиваем после отрисовки: поля уже в DOM
    try {
        const res = await fetch(`/objects/${objectId}`);
        if (!res.ok) return;
        const obj = await res.json();

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value == null ? '' : value;
        };

        setValue('obj-name', obj.name);
        setValue('obj-address', obj.address);
        setValue('obj-customer', obj.customer);
        setValue('obj-customer-phone', obj.customer_phone);
        setValue('obj-area', obj.area ?? 0);
        setValue('obj-contract-sum', formatNum(obj.contract_sum ?? 0));
        setValue('obj-start-date', obj.start_date);
        setValue('obj-end-date', obj.end_date);

        // Зеркалим в общее состояние — витрина «Аналитики» читает отсюда
        analysisData.objectName = obj.name || 'Объект';
        analysisData.address = obj.address || '';
        analysisData.customer = obj.customer || '';
        analysisData.customerPhone = obj.customer_phone || '';
        analysisData.area = parseFloat(obj.area) || 0;
        analysisData.contractSum = parseFloat(obj.contract_sum) || 0;
        analysisData.startDate = obj.start_date || null;
        analysisData.endDate = obj.end_date || null;
    } catch (err) {
        console.warn('Не удалось загрузить данные объекта', err);
    }
}

// Название сохраняется отдельно: пустое имя недопустимо, и список
// объектов слева нужно перерисовать.
async function onObjectNameChange() {
    const input = document.getElementById('obj-name');
    if (!input) return;

    const value = input.value.trim();
    if (!value) {
        // Возвращаем прежнее имя вместо молчаливого сохранения пустого
        input.value = analysisData.objectName || '';
        uiAlert('Название не может быть пустым', { title: 'Название объекта' });
        return;
    }

    await fetch(`/objects/${analysisData.objectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: value })
    });

    analysisData.objectName = value;
    if (typeof renderList === 'function') renderList();
}

window.onObjectNameChange = onObjectNameChange;

// Сумма договора вводится с разделителями разрядов: «120 000 000»
// читается, «120000000» — нет. Поле текстовое, поэтому форматируем
// на лету и сохраняем позицию курсора.
function onContractSumInput(event) {
    const input = event.target;
    const digitsBefore = input.value.slice(0, input.selectionStart).replace(/\D/g, '').length;

    const digits = input.value.replace(/\D/g, '');
    input.value = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    // Возвращаем курсор туда же по счёту цифр, а не по индексу символа:
    // добавленные пробелы иначе сдвигали бы его вправо.
    let pos = 0, seen = 0;
    while (pos < input.value.length && seen < digitsBefore) {
        if (/\d/.test(input.value[pos])) seen++;
        pos++;
    }
    input.setSelectionRange(pos, pos);
}

window.onContractSumInput = onContractSumInput;

function renderSettings() {
    const container = document.getElementById('settings-container');
    if (!container) return;

    if (!analysisData.analysisPhotos) analysisData.analysisPhotos = [null, null, null, null];

    // Значения подставляются прямо в разметку: карточка перерисовывается
    // целиком после загрузки фото, и без этого поля обнулялись бы.
    const val = (v) => String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    container.innerHTML = `
        <div class="settings-card">
            <h2 class="settings-title">Объект</h2>
            <div class="settings-grid">
                <div class="settings-grid__wide">
                    <label class="label" for="obj-name">Название</label>
                    <input class="field" type="text" id="obj-name" placeholder="Название объекта"
                        value="${val(analysisData.objectName)}" onchange="onObjectNameChange()">
                </div>
                <div class="settings-grid__wide">
                    <label class="label" for="obj-address">Адрес объекта</label>
                    <input class="field" type="text" id="obj-address" placeholder="Город, улица, дом"
                        value="${val(analysisData.address)}" onchange="onObjectFieldChange()">
                </div>
                <div>
                    <label class="label" for="obj-customer">Заказчик</label>
                    <input class="field" type="text" id="obj-customer" placeholder="Имя заказчика"
                        value="${val(analysisData.customer)}" onchange="onObjectFieldChange()">
                </div>
                <div>
                    <label class="label" for="obj-customer-phone">Телефон заказчика</label>
                    <input class="field" type="tel" id="obj-customer-phone" placeholder="+998 90 123 45 67"
                        value="${val(analysisData.customerPhone)}" onchange="onObjectFieldChange()">
                </div>
                <div>
                    <label class="label" for="obj-area">Общая площадь (м²)</label>
                    <input class="field" type="number" id="obj-area" min="0" step="0.01"
                        value="${val(analysisData.area || 0)}" oninput="onObjectFieldChange()">
                </div>
                <div>
                    <label class="label" for="obj-contract-sum">Сумма договора (сум)</label>
                    <input class="field" type="text" id="obj-contract-sum" inputmode="numeric"
                        placeholder="0" value="${val(formatNum(analysisData.contractSum || 0))}"
                        oninput="onContractSumInput(event)" onchange="onObjectFieldChange()">
                </div>
                <div>
                    <label class="label" for="obj-start-date">Дата начала</label>
                    <input class="field" type="date" id="obj-start-date"
                        value="${val(analysisData.startDate)}" onchange="onObjectFieldChange()">
                </div>
                <div>
                    <label class="label" for="obj-end-date">Дата окончания</label>
                    <input class="field" type="date" id="obj-end-date"
                        value="${val(analysisData.endDate)}" onchange="onObjectFieldChange()">
                </div>
            </div>
        </div>

        <div class="settings-card">
            <h2 class="settings-title">Фоторендеры</h2>
            <div class="analysis-object-photos">
                ${renderImageUploadGrid()}
            </div>
            <p class="settings-hint">До четырёх изображений: фасад, план, интерьер</p>
        </div>

        <!-- Управление объектом. Раньше эти кнопки жили в верхней панели
             и были доступны с любой вкладки — удаление оказывалось
             в одном клике от обычной работы. -->
        <!-- Отдельной кнопки «Переименовать» здесь нет: название правится
             прямо в поле выше. Дублировать одно действие двумя способами
             только запутывает. -->
        <div class="settings-card settings-card--danger">
            <h2 class="settings-title">Удаление объекта</h2>
            <div class="settings-row">
                <div class="settings-row__text">
                    <div class="settings-row__label">Удалить объект безвозвратно</div>
                    <div class="settings-row__hint">
                        Вместе с ним удалятся приход, бюджет, расход и фото. Отменить нельзя.
                    </div>
                </div>
                <button type="button" class="btn btn--secondary btn--danger" id="settings-delete">Удалить</button>
            </div>
        </div>

        <div class="settings-card">
            <h2 class="settings-title">Учётная запись</h2>
            <div class="settings-row">
                <div class="settings-row__text">
                    <div class="settings-row__label">Выйти из системы</div>
                    <div class="settings-row__hint">Потребуется повторный вход</div>
                </div>
                <button type="button" class="btn btn--secondary" id="settings-logout">Выйти</button>
            </div>
        </div>
    `;

    const logoutBtn = document.getElementById('settings-logout');
    if (logoutBtn) logoutBtn.onclick = () => logout();

    // Логика удаления живёт в app.js — здесь только вызов, чтобы
    // подтверждение вводом названия было ровно одним кодом.
    const deleteBtn = document.getElementById('settings-delete');
    if (deleteBtn) deleteBtn.onclick = () => document.getElementById('delete-btn').click();
}

// Правка названия — обычным полем ввода (onObjectNameChange).
// Прежняя инлайн-правка по клику удалена: одно действие двумя
// способами только запутывало.

window.loadSettings = loadSettings;
