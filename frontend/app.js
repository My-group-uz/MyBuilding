/* =====================================================================
   СЕССИЯ

   Проверяется до загрузки данных: без неё каждый запрос отвечал бы
   401 и пользователь видел бы пустой интерфейс с ошибками вместо
   страницы входа.
   ===================================================================== */
(async function guardSession() {
    try {
        const res = await fetch('/api/me');
        const me = await res.json();

        if (!me.authenticated) {
            location.replace('/frontend/login.html');
            return;
        }
        if (me.role === 'superadmin') {
            location.replace('/frontend/admin.html');
            return;
        }

        // Название организации в шапке сайдбара — чтобы было видно,
        // под какой учётной записью открыт интерфейс
        const org = me.organization || {};
        const title = document.querySelector('.sidebar-title');
        if (title && org.name) title.textContent = org.name;

        const logo = document.getElementById('sidebar-logo');
        if (logo && org.logo) {
            logo.src = org.logo;
            logo.style.display = 'inline-block';
        }
    } catch (e) {
        // Сервер недоступен — оставляем интерфейс как есть,
        // запросы данных сами покажут ошибку
        console.warn('Не удалось проверить сессию', e);
    }
})();

async function logout() {
    if (!await uiConfirm('Выйти из системы?', { confirmText: 'Выйти' })) return;
    await fetch('/api/logout', { method: 'POST' });
    location.replace('/frontend/login.html');
}

window.logout = logout;

// --- Брейкпоинты ---
// Единственный источник правды для JS. Значения обязаны совпадать
// с --bp-mobile / --bp-tablet в theme.css.
const BP_MOBILE = 600;
const BP_TABLET = 1024;

function isMobile() { return window.innerWidth <= BP_MOBILE; }
function isTablet() { return window.innerWidth <= BP_TABLET; }

// --- Приход: таблица, модалка, логика через API ---
let incomeRows = [];
let editingIncomeId = null;
let selectedId = null;

// Пароль на вход убран ранее; мёртвый код парольного экрана удалён.

// --- Helper: Format Number (1 000 000) ---
function formatNumber(num) {
    if (num === null || num === undefined) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// --- Helper: Parse Number (remove spaces) ---
function parseNumber(str) {
    if (!str) return 0;
    return parseFloat(str.toString().replace(/\s/g, '')) || 0;
}

// --- Input Formatting for Amount ---
const amountInput = document.getElementById('income-amount');
if (amountInput) {
    amountInput.addEventListener('input', function (e) {
        // Remove non-digits
        let val = e.target.value.replace(/\D/g, '');
        // Format
        e.target.value = val.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    });
}

async function loadIncomes() {
    if (!selectedId) return;
    try {
        const res = await fetch(`/objects/${selectedId}/incomes/`);
        if (!res.ok) {
            throw new Error(`Server error: ${res.status}`);
        }
        incomeRows = await res.json();
        renderIncomeTable();
    } catch (err) {
        console.error("Failed to load incomes:", err);
        uiAlert("Не удалось загрузить данные: " + err.message);
    }
}

function renderIncomeTable() {
    const tbody = document.getElementById('income-tbody');
    tbody.innerHTML = '';
    let total = 0;
    incomeRows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        // Safe fallback for image
        const photoHtml = row.photo
            ? `<img src="${row.photo}?t=${Date.now()}" class="income-photo-thumb income-photo-view" data-idx="${idx}" alt="Фото">`
            : '<span style="color:#ccc;font-size:0.8em;"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-camera-off-icon lucide-camera-off"><path d="M14.564 14.558a3 3 0 1 1-4.122-4.121"/><path d="m2 2 20 20"/><path d="M20 20H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 .819-.175"/><path d="M9.695 4.024A2 2 0 0 1 10.004 4h3.993a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v7.344"/></svg></span>';

        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${row.date}</td>
            <td>${photoHtml}</td>
            <td>${formatNumber(row.amount)}</td>
            <td>${row.sender || row.from || ''}</td>
            <td>${row.receiver || row.to || ''}</td>
            <td>${row.comment || ''}</td>
            <td>
                <button class="icon-btn income-edit" title="Изменить" data-idx="${idx}">
                    <svg class="icon icon--sm" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button class="icon-btn icon-btn--danger income-delete" title="Удалить" data-idx="${idx}">
                    <svg class="icon icon--sm" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
        total += Number(row.amount) || 0;
    });
    document.getElementById('income-total').textContent = formatNumber(total);

    // Кнопки удалить
    tbody.querySelectorAll('.income-delete').forEach(btn => {
        btn.onclick = async function () {
            const idx = Number(btn.dataset.idx);
            const row = incomeRows[idx];
            if (await uiConfirm('Удалить эту строку?', { confirmText: 'Удалить', danger: true })) {
                try {
                    const res = await fetch(`/objects/${selectedId}/incomes/${row.id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error('Delete failed');
                    await loadIncomes();
                } catch (e) {
                    uiAlert("Ошибка удаления: " + e.message);
                }
            }
        };
    });
    // Кнопки редактировать
    tbody.querySelectorAll('.income-edit').forEach(btn => {
        btn.onclick = function () {
            const idx = Number(btn.dataset.idx);
            const row = incomeRows[idx];
            document.getElementById('income-date').value = row.date;
            document.getElementById('income-amount').value = formatNumber(row.amount);
            document.getElementById('income-from').value = row.sender || row.from || '';
            document.getElementById('income-to').value = row.receiver || row.to || '';
            document.getElementById('income-comment').value = row.comment;
            document.getElementById('income-edit-index').value = idx;
            document.getElementById('income-modal').dataset.photo = row.photo || '';
            editingIncomeId = row.id;
            document.getElementById('income-modal').style.display = 'flex';
        };
    });
    // Просмотр фото
    tbody.querySelectorAll('.income-photo-view').forEach(img => {
        img.onclick = function () {
            const idx = Number(img.dataset.idx);
            const row = incomeRows[idx];
            if (row.photo) openPhotoViewer(row.photo);
        };
    });

    // Таблица перерисована — возвращаем действующий фильтр,
    // иначе скрытые строки всплывут при заполненном поле поиска.
    if (window.reapplySearch) window.reapplySearch('income');
}

document.getElementById('add-income').onclick = function () {
    document.getElementById('income-modal').style.display = 'flex';
    document.getElementById('income-form').reset();
    document.getElementById('income-photo').value = '';
    document.getElementById('income-modal').dataset.photo = '';
    document.getElementById('income-edit-index').value = '';
    document.getElementById('income-date').value = new Date().toISOString().slice(0, 10);
    editingIncomeId = null;
};

/* =====================================================================
   ПРОСМОТР ФОТО

   Единая точка открытия для всех вкладок: приход, бюджет, расход,
   рендеры. Раньше каждая проставляла src и display вручную, из-за
   чего кнопка «открыть оригинал» появилась бы только в одном месте.
   ===================================================================== */
function openPhotoViewer(src) {
    if (!src) return;

    const modal = document.getElementById('photo-modal');
    const img = document.getElementById('photo-modal-img');
    const open = document.getElementById('photo-modal-open');

    img.src = src;
    if (open) open.href = src;

    modal.style.display = 'flex';
    // Фон страницы не должен прокручиваться под открытым снимком
    document.body.style.overflow = 'hidden';
}

function closePhotoViewer() {
    const modal = document.getElementById('photo-modal');
    if (!modal || modal.style.display === 'none') return;

    modal.style.display = 'none';
    // Сбрасываем src: иначе следующий снимок мелькнёт предыдущим,
    // пока грузится новый.
    document.getElementById('photo-modal-img').src = '';
    document.body.style.overflow = '';
}

window.openPhotoViewer = openPhotoViewer;
window.closePhotoViewer = closePhotoViewer;

// Закрытие модалок (универсальное)
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = function () {
        if (btn.id === 'photo-modal-close') return closePhotoViewer();
        btn.closest('.modal').style.display = 'none';
    };
});

// Закрытие по клику на фон
window.onclick = function (event) {
    if (event.target.id === 'photo-modal') {
        // Клик по самому снимку сюда не попадает — только по подложке
        return closePhotoViewer();
    }
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePhotoViewer();
});

document.getElementById('income-photo').onchange = function (e) {
    // Предпросмотр не нужен, фото отправляется на сервер
};

document.getElementById('income-form').onsubmit = async function (e) {
    e.preventDefault();
    const date = document.getElementById('income-date').value;
    const amountStr = document.getElementById('income-amount').value;
    const amount = parseNumber(amountStr);
    const sender = document.getElementById('income-from').value;
    const receiver = document.getElementById('income-to').value;
    const comment = document.getElementById('income-comment').value;
    const photoInput = document.getElementById('income-photo');
    // Валидация обязательных полей
    if (!date || isNaN(amount) || amount <= 0) {
        uiAlert('Заполните дату и сумму (число > 0)');
        return false;
    }
    const formData = new FormData();
    formData.append('date', date);
    formData.append('amount', amount);
    formData.append('sender', sender);
    formData.append('receiver', receiver);
    formData.append('comment', comment);
    if (photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
    }
    let response;
    try {
        if (editingIncomeId) {
            response = await fetch(`/objects/${selectedId}/incomes/${editingIncomeId}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            response = await fetch(`/objects/${selectedId}/incomes/`, {
                method: 'POST',
                body: formData
            });
        }
        if (!response.ok) {
            const err = await response.text();
            uiAlert('Ошибка: ' + err);
            return false;
        }
    } catch (err) {
        uiAlert('Ошибка сети: ' + err);
        return false;
    }
    document.getElementById('income-modal').style.display = 'none';
    await loadIncomes();
    return false;
};

async function fetchObjects() {
    const res = await fetch('/objects/');
    return res.json();
}

// Двигает белую «таблетку» под активную вкладку нижней панели.
// Позиция передаётся в CSS переменной, сам сдвиг делает transform —
// это дешевле, чем менять left и вызывать перерасчёт раскладки.
function moveTabbarPill(tab) {
    const tabbar = document.getElementById('mobile-tabbar');
    if (!tabbar) return;

    const buttons = [...tabbar.querySelectorAll('.tabbar-btn')];
    const index = buttons.findIndex(b => b.dataset.tab === tab);
    if (index < 0) return;

    tabbar.style.setProperty('--tab-count', buttons.length);
    tabbar.style.setProperty('--active-index', index);
    // Класс включает анимацию — только после первой установки позиции,
    // иначе таблетка приедет из левого края при восстановлении вкладки.
    requestAnimationFrame(() => tabbar.classList.add('ready'));
}

function setActiveTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    moveTabbarPill(tab);
    document.querySelectorAll('.tab-content').forEach(div => {
        div.style.display = div.id === 'tab-' + tab ? '' : 'none';
    });
    // Save active tab
    localStorage.setItem('activeTab', tab);

    // Если выбрана вкладка "приход" — обновить данные
    if (tab === 'income') {
        loadIncomes();
    }

    // Если выбрана вкладка "бюджет" — обновить данные
    if (tab === 'budget' && selectedId && window.loadBudget) {
        window.loadBudget(selectedId);
    }

    // Если выбрана вкладка "расход" — обновить данные
    if (tab === 'expense' && selectedId && window.loadExpenses) {
        window.loadExpenses(selectedId);
    }

    // Если выбрана вкладка "аналитика" — обновить данные
    if (tab === 'analysis' && selectedId && window.loadAnalysis) {
        window.loadAnalysis(selectedId);
    } else if (window.stopHeroSlider) {
        // Слайдер рендеров крутится по таймеру: на скрытой вкладке
        // он жёг бы кадры впустую.
        window.stopHeroSlider();
    }

    // Если выбрана вкладка "настройки" — подтянуть данные объекта
    if (tab === 'settings' && selectedId && window.loadSettings) {
        window.loadSettings(selectedId);
    }
}

// Вкладки переключение (инициализация сразу после определения)
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => setActiveTab(btn.dataset.tab);
    });
});

async function renderList() {
    const list = document.getElementById('object-list');
    list.innerHTML = '';
    const objects = await fetchObjects();
    objects.forEach((obj, index) => {
        const li = document.createElement('li');
        // Icon SVG
        const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house-plus-icon lucide-house-plus" style="margin-right: 8px; color: #555;"><path d="M12.35 21H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v2.35"/><path d="M14.8 12.4A1 1 0 0 0 14 12h-4a1 1 0 0 0-1 1v8"/><path d="M15 18h6"/><path d="M18 15v6"/></svg>`;
        li.innerHTML = `${icon} <span>${index + 1}. ${obj.name}</span>`;
        // В свёрнутом сайдбаре подпись скрыта — название показываем подсказкой
        li.title = `${index + 1}. ${obj.name}`;
        li.dataset.id = obj.id; // Store ID for restoration
        // Чистое имя без порядкового номера: его сверяют при удалении
        li.dataset.name = obj.name;
        li.onclick = () => {
            selectObject(obj.id, li);
            // Close sidebar on mobile selection
            if (isMobile()) closeSidebar();
        };
        if (obj.id === selectedId) li.classList.add('selected');
        list.appendChild(li);
    });

    // Restore state after list render
    restoreState();
}

function showTabs(show) {
    const row = document.getElementById('tabs-actions-row');
    const tabs = document.getElementById('tabs');
    const actions = document.getElementById('object-actions');
    const tabbar = document.getElementById('mobile-tabbar');

    // Нижняя панель имеет смысл только при выбранном объекте.
    // Видимость по ширине экрана решает CSS — здесь только факт наличия.
    if (tabbar) tabbar.hidden = !show;

    if (show) {
        row.style.display = 'flex';
        tabs.style.display = 'flex';
        actions.style.display = 'flex';
    } else {
        tabs.style.display = 'none';
        actions.style.display = 'none';
        // On mobile, keep the row visible so the sidebar toggle button is accessible
        if (isMobile()) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    }
    document.querySelectorAll('.tab-content').forEach(div => div.style.display = 'none');
}

window.addEventListener('resize', () => {
    if (!selectedId) {
        showTabs(false);
    }
});

function selectObject(id, li) {
    selectedId = id;
    // Save selected object
    localStorage.setItem('selectedId', id);

    document.querySelectorAll('#object-list li').forEach(el => el.classList.remove('selected'));
    if (li) li.classList.add('selected');

    showTabs(true);

    // Restore tab or default to 'income'
    const savedTab = localStorage.getItem('activeTab') || 'income';
    setActiveTab(savedTab);

    loadIncomes().then(() => {
        // Restore scroll position after data load
        const scrollY = localStorage.getItem('scrollY');
        if (scrollY) {
            window.scrollTo(0, parseInt(scrollY));
        }
    });
}

function clearSelection() {
    selectedId = null;
    localStorage.removeItem('selectedId');
    showTabs(false);
    document.querySelectorAll('#object-list li').forEach(el => el.classList.remove('selected'));
}

// --- State Restoration ---
function restoreState() {
    const savedId = localStorage.getItem('selectedId');
    if (savedId) {
        const id = parseInt(savedId);
        // Find list item
        const li = document.querySelector(`#object-list li[data-id="${id}"]`);
        if (li) {
            selectObject(id, li);
        }
    }
}

// Save scroll position on unload
window.addEventListener('beforeunload', () => {
    localStorage.setItem('scrollY', window.scrollY);
});

document.getElementById('add-object').onclick = async () => {
    const name = await uiPrompt('Как назвать новый объект?', {
        title: 'Новый объект',
        placeholder: 'Например: Imperial A blok 7-qavat',
        confirmText: 'Создать'
    });
    if (!name || !name.trim()) return;
    await fetch('/objects/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    });
    renderList();
};

// Переименование и удаление доступны из вкладки «Настройки»
// (settings.js). Здесь оставлены сами обработчики: меню «⋯» на
// мобильных кликает эти кнопки программно.
document.getElementById('rename-btn').onclick = async () => {
    if (!selectedId) return;
    const current = document.querySelector('#object-list li.selected')?.dataset.name || '';
    const name = await uiPrompt('Новое название объекта', {
        title: 'Переименовать',
        value: current,
        confirmText: 'Сохранить'
    });
    if (!name || !name.trim()) return;
    await fetch(`/objects/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    });
    renderList();
    // Настройки и витрина в аналитике показывают название — обновляем
    if (window.loadSettings) window.loadSettings(selectedId);
};

document.getElementById('share-btn').onclick = async () => {
    if (!selectedId) return;
    try {
        const res = await fetch(`/objects/${selectedId}/share`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to generate share link');
        const data = await res.json();
        const fullUrl = window.location.origin + data.url;
        
        // Copy to clipboard
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(fullUrl);
            uiAlert(fullUrl, { title: 'Ссылка скопирована' });
        } else {
            // Буфер недоступен (не-HTTPS) — показываем ссылку для ручного копирования
            uiPrompt('Скопируйте ссылку вручную', {
                title: 'Ссылка на объект',
                value: fullUrl,
                confirmText: 'Готово'
            });
        }
    } catch (err) {
        uiAlert('Ошибка создания ссылки: ' + err.message);
    }
};

document.getElementById('delete-btn').onclick = async () => {
    if (!selectedId) return;

    // Название берём из списка слева: оно там всегда актуально
    const li = document.querySelector('#object-list li.selected');
    const name = li?.dataset.name || 'объект';

    // Ввод названия вместо «Вы уверены?»: удаление уносит с собой
    // весь бюджет, приход и расход, а обычное подтверждение
    // пролистывают не читая.
    if (!await uiConfirmByName(name)) return;

    await fetch(`/objects/${selectedId}`, { method: 'DELETE' });
    clearSelection();
    renderList();
};

/* =====================================================================
   САЙДБАР

   Два независимых режима:
     • десктоп (>600px) — панель всегда в потоке, класс `collapsed`
       сжимает её до полосы с иконками. Состояние переживает перезагрузку.
     • мобильный (≤600px) — панель выезжает поверх контента (класс `open`)
       с затемнением. Закрывается тапом вне, свайпом влево и Esc.
   ===================================================================== */
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const sidebarClose = document.getElementById('sidebar-close');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const sidebarCollapseBtn = document.getElementById('sidebar-collapse');

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

// --- Мобильный режим: выезжающая панель ---
function openSidebar() {
    sidebar.classList.add('open');
    if (sidebarToggle) sidebarToggle.style.display = 'none';
    if (sidebarBackdrop) {
        sidebarBackdrop.hidden = false;
        // Кадр задержки — иначе переход opacity не проигрывается,
        // т.к. элемент появляется и меняет прозрачность в одном кадре.
        requestAnimationFrame(() => sidebarBackdrop.classList.add('visible'));
    }
}

function closeSidebar() {
    sidebar.classList.remove('open');
    // Пустая строка, а не 'block': видимость снова решает CSS.
    if (sidebarToggle) sidebarToggle.style.display = '';
    if (sidebarBackdrop) {
        sidebarBackdrop.classList.remove('visible');
        setTimeout(() => {
            if (!sidebar.classList.contains('open')) sidebarBackdrop.hidden = true;
        }, 250);
    }
}

if (sidebarToggle) sidebarToggle.onclick = openSidebar;
if (sidebarClose) sidebarClose.onclick = closeSidebar;
if (sidebarBackdrop) sidebarBackdrop.onclick = closeSidebar;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
});

// Свайп влево по панели закрывает её
(function enableSwipeToClose() {
    let startX = 0, startY = 0, tracking = false;

    sidebar.addEventListener('touchstart', (e) => {
        if (!sidebar.classList.contains('open')) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
    }, { passive: true });

    sidebar.addEventListener('touchmove', (e) => {
        if (!tracking) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        // Горизонтальный жест влево, и он длиннее вертикального —
        // иначе это обычная прокрутка списка объектов.
        if (dx < -50 && Math.abs(dx) > Math.abs(dy)) {
            tracking = false;
            closeSidebar();
        }
    }, { passive: true });

    sidebar.addEventListener('touchend', () => { tracking = false; }, { passive: true });
})();

// --- Десктопный режим: сворачивание в полосу ---
function applySidebarCollapsed(collapsed) {
    sidebar.classList.toggle('collapsed', collapsed);
    if (sidebarCollapseBtn) {
        sidebarCollapseBtn.title = collapsed ? 'Развернуть меню' : 'Свернуть меню';
        sidebarCollapseBtn.setAttribute('aria-label', sidebarCollapseBtn.title);
    }
}

if (sidebarCollapseBtn) {
    sidebarCollapseBtn.onclick = () => {
        const collapsed = !sidebar.classList.contains('collapsed');
        applySidebarCollapsed(collapsed);
        try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (e) { /* приватный режим */ }
    };
}

// Восстанавливаем состояние при загрузке
try {
    applySidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
} catch (e) {
    applySidebarCollapsed(false);
}

// При переходе десктоп → мобильный гасим выехавшую панель,
// чтобы она не осталась висеть поверх контента.
window.addEventListener('resize', () => {
    if (!isMobile() && sidebar.classList.contains('open')) closeSidebar();
});

/* =====================================================================
   МЕНЮ «⋯» (мобильные)

   Своих обработчиков не заводит: переиспользует уже настроенные
   #share-btn / #rename-btn / #delete-btn через программный клик.
   Логика действий остаётся в одном месте.
   ===================================================================== */
const moreBtn = document.getElementById('more-btn');
const moreSheet = document.getElementById('more-sheet');

function openMoreSheet() {
    if (moreSheet) moreSheet.hidden = false;
}

function closeMoreSheet() {
    if (moreSheet) moreSheet.hidden = true;
}

if (moreBtn) moreBtn.onclick = openMoreSheet;

if (moreSheet) {
    moreSheet.addEventListener('click', (e) => {
        // Клик мимо панели (по затемнению) — закрыть
        if (e.target === moreSheet) return closeMoreSheet();

        const item = e.target.closest('.more-sheet__item');
        if (!item) return;

        const action = item.dataset.action;
        closeMoreSheet();
        if (action === 'cancel') return;

        const target = document.getElementById(`${action}-btn`);
        // Кнопки скрыты на мобильных через CSS, но в DOM остаются —
        // программный клик срабатывает штатно.
        if (target) target.click();
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && moreSheet && !moreSheet.hidden) closeMoreSheet();
});

// Генерация HTML для скачивания/печати прихода
function downloadIncome() {
    if (!selectedId || !incomeRows || incomeRows.length === 0) {
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
    let total = 0;

    incomeRows.forEach((row, idx) => {
        const photoHtml = row.photo
            ? `<img src="${row.photo}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 3px;" alt="Фото">`
            : '<span style="color: #ccc; font-size: 10px;">—</span>';

        tableHTML += `
            <tr>
                <td>${idx + 1}</td>
                <td>${row.date}</td>
                <td>${photoHtml}</td>
                <td class="text-right">${formatNumber(row.amount)}</td>
                <td>${row.sender || row.from || ''}</td>
                <td>${row.receiver || row.to || ''}</td>
                <td>${row.comment || ''}</td>
            </tr>
        `;
        total += Number(row.amount) || 0;
    });

    // Полный HTML документ
    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Приход - ${objectName}</title>
    <link rel="stylesheet" href="/frontend/report.css?v=16">
</head>
<body>
    <div class="header">
        <div>
            <h1>${objectName}</h1>
            <p>Приход · сформировано ${dateStr}</p>
        </div>
        <img class="pdf-logo" src="/frontend/assets/design_key.png" alt="">
    </div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 30px;">№</th>
                <th style="width: 100px;">Дата</th>
                <th style="width: 60px;">Фото</th>
                <th style="width: 120px;">Сумма</th>
                <th style="width: 150px;">Кто передал</th>
                <th style="width: 150px;">Кто получил</th>
                <th>Комментарии</th>
            </tr>
        </thead>
        <tbody>
            ${tableHTML}
            <tr class="total-row">
                <td colspan="3">ИТОГО:</td>
                <td class="text-right">${formatNumber(total)}</td>
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

// Download Button Logic
document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('download-income');
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            downloadIncome();
        };
    }
    // Кнопка "Скачать" для анализа — вызывает уже существующий экспортный метод
    const downloadAnalysisBtn = document.getElementById('download-analysis');
    if (downloadAnalysisBtn) {
        downloadAnalysisBtn.onclick = () => {
            if (window.exportAnalysisReport) {
                window.exportAnalysisReport();
            } else {
                uiAlert('Экспорт анализа недоступен');
            }
        };
    }
});

// При старте скрываем вкладки и кнопки
// clearSelection(); // Don't clear on start, let restoreState handle it
renderList();

// Try to show sidebar logo if file exists at frontend/assets/design_key.png
try {
    const logoEl = document.getElementById('sidebar-logo');
    if (logoEl) {
        const img = new Image();
        img.onload = () => {
            logoEl.src = img.src;
            logoEl.style.display = 'inline-block';
        };
        img.onerror = () => {
            // keep hidden if not found
        };
        img.src = 'assets/design_key.png';
    }
} catch (e) { /* ignore */ }
