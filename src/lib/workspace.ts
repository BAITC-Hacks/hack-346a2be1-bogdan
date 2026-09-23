export type Role = "business" | "student";
export type ProjectStatus = "open" | "in_progress" | "closed";
export type ApplicationStatus = "pending" | "accepted" | "declined";

export type Session = {
  role: Role;
  name: string;
  email: string;
  context: string;
};

export type Project = {
  id: string;
  ownerEmail: string;
  company: string;
  title: string;
  category: string;
  description: string;
  budget: number;
  deadline: string;
  skills: string[];
  learningOutcome: string;
  briefScore: number;
  briefCompleteness: "low" | "medium" | "high";
  aiSummary: string;
  status: ProjectStatus;
  createdAt: string;
};

export type Application = {
  id: string;
  projectId: string;
  studentEmail: string;
  studentName: string;
  specialization: string;
  note: string;
  status: ApplicationStatus;
  createdAt: string;
};

export type Skill = { name: string; value: number; target: number };

export type StudentProfile = {
  email: string;
  name: string;
  specialization: string;
  availability: number;
  skills: Skill[];
};

export type Workspace = {
  projects: Project[];
  applications: Application[];
  students: StudentProfile[];
};

const SESSION_KEY = "radar.session.v2";
const WORKSPACE_KEY = "radar.workspace.v2";

const starterProjects: Project[] = [
  {
    id: "starter-brand-audit",
    ownerEmail: "studio@atlas.local",
    company: "ATLAS / городские сервисы",
    title: "Аудит онбординга мобильного приложения",
    category: "UX research",
    description: "Найти точки оттока в первых пяти минутах продукта и собрать короткий отчёт с приоритетами.",
    budget: 85000,
    deadline: "2026-10-18",
    skills: ["UX research", "Интервью", "Figma"],
    learningOutcome: "Практика интервью, поиска точек оттока и аргументации продуктовых решений на реальном пользовательском пути.",
    briefScore: 91,
    briefCompleteness: "high",
    aiSummary: "Чёткий объект исследования, результат и набор инструментов. Исполнителю понятны границы задачи.",
    status: "open",
    createdAt: "2026-09-20T09:00:00.000Z",
  },
  {
    id: "starter-data-story",
    ownerEmail: "team@buro.local",
    company: "БЮРО 17",
    title: "Собрать историю из данных опроса",
    category: "Data storytelling",
    description: "Очистить результаты исследования, найти три сильных инсайта и оформить их в понятный визуальный рассказ.",
    budget: 120000,
    deadline: "2026-10-25",
    skills: ["Аналитика", "Визуализация", "Презентации"],
    learningOutcome: "Работа с сырыми данными, выделение инсайтов и перевод аналитики в понятную бизнес-историю.",
    briefScore: 84,
    briefCompleteness: "medium",
    aiSummary: "Результат описан хорошо, но критерии качества визуальной истории стоит согласовать на старте.",
    status: "open",
    createdAt: "2026-09-19T12:00:00.000Z",
  },
];

export const emptyWorkspace: Workspace = { projects: starterProjects, applications: [], students: [] };

export const defaultSkills: Skill[] = [
  { name: "AI-инструменты", value: 72, target: 85 },
  { name: "Исследование", value: 58, target: 80 },
  { name: "Данные", value: 46, target: 75 },
  { name: "Коммуникация", value: 81, target: 90 },
  { name: "Продуктовое мышление", value: 63, target: 85 },
];

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; }
  catch { window.localStorage.removeItem(SESSION_KEY); return null; }
}

export function writeSession(session: Session) { window.localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function clearSession() { window.localStorage.removeItem(SESSION_KEY); }

export function readWorkspace(): Workspace {
  if (typeof window === "undefined") return emptyWorkspace;
  const raw = window.localStorage.getItem(WORKSPACE_KEY);
  if (!raw) { writeWorkspace(emptyWorkspace); return emptyWorkspace; }
  try {
    const parsed = JSON.parse(raw) as Workspace;
    return {
      projects: (parsed.projects ?? []).map(normalizeProject),
      applications: parsed.applications ?? [],
      students: parsed.students ?? [],
    };
  }
  catch { writeWorkspace(emptyWorkspace); return emptyWorkspace; }
}

export function writeWorkspace(workspace: Workspace) { window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace)); }

export function ensureStudent(workspace: Workspace, session: Session): Workspace {
  if (workspace.students.some((student) => student.email === session.email)) return workspace;
  return { ...workspace, students: [...workspace.students, { email: session.email, name: session.name, specialization: session.context, availability: 12, skills: defaultSkills }] };
}

export function ensureBusiness(workspace: Workspace, session: Session): Workspace {
  if (workspace.projects.some((project) => project.ownerEmail === session.email)) return workspace;
  const projectId = `welcome-${session.email}`;
  return {
    ...workspace,
    projects: [
      {
        id: projectId,
        ownerEmail: session.email,
        company: session.context,
        title: "Упаковать исследование клиентов в карту решений",
        category: "Product research",
        description: "Собрать разрозненные заметки интервью, выделить повторяющиеся барьеры и предложить три продуктовые гипотезы.",
        budget: 95000,
        deadline: "2026-10-20",
        skills: ["Исследования", "Аналитика", "Miro"],
        learningOutcome: "Научиться превращать интервью в карту инсайтов и проверяемые продуктовые гипотезы.",
        briefScore: 88,
        briefCompleteness: "high",
        aiSummary: "Понятны исходные материалы, ожидаемый результат и образовательная ценность задачи.",
        status: "open",
        createdAt: new Date().toISOString(),
      },
      ...workspace.projects,
    ],
    applications: [
      {
        id: `welcome-application-${session.email}`,
        projectId,
        studentEmail: "aliya@radar.local",
        studentName: "Алия Садыкова",
        specialization: "Product research · 3 курс",
        note: "Провела 18 пользовательских интервью для университетского продукта. Готова собрать карту инсайтов и защитить выводы перед командой.",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      ...workspace.applications,
    ],
  };
}

export function formatMoney(value: number) { return new Intl.NumberFormat("ru-RU").format(value) + " ₸"; }
export function formatShortDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(value)); }

function normalizeProject(project: Project): Project {
  const score = typeof project.briefScore === "number" ? project.briefScore : 60;
  return {
    ...project,
    learningOutcome: project.learningOutcome || "Получить опыт выполнения реальной задачи бизнеса и оформить результат в портфолио.",
    briefScore: score,
    briefCompleteness: project.briefCompleteness || (score >= 85 ? "high" : score >= 65 ? "medium" : "low"),
    aiSummary: project.aiSummary || "Базовое описание задачи. Детали результата рекомендуется уточнить с заказчиком.",
  };
}

export function rankProjects(projects: Project[]) {
  return [...projects].sort((first, second) => second.briefScore - first.briefScore || new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
}
