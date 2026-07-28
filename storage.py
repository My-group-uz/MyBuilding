"""
Куда складывать загруженные файлы.

Файловая система контейнера на Railway эфемерна: при каждом деплое
она пересоздаётся, и всё загруженное пропадает. Спасает Volume —
постоянный диск, который монтируется в контейнер.

Railway при подключённом Volume сам подставляет переменную
RAILWAY_VOLUME_MOUNT_PATH с точкой монтирования. Здесь она читается
автоматически, поэтому после подключения диска в панели ничего
править не нужно — приложение само начнёт писать туда.

Порядок выбора каталога:
  1. UPLOAD_DIR — если задан явно, побеждает всё остальное
  2. RAILWAY_VOLUME_MOUNT_PATH + /uploads — Volume подключён
  3. ./uploads — локальная разработка
"""

import os

_ROOT = os.path.dirname(os.path.abspath(__file__))


def _resolve() -> str:
    explicit = os.getenv("UPLOAD_DIR")
    if explicit:
        return explicit

    volume = os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
    if volume:
        return os.path.join(volume, "uploads")

    # Локально — рядом с кодом. Абсолютный путь, потому что рабочий
    # каталог процесса не всегда совпадает с папкой проекта.
    return os.path.join(_ROOT, "uploads")


UPLOAD_DIR = _resolve()

# Диск может быть примонтирован уже после старта контейнера,
# поэтому каталог создаём здесь, а не полагаемся на его наличие.
os.makedirs(UPLOAD_DIR, exist_ok=True)


def is_persistent() -> bool:
    """True, если файлы переживут передеплой."""
    return bool(os.getenv("UPLOAD_DIR") or os.getenv("RAILWAY_VOLUME_MOUNT_PATH"))


def describe() -> dict:
    """Состояние хранилища — отдаётся в /health для диагностики."""
    return {
        "path": UPLOAD_DIR,
        "persistent": is_persistent(),
        "source": (
            "UPLOAD_DIR" if os.getenv("UPLOAD_DIR")
            else "railway-volume" if os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
            else "local"
        ),
    }
