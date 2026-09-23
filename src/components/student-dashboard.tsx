"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import {
  Application,
  clearSession,
  emptyWorkspace,
  ensureStudent,
  formatMoney,
  formatShortDate,
  Project,
  rankProjects,
  readSession,
  readWorkspace,
  Session,
  Skill,
  Workspace,
  writeWorkspace,
} from "@/lib/workspace";

type StudentView = "opportunities" | "growth" | "applications";

export function StudentDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [view, setView] = useState<StudentView>("opportunities");
  const [category, setCategory] = useState("Все направления");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    const current = readSession();
    if (!current || current.role !== "student") { router.replace("/login"); return; }
    const next = ensureStudent(readWorkspace(), current);
    writeWorkspace(next);
    const hydration = window.setTimeout(() => {
      setSession(current);
      setWorkspace(next);
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [router]);

  const profile = workspace.students.find((student) => student.email === session?.email);
  const myApplications = workspace.applications.filter((application) => application.studentEmail === session?.email);
  const categories = ["Все направления", ...Array.from(new Set(workspace.projects.filter((p) => p.status === "open").map((p) => p.category)))];
  const visibleProjects = rankProjects(workspace.projects.filter((project) => project.status === "open" && (category === "Все направления" || project.category === category)));
  const appliedIds = useMemo(() => new Set(myApplications.map((application) => application.projectId)), [myApplications]);
  const average = profile ? Math.round(profile.skills.reduce((sum, skill) => sum + skill.value, 0) / profile.skills.length) : 0;

  function save(next: Workspace) { setWorkspace(next); writeWorkspace(next); }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedProject || appliedIds.has(selectedProject.id)) return;
    const note = String(new FormData(event.currentTarget).get("note"));
    const application: Application = {
      id: `application-${Date.now()}`,
      projectId: selectedProject.id,
      studentEmail: session.email,
      studentName: session.name,
      specialization: session.context,
      note,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    save({ ...workspace, applications: [application, ...workspace.applications] });
    setSelectedProject(null);
    setView("applications");
  }

  function updateSkill(index: number, value: number) {
    if (!profile) return;
    const skills = profile.skills.map((skill, skillIndex) => skillIndex === index ? { ...skill, value } : skill);
    const students = workspace.students.map((student) => student.email === profile.email ? { ...student, skills } : student);
    save({ ...workspace, students });
  }

  function logout() { clearSession(); router.push("/login"); }
  if (!session || !profile) return <div className="route-loader">Собираем ваш радар…</div>;

  return (
    <main className="workspace-shell student-theme">
      <aside className="side-rail">
        <div className="rail-brand"><span>R</span><b>RADAR</b></div>
        <nav aria-label="Навигация исполнителя">
          <button className={view === "opportunities" ? "active" : ""} onClick={() => setView("opportunities")}><Icon name="brief" /><span>Задачи</span><em>{visibleProjects.length}</em></button>
          <button className={view === "growth" ? "active" : ""} onClick={() => setView("growth")}><Icon name="radar" /><span>Мой радар</span><em>{average}</em></button>
          <button className={view === "applications" ? "active" : ""} onClick={() => setView("applications")}><Icon name="book" /><span>Отклики</span><em>{myApplications.length}</em></button>
        </nav>
        <div className="rail-profile"><span className="avatar">{session.name.slice(0, 2).toUpperCase()}</span><span><b>{session.name}</b><small>{session.context}</small></span><button onClick={logout} aria-label="Выйти"><Icon name="exit" /></button></div>
      </aside>

      <section className="work-area">
        <header className="work-header">
          <div><p className="eyebrow">Кабинет исполнителя · открыт к проектам</p><h1>{view === "opportunities" ? "Лента возможностей" : view === "growth" ? "Карта роста" : "Мои отклики"}</h1></div>
          <div className="student-score"><span>Индекс профиля</span><b>{average}</b><small>/ 100</small></div>
        </header>

        {view === "opportunities" && (
          <>
            <section className="student-hero">
              <div><span className="eyebrow">Обучение на реальных задачах бизнеса</span><h2>Не симуляция.<br />Настоящий результат.</h2><p>Берите задачу, получайте обратную связь от заказчика и превращайте знание в доказанный опыт для портфолио.</p></div>
              <div className="match-stamp"><span>match</span><b>84%</b><small>по навыкам и загрузке</small></div>
            </section>
            <div className="category-tape" role="group" aria-label="Фильтр направлений">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
            <section className="opportunity-list">
              {visibleProjects.map((project, index) => <OpportunityCard key={project.id} project={project} index={index} applied={appliedIds.has(project.id)} onApply={() => setSelectedProject(project)} />)}
            </section>
          </>
        )}

        {view === "growth" && (
          <section className="growth-layout">
            <div className="radar-panel">
              <div className="section-head"><div><span>01</span><h2>Skill Gap Radar</h2></div><small>обновляется сразу</small></div>
              <RadarChart skills={profile.skills} />
              <div className="radar-legend"><span><i className="current" />текущий уровень</span><span><i className="target" />цель на 90 дней</span></div>
            </div>
            <div className="skills-editor">
              <div className="section-head"><div><span>02</span><h2>Самооценка</h2></div></div>
              <p className="editor-note">Двигайте шкалы после каждого проекта. Разрыв до цели подсказывает, что брать следующим.</p>
              {profile.skills.map((skill, index) => <label className="skill-control" key={skill.name}><span><b>{skill.name}</b><em>{skill.value} / {skill.target}</em></span><input type="range" min="0" max="100" value={skill.value} onChange={(event) => updateSkill(index, Number(event.target.value))} /><small style={{ width: `${skill.target}%` }} /></label>)}
              <div className="next-move"><Icon name="spark" /><div><span>Следующий сильный ход</span><p>Выберите проект с аналитикой данных: здесь максимальный разрыв до целевого уровня.</p></div></div>
            </div>
          </section>
        )}

        {view === "applications" && (
          <section className="content-panel student-applications">
            <div className="section-intro"><span>{myApplications.length} активных записей</span><p>Статус обновляется после решения заказчика.</p></div>
            {myApplications.length === 0 ? <div className="empty-state"><Icon name="book" size={32} /><h2>Вы ещё не откликались</h2><p>Выберите подходящую задачу в ленте — она появится здесь.</p><button className="ink-button" onClick={() => setView("opportunities")}>Открыть ленту</button></div> : myApplications.map((application) => {
              const project = workspace.projects.find((item) => item.id === application.projectId);
              return <article className="application-ticket" key={application.id}><div className="ticket-punch" /><div className="ticket-main"><span>{project?.company}</span><h2>{project?.title}</h2><p>{application.note}</p></div><div className="ticket-status"><span className={`decision ${application.status}`}>{application.status === "pending" ? "На рассмотрении" : application.status === "accepted" ? "Вы в проекте" : "Не в этот раз"}</span><small>отправлено {formatShortDate(application.createdAt)}</small></div></article>;
            })}
          </section>
        )}
      </section>

      {selectedProject && <div className="drawer-backdrop" onMouseDown={() => setSelectedProject(null)}><aside className="create-drawer apply-drawer" onMouseDown={(e) => e.stopPropagation()}><div className="drawer-head"><div><span>ОТКЛИК / {selectedProject.company}</span><h2>{selectedProject.title}</h2></div><button onClick={() => setSelectedProject(null)}>×</button></div><div className="apply-summary"><span>{formatMoney(selectedProject.budget)}</span><span>до {formatShortDate(selectedProject.deadline)}</span></div><p className="drawer-description">{selectedProject.description}</p><form className="project-form" onSubmit={apply}><label><span>Почему именно вы?</span><textarea name="note" rows={7} required minLength={30} placeholder="Коротко опишите релевантный опыт и ваш план первого шага…" /></label><p className="privacy-note">Заказчик увидит ваше имя, направление и текст отклика.</p><button className="primary-action" type="submit"><span>Отправить отклик</span><Icon name="arrow" /></button></form></aside></div>}
    </main>
  );
}

function OpportunityCard({ project, index, applied, onApply }: { project: Project; index: number; applied: boolean; onApply: () => void }) {
  return <article className="opportunity-card"><div className="opportunity-index"><span>R/{String(index + 1).padStart(2, "0")}</span><b>{project.briefScore}</b><small>рейтинг брифа</small></div><div className="opportunity-body"><div className="opportunity-company"><span>{project.company}</span><span>{project.category}</span></div><h2>{project.title}</h2><p>{project.description}</p><div className="learning-line student"><Icon name="book" size={16} /><span><b>Вы научитесь:</b> {project.learningOutcome}</span></div><div className="skill-chips">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></div><div className="opportunity-action"><div><span className={`score-badge ${project.briefCompleteness}`}>{project.briefScore} / 100 · полнота</span><b>{formatMoney(project.budget)}</b><span><Icon name="clock" size={16} />до {formatShortDate(project.deadline)}</span></div><button disabled={applied} onClick={onApply}>{applied ? <><Icon name="check" />Отклик отправлен</> : <>Откликнуться <Icon name="arrow" /></>}</button></div></article>;
}

function RadarChart({ skills }: { skills: Skill[] }) {
  const center = 150;
  const radius = 108;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / skills.length);
    const distance = radius * value / 100;
    return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
  };
  const ring = (value: number) => skills.map((_, index) => point(index, value)).join(" ");
  return <div className="radar-chart"><svg viewBox="0 0 300 300" role="img" aria-label="Радар текущих и целевых навыков">{[25, 50, 75, 100].map((value) => <polygon key={value} points={ring(value)} className="radar-ring" />)}{skills.map((skill, index) => <line key={skill.name} x1={center} y1={center} x2={point(index, 100).split(",")[0]} y2={point(index, 100).split(",")[1]} className="radar-axis" />)}<polygon points={skills.map((skill, index) => point(index, skill.target)).join(" ")} className="radar-target" /><polygon points={skills.map((skill, index) => point(index, skill.value)).join(" ")} className="radar-current" />{skills.map((skill, index) => { const [x, y] = point(index, 100).split(",").map(Number); return <text key={skill.name} x={x} y={y} dx={x < center ? -8 : x > center ? 8 : 0} dy={y < center ? -8 : 16} textAnchor={x < center ? "end" : x > center ? "start" : "middle"}>{skill.name}</text>; })}</svg></div>;
}
