import type { Metadata } from "next";
import Link from "next/link";
import { ReportUpload } from "@/components/report-upload";

export const metadata: Metadata = {
  title: "Загрузка отчёта",
  description:
    "Выберите CSV или XLSX отчёт Wildberries либо Ozon и проверьте файл перед будущим анализом.",
};

export default function UploadPage() {
  return (
    <main className="utility-page upload-page">
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

      <section className="upload-card" aria-labelledby="upload-title">
        <div className="upload-copy">
          <p className="eyebrow eyebrow-dark">Шаг 1 · Отчёт</p>
          <h1 id="upload-title">Проверьте файл перед анализом</h1>
          <p>
            Выберите XLSX финансового отчёта Wildberries. Первая версия
            анализатора обработает файл прямо в браузере, сверит выплаты и
            покажет оценку по SKU без отправки данных на сервер.
          </p>
        </div>

        <ReportUpload />

        <div className="upload-help">
          <h2>Что подготовить</h2>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Отчёт из кабинета</strong>
                <p>CSV или XLSX из Wildberries либо Ozon</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Период анализа</strong>
                <p>Для первого теста достаточно одного месяца</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Себестоимость SKU</strong>
                <p>Позже её можно будет добавить отдельным файлом</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> Вернуться на главную
      </Link>
    </main>
  );
}
