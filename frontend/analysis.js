// ===== ANALYSIS TAB LOGIC =====

let analysisData = {
    budget: 0,
    income: 0,
    expense: 0,
    balance: 0,
    overrun: 0,
    resources: {},
    workTypes: []
};
// Состояния свёрнутости больше нет — все разделы раскрыты всегда.

// Icons for resource types in Analysis (black stroke)
const ANALYSIS_RESOURCE_ICONS = {
    'Материал': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-box-icon lucide-box"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
    'Доставка': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bus-icon lucide-bus"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>`,
    'Инструменты': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-drill-icon lucide-drill"><path d="M10 18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a3 3 0 0 1-3-3 1 1 0 0 1 1-1z"/><path d="M13 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1l-.81 3.242a1 1 0 0 1-.97.758H8"/><path d="M14 4h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3"/><path d="M18 6h4"/><path d="m5 10-2 8"/><path d="m7 18 2-8"/></svg>`,
    'Оборудование': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cable-icon lucide-cable"><path d="M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z"/><path d="M17 21v-2"/><path d="M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10"/><path d="M21 21v-2"/><path d="M3 5V3"/><path d="M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z"/><path d="M7 5V3"/></svg>`,
    'Питание': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-utensils-icon lucide-utensils"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
    'Коммуналка': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flame-kindling-icon lucide-flame-kindling"><path d="M12 2c1 3 2.5 3.5 3.5 4.5A5 5 0 0 1 17 10a5 5 0 1 1-10 0c0-.3 0-.6.1-.9a2 2 0 1 0 3.3-2C8 4.5 11 2 12 2Z"/><path d="m5 22 14-4"/><path d="m5 18 14 4"/></svg>`,
    'Документация': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text-icon lucide-file-text"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
    'Расходные материалы': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-paint-roller-icon lucide-paint-roller"><rect width="16" height="6" x="2" y="2" rx="2"/><path d="M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect width="4" height="6" x="8" y="16" rx="1"/></svg>`,
    'Трудоресурсы': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hard-hat-icon lucide-hard-hat"><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M14 6a6 6 0 0 1 6 6v3"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><rect x="2" y="15" width="20" height="4" rx="1"/></svg>`,
    'Мебель': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-armchair-icon lucide-armchair"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/></svg>`
    ,
    'Техника': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tractor-icon lucide-tractor"><path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/><path d="M16 18h-5"/><path d="M18 5a1 1 0 0 0-1 1v5.573"/><path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246"/><path d="M4 11V4"/><path d="M7 15h.01"/><path d="M8 10.1V4"/><circle cx="18" cy="18" r="2"/><circle cx="7" cy="15" r="5"/></svg>`
};

// Загрузка данных для анализа
async function loadAnalysis(objectId) {
    if (!objectId) return;
    analysisData.objectId = objectId;

    try {
        // Загружаем все данные параллельно
        const [budgetRes, incomeRes, expenseRes] = await Promise.all([
            fetch(`/objects/${objectId}/budget/tree/`),
            fetch(`/objects/${objectId}/incomes/`),
            fetch(`/objects/${objectId}/expenses/tree`)
        ]);

        if (!budgetRes.ok || !incomeRes.ok || !expenseRes.ok) {
            throw new Error('Failed to load data');
        }

        const budgetData = await budgetRes.json();
        const incomeData = await incomeRes.json();
        const expenseData = await expenseRes.json();

        // Рассчитываем показатели
        calculateAnalysis(budgetData, incomeData, expenseData);

        // Площадь нужна для цены за м². Раньше она попадала сюда вместе
        // с блоком «Данные объекта»; тот переехал в «Настройки», поэтому
        // тянем её отдельно — иначе цена за м² была бы нулевой, пока
        // пользователь не заглянет в настройки.
        try {
            const objRes = await fetch(`/objects/${objectId}`);
            if (objRes.ok) {
                const obj = await objRes.json();
                analysisData.area = parseFloat(obj.area) || 0;
                analysisData.startDate = obj.start_date || null;
                analysisData.endDate = obj.end_date || null;
                // Паспорт объекта — правая колонка витрины
                analysisData.objectName = obj.name || 'Объект';
                analysisData.customer = obj.customer || '';
                analysisData.customerPhone = obj.customer_phone || '';
                analysisData.address = obj.address || '';
                analysisData.contractSum = parseFloat(obj.contract_sum) || 0;
            }
        } catch (e) {
            console.warn('Не удалось получить площадь объекта', e);
        }

        // Рендеры нужны витрине наверху вкладки
        await loadAnalysisPhotos(objectId);

        renderAnalysis();
    } catch (err) {
        console.error('Error loading analysis:', err);
        document.getElementById('analysis-container').innerHTML =
            '<p style="padding:20px;text-align:center;color:#999;">Ошибка загрузки данных</p>';
    }
}

// Расчет всех показателей
function calculateAnalysis(budgetData, incomeData, expenseData) {
    // Бюджет
    analysisData.budget = calculateTotalBudget(budgetData);

    // Приход
    analysisData.income = incomeData.reduce((sum, item) => sum + (item.amount || 0), 0);

    // Расход
    analysisData.expense = calculateTotalExpense(expenseData);

    // Остаток (приход - расход)
    analysisData.balance = analysisData.income - analysisData.expense;

    // Перерасход (бюджет - расходы)
    analysisData.overrun = analysisData.budget - analysisData.expense;

    // По типам ресурсов
    analysisData.resources = calculateResourcesByType(budgetData, expenseData);
    
    // По видам работ (план/факт)
    analysisData.workTypes = calculateWorkTypes(budgetData, expenseData);
}

// Расчет по видам работ
function calculateWorkTypes(budgetData, expenseData) {
    const workTypes = [];
    
    budgetData.forEach((stage, stageIdx) => {
        (stage.work_types || []).forEach((wt, wtIdx) => {
            const plan = (wt.resources || []).reduce((sum, res) => 
                sum + ((res.quantity || 0) * (res.price || 0)), 0);
            
            // Find matching work type in expense data
            let fact = 0;
            if (expenseData[stageIdx] && expenseData[stageIdx].work_types) {
                const expWt = expenseData[stageIdx].work_types[wtIdx];
                if (expWt && expWt.resources) {
                    fact = expWt.resources.reduce((sum, res) => {
                        if (!res.expenses) return sum;
                        return sum + res.expenses.reduce((s, e) => 
                            s + ((e.actual_quantity || 0) * (e.actual_price || 0)), 0);
                    }, 0);
                }
            }
            
            workTypes.push({
                stageName: stage.name,
                name: wt.name,
                plan: plan,
                fact: fact
            });
        });
    });
    
    return workTypes;
}

// Расчет общей суммы бюджета
function calculateTotalBudget(budgetData) {
    return budgetData.reduce((sum, stage) => {
        return sum + (stage.work_types || []).reduce((wtSum, wt) => {
            return wtSum + (wt.resources || []).reduce((resSum, res) => {
                return resSum + ((res.quantity || 0) * (res.price || 0));
            }, 0);
        }, 0);
    }, 0);
}

// Расчет общей суммы расходов
function calculateTotalExpense(expenseData) {
    return expenseData.reduce((sum, stage) => {
        return sum + (stage.work_types || []).reduce((wtSum, wt) => {
            return wtSum + (wt.resources || []).reduce((resSum, res) => {
                if (!res.expenses) return resSum;
                return resSum + res.expenses.reduce((expSum, exp) => {
                    return expSum + ((exp.actual_quantity || 0) * (exp.actual_price || 0));
                }, 0);
            }, 0);
        }, 0);
    }, 0);
}

// Расчет по типам ресурсов
function calculateResourcesByType(budgetData, expenseData) {
    const resources = {};

    // Типы ресурсов из константы
    const resourceTypes = [
        'Трудоресурсы', 'Материал', 'Доставка', 'Оборудование',
        'Мебель', 'Инструменты', 'Коммуналка', 'Документация',
        'Расходные материалы', 'Питание', 'Техника'
    ];

    // Инициализируем все типы
    resourceTypes.forEach(type => {
        resources[type] = { plan: 0, fact: 0 };
    });

    // Считаем план из бюджета
    budgetData.forEach(stage => {
        (stage.work_types || []).forEach(wt => {
            (wt.resources || []).forEach(res => {
                const type = res.resource_type || 'Материал';
                if (resources[type]) {
                    resources[type].plan += (res.quantity || 0) * (res.price || 0);
                }
            });
        });
    });

    // Считаем факт из расходов
    expenseData.forEach(stage => {
        (stage.work_types || []).forEach(wt => {
            (wt.resources || []).forEach(res => {
                const type = res.resource_type || 'Материал';
                if (resources[type] && res.expenses) {
                    res.expenses.forEach(exp => {
                        resources[type].fact += (exp.actual_quantity || 0) * (exp.actual_price || 0);
                    });
                }
            });
        });
    });

    return resources;
}

// Рендеринг анализа
/* =====================================================================
   ВИТРИНА ОБЪЕКТА (слайдер рендеров в «Аналитике»)

   Одно большое изображение с названием объекта поверх. Если рендеров
   несколько — они сменяются каждые 3 секунды, а снизу идёт полоска,
   показывающая, сколько осталось до следующего кадра.
   ===================================================================== */

const HERO_INTERVAL_MS = 3000;
let heroTimer = null;
let heroIndex = 0;

function heroPhotos() {
    return (analysisData.analysisPhotos || []).filter(p => p && p.url);
}

// Строка значения в карточке объекта. Пустые поля показываем прочерком,
// а не прячем: иначе строки съезжают и карточка «прыгает» между объектами.
function heroFact(label, value, href) {
    const empty = value === null || value === undefined || String(value).trim() === '';
    const text = empty ? '—' : escapeHtml(value);
    const body = (!empty && href)
        ? `<a class="hero-facts__value hero-facts__value--link" href="${escapeHtml(href)}">${text}</a>`
        : `<span class="hero-facts__value ${empty ? 'is-empty' : ''}">${text}</span>`;

    return `
        <div class="hero-facts__row">
            <span class="hero-facts__label">${escapeHtml(label)}</span>
            ${body}
        </div>
    `;
}

function renderHeroSlider() {
    const photos = heroPhotos();
    const name = analysisData.objectName || 'Объект';
    const phone = analysisData.customerPhone;
    const area = parseFloat(analysisData.area || 0) || 0;
    const contract = parseFloat(analysisData.contractSum || 0) || 0;

    // --- Левая колонка: рендеры ---
    let media;
    if (photos.length === 0) {
        media = `
            <div class="hero__media hero__media--empty">
                <p class="hero__hint">Добавьте фоторендеры<br>во вкладке «Настройки»</p>
            </div>
        `;
    } else {
        const slides = photos.map((p, i) => `
            <div class="hero__slide ${i === 0 ? 'active' : ''}" data-i="${i}"
                 style="background-image:url('${p.url}')"></div>
        `).join('');

        // Полоска прогресса нужна только когда есть что перелистывать
        const progress = photos.length > 1
            ? `<div class="hero__progress"><span class="hero__progress-fill"></span></div>`
            : '';

        media = `
            <div class="hero__media" id="hero" data-count="${photos.length}">
                <div class="hero__slides">${slides}</div>
                <div class="hero__scrim"></div>
                <div class="hero__caption">
                    <h1 class="hero__title">${escapeHtml(name)}</h1>
                </div>
                ${progress}
            </div>
        `;
    }

    // --- Правая колонка: паспорт объекта ---
    // tel: только из цифр и «+» — пробелы и скобки ломают ссылку.
    const telHref = phone ? 'tel:' + String(phone).replace(/[^\d+]/g, '') : null;

    return `
        <section class="hero">
            ${media}
            <div class="hero-facts">
                <h2 class="hero-facts__name">${escapeHtml(name)}</h2>
                ${heroFact('Заказчик', analysisData.customer)}
                ${heroFact('Телефон', phone, telHref)}
                ${heroFact('Адрес', analysisData.address)}
                ${heroFact('Площадь', area > 0 ? `${formatNum(area)} м²` : '')}
                ${heroFact('Сумма договора', contract > 0 ? `${formatNum(contract)} сум` : '')}

                <div class="hero-prices">
                    <div class="hero-price">
                        <span class="hero-price__label">Цена / м² (план)</span>
                        <span class="hero-price__value" id="price-plan-value">0 сум</span>
                    </div>
                    <div class="hero-price">
                        <span class="hero-price__label">Цена / м² (факт)</span>
                        <span class="hero-price__value hero-price__value--fact" id="price-fact-value">0 сум</span>
                    </div>
                </div>
            </div>
        </section>
    `;
}

// Запускает смену кадров. Вызывается после каждой отрисовки —
// поэтому первым делом гасит предыдущий таймер, иначе после нескольких
// переходов между вкладками кадры начали бы мигать наперегонки.
function startHeroSlider() {
    stopHeroSlider();

    const hero = document.getElementById('hero');
    if (!hero) return;

    const slides = [...hero.querySelectorAll('.hero__slide')];
    if (slides.length < 2) return;

    const fill = hero.querySelector('.hero__progress-fill');
    heroIndex = 0;

    const advance = () => {
        slides[heroIndex].classList.remove('active');
        heroIndex = (heroIndex + 1) % slides.length;
        slides[heroIndex].classList.add('active');
        restartProgress();
    };

    // Перезапуск анимации полоски: смена класса не сбрасывает уже
    // идущую анимацию, нужен принудительный reflow.
    const restartProgress = () => {
        if (!fill) return;
        fill.style.animation = 'none';
        void fill.offsetWidth;
        fill.style.animation = '';
    };

    restartProgress();
    heroTimer = setInterval(advance, HERO_INTERVAL_MS);
}

function stopHeroSlider() {
    if (heroTimer) {
        clearInterval(heroTimer);
        heroTimer = null;
    }
}

window.stopHeroSlider = stopHeroSlider;

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function renderAnalysis() {
    const container = document.getElementById('analysis-container');
    if (!container) return;

    // Ensure analysisPhotos array exists (4 slots)
    if (!analysisData.analysisPhotos) analysisData.analysisPhotos = [null, null, null, null];

    container.innerHTML = `
        <!-- Витрина объекта: рендеры сменяются каждые 3 секунды,
             название лежит поверх изображения. Загружаются они
             во вкладке «Настройки». -->
        ${renderHeroSlider()}

        <!-- Цена за м² переехала в правую колонку витрины: она относится
             к паспорту объекта, а не к финансовой аналитике ниже. -->

        <!-- Финансовые карточки (collapsible) -->
        <div class="analysis-collapsible" data-section="cards">
            <div class="analysis-collapsible-header">
                <span class="analysis-section-title">Аналитика по финансам</span>
            </div>
            <div class="analysis-collapsible-body">
                <div class="analysis-cards-grid single-row">
                    <div class="analysis-card">
                        <div class="analysis-card-title"><span class="card-icon">${svgIcon('income')}</span>Приход</div>
                        <div class="analysis-card-value positive">${formatNum(analysisData.income)} сум</div>
                    </div>
                    <div class="analysis-card">
                        <div class="analysis-card-title"><span class="card-icon">${svgIcon('expense')}</span>Расход</div>
                        <div class="analysis-card-value negative">${formatNum(analysisData.expense)} сум</div>
                    </div>
                    <div class="analysis-card">
                        <div class="analysis-card-title"><span class="card-icon">${svgIcon('balance')}</span>Остаток</div>
                        <div class="analysis-card-value ${analysisData.balance >= 0 ? 'positive' : 'negative'}">${formatNum(analysisData.balance)} сум</div>
                    </div>
                    <div class="analysis-card">
                        <div class="analysis-card-title"><span class="card-icon">${svgIcon('overrun')}</span>Перерасход</div>
                        <div class="analysis-card-value ${analysisData.overrun >= 0 ? 'positive' : 'negative'}">${formatNum(analysisData.overrun)} сум</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Прогресс-бары (collapsible) -->
        <div class="analysis-collapsible" data-section="progress">
            <div class="analysis-collapsible-header">
                <span class="analysis-section-title">Аналитика по финансам (прогресс-бары)</span>
            </div>
            <div class="analysis-collapsible-body">
                ${renderProgressBars()}
            </div>
        </div>

        <!-- План/Факт по видам работ (collapsible) -->
        <div class="analysis-collapsible" data-section="workTypes">
            <div class="analysis-collapsible-header">
                <span class="analysis-section-title">План/Факт по видам работ</span>
            </div>
            <div class="analysis-collapsible-body">
                ${renderWorkTypesComparison()}
            </div>
        </div>

        <!-- По типам ресурсов (collapsible) -->
        <div class="analysis-collapsible" data-section="resources">
            <div class="analysis-collapsible-header">
                <span class="analysis-section-title">Аналитика по типам ресурсов</span>
            </div>
            <div class="analysis-collapsible-body">
                <div class="analysis-resources-section">
                    <div class="analysis-resources-grid">
                        ${renderResourceColumns()}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Пересчёт цены за м² после отрисовки. Поля площади и сроков
    // теперь живут во вкладке «Настройки» — их обработчики в settings.js.
    setTimeout(() => {
        updatePricePerM2();
        startHeroSlider();
    }, 0);
}
// Helper: load analysis photos from server
async function loadAnalysisPhotos(objectId) {
    try {
        const res = await fetch(`/objects/${objectId}/analysis_photos/`);
        if (!res.ok) throw new Error('Failed to load photos');
        const list = await res.json();
        // Build fixed-size array of 4 slots
        analysisData.analysisPhotos = [null, null, null, null];
        for (let i = 0; i < Math.min(list.length, 4); i++) {
            analysisData.analysisPhotos[i] = { id: list[i].id, url: list[i].url };
        }
    } catch (err) {
        console.warn('Could not load analysis photos:', err);
        analysisData.analysisPhotos = [null, null, null, null];
    }
}

// Helper: render 4 image upload slots using analysisData.analysisPhotos
function renderImageUploadGrid() {
    if (!analysisData.analysisPhotos) analysisData.analysisPhotos = [null, null, null, null];
    return analysisData.analysisPhotos.map((item, idx) => {
        const src = item ? item.url : null;
        return `
            <div class="photo-slot">
                <div class="photo-preview" id="photo-preview-${idx}" data-idx="${idx}" onclick="onPreviewClick(event, ${idx})">
                    ${src ? `<img src="${src}" alt="photo-${idx}">` : `<div class="photo-placeholder">+</div>`}
                    ${src ? `<div class="photo-overlay"><button class="overlay-btn view" onclick="viewImageFromSlot(event, ${idx})" title="Просмотр">👁</button><button class="overlay-btn del" onclick="removeImageFromSlot(event, ${idx})" title="Удалить">✕</button></div>` : ''}
                </div>
                <input type="file" accept="image/*" id="photo-input-${idx}" style="display:none;" onchange="onImageSelected(event, ${idx})">
            </div>
        `;
    }).join('');
}

// Сетка фото отрисовывается вкладкой «Настройки», но обработчики
// остались здесь вместе с остальной работой с analysisData.
// Перерисовываем именно ту вкладку, где сетка сейчас находится —
// иначе загруженное фото не появлялось бы до перехода между вкладками.
function refreshPhotoGrid() {
    if (typeof renderSettings === 'function' && document.getElementById('settings-container')) {
        renderSettings();
    } else {
        renderAnalysis();
    }
}

// Image handlers
function onImageSelected(event, idx) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    // If we have objectId, upload to server; otherwise fallback to data URL
    const objectId = analysisData.objectId;
    if (objectId) {
        const fd = new FormData();
        fd.append('photo', file, file.name);
        fetch(`/objects/${objectId}/analysis_photos/`, { method: 'POST', body: fd })
            .then(res => res.json())
            .then(data => {
                if (data && data.url) {
                    // store as object with id
                    analysisData.analysisPhotos[idx] = { id: data.id, url: data.url };
                    refreshPhotoGrid();
                }
            })
            .catch(err => {
                console.error('Upload failed', err);
                // fallback to local data URL
                const reader = new FileReader();
                reader.onload = function (e) {
                    analysisData.analysisPhotos[idx] = { id: null, url: e.target.result };
                    refreshPhotoGrid();
                };
                reader.readAsDataURL(file);
            });
    } else {
        const reader = new FileReader();
        reader.onload = function (e) {
            analysisData.analysisPhotos[idx] = { id: null, url: e.target.result };
            refreshPhotoGrid();
        };
        reader.readAsDataURL(file);
    }
}

function removeImageFromSlot(event, idx) {
    event.stopPropagation();
    const item = analysisData.analysisPhotos[idx];
    if (!item) return;
    if (item.id) {
        // delete on server
        fetch(`/objects/${analysisData.objectId}/analysis_photos/${item.id}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) {
                    analysisData.analysisPhotos[idx] = null;
                    refreshPhotoGrid();
                } else {
                    uiAlert('Не удалось удалить фото на сервере');
                }
            }).catch(err => { console.error(err); uiAlert('Ошибка удаления'); });
    } else {
        analysisData.analysisPhotos[idx] = null;
        refreshPhotoGrid();
    }
}

function viewImageFromSlot(event, idx) {
    event.stopPropagation();
    const item = analysisData.analysisPhotos[idx];
    if (!item || !item.url) return;
    openPhotoViewer(item.url);
}

function onPreviewClick(event, idx) {
    // Clicking the preview opens file picker for that slot
    const input = document.getElementById(`photo-input-${idx}`);
    if (input) input.click();
}

function onObjectFieldChange() {
    // Поля живут во вкладке «Настройки» — читаем только те, что есть в DOM
    const value = (id) => document.getElementById(id)?.value ?? '';

    const area = parseFloat(value('obj-area') || 0) || 0;
    // Сумма договора приходит с пробелами-разделителями — чистим
    const contractSum = parseFloat(String(value('obj-contract-sum')).replace(/\s/g, '')) || 0;
    const start = value('obj-start-date');
    const end = value('obj-end-date');
    const customer = value('obj-customer');
    const customerPhone = value('obj-customer-phone');
    const address = value('obj-address');

    analysisData.area = area;
    analysisData.contractSum = contractSum;
    analysisData.startDate = start;
    analysisData.endDate = end;
    analysisData.customer = customer;
    analysisData.customerPhone = customerPhone;
    analysisData.address = address;
    updatePricePerM2();

    // Persist these fields to server (partial update)
    if (analysisData.objectId) {
        fetch(`/objects/${analysisData.objectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startDate: start || null,
                endDate: end || null,
                area: area,
                contractSum: contractSum,
                customer: customer,
                customerPhone: customerPhone,
                address: address
            })
        }).then(res => {
            if (!res.ok) console.warn('Failed to save object fields');
        }).catch(err => console.error('Save object fields error', err));
    }
}

function updatePricePerM2() {
    const area = parseFloat(analysisData.area || 0) || 0;
    const planBar = document.getElementById('price-plan-bar');
    const factBar = document.getElementById('price-fact-bar');
    const planValueEl = document.getElementById('price-plan-value');
    const factValueEl = document.getElementById('price-fact-value');
    const planPrice = area > 0 ? analysisData.budget / area : 0;
    const factPrice = area > 0 ? analysisData.expense / area : 0;

    // Normalize widths relative to the larger value (or 1 to avoid division by zero)
    const maxVal = Math.max(planPrice, factPrice, 1);
    const planPct = maxVal > 0 ? (planPrice / maxVal) * 100 : 0;
    const factPct = maxVal > 0 ? (factPrice / maxVal) * 100 : 0;

    // Set widths and labels
    if (planBar) {
        planBar.style.width = planPct + '%';
        planBar.className = 'analysis-progress-bar neutral';
        planBar.innerText = planPct > 10 ? formatNum(planPrice) + ' сум' : '';
    }
    if (factBar) {
        factBar.style.width = factPct + '%';
        // Choose class depending on whether fact > plan
        const factClass = factPrice > planPrice ? 'negative' : 'positive';
        factBar.className = 'analysis-progress-bar ' + factClass;
        factBar.innerText = factPct > 10 ? formatNum(factPrice) + ' сум' : '';
    }
    if (planValueEl) planValueEl.innerText = formatNum(planPrice) + ' сум';
    if (factValueEl) factValueEl.innerText = formatNum(factPrice) + ' сум';
}

// Custom SVG icons for financial cards
function svgIcon(name) {
    switch (name) {
        case 'income':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`;
        case 'expense':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`;
        case 'balance':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>`;
        case 'overrun':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 16 6 6"/><circle cx="16" cy="9" r="2.9"/><circle cx="6" cy="5" r="3"/></svg>`;
        default:
            return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/></svg>`;
    }
}

// Export current analysis as a complete HTML report in new tab with all styles and images
/* =====================================================================
   ВЫГРУЗКА ОТЧЁТА «АНАЛИТИКА»

   Раньше отчёт клонировал разметку экрана. Экранная вёрстка построена
   на карточках и сетках: на бумаге они превращались в полупустые
   прямоугольники, столбчатые диаграммы печатались без столбиков,
   а название объекта повторялось трижды. Пустой объект занимал
   четыре страницы.

   Здесь документ собирается заново из данных: таблицы вместо карточек,
   ничего лишнего. Нулевые разделы не печатаются вовсе.
   ===================================================================== */

function reportRow(label, value) {
    const empty = value === null || value === undefined || String(value).trim() === '';
    return `
        <tr>
            <th scope="row">${escapeHtml(label)}</th>
            <td>${empty ? '—' : escapeHtml(value)}</td>
        </tr>
    `;
}

function reportMoney(value) {
    return `${formatNum(value || 0)} сум`;
}

// Сводка по финансам — таблица, а не четыре карточки в ряд
function reportSummary() {
    return `
        <section class="rep-section">
            <h2>Финансы</h2>
            <table class="rep-table rep-table--figures">
                <tbody>
                    <tr>
                        <th scope="row">Бюджет (план)</th>
                        <td class="text-right">${reportMoney(analysisData.budget)}</td>
                    </tr>
                    <tr>
                        <th scope="row">Приход</th>
                        <td class="text-right">${reportMoney(analysisData.income)}</td>
                    </tr>
                    <tr>
                        <th scope="row">Расход (факт)</th>
                        <td class="text-right">${reportMoney(analysisData.expense)}</td>
                    </tr>
                    <tr class="rep-total">
                        <th scope="row">Остаток</th>
                        <td class="text-right ${analysisData.balance < 0 ? 'over-budget' : ''}">
                            ${reportMoney(analysisData.balance)}
                        </td>
                    </tr>
                    <tr class="rep-total">
                        <th scope="row">${analysisData.overrun < 0 ? 'Перерасход' : 'Экономия'}</th>
                        <td class="text-right ${analysisData.overrun < 0 ? 'over-budget' : ''}">
                            ${reportMoney(Math.abs(analysisData.overrun))}
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>
    `;
}

// План/факт по видам работ. Показываем все заведённые виды работ,
// включая нулевые: нулевой факт при ненулевом плане — это тоже
// информация, а не пустая строка.
function reportWorkTypes() {
    const rows = analysisData.workTypes || [];
    if (rows.length === 0) return '';

    const wtPlan = rows.reduce((s, wt) => s + (wt.plan || 0), 0);
    const wtFact = rows.reduce((s, wt) => s + (wt.fact || 0), 0);
    const wtDiff = wtPlan - wtFact;

    return `
        <section class="rep-section">
            <h2>План / факт по видам работ</h2>
            <table class="rep-table">
                <thead>
                    <tr>
                        <th>Этап</th>
                        <th>Вид работ</th>
                        <th class="text-right">План</th>
                        <th class="text-right">Факт</th>
                        <th class="text-right">Отклонение</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(wt => {
                        const diff = (wt.plan || 0) - (wt.fact || 0);
                        return `
                            <tr>
                                <td>${escapeHtml(wt.stageName || '')}</td>
                                <td>${escapeHtml(wt.name || '')}</td>
                                <td class="text-right">${reportMoney(wt.plan)}</td>
                                <td class="text-right">${reportMoney(wt.fact)}</td>
                                <td class="text-right ${diff < 0 ? 'over-budget' : ''}">
                                    ${diff < 0 ? '−' : ''}${formatNum(Math.abs(diff))}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                    <tr class="rep-total">
                        <td colspan="2">Итого</td>
                        <td class="text-right">${reportMoney(wtPlan)}</td>
                        <td class="text-right">${reportMoney(wtFact)}</td>
                        <td class="text-right ${wtDiff < 0 ? 'over-budget' : ''}">
                            ${wtDiff < 0 ? '−' : ''}${formatNum(Math.abs(wtDiff))}
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>
    `;
}

// По типам ресурсов — таблицей. На экране это столбчатые диаграммы,
// но на бумаге столбик высотой в ноль бесполезен, а число читается.
//
// Печатаем ВСЕ типы, включая нулевые: список фиксированный, и по нему
// сверяют, что ничего не забыли заложить в бюджет. Отсутствующая
// строка «Мебель» читалась бы как «раздела нет», а не как «ноль».
function reportResources() {
    const entries = Object.entries(analysisData.resources || {});
    if (entries.length === 0) return '';

    const totalPlan = entries.reduce((s, [, v]) => s + (v.plan || 0), 0);
    const totalFact = entries.reduce((s, [, v]) => s + (v.fact || 0), 0);
    const totalDiff = totalPlan - totalFact;

    return `
        <section class="rep-section">
            <h2>По типам ресурсов</h2>
            <table class="rep-table">
                <thead>
                    <tr>
                        <th>Тип ресурса</th>
                        <th class="text-right">План</th>
                        <th class="text-right">Факт</th>
                        <th class="text-right">Отклонение</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(([name, v]) => {
                        const diff = (v.plan || 0) - (v.fact || 0);
                        const zero = (v.plan || 0) === 0 && (v.fact || 0) === 0;
                        return `
                            <tr class="${zero ? 'rep-zero' : ''}">
                                <td>${escapeHtml(name)}</td>
                                <td class="text-right">${reportMoney(v.plan)}</td>
                                <td class="text-right">${reportMoney(v.fact)}</td>
                                <td class="text-right ${diff < 0 ? 'over-budget' : ''}">
                                    ${diff < 0 ? '−' : ''}${formatNum(Math.abs(diff))}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                    <tr class="rep-total">
                        <td>Итого</td>
                        <td class="text-right">${reportMoney(totalPlan)}</td>
                        <td class="text-right">${reportMoney(totalFact)}</td>
                        <td class="text-right ${totalDiff < 0 ? 'over-budget' : ''}">
                            ${totalDiff < 0 ? '−' : ''}${formatNum(Math.abs(totalDiff))}
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>
    `;
}

function exportAnalysisReport() {
    if (!analysisData.objectId) {
        uiAlert('Сначала выберите объект');
        return;
    }

    const name = analysisData.objectName || 'Объект';
    const area = parseFloat(analysisData.area || 0) || 0;
    const contract = parseFloat(analysisData.contractSum || 0) || 0;

    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const pricePlan = area > 0 ? analysisData.budget / area : 0;
    const priceFact = area > 0 ? analysisData.expense / area : 0;

    // Первый рендер идёт обложкой — если он загружен
    const cover = (analysisData.analysisPhotos || []).find(p => p && p.url);

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Аналитика — ${escapeHtml(name)}</title>
    <link rel="stylesheet" href="/frontend/report.css?v=16">
</head>
<body>
    <div class="header">
        <div>
            <h1>${escapeHtml(name)}</h1>
            <p>Аналитика · сформировано ${dateStr} в ${timeStr}</p>
        </div>
        <img class="pdf-logo" src="/frontend/assets/design_key.png" alt="">
    </div>

    <section class="rep-section rep-passport">
        ${cover ? `<img class="rep-cover" src="${cover.url}" alt="">` : ''}
        <table class="rep-table rep-table--facts">
            <tbody>
                ${reportRow('Заказчик', analysisData.customer)}
                ${reportRow('Телефон', analysisData.customerPhone)}
                ${reportRow('Адрес', analysisData.address)}
                ${reportRow('Площадь', area > 0 ? `${formatNum(area)} м²` : '')}
                ${reportRow('Сумма договора', contract > 0 ? reportMoney(contract) : '')}
                ${reportRow('Цена / м² (план)', area > 0 ? reportMoney(pricePlan) : '')}
                ${reportRow('Цена / м² (факт)', area > 0 ? reportMoney(priceFact) : '')}
            </tbody>
        </table>
    </section>

    ${reportSummary()}
    ${reportWorkTypes()}
    ${reportResources()}

    <script>
        // Печать запускаем после загрузки стилей и обложки: иначе
        // диалог открывается поверх ещё не отрисованной страницы.
        window.addEventListener('load', function () {
            setTimeout(function () { window.print(); }, 300);
        });
    <\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
        uiAlert('Не удалось открыть новое окно. Проверьте настройки блокировки всплывающих окон.');
        return;
    }
    win.document.write(html);
    win.document.close();
}


// Expose handlers to global scope for inline handlers
window.onImageSelected = onImageSelected;
window.removeImageFromSlot = removeImageFromSlot;
window.viewImageFromSlot = viewImageFromSlot;
window.onPreviewClick = onPreviewClick;
window.onObjectFieldChange = onObjectFieldChange;
window.exportAnalysisReport = exportAnalysisReport;
// Сворачивание разделов убрано: аккордеон прятал те самые цифры,
// ради которых открывают вкладку. Все разделы всегда раскрыты.


// Рендеринг прогресс-баров
function renderProgressBars() {
    const maxValue = Math.max(
        analysisData.budget,
        analysisData.income,
        analysisData.expense,
        Math.abs(analysisData.balance),
        Math.abs(analysisData.overrun)
    );

    const items = [
        { label: 'Бюджет', value: analysisData.budget, class: 'neutral' },
        { label: 'Приход', value: analysisData.income, class: 'positive' },
        { label: 'Расход', value: analysisData.expense, class: 'negative' },
        // 'Остаток' will use orange (balance) regardless of sign as requested
        { label: 'Остаток', value: analysisData.balance, class: 'balance' },
        // 'Перерасход' uses purple/pink gradient
        { label: 'Перерасход', value: analysisData.overrun, class: 'overrun' }
    ];

    return items.map(item => {
        const percentage = maxValue > 0 ? Math.abs((item.value / maxValue) * 100) : 0;
        return `
            <div class="analysis-progress-item">
                <div class="analysis-progress-header">
                    <span class="analysis-progress-label">${item.label}</span>
                    <span class="analysis-progress-value">${formatNum(item.value)} сум</span>
                </div>
                <div class="analysis-progress-bar-container">
                    <!-- Подпись внутри полосы убрана: та же сумма стоит
                         справа в заголовке строки, а из-за неё полоса
                         не могла быть тоньше 32px. -->
                    <div class="analysis-progress-bar ${item.class}" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Рендеринг План/Факт по видам работ
function renderWorkTypesComparison() {
    if (!analysisData.workTypes || analysisData.workTypes.length === 0) {
        return '<div class="no-data">Нет данных по видам работ</div>';
    }
    
    let html = '<div class="work-types-grid">';
    
    analysisData.workTypes.forEach(wt => {
        const diff = wt.fact - wt.plan;
        const diffClass = diff >= 0 ? 'negative' : 'positive';
        const maxValue = Math.max(wt.plan, wt.fact, 1);
        const planPercent = (wt.plan / maxValue) * 100;
        const factPercent = (wt.fact / maxValue) * 100;
        
        html += `
            <div class="work-type-item">
                <div class="work-type-header">
                    <span class="work-type-stage">${wt.stageName}</span>
                    <span class="work-type-name">${wt.name}</span>
                </div>
                <div class="work-type-comparison">
                    <div class="work-type-bar-group">
                        <div class="work-type-bar-label">План</div>
                        <div class="work-type-bar-container">
                            <div class="work-type-bar plan" style="width: ${planPercent}%"></div>
                        </div>
                        <div class="work-type-value">${formatNum(wt.plan)} сум</div>
                    </div>
                    <div class="work-type-bar-group">
                        <div class="work-type-bar-label">Факт</div>
                        <div class="work-type-bar-container">
                            <div class="work-type-bar fact" style="width: ${factPercent}%"></div>
                        </div>
                        <div class="work-type-value">${formatNum(wt.fact)} сум</div>
                    </div>
                </div>
                <div class="work-type-diff ${diffClass}">
                    ${diff >= 0 ? 'Перерасход' : 'Экономия'}: ${formatNum(Math.abs(diff))} сум
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Рендеринг колонок по типам ресурсов
function renderResourceColumns() {
    // Показываем все типы ресурсов в определенном порядке
    const resourceOrder = [
        'Трудоресурсы', 'Материал', 'Доставка', 'Оборудование', 'Техника',
        'Мебель', 'Инструменты', 'Коммуналка', 'Документация',
        'Расходные материалы', 'Питание'
    ];

    return resourceOrder.map(type => {
        const data = analysisData.resources[type] || { plan: 0, fact: 0 };
        const diff = data.fact - data.plan;
        const diffClass = diff >= 0 ? 'negative' : 'positive';
        const diffLabel = diff >= 0 ? 'Перерасход' : 'Экономия';
        const diffSign = diff >= 0 ? '-' : '+';

        // Находим максимальное значение для масштабирования столбцов
        const maxValue = Math.max(data.plan, data.fact, 1);
        const planHeight = (data.plan / maxValue) * 100;
        const factHeight = (data.fact / maxValue) * 100;

        return `
            <div class="analysis-resource-column">
                <div class="analysis-resource-title">${ANALYSIS_RESOURCE_ICONS[type] || svgIcon('resource')}${type}</div>
                    <div class="analysis-resource-chart">
                        <div class="analysis-resource-bar-container">
                            <div class="analysis-resource-bar-label">План</div>
                            <div class="analysis-resource-bar-wrapper">
                                <div class="analysis-resource-bar plan" style="height: ${planHeight}%">
                                    ${planHeight > 15 ? formatNum(data.plan) : ''}
                                </div>
                            </div>
                            <div class="analysis-resource-bar-value">${formatNum(data.plan)}</div>
                        </div>
                        <div class="analysis-resource-bar-container">
                            <div class="analysis-resource-bar-label">Факт</div>
                            <div class="analysis-resource-bar-wrapper">
                                <div class="analysis-resource-bar fact" style="height: ${factHeight}%">
                                    ${factHeight > 15 ? formatNum(data.fact) : ''}
                                </div>
                            </div>
                            <div class="analysis-resource-bar-value">${formatNum(data.fact)}</div>
                        </div>
                    </div>
                    <div class="analysis-resource-diff ${diffClass}">
                        ${diffSign}${formatNum(Math.abs(diff))}
                    </div>
                </div>
            `;
    }).join('');
}

// Форматирование чисел
function formatNum(num) {
    if (num === null || num === undefined || num === '') return '0';
    return parseFloat(num).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Экспорт функции для использования в app.js
window.loadAnalysis = loadAnalysis;

