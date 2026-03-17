import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getLatticeHome } from "../config";
import { broadcast } from "../ws/broadcast";
import type { ScheduledTask } from "@lattice/shared";

var schedulesFile = "";
var tasks: ScheduledTask[] = [];
var timerId: ReturnType<typeof setInterval> | null = null;
var lastTriggeredMinute: Record<string, boolean> = {};

var CHECK_INTERVAL = 30 * 1000;

function getSchedulesPath(): string {
  if (!schedulesFile) {
    schedulesFile = join(getLatticeHome(), "schedules.json");
  }
  return schedulesFile;
}

function parseCronField(field: string, min: number, max: number): number[] {
  var values: number[] = [];
  var parts = field.split(",");

  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();

    if (part.indexOf("/") !== -1) {
      var slashParts = part.split("/");
      var step = parseInt(slashParts[1], 10);
      var rangeStr = slashParts[0];
      var rangeMin = min;
      var rangeMax = max;
      if (rangeStr !== "*") {
        var rp = rangeStr.split("-");
        rangeMin = parseInt(rp[0], 10);
        rangeMax = rp.length > 1 ? parseInt(rp[1], 10) : rangeMin;
      }
      for (var v = rangeMin; v <= rangeMax; v += step) {
        values.push(v);
      }
      continue;
    }

    if (part === "*") {
      for (var v = min; v <= max; v++) {
        values.push(v);
      }
      continue;
    }

    if (part.indexOf("-") !== -1) {
      var rangeParts = part.split("-");
      var from = parseInt(rangeParts[0], 10);
      var to = parseInt(rangeParts[1], 10);
      for (var v = from; v <= to; v++) {
        values.push(v);
      }
      continue;
    }

    values.push(parseInt(part, 10));
  }

  return values;
}

interface ParsedCron {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

function parseCron(expr: string): ParsedCron | null {
  var fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    return null;
  }
  return {
    minutes: parseCronField(fields[0], 0, 59),
    hours: parseCronField(fields[1], 0, 23),
    daysOfMonth: parseCronField(fields[2], 1, 31),
    months: parseCronField(fields[3], 1, 12),
    daysOfWeek: parseCronField(fields[4], 0, 6),
  };
}

function cronMatches(parsed: ParsedCron, date: Date): boolean {
  return (
    parsed.minutes.indexOf(date.getMinutes()) !== -1 &&
    parsed.hours.indexOf(date.getHours()) !== -1 &&
    parsed.daysOfMonth.indexOf(date.getDate()) !== -1 &&
    parsed.months.indexOf(date.getMonth() + 1) !== -1 &&
    parsed.daysOfWeek.indexOf(date.getDay()) !== -1
  );
}

function nextRunTime(cronExpr: string, after?: number): number | null {
  var parsed = parseCron(cronExpr);
  if (!parsed) {
    return null;
  }

  var d = new Date(after || Date.now());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  var limit = 366 * 24 * 60;
  for (var i = 0; i < limit; i++) {
    if (cronMatches(parsed, d)) {
      return d.getTime();
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return null;
}

export function loadSchedules(): void {
  var path = getSchedulesPath();
  if (!existsSync(path)) {
    tasks = [];
    return;
  }
  try {
    var raw = readFileSync(path, "utf-8");
    var parsed = JSON.parse(raw) as { tasks?: ScheduledTask[] };
    tasks = parsed.tasks || [];
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      if (task.enabled && task.cron) {
        task.nextRunAt = nextRunTime(task.cron);
      }
    }
  } catch (err) {
    console.error("[scheduler] Failed to load schedules:", err);
    tasks = [];
  }
}

function saveSchedules(): void {
  var path = getSchedulesPath();
  var dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  var tmp = path + ".tmp";
  try {
    writeFileSync(tmp, JSON.stringify({ tasks }, null, 2));
    renameSync(tmp, path);
  } catch (err) {
    console.error("[scheduler] Failed to save schedules:", err);
  }
}

function tick(): void {
  var now = Date.now();
  var nowMinuteKey = Math.floor(now / 60000);

  for (var i = 0; i < tasks.length; i++) {
    var task = tasks[i];
    if (!task.enabled || !task.nextRunAt) {
      continue;
    }
    if (task.nextRunAt > now) {
      continue;
    }

    var triggerKey = task.id + "_" + nowMinuteKey;
    if (lastTriggeredMinute[triggerKey]) {
      continue;
    }
    lastTriggeredMinute[triggerKey] = true;

    var keys = Object.keys(lastTriggeredMinute);
    for (var k = 0; k < keys.length; k++) {
      var keyParts = keys[k].split("_");
      var keyMinute = parseInt(keyParts[keyParts.length - 1], 10);
      if (keyMinute < nowMinuteKey - 1) {
        delete lastTriggeredMinute[keys[k]];
      }
    }

    task.lastRunAt = now;
    task.nextRunAt = nextRunTime(task.cron, now);
    task.updatedAt = now;
    saveSchedules();

    console.log("[scheduler] Triggering task:", task.name, "(", task.id, ")");
    broadcast({ type: "scheduler:tasks", tasks: tasks.slice() });
  }
}

export function startScheduler(): void {
  loadSchedules();
  if (timerId) {
    return;
  }
  timerId = setInterval(function () {
    tick();
  }, CHECK_INTERVAL);
  tick();
}

export function stopScheduler(): void {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

export function listTasks(): ScheduledTask[] {
  return tasks.slice();
}

export function createTask(data: {
  name: string;
  prompt: string;
  cron: string;
  projectSlug: string;
}): ScheduledTask | null {
  var parsed = parseCron(data.cron);
  if (!parsed) {
    return null;
  }

  var now = Date.now();
  var task: ScheduledTask = {
    id: "task_" + now + "_" + randomBytes(3).toString("hex"),
    name: data.name,
    prompt: data.prompt,
    cron: data.cron,
    enabled: true,
    projectSlug: data.projectSlug,
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
    nextRunAt: nextRunTime(data.cron),
  };

  tasks.push(task);
  saveSchedules();
  return task;
}

export function deleteTask(taskId: string): boolean {
  var idx = -1;
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id === taskId) {
      idx = i;
      break;
    }
  }
  if (idx === -1) {
    return false;
  }
  tasks.splice(idx, 1);
  saveSchedules();
  return true;
}

export function toggleTask(taskId: string): ScheduledTask | null {
  var task: ScheduledTask | null = null;
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id === taskId) {
      task = tasks[i];
      break;
    }
  }
  if (!task) {
    return null;
  }

  task.enabled = !task.enabled;
  task.updatedAt = Date.now();
  task.nextRunAt = task.enabled ? nextRunTime(task.cron) : null;
  saveSchedules();
  return task;
}
