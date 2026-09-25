# eva-custom-mcp

[![npm](https://img.shields.io/npm/v/eva-custom-mcp)](https://www.npmjs.com/package/eva-custom-mcp)

[English version](https://github.com/ivan1911/eva-custom-mcp/blob/main/README.md)

MCP-сервер, который подключает AI-ассистентов (Claude Desktop, Claude Code, Codex, Cursor и другие MCP-клиенты) к
[EvaTeam](https://evateam.ru): поиск и редактирование задач, работа с документами базы знаний и чтение
публичного глоссария EvaTeam.

## Что понадобится

- [Node.js](https://nodejs.org) версии 18 или новее (проверить: `node -v`). `npx` устанавливается вместе с Node.js.
- Для инструментов проектов, задач и базы знаний: адрес вашего EvaTeam (например, `https://yourcompany.evateam.ru`)
  и API-токен.

Без токена сервер тоже запустится, но будут доступны только инструменты глоссария.

### Как получить API-токен

В EvaTeam откройте свою личную карточку, перейдите в раздел **«Безопасность»** и сгенерируйте API-токен.
У токена те же права, что у вашей учётной записи, поэтому никому его не передавайте.

## Установка

Скачивать и собирать ничего не нужно: MCP-клиент сам запускает сервер из npm через `npx`.
Добавьте сервер в свой клиент одним из способов ниже и перезапустите клиент.

### Claude Desktop

Откройте **Settings → Developer → Edit Config** или отредактируйте файл напрямую:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "eva": {
      "command": "npx",
      "args": ["-y", "eva-custom-mcp"],
      "env": {
        "EVA_BASE_URL": "https://yourcompany.evateam.ru",
        "EVA_API_TOKEN": "ваш-токен"
      }
    }
  }
}
```

Если в файле уже есть другие серверы, добавьте `"eva": { ... }` внутрь существующего объекта `mcpServers`.

Если на Windows сервер не запускается из-за того, что `npx` не найден, укажите `"command": "cmd"` и
`"args": ["/c", "npx", "-y", "eva-custom-mcp"]`.

### Claude Code

```bash
claude mcp add --transport stdio --scope user \
  --env EVA_BASE_URL=https://yourcompany.evateam.ru \
  --env EVA_API_TOKEN=ваш-токен \
  eva -- npx -y eva-custom-mcp
```

Проверить подключение можно командой `claude mcp list` или `/mcp` внутри Claude Code.

### Codex

```bash
codex mcp add eva \
  --env EVA_BASE_URL=https://yourcompany.evateam.ru \
  --env EVA_API_TOKEN=ваш-токен \
  -- npx -y eva-custom-mcp
```

Или добавьте вручную в `~/.codex/config.toml`:

```toml
[mcp_servers.eva]
command = "npx"
args = ["-y", "eva-custom-mcp"]
startup_timeout_sec = 30

[mcp_servers.eva.env]
EVA_BASE_URL = "https://yourcompany.evateam.ru"
EVA_API_TOKEN = "ваш-токен"
```

`startup_timeout_sec` необязателен. Он даёт первому запуску `npx` время скачать пакет: иначе запуск может
не уложиться в стандартный таймаут. Проверить подключение можно командой `codex mcp list` или `/mcp` внутри Codex.

### Cursor и другие MCP-клиенты

Используйте тот же JSON, что и для Claude Desktop. В Cursor он кладётся в `~/.cursor/mcp.json`
(для всех проектов) или в `.cursor/mcp.json` (для одного проекта).

### Глобальная установка (необязательно)

Если не хотите использовать `npx`:

```bash
npm install -g eva-custom-mcp
```

Затем в конфиге клиента укажите `"command": "eva-custom-mcp"` без `args`.

### Обновление

`npx` может запускать старую копию из кэша. Чтобы всегда запускалась последняя версия, укажите
`"args": ["-y", "eva-custom-mcp@latest"]` или зафиксируйте версию, например `eva-custom-mcp@0.1.3`.
При глобальной установке выполните `npm install -g eva-custom-mcp@latest`.

## Настройки

Все настройки задаются переменными окружения в блоке `env` конфига клиента.

| Переменная | Обязательна | Описание |
| --- | --- | --- |
| `EVA_BASE_URL` | Для инструментов EvaTeam | Адрес вашего EvaTeam, например `https://yourcompany.evateam.ru`. |
| `EVA_API_TOKEN` | Для инструментов EvaTeam | API-токен. Включает инструменты проектов, задач и документов. |
| `EVA_UPLOAD_ROOT` | Нет | Абсолютный путь к папке. Включает `document_attachment_upload` только для файлов из этой папки. Если не задана, загрузка файлов выключена. |
| `EVA_GLOSSARY_URL` | Нет | Сайт для инструментов глоссария. По умолчанию `https://www.evateam.ru`; токен туда никогда не отправляется. |

## Проверка работы

После перезапуска клиента попросите ассистента, например: *«Покажи мои проекты в EvaTeam»*.
Он должен вызвать `project_list`.

Проверить сервер без AI-клиента можно через MCP Inspector:

```bash
npx @modelcontextprotocol/inspector \
  -e EVA_BASE_URL=https://yourcompany.evateam.ru -e EVA_API_TOKEN=ваш-токен \
  npx -y eva-custom-mcp
```

## Частые проблемы

- **Видны только инструменты `glossary_*`**: `EVA_API_TOKEN` не задан или не передаётся серверу.
  Проверьте блок `env` и перезапустите клиент.
- **Ошибки `401`/`403`**: токен неверный, просрочен или выдан в другом инстансе EvaTeam. Проверьте `EVA_BASE_URL`.
- **Сервер не запускается**: убедитесь, что `node -v` показывает 18 или новее и что `npx` работает в терминале.
- **Нет инструмента `document_attachment_upload`**: задайте `EVA_UPLOAD_ROOT`. Загружать можно только файлы из этой папки.

## Инструменты

Инструменты глоссария:

- `glossary_article_get`: получить статью глоссария по slug или URL, например `api`.
- `glossary_search`: найти статью глоссария по термину.

Инструменты глоссария доступны всегда. Инструменты проектов, задач и документов ниже появляются, только когда
задан `EVA_API_TOKEN`.

Проекты и поиск:

- `project_list`: список проектов.
- `project_get_by_code`: найти проект по коду.
- `project_find_everything`: найти задачи и документы базы знаний в одном проекте.

Задачи:

- `task_search`: поиск задач, при необходимости в пределах проекта.
- `task_get`: получить задачу по коду или ссылке на объект.
- `task_create`: создать задачу.
- `task_update`: изменить задачу.
- `task_delete`: удалить задачу.
- `task_transition`: сменить статус задачи.
- `task_comment_add`: добавить комментарий к задаче.
- `task_comments_list`: список комментариев задачи.
- `task_assign`: назначить задачу на человека.
- `task_link_create`: связать две задачи.
- `task_time_log`: списать время.
- `task_create_from_template`: создать задачу по шаблону.

Документы:

- `document_search`: поиск документов базы знаний по названию.
- `document_get`: получить документ по коду или ссылке на объект.
- `document_create`: создать документ.
- `document_update_text`: изменить черновик, название или метаданные документа.
- `document_publish`: опубликовать черновик документа.
- `document_rename`: переименовать документ.
- `document_children_list`: список дочерних документов.
- `document_tree`: плоский список документов проекта для построения дерева.
- `document_attachments_list`: список вложений (метаданные).
- `document_attachment_download`: запросить или скачать все вложения документа.
- `document_attachment_upload`: создать вложение и загрузить в него файл (multipart POST).
  Доступен, только если задана `EVA_UPLOAD_ROOT`; файлы вне этой папки (в том числе через симлинки) отклоняются.

## Рекомендуемые промпты для агента

### Короткий промпт

```text
Используй EVA MCP как источник истины по задачам проектов и документам базы знаний.
Предпочитай компактные высокоуровневые инструменты: `project_find_everything`, `task_search`, `task_get`, `task_create`, `task_update`, `task_comment_add`, `task_time_log`, `document_search`, `document_get`, `document_create`, `document_update_text`, `document_publish`.
Всегда определяй проект по коду через `project_get_by_code`.
Перед изменением объекта сначала получи его и кратко опиши планируемое изменение.
Никогда не удаляй и не публикуй без явного подтверждения пользователя.
В ответах пользователю указывай коды объектов EVA.
```

### Полный промпт

```text
Ты работаешь с EvaTeam через MCP-сервер `eva-custom-mcp`.

Основные правила:
- Если пользователь указал код проекта, всегда начинай с `project_get_by_code`.
- Для широкого поиска по проекту используй `project_find_everything`.
- Для задач:
  - `task_search` — найти задачи;
  - `task_get` — если известен код задачи;
  - `task_create` — создать задачу;
  - `task_update` — изменить поля, статус или исполнителя;
  - `task_comment_add` — добавить комментарий;
  - `task_time_log` — списать время.
- Для документов базы знаний:
  - `document_search` — найти страницы и документы;
  - `document_get` — если известен код документа;
  - `document_create` — создать документ;
  - `document_update_text` — изменить содержимое;
  - `document_publish` — опубликовать изменения.
- Не удаляй задачи и документы без явного подтверждения пользователя.
- Не публикуй документы без явного подтверждения пользователя.
- Перед изменением задачи или документа сначала получи текущий объект через `task_get` или `document_get`.
- Если API вернул несколько похожих результатов, спроси пользователя, какой объект имеется в виду.
- В ответах пользователю указывай коды объектов EVA, например `ABC-000123` для задач и `DOC-000123` для документов.
- Никогда не раскрывай API-токены и не проси пользователя вставлять токены в чат.

Типичные сценарии:
1. «Найди всё про X в проекте PRJ»
   - вызови `project_get_by_code`
   - вызови `project_find_everything`
   - кратко перескажи результаты, сгруппировав их на задачи и документы

2. «Создай задачу в проекте PRJ»
   - вызови `project_get_by_code`
   - при необходимости уточни недостающие название и описание
   - вызови `task_create`
   - верни код созданной задачи

3. «Обнови страницу в базе знаний»
   - найди страницу через `document_search` или `document_get`
   - кратко опиши планируемое изменение
   - после подтверждения вызови `document_update_text`
   - если нужна публикация, отдельно запроси подтверждение перед `document_publish`

4. «Добавь комментарий к задаче»
   - вызови `task_get`
   - вызови `task_comment_add`
   - подтверди, что комментарий добавлен
```

## Разработка

```bash
git clone https://github.com/ivan1911/eva-custom-mcp.git
cd eva-custom-mcp
npm install
npm run build
```

Чтобы запустить локальную сборку из MCP-клиента, укажите путь к собранному файлу:

```json
{
  "mcpServers": {
    "eva": {
      "command": "node",
      "args": ["/absolute/path/to/eva-custom-mcp/dist/index.js"],
      "env": {
        "EVA_BASE_URL": "https://yourcompany.evateam.ru",
        "EVA_API_TOKEN": "ваш-токен"
      }
    }
  }
}
```

Другие команды: `npm run dev` (режим наблюдения), `npm run typecheck`, `make publish-dry-run` и `make publish`
(нужен `NODE_AUTH_TOKEN`).

Сервер вызывает JSON-RPC методы EvaTeam; заметки по API и спецификация OpenAPI лежат в `docs/eva_api`.
