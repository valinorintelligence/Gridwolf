#!/usr/bin/env python3
"""Build the FORGE Gridwolf frontend site tree from the pinned original tree.

Why a new asset directory: nginx serves every asset with `Cache-Control: public, immutable` for a
year, so a browser that already holds the original chunks would otherwise mix them with the new
ones (two copies of the main module = two React instances). The transform therefore moves the
whole bundle to `assets-<rev>/` and rewrites every reference, so nothing cached is ever reused.

Only the two pages that showed placeholders are replaced (`LiveCapture`, `Integrations`); every
other chunk is byte-identical apart from the rewritten asset directory in references.

usage: build_frontend.py ORIG_SITE_DIR OUT_SITE_DIR [REV]
"""
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "frontend")
REPLACE = {"LiveCapture-DHH5ZsaW.js": "ForgeLiveCapture-r1.js", "Integrations-BZcEaGbz.js": "ForgeExternalTools-r1.js",
           "Compliance-BYXJaMgi.js": "ForgeCompliance-r1.js", "SecurityScorecard-R0ZMgCPp.js": "ForgeScorecard-r1.js",
           "VulnerabilityManagement-CBW7yFFE.js": "ForgeCveMatching-r1.js",
           "BaselineDrift-D9Q2vtdY.js": "ForgeBaseline-r1.js",
           "Login-CdcMBJLJ.js": "ForgeLogin-r2.js", "Register-B5xTfQ6y.js": "ForgeRegister-r2.js"}
NEW = {"ForgeCommon.js": "ForgeCommon-r1.js", "ForgeLiveCapture.js": "ForgeLiveCapture-r1.js",
       "ForgeExternalTools.js": "ForgeExternalTools-r1.js", "ForgeCompliance.js": "ForgeCompliance-r1.js",
       "ForgeScorecard.js": "ForgeScorecard-r1.js", "ForgeCveMatching.js": "ForgeCveMatching-r1.js",
       "ForgeBaseline.js": "ForgeBaseline-r1.js", "ForgeLogin.js": "ForgeLogin-r2.js",
       "ForgeRegister.js": "ForgeRegister-r2.js", "forge-theme.css": "forge-theme-r2.css",
       "forge-a11y.js": "forge-a11y-r2.js", "ForgeSites.js": "ForgeSites-r1.js"}

# Text patches on retained original chunks: (chunk file, old, new). Each `old` must occur exactly once,
# so a build against a different upstream bundle fails instead of silently skipping a fix.
#
# SINGLE-SITE MODE (default, 2026-11-10): navigation offers Site Overview, Sensors and Site Settings; the header site
# selector, the Sites list/administration page and the cross-site overview wording are not exposed (deferred to the FORGE
# Scalability roadmap). FORGE_MULTI_SITE=1 builds the earlier multi-site navigation again. The backend is the same either way.
MULTI = os.environ.get("FORGE_MULTI_SITE") == "1"
if MULTI:
    NAV_OVERVIEW = "{label:`All Sites Overview`,path:`/sites-overview`,icon:`Boxes`}"
    NAV_ADMIN = "{label:`Sites`,path:`/sites`,icon:`Boxes`},"
    ROUTE_SITES = "{path:`sites-overview`,element:X(gwOv)},{path:`sites`,element:X(gwSt)},"
    HEADER_SELECTOR = "(0,I.jsx)(v.Suspense,{fallback:null,children:(0,I.jsx)(gwSel,{})}),"
else:
    NAV_OVERVIEW = "{label:`Site Overview`,path:`/sites-overview`,icon:`Boxes`}"
    NAV_ADMIN = "{label:`Sensors`,path:`/sensors`,icon:`Server`},{label:`Site Settings`,path:`/site-settings`,icon:`Settings`},"
    ROUTE_SITES = ("{path:`sites-overview`,element:X(gwOv)},{path:`sensors`,element:X(gwSn)},"
                   "{path:`site-settings`,element:X(gwSs)},{path:`sites`,element:X(gwRd)},")
    HEADER_SELECTOR = ""
PATCHES = [
    # AUDIT-20/28 (superseded by AUDIT-35..43, the f4 cookie-session model). The bearer token in localStorage is gone:
    # the session is an HttpOnly cookie; the page only keeps the CSRF token in memory and re-reads it from
    # /auth/session after every reload. A reload or direct URL waits for /auth/session before deciding.
    ("index-BsvjFq8N.js", "user:null,token:null,isAuthenticated:!1,isLoading:!1,login:",
     "user:null,token:null,session:null,isAuthenticated:!1,isLoading:!0,login:"),  # AUDIT-35
    ("index-BsvjFq8N.js", "var Ac=`gridwolf_token`;function jc(e){",  # AUDIT-36
     "var gwCsrf=null;function gwNav(g){let p=window.__gwPerms||[],has=x=>p.includes(x);"
     "return g.map(x=>({group:x.group,items:x.items.filter(i=>i.path===`/sites-overview`||(i.path===`/sites`||i.path===`/sensors`||i.path===`/site-settings`?has(`site_admin`)"
     ":i.path===`/admin`?has(`admin`):i.path===`/reports`?has(`report_view`)||has(`view`):has(`view`)))})).filter(x=>x.items.length)}"
     "function gwSession(d){gwCsrf=d.csrf_token||null;let u=jc(d.user||{}),s=d.sites||[],sl=d.site_list||[];"
     "return u.role=d.role||u.role,u.roleLabel=d.role_label||`No role`,"
     "u.sitesLabel=d.is_platform?`All sites`:sl.length?sl.map(x=>x.name).join(`, `):`No sites`,window.__gwSites=d.is_platform?[]:s,"
     "window.__gwPerms=d.permissions||[],window.__gwSel=d.selected_site||null,{user:u,token:null,"
     "session:{role:d.role,permissions:d.permissions||[],sites:s,allSites:!!d.all_sites,authMethod:d.auth_method,"
     "mfa:!!d.mfa,expiresIn:d.expires_in},isAuthenticated:!0,isLoading:!1}}var Ac=`gridwolf_token`;function jc(e){"),
    ("index-BsvjFq8N.js",  # AUDIT-37: login = cookie set by the backend, then read the session (and CSRF token)
     "localStorage.setItem(Ac,r.access_token),e({token:r.access_token});let{data:i}=await kc.get(`/auth/me`);"
     "e({user:jc(i),isAuthenticated:!0,isLoading:!1})}catch(t){throw e({isLoading:!1}),t}",
     "gwCsrf=r.csrf_token||null;let{data:i}=await kc.get(`/auth/session`);e(gwSession(i))}catch(t){throw e({isLoading:!1}),t}"),
    ("index-BsvjFq8N.js",  # AUDIT-38: logout revokes the server session
     "logout:()=>{localStorage.removeItem(Ac),e({user:null,token:null,isAuthenticated:!1,isLoading:!1})}",
     "logout:async()=>{let n=null;try{let{data:t}=await kc.post(`/auth/logout`);n=t?.logout_url||null}catch{}"
     "gwCsrf=null,e({user:null,token:null,session:null,isAuthenticated:!1,isLoading:!1}),window.location.assign(n||`/login`)}"),
    ("index-BsvjFq8N.js",  # AUDIT-39: the session cookie is the only credential; ask the server who we are
     "loadUser:async()=>{let t=localStorage.getItem(Ac);if(!t){e({isLoading:!1});return}e({token:t,isLoading:!0});"
     "try{let{data:t}=await kc.get(`/auth/me`);e({user:jc(t),isAuthenticated:!0,isLoading:!1})}"
     "catch{localStorage.removeItem(Ac),e({token:null,isAuthenticated:!1,isLoading:!1})}}",
     "loadUser:async()=>{try{let{data:t}=await kc.get(`/auth/session`);e(gwSession(t))}"
     "catch{gwCsrf=null,e({user:null,token:null,session:null,isAuthenticated:!1,isLoading:!1})}}"),
    # AUDIT-40: no bearer token; state-changing requests carry the in-memory CSRF token.
    ("index-BsvjFq8N.js",
     "kc.interceptors.request.use(e=>{let t=localStorage.getItem(Oc);return t&&(e.headers.Authorization=`Bearer ${t}`),e})",
     "kc.interceptors.request.use(e=>(gwCsrf&&!/^(get|head|options)$/i.test(e.method||`get`)&&"
     "(e.headers[`X-CSRF-Token`]=gwCsrf),e))"),
    # AUDIT-41: a 401 on an ordinary request means the session ended (idle, absolute, revoked): go to sign-in once.
    # Calls to /auth/* are handled by their callers (a wrong password, or "not signed in" on the sign-in page),
    # which also prevents a redirect loop on /login. A 403 (role or site) is announced by the layout banner.
    ("index-BsvjFq8N.js", "e.response?.status===401&&(localStorage.removeItem(Oc),window.location.href=`/login`)",
     "e.response?.status===401&&!/\\/auth\\//.test(e.config?.url||``)&&(gwCsrf=null,window.location.pathname!==`/login`&&"
     "(window.location.href=`/login?error=expired&next=${encodeURIComponent(window.location.pathname+window.location.search)}`)),e.response?.status===403&&window.dispatchEvent("
     "new CustomEvent(`gw-forbidden`,{detail:e.response?.data?.detail||``}))"),
    # The sidebar links "Advisory Detail" to /advisory-detail, but the only route is /advisory-detail/:id, so the
    # link fell through to the catch-all and bounced to the dashboard. An advisory is chosen from the Vuln Feed.
    ("index-BsvjFq8N.js", "{path:`advisory-detail/:id`,element:X(Au)},",
     "{path:`advisory-detail`,element:(0,I.jsx)(kn,{to:`/vuln-feed`,replace:!0})},{path:`advisory-detail/:id`,element:X(Au)},"),
    # The stock theme store saves the choice but never reads it back (initTheme is never called), so a reload always
    # returned to dark. Read the saved choice when the store is created.
    ("index-BsvjFq8N.js", "var xa=va((e,t)=>({theme:`dark`,toggleTheme:",
     "var xa=va((e,t)=>({theme:(()=>{let x=localStorage.getItem(ya)===`light`?`light`:`dark`;ba(x);return x})(),toggleTheme:"),
    # AUDIT-46: the API serialises naive UTC datetimes without a zone ("2026-11-09T16:36:57"), which browsers parse as
    # local time: "ago" values went negative or skewed by the viewer's UTC offset. Mark zone-less timestamp fields as UTC.
    ("index-BsvjFq8N.js", "kc.interceptors.response.use(e=>e,e=>(",
     "kc.interceptors.response.use(e=>(e.data=(function g(d,k,n){if(typeof d==`string`)return k&&"
     r"/(_at|_seen|seen|time|timestamp|date)$/i.test(k)&&/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(\.\d+)?$/.test(d)"
     "?d.replace(` `,`T`)+`Z`:d;if(n>8||!d||typeof d!=`object`||!Array.isArray(d)&&Object.getPrototypeOf(d)!==Object.prototype)return d;"
     "if(Array.isArray(d)){for(let i=0;i<d.length;i++)d[i]=g(d[i],k,n+1);return d}"
     "for(let c in d)d[c]=g(d[c],c,n+1);return d})(e.data,``,0),e),e=>("),
    # AUDIT-47: the Timeline and SBOM pages have no data source in this release; say so instead of implying data will appear.
    ("Timeline-DoajLbl3.js", "`Audit log of all security events, changes, and system actions`",
     "`Not connected to an event source in this release. This page does not show security events.`"),
    ("Timeline-DoajLbl3.js", "`No events match the current filters`", "`No event source is connected.`"),
    ("SBOM-CR3a8_Hz.js", "`SBOM data will be available after scanning assets for software components.`",
     "`SBOM generation is not implemented in this release. Passive capture does not identify software components.`"),
    # AUDIT-48: the Live Capture tab calls /ics/pcap/live/* which the backend does not implement (404), and active
    # capture is out of scope; remove the tab so nothing calls those endpoints.
    ("PcapImport-DqCuQ61R.js", ",{id:`live`,label:`Live Capture`,icon:S}]", "]"),
    # AUDIT-49: new sessions and projects carry a site (asked only when the account holds several) and a refused
    # request shows its reason instead of failing silently.
    ("SessionManager-AjBcWu4q.js",
     "Session name:`);e&&_.post(`/ics/sessions/`,{name:e}).then(e=>{v(t=>[e.data,...t])}).catch(()=>{})}",
     "Session name:`);let gs=(window.__gwSites||[]).length>1?window.prompt(`Site (${window.__gwSites.join(`, `)}):`):void 0;"
     "e&&_.post(`/ics/sessions/`,{name:e,site_id:gs||void 0}).then(e=>{v(t=>[e.data,...t])})"
     ".catch(e=>window.alert(String(e?.response?.data?.detail||`The request was refused.`)))}"),
    ("SessionManager-AjBcWu4q.js",
     "Project name:`);e&&_.post(`/ics/sessions/projects`,{name:e}).then(e=>{w(t=>[e.data,...t])}).catch(()=>{})}",
     "Project name:`);let gs=(window.__gwSites||[]).length>1?window.prompt(`Site (${window.__gwSites.join(`, `)}):`):void 0;"
     "e&&_.post(`/ics/sessions/projects`,{name:e,site_id:gs||void 0}).then(e=>{w(t=>[e.data,...t])})"
     ".catch(e=>window.alert(String(e?.response?.data?.detail||`The request was refused.`)))}"),
    # AUDIT-42: layout banner for 403 responses.
    ("index-BsvjFq8N.js", "function Vl(){let{isAuthenticated:e,isLoading:t,loadUser:n}=Mc(),[r,i]=(0,v.useState)(!1),[a,o]",
     "function Vl(){let{isAuthenticated:e,isLoading:t,loadUser:n}=Mc(),[r,i]=(0,v.useState)(!1),[gwF,gwSetF]=(0,v.useState)(``),[a,o]"),
    ("index-BsvjFq8N.js", "s=(0,v.useCallback)(e=>{o(e)},[]);return(0,v.useEffect)(()=>{n()},[n]),",
     "s=(0,v.useCallback)(e=>{o(e)},[]);return(0,v.useEffect)(()=>{n()},[n]),(0,v.useEffect)(()=>{let t=e=>{"
     "gwSetF(/csrf|origin/i.test(String(e.detail||``))?`The security check for this request failed. Reload the page and try again.`"
     ":`Your role or site assignment does not allow this action.`)};return window.addEventListener(`gw-forbidden`,t),"
     "()=>window.removeEventListener(`gw-forbidden`,t)},[]),"),
    ("index-BsvjFq8N.js", "(0,I.jsx)(`div`,{className:`ambient-glow-cyan`,\"aria-hidden\":`true`}),(0,I.jsx)(An,{})",
     "(0,I.jsx)(`div`,{className:`ambient-glow-cyan`,\"aria-hidden\":`true`}),gwF&&(0,I.jsxs)(`div`,{role:`alert`,"
     "className:`mb-4 flex items-center justify-between gap-4 rounded-lg border border-border-default bg-surface-card p-3 text-xs`,"
     "style:{position:`relative`,zIndex:1,color:`var(--content-primary)`},children:[gwF,(0,I.jsx)(`button`,{type:`button`,"
     "className:`text-accent hover:underline`,onClick:()=>gwSetF(``),children:`Dismiss`})]}),(0,I.jsx)(An,{})"),
    # AUDIT-44: a user with several sites chooses which site a new capture belongs to (one site is implied).
    ("PcapImport-DqCuQ61R.js", "t.append(`file`,e);let{data:n}=await y.post(`/ics/pcap/upload`",
     "t.append(`file`,e);let gs=document.getElementById(`gw-site`)?.value;"
     "let{data:n}=await y.post(`/ics/pcap/upload${gs?`?site_id=${encodeURIComponent(gs)}`:``}`"),
    ("PcapImport-DqCuQ61R.js", "(0,T.jsxs)(C,{variant:`primary`,size:`lg`,className:`w-full mt-3`,onClick:async()=>{",
     "(window.__gwSites||[]).length>1&&(0,T.jsxs)(`label`,{className:`mt-3 block text-xs text-content-secondary`,"
     "children:[`Site for this capture`,(0,T.jsx)(`select`,{id:`gw-site`,className:`mt-1 w-full rounded border "
     "border-border-default bg-surface-card p-2 text-sm text-content-primary`,children:(window.__gwSites||[]).map("
     "e=>(0,T.jsx)(`option`,{value:e,children:e},e))})]}),"
     "(0,T.jsxs)(C,{variant:`primary`,size:`lg`,className:`w-full mt-3`,onClick:async()=>{"),
    # MULTI-SITE (f5): site selector in the header, "All Sites Overview" and "Sites" pages, permission-aware navigation, and
    # a landing page that does not call APIs the account may not use (a Report Viewer lands on the Overview).
    ("index-BsvjFq8N.js", "{group:`Overview`,items:[{label:`Command Center`,path:`/`,icon:`LayoutDashboard`}]}",
     "{group:`Overview`,items:[{label:`Command Center`,path:`/`,icon:`LayoutDashboard`},"
     + NAV_OVERVIEW + "]}"),
    ("index-BsvjFq8N.js", "{group:`Administration`,items:[{label:`System Admin`,path:`/admin`,icon:`Settings`}]}",
     "{group:`Administration`,items:[" + NAV_ADMIN + "{label:`System Admin`,path:`/admin`,icon:`Settings`}]}"),
    ("index-BsvjFq8N.js", "children:aa.map(e=>(0,I.jsxs)(`div`,{className:`mb-2`,", "children:gwNav(aa).map(e=>(0,I.jsxs)(`div`,{className:`mb-2`,"),
    ("index-BsvjFq8N.js", "wu=(0,v.lazy)(()=>Y(()=>import(`./C2Detection-Bk2rGomr.js`)",
     "gwOv=(0,v.lazy)(()=>import(`./ForgeSites-r1.js`).then(m=>({default:m.Overview}))),"
     "gwSt=(0,v.lazy)(()=>import(`./ForgeSites-r1.js`).then(m=>({default:m.Sites}))),"
     "gwSel=(0,v.lazy)(()=>import(`./ForgeSites-r1.js`).then(m=>({default:m.SiteSelector}))),"
     "gwSn=(0,v.lazy)(()=>import(`./ForgeSites-r1.js`).then(m=>({default:m.Sensors}))),"
     "gwSs=(0,v.lazy)(()=>import(`./ForgeSites-r1.js`).then(m=>({default:m.SiteSettings}))),"
     "gwRd=(0,v.lazy)(()=>import(`./ForgeSites-r1.js`).then(m=>({default:m.SitesRedirect}))),"
     "gwHome=()=>(window.__gwPerms||[]).includes(`view`)?(0,I.jsx)(Yl,{}):(0,I.jsx)(gwOv,{}),"
     "wu=(0,v.lazy)(()=>Y(()=>import(`./C2Detection-Bk2rGomr.js`)"),
    ("index-BsvjFq8N.js", "{index:!0,element:X(Yl)},{path:`ontology`", "{index:!0,element:X(gwHome)},{path:`ontology`"),
    ("index-BsvjFq8N.js", "{path:`live-capture`,element:X(Cu)},",
     "{path:`live-capture`,element:X(Cu)}," + ROUTE_SITES),
    ("index-BsvjFq8N.js", "(0,I.jsx)(Sa,{}),(0,I.jsx)(`div`,{className:`mx-1 h-6 w-px bg-border-default`})",
     HEADER_SELECTOR + "(0,I.jsx)(Sa,{}),(0,I.jsx)(`div`,{className:`mx-1 h-6 w-px bg-border-default`})"),
    # AUDIT-45: on a narrow screen the 256 px sidebar left 134 px for content and widened every page; start collapsed.
    ("index-BsvjFq8N.js", "try{return localStorage.getItem(ua)===`true`}catch{return!1}",
     "try{return localStorage.getItem(ua)===`true`||window.innerWidth<768}catch{return!1}"),
    # AUDIT-43: show role and site scope in the account menu.
    ("index-BsvjFq8N.js", "children:d?.email})]})",
     "children:d?.email}),(0,I.jsx)(`p`,{className:`text-[10px] text-content-tertiary`,"
     "children:`${d?.roleLabel||``} - ${d?.sitesLabel||``}`})]})"),
    # "Real-time" claims: /ws only echoes and nothing in the UI streams.
    ("index-BsvjFq8N.js", "animationDelay:`0.4s`}}),`Real-time`]})", "animationDelay:`0.4s`}}),`Observe only`]})"),
    ("CommandCenter-ClIFzuhr.js", "`Real-time operational security overview`", "`Operational security overview`"),
    ("SystemAdmin-CNAi22V_.js", "`Real-time resource monitoring`", "`Resource monitoring`"),
    # AUDIT-50: the Browse Files button stopped the click that opens the file chooser (dead control in the original build).
    ("ScanImport-947f8k10.js", "onClick:e=>e.stopPropagation(),children:`Browse Files`",
     "onClick:e=>{e.stopPropagation(),o.current?.click()},children:`Browse Files`"),
    # AUDIT-50: the Diagnostics button has no handler (dead control in the original build).
    ("SystemAdmin-CNAi22V_.js", "size:`sm`,children:[(0,p.jsx)(s,{size:14}),` Diagnostics`]})",
     "size:`sm`,disabled:!0,title:`Not implemented in this release`,children:[(0,p.jsx)(s,{size:14}),` Diagnostics (not implemented)`]})"),
    ("VulnFeed-AoqVTHjM.js",
     "`Real-time intelligence from 7 OT-specific advisory sources with CVSS + KEV + EPSS enrichment`",
     "`CISA KEV advisories with EPSS enrichment. Other listed sources are not implemented.`"),
    # Purdue: stored level is already "L1" (rendered "LL1", so every level showed 0 assets); flow
    # authorization is never computed, so the tiles must not show a fabricated 0.
    ("PurdueModel-XReERMjE.js", "purdueLevel:e.purdue_level==null?`Unknown`:`L${e.purdue_level}`,",
     "purdueLevel:e.purdue_level==null||String(e.purdue_level).toUpperCase()===`UNKNOWN`?`Unknown`:"
     "/^\\d/.test(String(e.purdue_level))?`L${e.purdue_level}`:String(e.purdue_level),"),
    ("PurdueModel-XReERMjE.js", "children:w.filter(e=>e.authorized).length}", "children:`n/a`}"),
    ("PurdueModel-XReERMjE.js", "children:`Authorized Flows`", "children:`Authorized Flows (not assessed)`"),
    ("PurdueModel-XReERMjE.js", "children:A.length}),(0,v.jsx)(`p`,{className:`text-xs text-content-secondary`,children:`Unauthorized Flows`",
     "children:`n/a`}),(0,v.jsx)(`p`,{className:`text-xs text-content-secondary`,children:`Unauthorized Flows (not assessed)`"),
    # C2: beacon scores from passive metadata are indicators, not confirmations.
    ("C2Detection-Bk2rGomr.js", "e===`critical`||e===`confirmed`?", "e===`critical`||e===`strong`?"),
    ("C2Detection-Bk2rGomr.js", "e===`high`||e===`suspected`?", "e===`high`||e===`possible`?"),
    ("C2Detection-Bk2rGomr.js", "g=e=>e>=80?`confirmed`:e>=50?`suspected`:`benign`",
     "g=e=>e>=80?`strong`:e>=50?`possible`:`weak`"),
    ("C2Detection-Bk2rGomr.js", "label:`Confirmed Threats`", "label:`Strong Indicators`"),
    ("C2Detection-Bk2rGomr.js",
     "(0,m.jsx)(`span`,{className:`text-xs text-content-tertiary`,children:`Analysis window: 24h`}),"
     "(0,m.jsxs)(f,{variant:`primary`,size:`sm`,children:[(0,m.jsx)(d,{size:14}),` Re-analyze`]})", "null"),
    # A fixed capability count (not a measurement): finding types emitted by the PCAP engine (6) and the
    # live pipeline (adds protocol_anomaly). tests/test_engine.py::test_emitted_finding_type_inventory
    # derives the list from the source and fails if the count and the code diverge.
    ("ThreatIntelligence-B2NEwHJ6.js", "{label:`Detection Rules`,value:`40+`,",
     "{label:`Finding Types Emitted (fixed list)`,value:`7`,"),
    # Buttons with no handler.
    ("PurdueViolations-B_77kRFB.js", "(0,g.jsxs)(p,{variant:`primary`,size:`sm`,children:[(0,g.jsx)(l,{size:14}),` Re-scan`]})", "null"),
    ("WritePaths-BgSKYs44.js", "(0,v.jsxs)(m,{variant:`primary`,size:`sm`,children:[(0,v.jsx)(l,{size:14}),` Detect Paths`]})", "null"),
    ("ReportDiff-7Y3Hlobw.js", "(0,g.jsxs)(m,{variant:`outline`,size:`sm`,children:[(0,g.jsx)(c,{size:14}),` Export Diff`]})", "null"),
    # Report generator: remove fabricated preview details (date, page/size estimates, TOC page numbers),
    # send the selected classification to the server, make the format list non-interactive and truthful.
    ("ReportGenerator-CFYgqWkt.js", "children:`March 15, 2024`", "children:new Date().toISOString().slice(0,10)"),
    ("ReportGenerator-CFYgqWkt.js", "children:(t+1)*3+1})", "children:``})"),
    ("ReportGenerator-CFYgqWkt.js",
     "(0,w.jsxs)(`span`,{children:[`~`,E.filter(e=>O[e.id]).length*4+2,` pages`]}),(0,w.jsxs)(`span`,{children:[`~`,(E.filter(e=>O[e.id]).length*.4+.5).toFixed(1),` MB`]})",
     "(0,w.jsx)(`span`,{children:`Length depends on the data`})"),
    ("ReportGenerator-CFYgqWkt.js", "Professional multi-section report with charts and topology maps",
     "Multi-section assessment report (no charts or topology maps)"),
    ("ReportGenerator-CFYgqWkt.js", "Generate professional PDF reports from passive network analysis",
     "Generate assessment reports from passive network analysis (PDF when the server supports it, otherwise print-ready HTML)"),
    ("ReportGenerator-CFYgqWkt.js", "Report generation started. Refreshing list...", "Report generated. Refreshing list..."),
    ("ReportGenerator-CFYgqWkt.js", "sections:Object.entries(O).filter(([,e])=>e).map(([e])=>e)};await v.post",
     "sections:Object.entries(O).filter(([,e])=>e).map(([e])=>e),classification:P};await v.post"),
    ("ReportGenerator-CFYgqWkt.js", "D.map(e=>(0,w.jsxs)(`button`,{className:`w-full flex items-start",
     "D.map(e=>(0,w.jsxs)(`div`,{className:`w-full flex items-start"),
    ("ReportGenerator-CFYgqWkt.js", "Flow classification with firewall rule generation", "Not implemented in this build"),
    # AUDIT-32: controls without handlers. Write Paths per-card actions are removed; Export CSV on Vuln Feed downloads
    # the server CSV; "Go to Reports" navigates.
    ("WritePaths-BgSKYs44.js", "(0,v.jsxs)(m,{variant:`outline`,size:`sm`,className:`text-xs`,children:[(0,v.jsx)(t,{size:10}),` Inspect Flow`]})", "null"),
    ("WritePaths-BgSKYs44.js", "(0,v.jsxs)(m,{variant:`outline`,size:`sm`,className:`text-xs`,children:[(0,v.jsx)(g,{size:10}),` Map to Policy`]})", "null"),
    ("WritePaths-BgSKYs44.js", "(0,v.jsxs)(m,{variant:`outline`,size:`sm`,className:`text-xs ml-auto`,children:[(0,v.jsx)(i,{size:10}),` Log Entry`]})", "null"),
    ("WritePaths-BgSKYs44.js", "(0,v.jsxs)(`div`,{className:`flex gap-3 pt-2 border-t border-border-default`,children:[null,null,null]})", "null"),
    ("VulnFeed-AoqVTHjM.js",
     "(0,w.jsxs)(`button`,{className:`flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-sm`,children:[(0,w.jsx)(h,{size:14}),` Export CSV`]})",
     "(0,w.jsxs)(`button`,{onClick:async()=>{try{let t=await re.get(`/ics/advisories/export/csv`,{responseType:`blob`}),n=window.URL.createObjectURL(new Blob([t.data],{type:`text/csv`})),r=document.createElement(`a`);r.href=n,r.download=`gridwolf_advisories.csv`,document.body.appendChild(r),r.click(),document.body.removeChild(r),window.URL.revokeObjectURL(n)}catch{alert(`Advisory export failed.`)}},className:`flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-sm`,children:[(0,w.jsx)(h,{size:14}),` Export CSV`]})"),
    ("ExportHub-DUqyZAra.js", "(0,D.jsx)(C,{variant:`secondary`,size:`sm`,className:`w-full`,icon:(0,D.jsx)(r,{className:`h-3.5 w-3.5`}),children:`Go to Reports`})",
     "(0,D.jsx)(C,{variant:`secondary`,size:`sm`,className:`w-full`,icon:(0,D.jsx)(r,{className:`h-3.5 w-3.5`}),onClick:()=>{window.location.assign(`/reports`)},children:`Go to Reports`})"),
    # AUDIT-34: row/card action buttons that have no handler at all are removed (Sessions rows, PCAP recent-uploads rows,
    # Investigations Share/Archive/overflow); copy no longer claims SQLite storage (live uses PostgreSQL).
    ("SessionManager-AjBcWu4q.js", '(0,S.jsxs)(`div`,{className:`flex items-center gap-1`,children:[(0,S.jsx)(`button`,{className:`p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent`,title:`Open`,children:(0,S.jsx)(r,{size:14})}),(0,S.jsx)(`button`,{className:`p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent`,title:`Export .kkj`,children:(0,S.jsx)(u,{size:14})}),!t.baseline&&(0,S.jsx)(`button`,{className:`p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-blue-400`,title:`Set as Baseline`,children:(0,S.jsx)(s,{size:14})}),(0,S.jsx)(`button`,{className:`p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent`,title:`Archive`,children:(0,S.jsx)(e,{size:14})}),(0,S.jsx)(`button`,{className:`p-1.5 rounded hover:bg-surface-hover text-content-tertiary hover:text-red-400`,title:`Delete`,children:(0,S.jsx)(o,{size:14})})]})', "null"),
    ("SessionManager-AjBcWu4q.js", "` Sessions stored in SQLite · `,(0,S.jsx)(b,{size:12}),` Export as .kkj (portable ZIP archive)`", "` Sessions stored on the Gridwolf server`"),
    ("PcapImport-DqCuQ61R.js", '(0,T.jsxs)(`div`,{className:`flex items-center gap-1 justify-end`,children:[(0,T.jsx)(`button`,{className:`p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent`,children:(0,T.jsx)(r,{size:14})}),(0,T.jsx)(`button`,{className:`p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent`,children:(0,T.jsx)(s,{size:14})}),(0,T.jsx)(`button`,{className:`p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-red-400`,children:(0,T.jsx)(c,{size:14})})]})', "null"),
    ("Investigations-D47I4U65.js", '(0,b.jsxs)(h,{variant:`outline`,size:`sm`,className:`text-xs flex-1`,children:[(0,b.jsx)(v,{size:10}),` Share`]})', "null"),
    ("Investigations-D47I4U65.js", '(0,b.jsxs)(h,{variant:`outline`,size:`sm`,className:`text-xs flex-1`,children:[(0,b.jsx)(e,{size:10}),` Archive`]})', "null"),
    ("Investigations-D47I4U65.js", '(0,b.jsx)(`button`,{className:`px-2 py-1.5 rounded border border-border-default hover:bg-surface-hover`,children:(0,b.jsx)(g,{size:12,className:`text-content-tertiary`})})', "null"),
    # AUDIT-31: the page expected a bare list but the API returns {count, advisories}, so it always showed an
    # empty feed; Refresh Feed only re-read the list instead of triggering a refresh; disposition and dismiss
    # were never saved.
    ("VulnFeed-AoqVTHjM.js", "m((Array.isArray(t.data)?t.data:[]).map(",
     "m((Array.isArray(t.data)?t.data:Array.isArray(t.data?.advisories)?t.data.advisories:[]).map("),
    ("VulnFeed-AoqVTHjM.js", "le=(e,t)=>{m(n=>n.map(n=>n.id===e?{...n,disposition:t}:n))}",
     "le=(e,t)=>{m(n=>n.map(n=>n.id===e?{...n,disposition:t}:n)),re.patch(`/ics/advisories/${e}/disposition`,{disposition:t}).catch(()=>X())}"),
    ("VulnFeed-AoqVTHjM.js", "ue=e=>{m(t=>t.map(t=>t.id===e?{...t,dismissed:!t.dismissed}:t))}",
     "ue=e=>{let t=!s.find(t=>t.id===e)?.dismissed;m(n=>n.map(n=>n.id===e?{...n,dismissed:t}:n)),re.post(`/ics/advisories/${e}/dismiss`,{dismissed:t}).catch(()=>X())}"),
    ("VulnFeed-AoqVTHjM.js", "$=()=>{Y(!0),X(),setTimeout(()=>Y(!1),1e3)}",
     "$=async()=>{Y(!0);let n=null;try{let t=await re.post(`/ics/advisories/refresh`);t.data?.errors?.length&&(n=`Feed refresh: `+t.data.errors.join(`; `))}catch(t){n=t?.response?.data?.detail||`Feed refresh failed`}X(),n&&j(n),Y(!1)}"),
    # AUDIT-30: row actions without handlers (preview, delete) are removed; download failures are reported;
    # the fabricated default assessment date is dropped and the unsent field is labelled.
    ("ReportGenerator-CFYgqWkt.js",
     ",(0,w.jsx)(`button`,{className:`p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-red-400`,children:(0,w.jsx)(u,{size:14})})", ""),
    ("ReportGenerator-CFYgqWkt.js",
     ",(0,w.jsx)(`button`,{className:`p-1 rounded hover:bg-surface-hover text-content-tertiary hover:text-accent disabled:opacity-30`,disabled:e.status!==`ready`,children:(0,w.jsx)(a,{size:14})})", ""),
    ("ReportGenerator-CFYgqWkt.js", "document.body.removeChild(i),window.URL.revokeObjectURL(r)}catch{}}",
     "document.body.removeChild(i),window.URL.revokeObjectURL(r)}catch{alert(`Report download failed.`)}}"),
    ("ReportGenerator-CFYgqWkt.js", "type:`date`,defaultValue:`2024-03-15`,", "type:`date`,"),
    ("ReportGenerator-CFYgqWkt.js", "`Assessment Date`]", "`Assessment Date (not included in the report)`]"),
    # Export Hub: the allowlist generator and filtered PCAP export do not exist.
    ("ExportHub-DUqyZAra.js", "Firewall rules will be generated from real findings data once a PCAP capture has been analyzed.",
     "Not implemented in this build. Firewall rules are not generated from passive observations; review observed communication pairs in the Connections CSV export."),
    ("ExportHub-DUqyZAra.js", "className:`w-full`,icon:(0,D.jsx)(d,{className:`h-3.5 w-3.5`}),children:`Export Filtered PCAP`})",
     "className:`w-full`,icon:(0,D.jsx)(d,{className:`h-3.5 w-3.5`}),disabled:!0,children:`Export Filtered PCAP (not implemented)`})"),
]
_BY_FILE = {}
for _f, _o, _n in PATCHES:
    _BY_FILE.setdefault(_f, []).append((_o, _n))


def patched(name, body):
    for old, new in _BY_FILE.get(name, []):
        if body.count(old) != 1:
            raise SystemExit("patch target in %s found %d times, expected once: %.70s" % (name, body.count(old), old))
        body = body.replace(old, new)
    return body
TEXT = (".js", ".css", ".html")


def inject(html, adir):
    """Link the FORGE theme after the stock stylesheet and load the accessibility helper."""
    css = '<link rel="stylesheet" href="/%s/forge-theme-r2.css">' % adir
    js = '<script defer src="/%s/forge-a11y-r2.js"></script>' % adir
    if "</head>" not in html:
        raise SystemExit("index.html has no </head>")
    return html.replace("</head>", "    %s\n    %s\n  </head>" % (css, js), 1)


def build(orig, out, rev="f1"):
    adir = "assets-" + rev
    if os.path.exists(out):
        raise SystemExit("output exists: " + out)
    os.makedirs(os.path.join(out, adir))
    names = sorted(os.listdir(os.path.join(orig, "assets")))
    final = sorted({REPLACE.get(n, n) for n in names} | set(NEW.values()), key=lambda n: (-len(n), n))
    ref = re.compile(r"assets/(" + "|".join(re.escape(n) for n in final) + r")(?![A-Za-z0-9_.-])")

    def rewrite(text):
        for old, new in REPLACE.items():
            text = text.replace(old, new)
        return ref.sub(lambda m: adir + "/" + m.group(1), text)

    for n in names:
        src = os.path.join(orig, "assets", n)
        if n in REPLACE:
            continue                                    # replaced page chunks are not carried over
        dst = os.path.join(out, adir, n)
        if n.endswith(TEXT):
            with open(src, encoding="utf-8") as f:
                body = rewrite(patched(n, f.read()))
            with open(dst, "w", encoding="utf-8") as f:
                f.write(body)
        else:
            shutil.copyfile(src, dst)
    unvisited = sorted(set(_BY_FILE) - set(names) | {f for f in _BY_FILE if f in REPLACE})
    if unvisited:
        raise SystemExit("patch target chunk missing or replaced: " + ", ".join(unvisited))
    for n, new in NEW.items():
        shutil.copyfile(os.path.join(SRC, n), os.path.join(out, adir, new))
    for n in os.listdir(orig):
        if n == "assets":
            continue
        s, d = os.path.join(orig, n), os.path.join(out, n)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        elif n.endswith(".html"):
            with open(s, encoding="utf-8") as f:
                body = rewrite(f.read())
            if n == "index.html":
                body = inject(body, adir)
            with open(d, "w", encoding="utf-8") as f:
                f.write(body)
        else:
            shutil.copyfile(s, d)
    check(out, adir)
    return adir


def check(out, adir):
    """The transform must leave no reference to the original directory or the replaced chunks."""
    problems = []
    for root, _, files in os.walk(out):
        for n in files:
            if not n.endswith(TEXT):
                continue
            with open(os.path.join(root, n), encoding="utf-8") as f:
                body = f.read()
            for old in REPLACE:
                if old in body:
                    problems.append("%s still references %s" % (n, old))
            for m in re.finditer(r"(?<![A-Za-z0-9_-])assets/([A-Za-z0-9_.-]+\.(?:js|css))", body):
                problems.append("%s: unrewritten reference %s" % (n, m.group(0)))
    index = open(os.path.join(out, "index.html"), encoding="utf-8").read()
    if adir + "/index-" not in index:
        problems.append("index.html does not point at the new asset directory")
    main = [n for n in os.listdir(os.path.join(out, adir)) if n.startswith("index-") and n.endswith(".js")][0]
    body = open(os.path.join(out, adir, main), encoding="utf-8").read()
    for new in REPLACE.values():
        if body.count(new) < 2:
            problems.append("main bundle should reference %s as import and preload dependency" % new)
    if problems:
        raise SystemExit("frontend transform check failed:\n  " + "\n  ".join(problems[:20]))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    print("built", build(sys.argv[1], sys.argv[2], *(sys.argv[3:4])))
