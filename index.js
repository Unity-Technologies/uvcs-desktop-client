"use strict";
const node_path = require("node:path");
const electron = require("electron");
const node_os = require("node:os");
const node_child_process = require("node:child_process");
const node_fs = require("node:fs");
const node_async_hooks = require("node:async_hooks");
const node_crypto = require("node:crypto");
const promises = require("node:fs/promises");
const SILENT_FAILURE_MESSAGE = "The cm command failed.";
class CmError extends Error {
  constructor(message, command) {
    super(message);
    this.command = command;
    this.name = "CmError";
  }
  command;
  /** The same failure explained in other words; the command details are kept for diagnosis. */
  withMessage(message) {
    return new CmError(message, this.command);
  }
}
const SHELL_ARGS = ["shell", "--encoding=utf-8"];
const UNSAFE_FOR_SHELL = /["\r\n]/;
function canRunInShell(args) {
  return !args.some((arg) => UNSAFE_FOR_SHELL.test(arg));
}
function toShellCommandLine(args) {
  return args.map((arg) => arg === "" || /\s/.test(arg) ? `"${arg}"` : arg).join(" ");
}
const XML_ENCODING_COMMANDS = /* @__PURE__ */ new Set(["status", "find", "ls", "fileinfo", "history"]);
function withUtf8Output(args) {
  const [command = ""] = args;
  const encodable = XML_ENCODING_COMMANDS.has(command) && (command === "find" || args.includes("--xml"));
  if (!encodable || args.some((arg) => arg.startsWith("--encoding"))) return args;
  return [...args, "--encoding=utf-8"];
}
function printsInConsoleCodePage(args) {
  const [command = ""] = args;
  return command !== "cat" && !args.includes("--xml") && !args.some((arg) => arg.startsWith("--encoding"));
}
const MAX_COMMAND_LINE = 3e4;
function processCommand(args, platform = process.platform) {
  const asIs = fitsCommandLine(args) && (platform !== "win32" || !printsInConsoleCodePage(args));
  if (asIs || !canRunInShell(args)) return { args };
  return { args: [...SHELL_ARGS], input: `${toShellCommandLine(args)}
exit
` };
}
function fitsCommandLine(args) {
  let length = 0;
  for (const arg of args) length += quotedLength(arg) + 1;
  return length <= MAX_COMMAND_LINE;
}
function quotedLength(arg) {
  if (arg === "") return 2;
  if (!/[ \t"]/.test(arg)) return arg.length;
  let length = arg.length + 2;
  let backslashes = 0;
  for (const char of arg) {
    if (char === "\\") {
      backslashes++;
      continue;
    }
    if (char === '"') length += backslashes + 1;
    backslashes = 0;
  }
  return length + backslashes;
}
const RESULT_LINE$1 = /^CommandResult (-?\d+)$/;
function isShellResultLine(line) {
  return RESULT_LINE$1.test(line);
}
function shellCommandResult(output) {
  const lines = output.replace(/\r?\n$/, "").split(/\r?\n/);
  const code = RESULT_LINE$1.exec(lines.at(-1) ?? "");
  if (!code) return { output, exitCode: -1 };
  return { output: lines.slice(0, -1).map((line) => `${line}
`).join(""), exitCode: Number(code[1]) };
}
const MAX_LOGGED_COMMAND_LINE = 4e3;
const MAX_LOGGED_OUTPUT = 8e3;
function clipForLog(text2, max) {
  if (text2.length <= max) return text2;
  return `${text2.slice(0, max)}… ${(text2.length - max).toLocaleString("en-US")} more characters`;
}
function pathsOf(platform) {
  return platform === "win32" ? node_path.win32 : node_path.posix;
}
function toAbsolutePath(workspacePath, relativePath, platform = process.platform) {
  return pathsOf(platform).join(workspacePath, ...relativePath.split("/"));
}
function withForwardSlashes(relativePath, platform) {
  return platform === "win32" ? relativePath.replaceAll("\\", "/") : relativePath;
}
function isSameOrInside(folder, candidate, platform) {
  const parent = comparablePath(folder, platform);
  const child2 = comparablePath(candidate, platform);
  return child2 === parent || child2.startsWith(asFolder(parent, platform));
}
function outermostPaths(paths, platform) {
  const keyed = paths.map((path, index) => ({ index, key: asFolder(comparablePath(path, platform), platform) }));
  const sorted = [...keyed].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index);
  const kept = /* @__PURE__ */ new Set();
  let holder;
  for (const { index, key } of sorted) {
    if (holder !== void 0 && key.startsWith(holder)) continue;
    kept.add(index);
    holder = key;
  }
  return paths.filter((_, index) => kept.has(index));
}
function comparablePath(path, platform) {
  const resolved = pathsOf(platform).resolve(path);
  if (platform === "win32") return resolved.toLowerCase();
  return platform === "darwin" ? resolved.normalize("NFC").toLowerCase() : resolved;
}
function asFolder(path, platform) {
  const { sep } = pathsOf(platform);
  return path.endsWith(sep) ? path : path + sep;
}
function inCmPathForm(args, cwd, platform) {
  if (platform !== "darwin") return args;
  return args.map((arg) => arg.startsWith("/") && !isAscii(arg) && isSameOrInside(cwd, arg, platform) ? arg.normalize("NFD") : arg);
}
function isAscii(text2) {
  return /^[\x00-\x7f]*$/.test(text2);
}
const WORKSPACE_WRITES = /* @__PURE__ */ new Set([
  "add",
  "checkin",
  "ci",
  "checkout",
  "co",
  "changerevisiontype",
  "move",
  "mv",
  "remove",
  "rm",
  "revert",
  "switch",
  "undo",
  "undocheckout",
  "unco",
  "update"
]);
function changesWorkspace(args) {
  const [command = "", subcommand] = args;
  if (WORKSPACE_WRITES.has(command)) return true;
  if (command === "merge") return args.includes("--merge");
  if (command === "shelveset") return subcommand === "apply" && !args.includes("--preview");
  if (command === "changelist") return subcommand !== void 0;
  return false;
}
function rewritesChangelists(args) {
  return args[0] === "status" && args.includes("--changelists");
}
class OutputBuffer {
  /** `tailLength`: how much of the end `tail` keeps. */
  constructor(tailLength) {
    this.tailLength = tailLength;
  }
  tailLength;
  chunks = [];
  size = 0;
  end = "";
  get length() {
    return this.size;
  }
  /** The last `tailLength` characters (all of them when there are fewer). */
  get tail() {
    return this.end;
  }
  append(text2) {
    this.chunks.push(text2);
    this.size += text2.length;
    this.end = text2.length >= this.tailLength ? text2.slice(-this.tailLength) : (this.end + text2).slice(-this.tailLength);
  }
  /** Everything before `end`. */
  textBefore(end) {
    return this.chunks.join("").slice(0, end);
  }
  clear() {
    this.chunks = [];
    this.size = 0;
    this.end = "";
  }
}
const RESULT_LINE = /^CommandResult (-?\d+)\r?\n$/;
const RESULT_LINE_ROOM = 40;
const PROMPT_LIKE_TAIL = /^[^<].*(\[[^\]]*\]|[:?])\s*$/;
const MAX_PROMPT_LENGTH = 300;
const PROMPT_STALL_MS = 1500;
const READ_TIMEOUT_MS = 12e4;
const WRITE_TIMEOUT_MS = 30 * 6e4;
const STARTUP_PROBE = ["version"];
class CmShellSession {
  constructor(cmPath, cwd) {
    this.cmPath = cmPath;
    this.cwd = cwd;
  }
  cmPath;
  cwd;
  process = null;
  queue = [];
  running = null;
  buffer = new OutputBuffer(MAX_PROMPT_LENGTH + 1);
  /** Characters received so far, to tell whether output came in while a prompt timer was pending. */
  received = 0;
  promptTimer = null;
  timeoutTimer = null;
  /** Whether the current process answered a command yet; until then it's starting, which takes about a second. */
  answered = false;
  get pendingCount() {
    return this.queue.length + (this.running ? 1 : 0);
  }
  /** Whether a command sent now runs at once, rather than after the process starts. */
  get isReady() {
    return this.process !== null && this.answered;
  }
  /**
   * Starts the `cm shell` process ahead of time, if it isn't running; its startup is the slowest part of a first query.
   * Settles once the process answered (or failed) its first command.
   */
  async start() {
    if (this.process) return;
    this.ensureProcess();
    await this.run(STARTUP_PROBE).catch(() => {
    });
  }
  run(args) {
    return new Promise((resolve, reject) => {
      this.queue.push({ commandLine: toShellCommandLine(args), timeoutMs: shellCommandTimeoutMs(args), resolve, reject });
      this.runNext();
    });
  }
  dispose() {
    this.process?.stdin.end("exit\n");
    this.process = null;
    this.clearTimers();
    const pending = [...this.running ? [this.running] : [], ...this.queue.splice(0)];
    this.running = null;
    pending.forEach((command) => command.reject(new Error("cm shell session was closed")));
  }
  runNext() {
    if (this.running || this.queue.length === 0) return;
    this.running = this.queue.shift();
    this.timeoutTimer = setTimeout(() => this.abortRunning("The cm command took too long and was stopped."), this.running.timeoutMs);
    this.ensureProcess().stdin.write(`${this.running.commandLine}
`);
  }
  ensureProcess() {
    if (this.process) return this.process;
    const child2 = node_child_process.spawn(this.cmPath, SHELL_ARGS, { cwd: this.cwd, windowsHide: true });
    this.answered = false;
    const onData = (text2) => child2 === this.process && this.onOutput(text2);
    child2.stdout.setEncoding("utf8").on("data", onData);
    child2.stderr.setEncoding("utf8").on("data", onData);
    child2.on("error", (error) => this.onProcessEnded(child2, error));
    child2.on("close", () => this.onProcessEnded(child2, new Error("cm shell exited unexpectedly")));
    this.process = child2;
    return child2;
  }
  onOutput(text2) {
    this.buffer.append(text2);
    this.received += text2.length;
    this.watchForPrompt();
    if (!this.running || !resultLineAtEnd(this.buffer.tail)) return;
    const receivedBefore = this.received;
    setImmediate(() => {
      if (this.received === receivedBefore) this.finishIfDone();
    });
  }
  finishIfDone() {
    const { tail, length } = this.buffer;
    const result = resultLineAtEnd(tail);
    if (!result || !this.running) return;
    const text2 = this.buffer.textBefore(length - tail.length + result.index).replaceAll("\r\n", "\n");
    const output = text2.endsWith("\r") ? text2.slice(0, -1) : text2;
    this.buffer.clear();
    this.answered = true;
    this.finishRunning().resolve({ output, exitCode: result.exitCode });
    this.runNext();
  }
  watchForPrompt() {
    if (this.promptTimer) clearTimeout(this.promptTimer);
    this.promptTimer = null;
    const { tail } = this.buffer;
    const newline = tail.lastIndexOf("\n");
    if (newline < 0 && this.buffer.length > MAX_PROMPT_LENGTH) return;
    const lastLine2 = tail.slice(newline + 1);
    if (!lastLine2 || !PROMPT_LIKE_TAIL.test(lastLine2)) return;
    const receivedBefore = this.received;
    this.promptTimer = setTimeout(
      () => setImmediate(() => {
        if (this.received !== receivedBefore || !this.running) return;
        this.abortRunning(`cm is waiting for input ("${lastLine2.trim()}"). Check your credentials for this server.`);
      }),
      PROMPT_STALL_MS
    );
  }
  /** Kills the process (cm ignores SIGTERM while prompting), fails the running command and continues with the queue. */
  abortRunning(reason) {
    const child2 = this.process;
    this.process = null;
    this.buffer.clear();
    child2?.kill("SIGKILL");
    if (this.running) this.finishRunning().reject(new Error(reason));
    this.runNext();
  }
  finishRunning() {
    const finished = this.running;
    this.running = null;
    this.clearTimers();
    return finished;
  }
  onProcessEnded(child2, error) {
    if (child2 !== this.process) return;
    this.process = null;
    this.buffer.clear();
    if (this.running) this.finishRunning().reject(error);
    this.runNext();
  }
  clearTimers() {
    if (this.promptTimer) clearTimeout(this.promptTimer);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.promptTimer = null;
    this.timeoutTimer = null;
  }
}
function shellCommandTimeoutMs(args) {
  return changesWorkspace(args) ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS;
}
function resultLineAtEnd(buffer) {
  const tailStart = Math.max(0, buffer.length - RESULT_LINE_ROOM);
  const lineInTail = buffer.slice(tailStart).lastIndexOf("CommandResult ");
  if (lineInTail < 0) return null;
  const index = tailStart + lineInTail;
  if (index > 0 && buffer[index - 1] !== "\n") return null;
  const match = RESULT_LINE.exec(buffer.slice(index));
  return match ? { index: index > 0 ? index - 1 : 0, exitCode: Number(match[1]) } : null;
}
const SESSIONS_PER_DIRECTORY = 2;
const IDLE_DIRECTORY_MS = 10 * 6e4;
class CmShellPool {
  constructor(cmPath, createSession = (cwd) => new CmShellSession(cmPath, cwd)) {
    this.createSession = createSession;
  }
  createSession;
  directories = /* @__PURE__ */ new Map();
  run(cwd, args) {
    const directory = this.directory(cwd);
    return new Promise((resolve, reject) => {
      directory.waiting.push({ args, resolve, reject });
      this.dispatch(cwd, directory);
    });
  }
  /**
   * Whether a session in the directory answers commands at once. Otherwise they start (about a second), and a query
   * is quicker as a process of its own meanwhile.
   */
  isReady(cwd) {
    this.warmUp(cwd);
    return this.directories.get(cwd).sessions.some((session) => session.isReady);
  }
  /** Starts the sessions for a directory so the first queries there don't pay the startup cost. */
  warmUp(cwd) {
    const directory = this.directory(cwd);
    while (directory.sessions.length < SESSIONS_PER_DIRECTORY) directory.sessions.push(this.createSession(cwd));
    for (const session of directory.sessions) {
      void session.start().then(() => {
        if (this.directories.get(cwd) !== directory) return;
        this.dispatch(cwd, directory);
        this.whenIdle(cwd, directory);
      });
    }
    this.whenIdle(cwd, directory);
  }
  /** Lets a workspace's sessions go once the commands already asked for are done; a later command starts new ones. */
  release(cwd) {
    const directory = this.directories.get(cwd);
    if (!directory) return;
    directory.released = true;
    this.whenIdle(cwd, directory);
  }
  disposeAll() {
    for (const directory of this.directories.values()) this.disposeDirectory(directory);
    this.directories.clear();
  }
  directory(cwd) {
    let directory = this.directories.get(cwd);
    if (!directory) {
      directory = { sessions: [], waiting: [], idleTimer: null, released: false };
      this.directories.set(cwd, directory);
    }
    directory.released = false;
    if (directory.idleTimer) clearTimeout(directory.idleTimer);
    directory.idleTimer = null;
    return directory;
  }
  dispatch(cwd, directory) {
    while (directory.waiting.length > 0) {
      const session = this.freeSession(cwd, directory);
      if (!session) return;
      const { args, resolve, reject } = directory.waiting.shift();
      session.run(args).then(resolve, reject).finally(() => {
        if (this.directories.get(cwd) !== directory) return;
        this.dispatch(cwd, directory);
        this.whenIdle(cwd, directory);
      });
    }
  }
  freeSession(cwd, directory) {
    const idle = directory.sessions.find((session) => session.pendingCount === 0);
    if (idle || directory.sessions.length >= SESSIONS_PER_DIRECTORY) return idle;
    const created = this.createSession(cwd);
    directory.sessions.push(created);
    return created;
  }
  whenIdle(cwd, directory) {
    if (directory.waiting.length > 0 || directory.sessions.some((session) => session.pendingCount > 0)) return;
    const letGo = () => {
      this.disposeDirectory(directory);
      this.directories.delete(cwd);
    };
    if (directory.released) {
      letGo();
      return;
    }
    if (directory.idleTimer) return;
    directory.idleTimer = setTimeout(letGo, IDLE_DIRECTORY_MS);
    directory.idleTimer.unref();
  }
  disposeDirectory(directory) {
    if (directory.idleTimer) clearTimeout(directory.idleTimer);
    directory.idleTimer = null;
    directory.sessions.forEach((session) => session.dispose());
    directory.waiting.splice(0).forEach((command) => command.reject(new Error("cm shell session was closed")));
  }
}
const USAGE_MESSAGE = "cm didn't accept the command's arguments.";
const NOISE = [/\.\.\.$/, /^<\w+:.*>$/, /^[A-Z][A-Z_]*$/, /^STAGE\b/, /^at \S+/, /^<[?/]?[A-Za-z][\w.-]*(?:\s[^<>]*)?[?/]?>$/];
const ERROR_PREFIX = /^Error:\s*/;
const MACHINE_READABLE_ERROR = /^[A-Z][A-Z_]+ (.+\.)(?: [^\s.]+)*$/;
const COMMAND_PREFIX = /^[a-z]+:\s+/;
function extractErrorMessage(output) {
  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  const usageStart = lines.indexOf("Usage:");
  if (usageStart >= 0) {
    const complaint = lines.slice(0, Math.max(usageStart - 1, 0)).at(-1);
    return complaint?.replace(COMMAND_PREFIX, "") ?? USAGE_MESSAGE;
  }
  const meaningful = lines.filter((line) => !NOISE.some((pattern) => pattern.test(line)));
  const errorLine = meaningful.findLast((line) => ERROR_PREFIX.test(line)) ?? meaningful.at(-1);
  if (!errorLine) return SILENT_FAILURE_MESSAGE;
  return MACHINE_READABLE_ERROR.exec(errorLine)?.[1] ?? errorLine.replace(ERROR_PREFIX, "");
}
function runCmProcess(cmPath, args, options) {
  return new Promise((resolve, reject) => {
    const child2 = node_child_process.spawn(cmPath, args, {
      cwd: options.cwd,
      signal: options.signal,
      killSignal: options.killSignal,
      windowsHide: true,
      stdio: "pipe"
    });
    child2.stdin.on("error", () => void 0).end(options.input);
    const chunks = [];
    let pendingLine = "";
    const collect = (text2) => {
      chunks.push(text2);
      if (!options.onOutputLine) return;
      const lines = (pendingLine + text2).split(/\r\n|\r|\n/);
      pendingLine = lines.pop() ?? "";
      lines.forEach(options.onOutputLine);
    };
    child2.stdout.setEncoding("utf8").on("data", collect);
    child2.stderr.setEncoding("utf8").on("data", collect);
    child2.on("error", reject);
    child2.on("close", (code) => {
      if (pendingLine) options.onOutputLine?.(pendingLine);
      resolve({ output: chunks.join("").replaceAll("\r\n", "\n"), exitCode: code ?? -1 });
    });
  });
}
class CmClient {
  /** `locate` finds the `cm` executable; it runs again on `relocate()`. */
  constructor(locate, platform = process.platform) {
    this.locate = locate;
    this.platform = platform;
    this.cmPath = locate();
    this.shellPool = new CmShellPool(this.cmPath);
  }
  locate;
  platform;
  cmPath;
  shellPool;
  logListeners = /* @__PURE__ */ new Set();
  startListeners = /* @__PURE__ */ new Set();
  nextCommandId = 1;
  /** Where `cm` was found: the official GUI and its merge tool are installed next to it. */
  get executable() {
    return this.cmPath;
  }
  /** Looks for `cm` again, e.g. after the user installed it while the app was running. */
  relocate() {
    const cmPath = this.locate();
    if (cmPath === this.cmPath) return;
    this.shellPool.disposeAll();
    this.cmPath = cmPath;
    this.shellPool = new CmShellPool(cmPath);
  }
  onCommandLogged(listener) {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }
  onCommandStarted(listener) {
    this.startListeners.add(listener);
    return () => this.startListeners.delete(listener);
  }
  /** Runs a quick, non-interactive command. Prefer this for reads. */
  query(args, options = {}) {
    const useShell = !options.signal && !options.onOutputLine && canRunInShell(args) && this.shellPool.isReady(options.cwd ?? node_os.homedir());
    return this.run(args, options, useShell);
  }
  /** Runs a long or cancellable command in its own process, streaming its output. */
  execute(args, options = {}) {
    return this.run(args, options, false);
  }
  /** Prepares `cm shell` sessions for a working directory (defaults to the home directory). */
  warmUp(cwd = node_os.homedir()) {
    this.shellPool.warmUp(cwd);
  }
  /** Ends the `cm shell` sessions of a working directory no window shows anymore (each holds tens of MB). */
  release(cwd) {
    this.shellPool.release(cwd);
  }
  dispose() {
    this.shellPool.disposeAll();
  }
  async run(requested, options, useShell) {
    const cwd = options.cwd ?? node_os.homedir();
    const args = withUtf8Output(inCmPathForm(requested, cwd, this.platform));
    const startedAt = Date.now();
    const finished = useShell ? this.shellPool.run(cwd, args) : this.runProcess(args, cwd, options);
    this.startListeners.forEach((listener) => listener({ args, cwd, finished }));
    const result = await finished;
    const entry = this.log(args, cwd, startedAt, result, useShell);
    if (result.exitCode !== 0) {
      throw new CmError(extractErrorMessage(result.output), {
        commandLine: entry.commandLine,
        exitCode: entry.exitCode,
        output: entry.output,
        logEntryId: entry.id
      });
    }
    return result.output;
  }
  /** A process of its own; a command line too long to start one with (thousands of paths) goes to a `cm shell` of its own. */
  async runProcess(args, cwd, { signal, killSignal, onOutputLine }) {
    const { args: started, input } = processCommand(args, this.platform);
    if (input === void 0) return runCmProcess(this.cmPath, started, { cwd, signal, killSignal, onOutputLine });
    const outputLine = onOutputLine && ((line) => !isShellResultLine(line) && onOutputLine(line));
    const result = await runCmProcess(this.cmPath, started, { cwd, signal, killSignal, onOutputLine: outputLine, input });
    return shellCommandResult(result.output);
  }
  /** Logs the command, clipped (`clipForLog`); returns it whole, for the error that reports it. */
  log(args, cwd, startedAt, result, viaShell) {
    const commandLine2 = `cm ${args.join(" ")}`;
    const output = result.exitCode === 0 ? "" : result.output.trim();
    const entry = {
      id: this.nextCommandId++,
      commandLine: commandLine2,
      cwd,
      startedAt,
      durationMs: Date.now() - startedAt,
      exitCode: result.exitCode,
      viaShell,
      output
    };
    const logged = { ...entry, commandLine: clipForLog(commandLine2, MAX_LOGGED_COMMAND_LINE), output: clipForLog(output, MAX_LOGGED_OUTPUT) };
    this.logListeners.forEach((listener) => listener(logged));
    return entry;
  }
}
function pathFolders(env, platform) {
  const value = env.PATH ?? env.Path ?? "";
  if (platform !== "win32") return value.split(":").filter(Boolean);
  return (value.match(/(?:"[^"]*"|[^;])+/g) ?? []).map((folder) => folder.replaceAll('"', "").trim()).filter(Boolean);
}
function installLocations(platform, env) {
  if (platform === "win32") {
    const folders = [env.ProgramFiles ?? "C:\\Program Files", env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"];
    if (env.LOCALAPPDATA) folders.push(node_path.win32.join(env.LOCALAPPDATA, "Programs"));
    return folders.flatMap((folder) => ["PlasticSCM5", "Unity VCS"].map((product) => node_path.win32.join(folder, product, "client", "cm.exe")));
  }
  if (platform === "darwin") {
    return [
      "/usr/local/bin/cm",
      "/opt/homebrew/bin/cm",
      "/Applications/PlasticSCM.app/Contents/Applications/cm.app/Contents/MacOS/cm",
      "/Applications/PlasticSCM.app/Contents/MacOS/cm"
    ];
  }
  return ["/usr/bin/cm", "/opt/plasticscm5/client/cm", "/usr/local/bin/cm"];
}
function cmCandidates(platform, env) {
  const executable = platform === "win32" ? "cm.exe" : "cm";
  const join = platform === "win32" ? node_path.win32.join : node_path.posix.join;
  return [...pathFolders(env, platform).map((folder) => join(folder, executable)), ...installLocations(platform, env)];
}
function locateCm(platform = process.platform, env = process.env, exists = node_fs.existsSync) {
  if (env.UVCS_CM_PATH) return env.UVCS_CM_PATH;
  return cmCandidates(platform, env).find(exists) ?? (platform === "win32" ? "cm.exe" : "cm");
}
const LOCAL_COMMANDS = /* @__PURE__ */ new Set(["status", "getworkspacefrompath", "gwp", "wi", "workspaceinfo", "lwk", "profile", "version", "location", "changelist", "shell"]);
function isServerCommand(args) {
  const [command = "", subcommand] = args;
  if (command === "workspace" || command === "wk") return subcommand !== "list";
  return !LOCAL_COMMANDS.has(command);
}
const REPEATED_COMMAND_BUDGET = { maxRuns: 2, windowMs: 1e4 };
class RepeatedCommandDetector {
  constructor(budget = REPEATED_COMMAND_BUDGET) {
    this.budget = budget;
  }
  budget;
  runs = /* @__PURE__ */ new Map();
  record(command, at) {
    const recent = (this.runs.get(command) ?? []).filter((time) => at - time < this.budget.windowMs);
    recent.push(at);
    this.runs.set(command, recent);
    if (this.runs.size > 1e3) this.forgetOlderThan(at - this.budget.windowMs);
    return recent.length === this.budget.maxRuns + 1;
  }
  forgetOlderThan(time) {
    for (const [command, times] of this.runs) if (times.every((run) => run < time)) this.runs.delete(command);
  }
}
function warnOnRepeatedServerCommands(cm2) {
  const detector = new RepeatedCommandDetector();
  cm2.onCommandStarted(({ args, cwd }) => {
    if (!isServerCommand(args) || !detector.record(`${cwd}
${args.join(" ")}`, Date.now())) return;
    const { maxRuns, windowMs } = REPEATED_COMMAND_BUDGET;
    console.warn(`[server budget] cm ${args.join(" ")} ran more than ${maxRuns} times in ${windowMs / 1e3} s (${cwd}). See "Server budget" in docs/ARCHITECTURE.md.`);
  });
}
async function findWorkspaceRoot(cm2, path) {
  try {
    const output = await cm2.query(["getworkspacefrompath", path, "--format={wkpath}"]);
    return output.trim() || null;
  } catch {
    return null;
  }
}
const callers = new node_async_hooks.AsyncLocalStorage();
function runForCaller(caller, work) {
  return callers.run(caller, work);
}
function currentCaller() {
  const caller = callers.getStore();
  return caller && !caller.isDestroyed() ? caller : void 0;
}
function callerId() {
  const caller = callers.getStore();
  if (!caller) throw new Error("This can only be asked from a window.");
  return caller.id;
}
const INVOKE_CHANNEL = "uvcs:invoke";
const EVENT_CHANNEL = "uvcs:event";
function registerApi(api) {
  const methods = /* @__PURE__ */ new Map();
  for (const [area, service] of Object.entries(api)) {
    for (const [name, method] of Object.entries(service)) {
      methods.set(`${area}.${name}`, method);
    }
  }
  electron.ipcMain.handle(INVOKE_CHANNEL, async (event, request) => {
    const method = methods.get(request.method);
    if (!method) return { ok: false, error: { message: `Unknown API method ${request.method}` } };
    try {
      return { ok: true, value: await runForCaller(event.sender, () => method(...request.args)) };
    } catch (error) {
      return { ok: false, error: toRemoteError(error) };
    }
  });
}
function toRemoteError(error) {
  if (error instanceof CmError) return { message: error.message, command: error.command };
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}
function sendEvent(name, payload) {
  for (const window of electron.BrowserWindow.getAllWindows()) sendEventTo(window.webContents, name, payload);
}
function sendEventTo(target, name, payload) {
  if (!target.isDestroyed()) target.send(EVENT_CHANNEL, name, payload);
}
function sendEventToCaller(name, payload) {
  const caller = currentCaller();
  if (caller) sendEventTo(caller, name, payload);
  else sendEvent(name, payload);
}
const PROGRESS_INTERVAL_MS = 100;
class ProgressThrottle {
  constructor(emit, intervalMs = PROGRESS_INTERVAL_MS) {
    this.emit = emit;
    this.intervalMs = intervalMs;
  }
  emit;
  intervalMs;
  lastEmit = Number.NEGATIVE_INFINITY;
  pending = null;
  timer = null;
  push(value, urgent = false) {
    this.pending = { value };
    const wait = this.lastEmit + this.intervalMs - Date.now();
    if (urgent || wait <= 0) this.flush();
    else this.timer ??= setTimeout(() => this.flush(), wait);
  }
  /** Sends what's pending now, e.g. the last value before the operation ends. */
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending) return;
    const { value } = this.pending;
    this.pending = null;
    this.lastEmit = Date.now();
    this.emit(value);
  }
}
class OperationTracker {
  constructor(onProgress, onStarted) {
    this.onProgress = onProgress;
    this.onStarted = onStarted;
  }
  onProgress;
  onStarted;
  running = /* @__PURE__ */ new Map();
  /** Runs an operation that changes the workspace (update, switch, checkin…). */
  run(operationId, work) {
    return this.track(operationId, work, true);
  }
  /** Runs a slow read that the UI may cancel; the workspace watcher keeps reporting changes meanwhile. */
  read(operationId, work) {
    return this.track(operationId, work, false);
  }
  async track(operationId, work, writes) {
    const controller = new AbortController();
    this.running.set(operationId, controller);
    const throttle = new ProgressThrottle(node_async_hooks.AsyncResource.bind((progress) => this.onProgress(operationId, progress)));
    let step;
    let last = null;
    const report = (command) => {
      const progress = step ? { ...command, step } : command;
      throttle.push(progress, !last || last.stageLabel !== progress.stageLabel || last.step !== progress.step);
      last = progress;
    };
    try {
      const finished = work({
        signal: controller.signal,
        reportProgress: (activity, count) => report(working$1(activity, count)),
        beginStep: (label, index, count) => {
          step = { label, index, count };
          report(working$1(label));
        },
        progressOf: (reader) => {
          let command = null;
          return (line) => {
            const next = reader(command, line);
            if (next === command || !next) return;
            command = next;
            report(next);
          };
        }
      });
      if (writes) this.onStarted(finished);
      return await finished;
    } finally {
      throttle.flush();
      this.running.delete(operationId);
    }
  }
  cancel(operationId) {
    this.running.get(operationId)?.abort();
  }
}
function working$1(stageLabel, count) {
  if (!count || count.total === 0) return { stage: "working", stageLabel, fraction: null };
  return { stage: "working", stageLabel, ...count, fraction: count.current / count.total };
}
const MAX_DIFFS_PER_REPOSITORY = 200;
class DiffReviewStore {
  constructor(root, now = Date.now) {
    this.root = root;
    this.now = now;
  }
  root;
  now;
  loaded = /* @__PURE__ */ new Map();
  saves = /* @__PURE__ */ new Map();
  async marks(repository, diff) {
    const stored = (await this.load(repository))[diff];
    return Object.entries(stored?.marks ?? {}).map(([path, revisionId]) => ({ path, revisionId }));
  }
  async mark(repository, diff, marks) {
    await this.update(repository, diff, (current) => ({ ...current, ...Object.fromEntries(marks.map((mark) => [mark.path, mark.revisionId])) }));
  }
  async unmark(repository, diff, paths) {
    const unmarked = new Set(paths);
    await this.update(repository, diff, (current) => Object.fromEntries(Object.entries(current).filter(([path]) => !unmarked.has(path))));
  }
  async update(repository, diff, change) {
    const repositoryMarks = await this.load(repository);
    const marks = change(repositoryMarks[diff]?.marks ?? {});
    if (Object.keys(marks).length === 0) delete repositoryMarks[diff];
    else repositoryMarks[diff] = { usedAt: this.now(), marks };
    forgetLeastRecentlyUsed(repositoryMarks);
    await this.save(repository, repositoryMarks);
  }
  load(repository) {
    let marks = this.loaded.get(repository);
    if (!marks) {
      marks = promises.readFile(this.filePath(repository), "utf8").then((json) => JSON.parse(json)).catch(() => ({}));
      this.loaded.set(repository, marks);
    }
    return marks;
  }
  /** Writes one save after another, so an older state never lands last. */
  save(repository, marks) {
    const previous = this.saves.get(repository) ?? Promise.resolve();
    const json = JSON.stringify(marks);
    const next = previous.then(() => promises.mkdir(this.root, { recursive: true }).then(() => promises.writeFile(this.filePath(repository), json)));
    this.saves.set(repository, next.catch(() => void 0));
    return next;
  }
  filePath(repository) {
    return node_path.join(this.root, `${node_crypto.createHash("sha1").update(repository).digest("hex").slice(0, 16)}.json`);
  }
}
function forgetLeastRecentlyUsed(marks) {
  const byUse = Object.entries(marks).sort(([, a], [, b]) => b.usedAt - a.usedAt);
  for (const [diff] of byUse.slice(MAX_DIFFS_PER_REPOSITORY)) delete marks[diff];
}
const MAX_TEXT_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const BINARY_SNIFF_BYTES = 8e3;
const IMAGE_MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};
const TEXT_IMAGE_MIME_TYPES = {
  ".svg": "image/svg+xml"
};
const EMPTY_CONTENT = { text: "", isBinary: false, size: 0 };
function toFileContent(bytes, fileName2) {
  if (bytes.length === 0) return EMPTY_CONTENT;
  const imageMimeType = IMAGE_MIME_TYPES[node_path.extname(fileName2).toLowerCase()];
  if (imageMimeType) {
    if (bytes.length > MAX_IMAGE_BYTES) return { isBinary: true, size: bytes.length, tooLarge: "image" };
    return { isBinary: true, size: bytes.length, image: imageBytes(bytes, imageMimeType) };
  }
  const textImageMimeType = TEXT_IMAGE_MIME_TYPES[node_path.extname(fileName2).toLowerCase()];
  if (textImageMimeType) return toTextImageContent(bytes, textImageMimeType);
  if (looksBinary(bytes)) return { isBinary: true, size: bytes.length };
  if (bytes.length > MAX_TEXT_BYTES) return { isBinary: true, size: bytes.length, tooLarge: "text" };
  return { isBinary: false, size: bytes.length, text: bytes.toString("utf8") };
}
function toTextImageContent(bytes, mimeType) {
  if (bytes.length > MAX_IMAGE_BYTES) return { isBinary: true, size: bytes.length, tooLarge: "image" };
  const image = imageBytes(bytes, mimeType);
  if (looksBinary(bytes) || bytes.length > MAX_TEXT_BYTES) return { isBinary: true, size: bytes.length, image };
  return { isBinary: false, size: bytes.length, text: bytes.toString("utf8"), image };
}
function imageBytes(bytes, mimeType) {
  return { bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), mimeType };
}
function looksBinary(bytes) {
  return bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);
}
const MAX_HASHED_BYTES = 50 * 1024 * 1024;
async function fingerprintFile(absolutePath) {
  const info = await promises.stat(absolutePath).catch(() => null);
  if (!info) return { hash: "missing", size: 0, mtimeMs: 0 };
  if (info.isDirectory()) return { hash: "directory", size: 0, mtimeMs: 0 };
  const { size, mtimeMs } = info;
  if (size > MAX_HASHED_BYTES) return { hash: `size:${size}:${mtimeMs}`, size, mtimeMs };
  const bytes = await promises.readFile(absolutePath);
  return { hash: node_crypto.createHash("sha1").update(bytes).digest("hex"), size, mtimeMs, bytes };
}
async function looksUnchanged(absolutePath, before) {
  const info = await promises.stat(absolutePath).catch(() => null);
  if (!info) return before.hash === "missing";
  if (info.isDirectory()) return before.hash === "directory";
  return info.size === before.size && info.mtimeMs === before.mtimeMs;
}
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
class ReviewStore {
  constructor(root) {
    this.root = root;
  }
  root;
  loaded = /* @__PURE__ */ new Map();
  saves = /* @__PURE__ */ new Map();
  async marks(workspacePath) {
    const marks = await this.load(workspacePath);
    let refreshed = false;
    const result = await Promise.all(
      [...marks].map(async ([path, stored]) => {
        const absolutePath = toAbsolutePath(workspacePath, path);
        let reviewed = await looksUnchanged(absolutePath, stored);
        if (!reviewed) {
          const current = await fingerprintFile(absolutePath);
          reviewed = current.hash === stored.hash;
          if (reviewed) {
            marks.set(path, { ...stored, size: current.size, mtimeMs: current.mtimeMs });
            refreshed = true;
          }
        }
        return { path, state: reviewed ? "reviewed" : "changedSinceReview", hasSnapshot: stored.snapshot };
      })
    );
    if (refreshed) await this.save(workspacePath, marks);
    return result;
  }
  async mark(workspacePath, paths) {
    const marks = await this.load(workspacePath);
    await promises.mkdir(this.directory(workspacePath), { recursive: true });
    for (const path of paths) {
      const { bytes, ...fingerprint } = await fingerprintFile(toAbsolutePath(workspacePath, path));
      const snapshot = bytes !== void 0 && bytes.length <= MAX_SNAPSHOT_BYTES && !toFileContent(bytes, path).isBinary;
      if (snapshot) await promises.writeFile(this.snapshotPath(workspacePath, path), bytes);
      else await promises.rm(this.snapshotPath(workspacePath, path), { force: true });
      marks.set(path, { ...fingerprint, snapshot });
    }
    await this.save(workspacePath, marks);
  }
  async unmark(workspacePath, paths) {
    const marks = await this.load(workspacePath);
    const marked = paths.filter((path) => marks.has(path));
    if (marked.length === 0) return;
    for (const path of marked) {
      marks.delete(path);
      await promises.rm(this.snapshotPath(workspacePath, path), { force: true });
    }
    await this.save(workspacePath, marks);
  }
  async keepOnly(workspacePath, pendingPaths) {
    const pending = new Set(pendingPaths);
    const marks = await this.load(workspacePath);
    await this.unmark(workspacePath, [...marks.keys()].filter((path) => !pending.has(path)));
  }
  async readSnapshot(workspacePath, path) {
    const stored = (await this.load(workspacePath)).get(path);
    if (!stored?.snapshot) throw new Error(`No reviewed copy of ${path} was kept.`);
    return toFileContent(await promises.readFile(this.snapshotPath(workspacePath, path)), path);
  }
  load(workspacePath) {
    let marks = this.loaded.get(workspacePath);
    if (!marks) {
      marks = promises.readFile(this.marksPath(workspacePath), "utf8").then((json) => new Map(Object.entries(JSON.parse(json)))).catch(() => /* @__PURE__ */ new Map());
      this.loaded.set(workspacePath, marks);
    }
    return marks;
  }
  /** Writes one save after another, so an older state never lands last. */
  save(workspacePath, marks) {
    const previous = this.saves.get(workspacePath) ?? Promise.resolve();
    const next = previous.then(
      () => marks.size === 0 ? promises.rm(this.directory(workspacePath), { recursive: true, force: true }) : promises.mkdir(this.directory(workspacePath), { recursive: true }).then(
        () => promises.writeFile(this.marksPath(workspacePath), JSON.stringify(Object.fromEntries(marks)))
      )
    );
    this.saves.set(workspacePath, next.catch(() => void 0));
    return next;
  }
  directory(workspacePath) {
    return node_path.join(this.root, hashOf(workspacePath).slice(0, 16));
  }
  marksPath(workspacePath) {
    return node_path.join(this.directory(workspacePath), "marks.json");
  }
  snapshotPath(workspacePath, path) {
    return node_path.join(this.directory(workspacePath), hashOf(path));
  }
}
function hashOf(text2) {
  return node_crypto.createHash("sha1").update(text2).digest("hex");
}
const MAX_AGE_MS = 10 * 6e4;
class BranchNamesCache {
  constructor(readAll, now = Date.now) {
    this.readAll = readAll;
    this.now = now;
  }
  readAll;
  now;
  entries = /* @__PURE__ */ new Map();
  completeAt = /* @__PURE__ */ new Map();
  reading = /* @__PURE__ */ new Map();
  /** Names read along with something else (a branch list); `complete` when it holds every branch, hidden ones too. */
  remember(workspacePath, branches, { complete = false } = {}) {
    const readAt = this.now();
    for (const { id, name } of branches) this.entries.set(entryKey(workspacePath, id), { name: ownCopy(name), readAt });
    if (complete) this.completeAt.set(workspacePath, readAt);
  }
  async resolve(workspacePath, ids) {
    if (ids.some((id) => this.nameOf(workspacePath, id) === void 0) && !this.isComplete(workspacePath)) {
      await this.readEvery(workspacePath);
    }
    const names = /* @__PURE__ */ new Map();
    for (const id of ids) {
      const name = this.nameOf(workspacePath, id);
      if (name !== void 0) names.set(id, name);
    }
    return names;
  }
  nameOf(workspacePath, id) {
    const entry = this.entries.get(entryKey(workspacePath, id));
    return entry && this.now() - entry.readAt < MAX_AGE_MS ? entry.name : void 0;
  }
  isComplete(workspacePath) {
    const completeAt = this.completeAt.get(workspacePath);
    return completeAt !== void 0 && this.now() - completeAt < MAX_AGE_MS;
  }
  /** Reads every branch name; lookups meanwhile wait for the same read. */
  readEvery(workspacePath) {
    const running = this.reading.get(workspacePath);
    if (running) return running;
    const read = this.readAll(workspacePath).then((branches) => this.remember(workspacePath, branches, { complete: true })).finally(() => this.reading.delete(workspacePath));
    this.reading.set(workspacePath, read);
    return read;
  }
}
function ownCopy(text2) {
  return Buffer.from(text2, "utf8").toString("utf8");
}
function entryKey(workspacePath, id) {
  return `${workspacePath}
${id}`;
}
const FIELD_SEPARATOR$1 = "";
const RECORD_SEPARATOR = "";
function recordFormat(placeholders) {
  return placeholders.map((name) => `{${name}}`).join(FIELD_SEPARATOR$1) + RECORD_SEPARATOR;
}
function parseRecords(output) {
  return output.split(RECORD_SEPARATOR).map((record) => record.replace(/^\r?\n/, "")).filter((record) => record.length > 0).map((record) => record.split(FIELD_SEPARATOR$1).map(unquote));
}
function unquote(value) {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}
const ID_AND_NAME = recordFormat(["id", "name"]);
async function readBranchNames(cm2, workspacePath) {
  const read = (conditions) => cm2.query(["find", "branch", ...conditions, `--format=${ID_AND_NAME}`, "--nototal"], { cwd: workspacePath });
  const [visible, hidden] = await Promise.all([read([]), read(["where hidden = 'true'"])]);
  return [...parseBranchNames(visible), ...parseBranchNames(hidden)];
}
function parseBranchNames(output) {
  return parseRecords(output).map(([id = "", name = ""]) => ({ id: Number(id), name }));
}
const AUTOMATIC_SHELVE_COMMENT = "Automatic shelve created during switch operation";
function automaticShelveComment(objectRef) {
  return `${AUTOMATIC_SHELVE_COMMENT} (from ${objectRef})`;
}
const AUTOMATIC_SHELVE_CONDITION = `comment like '${AUTOMATIC_SHELVE_COMMENT}%'`;
function parseCreatedShelves(output) {
  return [...output.matchAll(/^Created shelve sh:(\d+)@(\S+)/gm)].map((match) => ({ id: Number(match[1]), repository: match[2] }));
}
const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const ENTITY = /&(lt|gt|amp|quot|apos);/g;
function readXmlTree(xml, arrays) {
  const root = { name: "", node: {}, text: "" };
  const stack = [root];
  let position = 0;
  while (position < xml.length) {
    const tagStart = xml.indexOf("<", position);
    const textEnd = tagStart < 0 ? xml.length : tagStart;
    if (textEnd > position) stack[stack.length - 1].text += xml.slice(position, textEnd);
    if (tagStart < 0) break;
    const next = xml.charCodeAt(tagStart + 1);
    if (next === 33) {
      if (xml.startsWith("<![CDATA[", tagStart)) {
        const end = indexOrEnd(xml, "]]>", tagStart + 9);
        stack[stack.length - 1].text += xml.slice(tagStart + 9, end).replaceAll("&", "&amp;");
        position = end + 3;
      } else if (xml.startsWith("<!--", tagStart)) {
        position = indexOrEnd(xml, "-->", tagStart + 4) + 3;
      } else {
        position = indexOrEnd(xml, ">", tagStart) + 1;
      }
    } else if (next === 63) {
      position = indexOrEnd(xml, "?>", tagStart) + 2;
    } else if (next === 47) {
      const end = indexOrEnd(xml, ">", tagStart);
      position = end + 1;
      if (stack.length > 1) close(stack.pop(), stack[stack.length - 1], arrays);
    } else {
      const nameEnd = nameEndOf(xml, tagStart + 1);
      const name = xml.slice(tagStart + 1, nameEnd);
      const end = tagEnd(xml, nameEnd);
      position = end + 1;
      const element = { name, node: null, text: "" };
      if (xml.charCodeAt(end - 1) === 47) close(element, stack[stack.length - 1], arrays);
      else stack.push(element);
    }
  }
  while (stack.length > 1) close(stack.pop(), stack[stack.length - 1], arrays);
  return root.node;
}
function close(element, parent, arrays) {
  const text2 = decode(element.text.trim());
  let value = text2;
  if (element.node) {
    if (text2) element.node["#text"] = text2;
    value = element.node;
  }
  parent.node ??= {};
  const siblings = parent.node;
  const existing = siblings[element.name];
  if (arrays.has(element.name)) {
    if (existing) existing.push(value);
    else siblings[element.name] = [value];
  } else if (existing === void 0) {
    siblings[element.name] = value;
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    siblings[element.name] = [existing, value];
  }
}
function nameEndOf(xml, from) {
  for (let index = from; index < xml.length; index++) {
    const code = xml.charCodeAt(index);
    if (code === 62 || code === 47 || code <= 32) return index;
  }
  return xml.length;
}
function tagEnd(xml, from) {
  let quote = 0;
  for (let index = from; index < xml.length; index++) {
    const code = xml.charCodeAt(index);
    if (quote) {
      if (code === quote) quote = 0;
    } else if (code === 34 || code === 39) {
      quote = code;
    } else if (code === 62) {
      return index;
    }
  }
  return xml.length;
}
function indexOrEnd(xml, search, from) {
  const index = xml.indexOf(search, from);
  return index < 0 ? xml.length : index;
}
function decode(text2) {
  const lines = text2.includes("\r") ? text2.replace(/\r\n?/g, "\n") : text2;
  return lines.includes("&") ? lines.replace(ENTITY, (_match, name) => ENTITIES[name]) : lines;
}
function parseXml(xml, arrayElements) {
  return readXmlTree(xml.slice(xml.indexOf("<")), new Set(arrayElements));
}
function text(node) {
  return typeof node === "string" ? node : "";
}
function dateText(node) {
  const date = text(node);
  return date.startsWith("0001-") ? "" : date;
}
function integer(node, fallback = -1) {
  const parsed = Number.parseInt(text(node), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}
function children(parent, name) {
  if (!parent || typeof parent !== "object") return [];
  const value = parent[name];
  return Array.isArray(value) ? value : [];
}
function child(parent, name) {
  if (!parent || typeof parent !== "object") return void 0;
  const value = parent[name];
  return value && typeof value === "object" ? value : void 0;
}
function findRecords(xml, element) {
  return children(child(parseXml(xml, [element]), "PLASTICQUERY"), element);
}
function toBranch(record) {
  return {
    id: integer(record.ID),
    name: text(record.NAME),
    parent: text(record.PARENT),
    comment: text(record.COMMENT),
    owner: text(record.OWNER),
    date: text(record.DATE),
    headChangeset: integer(record.CHANGESET),
    guid: text(record.GUID),
    repository: `${text(record.REPNAME)}@${text(record.REPSERVER)}`
  };
}
function toChangeset(record) {
  return {
    id: integer(record.CHANGESETID),
    guid: text(record.GUID),
    branch: text(record.BRANCH),
    comment: text(record.COMMENT),
    owner: text(record.OWNER),
    date: text(record.DATE),
    parent: integer(record.PARENT),
    repository: `${text(record.REPNAME)}@${text(record.REPSERVER)}`
  };
}
function toLabel(record) {
  return {
    id: integer(record.ID),
    name: text(record.NAME),
    changeset: integer(record.CHANGESET),
    branch: text(record.BRANCH),
    comment: text(record.COMMENT),
    owner: text(record.OWNER),
    date: text(record.DATE),
    repository: `${text(record.REPNAME)}@${text(record.REPSERVER)}`
  };
}
function toShelve(record) {
  return {
    id: integer(record.SHELVEID),
    guid: text(record.GUID),
    comment: text(record.COMMENT),
    owner: text(record.OWNER),
    date: text(record.DATE),
    parentChangeset: integer(record.PARENT),
    repository: `${text(record.REPNAME)}@${text(record.REPSERVER)}`
  };
}
const BUSY_CODES = /* @__PURE__ */ new Set(["EBUSY", "EPERM", "EACCES"]);
const RETRY_DELAYS_MS = [50, 100, 200, 400, 800];
async function retryWhileBusy(work, platform = process.platform, delays = RETRY_DELAYS_MS) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      const code = error.code ?? "";
      if (platform !== "win32" || !BUSY_CODES.has(code) || attempt >= delays.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}
async function moveAside(workspacePath, paths, directory) {
  for (const path of paths) await move(toAbsolutePath(workspacePath, path), toAbsolutePath(directory, path));
}
async function putBack$1(workspacePath, backup) {
  let complete = true;
  for (const path of backup.paths) {
    if (!await putItemBack(toAbsolutePath(backup.directory, path), toAbsolutePath(workspacePath, path))) complete = false;
  }
  if (complete) await promises.rm(backup.directory, { recursive: true, force: true });
  return complete;
}
async function putItemBack(source, target) {
  const sourceStats = await promises.stat(source).catch(() => void 0);
  if (!sourceStats) return true;
  const targetStats = await promises.stat(target).catch(() => void 0);
  if (!targetStats) {
    await move(source, target);
    return true;
  }
  if (sourceStats.isDirectory() && targetStats.isDirectory()) {
    let complete = true;
    for (const name of await promises.readdir(source)) if (!await putItemBack(node_path.join(source, name), node_path.join(target, name))) complete = false;
    if (complete) await promises.rmdir(source);
    return complete;
  }
  if (sourceStats.isFile() && targetStats.isFile() && await sameContent(source, target)) {
    await promises.rm(source);
    return true;
  }
  return false;
}
async function sameContent(a, b) {
  const [first, second] = await Promise.all([promises.readFile(a), promises.readFile(b)]);
  return first.equals(second);
}
async function move(source, target) {
  await promises.mkdir(node_path.dirname(target), { recursive: true });
  try {
    await retryWhileBusy(() => promises.rename(source, target));
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    await promises.cp(source, target, { recursive: true });
    await promises.rm(source, { recursive: true, force: true });
  }
}
const spec = {
  branch: (name) => `br:${name}`,
  /** With `repository` for a changeset of another repository than the workspace's (under an xlink). */
  changeset: (id, repository) => repository ? `cs:${id}@${repository}` : `cs:${id}`,
  label: (name) => `lb:${name}`,
  shelve: (id) => `sh:${id}`,
  /**
   * Always with its repository: `cm` looks a bare `revid:` up in the workspace's, whose revisions reuse the ids of an
   * xlinked repository's (and `cm annotate` finds no bare id on a cloud server).
   */
  revision: ({ revisionId, repository }) => `revid:${revisionId}@${repository}`,
  serverPathAtChangeset: (serverPath, changesetId) => `serverpath:${serverPath}#cs:${changesetId}`,
  /** An item of `repository` at any point in its history, given as a changeset or shelve spec (`cs:12`, `sh:3`). */
  itemAt: (itemId, pointSpec, repository) => `itemid:${itemId}#${pointSpec}@${repository}`,
  serverPathAt: (serverPath, pointSpec) => `serverpath:${serverPath}#${pointSpec}`
};
const SELECTOR_PREFIXES = { branch: "br", changeset: "cs", label: "lb", shelve: "sh" };
function selectorSpec(selector) {
  return `${SELECTOR_PREFIXES[selector.kind]}:${selector.name}`;
}
function repositorySpec(name, server) {
  return `${name}@${server}`;
}
function shortBranchName(fullName) {
  return fullName.split("/").filter(Boolean).at(-1) ?? fullName;
}
function findArgs(object, filter, orderBy, extraConditions = []) {
  const order = orderBy ? ` order by ${orderBy}` : "";
  const limit = filter.limit ? ` limit ${filter.limit}` : "";
  const conditions = filter.text ? [...extraConditions, textCondition(object, filter.text)] : extraConditions;
  return ["find", object, `${whereClause(filter, conditions)}${order}${limit}`.trim(), "--xml", "--nototal"];
}
const TEXT_FIELDS = { branch: "name", label: "name", changeset: "comment", shelve: "comment", review: "title" };
function textCondition(object, text2) {
  const field = TEXT_FIELDS[object];
  if (!field) throw new Error(`Cannot search ${object} objects by text.`);
  return `${field} like '${escapeQueryValue(caseTolerantPattern(text2))}'`;
}
function caseTolerantPattern(text2) {
  const words = text2.split(/\s+/).filter(Boolean);
  return `%${words.map((word) => word.length > 1 ? word.slice(1) : word).join("%")}%`;
}
function whereClause(filter, extraConditions = []) {
  const conditions = [...extraConditions];
  if (filter.sinceDate) conditions.push(`date >= '${filter.sinceDate}'`);
  if (filter.owners?.length) conditions.push(ownersCondition(filter.owners));
  if (filter.branch) conditions.push(`branch = '${escapeQueryValue(filter.branch)}'`);
  return conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
}
function ownersCondition(owners) {
  const each = owners.map((owner) => `owner = '${escapeQueryValue(owner)}'`);
  return each.length === 1 ? each[0] : `(${each.join(" or ")})`;
}
function escapeQueryValue(value) {
  return value.replace(/'/g, "''");
}
async function selectorObjectRef(cm2, workspacePath, selector) {
  switch (selector.kind) {
    case "changeset":
      return `cs:${selector.name}`;
    case "branch": {
      const xml = await cm2.query(["find", "branch", `where name = '${escapeQueryValue(shortBranchName(selector.name))}'`, "--xml", "--nototal"], {
        cwd: workspacePath
      });
      const branch = findRecords(xml, "BRANCH").map(toBranch).find((candidate) => candidate.name === selector.name);
      return branch ? `br:${branch.id}` : null;
    }
    case "label": {
      const xml = await cm2.query(["find", "label", `where name = '${escapeQueryValue(selector.name)}'`, "--xml", "--nototal"], { cwd: workspacePath });
      const [label] = findRecords(xml, "LABEL").map(toLabel);
      return label ? `lb:${label.id}` : null;
    }
    case "shelve":
      return null;
  }
}
const KINDS_BY_PREFIX = { br: "branch", cs: "changeset", lb: "label", sh: "shelve" };
function parseSelectorSpec(spec2) {
  const prefix = /^(br|cs|lb|sh):/.exec(spec2);
  const [name = "", repositoryName] = (prefix ? spec2.slice(prefix[0].length) : spec2).split("@");
  return { selector: { kind: prefix ? KINDS_BY_PREFIX[prefix[1]] : "branch", name }, repositoryName };
}
function describeSelector(selector) {
  return selector.kind === "branch" ? selector.name : `${selector.kind} ${selector.name}`;
}
function bringDisabledReason(targetSpec, workspaceRepositoryName) {
  const { selector, repositoryName } = parseSelectorSpec(targetSpec);
  if (repositoryName && repositoryName !== workspaceRepositoryName) return "otherRepository";
  if (selector.kind === "label") return "label";
  if (selector.kind === "shelve") return "shelve";
  return void 0;
}
const DIFF_FORMAT = recordFormat(["status", "path", "srccmpath", "baserevid", "revid", "type", "repository"]);
const STATUSES$1 = { A: "added", C: "changed", D: "deleted", M: "moved" };
const ITEM_TYPES$3 = { F: "file", B: "binaryFile", D: "directory", X: "xlink" };
const PATH_ORDER = new Intl.Collator(void 0, { numeric: true, sensitivity: "base" });
function parseDiffEntries(output) {
  const entriesByPath = /* @__PURE__ */ new Map();
  for (const record of parseRecords(output)) {
    const entry = toDiffEntry(record);
    if (!entry) continue;
    const existing = entriesByPath.get(entry.path);
    entriesByPath.set(entry.path, existing ? mergeEntries(existing, entry) : entry);
  }
  return [...entriesByPath.values()].sort((a, b) => PATH_ORDER.compare(a.path, b.path));
}
function toDiffEntry([statusCode = "", path = "", sourcePath = "", baseRevision = "", revision = "", typeCode = "", repository = ""]) {
  const status = STATUSES$1[statusCode];
  if (!status) return null;
  const revisionId = Number(revision);
  const baseRevisionId = Number(baseRevision);
  return {
    status,
    path: withoutLeadingSlash(path),
    oldPath: status === "moved" && sourcePath ? withoutLeadingSlash(sourcePath) : void 0,
    itemType: ITEM_TYPES$3[typeCode] ?? "file",
    ...sidesOf(status, baseRevisionId, revisionId),
    repository
  };
}
function sidesOf(status, baseRevisionId, revisionId) {
  if (status === "deleted") return { baseRevisionId: revisionId, revisionId: -1 };
  if (status === "moved" && baseRevisionId === -1) return { baseRevisionId: revisionId, revisionId };
  return { baseRevisionId, revisionId };
}
function mergeEntries(first, second) {
  const moved = [first, second].find((entry) => entry.status === "moved");
  const changed = [first, second].find((entry) => entry.status === "changed");
  if (!moved || !changed) return first;
  return { ...moved, baseRevisionId: changed.baseRevisionId, revisionId: changed.revisionId };
}
function withoutLeadingSlash(path) {
  return path.replace(/^\//, "");
}
const TYPES = {
  Merge: { plain: "merge", interval: "interval" },
  Cherrypick: { plain: "cherryPick", interval: "intervalCherryPick" },
  Subtractive: { plain: "subtractive", interval: "intervalSubtractive" }
};
function mergeLinksOf(mergeInfo) {
  return mergeInfo.split(", ").flatMap((entry) => {
    const match = /^\s*\(?\s*(Merge|Cherrypick|Subtractive) (.*?)\)?\s*$/.exec(entry);
    if (!match || match[2].includes("rep:")) return [];
    const numbers = [...match[2].matchAll(/\d+/g)].map(([digits]) => Number(digits));
    const types = TYPES[match[1]];
    if (numbers.length === 1) return [{ type: types.plain, sourceChangeset: numbers[0] }];
    if (numbers.length === 2) return [{ type: types.interval, sourceChangeset: numbers[1], intervalStart: numbers[0] }];
    return [];
  });
}
function pendingMergeLinks(mergeInfos) {
  const links = /* @__PURE__ */ new Map();
  for (const mergeInfo of mergeInfos) {
    for (const link of mergeLinksOf(mergeInfo)) links.set(`${link.type}:${link.sourceChangeset}:${link.intervalStart ?? ""}`, link);
  }
  return [...links.values()];
}
const CHANGE_KINDS = {
  AD: "added",
  CO: "checkedOut",
  CH: "changed",
  CP: "copied",
  RP: "replaced",
  DE: "deleted",
  LD: "locallyDeleted",
  MV: "moved",
  LM: "locallyMoved",
  PR: "private",
  IG: "ignored",
  CL: "cloaked",
  HC: "hiddenChanged"
};
const DEFAULT_CHANGELIST$1 = "Default";
const ITEM_TYPES$2 = {
  enTextFile: "file",
  enBinaryFile: "binaryFile",
  enDirectory: "directory",
  enSymLink: "symlink"
};
function parsePendingChanges(xml, platform = process.platform) {
  const status = child(parseXml(xml, ["Change", "Changelist"]), "StatusOutput");
  const changelistNodes = children(child(status, "Changelists"), "Changelist");
  const groups = changelistNodes.length > 0 ? changelistNodes : [{ Name: DEFAULT_CHANGELIST$1, Changes: child(status, "Changes") }];
  const changesByPath = /* @__PURE__ */ new Map();
  const changelists = [];
  const mergeInfos = /* @__PURE__ */ new Set();
  for (const group of groups) {
    const name = text(group.Name);
    const changelist = name === DEFAULT_CHANGELIST$1 ? void 0 : name;
    if (changelist) changelists.push({ name: changelist, description: text(group.Description) });
    for (const node of children(child(group, "Changes"), "Change")) {
      const change = toPendingChange(node, changelist, platform);
      if (change.mergeInfo) mergeInfos.add(change.mergeInfo);
      const existing = changesByPath.get(change.path);
      changesByPath.set(change.path, existing ? mergeChanges$1(existing, change) : change);
    }
  }
  return { changelists, changes: [...changesByPath.values()], mergeLinks: pendingMergeLinks(mergeInfos) };
}
function toPendingChange(node, changelist, platform) {
  const kinds = text(node.Type).split("+").map((code) => CHANGE_KINDS[code]).filter((kind) => Boolean(kind));
  const similarity = Number.parseFloat(text(node.SimilarityPerUnit));
  return withOptionalFields(
    { path: withForwardSlashes(text(node.Path), platform), kinds, itemType: ITEM_TYPES$2[text(node.RevisionType)] ?? "file", size: integer(node.Size, 0), lastModified: dateText(node.LastModified) },
    {
      oldPath: withForwardSlashes(text(node.OldPath), platform) || void 0,
      mergeInfo: text(node.MergesInfo).replace(/^\s*\(|\)\s*$/g, "") || void 0,
      similarityPercent: similarity > 0 ? Math.round(similarity * 100) : void 0,
      changelist
    }
  );
}
function mergeChanges$1(first, second) {
  const { path, kinds, itemType, size, lastModified } = first;
  return withOptionalFields(
    { path, kinds: [.../* @__PURE__ */ new Set([...kinds, ...second.kinds])], itemType, size, lastModified },
    {
      oldPath: first.oldPath ?? second.oldPath,
      mergeInfo: first.mergeInfo ?? second.mergeInfo,
      similarityPercent: first.similarityPercent ?? second.similarityPercent,
      changelist: first.changelist ?? second.changelist
    }
  );
}
function withOptionalFields(change, optional) {
  if (optional.oldPath !== void 0) change.oldPath = optional.oldPath;
  if (optional.mergeInfo !== void 0) change.mergeInfo = optional.mergeInfo;
  if (optional.similarityPercent !== void 0) change.similarityPercent = optional.similarityPercent;
  if (optional.changelist !== void 0) change.changelist = optional.changelist;
  return change;
}
const readShelveProgress = (previous, line) => {
  const text2 = line.trim();
  if (!text2 || /[\\/]/.test(text2)) return previous;
  return previous ? { stage: "confirming", stageLabel: "Confirming", fraction: null, cancellable: false } : { stage: "uploading", stageLabel: "Uploading", fraction: null, cancellable: true };
};
function onLinksThemselves(command, ...args) {
  return [command, ...args, "--symlink"];
}
const MARGIN_MS = 10;
function msUntilNextSecond(nowMs) {
  return 1e3 - nowMs % 1e3 + MARGIN_MS;
}
function waitForNextSecond() {
  return new Promise((resolve) => setTimeout(resolve, msUntilNextSecond(Date.now())));
}
function withTempFile(content, work) {
  return withTempDirectory(async (directory) => {
    const filePath = node_path.join(directory, "content.txt");
    await promises.writeFile(filePath, content, "utf8");
    return work(filePath);
  });
}
function withTempPath(work) {
  return withTempDirectory((directory) => work(node_path.join(directory, "content")));
}
async function withTempDirectory(work) {
  const directory = await promises.mkdtemp(node_path.join(node_os.tmpdir(), "uvcs-"));
  try {
    return await work(directory);
  } finally {
    await promises.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => void 0);
  }
}
const MERGE_FIELD_SEPARATOR = "";
const DIRECTORY_CONFLICT_TYPES = {
  EVIL: "evilTwin",
  MV_EVIL: "movedEvilTwin",
  CHG_RM: "changeDelete",
  RM_CHG: "deleteChange",
  MV_RM: "moveDelete",
  RM_MV: "deleteMove",
  DIV_MV: "divergentMove",
  CYCLE: "cycleMove",
  TWICE: "loadedTwice",
  ADD_MV: "addMove",
  MV_ADD: "moveAdd",
  XLINK: "xlink"
};
const ITEM_OPERATIONS = {
  ADD: "added",
  RM: "deleted",
  MV: "moved",
  CHG: "changed"
};
const STATUSES = {
  ALREADY_CONNECTED: "alreadyMerged",
  NO_MERGES_DETECTED: "alreadyMerged",
  INVALID_INTERVAL: "invalidInterval"
};
function parseMergePlan(output) {
  const plan = { status: "ready", changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] };
  const contributors = {};
  for (const line of output.split(/\r?\n/)) {
    const [record, ...fields] = line.split(MERGE_FIELD_SEPARATOR);
    switch (record) {
      case "STATUS":
        plan.status = STATUSES[fields[0]] ?? plan.status;
        if (!STATUSES[fields[0]] && fields[1]) plan.warnings.push(fields[1]);
        break;
      case "CONTRIBUTOR":
        addContributor(contributors, fields);
        break;
      case "DIR_CONFLICT":
        plan.directoryConflicts.push(parseDirectoryConflict(fields));
        break;
      case "FILE_CONFLICT":
        plan.fileConflicts.push(parseFileConflict(fields));
        break;
      case "FILE_SRC":
        plan.changes.push({ kind: "changed", path: fields[0] });
        break;
      case "APPLY":
        plan.changes.push(parseChangeToApply(fields));
        break;
      // Deletes on both sides (RM_RM_WARN) and changes already on the destination (DIS_OP_WARN) need no attention.
      case "PATH_CONFLICT_WARN":
        plan.warnings.push(`${fields[0]} will be renamed to ${fields[1]} to avoid a name clash.`);
        break;
    }
  }
  if (contributors.source && contributors.destination) plan.contributors = contributors;
  plan.fileConflicts.sort(byPath);
  plan.changes.sort(byPath);
  return plan;
}
function byPath(a, b) {
  return a.path.localeCompare(b.path);
}
function addContributor(contributors, [role, changesetId, , branch]) {
  const contributor = { changesetId: Number(changesetId), branch: branch ?? "" };
  if (role === "SRC") contributors.source = contributor;
  else if (role === "DST") contributors.destination = contributor;
  else if (role === "BASE") contributors.base ??= contributor;
}
function parseFileConflict([path, base, source, destination, itemId]) {
  return {
    path,
    baseChangeset: Number(base),
    sourceChangeset: Number(source),
    destinationChangeset: Number(destination),
    itemId: Number(itemId)
  };
}
function parseChangeToApply([operation, path, destinationPath]) {
  switch (operation) {
    case "ADD":
      return { kind: "added", path };
    case "RM":
      return { kind: "deleted", path };
    case "MV":
      return { kind: "moved", path: destinationPath, oldPath: path };
    default:
      return { kind: "permissions", path };
  }
}
function parseDirectoryConflict(fields) {
  const [type, title, explanation, sourceText, destinationText, itemId, isDirectory, ...sides] = fields;
  const [source, rest] = parseSide(sides, sourceText);
  const [destination] = parseSide(rest, destinationText);
  return {
    type: DIRECTORY_CONFLICT_TYPES[type] ?? "xlink",
    title,
    explanation,
    itemId: Number(itemId),
    isDirectory: isDirectory === "True",
    source,
    destination
  };
}
function parseSide([operationCode, firstPath, ...rest], description) {
  const operation = ITEM_OPERATIONS[operationCode] ?? "changed";
  if (operation === "moved") {
    const [newPath, ...remaining] = rest;
    return [{ operation, path: newPath, oldPath: firstPath, description }, remaining];
  }
  return [{ operation, path: firstPath, description }, rest];
}
function directoryConflictIdentity(conflict) {
  return [conflict.type, conflict.itemId, conflict.source.path, conflict.destination.path].join("|");
}
function parseCreatedChangeset(output) {
  const created = /^CHANGESET\u001fcs:(\d+)@/m.exec(output);
  return created ? Number(created[1]) : void 0;
}
function parseDestinationMoved(output) {
  return /^MERGE_NEEDED\u001f/m.test(output);
}
const XLINK_NAME = /^.* -> (w?xlink) -> (.*) (\d+)@(.+?)@(\S*)(?: \[relative\])?(?: (\S+))?$/;
function parseXlinkName(name) {
  const match = XLINK_NAME.exec(name);
  if (!match) return void 0;
  const [, kind, path, changeset, repository, server, relativeServer] = match;
  return {
    writable: kind === "wxlink",
    path,
    changeset: Number(changeset),
    repository,
    server: server || relativeServer || ""
  };
}
const ITEM_TYPES$1 = {
  dir: "directory",
  txt: "file",
  bin: "binaryFile",
  link: "symlink",
  xlink: "xlink"
};
function parseTreeItems(xml) {
  const items = children(child(child(parseXml(xml, ["LsItem"]), "LsResults"), "LsItems"), "LsItem");
  return items.filter((item) => text(item.Name) !== ".").map(treeItem);
}
function treeItem(item) {
  const path = text(item.WkPath).replace(/\\/g, "/").replace(/^\//, "");
  const listedName = text(item.Name);
  const xlink = parseXlinkName(listedName);
  const symlinkTarget = text(item.SymlinkTarget).replace(/^\s*->\s*/, "");
  const changeset = integer(item.Changeset);
  const revisionId = integer(item.RevId);
  const shelveId = changeset < 0 && revisionId > 0 ? -changeset : void 0;
  return {
    path,
    name: path ? path.slice(path.lastIndexOf("/") + 1) : listedName,
    itemType: ITEM_TYPES$1[text(item.Type)] ?? "file",
    size: integer(item.Size, 0),
    date: dateText(item.Date),
    isPrivate: text(item.Status) === "Private",
    isCheckedOut: text(item.Checkout) !== "",
    changeset: shelveId === void 0 ? changeset : null,
    branch: shelveId === void 0 ? text(item.Branch) : "",
    owner: text(item.Owner),
    revisionId,
    parentRevisionId: integer(item.ParentRevId),
    repository: text(item.Repository).replace(/^rep:/, ""),
    itemId: integer(item.ItemId),
    ...shelveId !== void 0 && { shelveId },
    ...xlink && { xlink },
    ...symlinkTarget && { symlinkTarget }
  };
}
const SELECTOR_KINDS = {
  Branch: "branch",
  Changeset: "changeset",
  Label: "label",
  Shelve: "shelve"
};
async function readWorkspaceStatus(cm2, workspacePath) {
  return parseWorkspaceStatus(await cm2.query(["status", "--header", "--xml"], { cwd: workspacePath }));
}
function parseWorkspaceStatus(xml) {
  const status = child(parseXml(xml, []), "StatusOutput");
  const workspaceStatus = child(child(status, "WorkspaceStatus"), "Status");
  const repSpec = child(workspaceStatus, "RepSpec");
  const repositoryName = text(repSpec?.Name);
  const server = text(repSpec?.Server);
  const configName = text(status?.WkConfigName);
  const selector = {
    kind: SELECTOR_KINDS[text(status?.WkConfigType)] ?? "branch",
    name: configName && selectorName(configName, repositoryName, server)
  };
  const loadedChangeset = repositoryName && configName ? loadedChangesetOf(integer(workspaceStatus?.Changeset, Number.NaN), selector) : void 0;
  if (loadedChangeset === void 0) throw new Error(`Unexpected output from cm status: ${xml.trim().slice(0, 200) || "(empty)"}`);
  return { repositoryName, server, selector, loadedChangeset };
}
function loadedChangesetOf(changeset, selector) {
  if (changeset >= 0) return selector.kind === "shelve" ? void 0 : changeset;
  return selector.kind === "shelve" && changeset === -Number(selector.name) ? null : void 0;
}
function selectorName(configName, repositoryName, server) {
  for (const suffix of [`@${repositoryName}@${server}`, `@${repositoryName}`]) {
    if (configName.endsWith(suffix)) return configName.slice(0, -suffix.length);
  }
  return configName;
}
async function withConflictRepositories(cm2, workspacePath, request, plan) {
  if (plan.fileConflicts.length === 0) return withRepositories(plan, "");
  const tree = destinationTree(request, plan) ?? await loadedTree(cm2, workspacePath);
  return withRepositories(plan, await cm2.query(conflictListingArgs(plan, tree), { cwd: workspacePath }));
}
function destinationTree(request, plan) {
  const destination = plan.contributors?.destination.changesetId;
  if (destination !== void 0) return spec.changeset(destination);
  return request.destinationBranch ? spec.branch(request.destinationBranch) : null;
}
async function loadedTree(cm2, workspacePath) {
  const { loadedChangeset } = await readWorkspaceStatus(cm2, workspacePath);
  if (loadedChangeset === null) throw new Error("A workspace on a shelve can't take a merge. Switch it to a branch first.");
  return spec.changeset(loadedChangeset);
}
function conflictListingArgs(plan, tree) {
  return ["ls", ...plan.fileConflicts.map((conflict) => conflict.path), `--tree=${tree}`, "--xml"];
}
function withRepositories(plan, listingXml) {
  const repositories = new Map(listingXml ? parseTreeItems(listingXml).map((item) => [item.path, item.repository]) : []);
  return {
    ...plan,
    fileConflicts: plan.fileConflicts.map((conflict) => {
      const repository = repositories.get(conflict.path.replace(/^\//, ""));
      if (!repository) throw new Error(`Couldn't tell which repository ${conflict.path} is in.`);
      return { ...conflict, repository };
    })
  };
}
const MACHINE_READABLE_ARGS = ["--machinereadable", `--fieldseparator=${MERGE_FIELD_SEPARATOR}`];
function mergeSourceArgs(request) {
  return [
    request.sourceSpec,
    ...request.kind === "cherryPick" ? ["--cherrypicking"] : [],
    ...request.kind === "subtractive" ? ["--subtractive"] : [],
    ...request.intervalOriginSpec ? [`--interval-origin=${request.intervalOriginSpec}`] : [],
    ...request.destinationBranch ? [`--to=br:${request.destinationBranch}`] : []
  ];
}
function fileConflictArgs(request, plan, resolutions) {
  if (plan.fileConflicts.length === 0) return [];
  if (!request.destinationBranch) return ["--keepdestination"];
  const choices = new Set(plan.fileConflicts.map((conflict) => resolutions.files[conflict.path]?.choice));
  if (choices.size === 1 && choices.has("source")) return ["--keepsource"];
  if (choices.size === 1 && choices.has("destination")) return ["--keepdestination"];
  throw new Error("A merge into a server branch must keep the same side for every conflicting file.");
}
const PENDING_CHANGES_PLAN = { status: "pendingChanges", changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] };
async function previewMerge(cm2, workspacePath, request) {
  const intoWorkspace = !request.destinationBranch;
  if (intoWorkspace && await hasPendingChanges(cm2, workspacePath)) return PENDING_CHANGES_PLAN;
  let output;
  try {
    output = await cm2.query(["merge", ...mergeSourceArgs(request), ...MACHINE_READABLE_ARGS, "--printcontributors"], { cwd: workspacePath });
  } catch (error) {
    throw await explainFailure(cm2, workspacePath, request, error);
  }
  return withConflictRepositories(cm2, workspacePath, request, parseMergePlan(output));
}
async function hasPendingChanges(cm2, workspacePath) {
  const output = await cm2.query(["status", "--short", "--controlledchanged", "--changed", "--localdeleted"], { cwd: workspacePath });
  return output.trim().length > 0;
}
async function explainFailure(cm2, workspacePath, request, error) {
  if (!(error instanceof CmError) || error.message !== SILENT_FAILURE_MESSAGE) return error;
  try {
    await cm2.query(["merge", ...mergeSourceArgs(request)], { cwd: workspacePath });
    return error;
  } catch (explained) {
    return explained;
  }
}
function mergeSourcePoint(request, sourceChangeset) {
  return request.sourceSpec.startsWith("sh:") ? request.sourceSpec : `cs:${sourceChangeset}`;
}
const RENAMEABLE_CONFLICTS = /* @__PURE__ */ new Set(["evilTwin", "movedEvilTwin", "addMove", "moveAdd"]);
const PLANNED = /* @__PURE__ */ new Set(["APPLY", "FILE_SRC", "FILE_CONFLICT"]);
const APPLIED = /* @__PURE__ */ new Set(["DO_MERGE", "DO_COPIED", "DO_MOVED", "DO_DELETED"]);
const readMergeProgress = (previous, line) => {
  const [record, path] = line.split(MERGE_FIELD_SEPARATOR);
  if (PLANNED.has(record)) {
    return { stage: "calculating", stageLabel: "Calculating changes", current: 0, total: (previous?.total ?? 0) + 1, fraction: null, cancellable: true };
  }
  if (!APPLIED.has(record)) return previous;
  const total = previous?.total ?? 0;
  const current = Math.min(total, (previous?.current ?? 0) + 1);
  if (total > 0 && current >= total) return { stage: "downloading", stageLabel: "Downloading files", current, total, fraction: null, cancellable: false };
  return { stage: "applying", stageLabel: "Applying changes", current, total, fraction: total ? current / total : null, currentItem: path, cancellable: false };
};
const UNMERGEABLE_REASONS = {
  pendingChanges: "The workspace has pending changes. Check them in or shelve them before merging.",
  alreadyMerged: "There is nothing to merge: the destination already has these changes.",
  invalidInterval: "The changeset interval is not valid."
};
function describeUnmergeablePlan(plan) {
  return plan.status === "ready" ? null : UNMERGEABLE_REASONS[plan.status];
}
function assertResolutionsComplete(plan, resolutions) {
  if (resolutions.directoryConflicts.length !== plan.directoryConflicts.length) {
    throw new Error("Every directory conflict needs a decision before merging.");
  }
  plan.directoryConflicts.forEach((conflict, index) => {
    const resolution = resolutions.directoryConflicts[index];
    if (resolution.choice !== "rename") return;
    if (!RENAMEABLE_CONFLICTS.has(conflict.type)) throw new Error(`${conflict.title}: keeping both items is not possible.`);
    if (!isValidFileName(resolution.newName)) throw new Error(`“${resolution.newName}” is not a valid name.`);
  });
  const unresolved = plan.fileConflicts.filter((conflict) => !resolutions.files[conflict.path]);
  if (unresolved.length > 0) throw new Error(`Resolve ${unresolved.map((conflict) => conflict.path).join(", ")} before merging.`);
}
function isValidFileName(name) {
  return name.trim() !== "" && !/[\\/]/.test(name) && name !== "." && name !== "..";
}
async function runMerge(cm2, workspacePath, request, resolutions, context) {
  const plan = await previewMerge(cm2, workspacePath, request);
  const unmergeable = describeUnmergeablePlan(plan);
  if (unmergeable) throw new Error(unmergeable);
  assertResolutionsComplete(plan, resolutions);
  return withTempDirectory(async (directory) => {
    const commentsFile = node_path.join(directory, "comment.txt");
    if (request.destinationBranch) await promises.writeFile(commentsFile, resolutions.comment ?? "", "utf8");
    const mergeArgs = [
      "merge",
      ...mergeSourceArgs(request),
      "--merge",
      ...fileConflictArgs(request, plan, resolutions),
      "--nointeractiveresolution",
      ...MACHINE_READABLE_ARGS,
      `--mergeresultfile=${node_path.join(directory, "result")}`,
      `--solvedconflictsfile=${node_path.join(directory, "solved")}`,
      ...request.destinationBranch ? [`--commentsfile=${commentsFile}`] : []
    ];
    const run = (args) => cm2.execute(args, {
      cwd: workspacePath,
      signal: context.signal,
      onOutputLine: context.progressOf(readMergeProgress)
    });
    await resolveDirectoryConflicts(plan, resolutions.directoryConflicts, (resolution) => run([...mergeArgs, ...resolveConflictArgs(resolution)]));
    const output = await run(mergeArgs);
    if (request.destinationBranch) {
      return { changesetId: parseCreatedChangeset(output), ...parseDestinationMoved(output) && { destinationMoved: true } };
    }
    context.reportProgress("Writing resolved files");
    await writeFileResolutions(cm2, workspacePath, request, plan, resolutions.files);
    return {};
  });
}
async function resolveDirectoryConflicts(plan, resolutions, solveNext) {
  for (const [index, resolution] of resolutions.entries()) {
    const output = await solveNext(resolution);
    const remaining = parseMergePlan(output).directoryConflicts.map(directoryConflictIdentity);
    const expected = plan.directoryConflicts.slice(index + 1).map(directoryConflictIdentity);
    if (remaining.join("\n") !== expected.join("\n")) {
      throw new Error("The merge changed while solving its directory conflicts, so nothing was merged. Review it again.");
    }
  }
}
function resolveConflictArgs(resolution) {
  const common = ["--resolveconflict", "--conflict=1"];
  switch (resolution.choice) {
    case "source":
      return [...common, "--resolutionoption=src"];
    case "destination":
      return [...common, "--resolutionoption=dst"];
    case "rename":
      return [...common, "--resolutionoption=rename", `--resolutioninfo=${resolution.newName}`];
  }
}
async function writeFileResolutions(cm2, workspacePath, request, plan, resolutions) {
  for (const conflict of plan.fileConflicts) {
    const resolution = resolutions[conflict.path];
    const target = toAbsolutePath(workspacePath, conflict.path.replace(/^\//, ""));
    if (resolution.choice === "text") {
      await retryWhileBusy(() => promises.writeFile(target, resolution.text, "utf8"));
    } else if (resolution.choice === "source") {
      const source = spec.itemAt(conflict.itemId, mergeSourcePoint(request, conflict.sourceChangeset), conflict.repository);
      await cm2.query(["cat", source, `--file=${target}`], { cwd: workspacePath });
    }
  }
}
const DEFAULT_PENDING_CHANGES_FILTER = {
  showPrivate: true,
  showIgnored: false,
  showCloaked: false,
  showHiddenChanged: false,
  detectLocalMoves: true,
  moveSimilarityPercent: 20
};
function isUnchangedCheckout(change) {
  return change.kinds.length > 0 && change.kinds.every((kind) => kind === "checkedOut");
}
const SWITCH_STATUS_ARGS = ["status", "--xml", "--iscochanged", "--changelists", "--controlledchanged", "--changed", "--localdeleted", "--localmoved", "--private"];
const isPrivate = (change) => change.kinds.includes("private");
function shelvableChanges(changes) {
  return changes.filter((change) => !isPrivate(change));
}
function summarizePending(changes) {
  const pending = shelvableChanges(changes);
  return {
    pendingCount: pending.length,
    privateCount: changes.length - pending.length,
    unchangedCheckoutsOnly: pending.length > 0 && pending.every(isUnchangedCheckout),
    inMerge: pending.some((change) => change.mergeInfo)
  };
}
function changedPaths(changes) {
  return shelvableChanges(changes).filter((change) => !isUnchangedCheckout(change)).map((change) => change.path);
}
function missingFromShelve(changes, shelvedPaths) {
  return changedPaths(changes).filter((path) => !shelvedPaths.has(path));
}
function newItemPaths(changes) {
  const paths = changes.filter((change) => change.kinds.some((kind) => kind === "added" || kind === "copied" || kind === "locallyMoved")).map((change) => change.path);
  return topmostPaths(paths);
}
function topmostPaths(paths) {
  const sorted = [...new Set(paths)].sort();
  return sorted.filter((path) => !sorted.some((other) => other !== path && path.startsWith(`${other}/`)));
}
function shelvedChangelists(snapshot) {
  return snapshot.changelists.map(({ name, description }) => ({
    name,
    description,
    paths: shelvableChanges(snapshot.changes).filter((change) => change.changelist === name).map((change) => change.path)
  })).filter((changelist) => changelist.paths.length > 0);
}
const XLINK_CHANGES = "Changes inside Xlinks can't be shelved yet. Check them in first.";
function createSwitchShelve(cm2, workspacePath, changes, objectRef, context, onlyPaths) {
  return createVerifiedShelve(cm2, workspacePath, changes, automaticShelveComment(objectRef), context, onlyPaths);
}
async function createVerifiedShelve(cm2, workspacePath, changes, comment, context, onlyPaths) {
  const targets = onlyPaths?.map((path) => toAbsolutePath(workspacePath, path)) ?? [];
  const output = await withTempFile(
    comment,
    (commentsFile) => cm2.execute(["shelveset", "create", ...targets, "--all", `-commentsfile=${commentsFile}`], {
      cwd: workspacePath,
      onOutputLine: context.progressOf(readShelveProgress)
    })
  );
  const created = parseCreatedShelves(output);
  if (created.length === 0) throw new Error("The shelve finished but no shelve was reported, so the workspace was left as it was.");
  if (created.length > 1) {
    await deleteShelves(cm2, workspacePath, created);
    throw new Error(XLINK_CHANGES);
  }
  const [shelve] = created;
  const entries = await readShelveEntries(cm2, workspacePath, shelve.id);
  const missing = missingFromShelve(changes, new Set(entries.flatMap((entry) => entry.oldPath ? [entry.path, entry.oldPath] : [entry.path])));
  if (missing.length > 0) {
    await deleteShelves(cm2, workspacePath, created);
    throw new Error(`Some changes couldn't be shelved (${missing.slice(0, 3).join(", ")}), so the workspace was left as it was. Check them in first.`);
  }
  return shelve;
}
async function moveNewItemsAside(cm2, records, workspacePath, changes, record, backupsRoot) {
  const privatePaths = new Set(parsePendingChanges(await cm2.query(["status", "--xml", "--private"], { cwd: workspacePath })).changes.map((change) => change.path));
  const paths = newItemPaths(changes).filter((path) => privatePaths.has(path));
  if (paths.length === 0) return;
  const directory = node_path.join(backupsRoot, `${record.createdAt.replace(/[:.]/g, "-")}-sh${record.shelveId}`);
  record.backup = { directory, paths };
  records.save(record);
  await moveAside(workspacePath, paths, directory);
}
async function readShelveEntries(cm2, workspacePath, shelveId) {
  const output = await cm2.query(["diff", spec.shelve(shelveId), "--repositorypaths", `--format=${DIFF_FORMAT}`], { cwd: workspacePath });
  return parseDiffEntries(output);
}
async function deleteShelves(cm2, workspacePath, shelves) {
  for (const shelve of shelves) await cm2.query(["shelveset", "delete", `sh:${shelve.id}@${shelve.repository}`], { cwd: workspacePath });
}
async function applyShelveCleanly(cm2, workspacePath, shelveId, context) {
  const request = { kind: "merge", sourceSpec: spec.shelve(shelveId) };
  const plan = await previewMerge(cm2, workspacePath, request);
  if (plan.status === "pendingChanges") return { kind: "pendingChanges" };
  if (plan.status !== "ready") return { kind: "applied", count: 0 };
  const conflictCount = plan.fileConflicts.length + plan.directoryConflicts.length;
  if (conflictCount > 0) return { kind: "conflicts", count: conflictCount };
  await runMerge(cm2, workspacePath, request, { directoryConflicts: [], files: {} }, context);
  return { kind: "applied", count: plan.changes.length };
}
async function detachReplacedFiles(cm2, workspacePath) {
  const { changes } = parsePendingChanges(await cm2.query(["status", "--xml", "--controlledchanged"], { cwd: workspacePath }));
  const items = changes.filter((change) => (change.kinds.includes("replaced") || change.kinds.includes("copied")) && !change.kinds.includes("moved") && change.itemType !== "directory").map((change) => ({ path: toAbsolutePath(workspacePath, change.path), link: change.itemType === "symlink", copied: !change.kinds.includes("replaced") }));
  if (items.length === 0) return;
  const contents = await Promise.all(items.map((item) => item.link ? promises.readlink(item.path) : promises.readFile(item.path)));
  await cm2.query(onLinksThemselves("undo", ...items.map((item) => item.path)), { cwd: workspacePath });
  await waitForNextSecond();
  await Promise.all(items.map((item, index) => item.link ? relink(item.path, contents[index]) : rewrite(item.path, contents[index])));
  const replaced = items.filter((item) => !item.copied).map((item) => item.path);
  const copied = items.filter((item) => item.copied).map((item) => item.path);
  if (replaced.length > 0) await cm2.query(onLinksThemselves("checkout", ...replaced), { cwd: workspacePath });
  if (copied.length > 0) await cm2.query(["add", ...copied], { cwd: workspacePath });
}
async function rewrite(path, content) {
  await promises.mkdir(node_path.dirname(path), { recursive: true });
  await promises.writeFile(path, content);
}
async function relink(path, target) {
  await promises.mkdir(node_path.dirname(path), { recursive: true });
  const made = `${path}.uvcs-link`;
  await promises.rm(made, { force: true });
  await promises.symlink(target, made);
  await promises.rename(made, path);
}
const FRESH_MS = 5e3;
function cmHeaderReaders(cm2) {
  return {
    status: (workspacePath) => readWorkspaceStatus(cm2, workspacePath),
    names: async (workspacePath) => {
      const output = await cm2.query(["getworkspacefrompath", workspacePath, `--format=${recordFormat(["wkname", "guid"])}`], { cwd: workspacePath });
      const [name = "", guid = ""] = parseRecords(output)[0] ?? [];
      return { name: name.trim(), guid: guid.trim() };
    }
  };
}
class WorkspaceHeaders {
  constructor(readers, now = Date.now) {
    this.readers = readers;
    this.now = now;
  }
  readers;
  now;
  reads = /* @__PURE__ */ new Map();
  status(workspacePath) {
    return this.shared(workspacePath, "status");
  }
  names(workspacePath) {
    return this.shared(workspacePath, "names");
  }
  /** The workspace changed (every workspace, without a path): the next reads ask `cm` again. */
  forget(workspacePath) {
    if (workspacePath === void 0) this.reads.clear();
    else this.reads.delete(workspacePath);
  }
  shared(workspacePath, kind) {
    const now = this.now();
    for (const [path, reads2] of this.reads) if (now - reads2.at >= FRESH_MS) this.reads.delete(path);
    let reads = this.reads.get(workspacePath);
    if (!reads) {
      reads = { at: now };
      this.reads.set(workspacePath, reads);
    }
    const entry = reads;
    if (!entry[kind]) {
      const read = kind === "status" ? this.readers.status(workspacePath) : this.readers.names(workspacePath);
      entry[kind] = read;
      read.catch(() => this.reads.get(workspacePath) === entry && delete entry[kind]);
    }
    return entry[kind];
  }
}
async function readWorkspaceIdentity(from, workspacePath) {
  const headers2 = "query" in from ? cmHeaderReaders(from) : from;
  const [status, { guid }] = await Promise.all([headers2.status(workspacePath), headers2.names(workspacePath)]);
  return {
    guid,
    repository: `${status.repositoryName}@${status.server}`,
    repositoryName: status.repositoryName,
    selector: status.selector
  };
}
class LeftChangesFinder {
  constructor(cm2, records, headers2 = cmHeaderReaders(cm2)) {
    this.cm = cm2;
    this.records = records;
    this.headers = headers2;
  }
  cm;
  records;
  headers;
  async find(workspacePath) {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    const shelves = await this.automaticShelves(workspacePath);
    const own = this.liveRecords(workspace, shelves).flatMap((record) => waitingOn(record, selectorSpec(workspace.selector)) ?? []);
    const foreign = await this.foreignShelves(workspacePath, workspace, shelves);
    return [
      ...own.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toLeftChanges),
      ...await Promise.all(foreign.map(async (shelve) => this.toForeignLeftChanges(workspacePath, workspace, shelve)))
    ];
  }
  /** Whether this app's records have changes waiting on what the workspace is on now. Reads no server data. */
  async hasOwnWaiting(workspacePath) {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    return this.records.forWorkspace(workspace.guid).some((record) => record.repository === workspace.repository && waitingOn(record, selectorSpec(workspace.selector)));
  }
  /**
   * Applies the shelve if it merges cleanly, then puts the changelists back and deletes the shelve.
   * Shelves left by another app are adopted into the records, so finishing them in the merge view cleans up too.
   */
  async restore(workspacePath, shelveId, context) {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    const record = this.records.find({ shelveId, repository: workspace.repository }) ?? await this.adopt(workspacePath, workspace, shelveId);
    if (record.backup) await putBack$1(workspacePath, record.backup);
    const outcome = await applyShelveCleanly(this.cm, workspacePath, shelveId, context);
    if (outcome.kind === "pendingChanges") return { kind: "pendingChanges" };
    if (outcome.kind === "conflicts") return { kind: "conflicts", shelveId };
    await this.finish(workspacePath, record);
    return { kind: "restored", count: record.paths.length, sourceName: record.source.name };
  }
  /**
   * Applies any shelve to the workspace when it merges cleanly. What shelving it away took from here (the added files
   * moved aside, the changelists) comes back as when restoring left changes; the shelve is deleted if asked, and always
   * when it held changes left by a switch or an update: those are done once back.
   */
  async apply(workspacePath, shelveId, deleteShelve, context) {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    const record = this.ownRecord(workspace, shelveId);
    if (record?.backup) await putBack$1(workspacePath, record.backup);
    const outcome = await applyShelveCleanly(this.cm, workspacePath, shelveId, context);
    if (outcome.kind === "pendingChanges") return { kind: "pendingChanges" };
    if (outcome.kind === "conflicts") return { kind: "conflicts" };
    await this.finishApplied(workspacePath, workspace, shelveId, deleteShelve);
    return { kind: "applied", count: outcome.count };
  }
  /** After a merge from a shelve (its conflicts resolved in the merge view): cleaned up as `apply` does. */
  async finishAppliedShelve(workspacePath, shelveId, deleteShelve) {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    await this.finishApplied(workspacePath, workspace, shelveId, deleteShelve);
  }
  async finishApplied(workspacePath, workspace, shelveId, deleteShelve) {
    const record = this.ownRecord(workspace, shelveId);
    if (record) return this.finish(workspacePath, record, deleteShelve || record.reason !== "shelve");
    await detachReplacedFiles(this.cm, workspacePath);
    if (deleteShelve) await deleteShelves(this.cm, workspacePath, [{ id: shelveId, repository: workspace.repository }]);
  }
  /** The record of a shelve this workspace made: another workspace's backup and changelists aren't this one's. */
  ownRecord(workspace, shelveId) {
    const record = this.records.find({ shelveId, repository: workspace.repository });
    return record?.workspaceGuid === workspace.guid ? record : void 0;
  }
  async discard(workspacePath, shelveIds) {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    const keys = shelveIds.map((shelveId) => ({ shelveId, repository: workspace.repository }));
    await deleteShelves(this.cm, workspacePath, keys.map(({ shelveId, repository }) => ({ id: shelveId, repository })));
    for (const key of keys) {
      const backup = this.records.find(key)?.backup;
      if (backup) await promises.rm(backup.directory, { recursive: true, force: true, maxRetries: 5 });
    }
    this.records.remove(keys);
  }
  /** The changes are in the workspace again: back into their changelists, and the record (and the shelve, unless kept) go away. */
  async finish(workspacePath, record, deleteShelve = true) {
    if (record.backup) await putBack$1(workspacePath, record.backup);
    await detachReplacedFiles(this.cm, workspacePath);
    await this.restoreChangelists(workspacePath, record);
    if (deleteShelve) await deleteShelves(this.cm, workspacePath, [{ id: record.shelveId, repository: record.repository }]);
    this.records.remove([record]);
  }
  async restoreChangelists(workspacePath, record) {
    for (const changelist of record.changelists) {
      await this.cm.query(["changelist", "create", changelist.name, changelist.description, "--persistent"], { cwd: workspacePath }).catch(() => {
      });
      const paths = changelist.paths.map((path) => toAbsolutePath(workspacePath, path));
      await this.cm.query(["changelist", changelist.name, "add", ...paths], { cwd: workspacePath }).catch(() => {
      });
    }
  }
  async automaticShelves(workspacePath) {
    const xml = await this.cm.query(["find", "shelve", `where owner = 'me' and ${AUTOMATIC_SHELVE_CONDITION}`, "--xml", "--nototal"], { cwd: workspacePath });
    return findRecords(xml, "SHELVE").map(toShelve);
  }
  /**
   * This workspace's records of left changes whose shelves still exist; the others were deleted elsewhere and are
   * forgotten. Shelves the user shelved away carry the user's comment, not the automatic one: they aren't in `shelves`.
   */
  liveRecords(workspace, shelves) {
    const existing = new Set(shelves.map((shelve) => shelve.id));
    const records = this.records.forWorkspace(workspace.guid).filter((record) => record.repository === workspace.repository && isLeftChanges(record));
    const gone = records.filter((record) => !existing.has(record.shelveId));
    if (gone.length > 0) this.records.remove(gone);
    return records.filter((record) => existing.has(record.shelveId));
  }
  /** Automatic shelves left on the current selector by another app or workspace (the ones this app recorded are its own). */
  async foreignShelves(workspacePath, workspace, shelves) {
    const unrecorded = shelves.filter((shelve) => !this.records.find({ shelveId: shelve.id, repository: workspace.repository }));
    if (unrecorded.length === 0) return [];
    const objectRef = await selectorObjectRef(this.cm, workspacePath, workspace.selector);
    if (!objectRef) return [];
    const comment = automaticShelveComment(objectRef);
    return unrecorded.filter((shelve) => shelve.comment === comment).sort((a, b) => b.id - a.id);
  }
  async toForeignLeftChanges(workspacePath, workspace, shelve) {
    return {
      shelveId: shelve.id,
      sourceName: describeSelector(workspace.selector),
      mode: "leave",
      reason: "switch",
      count: (await readShelveEntries(this.cm, workspacePath, shelve.id)).length,
      createdAt: shelve.date,
      foreign: true
    };
  }
  async adopt(workspacePath, workspace, shelveId) {
    const record = {
      workspaceGuid: workspace.guid,
      shelveId,
      repository: workspace.repository,
      source: {
        spec: selectorSpec(workspace.selector),
        name: describeSelector(workspace.selector),
        objectRef: await selectorObjectRef(this.cm, workspacePath, workspace.selector) ?? ""
      },
      target: { spec: "", name: "" },
      mode: "leave",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      paths: (await readShelveEntries(this.cm, workspacePath, shelveId)).map((entry) => entry.path),
      changelists: []
    };
    this.records.save(record);
    return record;
  }
}
function waitingOn(record, spec2) {
  if (!isLeftChanges(record)) return void 0;
  if (record.source.spec === spec2) return { ...record, mode: "leave" };
  return record.mode === "bring" && record.target.spec === spec2 ? record : void 0;
}
function isLeftChanges(record) {
  return record.reason !== "shelve";
}
function toLeftChanges(record) {
  return {
    shelveId: record.shelveId,
    sourceName: record.source.name,
    targetName: record.target.name || void 0,
    mode: record.mode,
    reason: record.reason ?? "switch",
    count: record.paths.length,
    createdAt: record.createdAt,
    foreign: false
  };
}
const sameShelve = (a, b) => a.shelveId === b.shelveId && a.repository === b.repository;
class SwitchShelveRecords {
  constructor(settings2) {
    this.settings = settings2;
  }
  settings;
  forWorkspace(workspaceGuid) {
    return this.all().filter((record) => record.workspaceGuid === workspaceGuid);
  }
  find(key) {
    return this.all().find((record) => sameShelve(record, key));
  }
  save(record) {
    this.settings.update({ switchShelves: [...this.all().filter((existing) => !sameShelve(existing, record)), record] });
  }
  remove(keys) {
    this.settings.update({ switchShelves: this.all().filter((record) => !keys.some((key) => sameShelve(record, key))) });
  }
  all() {
    return this.settings.get().switchShelves;
  }
}
const ACCOUNT_FORMAT = recordFormat(["name", "server", "user", "workingmode"]);
function parseAccounts(output) {
  return parseRecords(output).map(([name = "", server = "", user = "", workingMode = ""]) => ({ name, server, user, workingMode })).filter((account) => account.name);
}
function createAccountsService({ cm: cm2 }) {
  return {
    list: async () => parseAccounts(await cm2.query(["profile", "list", `--format=${ACCOUNT_FORMAT}`])),
    remove: async (name) => {
      await cm2.query(["profile", "delete", `--name=${name}`]);
    }
  };
}
const ANNOTATE_FORMAT = recordFormat(["line", "changeset", "owner", "date", "branch", "ismergerev", "comment", "content"]);
const ANNOTATE_DATE_FORMAT = "yyyy-MM-ddTHH:mm:sszzz";
function parseAnnotation(output) {
  const changesets = /* @__PURE__ */ new Map();
  const lines = parseRecords(output).map(([line = "", changeset = "", owner = "", date = "", branch = "", isMerge = "", comment = "", content = ""]) => {
    const changesetId = Number(changeset);
    if (!changesets.has(changesetId)) {
      changesets.set(changesetId, {
        changesetId,
        owner,
        date,
        branch: branch.replace(/^br:/, ""),
        comment,
        isMerge: /^(yes|true)$/i.test(isMerge)
      });
    }
    return { lineNumber: Number(line), content: content.replace(/\r$/, ""), changesetId };
  });
  return { lines, changesets: [...changesets.values()] };
}
function createAnnotateService({ cm: cm2 }) {
  return {
    async file(workspacePath, path, revisionSpec) {
      const target = revisionSpec ?? toAbsolutePath(workspacePath, path);
      const output = await cm2.query(["annotate", target, `--format=${ANNOTATE_FORMAT}`, `--dateformat=${ANNOTATE_DATE_FORMAT}`], {
        cwd: workspacePath
      });
      return parseAnnotation(output);
    }
  };
}
const USED_VALUES_SAMPLE = 500;
function createAttributesService({ cm: cm2 }) {
  async function listTypes(workspacePath) {
    const xml = await cm2.query(["find", "attributetype", "--xml", "--nototal"], { cwd: workspacePath });
    return findRecords(xml, "ATTRIBUTEENTITY").map((record) => ({
      id: integer(record.ID),
      name: text(record.NAME),
      comment: text(record.COMMENT),
      owner: text(record.OWNER),
      date: text(record.DATE),
      repository: `${text(record.REPNAME)}@${text(record.REPSERVER)}`
    }));
  }
  async function createType(workspacePath, name, comment) {
    await cm2.query(["attribute", "create", name], { cwd: workspacePath });
    if (comment) await editTypeComment(workspacePath, name, comment);
  }
  async function renameType(workspacePath, name, newName) {
    await cm2.query(["attribute", "rename", `att:${name}`, newName], { cwd: workspacePath });
  }
  async function editTypeComment(workspacePath, name, comment) {
    await cm2.query(["attribute", "edit", `att:${name}`, comment], { cwd: workspacePath });
  }
  async function deleteType(workspacePath, names) {
    await cm2.query(["attribute", "delete", ...names.map((name) => `att:${name}`)], { cwd: workspacePath });
  }
  async function valuesOf(workspacePath, objectSpec) {
    const query = `where srcobj = '${escapeQueryValue(objectSpec)}'`;
    const xml = await cm2.query(["find", "attribute", query, "--xml", "--nototal"], { cwd: workspacePath });
    return findRecords(xml, "ATTRIBUTE").map((record) => ({ name: text(record.NAME), value: text(record.VALUE) }));
  }
  async function usedValues(workspacePath, attribute) {
    const query = `where type = '${escapeQueryValue(attribute)}' limit ${USED_VALUES_SAMPLE}`;
    const output = await cm2.query(["find", "attribute", query, `--format=${recordFormat(["value"])}`, "--nototal"], { cwd: workspacePath });
    return parseRecords(output).map(([value]) => value ?? "");
  }
  function setValue(workspacePath, objectSpec, attribute, value) {
    return withTempFile(value, async (valueFile) => {
      await cm2.query(["attribute", "set", `att:${attribute}`, objectSpec, `--valuecontents=${valueFile}`], { cwd: workspacePath });
    });
  }
  async function unsetValue(workspacePath, objectSpec, attribute) {
    await cm2.query(["attribute", "unset", `att:${attribute}`, objectSpec], { cwd: workspacePath });
  }
  return { listTypes, createType, renameType, editTypeComment, deleteType, valuesOf, usedValues, setValue, unsetValue };
}
const BRANCH_FORMAT = recordFormat(["id", "name", "parent", "owner", "date", "changeset", "comment"]);
const CHANGESET_FORMAT = recordFormat(["changesetid", "branch", "parent", "date", "owner", "comment"]);
const MERGE_FORMAT = recordFormat(["type", "srcchangeset", "dstchangeset"]);
const LABEL_FORMAT = recordFormat(["name", "changeset", "owner", "date", "comment"]);
const HIDDEN_BRANCH_FORMAT = recordFormat(["id", "name"]);
const DATE_FORMAT = "o";
function roundTripDate(day) {
  const offsetMinutes = -(/* @__PURE__ */ new Date(`${day}T00:00:00`)).getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");
  return `${day}T00:00:00.0000000${sign}${hours}:${minutes}`;
}
const MERGE_LINK_TYPES = {
  merge: "merge",
  cherrypick: "cherryPick",
  cherrypicksubstractive: "subtractive",
  interval: "interval",
  intervalcherrypick: "intervalCherryPick",
  intervalcherrypicksubstractive: "intervalSubtractive"
};
function parseBranches(output, hiddenNames) {
  return parseRecords(output).map(([id = "", name = "", parent = "", owner = "", date = "", head = "", comment = ""]) => ({
    id: toInteger(id),
    name,
    parent,
    owner,
    date,
    comment,
    headChangeset: toInteger(head),
    isHidden: hiddenNames.has(name)
  }));
}
function parseChangesets(output) {
  return parseRecords(output).map(([id = "", branch = "", parent = "", date = "", owner = "", comment = ""]) => ({
    id: toInteger(id),
    branch,
    parent: toInteger(parent),
    date,
    owner,
    comment
  }));
}
function parseMergeLinks(output) {
  return parseRecords(output).flatMap(([type = "", source = "", destination = ""]) => {
    const linkType = MERGE_LINK_TYPES[type.toLowerCase()];
    return linkType ? [{ type: linkType, sourceChangeset: toInteger(source), destinationChangeset: toInteger(destination) }] : [];
  });
}
function parseLabels(output) {
  return parseRecords(output).map(([name = "", changeset = "", owner = "", date = "", comment = ""]) => ({
    name,
    changeset: toInteger(changeset),
    owner,
    date,
    comment
  }));
}
function parseHiddenBranches(output) {
  return parseRecords(output).map(([id = "", name = ""]) => ({ id: toInteger(id), name }));
}
function toInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}
function relevantBranches(branches, changesets, sinceDate) {
  const byName = new Map(branches.map((branch) => [branch.name, branch]));
  const since = sinceDate ? new Date(sinceDate).getTime() : Number.NEGATIVE_INFINITY;
  const kept = /* @__PURE__ */ new Set();
  const keepWithAncestors = (name) => {
    let current = byName.get(name);
    while (current && !kept.has(current.name)) {
      kept.add(current.name);
      current = byName.get(current.parent);
    }
  };
  changesets.forEach((changeset) => keepWithAncestors(changeset.branch));
  branches.filter((branch) => new Date(branch.date).getTime() >= since).forEach((branch) => keepWithAncestors(branch.name));
  return branches.filter((branch) => kept.has(branch.name));
}
function createBranchExplorerService({ cm: cm2 }, { branchNames }) {
  async function load(workspacePath, query) {
    const find = (object, where, format) => ["find", object, where, `--format=${format}`, `--dateformat=${DATE_FORMAT}`, "--nototal"].filter(Boolean);
    const inRange = whereClause({ sinceDate: query.sinceDate && roundTripDate(query.sinceDate) });
    const options = { cwd: workspacePath };
    const [branchesOutput, hiddenOutput, changesetsOutput, mergesOutput, labelsOutput] = await Promise.all([
      cm2.query(find("branch", "", BRANCH_FORMAT), options),
      cm2.query(find("branch", "where hidden = 'true'", HIDDEN_BRANCH_FORMAT), options),
      cm2.query(find("changeset", inRange, CHANGESET_FORMAT), options),
      cm2.execute(find("merge", inRange, MERGE_FORMAT), options),
      cm2.query(find("label", inRange, LABEL_FORMAT), options)
    ]);
    const hidden = parseHiddenBranches(hiddenOutput);
    const hiddenNames = new Set(hidden.map((branch) => branch.name));
    const changesets = parseChangesets(changesetsOutput).filter(
      (changeset) => query.includeHidden || !hiddenNames.has(changeset.branch)
    );
    const allBranches = parseBranches(branchesOutput, hiddenNames);
    branchNames.remember(workspacePath, [...allBranches, ...hidden], { complete: true });
    const branches = allBranches.filter((branch) => query.includeHidden || !branch.isHidden);
    return {
      branches: relevantBranches(branches, changesets, query.sinceDate),
      changesets,
      mergeLinks: parseMergeLinks(mergesOutput),
      labels: parseLabels(labelsOutput)
    };
  }
  return { load };
}
const MAIN_BRANCH_GUID = "5fc2d7c8-05e1-4987-9dd9-74eaec7c27eb";
function plasticConfigFolder(platform, env, home) {
  if (env.PLASTIC_HOME) return env.PLASTIC_HOME;
  if (platform === "win32") return node_path.win32.join(env.LOCALAPPDATA ?? node_path.win32.join(home, "AppData", "Local"), "plastic4");
  return node_path.posix.join(home, ".plastic4");
}
function plasticConfigFile(name) {
  return node_path.join(plasticConfigFolder(process.platform, process.env, node_os.homedir()), name);
}
const KEY = "recentbranches";
const SEPARATOR = ";";
const MAX_RECENT_BRANCHES = 5;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function readRecentBranches(conf, workspaceGuid) {
  let value = "";
  forEachEntryOf(conf.split(/\r\n|\r|\n/), workspaceGuid, (entry) => value = entry.value);
  return parseGuids(value);
}
function withRecentBranch(conf, workspaceGuid, branchGuid) {
  const guid = branchGuid.toLowerCase();
  const recent = [guid, ...readRecentBranches(conf, workspaceGuid).filter((other) => other !== guid)].slice(0, MAX_RECENT_BRANCHES);
  const value = recent.map((other) => other + SEPARATOR).join("");
  const eol = conf.includes("\r\n") ? "\r\n" : "\n";
  const lines = conf === "" ? [] : conf.split(/\r\n|\r|\n/);
  let replaced = false;
  forEachEntryOf(lines, workspaceGuid, (entry, index) => {
    lines[index] = `${entry.key}=${value}`;
    replaced = true;
  });
  if (replaced) return lines.join(eol);
  const header = lines.findLastIndex((line) => isSection(parseLine(line), workspaceGuid));
  if (header !== -1) {
    lines.splice(header + 1, 0, `${KEY}=${value}`);
    return lines.join(eol);
  }
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return [...lines, ...lines.length > 0 ? [""] : [], `[${workspaceGuid}]`, `${KEY}=${value}`, "", ""].join(eol);
}
function forEachEntryOf(lines, section, visit) {
  let inSection = false;
  lines.forEach((text2, index) => {
    const line = parseLine(text2);
    if (line.kind === "section") inSection = line.name === section;
    else if (inSection && line.kind === "entry" && line.key.toLowerCase() === KEY) visit(line, index);
  });
}
function parseLine(line) {
  if (line === "" || line.startsWith(";") || line.startsWith("#")) return { kind: "other" };
  if (line.startsWith("[")) return { kind: "section", name: line.replace(/^[[ ]+/, "").replace(/[\] ]+$/, "") };
  const split = line.indexOf("=");
  return split < 0 ? { kind: "entry", key: line, value: "" } : { kind: "entry", key: line.slice(0, split), value: line.slice(split + 1) };
}
function isSection(line, name) {
  return line.kind === "section" && line.name === name;
}
function parseGuids(value) {
  return value.split(SEPARATOR).map((guid) => guid.trim().replace(/^\{(.*)\}$/, "$1").toLowerCase()).filter((guid) => GUID.test(guid));
}
function loadRecentBranches(workspaceGuid) {
  return readConf().then((conf) => readRecentBranches(conf, workspaceGuid));
}
function saveRecentBranch(workspaceGuid, branchGuid) {
  if (branchGuid.toLowerCase() === MAIN_BRANCH_GUID) return Promise.resolve();
  const saved = pendingSave.then(async () => {
    const file = confFile();
    await promises.mkdir(node_path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await promises.writeFile(temp, withRecentBranch(await readConf(), workspaceGuid, branchGuid));
    await retryWhileBusy(() => promises.rename(temp, file));
  });
  pendingSave = saved.catch(() => void 0);
  return saved;
}
let pendingSave = Promise.resolve();
async function readConf() {
  try {
    return await promises.readFile(confFile(), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}
function confFile() {
  return plasticConfigFile("plasticgui.conf");
}
function createBranchesService({ cm: cm2 }, { branchNames }) {
  async function find(workspacePath, filter, conditions) {
    const xml = await cm2.query(findArgs("branch", { ...filter, branch: void 0 }, "date desc", conditions), { cwd: workspacePath });
    const branches = findRecords(xml, "BRANCH").map(toBranch);
    branchNames.remember(workspacePath, branches);
    return branches;
  }
  async function list(workspacePath, filter) {
    const [visible, hidden] = await Promise.all([
      find(workspacePath, filter, ["hidden = 'false'"]),
      filter.includeHidden ? find(workspacePath, filter, ["hidden = 'true'"]) : Promise.resolve([])
    ]);
    return [...visible, ...hidden.map((branch) => ({ ...branch, isHidden: true }))].sort((a, b) => b.date.localeCompare(a.date));
  }
  async function get(workspacePath, name) {
    const named = `name = '${escapeQueryValue(shortBranchName(name))}'`;
    const findNamed = (condition) => cm2.query(["find", "branch", `where ${named} and ${condition}`, "--xml", "--nototal"], { cwd: workspacePath });
    const [visible, hidden] = await Promise.all([findNamed("hidden = 'false'"), findNamed("hidden = 'true'")]);
    const branches = [
      ...findRecords(visible, "BRANCH").map(toBranch),
      ...findRecords(hidden, "BRANCH").map((record) => ({ ...toBranch(record), isHidden: true }))
    ];
    return branches.find((branch) => branch.name === name) ?? null;
  }
  function create(workspacePath, request) {
    return withTempFile(request.comment, async (commentsFile) => {
      await cm2.query(["branch", "create", request.name, ...startingPointOption(request.startingPoint), `-commentsfile=${commentsFile}`], {
        cwd: workspacePath
      });
    });
  }
  async function rename(workspacePath, branch, newName) {
    await cm2.query(["branch", "rename", `br:${branch}`, newName], { cwd: workspacePath });
  }
  async function remove(workspacePath, branches) {
    await cm2.query(["branch", "delete", ...branches.map((branch) => `br:${branch}`)], { cwd: workspacePath });
  }
  async function setHidden(workspacePath, branches, hidden) {
    await cm2.query(["branch", hidden ? "hide" : "unhide", ...branches.map((branch) => `br:${branch}`)], { cwd: workspacePath });
  }
  async function workspaceGuid(workspacePath) {
    return (await cm2.query(["getworkspacefrompath", workspacePath, "--format={guid}"])).trim();
  }
  async function recent(workspacePath) {
    return loadRecentBranches(await workspaceGuid(workspacePath));
  }
  async function rememberRecent(workspacePath, branchGuid) {
    await saveRecentBranch(await workspaceGuid(workspacePath), branchGuid);
  }
  return { list, get, create, rename, delete: remove, setHidden, recent, rememberRecent };
}
function startingPointOption(startingPoint) {
  if (startingPoint === void 0) return [];
  if (startingPoint.startsWith("cs:")) return [`--changeset=${startingPoint}`];
  if (startingPoint.startsWith("lb:")) return [`--label=${startingPoint}`];
  throw new Error(`A branch can only start at a changeset or a label, not ${startingPoint}.`);
}
function createChangesetsService({ cm: cm2 }) {
  return {
    async list(workspacePath, filter) {
      const xml = await cm2.query(findArgs("changeset", filter, "changesetid desc"), { cwd: workspacePath });
      return findRecords(xml, "CHANGESET").map(toChangeset);
    },
    async get(workspacePath, changesetId, repository) {
      const where = `where changesetid = ${changesetId}${repository ? ` on repository '${escapeQueryValue(repository)}'` : ""}`;
      const xml = await cm2.query(["find", "changeset", where, "--xml", "--nototal"], { cwd: workspacePath });
      const [changeset] = findRecords(xml, "CHANGESET").map(toChangeset);
      if (!changeset) throw new Error(`Changeset ${changesetId} was not found.`);
      return changeset;
    },
    async editComment(workspacePath, changesetId, comment) {
      await cm2.query(["changeset", "editcomment", `cs:${changesetId}`, comment], { cwd: workspacePath });
    },
    async moveToBranch(workspacePath, changesetId, branch) {
      await cm2.query(["changeset", "move", `cs:${changesetId}`, `br:${branch}`], { cwd: workspacePath });
    },
    async remove(workspacePath, changesetId) {
      await cm2.query(["changeset", "delete", `cs:${changesetId}`], { cwd: workspacePath });
    }
  };
}
const CODE_REVIEW_STATUSES = ["Under review", "Reviewed", "Rework required"];
const MAX_LISTED_CODE_REVIEWS = 300;
function parseCodeReviews(xml) {
  return findRecords(xml, "REVIEW").map((record) => ({
    id: integer(record.ID),
    title: text(record.TITLE),
    status: toStatus(text(record.CODEREVIEWSTATUS) || text(record.STATUS)),
    owner: text(record.OWNER),
    assignee: text(record.ASSIGNEE),
    date: text(record.DATE),
    targetType: toTargetType(text(record.TARGETTYPE)),
    targetId: integer(text(record.TARGET).replace(/^id:/, ""))
  }));
}
function toStatus(value) {
  const status = value.replace(/^(CodeReviewStatus|Status)\s+/, "");
  return CODE_REVIEW_STATUSES.find((known) => known.toLowerCase() === status.toLowerCase()) ?? "Under review";
}
function toTargetType(value) {
  const type = value.toLowerCase();
  return type === "branch" || type === "changeset" || type === "shelve" ? type : "other";
}
function createCodeReviewsService({ cm: cm2 }, { branchNames }) {
  async function findRaw(workspacePath, conditions, filter) {
    const xml = await cm2.query(findArgs("review", filter, "date desc", conditions), { cwd: workspacePath });
    return parseCodeReviews(xml);
  }
  async function find(workspacePath, conditions, filter) {
    return resolveTargets(workspacePath, await findRaw(workspacePath, conditions, filter));
  }
  function findListed(workspacePath, filter) {
    const conditions = [
      ...filter.assignedToMe ? ["assignee = 'me'"] : [],
      ...filter.status ? [`status = '${escapeQueryValue(filter.status)}'`] : []
    ];
    return findRaw(workspacePath, conditions, {
      owners: filter.owners,
      sinceDate: filter.sinceDate,
      text: filter.text,
      limit: MAX_LISTED_CODE_REVIEWS
    });
  }
  async function resolveTargets(workspacePath, reviews) {
    const branchIds = reviews.filter((review) => review.targetType === "branch").map((review) => review.targetId);
    const names = branchIds.length > 0 ? await branchNames.resolve(workspacePath, branchIds) : /* @__PURE__ */ new Map();
    return reviews.map((review) => ({
      ...summaryOf(review),
      target: targetOf(review, names)
    }));
  }
  return {
    async list(workspacePath, filter) {
      return resolveTargets(workspacePath, await findListed(workspacePath, filter));
    },
    async listSummaries(workspacePath, filter) {
      return (await findListed(workspacePath, filter)).map(summaryOf);
    },
    async get(workspacePath, reviewId) {
      const [review] = await find(workspacePath, [`id = ${reviewId}`], {});
      if (!review) throw new Error(`Code review ${reviewId} was not found.`);
      return review;
    },
    async create(workspacePath, { targetSpec, title, assignee }) {
      const output = await cm2.query(
        ["codereview", targetSpec, title, ...assignee ? [`--assignee=${assignee}`] : [], "--format={id}"],
        { cwd: workspacePath }
      );
      return Number.parseInt(output.trim(), 10);
    },
    async update(workspacePath, reviewId, { status, assignee }) {
      await cm2.query(
        ["codereview", "-e", String(reviewId), ...status ? [`--status=${status}`] : [], ...assignee !== void 0 ? [`--assignee=${assignee}`] : []],
        { cwd: workspacePath }
      );
      const [updated] = status ? await findRaw(workspacePath, [`id = ${reviewId}`], {}) : [];
      if (updated && updated.status !== status) {
        throw new Error("cm didn't change the status: it ignores status changes on reviews nobody is assigned to. Assign the review, then try again.");
      }
    },
    async remove(workspacePath, reviewIds) {
      await cm2.query(["codereview", "-d", ...reviewIds.map(String)], { cwd: workspacePath });
    }
  };
}
function summaryOf({ targetType, targetId, ...summary }) {
  return targetType === "branch" ? { ...summary, targetBranchId: targetId } : summary;
}
function targetOf({ targetType, targetId }, branchNames) {
  if (targetType === "changeset") return { kind: "changeset", changesetId: targetId };
  if (targetType === "shelve") return { kind: "shelve", shelveId: targetId };
  const branch = targetType === "branch" ? branchNames.get(targetId) : void 0;
  if (branch !== void 0) return { kind: "branch", branch };
  return { kind: "unknown", description: targetType === "branch" ? "an unknown branch" : "changes of an unknown kind" };
}
function explainLockedFile(error, path) {
  if (error?.code !== "EBUSY") return error;
  return new Error(`${node_path.basename(path)} is open in another app that locks it. Close it there and try again.`);
}
function removedItemSpec(fileinfoXml, name) {
  const [parent, item] = children(child(parseXml(fileinfoXml, ["FileInfo"]), "FileInfos"), "FileInfo");
  if (!parent || !item) throw new Error("cm fileinfo returned no information for the removed item.");
  const changeset = integer(item.RevisionChangeset);
  if (changeset < 0) return null;
  const directory = text(parent.IsXlink) === "true" ? "" : text(parent.ServerPath).replace(/\/$/, "");
  return `serverpath:${directory}/${name}#cs:${changeset}@${text(parent.RepSpec)}`;
}
async function saveContent(cm2, workspacePath, source, target) {
  switch (source.kind) {
    case "empty":
      return promises.writeFile(target, "");
    case "workspaceFile":
      return promises.copyFile(toAbsolutePath(workspacePath, source.path), target);
    case "workspaceBase":
      return saveLoadedRevision(cm2, workspacePath, source.path, target);
    case "revision":
      return saveRevision(cm2, workspacePath, spec.revision(source.revision), target);
    case "repositoryPath":
      return saveRepositoryPath(cm2, workspacePath, source.path, source.at, target);
    case "spec":
      return saveRevision(cm2, workspacePath, source.spec, target);
  }
}
async function saveLoadedRevision(cm2, workspacePath, path, target) {
  const absolutePath = toAbsolutePath(workspacePath, path);
  const byPath2 = () => saveRevision(cm2, workspacePath, absolutePath, target);
  const throughFolder = async () => {
    const xml = await cm2.query(["fileinfo", node_path.dirname(absolutePath), absolutePath, "--xml"], { cwd: workspacePath });
    const removed = removedItemSpec(xml, node_path.basename(absolutePath));
    await (removed ? saveRevision(cm2, workspacePath, removed, target) : promises.writeFile(target, ""));
  };
  const [first, then] = node_fs.existsSync(absolutePath) ? [byPath2, throughFolder] : [throughFolder, byPath2];
  try {
    await first();
  } catch (error) {
    try {
      await then();
    } catch {
      throw error;
    }
  }
}
async function saveRepositoryPath(cm2, workspacePath, path, at, target) {
  try {
    await saveRevision(cm2, workspacePath, spec.serverPathAt(path, at), target);
  } catch (error) {
    const listed = at.startsWith("cs:") ? await cm2.query(["ls", path, `--tree=${at}`, "--xml"], { cwd: workspacePath }).catch(() => "") : "";
    const item = listed && parseTreeItems(listed).find((candidate) => `/${candidate.path}` === path);
    if (!item || item.revisionId < 0) throw error;
    await saveRevision(cm2, workspacePath, spec.revision(item), target);
  }
}
async function saveRevision(cm2, workspacePath, revisionSpec, target) {
  await cm2.query(["cat", revisionSpec, `--file=${target}`], { cwd: workspacePath });
}
function createContentService({ cm: cm2, reviews }) {
  async function read(workspacePath, source) {
    switch (source.kind) {
      case "empty":
        return EMPTY_CONTENT;
      case "workspaceFile": {
        const absolutePath = toAbsolutePath(workspacePath, source.path);
        const bytes = await promises.readFile(absolutePath).catch((error) => {
          throw explainLockedFile(error, absolutePath);
        });
        return toFileContent(bytes, absolutePath);
      }
      case "reviewSnapshot":
        return reviews.readSnapshot(workspacePath, source.path);
      case "workspaceBase":
      case "revision":
      case "repositoryPath":
      case "spec":
        return withTempPath(async (outputFile) => {
          await saveContent(cm2, workspacePath, source, outputFile);
          return toFileContent(await promises.readFile(outputFile), fileNameOf(source));
        });
    }
  }
  async function writeWorkspaceFile(workspacePath, path, text2) {
    const absolutePath = toAbsolutePath(workspacePath, path);
    await retryWhileBusy(() => promises.writeFile(absolutePath, text2, "utf8")).catch((error) => {
      throw explainLockedFile(error, absolutePath);
    });
  }
  return { read, writeWorkspaceFile };
}
function fileNameOf(source) {
  if (source.kind === "workspaceBase" || source.kind === "repositoryPath") return source.path;
  if (source.kind === "revision") return source.fileName;
  return source.fileName ?? source.spec.split("#")[0];
}
function createDiffService({ cm: cm2 }) {
  return {
    async entries(workspacePath, target) {
      const output = await cm2.query(["diff", ...targetSpecs(target), "--repositorypaths", `--format=${DIFF_FORMAT}`], {
        cwd: workspacePath
      });
      return parseDiffEntries(output);
    }
  };
}
function targetSpecs(target) {
  switch (target.kind) {
    case "changeset":
      return [`cs:${target.changesetId}`];
    case "range":
      return [target.fromSpec, target.toSpec];
    case "branch":
      return [`br:${target.branch}`];
    case "shelve":
      return [`sh:${target.shelveId}`];
  }
}
function parseItemDetails(xml) {
  const info = children(child(parseXml(xml, ["FileInfo"]), "FileInfos"), "FileInfo")[0];
  if (!info) throw new Error("cm fileinfo returned no information for the item.");
  return {
    serverPath: text(info.ServerPath),
    status: text(info.Status),
    loadedChangeset: integer(info.RevisionChangeset),
    owner: text(info.Owner),
    hash: text(info.Hash),
    repository: text(info.RepSpec),
    changelist: text(info.Changelist),
    xlinkTarget: text(info.XlinkTarget),
    underXlinkTarget: text(info.UnderXlinkTarget)
  };
}
const SKIPPED_DIRECTORIES = /* @__PURE__ */ new Set([".plastic", ".git"]);
async function listWorkspacePaths(workspacePath) {
  const paths = [];
  async function walk(directory, prefix) {
    let children2;
    try {
      children2 = await promises.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(
      children2.map((child2) => {
        const isDirectory = child2.isDirectory();
        if (isDirectory && SKIPPED_DIRECTORIES.has(child2.name)) return;
        const path = prefix + child2.name;
        paths.push({ path, isDirectory });
        return isDirectory ? walk(node_path.join(directory, child2.name), `${path}/`) : void 0;
      })
    );
  }
  await walk(workspacePath, "");
  return paths;
}
function moveArgs(workspacePath, move2, platform = process.platform) {
  return ["move", toAbsolutePath(workspacePath, move2.from, platform), toAbsolutePath(workspacePath, move2.to, platform)];
}
async function moveItems(workspacePath, moves, { cm: cm2, renamePrivate: renamePrivate2, exists = pathExists }, context) {
  for (const [index, move2] of moves.entries()) {
    if (context.signal.aborted) throw new Error("Stopped");
    context.reportProgress("Moving items", { current: index, total: moves.length });
    const toPath = toAbsolutePath(workspacePath, move2.to);
    if (await exists(toPath)) throw new Error(`${node_path.basename(toPath)} already exists.`);
    if (move2.isPrivate) await renamePrivate2(toAbsolutePath(workspacePath, move2.from), toPath);
    else await cm2(moveArgs(workspacePath, move2));
  }
  context.reportProgress("Moving items", { current: moves.length, total: moves.length });
}
async function pathExists(path) {
  return promises.lstat(path).then(
    () => true,
    () => false
  );
}
async function renamePrivate(fromPath, toPath) {
  const [from, taken] = await Promise.all([promises.lstat(fromPath, { bigint: true }), promises.lstat(toPath, { bigint: true }).catch(() => null)]);
  if (taken && !isSameItem(from, taken, fromPath, toPath)) throw new Error(`${node_path.basename(toPath)} already exists.`);
  await retryWhileBusy(() => promises.rename(fromPath, toPath));
}
function isSameItem(from, taken, fromPath, toPath) {
  if (from.ino === 0n) return fromPath.toLowerCase() === toPath.toLowerCase();
  return taken.ino === from.ino && taken.dev === from.dev;
}
function createExplorerService({ cm: cm2, operations }) {
  const inWorkspace = (workspacePath) => ({ cwd: workspacePath });
  const absolute = (workspacePath, paths) => paths.map((path) => toAbsolutePath(workspacePath, path));
  async function listDirectory(workspacePath, directory) {
    const xml = await cm2.query(onLinksThemselves("ls", toAbsolutePath(workspacePath, directory), "--xml"), inWorkspace(workspacePath));
    return parseTreeItems(xml);
  }
  async function listRepositoryDirectory(workspacePath, changesetId, directory) {
    const xml = await cm2.query(["ls", `/${directory}`, `--tree=cs:${changesetId}`, "--xml"], inWorkspace(workspacePath));
    return parseTreeItems(xml);
  }
  async function details(workspacePath, path) {
    const xml = await cm2.query(onLinksThemselves("fileinfo", toAbsolutePath(workspacePath, path), "--xml"), inWorkspace(workspacePath));
    return parseItemDetails(xml);
  }
  async function addRecursive(workspacePath, paths) {
    await cm2.query(["add", "-R", "--coparent", ...absolute(workspacePath, paths)], inWorkspace(workspacePath));
  }
  async function move2(workspacePath, fromPath, toPath) {
    await cm2.query(moveArgs(workspacePath, { from: fromPath, to: toPath }), inWorkspace(workspacePath));
  }
  function moveItemsInto(workspacePath, moves, operationId) {
    const mover = { cm: (args) => cm2.query(args, inWorkspace(workspacePath)), renamePrivate };
    return operations.run(operationId, (context) => moveItems(workspacePath, moves, mover, context));
  }
  async function renameItemOnDisk(workspacePath, fromPath, toPath) {
    await renamePrivate(toAbsolutePath(workspacePath, fromPath), toAbsolutePath(workspacePath, toPath));
  }
  async function create(workspacePath, path, kind) {
    const absolutePath = toAbsolutePath(workspacePath, path);
    await promises.mkdir(node_path.dirname(absolutePath), { recursive: true });
    if (kind === "directory") await promises.mkdir(absolutePath);
    else await promises.writeFile(absolutePath, "", { flag: "wx" });
    await cm2.query(["add", "--coparent", absolutePath], inWorkspace(workspacePath));
  }
  async function changeRevisionType(workspacePath, paths, type) {
    await cm2.query(["changerevisiontype", ...absolute(workspacePath, paths), `--type=${type}`], inWorkspace(workspacePath));
  }
  async function saveRevisionAs(workspacePath, revision, fileName2) {
    const { canceled, filePath } = await electron.dialog.showSaveDialog({ defaultPath: fileName2 });
    if (canceled || !filePath) return false;
    await downloadRevision(workspacePath, revision, filePath);
    return true;
  }
  async function openRevision(workspacePath, revision, fileName2) {
    const directory = node_path.join(node_os.tmpdir(), "uvcs-revisions", revision.repository.replace(/[^\w.-]/g, "_"), String(revision.revisionId));
    await promises.mkdir(directory, { recursive: true });
    const filePath = node_path.join(directory, fileName2);
    await downloadRevision(workspacePath, revision, filePath);
    const error = await electron.shell.openPath(filePath);
    if (error) throw new Error(error);
  }
  function downloadRevision(workspacePath, revision, filePath) {
    return saveContent(cm2, workspacePath, { kind: "revision", revision }, filePath);
  }
  return {
    listDirectory,
    listRepositoryDirectory,
    listAllPaths: listWorkspacePaths,
    details,
    addRecursive,
    move: move2,
    renamePrivate: renameItemOnDisk,
    moveItems: moveItemsInto,
    create,
    changeRevisionType,
    saveRevisionAs,
    openRevision
  };
}
const ITEM_TYPES = { txt: "file", bin: "binaryFile", dir: "directory" };
function itemHistoryTarget(workspacePath, path, revision) {
  return revision ? `rev:${spec.revision(revision)}` : toAbsolutePath(workspacePath, path);
}
function itemHistoryArgs(target) {
  return onLinksThemselves("history", target, "--moveddeleted", "--xml");
}
function parseHistoryRecords(xml) {
  const histories = child(child(parseXml(xml, ["RevisionHistory", "Revision"]), "RevisionHistoriesResult"), "RevisionHistories");
  return children(histories, "RevisionHistory").flatMap((history) => children(child(history, "Revisions"), "Revision"));
}
function itemRevisionsArgs(records) {
  const revision = records.find((record) => text(record.ItemId) !== "");
  if (!revision) return null;
  const repository = repositorySpec(text(revision.Repository), text(revision.Server));
  return [
    "find",
    "revision",
    `where itemid = ${integer(revision.ItemId)} on repository '${escapeQueryValue(repository)}'`,
    `--format=${recordFormat(["changeset", "id", "parent"])}`,
    "--nototal"
  ];
}
function workspaceRevisionArgs(absolutePath) {
  return onLinksThemselves("ls", absolutePath, "--format={revid}");
}
function parseWorkspaceRevision(output) {
  const revisionId = Number.parseInt(output.trim().split("\n")[0] ?? "", 10);
  return Number.isNaN(revisionId) || revisionId < 0 ? void 0 : revisionId;
}
function parseItemHistory(records, revisionsOutput, workspaceRevisionId) {
  const revisionsByChangeset = new Map(
    parseRecords(revisionsOutput).map(([changeset, id, parent]) => [Number(changeset), { id: Number(id), parent: Number(parent) }])
  );
  const newestFirst = (a, b) => b.changesetId - a.changesetId;
  return {
    revisions: records.filter((record) => text(record.RevisionType) !== "").map((record) => toRevision(record, revisionsByChangeset.get(integer(record.ChangesetNumber)))).sort(newestFirst),
    pathChanges: records.filter((record) => text(record.RevisionType) === "").map(
      (record) => ({
        changesetId: integer(record.ChangesetNumber),
        owner: text(record.Owner),
        date: text(record.CreationDate),
        description: text(record.Branch)
      })
    ).sort(newestFirst),
    ...workspaceRevisionId !== void 0 && { workspaceRevisionId }
  };
}
function toRevision(record, ids) {
  const revisionId = ids?.id ?? -1;
  const name = text(record.Repository);
  const repository = name && repositorySpec(name, text(record.Server));
  return {
    revisionId,
    parentRevisionId: ids?.parent ?? -1,
    changesetId: integer(record.ChangesetNumber),
    branch: text(record.Branch),
    owner: text(record.Owner),
    date: text(record.CreationDate),
    comment: text(record.Comment),
    itemType: ITEM_TYPES[text(record.RevisionType)] ?? "file",
    size: integer(record.Size, 0),
    repository,
    idSpec: revisionId >= 0 && repository ? spec.revision({ revisionId, repository }) : text(record.RevisionSpec)
  };
}
function createHistoryService({ cm: cm2 }) {
  const downloadRevision = (workspacePath, revision, targetFile) => saveContent(cm2, workspacePath, { kind: "revision", revision }, targetFile);
  return {
    async forItem(workspacePath, path, revision) {
      const workspaceRevision = revision === void 0 ? cm2.query(workspaceRevisionArgs(toAbsolutePath(workspacePath, path)), { cwd: workspacePath }).then(parseWorkspaceRevision, () => void 0) : Promise.resolve(void 0);
      const records = parseHistoryRecords(await cm2.query(itemHistoryArgs(itemHistoryTarget(workspacePath, path, revision)), { cwd: workspacePath }));
      const revisionsArgs = itemRevisionsArgs(records);
      return parseItemHistory(records, revisionsArgs ? await cm2.query(revisionsArgs, { cwd: workspacePath }) : "", await workspaceRevision);
    },
    async revertTo(workspacePath, path, changesetId) {
      await cm2.query(["revert", `${toAbsolutePath(workspacePath, path)}#cs:${changesetId}`], { cwd: workspacePath });
    },
    async saveRevisionAs(workspacePath, revision, suggestedFileName) {
      const result = await electron.dialog.showSaveDialog({ title: "Save revision as", defaultPath: suggestedFileName });
      if (result.canceled || !result.filePath) return null;
      await downloadRevision(workspacePath, revision, result.filePath);
      return result.filePath;
    },
    async openRevision(workspacePath, revision, fileName2) {
      const directory = await promises.mkdtemp(node_path.join(node_os.tmpdir(), `uvcs-rev${revision.revisionId}-`));
      const targetFile = node_path.join(directory, fileName2);
      await downloadRevision(workspacePath, revision, targetFile);
      const error = await electron.shell.openPath(targetFile);
      if (error) throw new Error(error);
    }
  };
}
function labelCommentArgs(label, comment, commentsFile) {
  if (!comment.trim()) throw new Error("cm can't remove a label's comment, only replace it.");
  return ["label", "create", `lb:${label.name}@${label.repository}`, `cs:${label.changeset}@${label.repository}`, `-commentsfile=${commentsFile}`];
}
function createLabelsService({ cm: cm2 }) {
  return {
    async list(workspacePath, filter) {
      const xml = await cm2.query(findArgs("label", filter, "date desc"), { cwd: workspacePath });
      return findRecords(xml, "MARKER").map(toLabel);
    },
    create(workspacePath, request) {
      const target = request.changesetId === void 0 ? workspacePath : `cs:${request.changesetId}`;
      return withTempFile(request.comment, async (commentsFile) => {
        await cm2.query(["label", "create", `lb:${request.name}`, target, `-commentsfile=${commentsFile}`], { cwd: workspacePath });
      });
    },
    async rename(workspacePath, label, newName) {
      await cm2.query(["label", "rename", `lb:${label}`, newName], { cwd: workspacePath });
    },
    editComment(_workspacePath, label, comment) {
      return withTempFile(comment, async (commentsFile) => {
        await cm2.query(labelCommentArgs(label, comment, commentsFile));
      });
    },
    async delete(workspacePath, labels) {
      await cm2.query(["label", "delete", ...labels.map((label) => `lb:${label}`)], { cwd: workspacePath });
    }
  };
}
function createLeftChangesService({ operations }, { leftChanges }) {
  return {
    find: (workspacePath) => leftChanges.find(workspacePath),
    restore: (workspacePath, shelveId, operationId) => operations.run(operationId, (context) => leftChanges.restore(workspacePath, shelveId, context)),
    discard: (workspacePath, shelveIds) => leftChanges.discard(workspacePath, shelveIds)
  };
}
const FIELD_SEPARATOR = "";
const LINE_SEPARATOR = "";
const LOCK_LIST_FORMAT_ARGS = [
  "--machinereadable",
  "--smartlocks",
  `--fieldseparator=${FIELD_SEPARATOR}`,
  `--endlineseparator=${LINE_SEPARATOR}`,
  "--dateformat=yyyy-MM-ddTHH:mm:sszzz"
];
function parseLocks(output, repositoryServer) {
  return output.split(LINE_SEPARATOR).map((line) => line.trim()).filter(Boolean).map((line) => line.split(FIELD_SEPARATOR)).filter((fields) => fields.length >= 12).map(([repository, itemId, guid, date, destinationBranch, , holderBranch, , status, owner, workspace, path]) => ({
    repository: `${repository}@${repositoryServer}`,
    itemId: Number(itemId),
    guid,
    date,
    destinationBranch,
    holderBranch,
    status,
    owner,
    workspace,
    path
  }));
}
function createLocksService({ cm: cm2 }) {
  return {
    async list(workspacePath, repository, { onlyMine, onlyThisWorkspace = false }) {
      const output = await cm2.query(
        [
          "lock",
          "list",
          "--anystatus",
          `--repository=${repository}`,
          ...onlyMine ? ["--onlycurrentuser"] : [],
          ...onlyThisWorkspace ? ["--onlycurrentworkspace"] : [],
          ...LOCK_LIST_FORMAT_ARGS
        ],
        { cwd: workspacePath }
      );
      return parseLocks(output, repository.slice(repository.indexOf("@") + 1));
    },
    async unlock(workspacePath, locks, { remove }) {
      const itemSpecs = locks.map((lock) => `itemid:${lock.itemId}@${lock.repository}`);
      await cm2.query(["lock", "unlock", ...itemSpecs, ...remove ? ["--remove"] : []], { cwd: workspacePath });
    }
  };
}
const LOCAL_CONTENT_CHANGES = /* @__PURE__ */ new Set(["changed", "checkedOut", "replaced"]);
const NOTHING_INCOMING = { branch: null, changesetCount: 0, authors: [] };
async function readIncomingSummary(cm2, workspacePath, loaded) {
  if (!loaded) return NOTHING_INCOMING;
  const { branch, loadedChangeset } = loaded;
  const output = await cm2.query(incomingChangesetsArgs(branch, loadedChangeset), { cwd: workspacePath });
  return summarizeIncoming(branch, loadedChangeset, parseRecords(output).map(([id, owner]) => ({ id: Number(id), owner: owner ?? "" })));
}
function incomingChangesetsArgs(branch, loadedChangeset) {
  return [
    "find",
    "changeset",
    `where changesetid > ${loadedChangeset} and branch = '${escapeQueryValue(branch)}'`,
    `--format=${recordFormat(["changesetid", "owner"])}`,
    "--nototal"
  ];
}
function summarizeIncoming(branch, loadedChangeset, incoming) {
  const newestFirst = [...incoming].sort((a, b) => b.id - a.id);
  return {
    branch,
    loadedChangeset,
    headChangeset: newestFirst[0]?.id ?? loadedChangeset,
    changesetCount: incoming.length,
    authors: distinctAuthors(newestFirst.map((changeset) => changeset.owner))
  };
}
function distinctAuthors(owners) {
  return [...new Set(owners.filter(Boolean))];
}
async function readIncomingChanges(cm2, workspacePath) {
  const { summary, changesets } = await readIncomingChangesets(cm2, workspacePath);
  if (!summary.branch || changesets.length === 0) return { ...summary, changesets, files: [], conflicts: [], blockedPaths: [] };
  const [diffOutput, statusXml] = await Promise.all([
    cm2.query(["diff", spec.changeset(summary.loadedChangeset), spec.changeset(summary.headChangeset), "--repositorypaths", `--format=${DIFF_FORMAT}`], {
      cwd: workspacePath
    }),
    cm2.query(["status", "--xml", "--controlledchanged", "--changed"], { cwd: workspacePath })
  ]);
  const files = parseDiffEntries(diffOutput);
  const local = parsePendingChanges(statusXml).changes;
  return { ...summary, changesets, files, conflicts: findUpdateConflicts(files, local), blockedPaths: findUpdateBlockers(files, local) };
}
function findUpdateBlockers(incoming, local) {
  const localPaths = new Set(local.map((change) => change.path));
  return incoming.filter((entry) => entry.status === "deleted" || entry.status === "moved").map((entry) => entry.oldPath ?? entry.path).filter((path) => localPaths.has(path));
}
function findUpdateConflicts(incoming, local) {
  const locallyChanged = new Set(
    local.filter((change) => change.kinds.some((kind) => LOCAL_CONTENT_CHANGES.has(kind))).map((change) => change.path)
  );
  return incoming.filter((entry) => entry.status === "changed" && entry.itemType !== "directory" && locallyChanged.has(entry.path)).map((entry) => ({
    path: entry.path,
    isBinary: entry.itemType === "binaryFile",
    baseRevisionId: entry.baseRevisionId,
    incomingRevisionId: entry.revisionId,
    repository: entry.repository
  }));
}
async function readIncomingChangesets(cm2, workspacePath) {
  const { selector, loadedChangeset } = await readWorkspaceStatus(cm2, workspacePath);
  if (selector.kind !== "branch" || loadedChangeset === null) return { summary: NOTHING_INCOMING, changesets: [] };
  const branch = selector.name;
  const xml = await cm2.query(findArgs("changeset", { branch }, "changesetid desc", [`changesetid > ${loadedChangeset}`]), { cwd: workspacePath });
  const changesets = findRecords(xml, "CHANGESET").map(toChangeset);
  return {
    summary: {
      branch,
      loadedChangeset,
      headChangeset: changesets[0]?.id ?? loadedChangeset,
      changesetCount: changesets.length,
      authors: distinctAuthors(changesets.map((changeset) => changeset.owner))
    },
    changesets
  };
}
async function findMergedInto(cm2, workspacePath, sourceChangeset, destinationBranch) {
  const output = await cm2.query(mergedIntoArgs(sourceChangeset, destinationBranch), { cwd: workspacePath });
  return parseMergedInto(output);
}
function mergedIntoArgs(sourceChangeset, destinationBranch) {
  return [
    "find",
    "merge",
    `where srcchangeset = ${sourceChangeset} and dstbranch = '${escapeQueryValue(destinationBranch)}' limit 1`,
    `--format=${recordFormat(["dstchangeset"])}`,
    "--nototal"
  ];
}
function parseMergedInto(output) {
  const [record] = parseRecords(output);
  const changeset = Number(record?.[0]);
  return record && Number.isInteger(changeset) ? changeset : null;
}
const UNITS = {
  bytes: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3
};
function parseSize(amount, unit) {
  const factor = UNITS[unit];
  const value = Number(amount.replace(",", "."));
  return factor === void 0 || Number.isNaN(value) ? void 0 : Math.round(value * factor);
}
const PROGRESS_LINE = /^[-\\|/] .+?\s+\[[#.]+\]\s+\d+%(.*)$/;
const TOTALS = /^\s+([\d.,]+)\/([\d.,]+) (\S+) -\s+(\d+)\/(\d+)(?:\s+\S+)?(?: - (.*))?$/;
const PREPARING = { stage: "preparing", stageLabel: "Preparing", fraction: null, cancellable: true };
const CALCULATING = { stage: "calculating", stageLabel: "Calculating changes", fraction: null, cancellable: true };
const readUpdateProgress = (previous, line) => {
  const trimmed = line.trimEnd();
  const progressLine = PROGRESS_LINE.exec(trimmed);
  if (!progressLine) {
    if (!trimmed.trim()) return previous;
    return previous && previous.stage !== "preparing" ? previous : PREPARING;
  }
  const totals = TOTALS.exec(progressLine[1]);
  if (!totals) return CALCULATING;
  const bytesDone = parseSize(totals[1], totals[3]);
  const bytesTotal = parseSize(totals[2], totals[3]);
  const current = Number(totals[4]);
  const total = Number(totals[5]);
  const fraction = workDone(bytesDone ?? 0, bytesTotal ?? 0, current, total);
  const finished = current >= total && (bytesDone ?? 0) >= (bytesTotal ?? 0);
  return {
    // Files are being written from here on: stopping halfway would leave the workspace half updated.
    ...finished ? { stage: "finishing", stageLabel: "Finishing", fraction: 1 } : { stage: "downloading", stageLabel: "Downloading", fraction },
    current,
    total,
    bytesDone,
    bytesTotal,
    currentItem: totals[6]?.trim() || void 0,
    cancellable: false
  };
};
const FILE_WEIGHT = 128 * 1024;
function workDone(bytesDone, bytesTotal, current, total) {
  const all = bytesTotal + total * FILE_WEIGHT;
  if (!all) return null;
  return Math.min(1, (Math.min(bytesDone, bytesTotal) + Math.min(current, total) * FILE_WEIGHT) / all);
}
const PROGRESS = "--forcedetailedprogress";
const UPDATE_ARGS = ["update", PROGRESS, "--noinput", "--dontmerge"];
function switchArgs(targetSpec) {
  return ["switch", targetSpec, PROGRESS, "--noinput"];
}
async function updateWithMerge(cm2, workspacePath, resolutions, backupsRoot, context) {
  const { conflicts, blockedPaths } = await readIncomingChanges(cm2, workspacePath);
  if (blockedPaths.length > 0) throw new Error(`Check in, shelve or undo your changes to ${blockedPaths.join(", ")} first: the branch deleted or moved them.`);
  const update = () => cm2.execute(UPDATE_ARGS, { cwd: workspacePath, signal: context.signal, onOutputLine: context.progressOf(readUpdateProgress) });
  if (conflicts.length === 0) {
    await update();
    return { backupDirectory: null };
  }
  const unresolved = unresolvedConflicts(conflicts, resolutions);
  if (unresolved.length > 0) throw new Error(`Resolve ${unresolved.map((conflict) => conflict.path).join(", ")} before updating.`);
  const backupDirectory = node_path.join(backupsRoot, (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-"));
  const checkedOutPaths = await readCheckedOutPaths(cm2, workspacePath);
  const absolute = (conflict) => toAbsolutePath(workspacePath, conflict.path);
  const backup = (conflict) => toAbsolutePath(backupDirectory, conflict.path);
  context.reportProgress("Saving your local versions");
  for (const conflict of conflicts) await copyInto(absolute(conflict), backup(conflict));
  await cm2.query(["undo", ...conflicts.map(absolute)], { cwd: workspacePath });
  try {
    await update();
  } catch (error) {
    await waitForNextSecond();
    for (const conflict of conflicts) await copyInto(backup(conflict), absolute(conflict));
    throw new Error(`${error instanceof Error ? error.message : String(error)} Your local changes were put back; nothing was lost.`);
  }
  context.reportProgress("Writing resolved files");
  await waitForNextSecond();
  for (const conflict of conflicts) {
    const resolution = resolutions[conflict.path];
    if (resolution.choice === "text") await retryWhileBusy(() => promises.writeFile(absolute(conflict), resolution.text, "utf8"));
    else if (resolution.choice === "destination") await copyInto(backup(conflict), absolute(conflict));
  }
  const toCheckOut = conflicts.filter((conflict) => checkedOutPaths.has(conflict.path)).map(absolute);
  if (toCheckOut.length > 0) await cm2.query(["checkout", ...toCheckOut], { cwd: workspacePath });
  return { backupDirectory };
}
function unresolvedConflicts(conflicts, resolutions) {
  return conflicts.filter((conflict) => !resolutions?.[conflict.path]);
}
async function readCheckedOutPaths(cm2, workspacePath) {
  const xml = await cm2.query(["status", "--xml", "--checkout"], { cwd: workspacePath });
  return new Set(parsePendingChanges(xml).changes.map((change) => change.path));
}
async function copyInto(source, target) {
  await promises.mkdir(node_path.dirname(target), { recursive: true });
  const content = await promises.readFile(source);
  await retryWhileBusy(() => promises.writeFile(target, content));
}
async function shelveBlockedAndUpdate(deps, workspacePath, resolutions, context) {
  const { cm: cm2, records } = deps;
  const incoming = await readIncomingChanges(cm2, workspacePath);
  if (incoming.blockedPaths.length === 0) throw new Error("Nothing blocks the update anymore: update from Incoming.");
  const workspace = await readWorkspaceIdentity(cm2, workspacePath);
  const objectRef = await selectorObjectRef(cm2, workspacePath, workspace.selector);
  if (!objectRef) throw new Error(`Couldn't find ${describeSelector(workspace.selector)} in the repository, so nothing was shelved.`);
  const snapshot = parsePendingChanges(await cm2.query(SWITCH_STATUS_ARGS, { cwd: workspacePath }));
  const blocked = new Set(incoming.blockedPaths);
  const changes = snapshot.changes.filter((change) => blocked.has(change.path));
  context.beginStep("Shelving the blocking files", 1, 2);
  const shelve = await createSwitchShelve(cm2, workspacePath, changes, objectRef, context, incoming.blockedPaths);
  const record = {
    workspaceGuid: workspace.guid,
    shelveId: shelve.id,
    repository: workspace.repository,
    source: { spec: selectorSpec(workspace.selector), name: describeSelector(workspace.selector), objectRef },
    target: { spec: "", name: "" },
    mode: "leave",
    reason: "update",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    paths: changedPaths(changes),
    changelists: shelvedChangelists({ ...snapshot, changes })
  };
  records.save(record);
  const result = { shelveId: shelve.id, count: record.paths.length };
  try {
    await cm2.query(onLinksThemselves("undo", ...incoming.blockedPaths.map((path) => toAbsolutePath(workspacePath, path))), { cwd: workspacePath });
    if (unresolvedConflicts(incoming.conflicts, resolutions).length > 0) return { ...result, updated: false, backupDirectory: null };
    context.beginStep("Updating", 2, 2);
    if (incoming.conflicts.length > 0) return { ...result, updated: true, ...await updateWithMerge(cm2, workspacePath, resolutions, deps.backupsRoot, context) };
    await cm2.execute(UPDATE_ARGS, { cwd: workspacePath, onOutputLine: context.progressOf(readUpdateProgress) });
    return { ...result, updated: true, backupDirectory: null };
  } catch (error) {
    throw await putBack(deps, workspacePath, record, error, context);
  }
}
async function putBack(deps, workspacePath, record, cause, context) {
  const reason = (cause instanceof Error ? cause.message : String(cause)).replace(/\.$/, "");
  try {
    const outcome = await applyShelveCleanly(deps.cm, workspacePath, record.shelveId, context);
    if (outcome.kind === "applied") {
      await deps.leftChanges.finish(workspacePath, record);
      return new Error(`Couldn't update: ${reason}. Your changes were put back.`);
    }
  } catch {
  }
  return new Error(`Couldn't update: ${reason}. Your changes are safe in shelve ${record.shelveId}; restore them from Changes.`);
}
function createMergeService({ cm: cm2, operations }, { switchShelves, leftChanges }) {
  const backupsRoot = node_path.join(electron.app.getPath("userData"), "update-backups");
  return {
    preview: (workspacePath, request) => previewMerge(cm2, workspacePath, request),
    run: (workspacePath, request, resolutions, operationId) => operations.run(operationId, async (context) => {
      const result = await runMerge(cm2, workspacePath, request, resolutions, context);
      const shelve = /^sh:(\d+)$/.exec(request.sourceSpec);
      if (shelve && !request.destinationBranch) await leftChanges.finishAppliedShelve(workspacePath, Number(shelve[1]), request.deleteShelve === true);
      return result;
    }),
    mergedInto: (workspacePath, sourceChangeset, destinationBranch) => findMergedInto(cm2, workspacePath, sourceChangeset, destinationBranch),
    incomingSummary: (workspacePath, loaded) => readIncomingSummary(cm2, workspacePath, loaded),
    incomingChanges: (workspacePath) => readIncomingChanges(cm2, workspacePath),
    updateResolvingConflicts: (workspacePath, resolutions, operationId) => operations.run(operationId, (context) => updateWithMerge(cm2, workspacePath, resolutions, backupsRoot, context)),
    shelveBlockedAndUpdate: (workspacePath, resolutions, operationId) => operations.run(
      operationId,
      (context) => shelveBlockedAndUpdate({ cm: cm2, records: switchShelves, leftChanges, backupsRoot }, workspacePath, resolutions, context)
    )
  };
}
function appExecutable(picked, fs) {
  if (!/\.app\/?$/.test(picked)) return picked;
  const bundle = picked.replace(/\/$/, "");
  const programs = node_path.posix.join(bundle, "Contents", "MacOS");
  const declared = /<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/.exec(fs.read(node_path.posix.join(bundle, "Contents", "Info.plist")) ?? "")?.[1];
  const named = bundle.split("/").pop().replace(/\.app$/, "");
  const candidates = [declared, named, ...fs.list(programs)].filter((name) => Boolean(name)).map((name) => node_path.posix.join(programs, name));
  return candidates.find((candidate) => fs.exists(candidate)) ?? picked;
}
const PLACEHOLDER = /\{(base|yours|incoming|result|baseName|yoursName|incomingName|fileName)\}/g;
function fillArgs(template, files) {
  return template.map((arg) => arg.replace(PLACEHOLDER, (_match, name) => files[name]));
}
function detectKnownTools(tools, where, fs) {
  return tools.flatMap((tool) => {
    if (tool.requires && !tool.requires(where).some((path) => fs.exists(path))) return [];
    const executable = findFirst(tool.locations(where), where, fs) ?? findOnPath(tool.commands[where.platform] ?? [], where, fs);
    return executable ? [{ tool, executable }] : [];
  });
}
function locateProgram(program, where, fs) {
  if (/[\\/]/.test(program)) return fs.exists(program) ? program : void 0;
  const names = where.platform === "win32" && !/\.\w+$/.test(program) ? [`${program}.exe`, `${program}.cmd`] : [program];
  return findOnPath(names, where, fs);
}
function findFirst(candidates, where, fs) {
  for (const candidate of candidates) {
    const found = candidate.includes("*") ? expandWildcard(candidate, where, fs) : fs.exists(candidate) && candidate;
    if (found) return found;
  }
  return void 0;
}
function expandWildcard(candidate, where, fs) {
  const path = pathFor(where);
  const parts = candidate.split(path.sep);
  const index = parts.findIndex((part) => part.includes("*"));
  const parent = parts.slice(0, index).join(path.sep);
  const [prefix, suffix] = parts[index].split("*");
  const matches = fs.list(parent).filter((name) => name.startsWith(prefix) && name.endsWith(suffix)).sort((a, b) => b.localeCompare(a, void 0, { numeric: true }));
  return matches.map((name) => [parent, name, ...parts.slice(index + 1)].join(path.sep)).find((match) => fs.exists(match));
}
function findOnPath(names, where, fs) {
  const path = pathFor(where);
  const folders = pathFolders(where.env, where.platform);
  for (const name of names) {
    const found = folders.map((folder) => path.join(folder, name)).find((candidate) => fs.exists(candidate));
    if (found) return found;
  }
  return void 0;
}
function pathFor(where) {
  return where.platform === "win32" ? node_path.win32 : node_path.posix;
}
const UVCS_SIDES = ["-b={base}", "-bn={baseName}", "-s={incoming}", "-sn={incomingName}", "-d={yours}", "-dn={yoursName}", "-r={result}"];
const VSCODE_ARGS = ["--wait", "--merge", "{incoming}", "{yours}", "{base}", "{result}"];
const JETBRAINS_ARGS = ["merge", "{yours}", "{incoming}", "{base}", "{result}"];
const macApps = (where, bundlePath) => ["/Applications", node_path.posix.join(where.home, "Applications")].map((folder) => node_path.posix.join(folder, bundlePath));
const programFiles = (where, path) => [where.env.ProgramFiles ?? "C:\\Program Files", where.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"].map((folder) => node_path.win32.join(folder, path));
const localPrograms = (where, path) => where.env.LOCALAPPDATA ? [node_path.win32.join(where.env.LOCALAPPDATA, "Programs", path)] : [];
function vscodeLike(id, name, app, command, windowsFolder, windowsBin = "bin") {
  return {
    id,
    name,
    args: VSCODE_ARGS,
    locations: (where) => {
      if (where.platform === "darwin") return macApps(where, `${app}.app/Contents/Resources/app/bin/${command}`);
      if (where.platform === "win32") {
        const launcher = `${windowsFolder}\\${windowsBin}\\${command}.cmd`;
        return [...localPrograms(where, launcher), ...programFiles(where, launcher)];
      }
      return [`/usr/share/${command}/bin/${command}`, `/snap/bin/${command}`];
    },
    commands: { darwin: [command], linux: [command], win32: [`${command}.cmd`] }
  };
}
function jetbrains(id, name, apps, command, windowsFolder) {
  return {
    id,
    name,
    args: JETBRAINS_ARGS,
    locations: (where) => {
      if (where.platform === "darwin") return apps.flatMap((app) => macApps(where, `${app}.app/Contents/MacOS/${command}`));
      if (where.platform === "win32") {
        return [
          ...programFiles(where, `JetBrains\\${windowsFolder} *\\bin\\${command}64.exe`),
          ...localPrograms(where, `${windowsFolder}\\bin\\${command}64.exe`),
          ...where.env.LOCALAPPDATA ? [node_path.win32.join(where.env.LOCALAPPDATA, "JetBrains", "Toolbox", "scripts", `${command}.cmd`)] : []
        ];
      }
      return [node_path.posix.join(where.home, ".local/share/JetBrains/Toolbox/scripts", command)];
    },
    commands: { darwin: [command], linux: [command, `${command}.sh`] }
  };
}
const UVCS_TOOL_ID = "uvcs";
const KNOWN_TOOLS = [
  {
    id: UVCS_TOOL_ID,
    name: "UVCS merge tool",
    args: ["xmerge", ...UVCS_SIDES],
    locations: (where) => {
      if (where.platform === "darwin") return macApps(where, "PlasticSCM.app/Contents/MacOS/macplasticx");
      if (where.platform === "win32") {
        return [
          node_path.win32.join(node_path.win32.dirname(where.cmPath), "plastic.exe"),
          ...programFiles(where, "PlasticSCM5\\client\\plastic.exe"),
          ...programFiles(where, "Unity VCS\\client\\plastic.exe")
        ];
      }
      return [node_path.posix.join(node_path.posix.dirname(where.cmPath), "plasticgui"), node_path.posix.join(node_path.posix.dirname(where.cmPath), "linplasticx"), "/opt/plasticscm5/client/linplasticx"];
    },
    commands: { darwin: ["plasticgui"], linux: ["plasticgui"], win32: ["plastic.exe"] }
  },
  vscodeLike("vscode", "Visual Studio Code", "Visual Studio Code", "code", "Microsoft VS Code"),
  vscodeLike("vscodeInsiders", "VS Code Insiders", "Visual Studio Code - Insiders", "code-insiders", "Microsoft VS Code Insiders"),
  vscodeLike("cursor", "Cursor", "Cursor", "cursor", "cursor", "resources\\app\\bin"),
  vscodeLike("windsurf", "Windsurf", "Windsurf", "windsurf", "Windsurf"),
  jetbrains("rider", "JetBrains Rider", ["Rider"], "rider", "JetBrains Rider"),
  jetbrains("intellij", "IntelliJ IDEA", ["IntelliJ IDEA", "IntelliJ IDEA Ultimate", "IntelliJ IDEA CE"], "idea", "IntelliJ IDEA"),
  jetbrains("webstorm", "WebStorm", ["WebStorm"], "webstorm", "WebStorm"),
  jetbrains("pycharm", "PyCharm", ["PyCharm", "PyCharm Professional Edition", "PyCharm CE"], "pycharm", "PyCharm"),
  jetbrains("clion", "CLion", ["CLion"], "clion", "CLion"),
  jetbrains("goland", "GoLand", ["GoLand"], "goland", "GoLand"),
  {
    id: "smerge",
    name: "Sublime Merge",
    args: ["mergetool", "{base}", "{yours}", "{incoming}", "-o", "{result}"],
    locations: (where) => {
      if (where.platform === "darwin") return macApps(where, "Sublime Merge.app/Contents/SharedSupport/bin/smerge");
      if (where.platform === "win32") return programFiles(where, "Sublime Merge\\smerge.exe");
      return ["/opt/sublime_merge/sublime_merge"];
    },
    commands: { darwin: ["smerge"], linux: ["smerge"], win32: ["smerge.exe"] }
  },
  {
    id: "kdiff3",
    name: "KDiff3",
    args: ["{base}", "{yours}", "{incoming}", "-o", "{result}", "--L1", "{baseName}", "--L2", "{yoursName}", "--L3", "{incomingName}"],
    locations: (where) => {
      if (where.platform === "darwin") return macApps(where, "kdiff3.app/Contents/MacOS/kdiff3");
      if (where.platform === "win32") return [...programFiles(where, "KDiff3\\bin\\kdiff3.exe"), ...programFiles(where, "KDiff3\\kdiff3.exe")];
      return [];
    },
    commands: { darwin: ["kdiff3"], linux: ["kdiff3"], win32: ["kdiff3.exe"] }
  },
  {
    id: "bcompare",
    name: "Beyond Compare",
    args: ["{yours}", "{incoming}", "{base}", "{result}"],
    locations: (where) => {
      if (where.platform === "darwin") return macApps(where, "Beyond Compare.app/Contents/MacOS/bcomp");
      if (where.platform === "win32") return [...programFiles(where, "Beyond Compare 5\\BComp.exe"), ...programFiles(where, "Beyond Compare 4\\BComp.exe")];
      return [];
    },
    commands: { darwin: ["bcomp"], linux: ["bcompare", "bcomp"], win32: ["BComp.exe"] }
  },
  {
    // Windows only. Git's `mergetools/winmerge`: yours, base and incoming side by side, yours and incoming read-only,
    // the automatic merge in the middle, saved to the output.
    id: "winmerge",
    name: "WinMerge",
    args: ["-u", "-e", "-wl", "-wr", "-am", "-dl", "{yoursName}", "-dm", "{baseName}", "-dr", "{incomingName}", "{yours}", "{base}", "{incoming}", "-o", "{result}"],
    locations: (where) => where.platform === "win32" ? [...programFiles(where, "WinMerge\\WinMergeU.exe"), ...localPrograms(where, "WinMerge\\WinMergeU.exe")] : [],
    commands: { win32: ["WinMergeU.exe"] }
  },
  {
    // As Git's `mergetools/meld` without `--auto-merge`: the middle pane is the result file itself, so it starts from
    // the app's merge (and the picks made in the app) instead of the base, and saving writes it.
    id: "meld",
    name: "Meld",
    args: ["--output={result}", "{yours}", "{result}", "{incoming}"],
    locations: (where) => {
      if (where.platform === "darwin") return macApps(where, "Meld.app/Contents/MacOS/Meld");
      if (where.platform === "win32") return programFiles(where, "Meld\\Meld.exe");
      return [];
    },
    commands: { darwin: ["meld"], linux: ["meld"], win32: ["Meld.exe"] }
  },
  {
    id: "p4merge",
    name: "P4Merge",
    args: ["{base}", "{incoming}", "{yours}", "{result}"],
    locations: (where) => {
      if (where.platform === "darwin") return macApps(where, "p4merge.app/Contents/MacOS/p4merge");
      if (where.platform === "win32") return programFiles(where, "Perforce\\p4merge.exe");
      return [];
    },
    commands: { darwin: ["p4merge"], linux: ["p4merge"], win32: ["p4merge.exe"] }
  },
  {
    id: "araxis",
    name: "Araxis Merge",
    args: ["-wait", "-merge", "-3", "-a1", "{base}", "{yours}", "{incoming}", "{result}"],
    locations: (where) => {
      if (where.platform === "darwin") return macApps(where, "Araxis Merge.app/Contents/Utilities/compare");
      if (where.platform === "win32") return programFiles(where, "Araxis\\Araxis Merge\\compare.exe");
      return [];
    },
    commands: {}
  },
  {
    // `opendiff` returns at once unless its output is a pipe, which it is for the app (Git pipes it to `cat`).
    id: "opendiff",
    name: "FileMerge",
    args: ["{yours}", "{incoming}", "-ancestor", "{base}", "-merge", "{result}"],
    locations: (where) => where.platform === "darwin" ? ["/usr/bin/opendiff"] : [],
    commands: {},
    requires: (where) => macApps(where, "Xcode.app/Contents/Applications/FileMerge.app")
  }
];
function launchMergeTool(executable, args, signal) {
  const { command, commandArgs, verbatim } = commandLine(process.platform, executable, args);
  const started = Date.now();
  const ran = (exitCode, errorOutput) => ({ exitCode, errorOutput: errorOutput.trim(), seconds: (Date.now() - started) / 1e3 });
  return new Promise((resolve, reject) => {
    const child2 = node_child_process.spawn(command, commandArgs, { stdio: ["ignore", "pipe", "pipe"], windowsVerbatimArguments: verbatim, signal, killSignal: "SIGTERM" });
    let errorOutput = "";
    child2.stdout.resume();
    child2.stderr.on("data", (chunk) => errorOutput = (errorOutput + chunk.toString()).slice(-2e3));
    child2.once("error", (error) => {
      if (error.name === "AbortError") return;
      reject(new Error(`Couldn't start ${executable}: ${error.code === "ENOENT" ? "it is not there anymore" : error.message}`));
    });
    child2.once("close", (exitCode) => resolve(ran(exitCode, errorOutput)));
    child2.once("exit", () => {
      if (!signal.aborted) return;
      child2.stdout.destroy();
      child2.stderr.destroy();
      resolve(ran(null, errorOutput));
    });
  });
}
function activateApp(bundle) {
  return new Promise((resolve, reject) => {
    const child2 = node_child_process.spawn("open", ["-a", bundle], { stdio: "ignore" });
    child2.once("error", reject);
    child2.once("close", () => resolve());
  });
}
function commandLine(platform, executable, args) {
  if (platform !== "win32" || !/\.(cmd|bat)$/i.test(executable)) return { command: executable, commandArgs: args, verbatim: false };
  const quote = (arg) => `"${arg.replace(/["%!]/g, "").replace(/(\\+)$/, "$1$1")}"`;
  return { command: "cmd.exe", commandArgs: ["/d", "/s", "/c", `"${[executable, ...args].map(quote).join(" ")}"`], verbatim: true };
}
const AUTO_MERGE_TOOL = "auto";
function parseArgs(line) {
  const args = [];
  let current = "";
  let started = false;
  let quote = null;
  for (const char of line) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) args.push(current);
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (started) args.push(current);
  return args;
}
function mergeToolList(sources) {
  const withArgs = (tool) => ({
    ...tool,
    args: sources.argsOverrides[tool.id] ?? tool.defaultArgs,
    canBringToFront: sources.platform === "darwin" && appBundleOf(tool.executable) !== null
  });
  const known = sources.detected.map(
    ({ tool, executable }) => withArgs({ id: tool.id, name: tool.name, origin: "known", executable, defaultArgs: tool.args, extensions: null })
  );
  const [uvcs, others] = [known.filter((tool) => tool.id === UVCS_TOOL_ID), known.filter((tool) => tool.id !== UVCS_TOOL_ID)];
  const fromClientConf = sources.clientConf.map(
    (tool, index) => withArgs({
      id: `clientConf:${index}`,
      name: `${programName(tool.executable)} (client.conf${tool.extensions ? `, ${tool.extensions.join(" ")}` : ""})`,
      origin: "clientConf",
      executable: tool.found,
      defaultArgs: tool.args,
      extensions: tool.extensions
    })
  );
  const custom = sources.custom.map(
    (tool) => withArgs({ id: tool.id, name: tool.name, origin: "custom", executable: tool.executable, defaultArgs: tool.args, extensions: null })
  );
  const tools = [...uvcs, ...fromClientConf, ...others, ...custom];
  return { tools, preferredId: preferredTool(tools, sources.preference) };
}
function preferredTool(tools, preference) {
  if (preference !== AUTO_MERGE_TOOL && tools.some((tool) => tool.id === preference)) return preference;
  return (tools.find((tool) => tool.id === UVCS_TOOL_ID) ?? tools.find((tool) => tool.extensions === null))?.id ?? null;
}
function appBundleOf(executable) {
  const match = /^(.*?\.app)\//.exec(executable);
  return match ? match[1] : null;
}
function programName(executable) {
  return executable.split(/[\\/]/).pop().replace(/\.(exe|cmd|bat)$/i, "");
}
function toolFileNames(path) {
  const name = path.split(/[\\/]/).pop().replace(/[^\w .-]/g, "_") || "file";
  const dot = name.lastIndexOf(".");
  const [stem, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  return { base: `${stem}.BASE${extension}`, yours: `${stem}.YOURS${extension}`, incoming: `${stem}.INCOMING${extension}`, result: name };
}
const FAILED_TO_OPEN_SECONDS = 3;
function judgeToolResult(files, run) {
  const { start: start2, result } = files;
  if (!result || result.equals(start2)) {
    const failedToOpen = run.exitCode !== null && run.exitCode !== 0 && run.errorOutput && run.seconds < FAILED_TO_OPEN_SECONDS;
    return failedToOpen ? { kind: "failed", message: lastLine(run.errorOutput) } : { kind: "unchanged", exitCode: run.exitCode, errorOutput: run.errorOutput };
  }
  return { kind: "resolved", text: result.toString("utf8") };
}
function lastLine(text2) {
  return text2.split("\n").filter((line) => line.trim()).at(-1).trim();
}
const PLASTIC_TOOLS = /* @__PURE__ */ new Set(["mergetool", "macmergetool", "gtkmergetool", "binmergetool", "semanticmergetool", "semanticmerge", "plasticgui", "plastic", "macplastic", "macplasticx"]);
const CM_VARIABLES = {
  basefile: "{base}",
  sourcefile: "{incoming}",
  destinationfile: "{yours}",
  output: "{result}",
  basesymbolic: "{baseName}",
  sourcesymbolic: "{incomingName}",
  destinationsymbolic: "{yoursName}",
  basehash: "",
  sourcehash: "",
  destinationhash: "",
  filetype: "text",
  comparationmethod: "",
  fileencoding: "NONE",
  resultencoding: "NONE",
  mergetype: "forced",
  progress: "",
  extrainfofile: ""
};
const CM_VARIABLE = new RegExp(`@(${Object.keys(CM_VARIABLES).sort((a, b) => b.length - a.length).join("|")})`, "g");
function readClientConfMergeTools(xml) {
  if (!xml.includes("<MergeTools>")) return [];
  const root = child(parseXml(xml, ["MergeToolData", "string"]), "ClientConfigData");
  return children(child(root, "MergeTools"), "MergeToolData").flatMap((entry) => {
    const fileType = text(entry.FileType);
    if (fileType === "enBinaryFile") return [];
    const command = children(child(entry, "Tools"), "string").map(text).filter(Boolean).at(-1);
    const [executable, ...args] = parseArgs(command ?? "");
    if (!executable || isPlasticTool(executable)) return [];
    return [{ executable, args: args.map(toAppPlaceholders), extensions: parseExtensions(text(entry.FileExtensions)) }];
  });
}
function isPlasticTool(executable) {
  const name = executable.split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, "");
  return PLASTIC_TOOLS.has(name);
}
function toAppPlaceholders(arg) {
  return arg.replace(CM_VARIABLE, (_match, name) => CM_VARIABLES[name]);
}
function parseExtensions(value) {
  const extensions = value.split(/[;,]/).map((extension) => extension.trim().toLowerCase()).filter(Boolean);
  return extensions.length === 0 || extensions.includes("*") ? null : extensions;
}
const fileSystem = {
  exists: (path) => {
    try {
      return node_fs.statSync(path).isFile() || path.endsWith(".app");
    } catch {
      return false;
    }
  },
  list: (folder) => {
    try {
      return node_fs.readdirSync(folder);
    } catch {
      return [];
    }
  },
  read: (path) => {
    try {
      return node_fs.readFileSync(path, "utf8");
    } catch {
      return null;
    }
  }
};
function createMergeToolsService({ cm: cm2, settings: settings2 }) {
  const open = /* @__PURE__ */ new Map();
  function list() {
    const where = { platform: process.platform, env: process.env, home: node_os.homedir(), cmPath: cm2.executable };
    const { mergeTool, customMergeTools, mergeToolArgs } = settings2.get();
    const clientConf = readClientConfMergeTools(fileSystem.read(plasticConfigFile("client.conf")) ?? "").flatMap((tool) => {
      const found = locateProgram(tool.executable, where, fileSystem);
      return found ? [{ ...tool, found }] : [];
    });
    return mergeToolList({
      detected: detectKnownTools(KNOWN_TOOLS, where, fileSystem),
      clientConf,
      custom: customMergeTools,
      argsOverrides: mergeToolArgs,
      preference: mergeTool,
      platform: process.platform
    });
  }
  async function resolve(workspacePath, request) {
    const tool = list().tools.find((candidate) => candidate.id === request.toolId);
    if (!tool) return { kind: "failed", message: "That merge tool isn't installed anymore." };
    const stop = new AbortController();
    open.set(request.sessionId, { stop, bundle: tool.canBringToFront ? appBundleOf(tool.executable) : null });
    try {
      return await withTempDirectory(async (directory) => {
        const names = toolFileNames(request.path);
        const file = (name) => node_path.join(directory, name);
        await save(workspacePath, request.base, file(names.base));
        await save(workspacePath, request.yours, file(names.yours));
        await save(workspacePath, request.incoming, file(names.incoming));
        await promises.writeFile(file(names.result), request.startText, "utf8");
        const start2 = await promises.readFile(file(names.result));
        const run = await launchMergeTool(
          tool.executable,
          fillArgs(tool.args, {
            base: file(names.base),
            yours: file(names.yours),
            incoming: file(names.incoming),
            result: file(names.result),
            baseName: request.names.base,
            yoursName: request.names.yours,
            incomingName: request.names.incoming,
            fileName: names.result
          }),
          stop.signal
        );
        return judgeToolResult({ start: start2, result: await readIfThere(file(names.result)) }, run);
      });
    } catch (error) {
      return { kind: "failed", message: error instanceof Error ? error.message : String(error) };
    } finally {
      open.delete(request.sessionId);
    }
  }
  function save(workspacePath, source, target) {
    if (source.kind === "reviewSnapshot") throw new Error("A review snapshot is not a version to merge.");
    return saveContent(cm2, workspacePath, source, target);
  }
  return {
    list: async () => list(),
    resolve,
    stopWaiting: async (sessionId) => open.get(sessionId)?.stop.abort(),
    bringToFront: async (sessionId) => {
      const bundle = open.get(sessionId)?.bundle;
      if (bundle) await activateApp(bundle);
    },
    pickProgram: async () => {
      const result = await electron.dialog.showOpenDialog({
        title: "Choose a merge app",
        defaultPath: process.platform === "darwin" ? "/Applications" : void 0,
        properties: ["openFile"]
      });
      const picked = result.canceled ? void 0 : result.filePaths[0];
      return picked ? appExecutable(picked, fileSystem) : null;
    }
  };
}
async function readIfThere(path) {
  return node_fs.existsSync(path) ? promises.readFile(path) : null;
}
function checkinArgs(paths, commentsFile) {
  return onLinksThemselves("checkin", ...paths, "--all", "--private", `-commentsfile=${commentsFile}`, "--machinereadable");
}
const CREATED_CHANGESET_LINE = /^CHANGESET cs:(\d+)@br:([^@]+)@/m;
const NO_CHANGES_LINE = /^NO_CHANGES_APPLIED$/m;
function readCheckinOutput(output) {
  const created = CREATED_CHANGESET_LINE.exec(output);
  if (created) return { kind: "created", changesetId: Number(created[1]), branch: created[2] };
  if (NO_CHANGES_LINE.test(output)) return { kind: "noChanges" };
  throw new Error("The checkin finished but no changeset was reported.");
}
const LOCKED_ITEMS_HEADER = "These items are exclusively checked out by:";
const LOCKED_ITEM_LINE = /^(.+?) \(wk:(.*) owner:(.*)\)$/;
function parseLockedItems(message) {
  const start2 = message.indexOf(LOCKED_ITEMS_HEADER);
  if (start2 < 0) return null;
  const items = message.slice(start2 + LOCKED_ITEMS_HEADER.length).split(/\r?\n/).map((line) => LOCKED_ITEM_LINE.exec(line.trim())).filter((match) => match !== null).map(([, path, workspace, owner]) => ({ path, workspace, owner }));
  return items.length > 0 ? items : null;
}
function describeLockedItems(items, action) {
  if (items.length === 1) {
    const [{ path, workspace, owner }] = items;
    return `${fileName(path)} is locked by ${owner} (workspace ${workspace}), so it can't be ${action} until the lock is released.`;
  }
  const lines = items.map(({ path, owner }) => `${path} — ${owner}`);
  return [`${items.length} items are locked by others, so they can't be ${action} until the locks are released:`, ...lines].join("\n");
}
async function explainLockedItems(action, work) {
  try {
    return await work();
  } catch (error) {
    const items = error instanceof CmError ? parseLockedItems(error.message) : null;
    if (!items || !(error instanceof CmError)) throw error;
    throw error.withMessage(describeLockedItems(items, action));
  }
}
function fileName(path) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}
const STAGE = /^STAGE ?(.*)$/;
const UPLOADED = /([\d.,]+) (\S+)\/([\d.,]+) (\S+)$/;
const readCheckinProgress = (previous, line) => {
  if (line === "CI_START") return { stage: "preparing", stageLabel: "Preparing", fraction: null, cancellable: true };
  const stage = STAGE.exec(line);
  if (!stage) return previous;
  const text2 = stage[1].trim();
  if (!text2) return { ...previous, stage: "finishing", stageLabel: "Finishing", fraction: null, cancellable: false };
  const uploaded = UPLOADED.exec(text2);
  if (uploaded) {
    const bytesDone = parseSize(uploaded[1], uploaded[2]) ?? 0;
    const bytesTotal = parseSize(uploaded[3], uploaded[4]) ?? 0;
    return { stage: "uploading", stageLabel: "Uploading", bytesDone, bytesTotal, fraction: bytesTotal ? Math.min(1, bytesDone / bytesTotal) : 1, cancellable: true };
  }
  if (previous?.bytesTotal !== void 0) return confirming(previous);
  return { stage: "preparing", stageLabel: "Preparing", fraction: null, cancellable: true };
};
function confirming(previous) {
  return { ...previous, stage: "confirming", stageLabel: "Confirming", bytesDone: previous.bytesTotal, fraction: null, cancellable: false };
}
function withRule(rules, pattern) {
  const eol = rules.includes("\r\n") ? "\r\n" : "\n";
  const separator = rules === "" || rules.endsWith("\n") ? "" : eol;
  return `${rules}${separator}${pattern}${eol}`;
}
const IN_MERGE$1 = "A merge in progress can't be shelved away. Check it in or undo it first, or shelve and keep the changes.";
async function shelveAndUndo(deps, workspacePath, paths, comment, context) {
  const { cm: cm2, records } = deps;
  const snapshot = parsePendingChanges(await cm2.query(SWITCH_STATUS_ARGS, { cwd: workspacePath }));
  const changes = shelvedAwayChanges(snapshot.changes, paths);
  if (changes.some((change) => change.mergeInfo)) throw new Error(IN_MERGE$1);
  const workspace = await readWorkspaceIdentity(cm2, workspacePath);
  context.beginStep("Shelving your changes", 1, 2);
  const shelve = await createVerifiedShelve(cm2, workspacePath, changes, comment, context, paths ?? void 0);
  const record = {
    workspaceGuid: workspace.guid,
    shelveId: shelve.id,
    repository: workspace.repository,
    source: { spec: selectorSpec(workspace.selector), name: describeSelector(workspace.selector), objectRef: "" },
    target: { spec: "", name: "" },
    mode: "leave",
    reason: "shelve",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    paths: changedPaths(changes),
    changelists: shelvedChangelists({ ...snapshot, changes })
  };
  records.save(record);
  try {
    context.beginStep("Undoing them here", 2, 2);
    const targets = paths ? paths.map((path) => toAbsolutePath(workspacePath, path)) : ["-r", workspacePath];
    await cm2.execute(onLinksThemselves("undo", ...targets), { cwd: workspacePath });
    await moveNewItemsAside(cm2, records, workspacePath, changes, record, deps.backupsRoot);
  } catch (error) {
    throw await putBackAfterFailure(deps, workspacePath, record, error, context);
  }
  return { shelveId: shelve.id, count: record.paths.length };
}
function shelvedAwayChanges(changes, paths) {
  if (!paths) return changes;
  const shelved = new Set(paths);
  return changes.filter((change) => shelved.has(change.path));
}
async function putBackAfterFailure(deps, workspacePath, record, cause, context) {
  const reason = (cause instanceof Error ? cause.message : String(cause)).replace(/\.$/, "");
  try {
    if (record.backup) await putBack$1(workspacePath, record.backup);
    const outcome = await applyShelveCleanly(deps.cm, workspacePath, record.shelveId, context);
    if (outcome.kind === "applied") {
      await deps.leftChanges.finish(workspacePath, record);
      return new Error(`Couldn't undo the shelved changes: ${reason}. Your changes were put back.`);
    }
  } catch {
  }
  return new Error(`Couldn't undo the shelved changes: ${reason}. Shelve ${record.shelveId} holds them all.`);
}
const FILTER_RULE_FILES = {
  ignore: "ignore.conf",
  cloaked: "cloaked.conf",
  hidden: "hidden_changes.conf"
};
const DEFAULT_CHANGELIST = "Default";
const CREATED_SHELVE = /sh:(\d+)/;
function createPendingChangesService({ cm: cm2, operations }, { switchShelves, leftChanges }) {
  const shelveAwayDependencies = { cm: cm2, records: switchShelves, leftChanges, backupsRoot: node_path.join(electron.app.getPath("userData"), "shelve-backups") };
  async function list(workspacePath, filter) {
    const xml = await cm2.query(["status", "--xml", "--iscochanged", "--changelists", ...searchTypes(filter)], {
      cwd: workspacePath
    });
    return parsePendingChanges(xml);
  }
  function checkin(workspacePath, request, operationId) {
    return operations.run(
      operationId,
      ({ signal, progressOf }) => withTempFile(request.comment, async (commentsFile) => {
        const output = await explainLockedItems(
          "checked in",
          () => cm2.execute(checkinArgs(absolutePaths(workspacePath, request.paths), commentsFile), {
            cwd: workspacePath,
            signal,
            onOutputLine: progressOf(readCheckinProgress)
          })
        );
        return readCheckinOutput(output);
      })
    );
  }
  async function undo(workspacePath, paths) {
    await cm2.query(onLinksThemselves("undo", ...absolutePaths(workspacePath, paths)), { cwd: workspacePath });
  }
  async function undoUnchanged(workspacePath, paths) {
    const targets = paths ? absolutePaths(workspacePath, paths) : ["-r", workspacePath];
    await cm2.query(["undo", "--unchanged", ...targets], { cwd: workspacePath });
  }
  async function add(workspacePath, paths) {
    await cm2.query(["add", "--coparent", ...absolutePaths(workspacePath, paths)], { cwd: workspacePath });
  }
  async function remove(workspacePath, paths) {
    await cm2.query(["remove", ...absolutePaths(workspacePath, paths)], { cwd: workspacePath });
  }
  async function checkout(workspacePath, paths) {
    await explainLockedItems("checked out", () => cm2.query(onLinksThemselves("checkout", ...absolutePaths(workspacePath, paths)), { cwd: workspacePath }));
  }
  async function addFilterRule(workspacePath, list2, pattern) {
    const rulesFile = node_path.join(workspacePath, FILTER_RULE_FILES[list2]);
    const current = await promises.readFile(rulesFile, "utf8").catch(() => "");
    await promises.writeFile(rulesFile, withRule(current, pattern), "utf8");
  }
  function shelve(workspacePath, paths, comment, operationId) {
    return operations.run(operationId, ({ reportProgress }) => withTempFile(comment, async (commentsFile) => {
      reportProgress("Uploading your changes");
      const output = await cm2.execute(
        [
          "shelveset",
          "create",
          ...absolutePaths(workspacePath, paths),
          "--all",
          `-commentsfile=${commentsFile}`,
          "--summaryformat"
        ],
        { cwd: workspacePath }
      );
      const created = CREATED_SHELVE.exec(output);
      if (!created) throw new Error("The shelve finished but no shelve id was reported.");
      return Number(created[1]);
    }));
  }
  async function createChangelist(workspacePath, { name, description }) {
    await cm2.query(["changelist", "create", name, description, "--persistent"], { cwd: workspacePath });
  }
  async function editChangelist(workspacePath, name, changes) {
    if (changes.description) {
      await cm2.query(["changelist", "edit", name, "description", changes.description], { cwd: workspacePath });
    }
    if (changes.name !== name) {
      await cm2.query(["changelist", "edit", name, "rename", changes.name], { cwd: workspacePath });
    }
  }
  async function deleteChangelist(workspacePath, name) {
    await cm2.query(["changelist", "delete", name], { cwd: workspacePath });
  }
  async function moveToChangelist(workspacePath, name, paths) {
    await cm2.query(["changelist", name ?? DEFAULT_CHANGELIST, "add", ...absolutePaths(workspacePath, paths)], {
      cwd: workspacePath
    });
  }
  return {
    list,
    checkin,
    undo,
    undoUnchanged,
    add,
    remove,
    checkout,
    addFilterRule,
    shelve,
    shelveAndUndo: (workspacePath, paths, comment, operationId) => operations.run(operationId, (context) => shelveAndUndo(shelveAwayDependencies, workspacePath, paths, comment, context)),
    createChangelist,
    editChangelist,
    deleteChangelist,
    moveToChangelist
  };
}
function searchTypes(filter) {
  return [
    "--controlledchanged",
    "--changed",
    "--localdeleted",
    ...filter.detectLocalMoves ? ["--localmoved", `--percentofsimilarity=${filter.moveSimilarityPercent}`] : [],
    ...filter.showPrivate ? ["--private"] : [],
    ...filter.showIgnored ? ["--ignored"] : [],
    ...filter.showCloaked ? ["--cloaked"] : [],
    ...filter.showHiddenChanged ? ["--hiddenchanged"] : []
  ];
}
function absolutePaths(workspacePath, relativePaths) {
  return relativePaths.map((path) => toAbsolutePath(workspacePath, path));
}
const LOCAL_SERVER = "local";
function parseProfiles(output) {
  const profiles = parseRecords(output).map(([server = "", user = "", workingMode = ""]) => ({ server, user, workingMode })).filter((profile) => profile.server && !profile.server.includes("*"));
  const unique = [...new Map(profiles.map((profile) => [profile.server, profile])).values()];
  const withoutLocal = unique.filter((profile) => profile.server !== LOCAL_SERVER);
  return [{ server: LOCAL_SERVER, user: "", workingMode: "" }, ...withoutLocal];
}
const LIST_TIMEOUT_MS = 2e4;
function createRepositoriesService({ cm: cm2 }) {
  async function servers() {
    return parseProfiles(await cm2.query(["profile", "list", `--format=${recordFormat(["server", "user", "workingmode"])}`]));
  }
  async function list(server) {
    const format = recordFormat(["repid", "repname", "repserver", "repowner"]);
    const output = await cm2.execute(["repository", "list", server, `--format=${format}`], {
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS)
    });
    return parseRecords(output).map(([id = "", name = "", repositoryServer = server, owner = ""]) => ({
      id,
      name,
      server: repositoryServer,
      owner,
      spec: `${name}@${repositoryServer}`
    })).sort((a, b) => a.name.localeCompare(b.name));
  }
  async function create(server, name) {
    await cm2.query(["repository", "create", server, name]);
    const created = (await list(server)).find((repository) => repository.name === name);
    if (!created) throw new Error(`Repository ${name} was not found after creating it.`);
    return created;
  }
  async function rename(repositorySpec2, newName) {
    await cm2.query(["repository", "rename", repositorySpec2, newName]);
  }
  async function remove(repositorySpec2) {
    await cm2.query(["repository", "delete", repositorySpec2]);
  }
  return { servers, list, create, rename, remove };
}
function createReviewService({ reviews, diffReviews }) {
  return {
    marks: (workspacePath) => reviews.marks(workspacePath),
    mark: (workspacePath, paths) => reviews.mark(workspacePath, paths),
    unmark: (workspacePath, paths) => reviews.unmark(workspacePath, paths),
    keepOnly: (workspacePath, pendingPaths) => reviews.keepOnly(workspacePath, pendingPaths),
    diffMarks: (repository, diff) => diffReviews.marks(repository, diff),
    markDiff: (repository, diff, marks) => diffReviews.mark(repository, diff, marks),
    unmarkDiff: (repository, diff, paths) => diffReviews.unmark(repository, diff, paths)
  };
}
function createSettingsService({ settings: settings2 }) {
  return {
    get: async () => settings2.get(),
    update: async (changes) => settings2.update(changes),
    rememberRecentWorkspace: async (workspacePath) => settings2.rememberRecentWorkspace(workspacePath),
    forgetRecentWorkspace: async (workspacePath) => settings2.forgetRecentWorkspace(workspacePath)
  };
}
function createShelvesService({ cm: cm2, operations }, { leftChanges }) {
  return {
    async list(workspacePath, filter) {
      const xml = await cm2.query(findArgs("shelve", { ...filter, branch: void 0 }, null), { cwd: workspacePath });
      return findRecords(xml, "SHELVE").map(toShelve).sort((a, b) => b.id - a.id);
    },
    apply: (workspacePath, shelveId, deleteShelve, operationId) => operations.run(operationId, (context) => leftChanges.apply(workspacePath, shelveId, deleteShelve, context)),
    delete: (workspacePath, shelveId) => leftChanges.discard(workspacePath, [shelveId])
  };
}
const readActivityProgress = (previous, line) => {
  const trimmed = line.trim();
  if (!trimmed || /^(CI_START|CHANGESET )/.test(trimmed)) return previous;
  const item = /^<[A-Z]:(.*)>$/.exec(trimmed);
  if (item) return { ...working(previous?.stageLabel ?? "Working"), currentItem: item[1] };
  const stage = /^<STAGE:(.*)>$/.exec(trimmed) ?? /^STAGE (.+)$/.exec(trimmed);
  const label = stage ? stage[1].trim() : trimmed;
  return label ? working(label) : previous;
};
function working(stageLabel) {
  return { stage: "working", stageLabel, fraction: null };
}
function parseReplicationSummary(output) {
  const count = (label) => {
    const match = new RegExp(`^${label} (\\d+)\\s*$`, "m").exec(output);
    return match ? Number(match[1]) : 0;
  };
  return { changesets: count("Changesets"), labels: count("Labels"), items: count("Items") };
}
function createSyncService({ cm: cm2, operations }) {
  function replicate(workspacePath, args, operationId) {
    return operations.run(operationId, async ({ signal, progressOf }) => {
      const output = await cm2.execute(args, { cwd: workspacePath, signal, onOutputLine: progressOf(readActivityProgress) });
      return parseReplicationSummary(output);
    });
  }
  return {
    push: (workspacePath, request, operationId) => replicate(workspacePath, ["push", `br:${request.branch}@${request.from}`, request.to], operationId),
    pull: (workspacePath, request, operationId) => replicate(workspacePath, ["pull", `br:${request.branch}@${request.from}`, request.to], operationId),
    syncWithGit: (workspacePath, request, operationId) => operations.run(operationId, async ({ signal, progressOf }) => {
      const credentials = request.user ? [`--user=${request.user}`, `--pwd=${request.password ?? ""}`] : [];
      await cm2.execute(["sync", request.repository, "git", request.url, ...credentials], {
        cwd: workspacePath,
        signal,
        onOutputLine: progressOf(readActivityProgress)
      });
    })
  };
}
const CHECK_ARGS = ["checkconnection"];
const CHECK_TIMEOUT_MS = 1e4;
const NOT_CONFIGURED = /not correctly configured|client\.conf not found/i;
const SIGN_IN_PROMPT = /sign in to:|select your system|^\s*(user|password):/im;
const REJECTED_CREDENTIALS = /credentials|not authenticated|authentication failed|invalid user|password is not valid/i;
const SIGN_IN_SERVER = /sign in to:\s*(\S+)/i;
function classifySetupCheck(output) {
  if (NOT_CONFIGURED.test(output)) return "notConfigured";
  if (SIGN_IN_PROMPT.test(output) || REJECTED_CREDENTIALS.test(output)) return "notSignedIn";
  return "serverUnreachable";
}
function signInServer(output) {
  return SIGN_IN_SERVER.exec(output)?.[1];
}
async function checkSetup(cm2) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const lines = [];
  const onOutputLine = (line) => {
    lines.push(line);
    if (SIGN_IN_PROMPT.test(line)) controller.abort();
  };
  try {
    await cm2.execute(CHECK_ARGS, { signal: controller.signal, killSignal: "SIGKILL", onOutputLine });
    return null;
  } catch (error) {
    const stopped = controller.signal.aborted;
    if (!(error instanceof CmError) && !stopped) throw error;
    const output = error instanceof CmError ? error.command.output : lines.map((line) => line.trim()).filter(Boolean).join("\n");
    return {
      kind: classifySetupCheck(output),
      server: signInServer(output),
      commandLine: `cm ${CHECK_ARGS.join(" ")}`,
      output: output || `No answer after ${CHECK_TIMEOUT_MS / 1e3} seconds.`
    };
  } finally {
    clearTimeout(timeout);
  }
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function gravatarUrl(user, size) {
  const email = user.trim().toLowerCase();
  if (!EMAIL.test(email)) return null;
  return `https://gravatar.com/avatar/${node_crypto.createHash("sha256").update(email).digest("hex")}?s=${size}&d=404`;
}
class GravatarCache {
  constructor(fetchImage) {
    this.fetchImage = fetchImage;
  }
  fetchImage;
  pictures = /* @__PURE__ */ new Map();
  /** A data URL of the user's picture, or null when they have none (or it couldn't be read). */
  picture(user, size) {
    const url = gravatarUrl(user, size);
    if (!url) return Promise.resolve(null);
    let picture = this.pictures.get(url);
    if (!picture) {
      picture = this.fetchImage(url).then(
        (image) => image && `data:${image.type};base64,${Buffer.from(image.bytes).toString("base64")}`,
        () => null
      );
      this.pictures.set(url, picture);
    }
    return picture;
  }
}
const MAC_TERMINAL_APPS = {
  "iTerm.app": "iTerm",
  WezTerm: "WezTerm",
  ghostty: "Ghostty"
};
const LINUX_TERMINALS = [
  { command: "konsole", folderArgs: (path) => ["--workdir", path], desktop: "KDE" },
  { command: "gnome-terminal", folderArgs: (path) => [`--working-directory=${path}`] },
  { command: "ptyxis", folderArgs: (path) => ["--new-window", `--working-directory=${path}`] },
  { command: "kgx", folderArgs: (path) => [`--working-directory=${path}`] },
  { command: "konsole", folderArgs: (path) => ["--workdir", path] },
  { command: "xfce4-terminal", folderArgs: (path) => [`--working-directory=${path}`] },
  { command: "xterm", folderArgs: () => [] }
];
function terminalCommands(platform, env, path) {
  if (platform === "darwin") {
    const preferred = MAC_TERMINAL_APPS[env.TERM_PROGRAM ?? ""];
    return [...preferred ? [preferred] : [], "Terminal"].map((app) => ({ command: "open", args: ["-a", app, path], exits: true }));
  }
  if (platform === "win32") {
    return [
      { command: "wt.exe", args: ["-d", "."], exits: false },
      { command: "cmd.exe", args: ["/d", "/c", "start", "powershell.exe", "-NoLogo"], exits: true },
      { command: "cmd.exe", args: ["/d", "/c", "start", "cmd.exe"], exits: true }
    ];
  }
  const desktops = (env.XDG_CURRENT_DESKTOP ?? "").split(":");
  const terminals = LINUX_TERMINALS.filter((terminal) => !terminal.desktop || desktops.includes(terminal.desktop)).filter(
    (terminal, index, all) => all.findIndex((other) => other.command === terminal.command) === index
  );
  return [
    // Debian and Ubuntu's choice of terminal (`update-alternatives`).
    { command: "x-terminal-emulator", args: [], exits: false },
    ...terminals.map(({ command, folderArgs }) => ({ command, args: folderArgs(path), exits: false }))
  ];
}
async function openTerminal(path) {
  for (const candidate of terminalCommands(process.platform, process.env, path)) {
    if (await launch(candidate, path)) return;
  }
  throw new Error("No terminal app was found.");
}
function launch({ command, args, exits }, cwd) {
  return new Promise((resolve) => {
    const child2 = node_child_process.spawn(command, args, { cwd, detached: !exits, stdio: "ignore", windowsHide: exits });
    child2.once("error", () => resolve(false));
    if (exits) {
      child2.once("exit", (code) => resolve(code === 0));
      return;
    }
    child2.once("spawn", () => {
      child2.unref();
      resolve(true);
    });
  });
}
function untilSucceeded(read, succeeded = () => true) {
  let answer = null;
  return () => {
    answer ??= read().then(
      (value) => {
        if (!succeeded(value)) answer = null;
        return value;
      },
      (error) => {
        answer = null;
        throw error;
      }
    );
    return answer;
  };
}
function windowChrome(platform) {
  if (platform === "darwin") return "inset";
  if (platform === "win32") return "overlay";
  return "native";
}
const TITLE_BAR_HEIGHT = 44;
const MIN_WINDOW_WIDTH = 960;
const MIN_WINDOW_HEIGHT = 600;
const CASCADE_OFFSET = 28;
const GRAB_WIDTH = 120;
const GRAB_HEIGHT = 40;
function restoreWindowBounds(saved, workAreas) {
  if (!saved || workAreas.length === 0 || ![saved.x, saved.y, saved.width, saved.height].every(Number.isFinite)) return null;
  const home = displayOf(saved, workAreas);
  const width = Math.round(Math.max(MIN_WINDOW_WIDTH, Math.min(saved.width, home.width)));
  const height = Math.round(Math.max(MIN_WINDOW_HEIGHT, Math.min(saved.height, home.height)));
  const bounds = { x: Math.round(saved.x), y: Math.round(saved.y), width, height };
  if (workAreas.some((area) => canGrab(bounds, area))) return bounds;
  return {
    x: home.x + Math.max(0, Math.round((home.width - width) / 2)),
    y: home.y + Math.max(0, Math.round((home.height - height) / 2)),
    width,
    height
  };
}
function cascadeWindowBounds(from, workAreas) {
  if (workAreas.length === 0) return null;
  const home = displayOf(from, workAreas);
  const moved = { ...from, x: from.x + CASCADE_OFFSET, y: from.y + CASCADE_OFFSET };
  const fits = moved.x + moved.width <= home.x + home.width && moved.y + moved.height <= home.y + home.height;
  return restoreWindowBounds({ ...fits ? moved : { ...from, x: home.x, y: home.y } }, workAreas);
}
function displayOf(bounds, workAreas) {
  const byOverlap = [...workAreas].sort((a, b) => overlap(bounds, b) - overlap(bounds, a));
  if (overlap(bounds, byOverlap[0]) > 0) return byOverlap[0];
  return [...workAreas].sort((a, b) => centerDistance(bounds, a) - centerDistance(bounds, b))[0];
}
function overlap(a, b) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return Math.max(0, width) * Math.max(0, height);
}
function centerDistance(a, b) {
  return Math.hypot(a.x + a.width / 2 - (b.x + b.width / 2), a.y + a.height / 2 - (b.y + b.height / 2));
}
function canGrab(bounds, area) {
  const visibleWidth = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
  return visibleWidth >= GRAB_WIDTH && bounds.y >= area.y && bounds.y + GRAB_HEIGHT <= area.y + area.height;
}
const SAVE_DELAY_MS = 500;
function loadWindowBounds(settings2) {
  const saved = settings2.get().windowBounds;
  const workAreas = electron.screen.getAllDisplays().map((display) => display.workArea);
  return { bounds: restoreWindowBounds(saved, workAreas), maximized: saved?.maximized ?? false };
}
function cascadedWindowBounds(window) {
  const workAreas = electron.screen.getAllDisplays().map((display) => display.workArea);
  return { bounds: cascadeWindowBounds(window.getNormalBounds(), workAreas), maximized: false };
}
function saveWindowBounds(window, settings2) {
  const save = () => {
    if (window.isDestroyed()) return;
    settings2.update({ windowBounds: { ...window.getNormalBounds(), maximized: window.isMaximized() } });
  };
  let timer;
  const saveSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  };
  window.on("move", saveSoon);
  window.on("resize", saveSoon);
  window.on("maximize", saveSoon);
  window.on("unmaximize", saveSoon);
  window.on("close", () => {
    clearTimeout(timer);
    save();
  });
}
const TRAFFIC_LIGHTS = { x: 16, y: 16 };
function captionButtons(dark) {
  return { color: "#00000000", symbolColor: dark ? "#e6edf3" : "#1f2328", height: TITLE_BAR_HEIGHT };
}
function titleBarOptions(chrome, dark) {
  if (chrome === "inset") return { titleBarStyle: "hiddenInset", trafficLightPosition: TRAFFIC_LIGHTS };
  if (chrome === "overlay") return { titleBarStyle: "hidden", titleBarOverlay: captionButtons(dark) };
  return { titleBarStyle: "default" };
}
const DARK_BACKGROUND = "#16171b";
const LIGHT_BACKGROUND = "#ffffff";
function createMainWindow(settings2, cascadeFrom) {
  const { bounds, maximized } = cascadeFrom ? cascadedWindowBounds(cascadeFrom) : loadWindowBounds(settings2);
  const window = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    ...bounds,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    title: "Unity Version Control",
    ...titleBarOptions(windowChrome(process.platform), electron.nativeTheme.shouldUseDarkColors),
    backgroundColor: electron.nativeTheme.shouldUseDarkColors ? DARK_BACKGROUND : LIGHT_BACKGROUND,
    webPreferences: {
      preload: node_path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true
    }
  });
  saveWindowBounds(window, settings2);
  window.once("ready-to-show", () => {
    if (maximized) window.maximize();
    window.show();
  });
  window.on("app-command", (_event, command) => {
    if (command === "browser-backward") sendEventTo(window.webContents, "navigateBack", {});
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    void electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(node_path.join(__dirname, "../renderer/index.html"));
  }
  return window;
}
const closing = /* @__PURE__ */ new Set();
let quitting = false;
electron.app.on("before-quit", () => {
  quitting = true;
});
function askBeforeUnloading(window) {
  const viewer = window.webContents.id;
  window.on("close", () => closing.add(viewer));
  window.on("closed", () => closing.delete(viewer));
  window.webContents.on("will-prevent-unload", () => {
    focusWindow(window);
    sendEventTo(window.webContents, "leaveRequested", {});
  });
}
function continueLeaving(viewer, canLeave) {
  const window = electron.BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.id === viewer);
  if (!window || window.isDestroyed()) return;
  const wasClosing = closing.delete(viewer);
  if (!canLeave) {
    quitting = false;
    return;
  }
  if (quitting) electron.app.quit();
  else if (wasClosing) window.close();
  else window.webContents.reload();
}
class WorkspaceWindows {
  constructor(options) {
    this.options = options;
  }
  options;
  requested = /* @__PURE__ */ new Map();
  /** A workspace picked from the Dock or named on the command line before any window existed (it launched the app). */
  launchRequest = null;
  /** Opens a window on the home screen, or opening `workspacePath`. */
  open(workspacePath) {
    const cascadeFrom = electron.BrowserWindow.getFocusedWindow() ?? this.all().at(-1);
    const window = createMainWindow(this.options.settings, cascadeFrom);
    const viewer = window.webContents.id;
    askBeforeUnloading(window);
    if (workspacePath) this.requested.set(viewer, workspacePath);
    const changed = () => this.options.onWindowsChanged();
    window.on("focus", changed);
    window.on("page-title-updated", () => setImmediate(changed));
    window.on("closed", () => {
      this.requested.delete(viewer);
      this.options.onClosed(viewer);
      changed();
    });
    changed();
    return window;
  }
  /** The first window at launch, opening the workspace that launched the app, if any. */
  openFirst() {
    const workspacePath = this.launchRequest ?? void 0;
    this.launchRequest = null;
    this.open(workspacePath);
  }
  /** Focuses the window showing the workspace, or opens one for it. */
  showWorkspace(workspacePath) {
    const showing = this.windowShowing(workspacePath);
    if (showing) focusWindow(showing);
    else this.open(workspacePath);
  }
  /** The window showing the workspace, other than `except`. */
  windowShowing(workspacePath, except) {
    return this.all().find((window) => window.webContents.id !== except && this.shownBy(window.webContents.id) === workspacePath);
  }
  /**
   * A workspace picked from the OS recent documents or named on the command line: its window comes forward, else a window on the home screen
   * opens it, else a new window does.
   */
  requestWorkspace(workspacePath, appReady) {
    if (!appReady) {
      this.launchRequest = workspacePath;
      return;
    }
    if (this.windowShowing(workspacePath)) {
      this.showWorkspace(workspacePath);
      return;
    }
    const home = this.all().find((window) => this.shownBy(window.webContents.id) === void 0);
    if (!home) {
      this.open(workspacePath);
      return;
    }
    this.requested.set(home.webContents.id, workspacePath);
    sendEventTo(home.webContents, "workspaceOpenRequested", {});
    focusWindow(home);
  }
  /** The workspace the window was asked to open, once. */
  takeRequested(viewer) {
    const workspacePath = this.requested.get(viewer) ?? null;
    this.requested.delete(viewer);
    return workspacePath;
  }
  /** Brings the app forward: the last focused window, or a new one when all were closed. */
  focusAny() {
    const window = electron.BrowserWindow.getFocusedWindow() ?? this.all().at(-1);
    if (window) focusWindow(window);
    else this.open();
  }
  /** The workspace the window shows; a window asked to open one counts as showing it while its page starts. */
  workspaceIn(window) {
    return this.shownBy(window.webContents.id);
  }
  /** The open windows in the order they were opened. */
  all() {
    return electron.BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed()).sort((a, b) => a.id - b.id);
  }
  shownBy(viewer) {
    return this.options.workspaceOf(viewer) ?? this.requested.get(viewer);
  }
}
function focusWindow(window) {
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
const shown = /* @__PURE__ */ new Set();
function showIncomingNotification(windows2, workspacePath, message) {
  if (!electron.Notification.isSupported()) return;
  const notification = new electron.Notification({ title: message, silent: true });
  shown.add(notification);
  notification.on("click", () => {
    shown.delete(notification);
    const window = windows2.windowShowing(workspacePath);
    if (!window) return windows2.focusAny();
    focusWindow(window);
    sendEventTo(window.webContents, "incomingNotificationClicked", { workspacePath });
  });
  notification.on("close", () => shown.delete(notification));
  notification.show();
}
function createSystemService({ cm: cm2, operations, windows: windows2, settings: settings2 }) {
  const gravatars = new GravatarCache(async (url) => {
    const response = await electron.net.fetch(url);
    if (!response.ok) return null;
    return { type: response.headers.get("content-type") ?? "image/png", bytes: new Uint8Array(await response.arrayBuffer()) };
  });
  const cmVersion = untilSucceeded(async () => {
    cm2.relocate();
    return (await cm2.execute(["version"])).trim();
  });
  const setupProblem = untilSucceeded(() => checkSetup(cm2), (problem) => problem === null);
  return {
    cmVersion,
    checkSetup: setupProblem,
    currentUser: async () => (await cm2.query(["whoami"])).trim(),
    openPath: async (path) => {
      const error = await electron.shell.openPath(node_path.normalize(path));
      if (error) throw new Error(error);
    },
    // In the OS's own separators: Explorer finds no item to select in `C:\wk/src/a.cs`.
    revealInFileManager: async (path) => electron.shell.showItemInFolder(node_path.normalize(path)),
    openTerminal: (path) => openTerminal(node_path.normalize(path)),
    openExternal: (url) => electron.shell.openExternal(url),
    moveToTrash: async (paths) => {
      for (const path of outermostPaths(paths.map((path2) => node_path.normalize(path2)), process.platform)) {
        if (node_fs.existsSync(path)) await electron.shell.trashItem(path);
      }
    },
    pickDirectory: async (title, defaultPath) => {
      const result = await electron.dialog.showOpenDialog({ title, defaultPath, properties: ["openDirectory", "createDirectory"] });
      return result.canceled ? null : result.filePaths[0] ?? null;
    },
    homeDirectory: async () => node_os.homedir(),
    cancelOperation: async (operationId) => operations.cancel(operationId),
    addRecentDocument: async (workspacePath) => electron.app.addRecentDocument(workspacePath),
    takeRequestedWorkspace: async () => windows2.takeRequested(callerId()),
    gravatar: async (user, size) => settings2.get().showGravatar ? gravatars.picture(user, size) : null,
    notifyIncoming: async (workspacePath, message) => showIncomingNotification(windows2, workspacePath, message)
  };
}
function shownAccelerator(accelerator, isMac) {
  return !isMac && /\+[,.]$/.test(accelerator) ? void 0 : accelerator;
}
function appMenuTemplate(context) {
  const { platform, isPackaged, windowItems: windowItems2, newWindow, openDocumentation } = context;
  const isMac = platform === "darwin";
  const label = (text2) => isMac ? text2.replaceAll("&", "") : text2;
  const commandItem2 = (text2, commandId, accelerator, withoutWindow) => context.commandItem(label(text2), commandId, accelerator && shownAccelerator(accelerator, isMac), withoutWindow);
  const separator = { type: "separator" };
  const template = [
    {
      label: label("&File"),
      submenu: [
        commandItem2("New &Window", "app.newWindow", "CmdOrCtrl+N", newWindow),
        commandItem2("&Open Another Workspace…", "workspace.open", "CmdOrCtrl+Shift+O"),
        separator,
        commandItem2("&Update Workspace", "workspace.update", "CmdOrCtrl+Shift+U"),
        separator,
        ...isMac ? [] : [commandItem2("&Settings…", "app.settings", "CmdOrCtrl+,"), separator],
        { role: "close", label: label("&Close Window") },
        ...isMac ? [] : [{ role: "quit", label: platform === "win32" ? "E&xit" : "&Quit" }]
      ]
    },
    { role: "editMenu", label: label("&Edit") },
    {
      label: label("&View"),
      submenu: [
        commandItem2("Command &Palette…", "app.commandPalette", "CmdOrCtrl+K"),
        commandItem2("Command &Log", "app.commandLog", "CmdOrCtrl+Shift+L"),
        commandItem2("&Refresh", "workspace.refresh", "CmdOrCtrl+R"),
        separator,
        { role: "resetZoom" },
        { role: "zoomIn" },
        // Ctrl+Plus needs Shift on most keyboards; Windows and Linux browsers zoom in with Ctrl+= too.
        ...isMac ? [] : [{ role: "zoomIn", accelerator: "Ctrl+=", visible: false }],
        { role: "zoomOut" },
        separator,
        { role: "togglefullscreen" },
        ...isPackaged ? [] : [separator, { role: "reload" }, { role: "toggleDevTools" }]
      ]
    },
    {
      label: label("&Window"),
      submenu: [
        { role: "minimize" },
        // Zoom is the green button's; Windows and Linux maximize from the title bar.
        ...isMac ? [{ role: "zoom" }] : [],
        separator,
        ...windowItems2,
        ...isMac ? [separator, { role: "front" }] : []
      ]
    },
    {
      role: "help",
      label: label("&Help"),
      submenu: [
        { label: label("Unity Version Control &Documentation"), click: openDocumentation },
        ...isMac ? [] : [separator, { role: "about", label: "&About Unity Version Control" }]
      ]
    }
  ];
  if (!isMac) return template;
  return [
    {
      role: "appMenu",
      submenu: [
        { role: "about" },
        separator,
        commandItem2("Settings…", "app.settings", "CmdOrCtrl+,"),
        separator,
        { role: "services" },
        separator,
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        separator,
        { role: "quit" }
      ]
    },
    ...template
  ];
}
const WORKSPACE_MENU_COMMANDS = ["workspace.open", "workspace.update", "workspace.refresh", "app.commandLog"];
function isMenuCommandEnabled(commandId, showsWorkspace) {
  return showsWorkspace || !WORKSPACE_MENU_COMMANDS.includes(commandId);
}
const DOCUMENTATION_URL = "https://docs.unity.com/ugs/en-us/manual/devops/manual";
function commandItem(label, commandId, accelerator, withoutWindow) {
  return {
    id: commandId,
    label,
    accelerator,
    registerAccelerator: false,
    click: (_item, window) => {
      if (window instanceof electron.BrowserWindow) sendEventTo(window.webContents, "menuCommand", { commandId });
      else withoutWindow?.();
    }
  };
}
function windowItems(windows2) {
  const focused = electron.BrowserWindow.getFocusedWindow();
  return windows2.all().map((window) => ({
    label: windows2.workspaceIn(window) ? window.getTitle() : "Home",
    type: "checkbox",
    checked: window === focused,
    click: () => focusWindow(window)
  }));
}
function installAppMenu(windows2) {
  const template = appMenuTemplate({
    platform: process.platform,
    isPackaged: electron.app.isPackaged,
    commandItem,
    windowItems: windowItems(windows2),
    newWindow: () => windows2.open(),
    openDocumentation: () => void electron.shell.openExternal(DOCUMENTATION_URL)
  });
  const menu = electron.Menu.buildFromTemplate(template);
  const focused = electron.BrowserWindow.getFocusedWindow();
  const showsWorkspace = Boolean(focused && windows2.workspaceIn(focused));
  for (const item of menuItems(menu)) if (item.id && !item.role) item.enabled = isMenuCommandEnabled(item.id, showsWorkspace);
  electron.Menu.setApplicationMenu(menu);
}
function popUpAppMenu(window, position) {
  const zoom = window.webContents.getZoomFactor();
  electron.Menu.getApplicationMenu()?.popup({ window, x: Math.round(position.x * zoom), y: Math.round(position.y * zoom) });
}
function menuItems(menu) {
  return menu.items.flatMap((item) => [item, ...item.submenu ? menuItems(item.submenu) : []]);
}
function createWindowsService({ windows: windows2 }) {
  return {
    openWorkspace: async (workspacePath) => windows2.showWorkspace(workspacePath),
    focusWorkspace: async (workspacePath) => {
      const other = windows2.windowShowing(workspacePath, callerId());
      if (other) focusWindow(other);
      return Boolean(other);
    },
    openHome: async () => void windows2.open(),
    continueLeaving: async (canLeave) => continueLeaving(callerId(), canLeave),
    showAppMenu: async (position) => {
      const caller = electron.webContents.fromId(callerId());
      const window = caller && electron.BrowserWindow.fromWebContents(caller);
      if (window) popUpAppMenu(window, position);
    }
  };
}
const QUERIES = {
  // `name` is a branch's last segment (`task` for `/main/task`), so the full name is checked on the results.
  branch: {
    object: "branch",
    element: "BRANCH",
    condition: (name) => `name = '${escapeQueryValue(name.split("/").pop() ?? "")}'`
  },
  label: {
    object: "label",
    element: "MARKER",
    condition: (name) => `name = '${escapeQueryValue(name)}'`
  },
  changeset: {
    object: "changeset",
    element: "CHANGESET",
    condition: (id) => `changesetid = ${Number(id)}`
  },
  shelve: {
    object: "shelve",
    element: "SHELVE",
    condition: (id) => `shelveid = ${Number(id)}`
  }
};
function workingObjectFindArgs(selector) {
  const query = QUERIES[selector.kind];
  return ["find", query.object, `where ${query.condition(selector.name)}`, "--xml", "--nototal"];
}
function workingObjectCommentIn(xml, selector) {
  const records = findRecords(xml, QUERIES[selector.kind].element);
  const record = selector.kind === "branch" ? records.find((candidate) => text(candidate.NAME) === selector.name) : records[0];
  return record ? text(record.COMMENT) : "";
}
async function readWorkingObjectComment(cm2, workspacePath, selector) {
  return workingObjectCommentIn(await cm2.query(workingObjectFindArgs(selector), { cwd: workspacePath }), selector);
}
async function readWorkspaceGlance(cm2, workspacePath) {
  return parseWorkspaceGlance(await cm2.query(["status", "--xml", workspacePath]));
}
function parseWorkspaceGlance(xml) {
  const { repositoryName, server, selector } = parseWorkspaceStatus(xml);
  return { repository: `${repositoryName}@${server}`, selector, pendingCount: parsePendingChanges(xml).changes.length };
}
const MAX_LOOKUPS = 10;
const CONCURRENT_LOOKUPS = 2;
const LOOKUP_TIMEOUT_MS = 4e3;
function parseStatusHeader(output) {
  const match = /^STATUS\|-?\d+\|([^|]+)\|([^|\r\n]+)/m.exec(output);
  return match ? `${match[1]}@${match[2]}` : null;
}
async function resolveWorkspaceRepositories(cm2, workspacePaths, signal) {
  const repositories = {};
  const pending = [...new Set(workspacePaths)].slice(0, MAX_LOOKUPS);
  const worker = async () => {
    for (let path = pending.shift(); path !== void 0 && !signal.aborted; path = pending.shift()) {
      repositories[path] = await repositoryOf(cm2, path, signal);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENT_LOOKUPS }, worker));
  return repositories;
}
async function repositoryOf(cm2, workspacePath, signal) {
  if (!node_fs.existsSync(workspacePath)) return null;
  try {
    const output = await cm2.execute(["status", "--header", "--machinereadable", "--fieldseparator=|", workspacePath], {
      signal: AbortSignal.any([signal, AbortSignal.timeout(LOOKUP_TIMEOUT_MS)]),
      killSignal: "SIGKILL"
    });
    return parseStatusHeader(output);
  } catch {
    return null;
  }
}
async function checkNewWorkspaceFolder(path) {
  const found = await promises.stat(path).catch(() => null);
  if (!found) return "available";
  if (!found.isDirectory()) return "notAFolder";
  return (await promises.readdir(path)).length === 0 ? "available" : "notEmpty";
}
const KINDS = {
  smartbranch: "branch",
  br: "branch",
  branch: "branch",
  changeset: "changeset",
  cs: "changeset",
  label: "label",
  lb: "label",
  shelve: "shelve",
  sh: "shelve"
};
function parseSelectorFile(text2) {
  const repository = /^\s*(?:repository|rep)\s+"([^"]+@[^"]+)"/im.exec(text2)?.[1];
  if (!repository) return null;
  const loaded = /^\s*(smartbranch|branch|br|changeset|cs|label|lb|shelve|sh)\s+"([^"]+)"/im.exec(text2);
  const kind = loaded && KINDS[loaded[1].toLowerCase()];
  return { repository, selector: kind ? { kind, name: loaded[2] } : null };
}
async function readWorkspaceHeads(workspacePaths) {
  const heads = {};
  await Promise.all(
    workspacePaths.map(async (path) => {
      const text2 = await promises.readFile(node_path.join(path, ".plastic", "plastic.selector"), "utf8").catch(() => null);
      const head = text2 === null ? null : parseSelectorFile(text2);
      if (head) heads[path] = head;
    })
  );
  return heads;
}
async function readSwitchPreflight(cm2, records, workspacePath, targetSpec) {
  const [workspace, statusXml] = await Promise.all([readWorkspaceIdentity(cm2, workspacePath), cm2.query(SWITCH_STATUS_ARGS, { cwd: workspacePath })]);
  const { changes } = parsePendingChanges(statusXml);
  const summary = summarizePending(changes);
  const needsChoice = summary.pendingCount > 0 && !summary.unchangedCheckoutsOnly && !summary.inMerge;
  const sourceSpec = selectorSpec(workspace.selector);
  return {
    sourceName: describeSelector(workspace.selector),
    ...summary,
    lockedPaths: needsChoice ? await lockedPendingPaths(cm2, workspacePath, workspace, shelvableChanges(changes)) : [],
    bringDisabledReason: bringDisabledReason(targetSpec, workspace.repositoryName),
    leaveDisabledReason: workspace.selector.kind === "shelve" ? "shelveSource" : void 0,
    leftShelveCount: records.forWorkspace(workspace.guid).filter((record) => record.mode === "leave" && record.repository === workspace.repository && record.source.spec === sourceSpec).length
  };
}
async function lockedPendingPaths(cm2, workspacePath, workspace, pending) {
  const output = await cm2.query(["lock", "list", "--onlycurrentuser", "--onlycurrentworkspace", ...LOCK_LIST_FORMAT_ARGS], { cwd: workspacePath });
  const server = workspace.repository.slice(workspace.repository.indexOf("@") + 1);
  const lockedPaths = new Set(
    parseLocks(output, server).filter((lock) => lock.repository === workspace.repository).map((lock) => lock.path.replace(/^\//, ""))
  );
  return pending.map((change) => change.path).filter((path) => lockedPaths.has(path));
}
const RENAMED = /^(.+)\.private\.\d+$/;
function renamedPrivateFiles(privateBefore, privateAfter) {
  const before = new Set(privateBefore);
  return privateAfter.flatMap((renamedTo) => {
    const path = RENAMED.exec(renamedTo)?.[1];
    return path && before.has(path) && !before.has(renamedTo) ? [{ path, renamedTo }] : [];
  });
}
const IN_MERGE = "You're in the middle of a merge. Check it in or undo it before switching.";
const NEEDS_CHOICE = "The workspace has pending changes. Choose whether to leave them or bring them along.";
async function switchWithChanges(deps, workspacePath, targetSpec, action, context) {
  const workspace = await readWorkspaceIdentity(deps.cm, workspacePath);
  const snapshot = parsePendingChanges(await deps.cm.query(SWITCH_STATUS_ARGS, { cwd: workspacePath }));
  const result = await switchFrom(deps, workspacePath, workspace, snapshot, targetSpec, action, context);
  return { ...result, renamedPrivates: await privatesRenamedSince(deps.cm, workspacePath, snapshot) };
}
async function switchFrom(deps, workspacePath, workspace, snapshot, targetSpec, action, context) {
  const { cm: cm2 } = deps;
  const summary = summarizePending(snapshot.changes);
  const switchTo = () => cm2.execute(switchArgs(targetSpec), { cwd: workspacePath, signal: context.signal, onOutputLine: context.progressOf(readUpdateProgress) });
  const committed = { ...context, signal: new AbortController().signal };
  if (summary.pendingCount === 0) {
    await switchTo();
    return { kind: "switched", restored: await restoreOnArrival(deps, workspacePath, committed) };
  }
  if (summary.inMerge) throw new Error(IN_MERGE);
  if (summary.unchangedCheckoutsOnly) {
    await cm2.query(onLinksThemselves("undo", "--unchanged", "-r", workspacePath), { cwd: workspacePath });
    await switchTo();
    return { kind: "undidUnchangedCheckouts", count: summary.pendingCount, restored: await restoreOnArrival(deps, workspacePath, committed) };
  }
  if (!action) throw new Error(NEEDS_CHOICE);
  assertAllowed(action, targetSpec, workspace);
  if (context.signal.aborted) throw new Error("The switch was cancelled.");
  const record = await shelveAndSwitch(deps, workspacePath, workspace, snapshot, targetSpec, action, committed);
  if (action === "leave") {
    const restored = await restoreOnArrival(deps, workspacePath, committed);
    return { kind: "left", shelveId: record.shelveId, count: record.paths.length, sourceName: record.source.name, restored };
  }
  return bringChanges(deps, workspacePath, record, committed);
}
async function privatesRenamedSince(cm2, workspacePath, snapshot) {
  const privatePaths = (changes) => changes.filter((change) => change.kinds.includes("private")).map((change) => change.path);
  const before = privatePaths(snapshot.changes);
  if (before.length === 0) return void 0;
  try {
    const after = privatePaths(parsePendingChanges(await cm2.query(["status", "--xml", "--private"], { cwd: workspacePath })).changes);
    const renamed = renamedPrivateFiles(before, after);
    return renamed.length > 0 ? renamed : void 0;
  } catch {
    return void 0;
  }
}
function assertAllowed(action, targetSpec, workspace) {
  if (action === "leave" && workspace.selector.kind === "shelve") throw new Error("Changes can't be left on a shelve. Bring them along, or check them in first.");
  if (action === "bring" && bringDisabledReason(targetSpec, workspace.repositoryName)) throw new Error("Your changes can't be brought to this target.");
}
async function shelveAndSwitch(deps, workspacePath, workspace, snapshot, targetSpec, mode, context) {
  const { cm: cm2, records } = deps;
  const steps = mode === "bring" ? 4 : 3;
  context.beginStep("Shelving your changes", 1, steps);
  const objectRef = await sourceObjectRef(cm2, workspacePath, workspace);
  const shelve = await createSwitchShelve(cm2, workspacePath, snapshot.changes, objectRef, context);
  const target = parseSelectorSpec(targetSpec).selector;
  const record = {
    workspaceGuid: workspace.guid,
    shelveId: shelve.id,
    repository: workspace.repository,
    source: { spec: selectorSpec(workspace.selector), name: describeSelector(workspace.selector), objectRef },
    target: { spec: selectorSpec(target), name: describeSelector(target) },
    mode,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    paths: changedPaths(snapshot.changes),
    changelists: shelvedChangelists(snapshot)
  };
  records.save(record);
  try {
    context.beginStep("Undoing them here", 2, steps);
    await cm2.execute(onLinksThemselves("undo", "-r", workspacePath), { cwd: workspacePath });
    await moveNewItemsAside(cm2, records, workspacePath, snapshot.changes, record, deps.backupsRoot);
    await assertClean(cm2, workspacePath);
    context.beginStep("Switching", 3, steps);
    await cm2.execute(switchArgs(targetSpec), { cwd: workspacePath, onOutputLine: context.progressOf(readUpdateProgress) });
  } catch (error) {
    throw await rollBack(deps, workspacePath, record, error, context);
  }
  const landed = (await readWorkspaceStatus(cm2, workspacePath)).selector;
  const switched = { ...record, target: { spec: selectorSpec(landed), name: describeSelector(landed) } };
  records.save(switched);
  return switched;
}
async function sourceObjectRef(cm2, workspacePath, workspace) {
  if (workspace.selector.kind === "shelve") return `sh:${workspace.selector.name}`;
  const objectRef = await selectorObjectRef(cm2, workspacePath, workspace.selector);
  if (!objectRef) throw new Error(`Couldn't find ${describeSelector(workspace.selector)} in the repository, so nothing was switched.`);
  return objectRef;
}
async function assertClean(cm2, workspacePath) {
  const output = await cm2.query(["status", "--short", "--controlledchanged", "--changed", "--localdeleted"], { cwd: workspacePath });
  if (output.trim()) throw new Error("Some changes are still pending after undoing them.");
}
async function rollBack(deps, workspacePath, record, cause, context) {
  const reason = (cause instanceof Error ? cause.message : String(cause)).replace(/\.$/, "");
  let onSource = false;
  try {
    onSource = await returnToSource(deps.cm, workspacePath, record.source.spec, context);
    if (onSource) {
      if (record.backup) await putBack$1(workspacePath, record.backup);
      const outcome = await applyShelveCleanly(deps.cm, workspacePath, record.shelveId, context);
      if (outcome.kind === "applied") {
        await deps.leftChanges.finish(workspacePath, record);
        return new Error(`${reason}. Your changes were put back.`);
      }
    }
  } catch {
  }
  deps.records.save({ ...record, mode: "leave" });
  const restoreFrom = onSource ? "restore them from Changes" : `switch back to ${record.source.name} to restore them`;
  return new Error(`${reason}. Your changes are safe in shelve ${record.shelveId}; ${restoreFrom}.`);
}
async function returnToSource(cm2, workspacePath, sourceSpec, context) {
  const isOnSource = async () => selectorSpec((await readWorkspaceStatus(cm2, workspacePath)).selector) === sourceSpec;
  if (await isOnSource()) return true;
  await cm2.execute(switchArgs(sourceSpec), { cwd: workspacePath, onOutputLine: context.progressOf(readUpdateProgress) });
  return isOnSource();
}
async function bringChanges(deps, workspacePath, record, context) {
  context.beginStep("Bringing your changes", 4, 4);
  try {
    const outcome = await applyShelveCleanly(deps.cm, workspacePath, record.shelveId, context);
    if (outcome.kind === "applied") {
      await deps.leftChanges.finish(workspacePath, record);
      return { kind: "brought" };
    }
    return { kind: "bringPending", shelveId: record.shelveId, conflictCount: outcome.kind === "conflicts" ? outcome.count : 0 };
  } catch {
    return { kind: "bringPending", shelveId: record.shelveId, conflictCount: 0 };
  }
}
async function restoreOnArrival(deps, workspacePath, context) {
  if (!deps.settings.get().restoreLeftChangesAutomatically) return void 0;
  try {
    if (!await deps.leftChanges.hasOwnWaiting(workspacePath)) return void 0;
    const left = await deps.leftChanges.find(workspacePath);
    const [only] = left;
    if (left.length !== 1 || !only || only.foreign || only.mode !== "leave") return void 0;
    context.reportProgress("Restoring the changes you left here…");
    const result = await deps.leftChanges.restore(workspacePath, only.shelveId, context);
    return result.kind === "restored" ? { count: result.count } : void 0;
  } catch {
    return void 0;
  }
}
const UPDATE_NEEDS_MERGE = "Some of your local changes collide with incoming ones. Open Incoming to merge them while updating.";
function createWorkspacesService({ cm: cm2, operations, watchers: watchers2, settings: settings2, headers: headers2 }, { switchShelves, leftChanges }) {
  const switchDependencies = { cm: cm2, settings: settings2, records: switchShelves, leftChanges, backupsRoot: node_path.join(electron.app.getPath("userData"), "switch-backups") };
  const createdFolders = /* @__PURE__ */ new Set();
  async function list() {
    const output = await cm2.query(["workspace", "list", `--format=${recordFormat(["wkname", "path", "wkid"])}`]);
    const workspaces = parseRecords(output).map(([name = "", path = "", guid = ""]) => ({ name, path, guid }));
    return [...new Map(workspaces.map((workspace) => [workspace.path, workspace])).values()];
  }
  async function info(workspacePath) {
    const [status, { name }] = await Promise.all([headers2.status(workspacePath), headers2.names(workspacePath)]);
    return {
      name,
      path: workspacePath,
      repository: `${status.repositoryName}@${status.server}`,
      ...status
    };
  }
  async function create(request) {
    const madeHere = await checkNewWorkspaceFolder(request.path) === "available";
    await cm2.query(["workspace", "create", request.name, request.path, request.repository]);
    if (madeHere) createdFolders.add(request.path);
    const created = (await list()).find((workspace) => workspace.name === request.name);
    if (!created) throw new Error(`Workspace ${request.name} was not found after creating it.`);
    return created;
  }
  async function rename(workspacePath, newName) {
    const currentName = (await info(workspacePath)).name;
    await cm2.query(["workspace", "rename", currentName, newName]);
    headers2.forget(workspacePath);
  }
  async function remove(workspacePath) {
    await cm2.query(["workspace", "delete", workspacePath]);
  }
  function update(workspacePath, operationId) {
    return operations.run(operationId, async ({ signal, progressOf }) => {
      try {
        await cm2.execute(UPDATE_ARGS, { cwd: workspacePath, signal, onOutputLine: progressOf(readUpdateProgress) });
      } catch (error) {
        if (error instanceof CmError && error.message.includes("--dontmerge")) throw error.withMessage(UPDATE_NEEDS_MERGE);
        throw error;
      }
    });
  }
  async function watch(workspacePath) {
    cm2.warmUp(workspacePath);
    return watchers2.watch(callerId(), workspacePath);
  }
  function switchNewWorkspace(workspacePath, targetSpec, operationId) {
    return operations.run(operationId, async ({ signal, progressOf }) => {
      await cm2.execute(switchArgs(targetSpec), { cwd: workspacePath, signal, onOutputLine: progressOf(readUpdateProgress) });
    });
  }
  async function discardNew(workspacePath) {
    await cm2.query(["workspace", "delete", workspacePath]);
    if (!createdFolders.delete(workspacePath)) return;
    await promises.rm(workspacePath, { recursive: true, force: true, maxRetries: 5 });
  }
  function repositoriesOf(workspacePaths, lookupId) {
    return operations.read(lookupId, ({ signal }) => resolveWorkspaceRepositories(cm2, workspacePaths, signal));
  }
  return {
    list,
    info,
    workingObjectComment: (workspacePath, selector) => readWorkingObjectComment(cm2, workspacePath, selector),
    repositoriesOf,
    heads: readWorkspaceHeads,
    findMissing: async (paths) => paths.filter((path) => !node_fs.existsSync(path)),
    findRoot: (directory) => findWorkspaceRoot(cm2, directory),
    create,
    rename,
    remove,
    update,
    watch,
    unwatch: async () => watchers2.release(callerId()),
    glance: (workspacePath) => readWorkspaceGlance(cm2, workspacePath),
    checkNewFolder: checkNewWorkspaceFolder,
    switchNewWorkspace,
    discardNew,
    switchPreflight: (workspacePath, targetSpec) => readSwitchPreflight(cm2, switchShelves, workspacePath, targetSpec),
    switchTo: (workspacePath, targetSpec, operationId, pendingChanges) => operations.run(operationId, (context) => switchWithChanges(switchDependencies, workspacePath, targetSpec, pendingChanges, context))
  };
}
function createServices(context) {
  const switchShelves = new SwitchShelveRecords(context.settings);
  const switching = { switchShelves, leftChanges: new LeftChangesFinder(context.cm, switchShelves, context.headers) };
  const naming = { branchNames: new BranchNamesCache((workspacePath) => readBranchNames(context.cm, workspacePath)) };
  return {
    accounts: createAccountsService(context),
    annotate: createAnnotateService(context),
    attributes: createAttributesService(context),
    branchExplorer: createBranchExplorerService(context, naming),
    branches: createBranchesService(context, naming),
    changesets: createChangesetsService(context),
    codeReviews: createCodeReviewsService(context, naming),
    content: createContentService(context),
    diff: createDiffService(context),
    explorer: createExplorerService(context),
    history: createHistoryService(context),
    labels: createLabelsService(context),
    leftChanges: createLeftChangesService(context, switching),
    locks: createLocksService(context),
    merge: createMergeService(context, switching),
    mergeTools: createMergeToolsService(context),
    pendingChanges: createPendingChangesService(context, switching),
    repositories: createRepositoriesService(context),
    review: createReviewService(context),
    settings: createSettingsService(context),
    shelves: createShelvesService(context, switching),
    sync: createSyncService(context),
    system: createSystemService(context),
    windows: createWindowsService(context),
    workspaces: createWorkspacesService(context, switching)
  };
}
const DEFAULT_SETTINGS = {
  theme: "system",
  recentWorkspacePaths: [],
  pendingChanges: DEFAULT_PENDING_CHANGES_FILTER,
  warnOnEmptyComment: true,
  recentComments: [],
  autoRefresh: true,
  defaultWorkspaceRoot: "",
  pendingChangesOnSwitch: "ask",
  restoreLeftChangesAutomatically: true,
  switchShelves: [],
  reviewModeWorkspaces: [],
  reviewModeHintDone: false,
  showGravatar: true,
  notifyOnIncoming: false,
  mergeTool: AUTO_MERGE_TOOL,
  customMergeTools: [],
  mergeToolArgs: {},
  askWhenMergeToolClosesUnsaved: true,
  windowBounds: null
};
const MAX_RECENT_WORKSPACES = 10;
function withRecentWorkspace(recentPaths, workspacePath) {
  return [workspacePath, ...withoutRecentWorkspace(recentPaths, workspacePath)].slice(0, MAX_RECENT_WORKSPACES);
}
function withoutRecentWorkspace(recentPaths, workspacePath) {
  return recentPaths.filter((path) => path !== workspacePath);
}
class SettingsStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.settings = this.load();
  }
  filePath;
  settings;
  listeners = /* @__PURE__ */ new Set();
  get() {
    return this.settings;
  }
  update(changes) {
    const json = JSON.stringify({ ...this.settings, ...changes }, null, 2);
    node_fs.mkdirSync(node_path.dirname(this.filePath), { recursive: true });
    node_fs.writeFileSync(this.filePath, json);
    this.settings = JSON.parse(json);
    this.listeners.forEach((listener) => listener(this.settings, changes));
    return this.settings;
  }
  rememberRecentWorkspace(workspacePath) {
    return this.update({ recentWorkspacePaths: withRecentWorkspace(this.settings.recentWorkspacePaths, workspacePath) });
  }
  forgetRecentWorkspace(workspacePath) {
    return this.update({ recentWorkspacePaths: withoutRecentWorkspace(this.settings.recentWorkspacePaths, workspacePath) });
  }
  onChanged(listener) {
    this.listeners.add(listener);
  }
  load() {
    try {
      const stored = JSON.parse(node_fs.readFileSync(this.filePath, "utf8"));
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        pendingChanges: { ...DEFAULT_SETTINGS.pendingChanges, ...stored.pendingChanges }
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
}
const MAX_CHANGED_FOLDERS = 100;
function mergeChanges(first, second) {
  return {
    content: first.content || second.content,
    pathsChanged: first.pathsChanged || second.pathsChanged,
    metadata: first.metadata || second.metadata,
    folders: mergeFolders(first.folders, second.folders)
  };
}
function mergeFolders(first, second) {
  if (first === null || second === null) return null;
  const added = second.filter((folder) => !first.includes(folder));
  if (added.length === 0) return first;
  const merged = [...first, ...new Set(added)];
  return merged.length > MAX_CHANGED_FOLDERS ? null : merged;
}
class ChangeBatcher {
  constructor(onFlush, quietMs, maxWaitMs) {
    this.onFlush = onFlush;
    this.quietMs = quietMs;
    this.maxWaitMs = maxWaitMs;
  }
  onFlush;
  quietMs;
  maxWaitMs;
  batch = null;
  quietTimer = null;
  maxWaitTimer = null;
  add(change) {
    if (!this.batch) this.maxWaitTimer = setTimeout(() => this.flush(), this.maxWaitMs);
    this.batch = this.batch ? mergeChanges(this.batch, change) : change;
    if (this.quietTimer) clearTimeout(this.quietTimer);
    this.quietTimer = setTimeout(() => this.flush(), this.quietMs);
  }
  /** Drops the pending batch without reporting it. */
  cancel() {
    if (this.quietTimer) clearTimeout(this.quietTimer);
    if (this.maxWaitTimer) clearTimeout(this.maxWaitTimer);
    this.quietTimer = null;
    this.maxWaitTimer = null;
    this.batch = null;
  }
  flush() {
    const batch = this.batch;
    this.cancel();
    if (batch) this.onFlush(batch);
  }
}
function changedFolder(relativePath, platform) {
  if (!relativePath) return null;
  const path = relativePath.replaceAll("\\", "/");
  const slash = path.lastIndexOf("/");
  const folder = slash < 0 ? "" : path.slice(0, slash);
  return platform === "darwin" ? folder.normalize("NFD") : folder;
}
const NO_IGNORE_RULES = { names: /* @__PURE__ */ new Set(), rootedPaths: [] };
function parseIgnoreRules(ignoreConf) {
  const lines = ignoreConf.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  const exceptions = lines.filter((line) => line.startsWith("!")).map((line) => line.slice(1));
  const rules = lines.filter((line) => !line.startsWith("!") && !/[*?[\]]/.test(line)).map((line) => line.replace(/\/+$/, "")).filter((rule) => rule.replace(/^\//, "") && !exceptions.some((exception) => exception.includes(rule.replace(/^\//, ""))));
  return {
    names: new Set(rules.filter((rule) => !rule.includes("/"))),
    rootedPaths: rules.filter((rule) => rule.startsWith("/")).map((rule) => rule.slice(1))
  };
}
function isIgnored(relativePath, rules) {
  if (relativePath.split("/").some((segment) => rules.names.has(segment))) return true;
  return rules.rootedPaths.some((rooted) => relativePath === rooted || relativePath.startsWith(`${rooted}/`));
}
const WORKSPACE_STATE_FILES = /* @__PURE__ */ new Set(["plastic.selector", "plastic.wktree", "plastic.changes"]);
function classifyChange(relativePath, ignoreRules) {
  if (!relativePath) return "anything";
  const path = relativePath.replaceAll("\\", "/");
  if (path === ".plastic") return null;
  if (path.startsWith(".plastic/")) {
    const inPlastic = path.slice(".plastic/".length);
    return WORKSPACE_STATE_FILES.has(inPlastic) || isChangelistFile(path) ? "metadata" : null;
  }
  return isIgnored(path, ignoreRules) ? null : "content";
}
function isChangelistFile(relativePath) {
  return relativePath !== void 0 && relativePath.replaceAll("\\", "/").startsWith(".plastic/changelists/");
}
class FolderTreeWatch {
  constructor(root, skip, onEvent, maxFolders) {
    this.root = root;
    this.skip = skip;
    this.onEvent = onEvent;
    this.maxFolders = maxFolders;
  }
  root;
  skip;
  onEvent;
  maxFolders;
  /** By workspace-relative, `/`-separated folder (`''` for the root). */
  watchers = /* @__PURE__ */ new Map();
  complete = true;
  closed = false;
  /** Watches the tree; false if some folder couldn't be watched (none at all, past the limit, out of inotify watches). */
  start() {
    this.watchTree("");
    return this.complete && this.watchers.has("");
  }
  close() {
    this.closed = true;
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers.clear();
  }
  /** Level by level, so a tree past the limit still has its root, `.plastic` and upper folders watched. */
  watchTree(top) {
    const pending = [top];
    for (let next = 0; next < pending.length && !this.closed; next++) {
      const folder = pending[next];
      if (this.watchers.has(folder) || folder && this.skip(folder)) continue;
      if (this.watchers.size >= this.maxFolders || !this.watchFolder(folder)) {
        this.complete = false;
        continue;
      }
      for (const entry of this.list(folder)) {
        if (entry.isDirectory()) pending.push(childOf(folder, entry.name));
      }
    }
  }
  watchFolder(folder) {
    try {
      const watcher = node_fs.watch(this.absolute(folder), (event, name) => this.onFolderEvent(folder, event, name));
      watcher.on("error", () => this.unwatch(folder));
      this.watchers.set(folder, watcher);
      return true;
    } catch {
      return false;
    }
  }
  onFolderEvent(folder, event, name) {
    if (this.closed) return;
    const path = name === null ? void 0 : childOf(folder, name);
    this.onEvent(event, path);
    if (path === void 0 || event !== "rename") return;
    if (this.isFolder(path)) this.watchTree(path);
    else this.unwatch(path);
  }
  /** Stops watching a folder gone (or moved) and everything that was under it. */
  unwatch(folder) {
    for (const [watched, watcher] of this.watchers) {
      if (watched === folder || watched.startsWith(`${folder}/`) || folder === "") {
        watcher.close();
        this.watchers.delete(watched);
      }
    }
  }
  list(folder) {
    try {
      return node_fs.readdirSync(this.absolute(folder), { withFileTypes: true });
    } catch {
      return [];
    }
  }
  /** A folder, not a link to one: links are never followed, as `cm` doesn't. */
  isFolder(path) {
    try {
      return node_fs.lstatSync(this.absolute(path), { throwIfNoEntry: false })?.isDirectory() === true;
    } catch {
      return false;
    }
  }
  absolute(relativePath) {
    return relativePath ? node_path.join(this.root, ...relativePath.split("/")) : this.root;
  }
}
function childOf(folder, name) {
  return folder ? `${folder}/${name}` : name;
}
const QUIET_MS = 300;
const MAX_WAIT_MS = 2e3;
const AFTER_OWN_WRITE_GRACE_MS = 250;
const RECURSIVE_WATCH_PLATFORMS = /* @__PURE__ */ new Set(["darwin", "win32"]);
const MAX_WATCHED_FOLDERS = 1e4;
class WorkspaceWatcher {
  constructor(workspacePath, onChanged, platform = process.platform) {
    this.workspacePath = workspacePath;
    this.platform = platform;
    this.batcher = new ChangeBatcher((change) => !this.stopped && onChanged(change), QUIET_MS, MAX_WAIT_MS);
  }
  workspacePath;
  platform;
  watchers = [];
  folderTree = null;
  ignoreRules = NO_IGNORE_RULES;
  ownWrites = new OwnWrites();
  ownChangelistWrites = new OwnWrites();
  stopped = false;
  batcher;
  start() {
    this.loadIgnoreRules();
    if (!RECURSIVE_WATCH_PLATFORMS.has(this.platform)) {
      this.folderTree = new FolderTreeWatch(
        this.workspacePath,
        (folder) => isIgnored(folder, this.ignoreRules),
        (event, relativePath) => this.onEvent(event, relativePath),
        MAX_WATCHED_FOLDERS
      );
      return this.folderTree.start() ? "full" : "partial";
    }
    if (this.tryWatch(this.workspacePath, true)) return "full";
    this.tryWatch(this.workspacePath, false);
    this.tryWatch(node_path.join(this.workspacePath, ".plastic"), false);
    return "partial";
  }
  /** Whether a command run in `cwd` works on this workspace (`C:\Work` and `c:\work` are one folder on Windows). */
  covers(cwd) {
    return isSameOrInside(this.workspacePath, cwd, this.platform);
  }
  /** Ignores changes until `write` settles; with `changelists`, only the rewrites of the changelist files. */
  ignoreOwnWrite(write, only) {
    if (only === "changelists") {
      this.ownChangelistWrites.track(write);
      return;
    }
    this.ownWrites.track(write);
    this.batcher.cancel();
  }
  stop() {
    this.stopped = true;
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers = [];
    this.folderTree?.close();
    this.batcher.cancel();
  }
  tryWatch(path, recursive) {
    try {
      const watcher = node_fs.watch(path, { recursive }, (event, fileName2) => {
        const relativePath = fileName2 === null ? void 0 : node_path.relative(this.workspacePath, node_path.join(path, fileName2));
        this.onEvent(event, relativePath);
      });
      watcher.on("error", () => watcher.close());
      this.watchers.push(watcher);
      return true;
    } catch {
      return false;
    }
  }
  onEvent(event, relativePath) {
    if (this.stopped) return;
    if (relativePath === "ignore.conf") this.loadIgnoreRules();
    const kind = classifyChange(relativePath, this.ignoreRules);
    if (!kind || this.ownWrites.active()) return;
    if (isChangelistFile(relativePath) && this.ownChangelistWrites.active()) return;
    const folder = changedFolder(relativePath, this.platform);
    const anything = kind === "anything";
    this.batcher.add({
      content: kind === "content" || anything,
      // Node reports additions, deletions and moves as 'rename'; content edits as 'change'.
      pathsChanged: kind === "content" && event === "rename" || anything,
      metadata: kind === "metadata" || anything,
      folders: kind === "metadata" ? [] : folder === null ? null : [folder]
    });
  }
  /** Read at once, before any folder is walked: a watch per folder skips ignored ones. */
  loadIgnoreRules() {
    let ignoreConf = "";
    try {
      ignoreConf = node_fs.readFileSync(node_path.join(this.workspacePath, "ignore.conf"), "utf8");
    } catch {
    }
    this.ignoreRules = parseIgnoreRules(ignoreConf);
  }
}
class OwnWrites {
  running = 0;
  quietUntil = 0;
  track(write) {
    this.running++;
    void write.catch(() => void 0).finally(() => {
      this.running--;
      this.quietUntil = Date.now() + AFTER_OWN_WRITE_GRACE_MS;
    });
  }
  active() {
    return this.running > 0 || Date.now() < this.quietUntil;
  }
}
class WorkspaceWatchers {
  constructor(onChanged, onStopped, createWatcher = (path, onChanged2) => new WorkspaceWatcher(path, onChanged2)) {
    this.onChanged = onChanged;
    this.onStopped = onStopped;
    this.createWatcher = createWatcher;
  }
  onChanged;
  onStopped;
  createWatcher;
  byPath = /* @__PURE__ */ new Map();
  watchedBy = /* @__PURE__ */ new Map();
  /** The viewer now shows `workspacePath`: it stops getting changes of the workspace it showed before. */
  watch(viewer, workspacePath) {
    const current = this.byPath.get(workspacePath);
    if (current && this.watchedBy.get(viewer) === workspacePath) return current.coverage;
    this.release(viewer);
    const entry = current ?? this.start(workspacePath);
    entry.viewers.add(viewer);
    this.watchedBy.set(viewer, workspacePath);
    return entry.coverage;
  }
  /** The viewer shows no workspace anymore (home screen, or closed). */
  release(viewer) {
    const workspacePath = this.watchedBy.get(viewer);
    if (workspacePath === void 0) return;
    this.watchedBy.delete(viewer);
    const entry = this.byPath.get(workspacePath);
    entry?.viewers.delete(viewer);
    if (entry && entry.viewers.size === 0) {
      entry.watcher.stop();
      this.byPath.delete(workspacePath);
      this.onStopped(workspacePath);
    }
  }
  workspaceOf(viewer) {
    return this.watchedBy.get(viewer);
  }
  /** Ignores what `write` changes (or only its changelist rewrites) in the workspace containing `cwd`, or in every watched one without it. */
  ignoreOwnWrite(write, cwd, only) {
    for (const { watcher } of this.byPath.values()) {
      if (cwd === void 0 || watcher.covers(cwd)) watcher.ignoreOwnWrite(write, only);
    }
  }
  start(workspacePath) {
    const viewers = /* @__PURE__ */ new Set();
    const watcher = this.createWatcher(workspacePath, (change) => this.onChanged([...viewers], workspacePath, change));
    const entry = { watcher, coverage: watcher.start(), viewers };
    this.byPath.set(workspacePath, entry);
    return entry;
  }
}
function aboutPanelOptions(name, version) {
  return { applicationName: name, applicationVersion: version };
}
function followAppTheme(settings2) {
  const apply = () => {
    electron.nativeTheme.themeSource = settings2.get().theme;
  };
  apply();
  settings2.onChanged((_settings, changes) => "theme" in changes && apply());
  if (windowChrome(process.platform) !== "overlay") return;
  electron.nativeTheme.on("updated", () => {
    for (const window of electron.BrowserWindow.getAllWindows()) window.setTitleBarOverlay(captionButtons(electron.nativeTheme.shouldUseDarkColors));
  });
}
function handleRecentDocumentRequests(windows2) {
  electron.app.on("open-file", (event, path) => {
    event.preventDefault();
    windows2.requestWorkspace(path, electron.app.isReady());
  });
}
function workspaceArgument(argv, workingDirectory, platform = process.platform) {
  const named = argv.slice(1).filter((arg) => !arg.startsWith("-")).at(-1);
  return named ? pathsOf(platform).resolve(workingDirectory, named) : null;
}
const cm = new CmClient(locateCm);
const settings = new SettingsStore(node_path.join(electron.app.getPath("userData"), "settings.json"));
const headers = new WorkspaceHeaders(cmHeaderReaders(cm));
const watchers = new WorkspaceWatchers(
  (viewers, workspacePath, change) => {
    if (change.metadata) headers.forget(workspacePath);
    for (const viewer of viewers) {
      const target = electron.webContents.fromId(viewer);
      if (target) sendEventTo(target, "workspaceChanged", { workspacePath, ...change });
    }
  },
  (workspacePath) => cm.release(workspacePath)
);
const windows = new WorkspaceWindows({
  settings,
  workspaceOf: (viewer) => watchers.workspaceOf(viewer),
  onWindowsChanged: () => electron.app.isReady() && installAppMenu(windows),
  onClosed: (viewer) => watchers.release(viewer)
});
function start() {
  cm.warmUp();
  cm.onCommandLogged((entry) => sendEventToCaller("commandLogged", entry));
  if (!electron.app.isPackaged) warnOnRepeatedServerCommands(cm);
  settings.onChanged((changed, changes) => Object.keys(changes).some((key) => key !== "windowBounds") && sendEvent("settingsChanged", changed));
  cm.onCommandStarted(({ args, cwd, finished }) => {
    if (rewritesChangelists(args)) watchers.ignoreOwnWrite(finished, cwd, "changelists");
    if (!changesWorkspace(args)) return;
    watchers.ignoreOwnWrite(finished, cwd);
    headers.forget();
    const forget = () => headers.forget();
    void finished.then(forget, forget);
  });
  const operations = new OperationTracker(
    (operationId, progress) => sendEventToCaller("operationProgress", { operationId, progress }),
    (finished) => {
      const caller = currentCaller();
      watchers.ignoreOwnWrite(finished, caller && watchers.workspaceOf(caller.id));
    }
  );
  registerApi(
    createServices({
      cm,
      operations,
      reviews: new ReviewStore(node_path.join(electron.app.getPath("userData"), "review-snapshots")),
      diffReviews: new DiffReviewStore(node_path.join(electron.app.getPath("userData"), "review-snapshots", "diffs")),
      settings,
      watchers,
      windows,
      headers
    })
  );
  followAppTheme(settings);
  electron.app.setAboutPanelOptions(aboutPanelOptions(electron.app.name, electron.app.getVersion()));
  installAppMenu(windows);
  windows.openFirst();
  electron.app.on("activate", () => windows.all().length === 0 && windows.open());
}
function openNamedWorkspace(argv, workingDirectory) {
  const folder = electron.app.isPackaged ? workspaceArgument(argv, workingDirectory) : null;
  if (!folder) return false;
  void findWorkspaceRoot(cm, folder).then((root) => {
    if (root) windows.requestWorkspace(root, electron.app.isReady());
    else if (electron.app.isReady()) windows.focusAny();
  });
  return true;
}
if (electron.app.isPackaged && !electron.app.requestSingleInstanceLock()) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", (_event, argv, workingDirectory) => {
    if (!openNamedWorkspace(argv, workingDirectory)) windows.focusAny();
  });
  handleRecentDocumentRequests(windows);
  openNamedWorkspace(process.argv, process.cwd());
  electron.app.whenReady().then(start);
}
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("will-quit", () => cm.dispose());
