(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))d(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const u of o.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&d(u)}).observe(document,{childList:!0,subtree:!0});function n(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function d(s){if(s.ep)return;s.ep=!0;const o=n(s);fetch(s.href,o)}})();const l="https://motor-1-2--virabix278.replit.app".replace(/\/+$/,""),e={motors:[],editingId:null,loading:!1,saving:!1,error:"",notice:"",search:""},m=document.querySelector("#app");function g(t){return`${l}${t.startsWith("/")?t:`/${t}`}`}async function p(t,a={}){const n=await fetch(g(t),{...a,headers:{Accept:"application/json",...a.body?{"Content-Type":"application/json"}:{},...a.headers||{}}}),s=(n.headers.get("content-type")||"").includes("application/json")?await n.json():await n.text();if(!n.ok){const o=typeof s=="object"&&s?.error?s.error:`Request failed with HTTP ${n.status}`;throw new Error(o)}return s}function i(t){return String(t??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function h(t){return String(t||"running").toLowerCase().replaceAll(" ","-")}function v(){const t=e.search.trim().toLowerCase();return t?e.motors.filter(a=>[a.name,a.location,a.motorType,a.status].some(n=>String(n??"").toLowerCase().includes(t))):e.motors}function r(){const t=v();m.innerHTML=`
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
          <div><strong>API Connected</strong><small>${i(new URL(l).hostname)}</small></div>
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
            <div class="metric-card"><span>REGISTERED MOTORS</span><strong>${e.motors.length}</strong><small>Active assets</small></div>
            <div class="metric-card"><span>RUNNING</span><strong>${e.motors.filter(a=>a.status==="running").length}</strong><small class="green-text">Operational</small></div>
            <div class="metric-card"><span>NEEDS ATTENTION</span><strong>${e.motors.filter(a=>a.status!=="running").length}</strong><small class="amber-text">Review status</small></div>
            <div class="metric-card"><span>API STATUS</span><strong class="api-ok">● Online</strong><small>${i(new URL(l).hostname)}</small></div>
          </div>
          <div class="toolbar">
            <div class="search"><span>⌕</span><input id="search" value="${i(e.search)}" placeholder="Search machines..." /></div>
            <button class="secondary-button" data-action="refresh">↻ Refresh</button>
          </div>
          ${e.error?`<div class="banner error-banner"><strong>Could not load data</strong><span>${i(e.error)}</span><button data-action="dismiss">×</button></div>`:""}
          ${e.notice?`<div class="banner success-banner"><strong>Saved successfully</strong><span>${i(e.notice)}</span><button data-action="dismiss">×</button></div>`:""}
          <div class="table-card">
            <div class="table-head"><div><h2>Registered Motors</h2><p>${t.length} asset${t.length===1?"":"s"} shown</p></div><span class="table-chip">SYNCED</span></div>
            ${e.loading?'<div class="empty"><div class="spinner"></div><p>Loading machine registry...</p></div>':t.length===0?`
              <div class="empty"><div class="empty-icon">◈</div><h3>No motors registered yet</h3><p>Register your first motor to begin monitoring.</p><button class="primary-button" data-action="open-create">＋ Register New Motor</button></div>
            `:`
              <div class="table-wrap"><table><thead><tr><th>Machine</th><th>Location / Zone</th><th>Type</th><th>Status</th><th>Health</th><th>Last updated</th><th></th></tr></thead><tbody>
                ${t.map(a=>`
                  <tr>
                    <td><div class="machine-cell"><div class="machine-icon">⚡</div><div><strong>${i(a.name)}</strong><small>ID #${a.id}</small></div></div></td>
                    <td>${i(a.location)}</td>
                    <td>${i(a.motorType)}</td>
                    <td><span class="status ${h(a.status)}"><i></i>${i(a.status||"running")}</span></td>
                    <td><div class="health"><div class="health-bar"><span style="width:${Math.max(0,Math.min(100,Number(a.healthScore??0)))}%"></span></div><strong>${Math.round(Number(a.healthScore??0))}%</strong></div></td>
                    <td class="muted">${f(a.createdAt)}</td>
                    <td><div class="row-actions"><button title="Edit" data-action="edit" data-id="${a.id}">✎</button><button title="Delete" data-action="delete" data-id="${a.id}">⌫</button></div></td>
                  </tr>
                `).join("")}
              </tbody></table></div>
            `}
          </div>
          <footer><span>VoltGuard AI · Motor protection system</span><span>API: ${i(l)}</span></footer>
        </section>
      </main>
    </div>
    ${e.editingId!==null?b():""}
  `,y()}function f(t){if(!t)return"—";const a=new Date(t);return Number.isNaN(a.getTime())?"—":a.toLocaleString([],{dateStyle:"medium",timeStyle:"short"})}function b(){const t=e.editingId==="new"?{name:"",location:"",motorType:"Induction",status:"running"}:e.motors.find(a=>a.id===e.editingId)||{name:"",location:"",motorType:"Induction",status:"running"};return`
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="modal-close" data-action="close-modal">×</button>
        <div class="eyebrow">MACHINE REGISTRY</div>
        <h2 id="modal-title">${e.editingId==="new"?"Register New Motor":"Edit Motor"}</h2>
        <p class="modal-description">Add an asset to the monitoring grid.</p>
        <form id="motor-form">
          <label>Machine Name<input name="name" required value="${i(t.name)}" placeholder="e.g. Main Pump Motor" /></label>
          <label>Location / Zone<input name="location" required value="${i(t.location)}" placeholder="e.g. Line A" /></label>
          <label>Motor Type<select name="motorType"><option ${t.motorType==="Induction"?"selected":""}>Induction</option><option ${t.motorType==="VFD"?"selected":""}>VFD</option><option ${t.motorType==="Synchronous"?"selected":""}>Synchronous</option></select></label>
          <label>Status<select name="status"><option value="running" ${t.status==="running"?"selected":""}>Running</option><option value="warning" ${t.status==="warning"?"selected":""}>Warning</option><option value="stopped" ${t.status==="stopped"?"selected":""}>Stopped</option></select></label>
          <div class="modal-actions"><button type="button" class="secondary-button" data-action="close-modal">Cancel</button><button class="primary-button" type="submit" ${e.saving?"disabled":""}>${e.saving?"Saving...":"Save Details"}</button></div>
        </form>
      </section>
    </div>
  `}function y(){document.querySelector("#search")?.addEventListener("input",t=>{e.search=t.target.value,r();const a=document.querySelector("#search");a?.focus(),a?.setSelectionRange(e.search.length,e.search.length)}),document.querySelectorAll("[data-action]").forEach(t=>{t.addEventListener("click",async a=>{const n=t.dataset.action;n==="open-create"?(e.editingId="new",e.error="",e.notice="",r()):n==="close-modal"?(a.target===t||t.classList.contains("modal-close"))&&(e.editingId=null,r()):n==="dismiss"?(e.error="",e.notice="",r()):n==="refresh"?await c():n==="edit"?(e.editingId=Number(t.dataset.id),e.error="",r()):n==="delete"&&await w(Number(t.dataset.id))})}),document.querySelector("#motor-form")?.addEventListener("submit",$)}async function c(){e.loading=!0,e.error="",r();try{e.motors=await p("/api/motors")}catch(t){e.error=`${t.message}. Confirm VITE_API_URL is set to ${l} in Vercel.`}finally{e.loading=!1,r()}}async function $(t){t.preventDefault();const a=new FormData(t.currentTarget),n=Object.fromEntries(a.entries()),d=e.editingId==="new";e.saving=!0,e.error="",r();try{await p(d?"/api/motors":`/api/motors/${e.editingId}`,{method:d?"POST":"PATCH",body:JSON.stringify(n)}),e.editingId=null,e.notice=d?"New motor registered.":"Motor details updated.",await c()}catch(s){e.error=`Motor registration failed: ${s.message}`}finally{e.saving=!1,r()}}async function w(t){if(window.confirm("Delete this motor from the registry?")){e.error="";try{await p(`/api/motors/${t}`,{method:"DELETE"}),e.notice="Motor deleted.",await c()}catch(a){e.error=`Motor deletion failed: ${a.message}`,r()}}}r();c();
