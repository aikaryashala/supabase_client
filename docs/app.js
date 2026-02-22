// ============================================================
// Supabase DB Browser - app.js
//
// Modules:
//   1. Connection  - connect/disconnect to a Supabase project
//   2. Schema      - discover tables via the OpenAPI endpoint
//   3. TableBrowser - fetch and paginate rows from a table
//   4. UI          - render everything to the DOM
// ============================================================

// ── 1. Connection Module ─────────────────────────────────────
const Connection = (() => {
  let client = null;
  let url = "";
  let key = "";

  function connect(supabaseUrl, apiKey) {
    url = supabaseUrl.replace(/\/+$/, ""); // trim trailing slash
    key = apiKey;
    client = supabase.createClient(url, key);
    return client;
  }

  function disconnect() {
    client = null;
    url = "";
    key = "";
  }

  function getClient() { return client; }
  function getUrl()    { return url; }
  function getKey()    { return key; }

  return { connect, disconnect, getClient, getUrl, getKey };
})();


// ── 2. Schema Module ─────────────────────────────────────────
// Uses the PostgREST OpenAPI endpoint to discover all exposed tables.
// Endpoint: GET {url}/rest/v1/  (returns an OpenAPI spec JSON)
const Schema = (() => {

  async function fetchTableNames() {
    const url = Connection.getUrl();
    const key = Connection.getKey();

    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
    }

    const spec = await response.json();

    // The OpenAPI spec has table names as keys under "definitions"
    const definitions = spec.definitions || {};
    const tables = Object.keys(definitions).sort();
    return tables;
  }

  return { fetchTableNames };
})();


// ── 3. Table Browser Module ──────────────────────────────────
// Fetches rows from a table with pagination (100 rows per page).
const TableBrowser = (() => {
  const PAGE_SIZE = 100;
  let currentTable = "";
  let currentOffset = 0;
  let allRows = [];

  function reset(tableName) {
    currentTable = tableName;
    currentOffset = 0;
    allRows = [];
  }

  async function fetchPage() {
    const client = Connection.getClient();

    const { data, error } = await client
      .from(currentTable)
      .select("*")
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (error) throw new Error(`Query error: ${error.message}`);

    allRows = allRows.concat(data);
    currentOffset += data.length;

    return {
      rows: allRows,
      newRows: data,
      hasMore: data.length === PAGE_SIZE,
    };
  }

  async function fetchCount() {
    const client = Connection.getClient();

    const { count, error } = await client
      .from(currentTable)
      .select("*", { count: "exact", head: true });

    if (error) return null;
    return count;
  }

  return { reset, fetchPage, fetchCount, PAGE_SIZE };
})();


// ── 4. UI Module ─────────────────────────────────────────────
// Handles all DOM updates: status messages, table list, data rendering.
const UI = (() => {
  // DOM references
  const $ = (id) => document.getElementById(id);

  const els = {
    form:          $("connect-form"),
    urlInput:      $("supabase-url"),
    keyInput:      $("supabase-key"),
    connectBtn:    $("connect-btn"),
    disconnectBtn: $("disconnect-btn"),
    status:        $("status-message"),
    app:           $("app"),
    tableList:     $("table-list"),
    tableName:     $("table-name"),
    rowCount:      $("row-count"),
    thead:         $("data-thead"),
    tbody:         $("data-tbody"),
    loadMoreBtn:   $("load-more-btn"),
  };

  // ── Status messages ──
  function setStatus(text, type) {
    els.status.textContent = text;
    els.status.className = `status-${type}`; // ok | error | info
  }

  // ── Show/hide main app area ──
  function showApp(show) {
    els.app.hidden = !show;
  }

  // ── Render table list in sidebar ──
  function renderTableList(tables, onSelect) {
    els.tableList.innerHTML = "";
    tables.forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;
      li.addEventListener("click", () => {
        // highlight active
        els.tableList.querySelectorAll("li").forEach((el) => el.classList.remove("active"));
        li.classList.add("active");
        onSelect(name);
      });
      els.tableList.appendChild(li);
    });
  }

  // ── Render data table ──
  function renderData(tableName, rows, totalCount, hasMore) {
    els.tableName.textContent = tableName;
    els.rowCount.textContent = totalCount !== null
      ? `${totalCount} total rows (showing ${rows.length})`
      : `Showing ${rows.length} rows`;

    // Build header from column names
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      els.thead.innerHTML = "<tr>" + columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("") + "</tr>";
    } else {
      els.thead.innerHTML = "";
    }

    // Build body
    els.tbody.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      Object.values(row).forEach((val) => {
        const td = document.createElement("td");
        td.textContent = formatCell(val);
        td.title = formatCell(val); // tooltip for truncated cells
        tr.appendChild(td);
      });
      els.tbody.appendChild(tr);
    });

    els.loadMoreBtn.hidden = !hasMore;
  }

  function clearData() {
    els.tableName.textContent = "Select a table";
    els.rowCount.textContent = "";
    els.thead.innerHTML = "";
    els.tbody.innerHTML = "";
    els.loadMoreBtn.hidden = true;
  }

  // ── Helpers ──
  function formatCell(value) {
    if (value === null) return "NULL";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Toggle connect/disconnect buttons ──
  function setConnected(connected) {
    els.urlInput.disabled = connected;
    els.keyInput.disabled = connected;
    els.connectBtn.hidden = connected;
    els.disconnectBtn.hidden = !connected;
  }

  return { els, setStatus, showApp, renderTableList, renderData, clearData, setConnected };
})();


// ── App Initialization ──────────────────────────────────────
(function init() {

  // Handle Connect
  UI.els.form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const url = UI.els.urlInput.value.trim();
    const key = UI.els.keyInput.value.trim();

    UI.setStatus("Connecting...", "info");

    try {
      Connection.connect(url, key);
      const tables = await Schema.fetchTableNames();

      UI.setStatus(`Connected — ${tables.length} tables found`, "ok");
      UI.setConnected(true);
      UI.showApp(true);
      UI.clearData();
      UI.renderTableList(tables, handleTableSelect);
    } catch (err) {
      Connection.disconnect();
      UI.setStatus(`Connection failed: ${err.message}`, "error");
    }
  });

  // Handle Disconnect
  UI.els.disconnectBtn.addEventListener("click", () => {
    Connection.disconnect();
    UI.setConnected(false);
    UI.showApp(false);
    UI.clearData();
    UI.setStatus("Disconnected", "info");
  });

  // Handle table selection
  async function handleTableSelect(tableName) {
    UI.setStatus(`Loading ${tableName}...`, "info");
    UI.clearData();

    try {
      TableBrowser.reset(tableName);

      const [pageResult, totalCount] = await Promise.all([
        TableBrowser.fetchPage(),
        TableBrowser.fetchCount(),
      ]);

      UI.renderData(tableName, pageResult.rows, totalCount, pageResult.hasMore);
      UI.setStatus(`Loaded ${tableName}`, "ok");
    } catch (err) {
      UI.setStatus(`Error loading ${tableName}: ${err.message}`, "error");
    }
  }

  // Handle Load More
  UI.els.loadMoreBtn.addEventListener("click", async () => {
    UI.els.loadMoreBtn.disabled = true;
    UI.els.loadMoreBtn.textContent = "Loading...";

    try {
      const pageResult = await TableBrowser.fetchPage();
      const totalCount = await TableBrowser.fetchCount();
      const tableName = UI.els.tableName.textContent;

      UI.renderData(tableName, pageResult.rows, totalCount, pageResult.hasMore);
    } catch (err) {
      UI.setStatus(`Error loading more rows: ${err.message}`, "error");
    } finally {
      UI.els.loadMoreBtn.disabled = false;
      UI.els.loadMoreBtn.textContent = "Load more rows";
    }
  });

})();
