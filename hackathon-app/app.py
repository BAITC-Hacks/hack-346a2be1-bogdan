import os
import sqlite3
import json
from flask import Flask, request, jsonify, send_from_directory

# ============================================================
# НАСТРОЙКА GPT API — вставьте сюда свой ключ и модель
# ============================================================
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "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")
OPENAI_MODEL = "gpt-4o-mini"   # замените на модель, которую выдадут на хакатоне

from openai import OpenAI
client = OpenAI(api_key=OPENAI_API_KEY)

app = Flask(__name__, static_folder="static", static_url_path="")
DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")


# ============================================================
# БАЗА ДАННЫХ (SQLite)
# ============================================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track TEXT,
            title TEXT,
            description TEXT,
            skills TEXT,
            result TEXT,
            score INTEGER,
            tips TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS applicants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER,
            name TEXT,
            msg TEXT,
            chosen INTEGER DEFAULT 0,
            FOREIGN KEY (job_id) REFERENCES jobs (id)
        )
    """)
    conn.commit()
    conn.close()


init_db()


# ============================================================
# ВЫЗОВ GPT — превращает черновик в карточку + рейтинг
# ============================================================
def generate_card_from_ai(draft, track):
    prompt = f"""Ты помогаешь бизнесу оформить задачу для студентов-разработчиков.
Отрасль: {track}
Черновик задачи от бизнеса: "{draft}"

Преврати черновик в структурированную карточку задачи. Оцени качество и полноту
описания по шкале от 0 до 100 (чем подробнее и понятнее задача — тем выше балл).
Если чего-то не хватает (сроков, ожидаемого результата, нужных навыков) — это
должно снижать балл, и это нужно перечислить в подсказках (tips), как бизнесу
улучшить карточку.

Ответь СТРОГО в формате JSON, без пояснений и без markdown-разметки:
{{
  "title": "короткий заголовок задачи",
  "description": "развёрнутое описание, 2-3 предложения",
  "skills": "нужные навыки/технологии через запятую",
  "result": "какой ожидается результат",
  "score": число от 0 до 100,
  "tips": ["совет 1", "совет 2"]
}}"""

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
    )

    raw = response.choices[0].message.content.strip()
    # на случай если модель обернёт ответ в ```json ... ```
    raw = raw.replace("```json", "").replace("```", "").strip()
    card = json.loads(raw)
    return card


# ============================================================
# API ROUTES
# ============================================================
@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/generate", methods=["POST"])
def api_generate():
    data = request.get_json()
    draft = data.get("draft", "").strip()
    track = data.get("track", "Общее").strip()

    if not draft:
        return jsonify({"error": "Пустой черновик"}), 400

    try:
        card = generate_card_from_ai(draft, track)
    except Exception as e:
        return jsonify({"error": f"Ошибка ИИ: {str(e)}"}), 500

    return jsonify(card)


@app.route("/api/jobs", methods=["GET"])
def api_list_jobs():
    conn = get_db()
    jobs = conn.execute("SELECT * FROM jobs ORDER BY score DESC").fetchall()

    result = []
    for job in jobs:
        applicants = conn.execute(
            "SELECT * FROM applicants WHERE job_id = ?", (job["id"],)
        ).fetchall()
        result.append({
            "id": job["id"],
            "track": job["track"],
            "title": job["title"],
            "description": job["description"],
            "skills": job["skills"],
            "result": job["result"],
            "score": job["score"],
            "tips": json.loads(job["tips"]),
            "applicants": [
                {"id": a["id"], "name": a["name"], "msg": a["msg"], "chosen": bool(a["chosen"])}
                for a in applicants
            ],
        })
    conn.close()
    return jsonify(result)


@app.route("/api/jobs", methods=["POST"])
def api_create_job():
    data = request.get_json()
    conn = get_db()
    conn.execute(
        "INSERT INTO jobs (track, title, description, skills, result, score, tips) VALUES (?,?,?,?,?,?,?)",
        (
            data.get("track", ""),
            data.get("title", ""),
            data.get("description", ""),
            data.get("skills", ""),
            data.get("result", ""),
            data.get("score", 0),
            json.dumps(data.get("tips", []), ensure_ascii=False),
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/jobs/<int:job_id>/apply", methods=["POST"])
def api_apply(job_id):
    data = request.get_json()
    name = data.get("name", "").strip()
    msg = data.get("msg", "").strip() or "—"
    if not name:
        return jsonify({"error": "Укажите название команды"}), 400

    conn = get_db()
    conn.execute(
        "INSERT INTO applicants (job_id, name, msg) VALUES (?,?,?)",
        (job_id, name, msg),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/applicants/<int:applicant_id>/choose", methods=["POST"])
def api_choose(applicant_id):
    conn = get_db()
    row = conn.execute(
        "SELECT job_id FROM applicants WHERE id = ?", (applicant_id,)
    ).fetchone()
    if row is None:
        return jsonify({"error": "Не найдено"}), 404

    job_id = row["job_id"]
    # снимаем отметку со всех остальных заявок по этой задаче
    conn.execute("UPDATE applicants SET chosen = 0 WHERE job_id = ?", (job_id,))
    conn.execute("UPDATE applicants SET chosen = 1 WHERE id = ?", (applicant_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
