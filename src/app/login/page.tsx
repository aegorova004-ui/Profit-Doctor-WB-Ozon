import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Вход",
  description: "Прототип входа в Profit Doctor WB/Ozon.",
};

export default function LoginPage() {
  return (
    <main className="utility-page">
      <div className="utility-glow" aria-hidden="true" />
      <Link
        className="utility-brand"
        href="/"
        aria-label="Profit Doctor — на главную"
      >
        <span className="brand-mark" aria-hidden="true">
          PD
        </span>
        <span>
          <strong>Profit Doctor</strong>
          <small>WB / Ozon</small>
        </span>
      </Link>

      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow eyebrow-dark">Личный кабинет</p>
        <h1 id="login-title">Вход появится в Sprint 1</h1>
        <p className="auth-lead">
          Это каркас будущей авторизации. Сейчас мы не создаём аккаунт, не
          отправляем письмо и не сохраняем введённые данные.
        </p>

        <form className="auth-form" aria-describedby="auth-status">
          <label htmlFor="login-email">Электронная почта</label>
          <input
            id="login-email"
            name="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
          />
          <p className="field-help">
            На эту почту позже будет приходить безопасная ссылка для входа
          </p>
          <button className="button button-primary" type="button" disabled>
            Отправка ссылки пока недоступна
          </button>
          <p className="prototype-note" id="auth-status">
            <span aria-hidden="true">i</span> Авторизация не подключена. Форма
            ничего не отправляет
          </p>
        </form>

        <div className="auth-alternative">
          <span>Можно уже сейчас</span>
          <Link href="/upload">
            Проверить выбор файла без входа <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> Вернуться на главную
      </Link>
    </main>
  );
}
