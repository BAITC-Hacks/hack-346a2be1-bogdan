"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { readSession, Role, Session, writeSession } from "@/lib/workspace";

export function LoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("business");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [context, setContext] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const current = readSession();
    if (current) router.replace(current.role === "business" ? "/business" : "/student");
  }, [router]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !email.includes("@") || !context.trim() || password.length < 6) {
      setError("Заполните все поля. Пароль должен содержать не меньше 6 символов.");
      return;
    }
    const session: Session = { role, name: name.trim(), email: email.trim().toLowerCase(), context: context.trim() };
    writeSession(session);
    router.push(role === "business" ? "/business" : "/student");
  }

  return (
    <main className="login-page">
      <section className="login-manifesto">
        <div className="brand-mark"><span>R</span><b>RADAR</b></div>
        <div className="manifesto-index">ПЛАТФОРМА / 01—26</div>
        <div className="manifesto-copy">
          <p className="eyebrow">Работа становится опытом</p>
          <h1>Точка встречи<br />задачи и таланта.</h1>
          <p className="manifesto-note">Бизнес получает свежий взгляд. Студент — реальный кейс и измеримый рост навыков.</p>
        </div>
        <div className="orbit-figure" aria-hidden="true"><span className="orbit-dot" /><span className="orbit-line" /><b>68</b><small>skill signal</small></div>
      </section>

      <section className="login-panel">
        <div className="login-panel-head"><span>Вход в рабочее пространство</span><span className="live-dot">система активна</span></div>
        <form className="login-form" onSubmit={submit}>
          <fieldset className="role-switch">
            <legend>Кто вы сегодня?</legend>
            <button type="button" className={role === "business" ? "role-card active" : "role-card"} onClick={() => { setRole("business"); setContext(""); }}>
              <span className="role-number">01</span><span><b>Заказчик</b><small>Разместить задачу и собрать команду</small></span><span className="role-radio" />
            </button>
            <button type="button" className={role === "student" ? "role-card active" : "role-card"} onClick={() => { setRole("student"); setContext(""); }}>
              <span className="role-number">02</span><span><b>Исполнитель</b><small>Найти проект и усилить портфолио</small></span><span className="role-radio" />
            </button>
          </fieldset>

          <div className="form-grid two">
            <label><span>Имя</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "business" ? "Айдана" : "Дамир"} autoComplete="name" /></label>
            <label><span>{role === "business" ? "Компания" : "Направление"}</span><input value={context} onChange={(e) => setContext(e.target.value)} placeholder={role === "business" ? "Название бизнеса" : "Дизайн / Data / Dev"} /></label>
          </div>
          <label><span>Рабочая почта</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" /></label>
          <label><span>Пароль</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" autoComplete="current-password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" type="submit"><span>Войти как {role === "business" ? "заказчик" : "исполнитель"}</span><Icon name="arrow" /></button>
          <p className="privacy-note">Продолжая, вы соглашаетесь использовать данные задач только внутри платформы.</p>
        </form>
      </section>
    </main>
  );
}
