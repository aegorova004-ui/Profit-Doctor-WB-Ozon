import Image from "next/image";
import Link from "next/link";

import { ProfitDoctorMascot } from "@/components/profit-doctor-mascot";

const audiences = [
  {
    marker: "01",
    title: "Селлерам с десятками SKU",
    text: "Когда оборот растёт, а денег на счёте больше не становится — покажем экономику каждой позиции.",
  },
  {
    marker: "02",
    title: "Брендам на WB и Ozon",
    text: "Сведём комиссии, логистику, хранение и возвраты в понятную картину без ручных таблиц.",
  },
  {
    marker: "03",
    title: "Менеджерам и агентствам",
    text: "Поможем быстро находить проблемные товары и объяснять клиенту, что менять в ассортименте.",
  },
];

const steps = [
  {
    number: "01",
    title: "Выгрузите отчёт",
    text: "Подойдёт CSV или XLSX из кабинета Wildberries либо Ozon.",
  },
  {
    number: "02",
    title: "Добавьте себестоимость",
    text: "Если её нет в отчёте, сервис попросит заполнить данные. Ничего не будем угадывать.",
  },
  {
    number: "03",
    title: "Получите диагноз",
    text: "Увидите прибыль, маржу, расходы и список SKU, которые требуют внимания.",
  },
];

const reportRows = [
  {
    sku: "Органайзер M",
    marketplace: "WB",
    revenue: "184 500 ₽",
    expenses: "121 620 ₽",
    profit: "+24 430 ₽",
    margin: "13,2%",
    status: "Здоровая",
    tone: "good",
  },
  {
    sku: "Чехол Linen",
    marketplace: "Ozon",
    revenue: "97 800 ₽",
    expenses: "78 460 ₽",
    profit: "+4 120 ₽",
    margin: "4,2%",
    status: "Проверить цену",
    tone: "warn",
  },
  {
    sku: "Лампа Mini",
    marketplace: "WB",
    revenue: "76 240 ₽",
    expenses: "82 090 ₽",
    profit: "−18 350 ₽",
    margin: "−24,1%",
    status: "Съедает прибыль",
    tone: "danger",
  },
  {
    sku: "Набор Storage",
    marketplace: "Ozon",
    revenue: "58 320 ₽",
    expenses: "43 110 ₽",
    profit: "+7 600 ₽",
    margin: "13,0%",
    status: "Здоровая",
    tone: "good",
  },
];

const tariffs = [
  {
    name: "Free",
    price: "0 ₽",
    period: "для проверки гипотезы",
    description: "Один отчёт в месяц и ограничение по строкам.",
    features: [
      {
        label: "1 отчёт в месяц",
        help: "Можно загрузить и проверить один отчёт за календарный месяц",
      },
      {
        label: "Базовые метрики",
        help: "Покажем выручку, прибыль и маржу по товарам, если данных достаточно",
      },
      {
        label: "Список убыточных SKU",
        help: "Выделим позиции, где рассчитанная прибыль за период ниже нуля",
      },
    ],
    action: "Попробовать загрузку",
    href: "/upload",
  },
  {
    name: "Start",
    price: "990 ₽",
    period: "в месяц",
    description: "Для небольшого магазина и регулярной проверки экономики.",
    inherits: "Всё из Free, а также",
    features: [
      {
        label: "До 5 отчётов",
        help: "Можно анализировать до пяти отчётов за календарный месяц",
      },
      {
        label: "Рекомендации по SKU",
        help: "Подскажем, какие расходы и показатели стоит проверить у проблемного товара",
      },
      {
        label: "Экспорт результата",
        help: "Итоговый расчёт можно будет скачать и использовать вне сервиса",
      },
    ],
    action: "Оставить заявку",
    href: "#contact",
    featured: true,
  },
  {
    name: "Pro",
    price: "2 490 ₽",
    period: "в месяц",
    description: "Для растущего бренда с несколькими кабинетами.",
    inherits: "Всё из Start, а также",
    features: [
      {
        label: "До 20 отчётов",
        help: "Можно анализировать до двадцати отчётов за календарный месяц",
      },
      {
        label: "WB и Ozon",
        help: "Можно анализировать отчёты Wildberries и Ozon в одном тарифе",
      },
      {
        label: "История изменений",
        help: "Сравним результаты по периодам, чтобы увидеть динамику прибыли и маржи",
      },
    ],
    action: "Оставить заявку",
    href: "#contact",
  },
  {
    name: "Agency",
    price: "6 990 ₽",
    period: "в месяц",
    description: "Для команд, которые ведут несколько продавцов.",
    inherits: "Всё из Pro, а также",
    features: [
      {
        label: "Клиентские проекты",
        help: "Данные и результаты разных продавцов будут разделены по проектам",
      },
      {
        label: "Общие отчёты",
        help: "Команда сможет работать с единым результатом без пересылки файлов",
      },
      {
        label: "Приоритетная поддержка",
        help: "Вопросы команды будут обрабатываться раньше обращений с базовых тарифов",
      },
    ],
    action: "Обсудить доступ",
    href: "#contact",
  },
];

const faq = [
  {
    question: "Какие отчёты можно загрузить?",
    answer:
      "В MVP планируем поддержать CSV и XLSX из кабинетов Wildberries и Ozon. Первый рабочий парсер появится в Sprint 1, поэтому сейчас страница загрузки проверяет только формат и размер файла.",
  },
  {
    question: "Откуда берётся прибыль по товару?",
    answer:
      "Из выручки вычитаются комиссия маркетплейса, логистика, хранение, возвраты, штрафы, реклама и себестоимость, если эти данные есть. Неполные расчёты будут отмечены как оценка.",
  },
  {
    question: "Profit Doctor хранит загруженные файлы?",
    answer:
      "В Sprint 0 файлы не отправляются на сервер и остаются на вашем устройстве. До запуска серверной обработки мы опишем срок хранения и правила удаления данных.",
  },
  {
    question: "Тариф уже можно оплатить?",
    answer:
      "Пока нет. Цены проверяют спрос, а оплата не подключена. Оставлять платёжные данные на сайте сейчас не нужно.",
  },
  {
    question: "Можно ли доверять рекомендациям?",
    answer:
      "Сервис покажет формулу, источник каждого показателя и допущения. Финальное решение по цене и ассортименту остаётся за продавцом.",
  },
];

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20">
      <path
        d="m4 10.3 3.6 3.6L16 5.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20">
      <path
        d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20">
      <circle
        cx="10"
        cy="10"
        r="7.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10 8.7v4.1M10 6.3h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FeatureHelp({ label, help }: { label: string; help: string }) {
  return (
    <details className="feature-help">
      <summary aria-label={`Подробнее: ${label}`}>
        <InfoIcon />
      </summary>
      <span className="feature-tooltip" role="tooltip">
        {help}
      </span>
    </details>
  );
}

function Brand() {
  return (
    <span className="brand-lockup">
      <span className="brand-mark" aria-hidden="true">
        PD
      </span>
      <span>
        <strong>Profit Doctor</strong>
        <small>WB / Ozon</small>
      </span>
    </span>
  );
}

export default function Home() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner container">
          <Link
            className="brand-link"
            href="/"
            aria-label="Profit Doctor — на главную"
          >
            <Brand />
          </Link>
          <nav className="desktop-nav" aria-label="Навигация по странице">
            <a href="#how">Как работает</a>
            <a href="#demo">Пример отчёта</a>
            <a href="#pricing">Тарифы</a>
            <a href="#faq">Вопросы</a>
          </nav>
          <div className="header-actions">
            <Link className="text-link" href="/login">
              Войти
            </Link>
            <Link className="button button-small button-primary" href="/upload">
              Загрузить отчёт
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero section-dark">
          <div className="hero-grid container">
            <div className="hero-copy">
              <p className="eyebrow">
                <span aria-hidden="true" /> Юнит-экономика без бухгалтерского
                тумана
              </p>
              <h1>
                Загрузите отчёт WB/Ozon — за 3 минуты покажем товары, которые
                съедают вашу прибыль
              </h1>
              <p className="hero-lead">
                Profit Doctor собирает расходы по каждому SKU в одну картину и
                объясняет, где теряются деньги. Первый рабочий анализ появится в
                Sprint 1.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/upload">
                  Загрузить отчёт <ArrowIcon />
                </Link>
                <a className="button button-secondary" href="#demo">
                  Получить демо-отчёт
                </a>
              </div>
              <ul className="hero-facts" aria-label="Условия загрузки">
                <li>
                  <CheckIcon /> CSV и XLSX
                </li>
                <li>
                  <CheckIcon /> До 10 МБ
                </li>
                <li>
                  <CheckIcon /> Без банковской карты
                </li>
              </ul>
            </div>

            <figure className="diagnostic-visual">
              <Image
                className="diagnostic-visual-image"
                src="/images/profit-diagnostic-card.png"
                alt="Учебная диагностика магазина: выручка 416 860 ₽, прибыль 17 800 ₽, маржа 4,3%"
                width={1128}
                height={1394}
                sizes="(max-width: 850px) min(540px, 100vw - 48px), 480px"
                priority
              />
            </figure>
          </div>
        </section>

        <section className="trust-strip" aria-label="Что учитывает анализ">
          <div className="trust-items container">
            <span>Комиссия</span>
            <span>Логистика</span>
            <span>Хранение</span>
            <span>Возвраты</span>
            <span>Реклама</span>
            <span>Себестоимость</span>
          </div>
        </section>

        <section className="section" id="audience">
          <div className="container">
            <div className="section-heading split-heading">
              <div>
                <p className="eyebrow eyebrow-dark">Для кого</p>
                <h2>Когда оборот уже не отвечает на главный вопрос</h2>
              </div>
              <p>
                Продажи могут расти, пока маржу незаметно съедают тарифы,
                возвраты и дорогая логистика.
              </p>
            </div>
            <div className="audience-grid">
              {audiences.map((item) => (
                <article className="info-card" key={item.marker}>
                  <span className="card-number">{item.marker}</span>
                  <div className="info-card-copy">
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section pain-section" id="pain">
          <div className="pain-grid container">
            <div className="pain-copy">
              <p className="eyebrow eyebrow-dark">Что болит</p>
              <h2>Выручка не равна прибыли</h2>
              <p>
                Кабинет маркетплейса показывает продажи. Но чтобы увидеть
                деньги, нужно разложить расходы по каждому товару и добавить
                себестоимость.
              </p>
              <ul className="pain-list">
                <li>
                  <span>01</span> Неясно, какой SKU уводит магазин в минус
                </li>
                <li>
                  <span>02</span> Расходы разбросаны по разным отчётам
                </li>
                <li>
                  <span>03</span> Решения принимаются по обороту, а не по марже
                </li>
              </ul>
            </div>
            <div
              className="formula-card"
              aria-label="Формула: выручка минус все расходы равна прибыли по каждому SKU"
            >
              <div className="formula-heading">
                <span className="formula-label">Формула диагноза</span>
                <span className="formula-symbol" aria-hidden="true">
                  ∑
                </span>
              </div>
              <div className="formula-equation">
                <div className="formula-operand formula-revenue">
                  <small>Получили</small>
                  <strong>Выручка</strong>
                </div>
                <span className="formula-operator" aria-hidden="true">
                  −
                </span>
                <div className="formula-operand formula-expenses">
                  <small>Вычитаем</small>
                  <strong>Все расходы</strong>
                </div>
                <span
                  className="formula-operator formula-equals"
                  aria-hidden="true"
                >
                  =
                </span>
                <div className="formula-operand formula-profit">
                  <small>Получаем</small>
                  <strong>Прибыль по SKU</strong>
                </div>
              </div>
              <div className="formula-breakdown" aria-label="Состав расходов">
                <span>Комиссия</span>
                <span>Логистика</span>
                <span>Хранение</span>
                <span>Возвраты</span>
                <span>Реклама</span>
                <span>Себестоимость</span>
              </div>
              <p className="formula-note">
                Если данных не хватает, расчёт будет честно помечен как оценка.
              </p>
            </div>
          </div>
        </section>

        <aside
          className="doctor-tour container"
          aria-label="Profit Doctor объясняет"
        >
          <ProfitDoctorMascot className="doctor-tour-mascot" />
          <div className="doctor-tour-copy">
            <span>Profit Doctor объясняет</span>
            <h2>Проведу от симптома к решению</h2>
            <p>
              Сначала найду убыточные SKU, затем покажу, какие расходы тянут их
              вниз, и подскажу, что проверить в первую очередь.
            </p>
          </div>
          <ol className="doctor-tour-route">
            <li>
              <span>01</span> Найти минус
            </li>
            <li>
              <span>02</span> Объяснить причину
            </li>
            <li>
              <span>03</span> Выбрать действие
            </li>
          </ol>
        </aside>

        <section className="section how-section" id="how">
          <div className="container">
            <div className="section-heading centered-heading">
              <p className="eyebrow eyebrow-light">Как работает</p>
              <h2>От файла до решения — три шага</h2>
              <p>
                Без интеграций, долгого внедрения и сложных настроек на старте.
              </p>
            </div>
            <div className="steps-grid">
              {steps.map((step) => (
                <article className="step-card" key={step.number}>
                  <span>{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
            <div className="center-action">
              <Link className="button button-primary" href="/upload">
                Проверить свой файл <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>

        <section className="section report-section" id="demo">
          <div className="container">
            <div className="section-heading split-heading report-heading">
              <div>
                <p className="eyebrow eyebrow-dark">Пример отчёта</p>
                <h2>Сначала — товары, где теряются деньги</h2>
              </div>
              <p>
                Цифры ниже вымышлены и показывают будущий формат отчёта, а не
                результат анализа.
              </p>
            </div>
            <div className="report-panel">
              <div className="report-toolbar">
                <div>
                  <span className="live-dot" aria-hidden="true" />
                  <strong>Демо-диагностика</strong>
                  <span>4 SKU</span>
                </div>
                <span className="sample-label">Учебный пример</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Товар</th>
                      <th scope="col">Площадка</th>
                      <th scope="col">Выручка</th>
                      <th scope="col">Расходы</th>
                      <th scope="col">Прибыль</th>
                      <th scope="col">Маржа</th>
                      <th scope="col">Диагноз</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row) => (
                      <tr key={row.sku}>
                        <th scope="row">{row.sku}</th>
                        <td>
                          <span
                            className={`market-badge market-${row.marketplace.toLowerCase()}`}
                          >
                            {row.marketplace}
                          </span>
                        </td>
                        <td>{row.revenue}</td>
                        <td>{row.expenses}</td>
                        <td className={`number-${row.tone}`}>{row.profit}</td>
                        <td>{row.margin}</td>
                        <td>
                          <span className={`status status-${row.tone}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="report-insight">
                <span className="insight-mark" aria-hidden="true">
                  ↗
                </span>
                <p>
                  <strong>Что делать с «Лампа Mini»</strong> Проверить цену,
                  логистику и долю возвратов. Рекомендация будет опираться на
                  доступные поля отчёта.
                </p>
                <span className="confidence">Оценка</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section pricing-section" id="pricing">
          <div className="container">
            <div className="section-heading centered-heading">
              <p className="eyebrow eyebrow-dark">Тарифы MVP</p>
              <h2>Начните с одного отчёта</h2>
              <p>
                Оплата ещё не подключена. Цены опубликованы для проверки спроса.
              </p>
            </div>
            <div className="pricing-grid">
              {tariffs.map((tariff) => (
                <article
                  className={
                    tariff.featured ? "price-card price-featured" : "price-card"
                  }
                  key={tariff.name}
                >
                  {tariff.featured && (
                    <span className="popular-label">Для старта</span>
                  )}
                  <h3>{tariff.name}</h3>
                  <p className="price">
                    <strong>{tariff.price}</strong>
                    <span>{tariff.period}</span>
                  </p>
                  <p className="price-description">{tariff.description}</p>
                  <p className="price-inherits">
                    {tariff.inherits ?? "В тариф входит"}:
                  </p>
                  <ul>
                    {tariff.features.map((feature) => (
                      <li key={feature.label}>
                        <CheckIcon />
                        <span>{feature.label}</span>
                        <FeatureHelp
                          label={feature.label}
                          help={feature.help}
                        />
                      </li>
                    ))}
                  </ul>
                  {tariff.href.startsWith("/") ? (
                    <Link className="button button-price" href={tariff.href}>
                      {tariff.action}
                    </Link>
                  ) : (
                    <a className="button button-price" href={tariff.href}>
                      {tariff.action}
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section faq-section" id="faq">
          <div className="faq-grid container">
            <div className="faq-intro">
              <p className="eyebrow eyebrow-dark">FAQ</p>
              <h2>Коротко о важном</h2>
              <p>Про формат файлов, расчёты, безопасность и статус продукта.</p>
            </div>
            <div className="faq-list">
              {faq.map((item) => (
                <details key={item.question}>
                  <summary>
                    {item.question}
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="section contact-section" id="contact">
          <div className="contact-card container">
            <div className="contact-copy">
              <p className="eyebrow">Ранний доступ</p>
              <h2>Хотите проверить экономику на своём отчёте?</h2>
              <p>
                Оставьте поле подготовленным: отправка контактов появится в
                следующем спринте.
              </p>
            </div>
            <form className="contact-form" aria-describedby="contact-note">
              <div className="form-row">
                <label htmlFor="contact-name">Имя</label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  placeholder="Анна"
                  autoComplete="name"
                />
              </div>
              <div className="form-row">
                <label htmlFor="contact-value">Email или Telegram</label>
                <input
                  id="contact-value"
                  name="contact"
                  type="text"
                  placeholder="name@example.com или @username"
                  autoComplete="email"
                />
              </div>
              <button className="button button-primary" type="button" disabled>
                Отправка пока недоступна
              </button>
              <p className="form-note" id="contact-note">
                Сейчас данные не отправляются и не сохраняются
              </p>
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner container">
          <Brand />
          <p>Прототип Sprint 0 · Финансовые решения остаются за продавцом</p>
          <nav aria-label="Ссылки в подвале">
            <Link href="/login">Вход</Link>
            <Link href="/upload">Загрузка</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
