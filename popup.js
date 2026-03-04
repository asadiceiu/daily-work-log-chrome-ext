const STORAGE_KEYS = {
  TASKS_BY_DAY: "tasksByDay",
  LAST_DAY: "lastDay",
  VIEW_MODE: "viewMode"
};

const VIEW_MODES = {
  DAY: "day",
  WEEK: "week"
};

const DAY_MS = 24 * 60 * 60 * 1000;

let tasksByDay = {};
let selectedDay = startOfDay(new Date());
let viewMode = VIEW_MODES.DAY;
let editingTaskRef = null;

const dateLabel = document.getElementById("dateLabel");
const dateHint = document.getElementById("dateHint");
const prevDayBtn = document.getElementById("prevDay");
const nextDayBtn = document.getElementById("nextDay");
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const toggleViewBtn = document.getElementById("toggleViewBtn");
const openFullAppBtn = document.getElementById("openFullAppBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

init();

async function init() {
  const saved = await readStorage([
    STORAGE_KEYS.TASKS_BY_DAY,
    STORAGE_KEYS.LAST_DAY,
    STORAGE_KEYS.VIEW_MODE
  ]);

  tasksByDay = saved[STORAGE_KEYS.TASKS_BY_DAY] || {};

  if (saved[STORAGE_KEYS.LAST_DAY]) {
    selectedDay = parseKeyToDate(saved[STORAGE_KEYS.LAST_DAY]) || selectedDay;
  }

  if (saved[STORAGE_KEYS.VIEW_MODE] === VIEW_MODES.WEEK) {
    viewMode = VIEW_MODES.WEEK;
  }

  bindEvents();
  render();
  taskInput.focus();
}

function bindEvents() {
  prevDayBtn.addEventListener("click", () => {
    void shiftRange(-1);
  });

  nextDayBtn.addEventListener("click", () => {
    void shiftRange(1);
  });

  toggleViewBtn.addEventListener("click", async () => {
    viewMode = viewMode === VIEW_MODES.DAY ? VIEW_MODES.WEEK : VIEW_MODES.DAY;
    editingTaskRef = null;
    await persistUiState();
    render();
    taskInput.focus();
  });

  exportCsvBtn.addEventListener("click", () => {
    exportLogsToCsv();
  });

  if (openFullAppBtn) {
    openFullAppBtn.addEventListener("click", () => {
      openFullApp();
    });
  }

  taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = taskInput.value.trim();
    if (!text) {
      return;
    }

    const key = formatDayKey(selectedDay);
    const nextTask = {
      id: createId(),
      text,
      done: false,
      createdAt: Date.now()
    };

    if (!Array.isArray(tasksByDay[key])) {
      tasksByDay[key] = [];
    }

    tasksByDay[key].unshift(nextTask);
    taskInput.value = "";
    await persistAll();
    renderTasksForSelectedRange();
    taskInput.focus();
  });
}

function openFullApp() {
  const appUrl = chrome.runtime.getURL("app.html");
  if (chrome.tabs && typeof chrome.tabs.create === "function") {
    chrome.tabs.create({ url: appUrl });
    return;
  }

  window.open(appUrl, "_blank", "noopener");
}

async function shiftRange(direction) {
  const step = viewMode === VIEW_MODES.WEEK ? 7 : 1;
  selectedDay = new Date(selectedDay.getTime() + direction * step * DAY_MS);
  editingTaskRef = null;
  await persistUiState();
  render();
  taskInput.focus();
}

function render() {
  renderHeader();
  renderFormState();
  renderBottomActions();
  renderTasksForSelectedRange();
}

function renderHeader() {
  if (viewMode === VIEW_MODES.DAY) {
    dateLabel.textContent = selectedDay.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    const delta = dayDiff(startOfDay(new Date()), selectedDay);
    dateHint.textContent = deltaToLabel(delta);
    prevDayBtn.setAttribute("aria-label", "Previous day");
    nextDayBtn.setAttribute("aria-label", "Next day");
    return;
  }

  const weekStart = startOfWeek(selectedDay);
  const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
  dateLabel.textContent = `${formatShortDate(weekStart)} - ${formatLongDate(weekEnd)}`;
  dateHint.textContent = `Week view, adding to ${formatLongDate(selectedDay)}`;
  prevDayBtn.setAttribute("aria-label", "Previous week");
  nextDayBtn.setAttribute("aria-label", "Next week");
}

function renderFormState() {
  if (viewMode === VIEW_MODES.DAY) {
    taskInput.placeholder = "What are you working on?";
    return;
  }

  taskInput.placeholder = `Add task for ${formatShortDate(selectedDay)}`;
}

function renderBottomActions() {
  toggleViewBtn.textContent = viewMode === VIEW_MODES.DAY ? "Week View" : "Day View";
}

function renderTasksForSelectedRange() {
  taskList.innerHTML = "";
  taskList.classList.toggle("week-mode", viewMode === VIEW_MODES.WEEK);

  if (viewMode === VIEW_MODES.DAY) {
    renderTasksForDay(formatDayKey(selectedDay));
  } else {
    renderTasksForWeek();
  }

  if (editingTaskRef) {
    focusEditingInput();
  }
}

function renderTasksForDay(dayKey) {
  const tasks = getTasksForDay(dayKey);
  emptyState.hidden = tasks.length > 0;
  emptyState.textContent = "No tasks yet for this day.";

  for (const task of tasks) {
    taskList.append(createTaskItem(task, dayKey));
  }
}

function renderTasksForWeek() {
  const weekDays = getDaysInWeek(selectedDay);
  emptyState.hidden = true;

  for (const dayDate of weekDays) {
    const dayKey = formatDayKey(dayDate);
    const tasks = getTasksForDay(dayKey);

    const group = document.createElement("section");
    group.className = "day-group" + (isSameDay(dayDate, selectedDay) ? " active" : "");

    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "day-group-title";
    titleBtn.textContent = formatDayGroupTitle(dayDate);
    titleBtn.addEventListener("click", () => {
      selectedDay = startOfDay(dayDate);
      void persistUiState();
      render();
      taskInput.focus();
    });

    group.append(titleBtn);

    if (tasks.length === 0) {
      const emptyDay = document.createElement("p");
      emptyDay.className = "day-empty";
      emptyDay.textContent = "No tasks";
      group.append(emptyDay);
    } else {
      const taskGroup = document.createElement("div");
      taskGroup.className = "day-group-tasks";
      for (const task of tasks) {
        taskGroup.append(createTaskItem(task, dayKey));
      }
      group.append(taskGroup);
    }

    taskList.append(group);
  }
}

function createTaskItem(task, dayKey) {
  const item = document.createElement("article");
  item.className = "task-item" + (task.done ? " done" : "");
  item.dataset.id = task.id;
  item.dataset.dayKey = dayKey;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(task.done);
  checkbox.setAttribute("aria-label", "Mark task complete");
  checkbox.addEventListener("change", async () => {
    task.done = checkbox.checked;
    await persistAll();
    renderTasksForSelectedRange();
  });

  const content = document.createElement("div");
  content.className = "task-content";

  if (isEditingTask(dayKey, task.id)) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "task-edit-input";
    input.value = task.text;
    input.maxLength = 180;
    input.dataset.dayKey = dayKey;
    input.dataset.taskId = task.id;
    input.setAttribute("aria-label", "Edit task");

    let handled = false;
    const settleEdit = async (mode) => {
      if (handled) {
        return;
      }

      handled = true;
      await finalizeInlineEdit(dayKey, task.id, mode, input.value);
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void settleEdit("save");
      } else if (event.key === "Escape") {
        event.preventDefault();
        void settleEdit("cancel");
      }
    });

    input.addEventListener("blur", () => {
      void settleEdit("save");
    });

    content.append(input);
  } else {
    const textBtn = document.createElement("button");
    textBtn.type = "button";
    textBtn.className = "task-text-btn";
    textBtn.setAttribute("aria-label", "Edit task");
    textBtn.title = "Click to edit";
    textBtn.addEventListener("click", () => {
      startInlineEdit(dayKey, task.id);
    });

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;
    textBtn.append(text);
    content.append(textBtn);
  }

  const removeBtn = document.createElement("button");
  removeBtn.className = "delete-btn";
  removeBtn.type = "button";
  removeBtn.setAttribute("aria-label", "Delete task");
  removeBtn.innerHTML = [
    "<svg class=\"trash-icon\" viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\">",
    "<path d=\"M4 7h16\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/>",
    "<path d=\"M10 4h4\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/>",
    "<rect x=\"7\" y=\"7\" width=\"10\" height=\"13\" rx=\"1.8\" stroke=\"currentColor\" stroke-width=\"1.8\"/>",
    "<path d=\"M10 11v6M14 11v6\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/>",
    "</svg>"
  ].join("");
  removeBtn.addEventListener("click", async () => {
    const tasks = getTasksForDay(dayKey);
    tasksByDay[dayKey] = tasks.filter((entry) => entry.id !== task.id);
    if (tasksByDay[dayKey].length === 0) {
      delete tasksByDay[dayKey];
    }

    if (isEditingTask(dayKey, task.id)) {
      editingTaskRef = null;
    }

    await persistAll();
    renderTasksForSelectedRange();
  });

  item.append(checkbox, content, removeBtn);
  return item;
}

function getTasksForDay(dayKey) {
  if (!Array.isArray(tasksByDay[dayKey])) {
    return [];
  }

  return tasksByDay[dayKey];
}

function startInlineEdit(dayKey, taskId) {
  editingTaskRef = { dayKey, taskId };
  renderTasksForSelectedRange();
}

async function finalizeInlineEdit(dayKey, taskId, mode, rawText) {
  const tasks = getTasksForDay(dayKey);
  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) {
    editingTaskRef = null;
    renderTasksForSelectedRange();
    return;
  }

  if (mode === "save") {
    const nextText = rawText.trim();
    if (nextText && nextText !== task.text) {
      task.text = nextText;
      await persistAll();
    }
  }

  editingTaskRef = null;
  renderTasksForSelectedRange();
}

function isEditingTask(dayKey, taskId) {
  return Boolean(
    editingTaskRef &&
    editingTaskRef.dayKey === dayKey &&
    editingTaskRef.taskId === taskId
  );
}

function focusEditingInput() {
  if (!editingTaskRef) {
    return;
  }

  const selector =
    `.task-edit-input[data-day-key="${editingTaskRef.dayKey}"]` +
    `[data-task-id="${editingTaskRef.taskId}"]`;
  const input = taskList.querySelector(selector);
  if (!input) {
    return;
  }

  input.focus();
  input.select();
}

function exportLogsToCsv() {
  const rows = [["date", "task", "done", "created_at"]];
  const dayKeys = Object.keys(tasksByDay).sort();

  for (const dayKey of dayKeys) {
    const tasks = getTasksForDay(dayKey);
    for (const task of tasks) {
      rows.push([
        dayKey,
        task.text || "",
        task.done ? "true" : "false",
        task.createdAt ? new Date(task.createdAt).toISOString() : ""
      ]);
    }
  }

  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `daily-work-log-${formatDayKey(startOfDay(new Date()))}.csv`;
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 500);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
}

function getDaysInWeek(value) {
  const weekStart = startOfWeek(value);
  return Array.from({ length: 7 }, (_, index) => {
    return new Date(weekStart.getTime() + index * DAY_MS);
  });
}

function startOfWeek(value) {
  const result = startOfDay(value);
  const day = result.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diffToMonday);
  return result;
}

function formatDayGroupTitle(value) {
  const label = value.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  if (isSameDay(value, startOfDay(new Date()))) {
    return `${label} (Today)`;
  }

  if (isSameDay(value, selectedDay)) {
    return `${label} (Active)`;
  }

  return label;
}

function formatShortDate(value) {
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatLongDate(value) {
  return value.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function dayDiff(left, right) {
  return Math.round((right.getTime() - left.getTime()) / DAY_MS);
}

function deltaToLabel(delta) {
  if (delta === 0) {
    return "Today";
  }
  if (delta === -1) {
    return "Yesterday";
  }
  if (delta === 1) {
    return "Tomorrow";
  }
  if (delta < 0) {
    return `${Math.abs(delta)} days ago`;
  }
  return `In ${delta} days`;
}

function isSameDay(left, right) {
  return formatDayKey(left) === formatDayKey(right);
}

function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function formatDayKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseKeyToDate(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day);
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function persistAll() {
  await writeStorage({
    [STORAGE_KEYS.TASKS_BY_DAY]: tasksByDay,
    [STORAGE_KEYS.LAST_DAY]: formatDayKey(selectedDay),
    [STORAGE_KEYS.VIEW_MODE]: viewMode
  });
}

async function persistUiState() {
  await writeStorage({
    [STORAGE_KEYS.LAST_DAY]: formatDayKey(selectedDay),
    [STORAGE_KEYS.VIEW_MODE]: viewMode
  });
}

function readStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => {
      resolve(items || {});
    });
  });
}

function writeStorage(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}
