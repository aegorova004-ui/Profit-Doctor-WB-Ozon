# Проверка публичных отчётов WB/Ozon

Обновлено: 14 июля 2026 года.

Цель проверки — найти публичные XLSX/CSV по Wildberries или Ozon, скачать их во временную папку, сравнить структуру с текущим preview-адаптером и зафиксировать, что нужно для production-версии импорта.

Сырые публичные файлы не добавляются в репозиторий. Они лежат локально во временной папке `%TEMP%\profit-doctor-public-reports` и используются только для технической сверки структуры.

## Найденные и проверенные файлы

### 1. Wildberries XLSX из публичного индекса Parsic

- Источник индекса: `gladiopeace/Files-Indexer`, файл `F/Falsie/XLSX_files.csv`.
- Оригинальный URL: `https://www.parsic.ru/examples/2019-07-29_wildberries.xlsx`.
- Статус оригинального URL: `404`.
- Архивная копия: `https://web.archive.org/web/20220314013732id_/https://www.parsic.ru/examples/2019-07-29_wildberries.xlsx`.
- Локальный файл: `%TEMP%\profit-doctor-public-reports\2019-07-29_wildberries_public_archive.xlsx`.
- Размер: около 7,6 МБ.
- XLSX-сигнатура: валидная.

Результат анализа:

- лист: `wildberries`;
- строк: 86 136;
- колонок: 11;
- заголовки: `Категория`, `Название`, `Артикул`, `URL`, `Цена`, `Цена со скидкой`, `Производитель`, `Покупок`, `Отзывов`, `Рейтинг`, `Изображения`.

Вывод: это публичный XLSX по товарам Wildberries, но не финансовый отчёт продавца. Он не содержит `ppvz_for_pay`, `for_pay`, `doc_type_name`, логистику, хранение, штрафы, удержания и сумму к выплате. Текущий финансовый preview-адаптер не должен принимать этот файл.

Что можно использовать:

- как негативный fixture-кейс для понятной ошибки «это товарный каталог, а не финансовый отчёт»;
- как источник UX-подсказки: пользователь может случайно загрузить товарную выгрузку вместо финансового отчёта.

### 2. Wildberries CSV из публичного GitHub-репозитория

- Источник: `alex-web13-2001/MP-CONTROL`.
- URL: `https://raw.githubusercontent.com/alex-web13-2001/MP-CONTROL/ec5090fb5b60fb43d62ec9bdc23c9afea74343b7/wb_finance_report.csv`.
- Локальный файл: `%TEMP%\profit-doctor-public-reports\wb_finance_report_public_github.csv`.
- Размер: около 4 КБ.

Результат анализа:

- строк данных: 6;
- колонок: 85;
- валюта: `RUB`;
- есть API-подобные поля `realizationreport_id`, `date_from`, `date_to`, `currency_name`, `nm_id`, `barcode`, `retail_amount`, `ppvz_for_pay`, `delivery_rub`, `penalty`, `additional_payment`, `storage_fee`, `deduction`, `supplier_oper_name`, `acquiring_fee`, `acceptance`, `payment_processing`, `cashback_amount`;
- нет обязательного для текущего preview-сверочного поля `for_pay`;
- `doc_type_name` в проверенных строках пустой;
- тип операции находится в `supplier_oper_name`, а не в `doc_type_name`.

Вывод: это ближе к реальному WB finance/API-формату, чем текущий синтетический XLSX, но текущий адаптер правильно не может разобрать его как `wb:api-financial-report:preview-2026-07`.

Что нужно для production-адаптера:

- отдельная версия формата, например `wb:finance-report:api-csv:2025-01-public-sample`;
- поддержка `supplier_oper_name` как основного типа операции;
- сверка без `for_pay`, если в выгрузке его нет;
- явная обработка операционных строк вроде возмещения издержек, а не только `Продажа`/`Возврат`;
- учёт `acquiring_fee`, `acceptance`, `payment_processing`, `cashback_amount` и других новых удержаний;
- ошибка без вывода строк отчёта, если файл содержит контрагентов или другие чувствительные поля.

## Что пока не найдено

- живой публичный XLSX именно финансового отчёта продавца WB с полями выплат и удержаний;
- живой публичный XLSX Ozon с финансовыми начислениями, SKU и комиссиями.

Поиск через обычные страницы BuhOnline и похожие форумы упёрся в `403`/TLS-ошибки. Поиск через GitHub по `.xlsx` не дал релевантных WB/Ozon-финансовых файлов; найденные `.xls/.xlsx` по слову `Ozon` были нерелевантными таблицами.

## Следующее действие

Первым полезным шагом стоит добавить negative-detection для публичного WB XLSX-каталога и отдельный research-test для публичного WB CSV: он должен подтверждать, что файл распознаётся как WB finance-like, но пока отклоняется с понятной причиной `missing for_pay`/`empty doc_type_name`/`supplier_oper_name-only`.
