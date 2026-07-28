// ===== АДМИНКА ОРГАНИЗАЦИЙ =====
//
// Доступна только суперадминистратору. Список выводится карточками:
// таблица на телефоне требует бокового скролла, а здесь у записи
// всего шесть полей.

let organizations = [];
let editingId = null;
let pendingLogo = null;   // файл, выбранный до сохранения новой организации

const listEl = document.getElementById('org-list');
const modal = document.getElementById('org-modal');
const form = document.getElementById('org-form');
const errorBox = document.getElementById('org-error');

function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

/* ---------------------------------------------------------------------
   Загрузка
   --------------------------------------------------------------------- */
async function loadOrganizations() {
    try {
        const res = await fetch('/api/admin/organizations');
        if (res.status === 403 || res.status === 401) {
            location.replace('/frontend/login.html');
            return;
        }
        organizations = await res.json();
        render();
    } catch (err) {
        listEl.innerHTML = '<p class="search-empty">Не удалось загрузить список</p>';
    }
}

/* ---------------------------------------------------------------------
   Отрисовка
   --------------------------------------------------------------------- */
function render() {
    const query = (document.getElementById('search-org').value || '').toLowerCase().trim();
    const rows = organizations.filter(o => !query || [
        o.name, o.full_name, o.email, o.phone
    ].some(v => (v || '').toLowerCase().includes(query)));

    document.getElementById('org-count').textContent =
        organizations.length ? `${organizations.length}` : '';

    if (rows.length === 0) {
        listEl.innerHTML = `<p class="search-empty">${organizations.length
            ? 'Ничего не найдено'
            : 'Пока нет ни одной организации'}</p>`;
        return;
    }

    listEl.innerHTML = rows.map(o => `
        <article class="org-card ${o.status === 'blocked' ? 'org-card--blocked' : ''}">
            <div class="org-card__head">
                <div class="org-card__logo">
                    ${o.logo
                        ? `<img src="${esc(o.logo)}" alt="">`
                        : `<span>${esc((o.name || '?').charAt(0).toUpperCase())}</span>`}
                </div>
                <div class="org-card__ident">
                    <h2 class="org-card__name">${esc(o.name)}</h2>
                    ${o.full_name ? `<p class="org-card__person">${esc(o.full_name)}</p>` : ''}
                </div>
                <span class="org-status org-status--${o.status}">
                    ${o.status === 'active' ? 'Активна' : 'Заблокирована'}
                </span>
            </div>

            <dl class="org-card__facts">
                <div><dt>Почта</dt><dd>${esc(o.email)}</dd></div>
                <div><dt>Телефон</dt><dd>${o.phone ? esc(o.phone) : '—'}</dd></div>
                <div><dt>Объектов</dt><dd>${o.objects_count ?? 0}</dd></div>
                <div><dt>Google</dt><dd>${o.has_google ? 'привязан' : '—'}</dd></div>
            </dl>

            <div class="org-card__actions">
                <button class="btn btn--secondary" data-act="edit" data-id="${o.id}">Изменить</button>
                <button class="btn btn--secondary" data-act="toggle" data-id="${o.id}">
                    ${o.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                </button>
                <button class="btn btn--secondary btn--danger" data-act="delete" data-id="${o.id}">Удалить</button>
            </div>
        </article>
    `).join('');
}

/* ---------------------------------------------------------------------
   Модальное окно
   --------------------------------------------------------------------- */
function openModal(org) {
    editingId = org ? org.id : null;
    pendingLogo = null;

    document.getElementById('org-modal-title').textContent =
        org ? 'Изменить организацию' : 'Новая организация';
    document.getElementById('password-hint').textContent =
        org ? 'Оставьте пустым, чтобы не менять' : 'Минимум 4 символа';

    document.getElementById('org-name').value = org?.name || '';
    document.getElementById('org-full-name').value = org?.full_name || '';
    document.getElementById('org-phone').value = org?.phone || '';
    document.getElementById('org-email').value = org?.email || '';
    document.getElementById('org-password').value = '';
    document.getElementById('org-status').value = org?.status || 'active';
    document.getElementById('org-logo').value = '';

    const preview = document.getElementById('org-logo-preview');
    preview.innerHTML = org?.logo ? `<img src="${esc(org.logo)}" alt="">` : '';

    errorBox.hidden = true;
    modal.hidden = false;
    document.getElementById('org-name').focus();
}

function closeModal() {
    modal.hidden = true;
    editingId = null;
    pendingLogo = null;
}

function showFormError(text) {
    errorBox.textContent = text;
    errorBox.hidden = !text;
}

/* ---------------------------------------------------------------------
   Сохранение
   --------------------------------------------------------------------- */
async function uploadLogo(orgId, file) {
    const fd = new FormData();
    fd.append('logo', file, file.name);
    const res = await fetch(`/api/admin/organizations/${orgId}/logo`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Не удалось загрузить логотип');
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showFormError('');

    const payload = {
        name: document.getElementById('org-name').value.trim(),
        full_name: document.getElementById('org-full-name').value.trim(),
        phone: document.getElementById('org-phone').value.trim(),
        email: document.getElementById('org-email').value.trim(),
        status: document.getElementById('org-status').value
    };

    const password = document.getElementById('org-password').value;
    // При правке пустой пароль означает «не менять», при создании — обязателен
    if (password) payload.password = password;
    if (!editingId && !password) {
        showFormError('Задайте пароль для входа');
        return;
    }

    const saveBtn = document.getElementById('org-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохраняем…';

    try {
        const url = editingId
            ? `/api/admin/organizations/${editingId}`
            : '/api/admin/organizations';

        const res = await fetch(url, {
            method: editingId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showFormError(data.detail || 'Не удалось сохранить');
            return;
        }

        // Логотип грузим вторым запросом: у новой организации id
        // появляется только после создания.
        if (pendingLogo) await uploadLogo(data.id, pendingLogo);

        closeModal();
        await loadOrganizations();
    } catch (err) {
        showFormError(err.message || 'Ошибка сохранения');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить';
    }
});

document.getElementById('org-logo').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    pendingLogo = file;

    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById('org-logo-preview').innerHTML =
            `<img src="${ev.target.result}" alt="">`;
    };
    reader.readAsDataURL(file);
});

/* ---------------------------------------------------------------------
   Действия над карточками
   --------------------------------------------------------------------- */
listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;

    const org = organizations.find(o => o.id === Number(btn.dataset.id));
    if (!org) return;

    if (btn.dataset.act === 'edit') return openModal(org);

    if (btn.dataset.act === 'toggle') {
        const next = org.status === 'active' ? 'blocked' : 'active';
        const ok = await uiConfirm(
            next === 'blocked'
                ? `Организация «${org.name}» потеряет доступ. Её данные сохранятся.`
                : `Организация «${org.name}» снова сможет входить.`,
            { title: next === 'blocked' ? 'Заблокировать?' : 'Разблокировать?', danger: next === 'blocked' }
        );
        if (!ok) return;

        await fetch(`/api/admin/organizations/${org.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: next })
        });
        return loadOrganizations();
    }

    if (btn.dataset.act === 'delete') {
        // Ввод названия: удаление уносит все объекты организации
        const ok = await uiConfirmByName(org.name, {
            title: 'Удаление организации',
            message: `Вместе с организацией удалятся все её объекты, бюджеты, приходы и расходы (${org.objects_count ?? 0} об.). Отменить нельзя.\n\nДля подтверждения введите название:`
        });
        if (!ok) return;

        await fetch(`/api/admin/organizations/${org.id}`, { method: 'DELETE' });
        return loadOrganizations();
    }
});

/* ---------------------------------------------------------------------
   Прочее
   --------------------------------------------------------------------- */
document.getElementById('add-org').onclick = () => openModal(null);
document.getElementById('org-cancel').onclick = closeModal;
document.getElementById('search-org').addEventListener('input', render);

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
});

document.getElementById('logout').onclick = async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.replace('/frontend/login.html');
};

loadOrganizations();
