# Запуск

1. Установить зависимости:
   ```
   pip install -r requirements.txt
   ```

2. Вставить ключ GPT API — либо через переменную окружения:
   ```
   set OPENAI_API_KEY=ваш_ключ      (Windows)
   export OPENAI_API_KEY=ваш_ключ   (Mac/Linux)
   ```
   либо прямо в app.py, строка `OPENAI_API_KEY = os.environ.get(...)`.

3. Проверить/поменять модель в app.py:
   ```python
   OPENAI_MODEL = "gpt-4o-mini"
   ```
   на ту, что выдадут на хакатоне.

4. Запустить:
   ```
   python app.py
   ```

5. Открыть в браузере: http://127.0.0.1:5000

# Структура

- `app.py` — Flask-сервер: роуты API + работа с SQLite (`app.db` создаётся сама при первом запуске)
- `static/index.html` — фронт (одна страница, роли Бизнес/Студент)
- `app.db` — база данных SQLite (появится после первого запуска, в .gitignore добавить)

# Основные эндпоинты

- `POST /api/generate` — черновик → карточка + рейтинг (вызывает GPT)
- `POST /api/jobs` — опубликовать карточку
- `GET /api/jobs` — список задач с откликами
- `POST /api/jobs/<id>/apply` — откликнуться
- `POST /api/applicants/<id>/choose` — выбрать команду
