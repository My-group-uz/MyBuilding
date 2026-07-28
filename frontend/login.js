// ===== СТРАНИЦА ВХОДА =====

const form = document.getElementById('login-form');
const errorBox = document.getElementById('auth-error');
const submitBtn = document.getElementById('login-submit');

// Сообщения об ошибках возврата от Google приходят параметром в адресе
const GOOGLE_ERRORS = {
    google: 'Не удалось войти через Google. Попробуйте ещё раз.',
    unknown_account: 'Эта почта не привязана ни к одной организации. Обратитесь к администратору.',
    blocked: 'Организация заблокирована. Обратитесь к администратору.'
};

function showError(text) {
    errorBox.textContent = text;
    errorBox.hidden = !text;
}

// --- Показать/скрыть пароль ---
const passwordInput = document.getElementById('password');
document.getElementById('toggle-password').addEventListener('click', () => {
    const shown = passwordInput.type === 'text';
    passwordInput.type = shown ? 'password' : 'text';
    passwordInput.focus();
});

// --- Ошибка из адресной строки ---
const params = new URLSearchParams(location.search);
if (params.get('error')) {
    showError(GOOGLE_ERRORS[params.get('error')] || 'Не удалось войти');
    // Чистим адрес: при обновлении страницы ошибка не должна всплывать снова
    history.replaceState(null, '', location.pathname);
}

// --- Уже вошли? ---
// Проверяем до показа формы: возвращать на страницу входа человека
// с действующей сессией незачем.
(async function checkSession() {
    try {
        const res = await fetch('/api/me');
        const me = await res.json();

        if (me.google_enabled) {
            document.getElementById('google-block').hidden = false;
        }
        if (me.authenticated) {
            location.replace(me.role === 'superadmin' ? '/frontend/admin.html' : '/frontend/index.html');
        }
    } catch (e) {
        // Сервер недоступен — форма всё равно нужна
    }
})();

// --- Отправка формы ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');

    const login = document.getElementById('login').value.trim();
    const password = passwordInput.value;

    if (!login || !password) {
        showError('Введите логин и пароль');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Проверяем…';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            showError(data.detail || 'Не удалось войти');
            return;
        }
        location.replace(data.redirect || '/frontend/index.html');
    } catch (err) {
        showError('Сервер недоступен. Проверьте подключение.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
    }
});
