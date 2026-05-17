;(function () {
  async function getModules() {
    const cached = sessionStorage.getItem("lc:modules")
    if (cached) return JSON.parse(cached)
    try {
      const res = await fetch("/api/chrome/modules", { signal: AbortSignal.timeout(3000) })
      if (!res.ok) return []
      const { modules } = await res.json()
      sessionStorage.setItem("lc:modules", JSON.stringify(modules))
      return modules
    } catch {
      return []
    }
  }

  async function init() {
    const modules = await getModules()
    const path = window.location.pathname
    const active = modules.find((m) => path.startsWith(m.url))

    const style = document.createElement("style")
    style.textContent = `
      #lc-bar {
        position: fixed; top: 0; left: 0; right: 0; height: 44px;
        background: #0a0a0a; border-bottom: 1px solid #262626;
        display: flex; align-items: center; z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
        color: #f5f5f5;
      }
      #lc-bar a { color: inherit; text-decoration: none; }
      #lc-home {
        padding: 0 14px; height: 100%; display: flex; align-items: center;
        font-weight: 600; border-right: 1px solid #262626;
        white-space: nowrap; flex-shrink: 0;
      }
      #lc-home:hover { color: #fff; }
      #lc-modules {
        display: flex; align-items: center; flex: 1;
        overflow-x: auto; scrollbar-width: none; padding: 0 4px; height: 100%;
      }
      #lc-modules::-webkit-scrollbar { display: none; }
      .lc-mod {
        padding: 0 10px; height: 100%; display: flex; align-items: center;
        color: #525252; white-space: nowrap; transition: color 0.12s; flex-shrink: 0;
      }
      .lc-mod:hover { color: #e5e5e5; }
      .lc-mod.lc-active { color: #f5f5f5; font-weight: 500; }
    `
    document.head.appendChild(style)
    document.body.style.paddingTop = "44px"

    const bar = document.createElement("div")
    bar.id = "lc-bar"

    const home = document.createElement("a")
    home.id = "lc-home"
    home.href = "/"
    home.textContent = "LC"
    home.title = "Laziness Center"
    bar.appendChild(home)

    const mods = document.createElement("div")
    mods.id = "lc-modules"
    for (const m of modules) {
      const a = document.createElement("a")
      a.className = "lc-mod" + (active?.id === m.id ? " lc-active" : "")
      a.href = m.url
      a.textContent = m.name
      mods.appendChild(a)
    }
    bar.appendChild(mods)

    document.body.prepend(bar)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }
})()
