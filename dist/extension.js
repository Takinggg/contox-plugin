"use strict";var qe=Object.create;var ee=Object.defineProperty;var Je=Object.getOwnPropertyDescriptor;var Ye=Object.getOwnPropertyNames;var Xe=Object.getPrototypeOf,Qe=Object.prototype.hasOwnProperty;var Ze=(i,e)=>{for(var t in e)ee(i,t,{get:e[t],enumerable:!0})},Ce=(i,e,t,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of Ye(e))!Qe.call(i,s)&&s!==t&&ee(i,s,{get:()=>e[s],enumerable:!(o=Je(e,s))||o.enumerable});return i};var l=(i,e,t)=>(t=i!=null?qe(Xe(i)):{},Ce(e||!i||!i.__esModule?ee(t,"default",{value:i,enumerable:!0}):t,i)),et=i=>Ce(ee({},"__esModule",{value:!0}),i);var jt={};Ze(jt,{activate:()=>It,deactivate:()=>Pt,getWorkspaceConfig:()=>j});module.exports=et(jt);var f=l(require("vscode")),U=l(require("fs")),Q=l(require("path"));var oe=l(require("crypto")),se=l(require("vscode"));function be(){let i=se.env.appName.toLowerCase();return i.includes("cursor")?"cursor":i.includes("windsurf")?"windsurf":i.includes("antigravity")?"antigravity":"vscode"}var te=class{constructor(e){this.secrets=e;let t=se.workspace.getConfiguration("contox");this.baseUrl=t.get("apiUrl","https://contox.dev")}baseUrl;apiKey;async setApiKey(e){this.apiKey=e,await this.secrets.store("contox-api-key",e)}async getApiKey(){return this.apiKey||(this.apiKey=await this.secrets.get("contox-api-key")),this.apiKey}async clearApiKey(){this.apiKey=void 0,await this.secrets.delete("contox-api-key")}async request(e,t={}){let o=await this.getApiKey();if(!o)return{error:'Not authenticated. Run "Contox: Login" first.'};let s=`${this.baseUrl}/api${e}`;try{let n=await fetch(s,{...t,headers:{"Content-Type":"application/json",Authorization:`Bearer ${o}`,...t.headers}});if(!n.ok){let a=await n.json().catch(()=>({}));return{error:typeof a.error=="string"?a.error:n.statusText}}return{data:await n.json()}}catch(n){return{error:n instanceof Error?n.message:"Unknown error"}}}async listContexts(e){let t=[],o=0,s=100;for(;;){let n=await this.request(`/integrations/vscode?projectId=${encodeURIComponent(e)}&limit=${s}&offset=${o}`);if(n.error)return{error:n.error};let r=n.data?.contexts??[];if(t.push(...r),r.length<s||t.length>=(n.data?.total??0))break;o+=s}return{data:t}}async listContextTree(e,t){return this.getBrain(t)}async getContext(e){return this.request(`/contexts/${encodeURIComponent(e)}`)}async createContext(e,t,o,s){return this.request("/contexts",{method:"POST",body:JSON.stringify({name:e,teamId:t,projectId:o,description:s})})}async updateContext(e,t){return this.request(`/contexts/${encodeURIComponent(e)}`,{method:"PATCH",body:JSON.stringify(t)})}async syncContent(e,t){return this.request("/integrations/vscode",{method:"POST",body:JSON.stringify({contextId:e,content:t})})}async listTeams(){let e=await this.request("/orgs");return e.error?{error:e.error}:{data:e.data?.orgs??[]}}async listProjects(e){return this.request(`/projects?teamId=${encodeURIComponent(e)}`)}async getProjectHmacSecret(e){return this.request(`/projects/${encodeURIComponent(e)}/hmac-secret`)}async getBrain(e){return this.request(`/v2/brain?projectId=${encodeURIComponent(e)}`)}async searchMemory(e,t,o=10){return this.request(`/v2/search?projectId=${encodeURIComponent(e)}&q=${encodeURIComponent(t)}&limit=${o}&minSimilarity=0.5`)}async listSessions(e,t=5){return this.request(`/v2/sessions?projectId=${encodeURIComponent(e)}&limit=${t}`)}async getSessionJobs(e){return this.request(`/v2/sessions/${encodeURIComponent(e)}/jobs`)}async closeSession(e){return this.request(`/v2/sessions/${encodeURIComponent(e)}`,{method:"PATCH",body:JSON.stringify({status:"closed"})})}async getActiveSession(e){let t=await this.listSessions(e,5);return t.error?{error:t.error}:{data:t.data?.sessions.find(s=>s.status==="active")??null}}async createSession(e,t=be()){return this.request("/v2/sessions",{method:"POST",body:JSON.stringify({projectId:e,source:t})})}async ingestEvents(e,t,o){let s=JSON.stringify(t),n=new Date().toISOString(),r=oe.randomBytes(16).toString("hex"),a=oe.createHmac("sha256",o).update(s).digest("hex"),c={source:be(),timestamp:n,nonce:r,signature:a,projectId:e,event:t,skipEnrichment:!0},m=await this.getApiKey();if(!m)return{error:'Not authenticated. Run "Contox: Login" first.'};let p=`${this.baseUrl}/api/v2/ingest`;try{let d=await fetch(p,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${m}`},body:JSON.stringify(c)});if(!d.ok){let g=await d.json().catch(()=>({}));return{error:typeof g.error=="string"?g.error:d.statusText}}return{data:await d.json()}}catch(d){return{error:d instanceof Error?d.message:"Unknown error"}}}};var P=l(require("vscode")),tt={"root/decisions":"lightbulb","root/conventions":"list-ordered","root/architecture":"server","root/journal":"notebook","root/bugs":"bug","root/todo":"checklist","root/codemap":"file-code","root/stack":"layers","root/frontend":"browser","root/backend":"server-process"};function ot(i){let e=tt[i.schemaKey];return e?new P.ThemeIcon(e):i.children.length>0?new P.ThemeIcon("symbol-namespace"):new P.ThemeIcon("symbol-field")}var ie=class extends P.TreeItem{node;constructor(e){let t=e.children.length>0?P.TreeItemCollapsibleState.Collapsed:P.TreeItemCollapsibleState.None;super(e.name,t),this.node=e,this.tooltip=`${e.schemaKey}
${e.itemCount} memory items`,this.description=e.itemCount>0?`${e.itemCount} items`:"",this.iconPath=ot(e),this.contextValue="contoxContext"}},ne=class{constructor(e){this._client=e}_onDidChangeTreeData=new P.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;rootNodes=[];total=0;setTree(e,t){this.rootNodes=e,this.total=t,this._onDidChangeTreeData.fire()}getTotal(){return this.total}getTreeItem(e){return e}getChildren(e){return e?e.node.children.map(t=>new ie(t)):this.rootNodes.map(t=>new ie(t))}};var D=l(require("vscode"));function st(i){let e=Date.now()-new Date(i).getTime(),t=Math.floor(e/1e3);if(t<60)return"just now";let o=Math.floor(t/60);if(o<60)return`${o}m ago`;let s=Math.floor(o/60);return s<24?`${s}h ago`:`${Math.floor(s/24)}d ago`}var re=class{item;lastSaveIso=null;refreshTimer;constructor(){this.item=D.window.createStatusBarItem(D.StatusBarAlignment.Left,100),this.item.command="contox.sync",this.setIdle(),this.item.show(),this.refreshTimer=setInterval(()=>{this.lastSaveIso&&this.setLastSave(this.lastSaveIso)},3e4)}setIdle(){this.item.text="$(cloud) Contox",this.item.tooltip="Click to sync contexts",this.item.backgroundColor=void 0}setSyncing(){this.item.text="$(sync~spin) Contox: Syncing...",this.item.tooltip="Syncing contexts...",this.item.backgroundColor=void 0}setSynced(){this.item.text="$(cloud) Contox: Synced",this.item.tooltip="Contexts synced \u2014 click to refresh",this.item.backgroundColor=void 0}setError(){this.item.text="$(error) Contox: Error",this.item.tooltip="Sync failed \u2014 click to retry",this.item.backgroundColor=new D.ThemeColor("statusBarItem.errorBackground")}setLastSave(e){this.lastSaveIso=e;let t=st(e);this.item.text=`$(cloud) Contox: saved ${t}`,this.item.tooltip=`Last save: ${new Date(e).toLocaleString()}
Click to sync`,this.item.backgroundColor=void 0}setPipeline(e){let{completedSteps:t,totalSteps:o,status:s}=e;switch(s){case"running":this.item.text=`$(sync~spin) Contox: pipeline ${t}/${o}`,this.item.tooltip=`Pipeline running \u2014 ${t}/${o} steps complete`,this.item.backgroundColor=void 0;break;case"done":this.item.text="$(check) Contox: pipeline done",this.item.tooltip=`Pipeline complete \u2014 ${o} steps`,this.item.backgroundColor=void 0;break;case"failed":this.item.text="$(error) Contox: pipeline failed",this.item.tooltip=`Pipeline failed \u2014 ${t}/${o} steps completed`,this.item.backgroundColor=new D.ThemeColor("statusBarItem.warningBackground");break;default:this.item.text="$(clock) Contox: pipeline pending",this.item.tooltip="Pipeline pending...",this.item.backgroundColor=void 0}}setDisconnected(){this.item.text="$(debug-disconnect) Contox: Disconnected",this.item.tooltip="Sync paused \u2014 click to reconnect",this.item.command="contox.connect",this.item.backgroundColor=new D.ThemeColor("statusBarItem.warningBackground")}setCapturing(e,t){let o=Math.floor(e/60),s=e%60,n=o>0?`${o}m ${String(s).padStart(2,"0")}s`:`${s}s`;this.item.text=`$(record) Contox: ${n} \xB7 ${t} events`,this.item.tooltip=`Capturing work activity
${t} events buffered
Click to send now`,this.item.command="contox.flushCapture",this.item.backgroundColor=void 0}dispose(){this.refreshTimer&&clearInterval(this.refreshTimer),this.item.dispose()}};var z=l(require("vscode")),it=3e4,nt=5e3,rt={enrich:"Enrichment",embed:"Embedding",dedup:"Deduplication",drift_check:"Drift Check"};var ae=class{constructor(e,t){this.client=e;this.statusBar=t}sessionsTimer;pipelineTimer;knownSessionIds=new Set;isFirstPoll=!0;activeSessionId=null;trackedActiveSessionId=null;lastSaveTime=null;projectId=null;disposed=!1;gitWatcher=null;setGitWatcher(e){this.gitWatcher=e}start(e){this.stop(),this.projectId=e,this.isFirstPoll=!0,this.knownSessionIds.clear(),this.pollSessions(),this.sessionsTimer=setInterval(()=>{this.pollSessions()},it)}stop(){this.sessionsTimer&&(clearInterval(this.sessionsTimer),this.sessionsTimer=void 0),this.stopPipelinePolling(),this.projectId=null}stopPipelinePolling(){this.pipelineTimer&&(clearInterval(this.pipelineTimer),this.pipelineTimer=void 0),this.activeSessionId=null}async pollSessions(){if(this.disposed||!this.projectId)return;let e=await this.client.listSessions(this.projectId,5);if(e.error||!e.data)return;let t=e.data.sessions;if(t.length>0){let s=t[0];this.lastSaveTime=s.updatedAt,this.statusBar.setLastSave(this.lastSaveTime)}let o=t.find(s=>s.status==="active");if(this.isFirstPoll){for(let s of t)this.knownSessionIds.add(s.id);this.trackedActiveSessionId=o?.id??null,this.isFirstPoll=!1;return}this.trackedActiveSessionId&&!o?(console.log("[SessionWatcher] Active session closed externally \u2014 creating new session"),this.gitWatcher?.resetBuffer(),this.client.createSession(this.projectId).then(s=>{!s.error&&s.data&&(this.trackedActiveSessionId=s.data.sessionId,this.knownSessionIds.add(s.data.sessionId),z.window.showInformationMessage("Contox: Session closed externally \u2014 new session started."))})):this.trackedActiveSessionId=o?.id??null;for(let s of t)this.knownSessionIds.has(s.id)||(this.knownSessionIds.add(s.id),this.onNewSession(s))}onNewSession(e){let t="New session saved";if(e.summary)try{let n=JSON.parse(e.summary);typeof n.executiveSummary=="string"&&(t=n.executiveSummary)}catch{t=e.summary}let o=t.length>120?t.slice(0,117)+"...":t,s=e.source==="mcp-server"?"MCP":e.source==="cli-auto"?"CLI":e.source??"unknown";z.window.showInformationMessage(`$(cloud-upload) Contox: Session saved (${s}) \u2014 ${o}`,"View Pipeline","Dismiss").then(n=>{n==="View Pipeline"&&this.startPipelinePolling(e.id)}),this.lastSaveTime=e.updatedAt,this.statusBar.setLastSave(this.lastSaveTime),this.startPipelinePolling(e.id)}startPipelinePolling(e){this.stopPipelinePolling(),this.activeSessionId=e,this.pollPipeline(),this.pipelineTimer=setInterval(()=>{this.pollPipeline()},nt)}async pollPipeline(){if(this.disposed||!this.activeSessionId)return;let e=await this.client.getSessionJobs(this.activeSessionId);if(e.error||!e.data)return;let{jobs:t,pipeline:o}=e.data;if(this.statusBar.setPipeline(o),o.status==="done"||o.status==="failed"){this.stopPipelinePolling();let s=t.map(n=>{let r=n.status==="done"?"\u2713":n.status==="failed"?"\u2717":"\u25CB",a=rt[n.jobType]??n.jobType;return`${r} ${a}`}).join("  ");if(o.status==="done")z.window.showInformationMessage(`$(check) Contox pipeline complete: ${s}`);else{let n=t.find(a=>a.status==="failed"),r=n?.lastError?` \u2014 ${n.lastError.slice(0,80)}`:"";z.window.showWarningMessage(`$(warning) Contox pipeline failed: ${s}${r}`)}this.lastSaveTime&&this.statusBar.setLastSave(this.lastSaveTime)}}dispose(){this.disposed=!0,this.stop()}};var y=l(require("vscode")),ke=require("child_process"),Ie=require("util"),L=(0,Ie.promisify)(ke.execFile),at=15*60*1e3,ct=15*60*1e3,dt=50,lt=100*1024,Se=3e3,ut=5e3,pt=[/package-lock\.json$/,/yarn\.lock$/,/pnpm-lock\.yaml$/,/bun\.lockb$/,/\.lock$/,/\.min\.(js|css)$/,/\.map$/,/\.wasm$/,/\.png|\.jpg|\.jpeg|\.gif|\.ico|\.svg$/,/\.woff2?$/,/\.ttf$/,/\.eot$/],ce=class{constructor(e,t,o){this.client=e;this.statusBar=t;this.secrets=o}projectId=null;lastKnownHead=null;buffer=null;disposed=!1;idleTimer;autoFlushTimer;captureTickTimer;gitStateDisposable;fileSaveDisposable;start(e){this.disposed||!y.workspace.getConfiguration("contox").get("capture.enabled",!0)||(this.projectId=e,this.initBuffer(),this.watchGitState(),this.watchFileSaves(),this.startTimers())}resetBuffer(){this.initBuffer()}stop(){this.clearTimers(),this.gitStateDisposable?.dispose(),this.gitStateDisposable=void 0,this.fileSaveDisposable?.dispose(),this.fileSaveDisposable=void 0,this.projectId=null}async flush(){if(!this.buffer||!this.projectId||this.buffer.commits.length===0&&this.buffer.filesModified.size===0)return;let e=await this.getHmacSecret();if(!e){console.warn("[GitWatcher] No HMAC secret configured \u2014 skipping flush");return}let t={type:"vscode_capture",commits:this.buffer.commits,filesModified:[...this.buffer.filesModified],sessionDurationMs:Date.now()-this.buffer.sessionStartTime,activeEditorFiles:[...this.buffer.activeEditorFiles]},o=await this.client.ingestEvents(this.projectId,t,e);if(o.error)console.error("[GitWatcher] Ingest failed:",o.error),y.window.showWarningMessage(`Contox: Failed to send captured events \u2014 ${o.error}`);else{let s=this.buffer.commits.length,n=this.buffer.filesModified.size;console.log(`[GitWatcher] Flushed: ${s} commits, ${n} files`)}this.initBuffer()}getEventCount(){return this.buffer?.eventCount??0}getSessionDurationMs(){return this.buffer?Date.now()-this.buffer.sessionStartTime:0}async endSession(){if(!this.projectId)return{closed:!1};await this.flush();let e=await this.client.getActiveSession(this.projectId);if(e.error||!e.data)return{closed:!1};if((await this.client.closeSession(e.data.id)).error)return{closed:!1};this.initBuffer();let o,s=await this.client.createSession(this.projectId);return!s.error&&s.data&&(o=s.data.sessionId),{closed:!0,sessionId:e.data.id,newSessionId:o}}watchGitState(){this.gitStateDisposable?.dispose(),this.startGitPolling();try{let e=y.extensions.getExtension("vscode.git");if(!e){console.warn("[GitWatcher] Git extension not found \u2014 using polling only");return}let t=e.isActive?e.exports.getAPI(1):null;if(!t||!t.repositories||t.repositories.length===0){console.warn("[GitWatcher] No git repositories found \u2014 using polling only");return}let o=t.repositories[0];this.lastKnownHead=o.state?.HEAD?.commit??null,this.gitStateDisposable=o.state.onDidChange(()=>{this.onGitStateChanged(o)}),console.log("[GitWatcher] Git extension connected + polling safety net active")}catch{console.warn("[GitWatcher] Failed to access git extension \u2014 using polling only")}}async onGitStateChanged(e){if(this.disposed||!this.buffer)return;let t=e.state?.HEAD?.commit??null;if(!t||t===this.lastKnownHead)return;let o=this.lastKnownHead;this.lastKnownHead=t,o?await this.captureNewCommits(o,t):await this.captureCommit(t),console.log("[GitWatcher] Commit detected \u2014 auto-flushing"),await this.flush(),this.checkForPush()}async checkForPush(){let e=this.getWorkspaceRoot();if(!(!e||!this.buffer||this.buffer.eventCount===0))try{let{stdout:t}=await L("git",["rev-parse","HEAD"],{cwd:e}),{stdout:o}=await L("git",["rev-parse","@{u}"],{cwd:e});t.trim()===o.trim()&&(console.log("[GitWatcher] Push detected \u2014 auto-flushing"),await this.flush())}catch{}}gitPollTimer;startGitPolling(){this.gitPollTimer||(console.log("[GitWatcher] Starting git HEAD polling (5s interval)"),this.pollGitHead(),this.gitPollTimer=setInterval(()=>{this.pollGitHead()},5e3))}async pollGitHead(){if(this.disposed||!this.buffer)return;let e=this.getWorkspaceRoot();if(!e){console.warn("[GitWatcher] pollGitHead: no workspace root");return}try{let{stdout:t}=await L("git",["rev-parse","HEAD"],{cwd:e}),o=t.trim();this.lastKnownHead||console.log(`[GitWatcher] pollGitHead: initial HEAD = ${o.slice(0,8)}`),this.lastKnownHead&&o!==this.lastKnownHead&&(console.log(`[GitWatcher] Commit detected (poll): ${this.lastKnownHead.slice(0,8)} \u2192 ${o.slice(0,8)}`),await this.captureNewCommits(this.lastKnownHead,o),console.log("[GitWatcher] Commit captured \u2014 auto-flushing"),await this.flush()),this.lastKnownHead=o}catch{}}async captureNewCommits(e,t){let o=this.getWorkspaceRoot();if(!(!o||!this.buffer))try{let{stdout:s}=await L("git",["log",`${e}..${t}`,"--format=%H|%s|%an|%aI","--no-merges"],{cwd:o}),n=s.trim().split(`
`).filter(Boolean);for(let r of n){let[a,c,m,p]=r.split("|");a&&await this.captureCommitDetails(o,a,c??"",m??"",p??"")}}catch{await this.captureCommit(t)}}async captureCommit(e){let t=this.getWorkspaceRoot();if(!(!t||!this.buffer))try{let{stdout:o}=await L("git",["log","-1",e,"--format=%s|%an|%aI"],{cwd:t}),[s,n,r]=o.trim().split("|");await this.captureCommitDetails(t,e,s??"",n??"",r??"")}catch{}}async captureDiffContext(e,t){if(y.workspace.getConfiguration("contox").get("capture.includeDiffs",!0))try{let{stdout:n}=await L("git",["diff-tree","-p","-U4","--no-commit-id",t],{cwd:e,timeout:ut,maxBuffer:524288});if(!n||n.trim().length===0)return;let r=this.filterExcludedDiffs(n);return!r||r.length===0?void 0:r.length>Se?r.slice(0,Se):r}catch{return}}filterExcludedDiffs(e){let t=e.split(/^(?=diff --git )/m),o=[];for(let s of t){if(!s.trim())continue;let r=s.match(/^diff --git a\/(.+?) b\//)?.[1]??"";pt.some(a=>a.test(r))||s.includes("Binary files")||o.push(s)}return o.join("")}async captureCommitDetails(e,t,o,s,n){if(!this.buffer)return;let r=[],a=0,c=0;try{let{stdout:d}=await L("git",["diff-tree","--no-commit-id","-r","--numstat",t],{cwd:e});for(let u of d.trim().split(`
`).filter(Boolean)){let g=u.split("	"),b=parseInt(g[0]??"0",10),T=parseInt(g[1]??"0",10),v=g[2]??"";v&&!this.isExcluded(v)&&(r.push(v),a+=isNaN(b)?0:b,c+=isNaN(T)?0:T,this.buffer.filesModified.add(v))}}catch{}r=r.filter(d=>!this.isExcluded(d));let m=await this.captureDiffContext(e,t),p={sha:t.slice(0,12),message:o.slice(0,500),author:s.slice(0,200),timestamp:n,filesChanged:r,insertions:a,deletions:c,...m?{diff:m}:{}};this.buffer.commits.push(p),this.buffer.eventCount+=1,this.buffer.totalPayloadSize+=JSON.stringify(p).length,this.buffer.lastActivityTime=Date.now(),this.updateStatusBar(),this.checkVolumeThreshold()}watchFileSaves(){this.fileSaveDisposable?.dispose(),this.fileSaveDisposable=y.workspace.onDidSaveTextDocument(e=>{if(!this.buffer||this.disposed)return;let t=y.workspace.asRelativePath(e.uri,!1);if(!this.isExcluded(t)){let o=!this.buffer.filesModified.has(t);this.buffer.filesModified.add(t),this.buffer.lastActivityTime=Date.now(),o&&(this.buffer.eventCount+=1)}}),y.window.onDidChangeActiveTextEditor(e=>{if(!this.buffer||this.disposed||!e)return;let t=y.workspace.asRelativePath(e.document.uri,!1);this.isExcluded(t)||this.buffer.activeEditorFiles.add(t)})}startTimers(){this.clearTimers(),this.idleTimer=setInterval(()=>{if(!this.buffer||this.buffer.eventCount===0)return;Date.now()-this.buffer.lastActivityTime>at&&this.flush()},6e4),this.autoFlushTimer=setInterval(()=>{!this.buffer||this.buffer.eventCount===0||(console.log(`[GitWatcher] Auto-flush: ${this.buffer.eventCount} events, ${this.buffer.commits.length} commits`),this.flush())},ct),this.captureTickTimer=setInterval(()=>{this.updateStatusBar()},1e3)}clearTimers(){this.idleTimer&&(clearInterval(this.idleTimer),this.idleTimer=void 0),this.autoFlushTimer&&(clearInterval(this.autoFlushTimer),this.autoFlushTimer=void 0),this.captureTickTimer&&(clearInterval(this.captureTickTimer),this.captureTickTimer=void 0),this.gitPollTimer&&(clearInterval(this.gitPollTimer),this.gitPollTimer=void 0)}checkVolumeThreshold(){this.buffer&&(this.buffer.eventCount>=dt||this.buffer.totalPayloadSize>=lt)&&(console.log(`[GitWatcher] Volume threshold reached (${this.buffer.eventCount} events) \u2014 auto-flushing`),this.flush())}initBuffer(){this.buffer={commits:[],filesModified:new Set,activeEditorFiles:new Set,sessionStartTime:Date.now(),lastActivityTime:Date.now(),eventCount:0,totalPayloadSize:0}}updateStatusBar(){if(!this.buffer||this.buffer.eventCount===0)return;let e=Math.floor(this.getSessionDurationMs()/1e3);this.statusBar.setCapturing(e,this.buffer.eventCount)}getWorkspaceRoot(){let e=y.workspace.workspaceFolders;return!e||e.length===0?null:e[0].uri.fsPath}isExcluded(e){let o=y.workspace.getConfiguration("contox").get("capture.excludePatterns",["*.env","*.key","*.pem","*.p12","*.pfx","node_modules/**",".git/**","dist/**"]),s=e.toLowerCase();for(let n of o)if(n.startsWith("*")){if(s.endsWith(n.slice(1)))return!0}else if(n.endsWith("/**")){let r=n.slice(0,-3);if(s.startsWith(r+"/")||s.startsWith(r+"\\"))return!0}else if(s===n.toLowerCase())return!0;return!1}hmacSecretWarningShown=!1;async getHmacSecret(){let e=await this.secrets.get("contox-hmac-secret");if(e)return e;let o=y.workspace.getConfiguration("contox").get("hmacSecret","");if(o)return o;if(this.projectId)try{let s=await this.client.getProjectHmacSecret(this.projectId);if(s.data?.hmacSecret)return await this.secrets.store("contox-hmac-secret",s.data.hmacSecret),console.log("[GitWatcher] HMAC secret fetched from API and cached"),s.data.hmacSecret}catch{}return this.hmacSecretWarningShown||(this.hmacSecretWarningShown=!0,y.window.showWarningMessage('Contox: Capture events cannot be sent \u2014 HMAC secret missing. Re-run "Contox: Setup" to fix.',"Open Setup").then(s=>{s==="Open Setup"&&y.commands.executeCommand("contox.setup")})),null}dispose(){this.disposed=!0,this.flush(),this.stop()}};var F=l(require("vscode"));function Pe(i){return F.commands.registerCommand("contox.login",async()=>{let e=await F.window.showInputBox({prompt:"Enter your Contox API key",password:!0,placeHolder:"ctx_xxxxxxxxxxxxxxxx",ignoreFocusOut:!0});if(!e)return;await i.setApiKey(e);let t=await i.getContext("__ping__");if(t.error==="Unauthorized"||t.error==='Not authenticated. Run "Contox: Login" first.'){await i.clearApiKey(),F.window.showErrorMessage("Contox: Invalid API key.");return}F.window.showInformationMessage("Contox: Logged in successfully"),await F.commands.executeCommand("contox.sync")})}var S=l(require("vscode")),de=l(require("fs")),je=l(require("path"));function Te(i){return S.commands.registerCommand("contox.init",async()=>{if(!await i.getApiKey()){S.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');return}let t=S.workspace.workspaceFolders;if(!t||t.length===0){S.window.showErrorMessage("Contox: Open a workspace folder first.");return}let o=t[0].uri.fsPath,s=je.join(o,".contox.json");if(de.existsSync(s)&&await S.window.showWarningMessage("Contox: This workspace is already initialized. Reconfigure?","Yes","No")!=="Yes")return;let n=await S.window.showInputBox({prompt:"Enter your Contox organization (team) ID",placeHolder:"e.g. 6632a1\u2026",ignoreFocusOut:!0});if(!n)return;let r=await i.listProjects(n);if(r.error){S.window.showErrorMessage(`Contox: ${r.error}`);return}let c=[...(r.data??[]).map(u=>({label:u.name,description:`${u.contextsCount} context${u.contextsCount===1?"":"s"}`,project:u})),{label:"$(add) Create a new project...",description:""}],m=await S.window.showQuickPick(c,{placeHolder:"Select a project to link to this workspace",ignoreFocusOut:!0});if(!m)return;let p=m.project;if(!p){S.window.showInformationMessage('Create a new project on the Contox dashboard, then run "Contox: Initialize Project" again.');return}let d={teamId:n,projectId:p.id,projectName:p.name};de.writeFileSync(s,JSON.stringify(d,null,2)+`
`),S.window.showInformationMessage(`Contox: Linked workspace to project "${p.name}"`),await S.commands.executeCommand("contox.sync")})}var N=l(require("vscode"));function Ae(i,e,t){return N.commands.registerCommand("contox.sync",async()=>{if(!await i.getApiKey()){N.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');return}let s=j();if(!s){N.window.showWarningMessage('Contox: No project linked. Run "Contox: Initialize Project" first.');return}t.setSyncing();let n=await i.getBrain(s.projectId);if(n.error){t.setError(),N.window.showErrorMessage(`Contox sync failed: ${n.error}`);return}let r=n.data?.tree??[],a=n.data?.itemsLoaded??0;e.setTree(r,a),t.setSynced(),N.window.showInformationMessage(`Contox: Loaded ${a} memory items from "${s.projectName}"`)})}var R=l(require("vscode"));function Me(i,e,t){return R.commands.registerCommand("contox.create",async()=>{if(!await i.getApiKey()){R.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');return}let s=j();if(!s){R.window.showWarningMessage('Contox: No project linked. Run "Contox: Initialize Project" first.');return}let n=await R.window.showInputBox({prompt:"Context name",placeHolder:"e.g. API Documentation",ignoreFocusOut:!0});if(!n)return;let r=await R.window.showInputBox({prompt:"Description (optional)",placeHolder:"e.g. REST API docs for the backend",ignoreFocusOut:!0}),a=await i.createContext(n,s.teamId,s.projectId,r||void 0);if(a.error){R.window.showErrorMessage(`Contox: Failed to create context \u2014 ${a.error}`);return}R.window.showInformationMessage(`Contox: Created context "${n}"`),t.setSyncing();let c=await i.getBrain(s.projectId);!c.error&&c.data&&e.setTree(c.data.tree,c.data.itemsLoaded),t.setSynced()})}var w=l(require("vscode")),h=l(require("fs")),C=l(require("path")),le=l(require("os"));var x=l(require("fs")),G=l(require("path")),me="mcp-server.cjs",mt="mcp-server.version";async function Re(i){let e=i.extension.packageJSON.version,t=i.globalStorageUri.fsPath;x.existsSync(t)||x.mkdirSync(t,{recursive:!0});let o=G.join(t,me),s=G.join(t,mt);if(ft(o,s,e)){let n=G.join(i.extensionUri.fsPath,"dist",me);if(!x.existsSync(n))throw new Error(`MCP server bundle not found at ${n}. The extension may not have been built correctly.`);let r=o+".tmp";x.copyFileSync(n,r),x.renameSync(r,o),x.writeFileSync(s,e,"utf-8")}return o}function ft(i,e,t){if(!x.existsSync(i)||!x.existsSync(e))return!0;try{return x.readFileSync(e,"utf-8").trim()!==t}catch{return!0}}function _(i){return G.join(i.globalStorageUri.fsPath,me)}var E;function Ee(i,e,t,o){return w.commands.registerCommand("contox.setup",()=>{q(i,e,t,o)})}function q(i,e,t,o){if(E){E.reveal(w.ViewColumn.One);return}E=w.window.createWebviewPanel("contoxSetup","Contox Setup",w.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0}),E.webview.html=vt(),E.webview.onDidReceiveMessage(async s=>{await gt(s,i,e,t,E,o)},void 0,o.subscriptions),E.onDidDispose(()=>{E=void 0}),(async()=>await i.getApiKey()&&E?.webview.postMessage({type:"alreadyLoggedIn"}))()}async function gt(i,e,t,o,s,n){let r=a=>{s.webview.postMessage(a)};switch(i.type){case"login":{if(!i.apiKey){r({type:"loginResult",success:!1,error:"No API key provided"});return}if(await e.setApiKey(i.apiKey),(await e.getContext("__ping__")).error==="Unauthorized"){await e.clearApiKey(),r({type:"loginResult",success:!1,error:"Invalid API key"});return}r({type:"loginResult",success:!0});break}case"loadTeams":{let a=await e.listTeams();if(a.error){r({type:"teamsLoaded",success:!1,error:a.error});return}r({type:"teamsLoaded",success:!0,teams:(a.data??[]).map(c=>({id:c.id,name:c.name,members:c.members}))});break}case"loadProjects":{if(!i.teamId){r({type:"projectsLoaded",success:!1,error:"No team ID provided"});return}let a=await e.listProjects(i.teamId);if(a.error){r({type:"projectsLoaded",success:!1,error:a.error});return}r({type:"projectsLoaded",success:!0,projects:(a.data??[]).map(c=>({id:c.id,name:c.name,contextsCount:c.contextsCount}))});break}case"selectProject":{if(!i.teamId||!i.projectId||!i.projectName)return;let a=w.workspace.workspaceFolders;if(!a||a.length===0){r({type:"projectSelected",success:!1,error:"No workspace folder open"});return}let c=a[0].uri.fsPath,m=C.join(c,".contox.json"),p={teamId:i.teamId,projectId:i.projectId,projectName:i.projectName};try{h.writeFileSync(m,JSON.stringify(p,null,2)+`
`);let d=await e.getProjectHmacSecret(i.projectId);d.data?.hmacSecret&&await n.secrets.store("contox-hmac-secret",d.data.hmacSecret),r({type:"projectSelected",success:!0}),o.setSyncing();let u=await e.getBrain(i.projectId);!u.error&&u.data&&t.setTree(u.data.tree,u.data.itemsLoaded),o.setSynced()}catch(d){r({type:"projectSelected",success:!1,error:String(d)})}break}case"configureAI":{let a=i.aiTools??[],c=[],p=w.workspace.workspaceFolders?.[0]?.uri.fsPath??"",d="",u="";try{let v=h.readFileSync(C.join(p,".contox.json"),"utf-8"),Z=JSON.parse(v);d=Z.teamId??"",u=Z.projectId??""}catch{}let g=await e.getApiKey()??"",b=w.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev"),T=await n.secrets.get("contox-hmac-secret")??"";if(a.includes("claude"))try{$e(g,b,d,u,p,T,n),c.push("Claude MCP server configured")}catch(v){c.push(`Claude: ${String(v)}`)}if(a.includes("cursor"))try{De(g,b,d,u,p,T,n),c.push("Cursor MCP server configured")}catch(v){c.push(`Cursor: ${String(v)}`)}if(a.includes("copilot"))try{Le(g,b,d,u,p,T,n),c.push("Copilot MCP server configured")}catch(v){c.push(`Copilot: ${String(v)}`)}if(a.includes("windsurf"))try{Fe(g,b,d,n),c.push("Windsurf MCP server configured")}catch(v){c.push(`Windsurf: ${String(v)}`)}if(a.includes("antigravity"))try{Ne(g,b,d,u,n),c.push("Antigravity MCP server configured")}catch(v){c.push(`Antigravity: ${String(v)}`)}r({type:"aiConfigured",results:c});break}case"runScan":{r({type:"scanStarted"});try{if(!w.workspace.workspaceFolders){r({type:"scanResult",success:!1,error:"No workspace open"});return}let c=await e.getApiKey()??"",m=w.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev"),p=C.join(le.homedir(),".contoxrc");h.writeFileSync(p,JSON.stringify({apiKey:c,apiUrl:m},null,2),"utf-8");let d=w.window.createTerminal("Contox Scan");d.sendText("node packages/cli/dist/index.js scan"),d.show(),r({type:"scanResult",success:!0})}catch(a){r({type:"scanResult",success:!1,error:String(a)})}break}case"finish":{s.dispose(),w.window.showInformationMessage("Contox: Setup complete! Your AI now has persistent memory.");break}}}function Be(i,e,t,o,s,n,r){$e(i,e,t,o,s,n,r),De(i,e,t,o,s,n,r),Le(i,e,t,o,s,n,r),Fe(i,e,t,r),Ne(i,e,t,o,r)}function J(i,e,t,o,s){let n={CONTOX_API_KEY:i,CONTOX_API_URL:e,CONTOX_TEAM_ID:t};return o&&(n.CONTOX_PROJECT_ID=o),s&&(n.CONTOX_HMAC_SECRET=s),n}function Y(i,e,t,o="mcpServers"){let s={};try{s=JSON.parse(h.readFileSync(i,"utf-8"))}catch{}let n=s[o]??{},r={...s,[o]:{...n,[e]:t}};h.writeFileSync(i,JSON.stringify(r,null,2)+`
`)}function $e(i,e,t,o,s,n,r){let a=_(r),c=J(i,e,t,o,n);Y(C.join(s,".mcp.json"),"contox",{command:"node",args:[a],env:c})}function De(i,e,t,o,s,n,r){let a=C.join(s,".cursor");h.existsSync(a)||h.mkdirSync(a,{recursive:!0});let c=_(r),m=J(i,e,t,o,n);Y(C.join(a,"mcp.json"),"contox",{command:"node",args:[c],env:m})}function Le(i,e,t,o,s,n,r){let a=C.join(s,".vscode");h.existsSync(a)||h.mkdirSync(a,{recursive:!0});let c=_(r),m=J(i,e,t,o,n);Y(C.join(a,"mcp.json"),"contox",{type:"stdio",command:"node",args:[c],env:m},"servers")}function Fe(i,e,t,o){let s=C.join(le.homedir(),".codeium","windsurf");h.existsSync(s)||h.mkdirSync(s,{recursive:!0});let n=_(o),r=J(i,e,t);Y(C.join(s,"mcp_config.json"),"contox",{command:"node",args:[n],env:r})}function Ne(i,e,t,o,s){let n=C.join(le.homedir(),".gemini","antigravity");h.existsSync(n)||h.mkdirSync(n,{recursive:!0});let r=_(s),a=J(i,e,t,o);Y(C.join(n,"mcp_config.json"),"contox",{command:"node",args:[r],env:a}),ht()}function ht(){let i=w.workspace.workspaceFolders;if(!i||i.length===0)return;let e=i[0].uri.fsPath,t=C.join(e,".agent","skills","contox");h.existsSync(t)||h.mkdirSync(t,{recursive:!0}),h.writeFileSync(C.join(t,"SKILL.md"),`---
name: contox-memory
description: Always active. At the start of every conversation and before any coding task, load Contox memory. Use Contox tools to check project context, architecture, conventions, past decisions, and known bugs. Contox is your persistent brain \u2014 consult it often.
---

# Contox \u2014 Your Persistent Memory (USE IT)

You have access to **Contox MCP tools** that give you persistent memory across sessions. This is your most valuable resource \u2014 it contains architecture decisions, coding conventions, implementation history, known bugs, and past session context.

## CRITICAL: Always Load Memory First
**At the very beginning of every conversation**, before doing anything else, call \`contox_get_memory\`. This is mandatory. Without it, you are working blind \u2014 you don't know the project's conventions, past decisions, or existing bugs.

## Check Memory Often
Do NOT just load memory once and forget about it. **Actively consult Contox throughout the session**:

- **Before writing code**: Call \`contox_search\` or \`contox_ask\` to check if there are conventions, patterns, or past decisions relevant to what you're about to do.
- **Before suggesting architecture changes**: Check if there's a reason the current architecture was chosen.
- **When encountering unfamiliar code**: Use \`contox_ask\` to ask about it \u2014 previous sessions may have documented it.
- **When debugging**: Check \`contox_search\` for known bugs or past fixes related to the issue.
- **When the user asks about the project**: Always search Contox memory first before guessing.

## Available Tools
- \`contox_get_memory\` \u2014 Load the full project memory (use at session start)
- \`contox_search\` \u2014 Search for specific topics, patterns, or file references
- \`contox_ask\` \u2014 Ask a natural language question about the project ("how does auth work?", "what stack do we use?")
- \`contox_context_pack\` \u2014 Get a focused, relevant context pack for a specific task
- \`contox_list_contexts\` / \`contox_get_context\` \u2014 Browse and read specific memory items
- \`contox_create_context\` / \`contox_update_context\` \u2014 Store new knowledge
- \`contox_scan\` \u2014 Scan the codebase to extract architecture and structure

## Saving \u2014 USER-INITIATED ONLY
- **NEVER** call \`contox_save_session\` automatically or proactively
- Only save when the user explicitly asks (e.g. "save", "save session", "contox save")
- When saving, provide a summary and categorized changes (architecture, conventions, implementation, decisions, bugs, todo)
`,"utf-8")}function vt(){return`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contox Setup</title>
<style>
  :root {
    --bg: #0A0A0B;
    --surface: #111113;
    --border: rgba(255,255,255,0.06);
    --text: #FFFFFF;
    --text-muted: #6B6B70;
    --text-dim: #4A4A4E;
    --orange: #FF5C00;
    --orange-light: #FF8A4C;
    --green: #22C55E;
    --red: #EF4444;
    --radius: 12px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .wizard {
    max-width: 520px;
    width: 100%;
  }

  .step { display: none; }
  .step.active { display: block; }

  .logo {
    text-align: center;
    margin-bottom: 2rem;
  }

  .logo h1 {
    font-size: 1.75rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--orange), var(--orange-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .logo p {
    color: var(--text-muted);
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .step-indicator {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-dim);
    transition: all 0.3s;
  }
  .step-dot.active {
    background: var(--orange);
    width: 24px;
    border-radius: 4px;
  }
  .step-dot.done { background: var(--green); }

  h2 {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  p.desc {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-bottom: 1.25rem;
    line-height: 1.5;
  }

  input[type="text"], input[type="password"] {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
  }
  input:focus {
    border-color: rgba(255,92,0,0.5);
    box-shadow: 0 0 0 2px rgba(255,92,0,0.15);
  }
  input::placeholder { color: var(--text-dim); }

  .input-group {
    margin-bottom: 1rem;
  }
  .input-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    margin-bottom: 0.4rem;
    color: var(--text-muted);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.7rem 1.5rem;
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    width: 100%;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--orange), var(--orange-light));
    color: white;
    box-shadow: 0 0 20px rgba(255,92,0,0.3);
  }
  .btn-primary:hover {
    box-shadow: 0 0 30px rgba(255,92,0,0.5);
    transform: translateY(-1px);
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-secondary {
    background: rgba(255,255,255,0.06);
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover { background: rgba(255,255,255,0.1); }

  .btn-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }
  .btn-row .btn { flex: 1; }

  .error {
    color: var(--red);
    font-size: 0.8rem;
    margin-top: 0.5rem;
    display: none;
  }
  .error.show { display: block; }

  .success {
    color: var(--green);
    font-size: 0.85rem;
    text-align: center;
    padding: 0.5rem;
  }

  /* Project list */
  .project-list {
    max-height: 250px;
    overflow-y: auto;
    margin-bottom: 1rem;
  }

  .project-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .project-item:hover {
    background: rgba(255,92,0,0.05);
    border-color: rgba(255,92,0,0.3);
  }
  .project-item.selected {
    background: rgba(255,92,0,0.1);
    border-color: var(--orange);
  }
  .project-item .name { font-weight: 500; font-size: 0.9rem; }
  .project-item .meta { color: var(--text-dim); font-size: 0.75rem; }

  /* AI tool checkboxes */
  .ai-tools {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .ai-tool {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }
  .ai-tool:hover { background: rgba(255,255,255,0.03); }
  .ai-tool.checked {
    background: rgba(255,92,0,0.08);
    border-color: rgba(255,92,0,0.4);
  }

  .ai-tool input { display: none; }
  .ai-tool .checkbox {
    width: 18px;
    height: 18px;
    border: 2px solid var(--text-dim);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s;
  }
  .ai-tool.checked .checkbox {
    background: var(--orange);
    border-color: var(--orange);
  }
  .ai-tool.checked .checkbox::after {
    content: '\\2713';
    color: white;
    font-size: 12px;
    font-weight: bold;
  }
  .ai-tool .info .name { font-size: 0.85rem; font-weight: 500; }
  .ai-tool .info .desc { font-size: 0.7rem; color: var(--text-dim); }

  .config-results {
    margin-top: 1rem;
  }
  .config-results li {
    color: var(--green);
    font-size: 0.8rem;
    margin-bottom: 0.25rem;
    list-style: none;
    padding-left: 1rem;
  }
  .config-results li::before {
    content: '\\2713 ';
    margin-left: -1rem;
  }

  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .final-card {
    text-align: center;
    padding: 2rem;
  }
  .final-card .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  .final-card h2 { margin-bottom: 0.75rem; }
  .final-card p { color: var(--text-muted); font-size: 0.85rem; line-height: 1.6; margin-bottom: 1.5rem; }

  .help-link {
    color: var(--orange);
    text-decoration: none;
    font-size: 0.8rem;
    margin-top: 1rem;
    display: block;
    text-align: center;
  }
</style>
</head>
<body>
<div class="wizard">
  <div class="logo">
    <h1>Contox</h1>
    <p>Persistent AI memory for your projects</p>
  </div>

  <div class="step-indicator">
    <div class="step-dot active" data-step="0"></div>
    <div class="step-dot" data-step="1"></div>
    <div class="step-dot" data-step="2"></div>
    <div class="step-dot" data-step="3"></div>
    <div class="step-dot" data-step="4"></div>
  </div>

  <!-- Step 0: Welcome + Login -->
  <div class="step active" data-step="0">
    <div class="card">
      <h2>Connect your account</h2>
      <p class="desc">Enter your API key from the Contox dashboard. You can find it at Settings &gt; API Keys.</p>
      <div class="input-group">
        <label>API Key</label>
        <input type="password" id="apiKey" placeholder="ctx_xxxxxxxxxxxxxxxx" />
      </div>
      <div class="error" id="loginError"></div>
      <button class="btn btn-primary" id="loginBtn" onclick="doLogin()">
        Connect
      </button>
    </div>
  </div>

  <!-- Step 1: Select Team -->
  <div class="step" data-step="1">
    <div class="card">
      <h2>Your organization</h2>
      <p class="desc">Select the organization you want to connect this workspace to.</p>
      <div class="project-list" id="teamList">
        <p style="color: var(--text-dim); text-align: center; padding: 2rem;"><span class="spinner"></span> Loading teams...</p>
      </div>
      <div class="error" id="teamError"></div>
      <button class="btn btn-primary" id="teamBtn" disabled onclick="confirmTeam()">
        Continue
      </button>
    </div>
  </div>

  <!-- Step 2: Select Project -->
  <div class="step" data-step="2">
    <div class="card">
      <h2>Select a project</h2>
      <p class="desc">Link this workspace to a Contox project. Your AI memory will be stored here.</p>
      <div class="project-list" id="projectList">
        <p style="color: var(--text-dim); text-align: center; padding: 2rem;">Loading projects...</p>
      </div>
      <div class="error" id="projectError"></div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="goStep(1)">Back</button>
        <button class="btn btn-primary" id="selectProjectBtn" disabled onclick="selectProject()">
          Link project
        </button>
      </div>
    </div>
  </div>

  <!-- Step 3: AI Tools -->
  <div class="step" data-step="3">
    <div class="card">
      <h2>Configure your AI tools</h2>
      <p class="desc">Select which AI coding tools you use. We'll auto-configure each one to use Contox memory.</p>
      <div class="ai-tools">
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="claude" checked />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Claude Code</div>
            <div class="desc">.mcp.json</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="cursor" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Cursor</div>
            <div class="desc">.cursor/mcp.json</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="copilot" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">GitHub Copilot</div>
            <div class="desc">.vscode/mcp.json</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="windsurf" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Windsurf</div>
            <div class="desc">global MCP config</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="antigravity" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Antigravity</div>
            <div class="desc">~/.gemini/antigravity/</div>
          </div>
        </label>
      </div>
      <ul class="config-results" id="configResults"></ul>
      <button class="btn btn-primary" id="configBtn" onclick="configureAI()">
        Configure selected tools
      </button>
    </div>
  </div>

  <!-- Step 4: Done -->
  <div class="step" data-step="4">
    <div class="card final-card">
      <div class="icon">&#x1f680;</div>
      <h2>You're all set!</h2>
      <p>
        Your AI now has persistent memory.<br>
        It will remember everything across sessions.<br><br>
        <strong>How it works:</strong><br>
        Session start: AI loads context automatically<br>
        Session end: AI saves what was done
      </p>
      <button class="btn btn-primary" onclick="runScan()">
        Run first scan
      </button>
      <div style="margin-top: 0.75rem;">
        <button class="btn btn-secondary" onclick="finish()">
          Skip &amp; finish
        </button>
      </div>
    </div>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();
  let currentStep = 0;
  let selectedTeamId = null;
  let selectedTeamName = null;
  let selectedProjectId = null;
  let selectedProjectName = null;

  function goStep(n) {
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    document.querySelector('.step[data-step="' + n + '"]').classList.add('active');

    document.querySelectorAll('.step-dot').forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i < n) dot.classList.add('done');
      if (i === n) dot.classList.add('active');
    });

    currentStep = n;
  }

  function doLogin() {
    const key = document.getElementById('apiKey').value.trim();
    if (!key) return;

    const btn = document.getElementById('loginBtn');
    btn.innerHTML = '<span class="spinner"></span> Connecting...';
    btn.disabled = true;
    document.getElementById('loginError').classList.remove('show');

    vscode.postMessage({ type: 'login', apiKey: key });
  }

  function loadTeams() {
    vscode.postMessage({ type: 'loadTeams' });
  }

  function pickTeam(el, id, name) {
    document.querySelectorAll('#teamList .project-item').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    selectedTeamId = id;
    selectedTeamName = name;
    document.getElementById('teamBtn').disabled = false;
  }

  function confirmTeam() {
    if (!selectedTeamId) return;

    const btn = document.getElementById('teamBtn');
    btn.innerHTML = '<span class="spinner"></span> Loading projects...';
    btn.disabled = true;

    vscode.postMessage({ type: 'loadProjects', teamId: selectedTeamId });
  }

  function selectProject() {
    if (!selectedProjectId) return;

    const btn = document.getElementById('selectProjectBtn');
    btn.innerHTML = '<span class="spinner"></span> Linking...';
    btn.disabled = true;

    vscode.postMessage({
      type: 'selectProject',
      teamId: selectedTeamId,
      projectId: selectedProjectId,
      projectName: selectedProjectName,
    });
  }

  function toggleTool(el) {
    const input = el.querySelector('input');
    input.checked = !input.checked;
    el.classList.toggle('checked', input.checked);
  }

  function configureAI() {
    const tools = [];
    document.querySelectorAll('.ai-tool input:checked').forEach(input => {
      tools.push(input.value);
    });

    if (tools.length === 0) {
      goStep(4);
      return;
    }

    const btn = document.getElementById('configBtn');
    btn.innerHTML = '<span class="spinner"></span> Configuring...';
    btn.disabled = true;

    vscode.postMessage({ type: 'configureAI', aiTools: tools });
  }

  function runScan() {
    vscode.postMessage({ type: 'runScan' });
    finish();
  }

  function finish() {
    vscode.postMessage({ type: 'finish' });
  }

  // Initialize checked state visual
  document.querySelectorAll('.ai-tool').forEach(el => {
    const input = el.querySelector('input');
    if (input.checked) el.classList.add('checked');
  });

  // Handle messages from the extension
  window.addEventListener('message', event => {
    const msg = event.data;

    switch (msg.type) {
      case 'alreadyLoggedIn':
        goStep(1);
        loadTeams();
        break;

      case 'loginResult':
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = false;
        if (msg.success) {
          loginBtn.innerHTML = '&#x2713; Connected';
          setTimeout(() => {
            goStep(1);
            loadTeams();
          }, 500);
        } else {
          loginBtn.innerHTML = 'Connect';
          const err = document.getElementById('loginError');
          err.textContent = msg.error || 'Login failed';
          err.classList.add('show');
        }
        break;

      case 'teamsLoaded': {
        const teamList = document.getElementById('teamList');
        if (msg.success) {
          const teams = msg.teams || [];
          if (teams.length === 0) {
            teamList.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 1rem;">No organizations found. Create one on the dashboard first.</p>';
          } else {
            teamList.innerHTML = teams.map(t =>
              '<div class="project-item" onclick="pickTeam(this, \\'' + t.id + '\\', \\'' + t.name.replace(/'/g, "\\\\'") + '\\')">' +
              '<div class="name">' + t.name + '</div>' +
              '<div class="meta">' + (t.members || 0) + ' members</div>' +
              '</div>'
            ).join('');
          }
        } else {
          teamList.innerHTML = '<p style="color: var(--red); text-align: center; padding: 1rem;">' + (msg.error || 'Failed to load teams') + '</p>';
        }
        break;
      }

      case 'projectsLoaded':
        const teamBtn = document.getElementById('teamBtn');
        teamBtn.disabled = false;
        teamBtn.innerHTML = 'Continue';

        if (msg.success) {
          const list = document.getElementById('projectList');
          const projects = msg.projects || [];

          if (projects.length === 0) {
            list.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 1rem;">No projects found. Create one on the dashboard first.</p>';
          } else {
            list.innerHTML = projects.map(p =>
              '<div class="project-item" onclick="pickProject(this, \\'' + p.id + '\\', \\'' + p.name.replace(/'/g, "\\\\'") + '\\')">' +
              '<div class="name">' + p.name + '</div>' +
              '<div class="meta">' + p.contextsCount + ' contexts</div>' +
              '</div>'
            ).join('');
          }
          goStep(2);
        } else {
          const err = document.getElementById('teamError');
          err.textContent = msg.error || 'Failed to load projects';
          err.classList.add('show');
        }
        break;

      case 'projectSelected':
        if (msg.success) {
          goStep(3);
        } else {
          const err = document.getElementById('projectError');
          err.textContent = msg.error || 'Failed';
          err.classList.add('show');
          const btn = document.getElementById('selectProjectBtn');
          btn.disabled = false;
          btn.innerHTML = 'Link project';
        }
        break;

      case 'aiConfigured':
        const configBtn = document.getElementById('configBtn');
        configBtn.disabled = false;
        configBtn.innerHTML = 'Configure selected tools';

        const results = document.getElementById('configResults');
        results.innerHTML = (msg.results || []).map(r => '<li>' + r + '</li>').join('');

        setTimeout(() => goStep(4), 1000);
        break;
    }
  });

  function pickProject(el, id, name) {
    document.querySelectorAll('.project-item').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    selectedProjectId = id;
    selectedProjectName = name;
    document.getElementById('selectProjectBtn').disabled = false;
  }
</script>
</body>
</html>`}var W=l(require("vscode")),ue=l(require("fs")),We=l(require("path"));function _e(i){return W.commands.registerCommand("contox.reset",async()=>{if(await W.window.showWarningMessage("Contox: This will log you out and remove the workspace configuration. Continue?",{modal:!0},"Reset")!=="Reset")return;await i.clearApiKey();let t=W.workspace.workspaceFolders;if(t&&t.length>0){let o=We.join(t[0].uri.fsPath,".contox.json");try{ue.existsSync(o)&&ue.unlinkSync(o)}catch{}}W.window.showInformationMessage('Contox: Reset complete. Run "Contox: Setup Wizard" to reconfigure.')})}var B=l(require("vscode")),k=l(require("fs")),O=l(require("path"));var A=l(require("fs")),H=l(require("path")),He="<!-- contox:start -->",fe="<!-- contox:end -->",yt=`# Contox \u2014 Project Memory

You have access to a persistent project memory that survives across sessions.
The file \`.contox/memory.md\` in this workspace contains architecture decisions,
conventions, implementation history, bug fixes, and todos from all previous sessions.

## MANDATORY: Read memory at session start
- Read \`.contox/memory.md\` BEFORE starting any work
- This is your primary source of truth about this project
- Do NOT ask questions that are already answered in the memory

## Active file context
- \`.contox/context.md\` contains focused context relevant to your current file
- This file updates automatically as you navigate the codebase
- Use it for file-specific decisions, patterns, and conventions

## Save your work at session end
- Run: \`contox save "Brief summary of what you did"\`
- For structured saves: \`echo '{"summary":"...","changes":[{"category":"implementation","title":"...","content":"..."}]}' | contox save --json\`
- Categories: architecture, conventions, implementation, decisions, bugs, todo`,wt=[{name:"Cursor",relPath:".cursorrules",dirHint:".cursor"},{name:"Copilot",relPath:H.join(".github","copilot-instructions.md"),dirHint:".github"},{name:"Windsurf",relPath:".windsurfrules"},{name:"Cline",relPath:".clinerules"}];function xt(i,e){let t=`${He}
${e}
${fe}`;if(!i.trim())return t+`
`;let o=i.indexOf(He),s=i.indexOf(fe);if(o!==-1&&s!==-1){let r=i.slice(0,o),a=i.slice(s+fe.length);return r+t+a}let n=i.endsWith(`
`)?`
`:`

`;return i+n+t+`
`}function ge(i){let e=[];for(let t of wt){let o=H.join(i,t.relPath),s=A.existsSync(o),n=t.dirHint?A.existsSync(H.join(i,t.dirHint)):!1;if(!(!s&&!n))try{let r=H.dirname(o);A.existsSync(r)||A.mkdirSync(r,{recursive:!0});let a=s?A.readFileSync(o,"utf-8"):"",c=xt(a,yt);A.writeFileSync(o,c,"utf-8"),e.push(t.name)}catch{}}return e}function Oe(i){return B.commands.registerCommand("contox.loadMemory",async()=>{let e=j();if(!e){B.window.showWarningMessage("Contox: No project linked. Connect via dashboard first.");return}let t=B.workspace.workspaceFolders;if(!t||t.length===0)return;let o=t[0].uri.fsPath,s=await i.getBrain(e.projectId);if(s.error){B.window.showErrorMessage(`Contox: Failed to load memory \u2014 ${s.error}`);return}let n=s.data;if(!n||!n.document||n.document.trim().length===0){B.window.showInformationMessage("Contox: Memory is empty \u2014 nothing to load yet.");return}let r=O.join(o,".contox");k.existsSync(r)||k.mkdirSync(r,{recursive:!0});let a=O.join(r,"memory.md");k.writeFileSync(a,n.document,"utf-8"),Ke(o);let c=ge(o),m=c.length>0?` \u2192 ${c.join(", ")}`:"";B.window.showInformationMessage(`Contox: Memory loaded (${String(n.itemsLoaded)} items, ~${String(n.tokenEstimate)} tokens)${m}`)})}async function he(i,e,t){try{let o=await i.getBrain(t);if(o.error||!o.data?.document)return!1;let s=O.join(e,".contox");return k.existsSync(s)||k.mkdirSync(s,{recursive:!0}),k.writeFileSync(O.join(s,"memory.md"),o.data.document,"utf-8"),Ke(e),ge(e),!0}catch{return!1}}function Ke(i){let e=O.join(i,".gitignore");try{let t="";if(k.existsSync(e)&&(t=k.readFileSync(e,"utf-8")),!t.includes(".contox/")){let o=t.length>0&&!t.endsWith(`
`)?`
`:"";k.writeFileSync(e,t+o+`
# Contox local memory
.contox/
`,"utf-8")}}catch{}}var $=l(require("vscode"));function Ue(i){return $.commands.registerCommand("contox.endSession",async()=>{if(!j()){$.window.showWarningMessage("Contox: No project linked. Connect via dashboard first.");return}let t=await $.window.withProgress({location:$.ProgressLocation.Notification,title:"Contox: Ending session\u2026",cancellable:!1},async()=>i.endSession());if(t.closed){let o=t.newSessionId?"Contox: Session closed \u2014 new session started.":"Contox: Session closed. Next activity will start a new session.";$.window.showInformationMessage(o)}else $.window.showWarningMessage("Contox: No active session found, or failed to close it.")})}var M=l(require("vscode")),ve="contox.desynced";function Ve(i){return i.workspaceState.get(ve,!1)}function ze(i,e,t,o){return M.commands.registerCommand("contox.desync",async()=>{await t.flush(),e.stop(),t.stop(),await o.workspaceState.update(ve,!0),i.setDisconnected(),M.window.showInformationMessage("Contox: Sync paused. Capture and polling stopped.","Reconnect").then(s=>{s==="Reconnect"&&M.commands.executeCommand("contox.connect")})})}function Ge(i,e,t,o,s,n){return M.commands.registerCommand("contox.connect",async()=>{let r=n();if(!r){M.window.showWarningMessage('Contox: No project configured. Run "Contox: Setup Wizard" first.');return}if(!await i.getApiKey()){M.window.showWarningMessage('Contox: Not authenticated. Run "Contox: Login" first.');return}await s.workspaceState.update(ve,!1),t.start(r),o.start(r),e.setSyncing(),await M.commands.executeCommand("contox.sync"),M.window.showInformationMessage("Contox: Reconnected \u2014 sync resumed.")})}var X=l(require("vscode")),K=l(require("fs")),I=l(require("path")),Ct=2e3,bt=5*60*1e3,St=10*1e3,kt=8,pe=class{constructor(e){this.client=e;this.disposables.push(X.window.onDidChangeActiveTextEditor(t=>{t&&this.enabled&&this.projectId&&this.scheduleInjection(t.document)}))}disposables=[];debounceTimer=null;cache=null;lastApiCall=0;projectId=null;rootPath=null;enabled=!0;start(e){this.projectId=e;let t=X.workspace.workspaceFolders;t&&t.length>0&&(this.rootPath=t[0].uri.fsPath);let o=X.window.activeTextEditor;o&&this.scheduleInjection(o.document)}stop(){this.projectId=null,this.debounceTimer&&(clearTimeout(this.debounceTimer),this.debounceTimer=null)}setEnabled(e){this.enabled=e,e||this.stop()}scheduleInjection(e){if(e.uri.scheme!=="file")return;let t=I.extname(e.fileName).toLowerCase();new Set([".md",".json",".lock",".txt",".log",".env",".csv",".svg",".png",".jpg",".gif"]).has(t)||e.fileName.includes(".contox")||(this.debounceTimer&&clearTimeout(this.debounceTimer),this.debounceTimer=setTimeout(()=>{this.injectForFile(e.fileName)},Ct))}async injectForFile(e){if(!this.projectId||!this.rootPath||this.cache&&this.cache.filePath===e&&Date.now()-this.cache.timestamp<bt||Date.now()-this.lastApiCall<St)return;let o=I.relative(this.rootPath,e).replace(/\\/g,"/"),s=I.basename(e,I.extname(e)),n=I.dirname(o),r=`${s} ${n.replace(/\//g," ")}`.trim();try{this.lastApiCall=Date.now();let a=await this.client.searchMemory(this.projectId,r,kt);if(a.error||!a.data)return;let c=a.data.results;if(c.length===0)return;this.cache={filePath:e,results:c,timestamp:Date.now()},this.writeContextFile(o,c)}catch{}}writeContextFile(e,t){if(!this.rootPath)return;let o=I.join(this.rootPath,".contox");K.existsSync(o)||K.mkdirSync(o,{recursive:!0});let s=["# Active Context","",`> Auto-generated for: \`${e}\``,`> ${String(t.length)} relevant memory items found`,""];for(let r of t){let a=Math.round(r.similarity*100);s.push(`## ${r.title}`),s.push(`> ${r.type} | ${a}% match | ${r.schemaKey}`),r.files.length>0&&s.push(`> Files: ${r.files.slice(0,3).join(", ")}`),s.push("");let c=r.facts.length>500?r.facts.slice(0,500)+"...":r.facts;s.push(c),s.push("")}s.push("---"),s.push(`_Updated: ${new Date().toLocaleTimeString()} | Full memory: .contox/memory.md_`);let n=I.join(o,"context.md");K.writeFileSync(n,s.join(`
`),"utf-8")}dispose(){this.stop();for(let e of this.disposables)e.dispose()}};function j(){let i=f.workspace.workspaceFolders;if(!i||i.length===0)return null;let e=i[0].uri.fsPath,t=Q.join(e,".contox.json");try{let o=U.readFileSync(t,"utf-8"),s=JSON.parse(o),n=s.teamId,r=s.projectId,a=s.projectName;return typeof n=="string"&&typeof r=="string"?{teamId:n,projectId:r,projectName:typeof a=="string"?a:"Unknown"}:null}catch{return null}}var ye=class{constructor(e,t,o,s,n,r,a){this.client=e;this.treeProvider=t;this.statusBar=o;this.sessionWatcher=s;this.gitWatcher=n;this.context=r;this.mcpReady=a}async handleUri(e){let t=new URLSearchParams(e.query),o=t.get("token"),s=t.get("teamId"),n=t.get("projectId"),r=t.get("projectName");e.path==="/setup"&&o?await this.handleSetup(o,s,n,r):e.path==="/desync"?await f.commands.executeCommand("contox.desync"):e.path==="/connect"&&await f.commands.executeCommand("contox.connect")}async handleSetup(e,t,o,s){await this.client.setApiKey(e);let n=null;if(o)try{let r=await this.client.getProjectHmacSecret(o);r.data?.hmacSecret&&(n=r.data.hmacSecret,await this.context.secrets.store("contox-hmac-secret",n))}catch{console.warn("Contox: Failed to fetch HMAC secret \u2014 git capture will retry later")}if(t&&o)await this.autoConfigureProject(e,t,o,s??"Project",n);else if(t)await this.showProjectPicker(t);else{f.window.showInformationMessage("$(check) Contox: Authenticated! Choose a project to get started.","Open Setup").then(r=>{r==="Open Setup"&&q(this.client,this.treeProvider,this.statusBar,this.context)});return}}async autoConfigureProject(e,t,o,s,n){let r=f.workspace.workspaceFolders;if(!r||r.length===0){f.window.showWarningMessage("Contox: Open a workspace folder first, then try again.");return}let a=r[0].uri.fsPath,c=Q.join(a,".contox.json");U.writeFileSync(c,JSON.stringify({teamId:t,projectId:o,projectName:s},null,2)+`
`,"utf-8");try{let d=Q.join(require("os").homedir(),".contoxrc"),u=f.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev"),g={apiKey:e,apiUrl:u,teamId:t,projectId:o};n&&(g.hmacSecret=n),U.writeFileSync(d,JSON.stringify(g,null,2)+`
`,{encoding:"utf-8",mode:384})}catch{}let p=f.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev");try{await this.mcpReady,Be(e,p,t,o,a,n??void 0,this.context)}catch(d){console.error("Contox: Failed to configure MCP:",d)}this.sessionWatcher.start(o),this.gitWatcher.start(o),await f.commands.executeCommand("contox.sync"),he(this.client,a,o),f.window.showInformationMessage(`$(check) Contox: Connected to "${s}" \u2014 memory loaded for all AI tools`)}async showProjectPicker(e){let t=await this.client.listProjects(e);if(t.error||!t.data){f.window.showErrorMessage(`Contox: Failed to load projects \u2014 ${t.error??"unknown error"}`);return}let o=t.data;if(o.length===0){f.window.showWarningMessage("Contox: No projects found for this team. Create one on the dashboard first.");return}let s=await f.window.showQuickPick(o.map(n=>({label:n.name,description:n.description??"",detail:`${n.contextsCount} contexts`,projectId:n.id})),{placeHolder:"Choose a project"});if(s){let n=await this.client.getApiKey();n&&await this.autoConfigureProject(n,e,s.projectId,s.label,null)}}};function It(i){let e=Re(i).catch(u=>{console.error("Contox: Failed to deploy MCP server:",u)}),t=new te(i.secrets),o=new ne(t),s=new re,n=new ae(t,s),r=new ce(t,s,i.secrets),a=new pe(t);n.setGitWatcher(r);let c=f.window.createTreeView("contoxContexts",{treeDataProvider:o,showCollapseAll:!1}),m=!1,p=new ye(t,o,s,n,r,i,e),d=p.handleUri.bind(p);p.handleUri=async u=>(m=!0,d(u)),i.subscriptions.push(Pe(t),Te(t),Ae(t,o,s),Me(t,o,s),Ee(t,o,s,i),_e(t),Oe(t),Ue(r),ze(s,n,r,i),Ge(t,s,n,r,i,()=>j()?.projectId??null),f.commands.registerCommand("contox.flushCapture",()=>{r.flush()}),c,s,n,r,a,f.window.registerUriHandler(p)),(async()=>{if(await Promise.all([new Promise(T=>{setTimeout(T,500)}),e]),m)return;let u=await t.getApiKey(),g=j(),b=f.workspace.workspaceFolders;if(u&&g&&b&&b.length>0){if(await f.commands.executeCommand("contox.sync"),he(t,b[0].uri.fsPath,g.projectId),Ve(i)){s.setDisconnected();return}if(!await i.secrets.get("contox-hmac-secret"))try{let V=await t.getProjectHmacSecret(g.projectId);V.data?.hmacSecret&&await i.secrets.store("contox-hmac-secret",V.data.hmacSecret)}catch{}n.start(g.projectId),r.start(g.projectId),a.start(g.projectId);let v=b[0].uri.fsPath,Z=Q.join(v,".mcp.json"),we=!0;try{let V=U.readFileSync(Z,"utf-8"),xe=JSON.parse(V).mcpServers?.contox?.args;xe?.[0]&&!xe[0].includes("packages/mcp-server")&&(we=!1)}catch{}we&&await f.window.showInformationMessage("Contox: Configure MCP server for your AI tools (Claude, Cursor, Copilot, Windsurf)?","Configure","Later")==="Configure"&&q(t,o,s,i)}else f.workspace.workspaceFolders&&f.workspace.workspaceFolders.length>0&&await f.window.showInformationMessage("Contox: Set up AI memory for this project?","Setup","Later")==="Setup"&&q(t,o,s,i)})()}function Pt(){}0&&(module.exports={activate,deactivate,getWorkspaceConfig});
//# sourceMappingURL=extension.js.map
