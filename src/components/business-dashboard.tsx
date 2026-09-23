"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import {
  ApplicationStatus,
  clearSession,
  emptyWorkspace,
  ensureBusiness,
  formatMoney,
  formatShortDate,
  Project,
  rankProjects,
  readSession,
  readWorkspace,
  Session,
  Workspace,
  writeWorkspace,
} from "@/lib/workspace";

type BusinessView = "overview" | "projects" | "responses";
type BriefDraft = Pick<Project, "title" | "category" | "description" | "budget" | "deadline" | "skills" | "learningOutcome">;
type BriefAnalysis = {
  score: number;
  completeness: "low" | "medium" | "high";
  summary: string;
  educationalValue: string;
  questions: Array<{ id: string; question: string; why: string }>;
  source: "openai" | "local";
  warning?: string;
};

const statusText = { open: "Ищем исполнителя", in_progress: "В работе", closed: "Завершён" };

export function BusinessDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [view, setView] = useState<BusinessView>("overview");
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | Project["status"]>("all");
  const [briefDraft, setBriefDraft] = useState<BriefDraft | null>(null);
  const [briefAnalysis, setBriefAnalysis] = useState<BriefAnalysis | null>(null);
  const [briefAnswers, setBriefAnswers] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    const current = readSession();
    if (!current || current.role !== "business") { router.replace("/login"); return; }
    const next = ensureBusiness(readWorkspace(), current);
    writeWorkspace(next);
    const hydration = window.setTimeout(() => {
      setSession(current);
      setWorkspace(next);
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [router]);

  const projects = useMemo(() => rankProjects(workspace.projects.filter((project) => project.ownerEmail === session?.email)), [workspace.projects, session]);
  const projectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const applications = workspace.applications.filter((application) => projectIds.has(application.projectId));
  const visibleProjects = filter === "all" ? projects : projects.filter((project) => project.status === filter);
  const pendingCount = applications.filter((application) => application.status === "pending").length;
  const totalBudget = projects.reduce((sum, project) => sum + project.budget, 0);
  const averageBriefScore = projects.length ? Math.round(projects.reduce((sum, project) => sum + project.briefScore, 0) / projects.length) : 0;

  function save(next: Workspace) { setWorkspace(next); writeWorkspace(next); }

  function startBriefReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const draft: BriefDraft = {
      title: String(data.get("title")),
      category: String(data.get("category")),
      description: String(data.get("description")),
      budget: Number(data.get("budget")),
      deadline: String(data.get("deadline")),
      skills: String(data.get("skills")).split(",").map((skill) => skill.trim()).filter(Boolean),
      learningOutcome: String(data.get("learningOutcome")),
    };
    setBriefDraft(draft);
    setBriefAnswers({});
    void analyzeBrief(draft, {});
  }

  async function analyzeBrief(draft: BriefDraft, answers: Record<string, string>) {
    setAiLoading(true);
    setAiError("");
    try {
      const response = await fetch("/api/brief/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: draft, answers }),
      });
      const result = await response.json() as BriefAnalysis & { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось проверить бриф.");
      setBriefAnalysis(result);
      setBriefAnswers(answers);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Не удалось проверить бриф.");
    } finally {
      setAiLoading(false);
    }
  }

  function submitAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!briefDraft || !briefAnalysis) return;
    const data = new FormData(event.currentTarget);
    const nextAnswers = { ...briefAnswers };
    for (const question of briefAnalysis.questions) nextAnswers[question.id] = String(data.get(question.id) || "").trim();
    void analyzeBrief(briefDraft, nextAnswers);
  }

  function publishProject() {
    if (!session || !briefDraft || !briefAnalysis) return;
    const project: Project = {
      id: `project-${Date.now()}`,
      ownerEmail: session.email,
      company: session.context,
      ...briefDraft,
      learningOutcome: briefAnalysis.educationalValue || briefDraft.learningOutcome,
      briefScore: briefAnalysis.score,
      briefCompleteness: briefAnalysis.completeness,
      aiSummary: briefAnalysis.summary,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    save({ ...workspace, projects: [project, ...workspace.projects] });
    closeCreate();
    setView("projects");
  }

  function openCreate() { setBriefDraft(null); setBriefAnalysis(null); setBriefAnswers({}); setAiError(""); setShowCreate(true); }
  function closeCreate() { setShowCreate(false); setBriefDraft(null); setBriefAnalysis(null); setBriefAnswers({}); setAiError(""); }

  function updateApplication(id: string, status: ApplicationStatus) {
    const target = workspace.applications.find((application) => application.id === id);
    save({
      ...workspace,
      applications: workspace.applications.map((application) => application.id === id ? { ...application, status } : application),
      projects: workspace.projects.map((project) => target?.projectId === project.id && status === "accepted" ? { ...project, status: "in_progress" } : project),
    });
  }

  function logout() { clearSession(); router.push("/login"); }
  if (!session) return <div className="route-loader">Настраиваем рабочий стол…</div>;

  return (
    <main className="workspace-shell">
      <aside className="side-rail">
        <div className="rail-brand"><span>R</span><b>RADAR</b></div>
        <nav aria-label="Навигация заказчика">
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><Icon name="grid" /><span>Обзор</span></button>
          <button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}><Icon name="brief" /><span>Задачи</span><em>{projects.length}</em></button>
          <button className={view === "responses" ? "active" : ""} onClick={() => setView("responses")}><Icon name="people" /><span>Отклики</span>{pendingCount > 0 && <em className="accent">{pendingCount}</em>}</button>
        </nav>
        <div className="rail-profile"><span className="avatar">{session.name.slice(0, 2).toUpperCase()}</span><span><b>{session.name}</b><small>{session.context}</small></span><button onClick={logout} aria-label="Выйти"><Icon name="exit" /></button></div>
      </aside>

      <section className="work-area">
        <header className="work-header">
          <div><p className="eyebrow">Кабинет заказчика · {session.context}</p><h1>{view === "overview" ? "Пульт задач" : view === "projects" ? "Задачи бизнеса" : "Кандидаты и отклики"}</h1></div>
          <div className="header-actions"><span className="header-date">23 / 09 / 2026</span><button className="ink-button" onClick={openCreate}><Icon name="plus" />Новая задача</button></div>
        </header>

        {view === "overview" && (
          <>
            <section className="metric-strip">
              <article className="metric dark"><span>Открытые задачи</span><b>{projects.filter((p) => p.status === "open").length.toString().padStart(2, "0")}</b><small>в поиске студентов</small></article>
              <article className="metric coral"><span>Новые отклики</span><b>{pendingCount.toString().padStart(2, "0")}</b><small>требуют решения</small></article>
              <article className="metric paper"><span>Проектный бюджет</span><b>{Math.round(totalBudget / 1000)}k</b><small>тенге распределено</small></article>
              <article className="metric line"><span>Полнота брифов</span><b>{averageBriefScore}</b><small>средний AI-рейтинг / 100</small></article>
            </section>

            <section className="business-grid">
              <div className="board-panel">
                <div className="section-head"><div><span>01</span><h2>Активный контур</h2></div><button onClick={() => setView("projects")}>Все задачи <Icon name="arrow" size={16} /></button></div>
                <div className="project-ledger">
                  {projects.slice(0, 3).map((project, index) => <ProjectRow key={project.id} project={project} index={index} applicationCount={applications.filter((a) => a.projectId === project.id).length} />)}
                </div>
              </div>
              <aside className="signal-panel">
                <div className="section-head inverse"><div><span>02</span><h2>Сигнал рынка</h2></div></div>
                <div className="signal-figure"><span>+31%</span><svg viewBox="0 0 220 80" aria-hidden="true"><path d="M2 68 C30 60, 40 72, 65 54 S105 43, 118 50 S146 42, 158 28 S190 31, 218 8" /></svg></div>
                <p>Спрос на исследовательские навыки среди ваших задач вырос за этот месяц.</p>
                <div className="signal-tags"><span>Research</span><span>Data story</span><span>AI workflow</span></div>
              </aside>
            </section>
          </>
        )}

        {view === "projects" && (
          <section className="content-panel">
            <div className="filter-line"><div>{(["all", "open", "in_progress", "closed"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Все" : statusText[item]}</button>)}</div><span>{visibleProjects.length} записей</span></div>
            <div className="project-cards">{visibleProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} applicationCount={applications.filter((a) => a.projectId === project.id).length} />)}</div>
          </section>
        )}

        {view === "responses" && (
          <section className="content-panel responses-panel">
            <div className="section-intro"><span>Кандидаты отсортированы по времени отклика</span><p>Принимайте исполнителя — статус задачи автоматически изменится на «В работе».</p></div>
            {applications.length === 0 ? <div className="empty-state"><Icon name="people" size={32} /><h2>Откликов пока нет</h2><p>Как только студент откликнется, его профиль появится здесь.</p></div> : applications.map((application) => {
              const project = projects.find((item) => item.id === application.projectId);
              return <article className="applicant" key={application.id}>
                <div className="applicant-person"><span className="avatar large">{application.studentName.slice(0, 2).toUpperCase()}</span><div><h3>{application.studentName}</h3><p>{application.specialization}</p></div></div>
                <div className="applicant-note"><span>Отклик на: {project?.title}</span><p>«{application.note}»</p></div>
                <div className="applicant-actions">{application.status === "pending" ? <><button className="accept" onClick={() => updateApplication(application.id, "accepted")}><Icon name="check" />Принять</button><button onClick={() => updateApplication(application.id, "declined")}>Отказать</button></> : <span className={`decision ${application.status}`}>{application.status === "accepted" ? "Принят в проект" : "Отклонён"}</span>}</div>
              </article>;
            })}
          </section>
        )}
      </section>

      {showCreate && <div className="drawer-backdrop" onMouseDown={closeCreate}><aside className="create-drawer" onMouseDown={(e) => e.stopPropagation()}><div className="drawer-head"><div><span>Новая задача / AI BRIEF</span><h2>{briefDraft ? "Уточним задачу" : "Что нужно сделать?"}</h2></div><button onClick={closeCreate}>×</button></div>
        {!briefDraft ? <form onSubmit={startBriefReview} className="project-form">
          <div className="brief-intro"><Icon name="spark" /><p>После заполнения AI проверит полноту брифа, задаст наводящие вопросы и присвоит рейтинг. Чем выше рейтинг, тем выше задача появится в ленте студентов.</p></div>
          <label><span>Название задачи</span><input name="title" required placeholder="Например: исследовать новый сегмент" /></label>
          <div className="form-grid two"><label><span>Направление</span><input name="category" required placeholder="Research / Design / Data" /></label><label><span>Бюджет, ₸</span><input name="budget" type="number" min="10000" required placeholder="100000" /></label></div>
          <label><span>Контекст и результат</span><textarea name="description" required rows={5} minLength={40} placeholder="Опишите бизнес-проблему, исходные материалы и результат, который хотите получить…" /></label>
          <label><span>Чему научится молодой специалист</span><textarea name="learningOutcome" required rows={3} minLength={30} placeholder="Какой практический навык появится и что можно будет показать в портфолио?" /></label>
          <div className="form-grid two"><label><span>Дедлайн</span><input name="deadline" type="date" required /></label><label><span>Навыки через запятую</span><input name="skills" required placeholder="Аналитика, Figma, Интервью" /></label></div>
          <button className="primary-action" type="submit"><span>Проверить бриф с AI</span><Icon name="spark" /></button>
        </form> : <div className="ai-review">
          {aiLoading ? <div className="ai-loading"><span /><h3>AI читает бриф</h3><p>Проверяем результат, критерии, материалы и образовательную ценность.</p></div> : briefAnalysis ? <>
            <div className="score-sheet"><div className={`brief-score ${briefAnalysis.completeness}`}><b>{briefAnalysis.score}</b><span>/ 100</span></div><div><span>{briefAnalysis.source === "openai" ? "GPT-анализ" : "Локальный анализ"}</span><h3>{briefAnalysis.summary}</h3><p>{briefAnalysis.warning}</p></div></div>
            <div className="education-note"><Icon name="book" /><div><span>Ценность для молодого специалиста</span><p>{briefAnalysis.educationalValue}</p></div></div>
            {briefAnalysis.questions.length > 0 ? <form className="followup-form" onSubmit={submitAnswers}><div className="followup-head"><span>Наводящие вопросы</span><b>{briefAnalysis.questions.length}</b></div>{briefAnalysis.questions.map((question, index) => <label key={question.id}><span>{String(index + 1).padStart(2, "0")} / {question.question}</span><small>{question.why}</small><textarea name={question.id} rows={3} required minLength={10} placeholder="Ваш ответ…" /></label>)}<button className="primary-action" type="submit"><span>Пересчитать рейтинг</span><Icon name="spark" /></button></form> : <div className="brief-ready"><Icon name="check" /><span>Бриф готов к публикации</span></div>}
            <div className="review-actions"><button onClick={() => { setBriefDraft(null); setBriefAnalysis(null); }}>Вернуться к полям</button><button className="publish-brief" onClick={publishProject}>Опубликовать · {briefAnalysis.score}</button></div>
          </> : <div className="ai-loading error"><h3>Анализ не выполнен</h3><p>{aiError}</p><button onClick={() => void analyzeBrief(briefDraft, briefAnswers)}>Повторить</button></div>}
        </div>}
      </aside></div>}
    </main>
  );
}

function ProjectRow({ project, index, applicationCount }: { project: Project; index: number; applicationCount: number }) {
  return <article className="project-row"><span className="row-index">{String(index + 1).padStart(2, "0")}</span><div><span className="project-category">{project.category}</span><h3>{project.title}</h3><div className="skill-chips">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></div><div className="row-meta"><span className={`score-badge ${project.briefCompleteness}`}>{project.briefScore} / 100</span><span className={`status ${project.status}`}>{statusText[project.status]}</span><b>{formatMoney(project.budget)}</b><small>{applicationCount} откликов · до {formatShortDate(project.deadline)}</small></div></article>;
}

function ProjectCard({ project, index, applicationCount }: { project: Project; index: number; applicationCount: number }) {
  return <article className="project-card"><div className="card-corner">{String(index + 1).padStart(2, "0")}</div><div className="card-top"><span className="project-category">{project.category}</span><span className={`score-badge ${project.briefCompleteness}`}>{project.briefScore}</span><span className={`status ${project.status}`}>{statusText[project.status]}</span></div><h2>{project.title}</h2><p>{project.description}</p><div className="learning-line"><Icon name="book" size={16} /><span>{project.learningOutcome}</span></div><div className="skill-chips">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><footer><b>{formatMoney(project.budget)}</b><span><Icon name="people" size={16} />{applicationCount}</span><span><Icon name="clock" size={16} />{formatShortDate(project.deadline)}</span></footer></article>;
}
