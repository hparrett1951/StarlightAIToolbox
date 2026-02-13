// Starlight AI Toolbox app
// Requires TOOLS from data.js

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const state = {
  query: "",
  activeCategory: "all",
  filterMode: "all", // all | favorites
  favorites: new Set(),
  collapsed: new Set(),
  theme: "dark",
};

const FAVORITES_KEY = "starlight_ai_toolbox_favorites_v1";
const THEME_KEY = "starlight_ai_toolbox_theme_v1";

function normalizeUrl(url){
  // PortaPortal export includes some http links; keep as-is but trim.
  return (url || "").trim();
}

function loadFavorites(){
  try{
    const raw = localStorage.getItem(FAVORITES_KEY);
    if(!raw) return;
    const arr = JSON.parse(raw);
    if(Array.isArray(arr)) state.favorites = new Set(arr);
  } catch {}
}

function saveFavorites(){
  try{
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(state.favorites)));
  } catch {}
}

function loadTheme(){
  const t = localStorage.getItem(THEME_KEY);
  if(t === "light" || t === "dark") state.theme = t;
  document.documentElement.setAttribute("data-theme", state.theme === "light" ? "light" : "dark");
  $("#themeToggle").textContent = state.theme === "light" ? "🌞" : "🌙";
}

function toggleTheme(){
  state.theme = state.theme === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, state.theme);
  loadTheme();
}

function groupByCategory(items){
  const map = new Map();
  for(const t of items){
    const cat = t.category || "Other";
    if(!map.has(cat)) map.set(cat, []);
    map.get(cat).push(t);
  }
  // stable sort
  const cats = Array.from(map.keys()).sort((a,b)=>a.localeCompare(b));
  for(const c of cats){
    map.get(c).sort((a,b)=>a.name.localeCompare(b.name));
  }
  return { map, cats };
}

function matchesQuery(tool, q){
  if(!q) return true;
  const hay = `${tool.name} ${tool.category} ${tool.url}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function getVisibleTools(){
  let list = TOOLS.map(t => ({...t, url: normalizeUrl(t.url)}));

  if(state.filterMode === "favorites"){
    list = list.filter(t => state.favorites.has(t.url));
  }

  if(state.activeCategory !== "all"){
    list = list.filter(t => t.category === state.activeCategory);
  }

  if(state.query){
    list = list.filter(t => matchesQuery(t, state.query));
  }

  return list;
}

function setStatus(text){
  $("#status").textContent = text;
}

function renderSidebar(){
  const { map, cats } = groupByCategory(TOOLS);

  const wrap = $("#categoryList");
  wrap.innerHTML = "";

  // Add "All"
  const allBtn = document.createElement("button");
  allBtn.className = "catBtn";
  allBtn.dataset.active = state.activeCategory === "all";
  allBtn.innerHTML = `<span>All</span><span class="catCount">${TOOLS.length}</span>`;
  allBtn.addEventListener("click", () => {
    state.activeCategory = "all";
    renderAll();
  });
  wrap.appendChild(allBtn);

  for(const cat of cats){
    const btn = document.createElement("button");
    btn.className = "catBtn";
    btn.dataset.active = state.activeCategory === cat;
    btn.innerHTML = `<span>${cat}</span><span class="catCount">${map.get(cat).length}</span>`;
    btn.addEventListener("click", () => {
      state.activeCategory = cat;
      renderAll(true);
      // Scroll to the section when not in favorites mode and no search filter
      const sec = document.getElementById(`sec-${slug(cat)}`);
      if(sec) sec.scrollIntoView({behavior:"smooth", block:"start"});
    });
    wrap.appendChild(btn);
  }

  // Chips
  $$(".chip").forEach(ch => {
    ch.dataset.active =
      (ch.dataset.filter === state.filterMode) ||
      (ch.dataset.filter === "all" && state.filterMode === "all");
    ch.onclick = () => {
      state.filterMode = ch.dataset.filter === "favorites" ? "favorites" : "all";
      renderAll();
    };
  });
}

function slug(s){
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
}

function toggleFavorite(url){
  if(state.favorites.has(url)) state.favorites.delete(url);
  else state.favorites.add(url);
  saveFavorites();
  renderAll(false);
}

function renderSections(){
  const visible = getVisibleTools();
  const { map, cats } = groupByCategory(visible);

  const sections = $("#sections");
  sections.innerHTML = "";

  if(visible.length === 0){
    setStatus("No matches. Try a different search or clear filters.");
    return;
  }

  // Status line
  const statusBits = [];
  if(state.filterMode === "favorites") statusBits.push("Showing ★ favorites");
  if(state.activeCategory !== "all") statusBits.push(`Category: ${state.activeCategory}`);
  if(state.query) statusBits.push(`Search: “${state.query}”`);
  setStatus(`${visible.length} tools` + (statusBits.length ? ` • ${statusBits.join(" • ")}` : ""));

  for(const cat of cats){
    const tools = map.get(cat) || [];
    const secId = `sec-${slug(cat)}`;

    const section = document.createElement("div");
    section.className = "section";
    section.id = secId;

    const collapsed = state.collapsed.has(cat);

    const header = document.createElement("div");
    header.className = "sectionHeader";
    header.innerHTML = `
      <div class="sectionTitle">
        <span>${cat}</span>
        <span class="badge">${tools.length}</span>
      </div>
      <div class="chev">${collapsed ? "▸" : "▾"}</div>
    `;
    header.addEventListener("click", () => {
      if(state.collapsed.has(cat)) state.collapsed.delete(cat);
      else state.collapsed.add(cat);
      renderSections();
    });

    section.appendChild(header);

    if(!collapsed){
      const grid = document.createElement("div");
      grid.className = "grid";

      for(const t of tools){
        const card = document.createElement("div");
        card.className = "card";

        const isFav = state.favorites.has(t.url);

        card.innerHTML = `
          <div class="cardTop">
            <div>
              <a href="${t.url}" target="_blank" rel="noopener">${escapeHtml(t.name)}</a>
              <div class="cardMeta">${escapeHtml(t.url)}</div>
            </div>
            <button class="starBtn" data-on="${isFav}" title="Favorite">★</button>
          </div>
        `;

        card.querySelector(".starBtn").addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(t.url);
        });

        grid.appendChild(card);
      }

      section.appendChild(grid);
    }

    sections.appendChild(section);
  }
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function wireEvents(){
  const search = $("#search");
  const clear = $("#clearSearch");
  const theme = $("#themeToggle");

  search.addEventListener("input", (e) => {
    state.query = e.target.value.trim();
    renderAll();
  });

  clear.addEventListener("click", () => {
    search.value = "";
    state.query = "";
    renderAll();
    search.focus();
  });

  theme.addEventListener("click", toggleTheme);

  document.addEventListener("keydown", (e) => {
    if(e.key === "/"){
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if(tag !== "input" && tag !== "textarea"){
        e.preventDefault();
        search.focus();
      }
    }
    if(e.key === "Escape"){
      if(search.value){
        search.value = "";
        state.query = "";
        renderAll();
      }
    }
  });
}

function renderAll(scrollTop=false){
  renderSidebar();
  renderSections();
  if(scrollTop) window.scrollTo({top:0, behavior:"smooth"});
}

(function init(){
  loadFavorites();
  loadTheme();
  wireEvents();
  renderAll();
})();
