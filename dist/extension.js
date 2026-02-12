"use strict";var be=Object.create;var O=Object.defineProperty;var Ce=Object.getOwnPropertyDescriptor;var Se=Object.getOwnPropertyNames;var ke=Object.getPrototypeOf,Ie=Object.prototype.hasOwnProperty;var Pe=(r,e)=>{for(var t in e)O(r,t,{get:e[t],enumerable:!0})},ie=(r,e,t,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of Se(e))!Ie.call(r,s)&&s!==t&&O(r,s,{get:()=>e[s],enumerable:!(o=Ce(e,s))||o.enumerable});return r};var u=(r,e,t)=>(t=r!=null?be(ke(r)):{},ie(e||!r||!r.__esModule?O(t,"default",{value:r,enumerable:!0}):t,r)),je=r=>ie(O({},"__esModule",{value:!0}),r);var Je={};Pe(Je,{activate:()=>Ge,deactivate:()=>qe,getWorkspaceConfig:()=>S});module.exports=je(Je);var f=u(require("vscode")),H=u(require("fs")),Q=u(require("path"));var K=u(require("crypto")),re=u(require("vscode")),_=class{constructor(e){this.secrets=e;let t=re.workspace.getConfiguration("contox");this.baseUrl=t.get("apiUrl","https://contox.dev")}baseUrl;apiKey;async setApiKey(e){this.apiKey=e,await this.secrets.store("contox-api-key",e)}async getApiKey(){return this.apiKey||(this.apiKey=await this.secrets.get("contox-api-key")),this.apiKey}async clearApiKey(){this.apiKey=void 0,await this.secrets.delete("contox-api-key")}async request(e,t={}){let o=await this.getApiKey();if(!o)return{error:'Not authenticated. Run "Contox: Login" first.'};let s=`${this.baseUrl}/api${e}`;try{let i=await fetch(s,{...t,headers:{"Content-Type":"application/json",Authorization:`Bearer ${o}`,...t.headers}});if(!i.ok){let a=await i.json().catch(()=>({}));return{error:typeof a.error=="string"?a.error:i.statusText}}return{data:await i.json()}}catch(i){return{error:i instanceof Error?i.message:"Unknown error"}}}async listContexts(e){let t=[],o=0,s=100;for(;;){let i=await this.request(`/integrations/vscode?projectId=${encodeURIComponent(e)}&limit=${s}&offset=${o}`);if(i.error)return{error:i.error};let n=i.data?.contexts??[];if(t.push(...n),n.length<s||t.length>=(i.data?.total??0))break;o+=s}return{data:t}}async listContextTree(e,t){return this.getBrain(t)}async getContext(e){return this.request(`/contexts/${encodeURIComponent(e)}`)}async createContext(e,t,o,s){return this.request("/contexts",{method:"POST",body:JSON.stringify({name:e,teamId:t,projectId:o,description:s})})}async updateContext(e,t){return this.request(`/contexts/${encodeURIComponent(e)}`,{method:"PATCH",body:JSON.stringify(t)})}async syncContent(e,t){return this.request("/integrations/vscode",{method:"POST",body:JSON.stringify({contextId:e,content:t})})}async listTeams(){let e=await this.request("/orgs");return e.error?{error:e.error}:{data:e.data?.orgs??[]}}async listProjects(e){return this.request(`/projects?teamId=${encodeURIComponent(e)}`)}async getProjectHmacSecret(e){return this.request(`/projects/${encodeURIComponent(e)}/hmac-secret`)}async getBrain(e){return this.request(`/v2/brain?projectId=${encodeURIComponent(e)}`)}async listSessions(e,t=5){return this.request(`/v2/sessions?projectId=${encodeURIComponent(e)}&limit=${t}`)}async getSessionJobs(e){return this.request(`/v2/sessions/${encodeURIComponent(e)}/jobs`)}async closeSession(e){return this.request(`/v2/sessions/${encodeURIComponent(e)}`,{method:"PATCH",body:JSON.stringify({status:"closed"})})}async getActiveSession(e){let t=await this.listSessions(e,5);return t.error?{error:t.error}:{data:t.data?.sessions.find(s=>s.status==="active")??null}}async createSession(e,t="vscode"){return this.request("/v2/sessions",{method:"POST",body:JSON.stringify({projectId:e,source:t})})}async ingestEvents(e,t,o){let s=JSON.stringify(t),i=new Date().toISOString(),n=K.randomBytes(16).toString("hex"),a=K.createHmac("sha256",o).update(s).digest("hex"),c={source:"vscode",timestamp:i,nonce:n,signature:a,projectId:e,event:t,skipEnrichment:!0},g=await this.getApiKey();if(!g)return{error:'Not authenticated. Run "Contox: Login" first.'};let l=`${this.baseUrl}/api/v2/ingest`;try{let d=await fetch(l,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${g}`},body:JSON.stringify(c)});if(!d.ok){let x=await d.json().catch(()=>({}));return{error:typeof x.error=="string"?x.error:d.statusText}}return{data:await d.json()}}catch(d){return{error:d instanceof Error?d.message:"Unknown error"}}}};var b=u(require("vscode")),Te={"root/decisions":"lightbulb","root/conventions":"list-ordered","root/architecture":"server","root/journal":"notebook","root/bugs":"bug","root/todo":"checklist","root/codemap":"file-code","root/stack":"layers","root/frontend":"browser","root/backend":"server-process"};function Ae(r){let e=Te[r.schemaKey];return e?new b.ThemeIcon(e):r.children.length>0?new b.ThemeIcon("symbol-namespace"):new b.ThemeIcon("symbol-field")}var z=class extends b.TreeItem{node;constructor(e){let t=e.children.length>0?b.TreeItemCollapsibleState.Collapsed:b.TreeItemCollapsibleState.None;super(e.name,t),this.node=e,this.tooltip=`${e.schemaKey}
${e.itemCount} memory items`,this.description=e.itemCount>0?`${e.itemCount} items`:"",this.iconPath=Ae(e),this.contextValue="contoxContext"}},U=class{constructor(e){this._client=e}_onDidChangeTreeData=new b.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;rootNodes=[];total=0;setTree(e,t){this.rootNodes=e,this.total=t,this._onDidChangeTreeData.fire()}getTotal(){return this.total}getTreeItem(e){return e}getChildren(e){return e?e.node.children.map(t=>new z(t)):this.rootNodes.map(t=>new z(t))}};var M=u(require("vscode"));function Re(r){let e=Date.now()-new Date(r).getTime(),t=Math.floor(e/1e3);if(t<60)return"just now";let o=Math.floor(t/60);if(o<60)return`${o}m ago`;let s=Math.floor(o/60);return s<24?`${s}h ago`:`${Math.floor(s/24)}d ago`}var V=class{item;lastSaveIso=null;refreshTimer;constructor(){this.item=M.window.createStatusBarItem(M.StatusBarAlignment.Left,100),this.item.command="contox.sync",this.setIdle(),this.item.show(),this.refreshTimer=setInterval(()=>{this.lastSaveIso&&this.setLastSave(this.lastSaveIso)},3e4)}setIdle(){this.item.text="$(cloud) Contox",this.item.tooltip="Click to sync contexts",this.item.backgroundColor=void 0}setSyncing(){this.item.text="$(sync~spin) Contox: Syncing...",this.item.tooltip="Syncing contexts...",this.item.backgroundColor=void 0}setSynced(){this.item.text="$(cloud) Contox: Synced",this.item.tooltip="Contexts synced \u2014 click to refresh",this.item.backgroundColor=void 0}setError(){this.item.text="$(error) Contox: Error",this.item.tooltip="Sync failed \u2014 click to retry",this.item.backgroundColor=new M.ThemeColor("statusBarItem.errorBackground")}setLastSave(e){this.lastSaveIso=e;let t=Re(e);this.item.text=`$(cloud) Contox: saved ${t}`,this.item.tooltip=`Last save: ${new Date(e).toLocaleString()}
Click to sync`,this.item.backgroundColor=void 0}setPipeline(e){let{completedSteps:t,totalSteps:o,status:s}=e;switch(s){case"running":this.item.text=`$(sync~spin) Contox: pipeline ${t}/${o}`,this.item.tooltip=`Pipeline running \u2014 ${t}/${o} steps complete`,this.item.backgroundColor=void 0;break;case"done":this.item.text="$(check) Contox: pipeline done",this.item.tooltip=`Pipeline complete \u2014 ${o} steps`,this.item.backgroundColor=void 0;break;case"failed":this.item.text="$(error) Contox: pipeline failed",this.item.tooltip=`Pipeline failed \u2014 ${t}/${o} steps completed`,this.item.backgroundColor=new M.ThemeColor("statusBarItem.warningBackground");break;default:this.item.text="$(clock) Contox: pipeline pending",this.item.tooltip="Pipeline pending...",this.item.backgroundColor=void 0}}setCapturing(e,t){let o=Math.floor(e/60),s=e%60,i=o>0?`${o}m ${String(s).padStart(2,"0")}s`:`${s}s`;this.item.text=`$(record) Contox: ${i} \xB7 ${t} events`,this.item.tooltip=`Capturing work activity
${t} events buffered
Click to send now`,this.item.command="contox.flushCapture",this.item.backgroundColor=void 0}dispose(){this.refreshTimer&&clearInterval(this.refreshTimer),this.item.dispose()}};var W=u(require("vscode")),Me=3e4,Ee=5e3,Be={enrich:"Enrichment",embed:"Embedding",dedup:"Deduplication",drift_check:"Drift Check"};var G=class{constructor(e,t){this.client=e;this.statusBar=t}sessionsTimer;pipelineTimer;knownSessionIds=new Set;isFirstPoll=!0;activeSessionId=null;trackedActiveSessionId=null;lastSaveTime=null;projectId=null;disposed=!1;gitWatcher=null;setGitWatcher(e){this.gitWatcher=e}start(e){this.stop(),this.projectId=e,this.isFirstPoll=!0,this.knownSessionIds.clear(),this.pollSessions(),this.sessionsTimer=setInterval(()=>{this.pollSessions()},Me)}stop(){this.sessionsTimer&&(clearInterval(this.sessionsTimer),this.sessionsTimer=void 0),this.stopPipelinePolling(),this.projectId=null}stopPipelinePolling(){this.pipelineTimer&&(clearInterval(this.pipelineTimer),this.pipelineTimer=void 0),this.activeSessionId=null}async pollSessions(){if(this.disposed||!this.projectId)return;let e=await this.client.listSessions(this.projectId,5);if(e.error||!e.data)return;let t=e.data.sessions;if(t.length>0){let s=t[0];this.lastSaveTime=s.updatedAt,this.statusBar.setLastSave(this.lastSaveTime)}let o=t.find(s=>s.status==="active");if(this.isFirstPoll){for(let s of t)this.knownSessionIds.add(s.id);this.trackedActiveSessionId=o?.id??null,this.isFirstPoll=!1;return}this.trackedActiveSessionId&&!o?(console.log("[SessionWatcher] Active session closed externally \u2014 creating new session"),this.gitWatcher?.resetBuffer(),this.client.createSession(this.projectId,"vscode").then(s=>{!s.error&&s.data&&(this.trackedActiveSessionId=s.data.sessionId,this.knownSessionIds.add(s.data.sessionId),W.window.showInformationMessage("Contox: Session closed externally \u2014 new session started."))})):this.trackedActiveSessionId=o?.id??null;for(let s of t)this.knownSessionIds.has(s.id)||(this.knownSessionIds.add(s.id),this.onNewSession(s))}onNewSession(e){let t="New session saved";if(e.summary)try{let i=JSON.parse(e.summary);typeof i.executiveSummary=="string"&&(t=i.executiveSummary)}catch{t=e.summary}let o=t.length>120?t.slice(0,117)+"...":t,s=e.source==="mcp-server"?"MCP":e.source==="cli-auto"?"CLI":e.source??"unknown";W.window.showInformationMessage(`$(cloud-upload) Contox: Session saved (${s}) \u2014 ${o}`,"View Pipeline","Dismiss").then(i=>{i==="View Pipeline"&&this.startPipelinePolling(e.id)}),this.lastSaveTime=e.updatedAt,this.statusBar.setLastSave(this.lastSaveTime),this.startPipelinePolling(e.id)}startPipelinePolling(e){this.stopPipelinePolling(),this.activeSessionId=e,this.pollPipeline(),this.pipelineTimer=setInterval(()=>{this.pollPipeline()},Ee)}async pollPipeline(){if(this.disposed||!this.activeSessionId)return;let e=await this.client.getSessionJobs(this.activeSessionId);if(e.error||!e.data)return;let{jobs:t,pipeline:o}=e.data;if(this.statusBar.setPipeline(o),o.status==="done"||o.status==="failed"){this.stopPipelinePolling();let s=t.map(i=>{let n=i.status==="done"?"\u2713":i.status==="failed"?"\u2717":"\u25CB",a=Be[i.jobType]??i.jobType;return`${n} ${a}`}).join("  ");if(o.status==="done")W.window.showInformationMessage(`$(check) Contox pipeline complete: ${s}`);else{let i=t.find(a=>a.status==="failed"),n=i?.lastError?` \u2014 ${i.lastError.slice(0,80)}`:"";W.window.showWarningMessage(`$(warning) Contox pipeline failed: ${s}${n}`)}this.lastSaveTime&&this.statusBar.setLastSave(this.lastSaveTime)}}dispose(){this.disposed=!0,this.stop()}};var h=u(require("vscode")),ne=require("child_process"),ae=require("util"),N=(0,ae.promisify)(ne.execFile),Le=15*60*1e3,Fe=15*60*1e3,Ne=50,$e=100*1024,q=class{constructor(e,t,o){this.client=e;this.statusBar=t;this.secrets=o}projectId=null;lastKnownHead=null;buffer=null;disposed=!1;idleTimer;autoFlushTimer;captureTickTimer;gitStateDisposable;fileSaveDisposable;start(e){this.disposed||!h.workspace.getConfiguration("contox").get("capture.enabled",!0)||(this.projectId=e,this.initBuffer(),this.watchGitState(),this.watchFileSaves(),this.startTimers())}resetBuffer(){this.initBuffer()}stop(){this.clearTimers(),this.gitStateDisposable?.dispose(),this.gitStateDisposable=void 0,this.fileSaveDisposable?.dispose(),this.fileSaveDisposable=void 0,this.projectId=null}async flush(){if(!this.buffer||!this.projectId||this.buffer.commits.length===0&&this.buffer.filesModified.size===0)return;let e=await this.getHmacSecret();if(!e){console.warn("[GitWatcher] No HMAC secret configured \u2014 skipping flush");return}let t={type:"vscode_capture",commits:this.buffer.commits,filesModified:[...this.buffer.filesModified],sessionDurationMs:Date.now()-this.buffer.sessionStartTime,activeEditorFiles:[...this.buffer.activeEditorFiles]},o=await this.client.ingestEvents(this.projectId,t,e);if(o.error)console.error("[GitWatcher] Ingest failed:",o.error),h.window.showWarningMessage(`Contox: Failed to send captured events \u2014 ${o.error}`);else{let s=this.buffer.commits.length,i=this.buffer.filesModified.size;console.log(`[GitWatcher] Flushed: ${s} commits, ${i} files`)}this.initBuffer()}getEventCount(){return this.buffer?.eventCount??0}getSessionDurationMs(){return this.buffer?Date.now()-this.buffer.sessionStartTime:0}async endSession(){if(!this.projectId)return{closed:!1};await this.flush();let e=await this.client.getActiveSession(this.projectId);if(e.error||!e.data)return{closed:!1};if((await this.client.closeSession(e.data.id)).error)return{closed:!1};this.initBuffer();let o,s=await this.client.createSession(this.projectId,"vscode");return!s.error&&s.data&&(o=s.data.sessionId),{closed:!0,sessionId:e.data.id,newSessionId:o}}watchGitState(){this.gitStateDisposable?.dispose();try{let e=h.extensions.getExtension("vscode.git");if(!e){console.warn("[GitWatcher] Git extension not found \u2014 falling back to polling"),this.startGitPolling();return}let t=e.isActive?e.exports.getAPI(1):null;if(!t||!t.repositories||t.repositories.length===0){console.warn("[GitWatcher] No git repositories found \u2014 falling back to polling"),this.startGitPolling();return}let o=t.repositories[0];this.lastKnownHead=o.state?.HEAD?.commit??null,this.gitStateDisposable=o.state.onDidChange(()=>{this.onGitStateChanged(o)})}catch{console.warn("[GitWatcher] Failed to access git extension \u2014 falling back to polling"),this.startGitPolling()}}async onGitStateChanged(e){if(this.disposed||!this.buffer)return;let t=e.state?.HEAD?.commit??null;if(!t||t===this.lastKnownHead)return;let o=this.lastKnownHead;this.lastKnownHead=t,o?await this.captureNewCommits(o,t):await this.captureCommit(t),console.log("[GitWatcher] Commit detected \u2014 auto-flushing"),await this.flush(),this.checkForPush()}async checkForPush(){let e=this.getWorkspaceRoot();if(!(!e||!this.buffer||this.buffer.eventCount===0))try{let{stdout:t}=await N("git",["rev-parse","HEAD"],{cwd:e}),{stdout:o}=await N("git",["rev-parse","@{u}"],{cwd:e});t.trim()===o.trim()&&(console.log("[GitWatcher] Push detected \u2014 auto-flushing"),await this.flush())}catch{}}gitPollTimer;startGitPolling(){this.gitPollTimer=setInterval(()=>{this.pollGitHead()},15e3)}async pollGitHead(){if(this.disposed||!this.buffer)return;let e=this.getWorkspaceRoot();if(e)try{let{stdout:t}=await N("git",["rev-parse","HEAD"],{cwd:e}),o=t.trim();this.lastKnownHead&&o!==this.lastKnownHead&&(await this.captureNewCommits(this.lastKnownHead,o),console.log("[GitWatcher] Commit detected (poll) \u2014 auto-flushing"),await this.flush()),this.lastKnownHead=o}catch{}}async captureNewCommits(e,t){let o=this.getWorkspaceRoot();if(!(!o||!this.buffer))try{let{stdout:s}=await N("git",["log",`${e}..${t}`,"--format=%H|%s|%an|%aI","--no-merges"],{cwd:o}),i=s.trim().split(`
`).filter(Boolean);for(let n of i){let[a,c,g,l]=n.split("|");a&&await this.captureCommitDetails(o,a,c??"",g??"",l??"")}}catch{await this.captureCommit(t)}}async captureCommit(e){let t=this.getWorkspaceRoot();if(!(!t||!this.buffer))try{let{stdout:o}=await N("git",["log","-1",e,"--format=%s|%an|%aI"],{cwd:t}),[s,i,n]=o.trim().split("|");await this.captureCommitDetails(t,e,s??"",i??"",n??"")}catch{}}async captureCommitDetails(e,t,o,s,i){if(!this.buffer)return;let n=[],a=0,c=0;try{let{stdout:l}=await N("git",["diff-tree","--no-commit-id","-r","--numstat",t],{cwd:e});for(let d of l.trim().split(`
`).filter(Boolean)){let m=d.split("	"),x=parseInt(m[0]??"0",10),R=parseInt(m[1]??"0",10),F=m[2]??"";F&&!this.isExcluded(F)&&(n.push(F),a+=isNaN(x)?0:x,c+=isNaN(R)?0:R,this.buffer.filesModified.add(F))}}catch{}n=n.filter(l=>!this.isExcluded(l));let g={sha:t.slice(0,12),message:o.slice(0,500),author:s.slice(0,200),timestamp:i,filesChanged:n,insertions:a,deletions:c};this.buffer.commits.push(g),this.buffer.eventCount+=1,this.buffer.totalPayloadSize+=JSON.stringify(g).length,this.buffer.lastActivityTime=Date.now(),this.updateStatusBar(),this.checkVolumeThreshold()}watchFileSaves(){this.fileSaveDisposable?.dispose(),this.fileSaveDisposable=h.workspace.onDidSaveTextDocument(e=>{if(!this.buffer||this.disposed)return;let t=h.workspace.asRelativePath(e.uri,!1);if(!this.isExcluded(t)){let o=!this.buffer.filesModified.has(t);this.buffer.filesModified.add(t),this.buffer.lastActivityTime=Date.now(),o&&(this.buffer.eventCount+=1)}}),h.window.onDidChangeActiveTextEditor(e=>{if(!this.buffer||this.disposed||!e)return;let t=h.workspace.asRelativePath(e.document.uri,!1);this.isExcluded(t)||this.buffer.activeEditorFiles.add(t)})}startTimers(){this.clearTimers(),this.idleTimer=setInterval(()=>{if(!this.buffer||this.buffer.eventCount===0)return;Date.now()-this.buffer.lastActivityTime>Le&&this.flush()},6e4),this.autoFlushTimer=setInterval(()=>{!this.buffer||this.buffer.eventCount===0||(console.log(`[GitWatcher] Auto-flush: ${this.buffer.eventCount} events, ${this.buffer.commits.length} commits`),this.flush())},Fe),this.captureTickTimer=setInterval(()=>{this.updateStatusBar()},1e3)}clearTimers(){this.idleTimer&&(clearInterval(this.idleTimer),this.idleTimer=void 0),this.autoFlushTimer&&(clearInterval(this.autoFlushTimer),this.autoFlushTimer=void 0),this.captureTickTimer&&(clearInterval(this.captureTickTimer),this.captureTickTimer=void 0),this.gitPollTimer&&(clearInterval(this.gitPollTimer),this.gitPollTimer=void 0)}checkVolumeThreshold(){this.buffer&&(this.buffer.eventCount>=Ne||this.buffer.totalPayloadSize>=$e)&&(console.log(`[GitWatcher] Volume threshold reached (${this.buffer.eventCount} events) \u2014 auto-flushing`),this.flush())}initBuffer(){this.buffer={commits:[],filesModified:new Set,activeEditorFiles:new Set,sessionStartTime:Date.now(),lastActivityTime:Date.now(),eventCount:0,totalPayloadSize:0}}updateStatusBar(){if(!this.buffer||this.buffer.eventCount===0)return;let e=Math.floor(this.getSessionDurationMs()/1e3);this.statusBar.setCapturing(e,this.buffer.eventCount)}getWorkspaceRoot(){let e=h.workspace.workspaceFolders;return!e||e.length===0?null:e[0].uri.fsPath}isExcluded(e){let o=h.workspace.getConfiguration("contox").get("capture.excludePatterns",["*.env","*.key","*.pem","*.p12","*.pfx","node_modules/**",".git/**","dist/**"]),s=e.toLowerCase();for(let i of o)if(i.startsWith("*")){if(s.endsWith(i.slice(1)))return!0}else if(i.endsWith("/**")){let n=i.slice(0,-3);if(s.startsWith(n+"/")||s.startsWith(n+"\\"))return!0}else if(s===i.toLowerCase())return!0;return!1}hmacSecretWarningShown=!1;async getHmacSecret(){let e=await this.secrets.get("contox-hmac-secret");if(e)return e;let o=h.workspace.getConfiguration("contox").get("hmacSecret","");if(o)return o;if(this.projectId)try{let s=await this.client.getProjectHmacSecret(this.projectId);if(s.data?.hmacSecret)return await this.secrets.store("contox-hmac-secret",s.data.hmacSecret),console.log("[GitWatcher] HMAC secret fetched from API and cached"),s.data.hmacSecret}catch{}return this.hmacSecretWarningShown||(this.hmacSecretWarningShown=!0,h.window.showWarningMessage('Contox: Capture events cannot be sent \u2014 HMAC secret missing. Re-run "Contox: Setup" to fix.',"Open Setup").then(s=>{s==="Open Setup"&&h.commands.executeCommand("contox.setup")})),null}dispose(){this.disposed=!0,this.flush(),this.stop()}};var E=u(require("vscode"));function ce(r){return E.commands.registerCommand("contox.login",async()=>{let e=await E.window.showInputBox({prompt:"Enter your Contox API key",password:!0,placeHolder:"ctx_xxxxxxxxxxxxxxxx",ignoreFocusOut:!0});if(!e)return;await r.setApiKey(e);let t=await r.getContext("__ping__");if(t.error==="Unauthorized"||t.error==='Not authenticated. Run "Contox: Login" first.'){await r.clearApiKey(),E.window.showErrorMessage("Contox: Invalid API key.");return}E.window.showInformationMessage("Contox: Logged in successfully"),await E.commands.executeCommand("contox.sync")})}var w=u(require("vscode")),J=u(require("fs")),de=u(require("path"));function le(r){return w.commands.registerCommand("contox.init",async()=>{if(!await r.getApiKey()){w.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');return}let t=w.workspace.workspaceFolders;if(!t||t.length===0){w.window.showErrorMessage("Contox: Open a workspace folder first.");return}let o=t[0].uri.fsPath,s=de.join(o,".contox.json");if(J.existsSync(s)&&await w.window.showWarningMessage("Contox: This workspace is already initialized. Reconfigure?","Yes","No")!=="Yes")return;let i=await w.window.showInputBox({prompt:"Enter your Contox organization (team) ID",placeHolder:"e.g. 6632a1\u2026",ignoreFocusOut:!0});if(!i)return;let n=await r.listProjects(i);if(n.error){w.window.showErrorMessage(`Contox: ${n.error}`);return}let c=[...(n.data??[]).map(m=>({label:m.name,description:`${m.contextsCount} context${m.contextsCount===1?"":"s"}`,project:m})),{label:"$(add) Create a new project...",description:""}],g=await w.window.showQuickPick(c,{placeHolder:"Select a project to link to this workspace",ignoreFocusOut:!0});if(!g)return;let l=g.project;if(!l){w.window.showInformationMessage('Create a new project on the Contox dashboard, then run "Contox: Initialize Project" again.');return}let d={teamId:i,projectId:l.id,projectName:l.name};J.writeFileSync(s,JSON.stringify(d,null,2)+`
`),w.window.showInformationMessage(`Contox: Linked workspace to project "${l.name}"`),await w.commands.executeCommand("contox.sync")})}var B=u(require("vscode"));function ue(r,e,t){return B.commands.registerCommand("contox.sync",async()=>{if(!await r.getApiKey()){B.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');return}let s=S();if(!s){B.window.showWarningMessage('Contox: No project linked. Run "Contox: Initialize Project" first.');return}t.setSyncing();let i=await r.getBrain(s.projectId);if(i.error){t.setError(),B.window.showErrorMessage(`Contox sync failed: ${i.error}`);return}let n=i.data?.tree??[],a=i.data?.itemsLoaded??0;e.setTree(n,a),t.setSynced(),B.window.showInformationMessage(`Contox: Loaded ${a} memory items from "${s.projectName}"`)})}var I=u(require("vscode"));function me(r,e,t){return I.commands.registerCommand("contox.create",async()=>{if(!await r.getApiKey()){I.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');return}let s=S();if(!s){I.window.showWarningMessage('Contox: No project linked. Run "Contox: Initialize Project" first.');return}let i=await I.window.showInputBox({prompt:"Context name",placeHolder:"e.g. API Documentation",ignoreFocusOut:!0});if(!i)return;let n=await I.window.showInputBox({prompt:"Description (optional)",placeHolder:"e.g. REST API docs for the backend",ignoreFocusOut:!0}),a=await r.createContext(i,s.teamId,s.projectId,n||void 0);if(a.error){I.window.showErrorMessage(`Contox: Failed to create context \u2014 ${a.error}`);return}I.window.showInformationMessage(`Contox: Created context "${i}"`),t.setSyncing();let c=await r.getBrain(s.projectId);!c.error&&c.data&&e.setTree(c.data.tree,c.data.itemsLoaded),t.setSynced()})}var v=u(require("vscode")),p=u(require("fs")),j=u(require("path")),pe=u(require("os")),P;function fe(r,e,t,o){return v.commands.registerCommand("contox.setup",()=>{Y(r,e,t,o)})}function Y(r,e,t,o){if(P){P.reveal(v.ViewColumn.One);return}P=v.window.createWebviewPanel("contoxSetup","Contox Setup",v.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0}),P.webview.html=Ke(),P.webview.onDidReceiveMessage(async s=>{await De(s,r,e,t,P,o)},void 0,o.subscriptions),P.onDidDispose(()=>{P=void 0}),(async()=>await r.getApiKey()&&P?.webview.postMessage({type:"alreadyLoggedIn"}))()}async function De(r,e,t,o,s,i){let n=a=>{s.webview.postMessage(a)};switch(r.type){case"login":{if(!r.apiKey){n({type:"loginResult",success:!1,error:"No API key provided"});return}if(await e.setApiKey(r.apiKey),(await e.getContext("__ping__")).error==="Unauthorized"){await e.clearApiKey(),n({type:"loginResult",success:!1,error:"Invalid API key"});return}n({type:"loginResult",success:!0});break}case"loadTeams":{let a=await e.listTeams();if(a.error){n({type:"teamsLoaded",success:!1,error:a.error});return}n({type:"teamsLoaded",success:!0,teams:(a.data??[]).map(c=>({id:c.id,name:c.name,members:c.members}))});break}case"loadProjects":{if(!r.teamId){n({type:"projectsLoaded",success:!1,error:"No team ID provided"});return}let a=await e.listProjects(r.teamId);if(a.error){n({type:"projectsLoaded",success:!1,error:a.error});return}n({type:"projectsLoaded",success:!0,projects:(a.data??[]).map(c=>({id:c.id,name:c.name,contextsCount:c.contextsCount}))});break}case"selectProject":{if(!r.teamId||!r.projectId||!r.projectName)return;let a=v.workspace.workspaceFolders;if(!a||a.length===0){n({type:"projectSelected",success:!1,error:"No workspace folder open"});return}let c=a[0].uri.fsPath,g=j.join(c,".contox.json"),l={teamId:r.teamId,projectId:r.projectId,projectName:r.projectName};try{p.writeFileSync(g,JSON.stringify(l,null,2)+`
`);let d=await e.getProjectHmacSecret(r.projectId);d.data?.hmacSecret&&await i.secrets.store("contox-hmac-secret",d.data.hmacSecret),n({type:"projectSelected",success:!0}),o.setSyncing();let m=await e.getBrain(r.projectId);!m.error&&m.data&&t.setTree(m.data.tree,m.data.itemsLoaded),o.setSynced()}catch(d){n({type:"projectSelected",success:!1,error:String(d)})}break}case"configureAI":{let a=r.aiTools??[],c=[],l=v.workspace.workspaceFolders?.[0]?.uri.fsPath??"",d="",m="";try{let C=p.readFileSync(j.join(l,".contox.json"),"utf-8"),se=JSON.parse(C);d=se.teamId??"",m=se.projectId??""}catch{}let x=await e.getApiKey()??"",R=v.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev"),F=await i.secrets.get("contox-hmac-secret")??"";if(a.includes("claude"))try{We(x,R,d,m,l,F)&&c.push("Claude MCP server configured")}catch(C){c.push(`Claude: ${String(C)}`)}if(a.includes("cursor"))try{He(l),c.push("Cursor rules configured")}catch(C){c.push(`Cursor: ${String(C)}`)}if(a.includes("copilot"))try{Oe(l),c.push("GitHub Copilot instructions configured")}catch(C){c.push(`Copilot: ${String(C)}`)}if(a.includes("windsurf"))try{_e(l),c.push("Windsurf rules configured")}catch(C){c.push(`Windsurf: ${String(C)}`)}n({type:"aiConfigured",results:c});break}case"runScan":{n({type:"scanStarted"});try{if(!v.workspace.workspaceFolders){n({type:"scanResult",success:!1,error:"No workspace open"});return}let c=await e.getApiKey()??"",g=v.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev"),l=j.join(pe.homedir(),".contoxrc");p.writeFileSync(l,JSON.stringify({apiKey:c,apiUrl:g},null,2),"utf-8");let d=v.window.createTerminal("Contox Scan");d.sendText("node packages/cli/dist/index.js scan"),d.show(),n({type:"scanResult",success:!0})}catch(a){n({type:"scanResult",success:!1,error:String(a)})}break}case"finish":{s.dispose(),v.window.showInformationMessage("Contox: Setup complete! Your AI now has persistent memory.");break}}}function We(r,e,t,o,s,i){let n={CONTOX_API_KEY:r,CONTOX_API_URL:e,CONTOX_TEAM_ID:t,CONTOX_PROJECT_ID:o};i&&(n.CONTOX_HMAC_SECRET=i);let a={mcpServers:{contox:{command:"node",args:["packages/mcp-server/dist/index.js"],env:n}}},c=j.join(s,".mcp.json");return p.writeFileSync(c,JSON.stringify(a,null,2)+`
`),!0}function He(r){let e='# Contox AI Memory\n\nAt the START of each session, run this command to load project memory:\n```\ncontox memory\n```\n\nAt the END of each session, save what you did:\n```\ncontox save "Brief summary of what was accomplished"\n```\n\nFor structured saves with categories (architecture, conventions, implementation, decisions, bugs, todo):\n```\necho \'{"summary":"...","changes":[{"category":"implementation","title":"...","content":"..."}]}\' | contox save --json\n```\n',t=j.join(r,".cursorrules");if(p.existsSync(t)){let o=p.readFileSync(t,"utf-8");o.includes("contox memory")||p.writeFileSync(t,o+`

`+e)}else p.writeFileSync(t,e)}function Oe(r){let e=`# Contox AI Memory

At the START of each session, run: \`contox memory\`
At the END of each session, run: \`contox save "Brief summary"\`

For structured saves: \`echo '{"summary":"...","changes":[...]}' | contox save --json\`
Categories: architecture, conventions, implementation, decisions, bugs, todo
`,t=j.join(r,".github");p.existsSync(t)||p.mkdirSync(t,{recursive:!0});let o=j.join(t,"copilot-instructions.md");if(p.existsSync(o)){let s=p.readFileSync(o,"utf-8");s.includes("contox memory")||p.writeFileSync(o,s+`

`+e)}else p.writeFileSync(o,e)}function _e(r){let e='# Contox AI Memory\nAt the START of each session, run: `contox memory`\nAt the END of each session, run: `contox save "Brief summary"`\n',t=j.join(r,".windsurfrules");if(p.existsSync(t)){let o=p.readFileSync(t,"utf-8");o.includes("contox memory")||p.writeFileSync(t,o+`

`+e)}else p.writeFileSync(t,e)}function Ke(){return`<!DOCTYPE html>
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
            <div class="name">Claude</div>
            <div class="desc">MCP server</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="cursor" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Cursor</div>
            <div class="desc">.cursorrules</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="copilot" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">GitHub Copilot</div>
            <div class="desc">instructions.md</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="windsurf" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Windsurf</div>
            <div class="desc">.windsurfrules</div>
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
</html>`}var L=u(require("vscode")),X=u(require("fs")),ge=u(require("path"));function he(r){return L.commands.registerCommand("contox.reset",async()=>{if(await L.window.showWarningMessage("Contox: This will log you out and remove the workspace configuration. Continue?",{modal:!0},"Reset")!=="Reset")return;await r.clearApiKey();let t=L.workspace.workspaceFolders;if(t&&t.length>0){let o=ge.join(t[0].uri.fsPath,".contox.json");try{X.existsSync(o)&&X.unlinkSync(o)}catch{}}L.window.showInformationMessage('Contox: Reset complete. Run "Contox: Setup Wizard" to reconfigure.')})}var T=u(require("vscode")),y=u(require("fs")),D=u(require("path"));var k=u(require("fs")),$=u(require("path")),ve="<!-- contox:start -->",Z="<!-- contox:end -->",ze=`# Contox \u2014 Project Memory

You have access to a persistent project memory that survives across sessions.
The file \`.contox/memory.md\` in this workspace contains architecture decisions,
conventions, implementation history, bug fixes, and todos from all previous sessions.

## MANDATORY: Read memory at session start
- Read \`.contox/memory.md\` BEFORE starting any work
- This is your primary source of truth about this project
- Do NOT ask questions that are already answered in the memory

## Save your work at session end
- Run: \`contox save "Brief summary of what you did"\`
- For structured saves: \`echo '{"summary":"...","changes":[{"category":"implementation","title":"...","content":"..."}]}' | contox save --json\`
- Categories: architecture, conventions, implementation, decisions, bugs, todo`,Ue=[{name:"Cursor",relPath:".cursorrules",dirHint:".cursor"},{name:"Copilot",relPath:$.join(".github","copilot-instructions.md"),dirHint:".github"},{name:"Windsurf",relPath:".windsurfrules"},{name:"Cline",relPath:".clinerules"}];function Ve(r,e){let t=`${ve}
${e}
${Z}`;if(!r.trim())return t+`
`;let o=r.indexOf(ve),s=r.indexOf(Z);if(o!==-1&&s!==-1){let n=r.slice(0,o),a=r.slice(s+Z.length);return n+t+a}let i=r.endsWith(`
`)?`
`:`

`;return r+i+t+`
`}function ee(r){let e=[];for(let t of Ue){let o=$.join(r,t.relPath),s=k.existsSync(o),i=t.dirHint?k.existsSync($.join(r,t.dirHint)):!1;if(!(!s&&!i))try{let n=$.dirname(o);k.existsSync(n)||k.mkdirSync(n,{recursive:!0});let a=s?k.readFileSync(o,"utf-8"):"",c=Ve(a,ze);k.writeFileSync(o,c,"utf-8"),e.push(t.name)}catch{}}return e}function we(r){return T.commands.registerCommand("contox.loadMemory",async()=>{let e=S();if(!e){T.window.showWarningMessage("Contox: No project linked. Connect via dashboard first.");return}let t=T.workspace.workspaceFolders;if(!t||t.length===0)return;let o=t[0].uri.fsPath,s=await r.getBrain(e.projectId);if(s.error){T.window.showErrorMessage(`Contox: Failed to load memory \u2014 ${s.error}`);return}let i=s.data;if(!i||!i.document||i.document.trim().length===0){T.window.showInformationMessage("Contox: Memory is empty \u2014 nothing to load yet.");return}let n=D.join(o,".contox");y.existsSync(n)||y.mkdirSync(n,{recursive:!0});let a=D.join(n,"memory.md");y.writeFileSync(a,i.document,"utf-8"),ye(o);let c=ee(o),g=c.length>0?` \u2192 ${c.join(", ")}`:"";T.window.showInformationMessage(`Contox: Memory loaded (${String(i.itemsLoaded)} items, ~${String(i.tokenEstimate)} tokens)${g}`)})}async function te(r,e,t){try{let o=await r.getBrain(t);if(o.error||!o.data?.document)return!1;let s=D.join(e,".contox");return y.existsSync(s)||y.mkdirSync(s,{recursive:!0}),y.writeFileSync(D.join(s,"memory.md"),o.data.document,"utf-8"),ye(e),ee(e),!0}catch{return!1}}function ye(r){let e=D.join(r,".gitignore");try{let t="";if(y.existsSync(e)&&(t=y.readFileSync(e,"utf-8")),!t.includes(".contox/")){let o=t.length>0&&!t.endsWith(`
`)?`
`:"";y.writeFileSync(e,t+o+`
# Contox local memory
.contox/
`,"utf-8")}}catch{}}var A=u(require("vscode"));function xe(r){return A.commands.registerCommand("contox.endSession",async()=>{if(!S()){A.window.showWarningMessage("Contox: No project linked. Connect via dashboard first.");return}let t=await A.window.withProgress({location:A.ProgressLocation.Notification,title:"Contox: Ending session\u2026",cancellable:!1},async()=>r.endSession());if(t.closed){let o=t.newSessionId?"Contox: Session closed \u2014 new session started.":"Contox: Session closed. Next activity will start a new session.";A.window.showInformationMessage(o)}else A.window.showWarningMessage("Contox: No active session found, or failed to close it.")})}function S(){let r=f.workspace.workspaceFolders;if(!r||r.length===0)return null;let e=r[0].uri.fsPath,t=Q.join(e,".contox.json");try{let o=H.readFileSync(t,"utf-8"),s=JSON.parse(o),i=s.teamId,n=s.projectId,a=s.projectName;return typeof i=="string"&&typeof n=="string"?{teamId:i,projectId:n,projectName:typeof a=="string"?a:"Unknown"}:null}catch{return null}}var oe=class{constructor(e,t,o,s,i,n){this.client=e;this.treeProvider=t;this.statusBar=o;this.sessionWatcher=s;this.gitWatcher=i;this.context=n}async handleUri(e){let t=new URLSearchParams(e.query),o=t.get("token"),s=t.get("teamId"),i=t.get("projectId"),n=t.get("projectName"),a=t.get("hmacSecret");e.path==="/setup"&&o&&await this.handleSetup(o,s,i,n,a)}async handleSetup(e,t,o,s,i){if(await this.client.setApiKey(e),i&&await this.context.secrets.store("contox-hmac-secret",i),t&&o)await this.autoConfigureProject(e,t,o,s??"Project",i);else if(t)await this.showProjectPicker(t);else{f.window.showInformationMessage("$(check) Contox: Authenticated! Choose a project to get started.","Open Setup").then(n=>{n==="Open Setup"&&Y(this.client,this.treeProvider,this.statusBar,this.context)});return}}async autoConfigureProject(e,t,o,s,i){let n=f.workspace.workspaceFolders;if(!n||n.length===0){f.window.showWarningMessage("Contox: Open a workspace folder first, then try again.");return}let a=n[0].uri.fsPath,c=Q.join(a,".contox.json");H.writeFileSync(c,JSON.stringify({teamId:t,projectId:o,projectName:s},null,2)+`
`,"utf-8"),i&&await this.context.secrets.store("contox-hmac-secret",i);try{let l=Q.join(require("os").homedir(),".contoxrc"),d=f.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev"),m={apiKey:e,apiUrl:d,teamId:t,projectId:o};i&&(m.hmacSecret=i),H.writeFileSync(l,JSON.stringify(m,null,2)+`
`,"utf-8")}catch{}this.sessionWatcher.start(o),this.gitWatcher.start(o),await f.commands.executeCommand("contox.sync"),te(this.client,a,o),f.window.showInformationMessage(`$(check) Contox: Connected to "${s}" \u2014 memory loaded for all AI tools`)}async showProjectPicker(e){let t=await this.client.listProjects(e);if(t.error||!t.data){f.window.showErrorMessage(`Contox: Failed to load projects \u2014 ${t.error??"unknown error"}`);return}let o=t.data;if(o.length===0){f.window.showWarningMessage("Contox: No projects found for this team. Create one on the dashboard first.");return}let s=await f.window.showQuickPick(o.map(i=>({label:i.name,description:i.description??"",detail:`${i.contextsCount} contexts`,projectId:i.id})),{placeHolder:"Choose a project"});if(s){let i=await this.client.getApiKey();i&&await this.autoConfigureProject(i,e,s.projectId,s.label,null)}}};function Ge(r){let e=new _(r.secrets),t=new U(e),o=new V,s=new G(e,o),i=new q(e,o,r.secrets);s.setGitWatcher(i);let n=f.window.createTreeView("contoxContexts",{treeDataProvider:t,showCollapseAll:!1}),a=!1,c=new oe(e,t,o,s,i,r),g=c.handleUri.bind(c);c.handleUri=async l=>(a=!0,g(l)),r.subscriptions.push(ce(e),le(e),ue(e,t,o),me(e,t,o),fe(e,t,o,r),he(e),we(e),xe(i),f.commands.registerCommand("contox.flushCapture",()=>{i.flush()}),n,o,s,i,f.window.registerUriHandler(c)),(async()=>{if(await new Promise(x=>{setTimeout(x,500)}),a)return;let l=await e.getApiKey(),d=S(),m=f.workspace.workspaceFolders;if(l&&d&&m&&m.length>0){if(await f.commands.executeCommand("contox.sync"),te(e,m[0].uri.fsPath,d.projectId),!await r.secrets.get("contox-hmac-secret"))try{let R=await e.getProjectHmacSecret(d.projectId);R.data?.hmacSecret&&await r.secrets.store("contox-hmac-secret",R.data.hmacSecret)}catch{}s.start(d.projectId),i.start(d.projectId)}else f.workspace.workspaceFolders&&f.workspace.workspaceFolders.length>0&&await f.window.showInformationMessage("Contox: Set up AI memory for this project?","Setup","Later")==="Setup"&&Y(e,t,o,r)})()}function qe(){}0&&(module.exports={activate,deactivate,getWorkspaceConfig});
//# sourceMappingURL=extension.js.map
