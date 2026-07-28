// ===== ПОИСК ПО ВКЛАДКАМ =====
//
// Фильтрация идёт по уже отрисованному DOM, а не по данным. Так она
// работает одинаково для Прихода (обычная таблица), Бюджета и Расхода
// (дерево этап → вид работ → ресурс) и не зависит от того, какими
// полями описан каждый раздел.
//
// Скрываем через класс, а не style.display: элементы Бюджета уже
// используют инлайн-стили для сворачивания, и правка display затёрла бы
// состояние свёрнутости.

const SEARCH_HIDDEN = 'search-hidden';

function normalize(text) {
    // Приводим к нижнему регистру и убираем пробелы внутри чисел:
    // «250 000» должно находиться и по запросу «250000».
    return (text || '').toLowerCase().replace(/ /g, ' ').trim();
}

function matches(haystack, needle) {
    const text = normalize(haystack);
    if (text.includes(needle)) return true;

    // Второй проход для чисел: «1 250 000» ↔ «1250000»
    const digitsOnly = text.replace(/[\s ]/g, '');
    return digitsOnly.includes(needle.replace(/[\s ]/g, ''));
}

/* ---------------------------------------------------------------------
   Приход — плоская таблица
   --------------------------------------------------------------------- */
function filterIncome(query) {
    const q = normalize(query);
    const tbody = document.getElementById('income-tbody');
    if (!tbody) return;

    let shown = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
        // Из строки исключаем ячейку с кнопками: её разметка
        // не должна попадать в поиск.
        const cells = [...tr.querySelectorAll('td')].slice(0, -1);
        const text = cells.map(td => td.textContent).join(' ');

        const hit = !q || matches(text, q);
        tr.classList.toggle(SEARCH_HIDDEN, !hit);
        if (hit) shown++;
    });

    toggleEmptyNote(tbody.closest('table'), q && shown === 0);
}

/* ---------------------------------------------------------------------
   Бюджет и Расход — дерево

   Строка ресурса видна, если совпала сама либо совпал её вид работ
   или этап: набрав название этапа, пользователь ожидает увидеть всё
   его содержимое, а не пустую шапку.
   --------------------------------------------------------------------- */
function filterTree(containerId, query) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const q = normalize(query);
    let shown = 0;

    container.querySelectorAll('.budget-stage').forEach(stage => {
        const stageText = stage.querySelector('.budget-stage-header')?.textContent || '';
        const stageHit = !!q && matches(stageText, q);
        let stageVisible = stageHit;

        stage.querySelectorAll('.budget-work-type').forEach(wt => {
            const wtText = wt.querySelector('.budget-work-type-header')?.textContent || '';
            const wtHit = stageHit || (!!q && matches(wtText, q));
            let wtVisible = wtHit;

            wt.querySelectorAll('.budget-resource').forEach(res => {
                const hit = !q || wtHit || matches(res.textContent, q);
                res.classList.toggle(SEARCH_HIDDEN, !hit);
                if (hit) {
                    wtVisible = true;
                    shown++;
                }
            });

            // Шапка колонок ресурсов не нужна, если все строки скрыты
            const header = wt.querySelector('.budget-resource-header');
            if (header) header.classList.toggle(SEARCH_HIDDEN, !wtVisible);

            wt.classList.toggle(SEARCH_HIDDEN, !!q && !wtVisible);
            if (wtVisible) stageVisible = true;
        });

        stage.classList.toggle(SEARCH_HIDDEN, !!q && !stageVisible);
    });

    // Итоговая строка при активном поиске вводит в заблуждение:
    // она считает всё, а на экране показана часть.
    const total = container.querySelector('.budget-total-row');
    if (total) total.classList.toggle(SEARCH_HIDDEN, !!q);

    toggleEmptyNote(container, !!q && shown === 0);
}

/* ---------------------------------------------------------------------
   Сообщение «ничего не найдено»
   --------------------------------------------------------------------- */
function toggleEmptyNote(host, show) {
    if (!host) return;
    const parent = host.parentNode;
    let note = parent.querySelector('.search-empty');

    if (!show) {
        if (note) note.remove();
        return;
    }
    if (note) return;

    note = document.createElement('p');
    note.className = 'search-empty';
    note.textContent = 'Ничего не найдено';
    parent.appendChild(note);
}

/* ---------------------------------------------------------------------
   Привязка полей
   --------------------------------------------------------------------- */
function bindSearch(inputId, handler) {
    const input = document.getElementById(inputId);
    if (!input) return;

    let timer = null;
    const run = () => handler(input.value);

    input.addEventListener('input', () => {
        // Небольшая задержка: на дереве в сотни строк фильтрация
        // на каждое нажатие заметно подтормаживает ввод.
        clearTimeout(timer);
        timer = setTimeout(run, 120);
    });

    // Крестик в поле type="search" не шлёт input в старых движках
    input.addEventListener('search', run);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = '';
            run();
        }
    });
}

bindSearch('search-income', filterIncome);
bindSearch('search-budget', (v) => filterTree('budget-container', v));
bindSearch('search-expense', (v) => filterTree('expense-container', v));

// Данные перерисовываются при каждом переключении вкладки и правке —
// после этого фильтр нужно применить заново, иначе скрытые строки
// вернутся, а поле останется заполненным.
function reapplySearch(tab) {
    if (tab === 'income') filterIncome(document.getElementById('search-income')?.value || '');
    if (tab === 'budget') filterTree('budget-container', document.getElementById('search-budget')?.value || '');
    if (tab === 'expense') filterTree('expense-container', document.getElementById('search-expense')?.value || '');
}

window.reapplySearch = reapplySearch;
