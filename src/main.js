import "./style.css";

const configuredApiUrl = typeof import.meta.env.VITE_API_URL === "string"
  ? import.meta.env.VITE_API_URL.trim()
  : "";
const API_BASE = (configuredApiUrl || "https://motor-1-2--virabix278.replit.app").replace(/\/+$/, "");

const state = {
  motors: [],
  editingId: null,
  loading: false,
  saving: false,
  error: "",
  notice: "",
  search: "",
};

const app = document.querySelector("#app");

function apiUrl(path) {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const message = typeof body === "object" && body?.error ? body.error : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return body;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusClass(status) {
  return String(status || "running").toLowerCase().replaceAll(" ", "-");
}

function filteredMotors() {
  const query = state.search.trim().toLowerCase();
  if (!query) return state.motors;
  return state.motors.filter((motor) =>
    [motor.name, motor.location, motor.motorType, motor.status]
      .some((value) => String(value ?? "").toLowerCase().includes(query)),
  );
}

function render() {
  const motors = filteredMotors();
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">V</div>
          <div><strong>VoltGuard</strong><span>AI MONITORING</span></div>
        </div>
        <nav>
          <a href="/" data-route="dashboard"><span>▦</span> Dashboard</a>
          <a class="active" href="/machines"><span>◈</span> Machine Registry</a>
          <a href="/alerts"><span>!</span> Alerts</a>
          <a href="/analytics"><span>⌁</span> Analytics</a>
          <a href="/settings"><span>⚙</span> Settings</a>
        </nav>
        <div class="sidebar-footer">
          <div class="connection-dot"></div>
          <div><strong>API Connected</strong><small>${escapeHtml(new URL(API_BASE).hostname)}</small></div>
        </div>
      </aside>
      <main class="content">
        <header class="topbar">
          <div class="mobile-brand"><div class="brand-mark">V</div><strong>VoltGuard</strong></div>
          <div class="topbar-right"><span class="live-dot"></span> Live system <span class="avatar">VB</span></div>
        </header>
        <section class="page">
          <div class="page-heading">
            <div>
              <div class="eyebrow">ASSET MANAGEMENT</div>
              <h1>Machine Registry</h1>
              <p>Register and monitor the industrial motors connected to your grid.</p>
            </div>
            <button class="primary-button" data-action="open-create"><span>＋</span> Register New Motor</button>
          </div>
          <div class="metrics">
            <div class="metric-card"><span>REGISTERED MOTORS</span><strong>${state.motors.length}</strong><small>Active assets</small></div>
            <div class="metric-card"><span>RUNNING</span><strong>${state.motors.filter((motor) => motor.status === "running").length}</strong><small class="green-text">Operational</small></div>
            <div class="metric-card"><span>NEEDS ATTENTION</span><strong>${state.motors.filter((motor) => motor.status !== "running").length}</strong><small class="amber-text">Review status</small></div>
            <div class="metric-card"><span>API STATUS</span><strong class="api-ok">● Online</strong><small>${escapeHtml(new URL(API_BASE).hostname)}</small></div>
          </div>
          <div class="toolbar">
            <div class="search"><span>⌕</span><input id="search" value="${escapeHtml(state.search)}" placeholder="Search machines..." /></div>
            <button class="secondary-button" data-action="refresh">↻ Refresh</button>
          </div>
          ${state.error ? `<div class="banner error-banner"><strong>Could not load data</strong><span>${escapeHtml(state.error)}</span><button data-action="dismiss">×</button></div>` : ""}
          ${state.notice ? `<div class="banner success-banner"><strong>Saved successfully</strong><span>${escapeHtml(state.notice)}</span><button data-action="dismiss">×</button></div>` : ""}
          <div class="table-card">
            <div class="table-head"><div><h2>Registered Motors</h2><p>${motors.length} asset${motors.length === 1 ? "" : "s"} shown</p></div><span class="table-chip">SYNCED</span></div>
            ${state.loading ? `<div class="empty"><div class="spinner"></div><p>Loading machine registry...</p></div>` : motors.length === 0 ? `
              <div class="empty"><div class="empty-icon">◈</div><h3>No motors registered yet</h3><p>Register your first motor to begin monitoring.</p><button class="primary-button" data-action="open-create">＋ Register New Motor</button></div>
            ` : `
              <div class="table-wrap"><table><thead><tr><th>Machine</th><th>Location / Zone</th><th>Type</th><th>Status</th><th>Health</th><th>Last updated</th><th></th></tr></thead><tbody>
                ${motors.map((motor) => `
                  <tr>
                    <td><div class="machine-cell"><div class="machine-icon">⚡</div><div><strong>${escapeHtml(motor.name)}</strong><small>ID #${motor.id}</small></div></div></td>
                    <td>${escapeHtml(motor.location)}</td>
                    <td>${escapeHtml(motor.motorType)}</td>
                    <td><span class="status ${statusClass(motor.status)}"><i></i>${escapeHtml(motor.status || "running")}</span></td>
                    <td><div class="health"><div class="health-bar"><span style="width:${Math.max(0, Math.min(100, Number(motor.healthScore ?? 0)))}%"></span></div><strong>${Math.round(Number(motor.healthScore ?? 0))}%</strong></div></td>
                    <td class="muted">${formatDate(motor.createdAt)}</td>
                    <td><div class="row-actions"><button title="Edit" data-action="edit" data-id="${motor.id}">✎</button><button title="Delete" data-action="delete" data-id="${motor.id}">⌫</button></div></td>
                  </tr>
                `).join("")}
              </tbody></table></div>
            `}
          </div>
          <footer><span>VoltGuard AI · Motor protection system</span><span>API: ${escapeHtml(API_BASE)}</span></footer>
        </section>
      </main>
    </div>
    ${state.editingId !== null ? modalHtml() : ""}
  `;
  bindEvents();
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function modalHtml() {
  const current = state.editingId === "new"
    ? { name: "", location: "", motorType: "Induction", status: "running" }
    : state.motors.find((motor) => motor.id === state.editingId) || { name: "", location: "", motorType: "Induction", status: "running" };
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="modal-close" data-action="close-modal">×</button>
        <div class="eyebrow">MACHINE REGISTRY</div>
        <h2 id="modal-title">${state.editingId === "new" ? "Register New Motor" : "Edit Motor"}</h2>
        <p class="modal-description">Add an asset to the monitoring grid.</p>
        <form id="motor-form">
          <label>Machine Name<input name="name" required value="${escapeHtml(current.name)}" placeholder="e.g. Main Pump Motor" /></label>
          <label>Location / Zone<input name="location" required value="${escapeHtml(current.location)}" placeholder="e.g. Line A" /></label>
          <label>Motor Type<select name="motorType"><option ${current.motorType === "Induction" ? "selected" : ""}>Induction</option><option ${current.motorType === "VFD" ? "selected" : ""}>VFD</option><option ${current.motorType === "Synchronous" ? "selected" : ""}>Synchronous</option></select></label>
          <label>Status<select name="status"><option value="running" ${current.status === "running" ? "selected" : ""}>Running</option><option value="warning" ${current.status === "warning" ? "selected" : ""}>Warning</option><option value="stopped" ${current.status === "stopped" ? "selected" : ""}>Stopped</option></select></label>
          <div class="modal-actions"><button type="button" class="secondary-button" data-action="close-modal">Cancel</button><button class="primary-button" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Saving..." : "Save Details"}</button></div>
        </form>
      </section>
    </div>
  `;
}

function bindEvents() {
  document.querySelector("#search")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
    const input = document.querySelector("#search");
    input?.focus();
    input?.setSelectionRange(state.search.length, state.search.length);
  });
  document.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", async (event) => {
      const action = element.dataset.action;
      if (action === "open-create") {
        state.editingId = "new";
        state.error = "";
        state.notice = "";
        render();
      } else if (action === "close-modal") {
        if (event.target === element || element.classList.contains("modal-close")) {
          state.editingId = null;
          render();
        }
      } else if (action === "dismiss") {
        state.error = "";
        state.notice = "";
        render();
      } else if (action === "refresh") {
        await loadMotors();
      } else if (action === "edit") {
        state.editingId = Number(element.dataset.id);
        state.error = "";
        render();
      } else if (action === "delete") {
        await deleteMotor(Number(element.dataset.id));
      }
    });
  });
  document.querySelector("#motor-form")?.addEventListener("submit", saveMotor);
}

async function loadMotors() {
  state.loading = true;
  state.error = "";
  render();
  try {
    state.motors = await apiRequest("/api/motors");
  } catch (error) {
    state.error = `${error.message}. Confirm VITE_API_URL is set to ${API_BASE} in Vercel.`;
  } finally {
    state.loading = false;
    render();
  }
}

async function saveMotor(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const data = Object.fromEntries(form.entries());
  const isNew = state.editingId === "new";
  state.saving = true;
  state.error = "";
  render();
  try {
    await apiRequest(isNew ? "/api/motors" : `/api/motors/${state.editingId}`, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(data),
    });
    state.editingId = null;
    state.notice = isNew ? "New motor registered." : "Motor details updated.";
    await loadMotors();
  } catch (error) {
    state.error = `Motor registration failed: ${error.message}`;
  } finally {
    state.saving = false;
    render();
  }
}

async function deleteMotor(id) {
  if (!window.confirm("Delete this motor from the registry?")) return;
  state.error = "";
  try {
    await apiRequest(`/api/motors/${id}`, { method: "DELETE" });
    state.notice = "Motor deleted.";
    await loadMotors();
  } catch (error) {
    state.error = `Motor deletion failed: ${error.message}`;
    render();
  }
}

render();
loadMotors();