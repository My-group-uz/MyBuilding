// ===== ДИАЛОГОВЫЕ ОКНА =====
//
// Замена нативным alert / confirm / prompt. Нативные окна нельзя
// оформить, они блокируют весь поток выполнения и на мобильных
// показывают адрес сайта в заголовке — выглядит как предупреждение
// браузера, а не как часть приложения.
//
// Все функции возвращают промис, поэтому вызывающий код читается
// так же, как раньше:
//     if (!await uiConfirm('Удалить?')) return;
//
// Подключается ПЕРВЫМ из скриптов: остальные модули им пользуются.

(function () {
    'use strict';

    let activeResolve = null;

    // Один общий контейнер на все окна — создаётся при первом вызове
    function ensureRoot() {
        let root = document.getElementById('ui-dialog-root');
        if (root) return root;

        root = document.createElement('div');
        root.id = 'ui-dialog-root';
        root.className = 'dlg-root';
        root.hidden = true;
        document.body.appendChild(root);

        // Клик по затемнению = отмена
        root.addEventListener('click', (e) => {
            if (e.target === root) close(null);
        });

        document.addEventListener('keydown', (e) => {
            if (root.hidden) return;
            if (e.key === 'Escape') close(null);
        });

        return root;
    }

    function close(result) {
        const root = document.getElementById('ui-dialog-root');
        if (!root || root.hidden) return;

        root.hidden = true;
        root.innerHTML = '';

        const resolve = activeResolve;
        activeResolve = null;
        if (resolve) resolve(result);
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    // Многострочные сообщения приходят с \n — сохраняем переносы
    function formatMessage(text) {
        return escapeHtml(text).replace(/\n/g, '<br>');
    }

    /**
     * Базовое окно.
     * @param {object} opts
     *   title    — заголовок
     *   message  — текст
     *   fields   — HTML полей ввода (необязательно)
     *   actions  — [{label, value, variant, primary}]
     *   onOpen   — вызывается после вставки в DOM
     *   collect  — превращает форму в возвращаемое значение
     */
    function open(opts) {
        // Предыдущее окно закрываем как отменённое: два окна одновременно
        // означали бы потерянный промис.
        if (activeResolve) close(null);

        const root = ensureRoot();

        const actions = (opts.actions || []).map(a => `
            <button type="button" class="btn ${a.variant || 'btn--secondary'} dlg__action"
                    data-value="${escapeHtml(a.value)}" ${a.primary ? 'data-primary="1"' : ''}>
                ${escapeHtml(a.label)}
            </button>
        `).join('');

        root.innerHTML = `
            <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
                <h3 class="dlg__title" id="dlg-title">${escapeHtml(opts.title || '')}</h3>
                ${opts.message ? `<p class="dlg__message">${formatMessage(opts.message)}</p>` : ''}
                ${opts.fields || ''}
                <div class="dlg__actions">${actions}</div>
            </div>
        `;
        root.hidden = false;

        const dialog = root.querySelector('.dlg');

        dialog.querySelectorAll('.dlg__action').forEach(btn => {
            btn.addEventListener('click', () => {
                const raw = btn.dataset.value;
                if (raw === 'false') return close(false);
                if (raw === 'true') {
                    return close(opts.collect ? opts.collect(dialog) : true);
                }
                close(raw);
            });
        });

        if (opts.onOpen) opts.onOpen(dialog);

        return new Promise(resolve => { activeResolve = resolve; });
    }

    // --- Сообщение ---
    window.uiAlert = function (message, opts = {}) {
        return open({
            title: opts.title || 'Сообщение',
            message,
            actions: [{ label: opts.okText || 'Понятно', value: 'true', variant: 'btn--primary', primary: true }]
        });
    };

    // --- Подтверждение ---
    window.uiConfirm = function (message, opts = {}) {
        return open({
            title: opts.title || 'Подтвердите действие',
            message,
            actions: [
                { label: opts.cancelText || 'Отмена', value: 'false' },
                {
                    label: opts.confirmText || 'Продолжить',
                    value: 'true',
                    variant: opts.danger ? 'btn--secondary btn--danger' : 'btn--primary',
                    primary: true
                }
            ]
        });
    };

    // --- Ввод строки ---
    // Возвращает строку либо null при отмене — как нативный prompt.
    window.uiPrompt = function (message, opts = {}) {
        const value = escapeHtml(opts.value || '');
        const placeholder = escapeHtml(opts.placeholder || '');

        return open({
            title: opts.title || 'Введите значение',
            message,
            fields: `<input class="field dlg__input" type="text" value="${value}" placeholder="${placeholder}">`,
            actions: [
                { label: 'Отмена', value: 'false' },
                { label: opts.confirmText || 'Сохранить', value: 'true', variant: 'btn--primary', primary: true }
            ],
            onOpen: (dlg) => {
                const input = dlg.querySelector('.dlg__input');
                input.focus();
                input.select();
                // Enter подтверждает — привычное поведение нативного окна
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') dlg.querySelector('[data-primary]').click();
                });
            },
            collect: (dlg) => dlg.querySelector('.dlg__input').value
        }).then(res => (res === false ? null : res));
    };

    /**
     * Подтверждение вводом названия.
     * Кнопка остаётся заблокированной, пока введённый текст не совпадёт
     * с именем объекта. Защищает от удаления «на автомате»: обычное
     * «Вы уверены?» пролистывают не читая.
     */
    window.uiConfirmByName = function (name, opts = {}) {
        return open({
            title: opts.title || 'Удаление объекта',
            message: opts.message ||
                `Объект и все его данные — приход, бюджет, расход, фото — будут удалены безвозвратно.\n\nДля подтверждения введите название объекта:`,
            fields: `
                <div class="dlg__echo">${escapeHtml(name)}</div>
                <input class="field dlg__input" type="text" placeholder="Название объекта" autocomplete="off">
                <p class="dlg__error" hidden>Название не совпадает</p>
            `,
            actions: [
                { label: 'Отмена', value: 'false' },
                { label: opts.confirmText || 'Удалить', value: 'true', variant: 'btn--primary btn--destructive', primary: true }
            ],
            onOpen: (dlg) => {
                const input = dlg.querySelector('.dlg__input');
                const submit = dlg.querySelector('[data-primary]');
                const error = dlg.querySelector('.dlg__error');

                const matches = () => input.value.trim() === String(name).trim();

                const sync = () => {
                    const ok = matches();
                    submit.disabled = !ok;
                    error.hidden = ok || input.value.trim() === '';
                };

                submit.disabled = true;
                input.addEventListener('input', sync);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && matches()) submit.click();
                });
                input.focus();
            },
            collect: () => true
        }).then(res => res === true);
    };

    window.uiCloseDialog = () => close(null);
})();
