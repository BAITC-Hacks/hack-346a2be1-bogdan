type Brief = {
  title: string;
  category: string;
  description: string;
  budget: number;
  deadline: string;
  skills: string[];
  learningOutcome: string;
};

type BriefAnalysis = {
  score: number;
  completeness: "low" | "medium" | "high";
  summary: string;
  educationalValue: string;
  questions: Array<{ id: string; question: string; why: string }>;
  source: "openai" | "local";
  warning?: string;
};

type AnalyzeRequest = { brief?: Partial<Brief>; answers?: Record<string, string> };

const responseSchema = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    completeness: { type: "string", enum: ["low", "medium", "high"] },
    summary: { type: "string" },
    educationalValue: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          why: { type: "string" },
        },
        required: ["id", "question", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["score", "completeness", "summary", "educationalValue", "questions"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  let input: AnalyzeRequest;
  try {
    input = await request.json() as AnalyzeRequest;
  } catch {
    return Response.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  const brief = sanitizeBrief(input.brief);
  if (!brief.title || !brief.description) {
    return Response.json({ error: "Название и описание задачи обязательны." }, { status: 400 });
  }
  const answers = sanitizeAnswers(input.answers);
  const fallback = analyzeLocally(brief, answers);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  if (!apiKey) {
    return Response.json({ ...fallback, warning: "OPENAI_API_KEY не настроен; использован локальный анализ." });
  }

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions: [
          "Ты — редактор образовательных проектных задач для молодых специалистов.",
          "Оцени, достаточно ли информации, чтобы студент понял бизнес-контекст, конкретный результат, критерии успеха, исходные материалы, ограничения и то, чему он научится.",
          "Рейтинг 0–100 должен отражать полноту и выполнимость брифа, а не престиж компании или размер бюджета.",
          "Задавай не более четырёх коротких наводящих вопросов только о действительно недостающей информации.",
          "Не проси персональные данные и не придумывай факты. Если ответы заказчика уже закрыли пробел, не задавай тот же вопрос повторно.",
          "Пиши на русском языке.",
        ].join(" "),
        input: JSON.stringify({ brief, answers }),
        text: {
          format: {
            type: "json_schema",
            name: "educational_brief_analysis",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!openAIResponse.ok) {
      return Response.json({ ...fallback, warning: "OpenAI API временно недоступен; использован локальный анализ." });
    }

    const payload = await openAIResponse.json() as {
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")?.text;
    if (!outputText) return Response.json({ ...fallback, warning: "Модель не вернула анализ; использован локальный результат." });

    const parsed = JSON.parse(outputText) as Omit<BriefAnalysis, "source">;
    return Response.json({ ...parsed, score: clampScore(parsed.score), source: "openai" satisfies BriefAnalysis["source"] });
  } catch {
    return Response.json({ ...fallback, warning: "Не удалось завершить AI-анализ; использован локальный результат." });
  }
}

function sanitizeBrief(value: Partial<Brief> | undefined): Brief {
  const text = (field: unknown, max: number) => typeof field === "string" ? field.trim().slice(0, max) : "";
  return {
    title: text(value?.title, 160),
    category: text(value?.category, 80),
    description: text(value?.description, 4000),
    budget: Number.isFinite(value?.budget) ? Math.max(0, Number(value?.budget)) : 0,
    deadline: text(value?.deadline, 20),
    skills: Array.isArray(value?.skills) ? value.skills.map((skill) => text(skill, 60)).filter(Boolean).slice(0, 10) : [],
    learningOutcome: text(value?.learningOutcome, 1000),
  };
}

function sanitizeAnswers(value: Record<string, string> | undefined) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).slice(0, 10).map(([key, answer]) => [key.slice(0, 60), String(answer).trim().slice(0, 1500)]).filter(([, answer]) => answer));
}

function analyzeLocally(brief: Brief, answers: Record<string, string>): BriefAnalysis {
  let score = 20;
  const candidates: BriefAnalysis["questions"] = [];
  if (brief.title.length >= 12) score += 8;
  if (brief.category) score += 5;
  if (brief.description.length >= 180) score += 20;
  else if (brief.description.length >= 80) score += 12;
  else candidates.push({ id: "result", question: "Какой конкретный результат студент должен передать вам в конце работы?", why: "Из описания пока нельзя однозначно понять формат результата." });
  if (brief.budget > 0) score += 8;
  if (brief.deadline) score += 8;
  if (brief.skills.length >= 3) score += 8;
  else candidates.push({ id: "skills", question: "Какие 3–5 навыков действительно понадобятся для выполнения задачи?", why: "Это поможет подобрать исполнителя и объяснить образовательную ценность." });
  if (brief.learningOutcome.length >= 80) score += 15;
  else candidates.push({ id: "learning", question: "Чему молодой специалист научится на этой задаче и что сможет положить в портфолио?", why: "Образовательный результат должен быть таким же ясным, как бизнес-результат." });
  candidates.push(
    { id: "criteria", question: "По каким трём признакам вы поймёте, что работа выполнена хорошо?", why: "Проверяемые критерии защищают обе стороны от разного понимания результата." },
    { id: "assets", question: "Какие исходные материалы, доступы или данные вы предоставите исполнителю?", why: "Студент должен заранее понимать, с чем сможет работать." },
  );
  score += Math.min(Object.values(answers).filter((answer) => answer.length >= 20).length * 7, 28);
  const questions = candidates.filter((question) => !answers[question.id]).slice(0, 4);
  const normalized = clampScore(score);
  return {
    score: normalized,
    completeness: normalized >= 85 ? "high" : normalized >= 65 ? "medium" : "low",
    summary: normalized >= 85 ? "Бриф достаточно полный: студенту понятны результат, рамки работы и ценность проекта." : normalized >= 65 ? "Основа брифа понятна, но несколько уточнений сделают ожидания проверяемыми." : "Задаче не хватает деталей, без которых студенту сложно оценить объём и ожидаемый результат.",
    educationalValue: answers.learning || brief.learningOutcome || "Практика решения реальной задачи бизнеса с результатом для портфолио.",
    questions,
    source: "local",
  };
}

function clampScore(value: number) { return Math.max(0, Math.min(100, Math.round(Number(value) || 0))); }
