"use strict";var nt=Object.create;var ne=Object.defineProperty;var rt=Object.getOwnPropertyDescriptor;var at=Object.getOwnPropertyNames;var ct=Object.getPrototypeOf,dt=Object.prototype.hasOwnProperty;var lt=(i,e)=>{for(var t in e)ne(i,t,{get:e[t],enumerable:!0})},je=(i,e,t,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of at(e))!dt.call(i,s)&&s!==t&&ne(i,s,{get:()=>e[s],enumerable:!(o=rt(e,s))||o.enumerable});return i};var p=(i,e,t)=>(t=i!=null?nt(ct(i)):{},je(e||!i||!i.__esModule?ne(t,"default",{value:i,enumerable:!0}):t,i)),ut=i=>je(ne({},"__esModule",{value:!0}),i);var Kt={};lt(Kt,{activate:()=>Ht,deactivate:()=>Ut,getWorkspaceConfig:()=>P});module.exports=ut(Kt);var l=p(require("vscode")),q=p(require("fs")),G=p(require("path"));var L=require("fs"),J=require("crypto"),Re=require("path"),W=require("os"),re=(0,Re.join)((0,W.homedir)(),".contoxrc"),pt="enc:";function mt(){let i=`contox:${(0,W.hostname)()}:${(0,W.userInfo)().username}:${(0,W.homedir)()}`;return(0,J.createHash)("sha256").update(i).digest()}function Ee(i){let e=mt(),t=(0,J.randomBytes)(12),o=(0,J.createCipheriv)("aes-256-gcm",e,t),s=Buffer.concat([o.update(i,"utf8"),o.final()]),n=o.getAuthTag();return`${pt}${t.toString("base64")}:${n.toString("base64")}:${s.toString("base64")}`}function ae(i){let e={};try{(0,L.existsSync)(re)&&(e=JSON.parse((0,L.readFileSync)(re,"utf-8")))}catch{}let t={...e,apiKey:Ee(i.apiKey),apiUrl:i.apiUrl};i.teamId&&(t.teamId=i.teamId),i.projectId&&(t.projectId=i.projectId),i.hmacSecret&&(t.hmacSecret=Ee(i.hmacSecret)),(0,L.writeFileSync)(re,JSON.stringify(t,null,2)+`
`,{encoding:"utf-8",mode:384});try{(0,L.chmodSync)(re,384)}catch{}}var de=p(require("crypto")),N=p(require("vscode"));function Me(){let i=N.env.appName.toLowerCase(),e=(N.env.uriScheme??"").toLowerCase(),t=(N.env.appHost??"").toLowerCase(),o=`${i} ${e} ${t}`;return o.includes("cursor")?"cursor":o.includes("windsurf")?"windsurf":o.includes("antigravity")||o.includes("gemini")?"antigravity":"vscode"}function Ae(i){if(!(i instanceof Error))return"Unknown error";let e=i.cause;return e?`${i.message}: ${e.message}`:i.message}var ce=class i{constructor(e){this.secrets=e;let t=N.workspace.getConfiguration("contox");this.baseUrl=t.get("apiUrl","https://contox.dev")}baseUrl;apiKey;async setApiKey(e){this.apiKey=e,await this.secrets.store("contox-api-key",e)}async getApiKey(){return this.apiKey||(this.apiKey=await this.secrets.get("contox-api-key")),this.apiKey}async clearApiKey(){this.apiKey=void 0,await this.secrets.delete("contox-api-key")}static REQUEST_TIMEOUT_MS=3e4;async request(e,t={}){let o=await this.getApiKey();if(!o)return{error:'Not authenticated. Run "Contox: Login" first.'};let s=`${this.baseUrl}/api${e}`;try{let n=await fetch(s,{...t,signal:t.signal??AbortSignal.timeout(i.REQUEST_TIMEOUT_MS),headers:{"Content-Type":"application/json",Authorization:`Bearer ${o}`,...t.headers}});if(!n.ok){let a=await n.json().catch(()=>({}));return{error:typeof a.error=="string"?a.error:n.statusText}}return{data:await n.json()}}catch(n){return{error:Ae(n)}}}async listContexts(e){let t=[],o=0,s=100;for(;;){let n=await this.request(`/integrations/vscode?projectId=${encodeURIComponent(e)}&limit=${s}&offset=${o}`);if(n.error)return{error:n.error};let r=n.data?.contexts??[];if(t.push(...r),r.length<s||t.length>=(n.data?.total??0))break;o+=s}return{data:t}}async listContextTree(e,t){return this.getBrain(t)}async getContext(e){return this.request(`/contexts/${encodeURIComponent(e)}`)}async createContext(e,t,o,s){return this.request("/contexts",{method:"POST",body:JSON.stringify({name:e,teamId:t,projectId:o,description:s})})}async updateContext(e,t){return this.request(`/contexts/${encodeURIComponent(e)}`,{method:"PATCH",body:JSON.stringify(t)})}async syncContent(e,t){return this.request("/integrations/vscode",{method:"POST",body:JSON.stringify({contextId:e,content:t})})}async listTeams(){let e=await this.request("/orgs");return e.error?{error:e.error}:{data:e.data?.orgs??[]}}async listProjects(e){return this.request(`/projects?teamId=${encodeURIComponent(e)}`)}async getProjectHmacSecret(e){return this.request(`/projects/${encodeURIComponent(e)}/hmac-secret`)}async getBrain(e){return this.request(`/v2/brain?projectId=${encodeURIComponent(e)}`)}async searchMemory(e,t,o=10,s){let n=new URLSearchParams({projectId:e,q:t,limit:String(o),minSimilarity:"0.5"});return s&&s.length>0&&(n.set("activeFiles",s.join(",")),n.set("useCompositeScore","true")),this.request(`/v2/search?${n.toString()}`)}async listSessions(e,t=5){return this.request(`/v2/sessions?projectId=${encodeURIComponent(e)}&limit=${t}`)}async getSessionJobs(e){return this.request(`/v2/sessions/${encodeURIComponent(e)}/jobs`)}async closeSession(e){return this.request(`/v2/sessions/${encodeURIComponent(e)}`,{method:"PATCH",body:JSON.stringify({status:"closed"})})}async getActiveSession(e){let t=await this.listSessions(e,5);return t.error?{error:t.error}:{data:t.data?.sessions.find(s=>s.status==="active")??null}}async createSession(e,t=Me()){return this.request("/v2/sessions",{method:"POST",body:JSON.stringify({projectId:e,source:t})})}async ingestEvents(e,t,o,s){let n=JSON.stringify(t),r=new Date().toISOString(),a=de.randomBytes(16).toString("hex"),c=Me(),u=`${c}
${r}
${e}
${n}`,m=de.createHmac("sha256",o).update(u).digest("hex"),d={source:c,timestamp:r,nonce:a,signature:m,projectId:e,event:t,extensionVersion:N.extensions.getExtension("contox.contox-vscode")?.packageJSON?.version};s?.skipEnrichment&&(d.skipEnrichment=!0);let v=await this.getApiKey();if(!v)return{error:'Not authenticated. Run "Contox: Login" first.'};let h=`${this.baseUrl}/api/v2/ingest`;try{let g=await fetch(h,{method:"POST",signal:AbortSignal.timeout(i.REQUEST_TIMEOUT_MS),headers:{"Content-Type":"application/json",Authorization:`Bearer ${v}`},body:JSON.stringify(d)});if(!g.ok){let f=await g.json().catch(()=>({}));return{error:typeof f.error=="string"?f.error:g.statusText}}return{data:await g.json()}}catch(g){return{error:Ae(g)}}}};var j=p(require("vscode")),gt={"root/decisions":"lightbulb","root/conventions":"list-ordered","root/architecture":"server","root/journal":"notebook","root/bugs":"bug","root/todo":"checklist","root/codemap":"file-code","root/stack":"layers","root/frontend":"browser","root/backend":"server-process"};function ht(i){let e=gt[i.schemaKey];return e?new j.ThemeIcon(e):i.children.length>0?new j.ThemeIcon("symbol-namespace"):new j.ThemeIcon("symbol-field")}var le=class extends j.TreeItem{node;constructor(e){let t=e.children.length>0?j.TreeItemCollapsibleState.Collapsed:j.TreeItemCollapsibleState.None;super(e.name,t),this.node=e,this.tooltip=`${e.schemaKey}
${e.itemCount} memory items`,this.description=e.itemCount>0?`${e.itemCount} items`:"",this.iconPath=ht(e),this.contextValue="contoxContext"}},ue=class{constructor(e){this._client=e}_onDidChangeTreeData=new j.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;rootNodes=[];total=0;setTree(e,t){this.rootNodes=e,this.total=t,this._onDidChangeTreeData.fire()}getTotal(){return this.total}getTreeItem(e){return e}getChildren(e){return e?e.node.children.map(t=>new le(t)):this.rootNodes.map(t=>new le(t))}};var F=p(require("vscode"));function ft(i){let e=Date.now()-new Date(i).getTime(),t=Math.floor(e/1e3);if(t<60)return"just now";let o=Math.floor(t/60);if(o<60)return`${o}m ago`;let s=Math.floor(o/60);return s<24?`${s}h ago`:`${Math.floor(s/24)}d ago`}var pe=class{item;lastSaveIso=null;refreshTimer;constructor(){this.item=F.window.createStatusBarItem(F.StatusBarAlignment.Left,100),this.item.command="contox.sync",this.setIdle(),this.item.show(),this.refreshTimer=setInterval(()=>{this.lastSaveIso&&this.setLastSave(this.lastSaveIso)},3e4)}setIdle(){this.item.text="$(cloud) Contox",this.item.tooltip="Click to sync contexts",this.item.backgroundColor=void 0}setSyncing(){this.item.text="$(sync~spin) Contox: Syncing...",this.item.tooltip="Syncing contexts...",this.item.backgroundColor=void 0}setSynced(){this.item.text="$(cloud) Contox: Synced",this.item.tooltip="Contexts synced \u2014 click to refresh",this.item.backgroundColor=void 0}setError(){this.item.text="$(error) Contox: Error",this.item.tooltip="Sync failed \u2014 click to retry",this.item.backgroundColor=new F.ThemeColor("statusBarItem.errorBackground")}setLastSave(e){this.lastSaveIso=e;let t=ft(e);this.item.text=`$(cloud) Contox: saved ${t}`,this.item.tooltip=`Last save: ${new Date(e).toLocaleString()}
Click to sync`,this.item.backgroundColor=void 0}setPipeline(e){let{completedSteps:t,totalSteps:o,status:s}=e;switch(s){case"running":this.item.text=`$(sync~spin) Contox: pipeline ${t}/${o}`,this.item.tooltip=`Pipeline running \u2014 ${t}/${o} steps complete`,this.item.backgroundColor=void 0;break;case"done":this.item.text="$(check) Contox: pipeline done",this.item.tooltip=`Pipeline complete \u2014 ${o} steps`,this.item.backgroundColor=void 0;break;case"failed":this.item.text="$(error) Contox: pipeline failed",this.item.tooltip=`Pipeline failed \u2014 ${t}/${o} steps completed`,this.item.backgroundColor=new F.ThemeColor("statusBarItem.warningBackground");break;default:this.item.text="$(clock) Contox: pipeline pending",this.item.tooltip="Pipeline pending...",this.item.backgroundColor=void 0}}setDisconnected(){this.item.text="$(debug-disconnect) Contox: Disconnected",this.item.tooltip="Sync paused \u2014 click to reconnect",this.item.command="contox.connect",this.item.backgroundColor=new F.ThemeColor("statusBarItem.warningBackground")}setCapturing(e,t){let o=Math.floor(e/60),s=e%60,n=o>0?`${o}m ${String(s).padStart(2,"0")}s`:`${s}s`;this.item.text=`$(record) Contox: ${n} \xB7 ${t} events`,this.item.tooltip=`Capturing work activity
${t} events buffered
Click to send now`,this.item.command="contox.flushCapture",this.item.backgroundColor=void 0}dispose(){this.refreshTimer&&clearInterval(this.refreshTimer),this.item.dispose()}};var te=p(require("vscode")),vt=3e4,yt=5e3,wt={enrich:"Enrichment",embed:"Embedding",dedup:"Deduplication",drift_check:"Drift Check"};var me=class{constructor(e,t){this.client=e;this.statusBar=t}sessionsTimer;pipelineTimer;knownSessionIds=new Set;isFirstPoll=!0;activeSessionId=null;trackedActiveSessionId=null;lastSaveTime=null;projectId=null;disposed=!1;gitWatcher=null;setGitWatcher(e){this.gitWatcher=e}start(e){this.stop(),this.projectId=e,this.isFirstPoll=!0,this.knownSessionIds.clear(),this.pollSessions(),this.sessionsTimer=setInterval(()=>{this.pollSessions()},vt)}stop(){this.sessionsTimer&&(clearInterval(this.sessionsTimer),this.sessionsTimer=void 0),this.stopPipelinePolling(),this.projectId=null}stopPipelinePolling(){this.pipelineTimer&&(clearInterval(this.pipelineTimer),this.pipelineTimer=void 0),this.activeSessionId=null}async pollSessions(){if(this.disposed||!this.projectId)return;let e=await this.client.listSessions(this.projectId,5);if(e.error||!e.data)return;let t=e.data.sessions;if(t.length>0){let s=t[0];this.lastSaveTime=s.updatedAt,this.statusBar.setLastSave(this.lastSaveTime)}let o=t.find(s=>s.status==="active");if(this.isFirstPoll){for(let s of t)this.knownSessionIds.add(s.id);this.trackedActiveSessionId=o?.id??null,this.isFirstPoll=!1;return}this.trackedActiveSessionId&&!o?(console.log("[SessionWatcher] Active session closed externally \u2014 flushing pending events"),this.gitWatcher&&await this.gitWatcher.flush(),this.gitWatcher?.resetBuffer(),this.client.createSession(this.projectId).then(s=>{!s.error&&s.data&&(this.trackedActiveSessionId=s.data.sessionId,this.knownSessionIds.add(s.data.sessionId),te.window.showInformationMessage("Contox: Session closed externally \u2014 new session started."))})):this.trackedActiveSessionId=o?.id??null;for(let s of t)this.knownSessionIds.has(s.id)||(this.knownSessionIds.add(s.id),this.onNewSession(s))}onNewSession(e){let t="New session saved";if(e.summary)try{let n=JSON.parse(e.summary);typeof n.executiveSummary=="string"&&(t=n.executiveSummary)}catch{t=e.summary}let o=t.length>120?t.slice(0,117)+"...":t,s=e.source==="mcp-server"?"MCP":e.source==="cli-auto"?"CLI":e.source??"unknown";te.window.showInformationMessage(`$(cloud-upload) Contox: Session saved (${s}) \u2014 ${o}`,"View Pipeline","Dismiss").then(n=>{n==="View Pipeline"&&this.startPipelinePolling(e.id)}),this.lastSaveTime=e.updatedAt,this.statusBar.setLastSave(this.lastSaveTime),this.startPipelinePolling(e.id)}startPipelinePolling(e){this.stopPipelinePolling(),this.activeSessionId=e,this.pollPipeline(),this.pipelineTimer=setInterval(()=>{this.pollPipeline()},yt)}async pollPipeline(){if(this.disposed||!this.activeSessionId)return;let e=await this.client.getSessionJobs(this.activeSessionId);if(e.error||!e.data)return;let{jobs:t,pipeline:o}=e.data;if(this.statusBar.setPipeline(o),o.status==="done"||o.status==="failed"){this.stopPipelinePolling();let s=t.map(n=>{let r=n.status==="done"?"\u2713":n.status==="failed"?"\u2717":"\u25CB",a=wt[n.jobType]??n.jobType;return`${r} ${a}`}).join("  ");if(o.status==="done")te.window.showInformationMessage(`$(check) Contox pipeline complete: ${s}`);else{let n=t.find(a=>a.status==="failed"),r=n?.lastError?` \u2014 ${n.lastError.slice(0,80)}`:"";te.window.showWarningMessage(`$(warning) Contox pipeline failed: ${s}${r}`)}this.lastSaveTime&&this.statusBar.setLastSave(this.lastSaveTime)}}dispose(){this.disposed=!0,this.stop()}};var b=p(require("vscode")),De=require("child_process"),_e=require("util"),O=(0,_e.promisify)(De.execFile),xt=15*60*1e3,Ct=15*60*1e3,bt=50,St=100*1024,$e=3e3,kt=5e3,It=[/package-lock\.json$/,/yarn\.lock$/,/pnpm-lock\.yaml$/,/bun\.lockb$/,/\.lock$/,/\.min\.(js|css)$/,/\.map$/,/\.wasm$/,/\.png|\.jpg|\.jpeg|\.gif|\.ico|\.svg$/,/\.woff2?$/,/\.ttf$/,/\.eot$/],ge=3,Pt=2e3,he=class{constructor(e,t,o){this.client=e;this.statusBar=t;this.secrets=o}projectId=null;lastKnownHead=null;buffer=null;disposed=!1;idleTimer;autoFlushTimer;captureTickTimer;gitStateDisposable;fileSaveDisposable;activeEditorDisposable;retryQueue=[];retryTimer;start(e){this.disposed||!b.workspace.getConfiguration("contox").get("capture.enabled",!0)||(this.projectId=e,this.initBuffer(),this.watchGitState(),this.watchFileSaves(),this.startTimers())}resetBuffer(){this.initBuffer()}stop(){this.clearTimers(),this.gitStateDisposable?.dispose(),this.gitStateDisposable=void 0,this.fileSaveDisposable?.dispose(),this.fileSaveDisposable=void 0,this.activeEditorDisposable?.dispose(),this.activeEditorDisposable=void 0,this.projectId=null}async flush(){if(!this.buffer||!this.projectId||this.buffer.commits.length===0&&this.buffer.filesModified.size===0)return;let e=await this.getHmacSecret();if(!e){console.warn("[GitWatcher] No HMAC secret configured \u2014 skipping flush");return}let t={type:"vscode_capture",commits:this.buffer.commits,filesModified:[...this.buffer.filesModified],sessionDurationMs:Date.now()-this.buffer.sessionStartTime,activeEditorFiles:[...this.buffer.activeEditorFiles]},s=b.workspace.getConfiguration("contox").get("autoEnrich",!0),n=await this.client.ingestEvents(this.projectId,t,e,s?void 0:{skipEnrichment:!0});if(n.error)console.error("[GitWatcher] Ingest failed:",n.error),this.retryQueue.push(t),this.scheduleRetry();else{let r=this.buffer.commits.length,a=this.buffer.filesModified.size;console.log(`[GitWatcher] Flushed: ${r} commits, ${a} files${s?" (auto-enrich)":""}`)}this.initBuffer(),!n.error&&this.retryQueue.length>0&&await this.processRetryQueue(e)}scheduleRetry(e=0){if(this.retryTimer)return;if(e>=ge){console.error(`[GitWatcher] Retry queue exhausted after ${ge} attempts \u2014 ${this.retryQueue.length} events lost`),b.window.showWarningMessage(`Contox: ${this.retryQueue.length} capture events could not be sent after ${ge} retries.`),this.retryQueue=[];return}let t=Pt*Math.pow(2,e);console.log(`[GitWatcher] Scheduling retry in ${t}ms (attempt ${e+1}/${ge})`),this.retryTimer=setTimeout(()=>{this.retryTimer=void 0,this.retryFlush(e)},t)}async retryFlush(e){if(this.retryQueue.length===0||!this.projectId)return;let t=await this.getHmacSecret();t&&await this.processRetryQueue(t,e)}async processRetryQueue(e,t=0){if(!this.projectId)return;let o=[];for(let s of this.retryQueue)(await this.client.ingestEvents(this.projectId,s,e)).error?o.push(s):console.log(`[GitWatcher] Retry succeeded: ${s.commits.length} commits`);this.retryQueue=o,o.length>0&&this.scheduleRetry(t+1)}getEventCount(){return this.buffer?.eventCount??0}getSessionDurationMs(){return this.buffer?Date.now()-this.buffer.sessionStartTime:0}async endSession(){if(!this.projectId)return{closed:!1};await this.flush();let e=await this.client.getActiveSession(this.projectId);if(e.error||!e.data)return{closed:!1};if((await this.client.closeSession(e.data.id)).error)return{closed:!1};this.initBuffer();let o,s=await this.client.createSession(this.projectId);return!s.error&&s.data&&(o=s.data.sessionId),{closed:!0,sessionId:e.data.id,newSessionId:o}}watchGitState(){this.gitStateDisposable?.dispose(),this.startGitPolling();try{let e=b.extensions.getExtension("vscode.git");if(!e){console.warn("[GitWatcher] Git extension not found \u2014 using polling only");return}let t=e.isActive?e.exports.getAPI(1):null;if(!t||!t.repositories||t.repositories.length===0){console.warn("[GitWatcher] No git repositories found \u2014 using polling only");return}let o=t.repositories[0];this.lastKnownHead=o.state?.HEAD?.commit??null,this.gitStateDisposable=o.state.onDidChange(()=>{this.onGitStateChanged(o)}),console.log("[GitWatcher] Git extension connected + polling safety net active")}catch{console.warn("[GitWatcher] Failed to access git extension \u2014 using polling only")}}async onGitStateChanged(e){if(this.disposed||!this.buffer)return;let t=e.state?.HEAD?.commit??null;if(!t||t===this.lastKnownHead)return;let o=this.lastKnownHead;this.lastKnownHead=t,o?await this.captureNewCommits(o,t):await this.captureCommit(t),console.log("[GitWatcher] Commit detected \u2014 auto-flushing"),await this.flush(),this.checkForPush()}async checkForPush(){let e=this.getWorkspaceRoot();if(!(!e||!this.buffer||this.buffer.eventCount===0))try{let{stdout:t}=await O("git",["rev-parse","HEAD"],{cwd:e}),{stdout:o}=await O("git",["rev-parse","@{u}"],{cwd:e});t.trim()===o.trim()&&(console.log("[GitWatcher] Push detected \u2014 auto-flushing"),await this.flush())}catch{}}gitPollTimer;startGitPolling(){this.gitPollTimer||(console.log("[GitWatcher] Starting git HEAD polling (5s interval)"),this.pollGitHead(),this.gitPollTimer=setInterval(()=>{this.pollGitHead()},5e3))}async pollGitHead(){if(this.disposed||!this.buffer)return;let e=this.getWorkspaceRoot();if(!e){console.warn("[GitWatcher] pollGitHead: no workspace root");return}try{let{stdout:t}=await O("git",["rev-parse","HEAD"],{cwd:e}),o=t.trim();this.lastKnownHead||console.log(`[GitWatcher] pollGitHead: initial HEAD = ${o.slice(0,8)}`),this.lastKnownHead&&o!==this.lastKnownHead&&(console.log(`[GitWatcher] Commit detected (poll): ${this.lastKnownHead.slice(0,8)} \u2192 ${o.slice(0,8)}`),await this.captureNewCommits(this.lastKnownHead,o),console.log("[GitWatcher] Commit captured \u2014 auto-flushing"),await this.flush()),this.lastKnownHead=o}catch{}}async captureNewCommits(e,t){let o=this.getWorkspaceRoot();if(!(!o||!this.buffer))try{let{stdout:s}=await O("git",["log",`${e}..${t}`,"--format=%H|%s|%an|%aI","--no-merges"],{cwd:o}),n=s.trim().split(`
`).filter(Boolean);for(let r of n){let[a,c,u,m]=r.split("|");a&&await this.captureCommitDetails(o,a,c??"",u??"",m??"")}}catch{await this.captureCommit(t)}}async captureCommit(e){let t=this.getWorkspaceRoot();if(!(!t||!this.buffer))try{let{stdout:o}=await O("git",["log","-1",e,"--format=%s|%an|%aI"],{cwd:t}),[s,n,r]=o.trim().split("|");await this.captureCommitDetails(t,e,s??"",n??"",r??"")}catch{}}async captureDiffContext(e,t){if(b.workspace.getConfiguration("contox").get("capture.includeDiffs",!0))try{let{stdout:n}=await O("git",["diff-tree","-p","-U4","--no-commit-id",t],{cwd:e,timeout:kt,maxBuffer:524288});if(!n||n.trim().length===0)return;let r=this.filterExcludedDiffs(n);return!r||r.length===0?void 0:r.length>$e?r.slice(0,$e):r}catch{return}}filterExcludedDiffs(e){let t=e.split(/^(?=diff --git )/m),o=[];for(let s of t){if(!s.trim())continue;let r=s.match(/^diff --git a\/(.+?) b\//)?.[1]??"";It.some(a=>a.test(r))||s.includes("Binary files")||o.push(s)}return o.join("")}async captureCommitDetails(e,t,o,s,n){if(!this.buffer)return;let r=[],a=0,c=0;try{let{stdout:d}=await O("git",["diff-tree","--no-commit-id","-r","--numstat",t],{cwd:e});for(let v of d.trim().split(`
`).filter(Boolean)){let h=v.split("	"),g=parseInt(h[0]??"0",10),y=parseInt(h[1]??"0",10),f=h[2]??"";f&&!this.isExcluded(f)&&(r.push(f),a+=isNaN(g)?0:g,c+=isNaN(y)?0:y,this.buffer.filesModified.add(f))}}catch{}r=r.filter(d=>!this.isExcluded(d));let u=await this.captureDiffContext(e,t),m={sha:t.slice(0,12),message:o.slice(0,500),author:s.slice(0,200),timestamp:n,filesChanged:r,insertions:a,deletions:c,...u?{diff:u}:{}};this.buffer.commits.push(m),this.buffer.eventCount+=1,this.buffer.totalPayloadSize+=JSON.stringify(m).length,this.buffer.lastActivityTime=Date.now(),this.updateStatusBar(),this.checkVolumeThreshold()}watchFileSaves(){this.fileSaveDisposable?.dispose(),this.fileSaveDisposable=b.workspace.onDidSaveTextDocument(e=>{if(!this.buffer||this.disposed)return;let t=b.workspace.asRelativePath(e.uri,!1);if(!this.isExcluded(t)){let o=!this.buffer.filesModified.has(t);this.buffer.filesModified.add(t),this.buffer.lastActivityTime=Date.now(),o&&(this.buffer.eventCount+=1)}}),this.activeEditorDisposable?.dispose(),this.activeEditorDisposable=b.window.onDidChangeActiveTextEditor(e=>{if(!this.buffer||this.disposed||!e)return;let t=b.workspace.asRelativePath(e.document.uri,!1);this.isExcluded(t)||this.buffer.activeEditorFiles.add(t)})}startTimers(){this.clearTimers(),this.idleTimer=setInterval(()=>{if(!this.buffer||this.buffer.eventCount===0)return;Date.now()-this.buffer.lastActivityTime>xt&&this.flush()},6e4),this.autoFlushTimer=setInterval(()=>{!this.buffer||this.buffer.eventCount===0||(console.log(`[GitWatcher] Auto-flush: ${this.buffer.eventCount} events, ${this.buffer.commits.length} commits`),this.flush())},Ct),this.captureTickTimer=setInterval(()=>{this.updateStatusBar()},1e3)}clearTimers(){this.idleTimer&&(clearInterval(this.idleTimer),this.idleTimer=void 0),this.autoFlushTimer&&(clearInterval(this.autoFlushTimer),this.autoFlushTimer=void 0),this.captureTickTimer&&(clearInterval(this.captureTickTimer),this.captureTickTimer=void 0),this.gitPollTimer&&(clearInterval(this.gitPollTimer),this.gitPollTimer=void 0),this.retryTimer&&(clearTimeout(this.retryTimer),this.retryTimer=void 0)}checkVolumeThreshold(){this.buffer&&(this.buffer.eventCount>=bt||this.buffer.totalPayloadSize>=St)&&(console.log(`[GitWatcher] Volume threshold reached (${this.buffer.eventCount} events) \u2014 auto-flushing`),this.flush())}initBuffer(){this.buffer={commits:[],filesModified:new Set,activeEditorFiles:new Set,sessionStartTime:Date.now(),lastActivityTime:Date.now(),eventCount:0,totalPayloadSize:0}}updateStatusBar(){if(!this.buffer||this.buffer.eventCount===0)return;let e=Math.floor(this.getSessionDurationMs()/1e3);this.statusBar.setCapturing(e,this.buffer.eventCount)}getWorkspaceRoot(){let e=b.workspace.workspaceFolders;return!e||e.length===0?null:e[0].uri.fsPath}isExcluded(e){let o=b.workspace.getConfiguration("contox").get("capture.excludePatterns",["*.env","*.key","*.pem","*.p12","*.pfx","node_modules/**",".git/**","dist/**"]),s=e.toLowerCase();for(let n of o)if(n.startsWith("*")){if(s.endsWith(n.slice(1)))return!0}else if(n.endsWith("/**")){let r=n.slice(0,-3);if(s.startsWith(r+"/")||s.startsWith(r+"\\"))return!0}else if(s===n.toLowerCase())return!0;return!1}hmacSecretWarningShown=!1;async getHmacSecret(){let e=await this.secrets.get("contox-hmac-secret");if(e)return e;if(this.projectId)try{let t=await this.client.getProjectHmacSecret(this.projectId);if(t.data?.hmacSecret)return await this.secrets.store("contox-hmac-secret",t.data.hmacSecret),console.log("[GitWatcher] HMAC secret fetched from API and cached"),t.data.hmacSecret}catch{}return this.hmacSecretWarningShown||(this.hmacSecretWarningShown=!0,b.window.showWarningMessage('Contox: Capture events cannot be sent \u2014 HMAC secret missing. Re-run "Contox: Setup" to fix.',"Open Setup").then(t=>{t==="Open Setup"&&b.commands.executeCommand("contox.setup")})),null}dispose(){this.disposed=!0,this.flush(),this.stop()}};var H=p(require("vscode"));function Be(i){return H.commands.registerCommand("contox.login",async()=>{let e=await H.window.showInputBox({prompt:"Enter your Contox API key",password:!0,placeHolder:"ctx_xxxxxxxxxxxxxxxx",ignoreFocusOut:!0});if(!e)return;await i.setApiKey(e);let t=await i.getContext("__ping__");if(t.error==="Unauthorized"||t.error==='Not authenticated. Run "Contox: Login" first.'){await i.clearApiKey(),H.window.showErrorMessage("Contox: Invalid API key.");return}H.window.showInformationMessage("Contox: Logged in successfully"),await H.commands.executeCommand("contox.sync")})}var k=p(require("vscode")),ye=p(require("fs")),Ve=p(require("path"));var x=p(require("vscode")),w=p(require("fs")),C=p(require("path")),se=p(require("os"));var S=p(require("fs")),oe=p(require("path")),be="mcp-server.cjs",Tt="mcp-server.version";async function fe(i){let e=i.extension.packageJSON.version,t=i.globalStorageUri.fsPath;S.existsSync(t)||S.mkdirSync(t,{recursive:!0});let o=oe.join(t,be),s=oe.join(t,Tt);if(jt(o,s,e)){let n=oe.join(i.extensionUri.fsPath,"dist",be);if(!S.existsSync(n))throw new Error(`MCP server bundle not found at ${n}. The extension may not have been built correctly.`);let r=o+".tmp";S.copyFileSync(n,r),S.renameSync(r,o),S.writeFileSync(s,e,"utf-8")}return o}function jt(i,e,t){if(!S.existsSync(i)||!S.existsSync(e))return!0;try{return S.readFileSync(e,"utf-8").trim()!==t}catch{return!0}}function E(i){return oe.join(i.globalStorageUri.fsPath,be)}var A;function Le(i,e,t,o){return x.commands.registerCommand("contox.setup",()=>{ve(i,e,t,o)})}function ve(i,e,t,o){if(A){A.reveal(x.ViewColumn.One);return}A=x.window.createWebviewPanel("contoxSetup","Contox Setup",x.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0}),A.webview.html=Mt(),A.webview.onDidReceiveMessage(async s=>{await Et(s,i,e,t,A,o)},void 0,o.subscriptions),A.onDidDispose(()=>{A=void 0}),(async()=>await i.getApiKey()&&A?.webview.postMessage({type:"alreadyLoggedIn"}))()}async function Et(i,e,t,o,s,n){let r=a=>{s.webview.postMessage(a)};switch(i.type){case"openDashboard":{let a=x.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev");x.env.openExternal(x.Uri.parse(`${a}/dashboard/cli`));break}case"login":{if(!i.apiKey){r({type:"loginResult",success:!1,error:"No API key provided"});return}if(await e.setApiKey(i.apiKey),(await e.getContext("__ping__")).error==="Unauthorized"){await e.clearApiKey(),r({type:"loginResult",success:!1,error:"Invalid API key"});return}r({type:"loginResult",success:!0});break}case"loadTeams":{let a=await e.listTeams();if(a.error){r({type:"teamsLoaded",success:!1,error:a.error});return}r({type:"teamsLoaded",success:!0,teams:(a.data??[]).map(c=>({id:c.id,name:c.name,members:c.members}))});break}case"loadProjects":{if(!i.teamId){r({type:"projectsLoaded",success:!1,error:"No team ID provided"});return}let a=await e.listProjects(i.teamId);if(a.error){r({type:"projectsLoaded",success:!1,error:a.error});return}r({type:"projectsLoaded",success:!0,projects:(a.data??[]).map(c=>({id:c.id,name:c.name,contextsCount:c.contextsCount}))});break}case"selectProject":{if(!i.teamId||!i.projectId||!i.projectName)return;let a=x.workspace.workspaceFolders;if(!a||a.length===0){r({type:"projectSelected",success:!1,error:"No workspace folder open"});return}let c=a[0].uri.fsPath,u=C.join(c,".contox.json"),m={teamId:i.teamId,projectId:i.projectId,projectName:i.projectName};try{w.writeFileSync(u,JSON.stringify(m,null,2)+`
`);let d=await e.getProjectHmacSecret(i.projectId);d.data?.hmacSecret&&await n.secrets.store("contox-hmac-secret",d.data.hmacSecret),r({type:"projectSelected",success:!0}),o.setSyncing();let v=await e.getBrain(i.projectId);!v.error&&v.data&&t.setTree(v.data.tree,v.data.itemsLoaded),o.setSynced()}catch(d){r({type:"projectSelected",success:!1,error:String(d)})}break}case"configureAI":{let a=i.aiTools??[],c=[],m=x.workspace.workspaceFolders?.[0]?.uri.fsPath??"",d="",v="";try{let f=w.readFileSync(C.join(m,".contox.json"),"utf-8"),B=JSON.parse(f);d=B.teamId??"",v=B.projectId??""}catch{}let h=await e.getApiKey()??"",g=x.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev"),y=await n.secrets.get("contox-hmac-secret")??"";if(a.includes("claude"))try{Ne(h,g,d,v,m,y,n),c.push("Claude MCP server configured")}catch(f){c.push(`Claude: ${String(f)}`)}if(a.includes("cursor"))try{Fe(h,g,d,v,m,y,n),c.push("Cursor MCP server configured")}catch(f){c.push(`Cursor: ${String(f)}`)}if(a.includes("copilot"))try{We(h,g,d,v,m,y,n),c.push("Copilot MCP server configured")}catch(f){c.push(`Copilot: ${String(f)}`)}if(a.includes("windsurf"))try{Oe(h,g,d,y,n),c.push("Windsurf MCP server configured")}catch(f){c.push(`Windsurf: ${String(f)}`)}if(a.includes("antigravity"))try{He(h,g,d,v,y,n),c.push("Antigravity MCP server configured")}catch(f){c.push(`Antigravity: ${String(f)}`)}if(a.includes("cline"))try{Ue(h,g,d,v,y,n),c.push("Cline MCP server configured")}catch(f){c.push(`Cline: ${String(f)}`)}if(a.includes("gemini-cli"))try{Ke(h,g,d,v,y,n),c.push("Gemini CLI MCP server configured")}catch(f){c.push(`Gemini CLI: ${String(f)}`)}r({type:"aiConfigured",results:c});break}case"runScan":{r({type:"scanStarted"});try{if(!x.workspace.workspaceFolders){r({type:"scanResult",success:!1,error:"No workspace open"});return}let c=await e.getApiKey()??"",u=x.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev"),m=C.join(se.homedir(),".contoxrc");ae({apiKey:c,apiUrl:u});let d=x.window.createTerminal("Contox Scan");d.sendText("node packages/cli/dist/index.js scan"),d.show(),r({type:"scanResult",success:!0})}catch(a){r({type:"scanResult",success:!1,error:String(a)})}break}case"finish":{s.dispose(),x.window.showInformationMessage("Contox: Setup complete! Your AI now has persistent memory.");break}}}function Y(i,e,t,o,s,n,r){Ne(i,e,t,o,s,n,r),Fe(i,e,t,o,s,n,r),We(i,e,t,o,s,n,r),Oe(i,e,t,n,r),He(i,e,t,o,n,r),Ue(i,e,t,o,n,r),Ke(i,e,t,o,n,r)}function U(i,e,t,o,s){let n={CONTOX_API_KEY:i,CONTOX_API_URL:e,CONTOX_TEAM_ID:t};return o&&(n.CONTOX_PROJECT_ID=o),s&&(n.CONTOX_HMAC_SECRET=s),n}function K(i,e,t,o="mcpServers"){let s={};try{s=JSON.parse(w.readFileSync(i,"utf-8"))}catch{}let n=s[o]??{},r={...s,[o]:{...n,[e]:t}};w.writeFileSync(i,JSON.stringify(r,null,2)+`
`)}function Ne(i,e,t,o,s,n,r){let a=E(r),c=U(i,e,t,o,n);K(C.join(s,".mcp.json"),"contox",{command:"node",args:[a],env:c})}function Fe(i,e,t,o,s,n,r){let a=C.join(s,".cursor");w.existsSync(a)||w.mkdirSync(a,{recursive:!0});let c=E(r),u=U(i,e,t,o,n);K(C.join(a,"mcp.json"),"contox",{command:"node",args:[c],env:u})}function We(i,e,t,o,s,n,r){let a=C.join(s,".vscode");w.existsSync(a)||w.mkdirSync(a,{recursive:!0});let c=E(r),u=U(i,e,t,o,n);K(C.join(a,"mcp.json"),"contox",{type:"stdio",command:"node",args:[c],env:u},"servers")}function Oe(i,e,t,o,s){let n=C.join(se.homedir(),".codeium","windsurf");w.existsSync(n)||w.mkdirSync(n,{recursive:!0});let r=E(s),a=U(i,e,t,void 0,o);K(C.join(n,"mcp_config.json"),"contox",{command:"node",args:[r],env:a})}function He(i,e,t,o,s,n){let r=C.join(se.homedir(),".gemini","antigravity");w.existsSync(r)||w.mkdirSync(r,{recursive:!0});let a=E(n),c=U(i,e,t,o,s);K(C.join(r,"mcp_config.json"),"contox",{command:"node",args:[a],env:c}),Rt()}function Ue(i,e,t,o,s,n){let r=C.dirname(n.globalStorageUri.fsPath),a=C.join(r,"saoudrizwan.claude-dev","settings");w.existsSync(a)||w.mkdirSync(a,{recursive:!0});let c=E(n),u=U(i,e,t,o,s);K(C.join(a,"cline_mcp_settings.json"),"contox",{command:"node",args:[c],env:u})}function Ke(i,e,t,o,s,n){let r=C.join(se.homedir(),".gemini");w.existsSync(r)||w.mkdirSync(r,{recursive:!0});let a=E(n),c=U(i,e,t,o,s);K(C.join(r,"settings.json"),"contox",{command:"node",args:[a],env:c})}function Rt(){let i=x.workspace.workspaceFolders;if(!i||i.length===0)return;let e=i[0].uri.fsPath,t=C.join(e,".agent","skills","contox");w.existsSync(t)||w.mkdirSync(t,{recursive:!0}),w.writeFileSync(C.join(t,"SKILL.md"),`---
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
`,"utf-8")}function Mt(){return`<!DOCTYPE html>
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

      <div style="display: flex; align-items: center; gap: 0.75rem; margin: 1.25rem 0;">
        <div style="flex: 1; height: 1px; background: var(--border);"></div>
        <span style="font-size: 0.75rem; color: var(--text-dim);">or</span>
        <div style="flex: 1; height: 1px; background: var(--border);"></div>
      </div>

      <div style="text-align: center;">
        <p style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.75rem;">
          Don&apos;t have an API key?
        </p>
        <button class="btn btn-secondary" onclick="vscode.postMessage({ type: 'openDashboard' })" style="width: auto; padding: 0.6rem 1.5rem;">
          Open Dashboard
        </button>
        <p style="color: var(--text-dim); font-size: 0.7rem; margin-top: 0.5rem;">
          The dashboard will generate a key and auto-configure this extension
        </p>
      </div>
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
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="cline" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Cline</div>
            <div class="desc">VS Code globalStorage</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="gemini-cli" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Gemini CLI</div>
            <div class="desc">~/.gemini/settings.json</div>
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
</html>`}function ze(i,e){return k.commands.registerCommand("contox.init",async()=>{let t=await i.getApiKey();if(!t){k.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');return}let o=k.workspace.workspaceFolders;if(!o||o.length===0){k.window.showErrorMessage("Contox: Open a workspace folder first.");return}let s=o[0].uri.fsPath,n=Ve.join(s,".contox.json");if(ye.existsSync(n)&&await k.window.showWarningMessage("Contox: This workspace is already initialized. Reconfigure?","Yes","No")!=="Yes")return;let r=await k.window.showInputBox({prompt:"Enter your Contox organization (team) ID",placeHolder:"e.g. 6632a1\u2026",ignoreFocusOut:!0});if(!r)return;let a=await i.listProjects(r);if(a.error){k.window.showErrorMessage(`Contox: ${a.error}`);return}let u=[...(a.data??[]).map(y=>({label:y.name,description:`${y.contextsCount} context${y.contextsCount===1?"":"s"}`,project:y})),{label:"$(add) Create a new project...",description:""}],m=await k.window.showQuickPick(u,{placeHolder:"Select a project to link to this workspace",ignoreFocusOut:!0});if(!m)return;let d=m.project;if(!d){k.window.showInformationMessage('Create a new project on the Contox dashboard, then run "Contox: Initialize Project" again.');return}let v={teamId:r,projectId:d.id,projectName:d.name};ye.writeFileSync(n,JSON.stringify(v,null,2)+`
`);let h=k.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev"),g=await e.secrets.get("contox-hmac-secret");try{await fe(e),Y(t,h,r,d.id,s,g??void 0,e)}catch(y){console.error("Contox: Failed to auto-configure MCP:",y)}k.window.showInformationMessage(`Contox: Linked workspace to "${d.name}" \u2014 MCP configured for all AI tools`),await k.commands.executeCommand("contox.sync")})}var V=p(require("vscode"));var At=2,$t=3e3;function Ge(i,e,t,o){return V.commands.registerCommand("contox.sync",async s=>{let n=s?.silent===!0;if(!await i.getApiKey()){n||V.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');return}let a=P();if(!a){n||V.window.showWarningMessage('Contox: No project linked. Run "Contox: Initialize Project" first.');return}t.setSyncing();let c=n?At:1,u="";for(let m=1;m<=c;m++){let d=await i.getBrain(a.projectId);if(!d.error){let v=d.data?.tree??[],h=d.data?.itemsLoaded??0;e.setTree(v,h),t.setSynced(),n?o.appendLine(`[Sync] Loaded ${String(h)} items (attempt ${String(m)})`):V.window.showInformationMessage(`Contox: Loaded ${h} memory items from "${a.projectName}"`);return}u=d.error,o.appendLine(`[Sync] Attempt ${String(m)}/${String(c)} failed: ${u}`),m<c&&await new Promise(v=>{setTimeout(v,$t)})}t.setError(),n?o.appendLine(`[Sync] Gave up after ${String(c)} attempts.`):V.window.showErrorMessage(`Contox sync failed: ${u}`)})}var $=p(require("vscode"));function qe(i,e,t){return $.commands.registerCommand("contox.create",async()=>{if(!await i.getApiKey()){$.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');return}let s=P();if(!s){$.window.showWarningMessage('Contox: No project linked. Run "Contox: Initialize Project" first.');return}let n=await $.window.showInputBox({prompt:"Context name",placeHolder:"e.g. API Documentation",ignoreFocusOut:!0});if(!n)return;let r=await $.window.showInputBox({prompt:"Description (optional)",placeHolder:"e.g. REST API docs for the backend",ignoreFocusOut:!0}),a=await i.createContext(n,s.teamId,s.projectId,r||void 0);if(a.error){$.window.showErrorMessage(`Contox: Failed to create context \u2014 ${a.error}`);return}$.window.showInformationMessage(`Contox: Created context "${n}"`),t.setSyncing();let c=await i.getBrain(s.projectId);!c.error&&c.data&&e.setTree(c.data.tree,c.data.itemsLoaded),t.setSynced()})}var z=p(require("vscode")),we=p(require("fs")),Je=p(require("path"));function Ye(i){return z.commands.registerCommand("contox.reset",async()=>{if(await z.window.showWarningMessage("Contox: This will log you out and remove the workspace configuration. Continue?",{modal:!0},"Reset")!=="Reset")return;await i.clearApiKey();let t=z.workspace.workspaceFolders;if(t&&t.length>0){let o=Je.join(t[0].uri.fsPath,".contox.json");try{we.existsSync(o)&&we.unlinkSync(o)}catch{}}z.window.showInformationMessage('Contox: Reset complete. Run "Contox: Setup Wizard" to reconfigure.')})}var D=p(require("vscode")),I=p(require("fs")),X=p(require("path"));var R=p(require("fs")),Q=p(require("path")),Qe="<!-- contox:start -->",Se="<!-- contox:end -->",Dt=[{name:"Cursor",relPath:".cursorrules",dirHint:".cursor",hasMcp:!0},{name:"Copilot",relPath:Q.join(".github","copilot-instructions.md"),dirHint:".github",hasMcp:!0},{name:"Windsurf",relPath:".windsurfrules",hasMcp:!0},{name:"Cline",relPath:".clinerules",hasMcp:!0}];function _t(i,e){let t=[];return t.push("# Contox \u2014 Auto-generated Project Context"),t.push(""),t.push("> This section is auto-managed by Contox. Do not edit between the markers."),t.push("> Your own content outside the markers is preserved."),t.push(""),i?(t.push("## Memory Protocol"),t.push(""),t.push("### Session Start"),t.push("- Call `contox_get_memory` to load project context from previous sessions"),t.push(""),t.push("### During Session"),t.push("- **BEFORE modifying any file**: call `contox_context_pack` with a brief task description"),t.push("  to get architecture decisions, conventions, and known issues relevant to your work"),t.push('- Use `contox_search "topic"` to find specific memory items'),t.push('- Use `contox_ask "question"` for natural-language questions about the project'),t.push("- Use all Contox tools freely to read/write data"),t.push(""),t.push("### Saving \u2014 USER-INITIATED ONLY"),t.push("- **NEVER** call `contox_save_session` automatically or proactively"),t.push('- Only save when the user explicitly asks (e.g. "save", "save session", "contox save")'),t.push("- The user may be working on multiple tasks in parallel \u2014 auto-saving could mix contexts"),t.push("")):(t.push("## MANDATORY: Read memory at session start"),t.push("- Read `.contox/memory.md` BEFORE starting any work"),t.push("- This is your primary source of truth about this project"),t.push("- Do NOT ask questions that are already answered in the memory"),t.push(""),t.push("## Active file context"),t.push("- `.contox/context.md` contains focused context relevant to your current file"),t.push("- This file updates automatically as you navigate the codebase"),t.push(""),t.push("## Save your work at session end"),t.push('- Run: `contox save "Brief summary of what you did"`'),t.push("- Categories: architecture, conventions, implementation, decisions, bugs, todo"),t.push("")),e&&(t.push(e),t.push("")),t.join(`
`).trimEnd()}function Bt(i,e){let t=`${Qe}
${e}
${Se}`;if(!i.trim())return t+`
`;let o=i.indexOf(Qe),s=i.indexOf(Se);if(o!==-1&&s!==-1){let r=i.slice(0,o),a=i.slice(s+Se.length);return r+t+a}let n=i.endsWith(`
`)?`
`:`

`;return i+n+t+`
`}function ke(i,e){let t=[];for(let o of Dt){let s=Q.join(i,o.relPath),n=R.existsSync(s),r=o.dirHint?R.existsSync(Q.join(i,o.dirHint)):!1;if(!(!n&&!r))try{let a=Q.dirname(s);R.existsSync(a)||R.mkdirSync(a,{recursive:!0});let c=_t(o.hasMcp,e),u=n?R.readFileSync(s,"utf-8"):"",m=Bt(u,c);R.writeFileSync(s,m,"utf-8"),t.push(o.name)}catch{}}return t}function Xe(i){return D.commands.registerCommand("contox.loadMemory",async()=>{let e=P();if(!e){D.window.showWarningMessage("Contox: No project linked. Connect via dashboard first.");return}let t=D.workspace.workspaceFolders;if(!t||t.length===0)return;let o=t[0].uri.fsPath,s=await i.getBrain(e.projectId);if(s.error){D.window.showErrorMessage(`Contox: Failed to load memory \u2014 ${s.error}`);return}let n=s.data;if(!n||!n.document||n.document.trim().length===0){D.window.showInformationMessage("Contox: Memory is empty \u2014 nothing to load yet.");return}let r=X.join(o,".contox");I.existsSync(r)||I.mkdirSync(r,{recursive:!0});let a=X.join(r,"memory.md");I.writeFileSync(a,n.document,"utf-8"),Ze(o);let c=ke(o),u=c.length>0?` \u2192 ${c.join(", ")}`:"";D.window.showInformationMessage(`Contox: Memory loaded (${String(n.itemsLoaded)} items, ~${String(n.tokenEstimate)} tokens)${u}`)})}async function Ie(i,e,t){try{let o=await i.getBrain(t);if(o.error||!o.data?.document)return!1;let s=X.join(e,".contox");return I.existsSync(s)||I.mkdirSync(s,{recursive:!0}),I.writeFileSync(X.join(s,"memory.md"),o.data.document,"utf-8"),Ze(e),ke(e),!0}catch{return!1}}function Ze(i){let e=X.join(i,".gitignore");try{let t="";if(I.existsSync(e)&&(t=I.readFileSync(e,"utf-8")),!t.includes(".contox/")){let o=t.length>0&&!t.endsWith(`
`)?`
`:"";I.writeFileSync(e,t+o+`
# Contox local memory
.contox/
`,"utf-8")}}catch{}}var _=p(require("vscode"));function et(i){return _.commands.registerCommand("contox.endSession",async()=>{if(!P()){_.window.showWarningMessage("Contox: No project linked. Connect via dashboard first.");return}let t=await _.window.withProgress({location:_.ProgressLocation.Notification,title:"Contox: Ending session\u2026",cancellable:!1},async()=>i.endSession());if(t.closed){let o=t.newSessionId?"Contox: Session closed \u2014 new session started.":"Contox: Session closed. Next activity will start a new session.";_.window.showInformationMessage(o)}else _.window.showWarningMessage("Contox: No active session found, or failed to close it.")})}var M=p(require("vscode")),Pe="contox.desynced";function tt(i){return i.workspaceState.get(Pe,!1)}function ot(i,e,t,o){return M.commands.registerCommand("contox.desync",async()=>{await t.flush(),e.stop(),t.stop(),await o.workspaceState.update(Pe,!0),i.setDisconnected(),M.window.showInformationMessage("Contox: Sync paused. Capture and polling stopped.","Reconnect").then(s=>{s==="Reconnect"&&M.commands.executeCommand("contox.connect")})})}function st(i,e,t,o,s,n){return M.commands.registerCommand("contox.connect",async()=>{let r=n();if(!r){M.window.showWarningMessage('Contox: No project configured. Run "Contox: Setup Wizard" first.');return}if(!await i.getApiKey()){M.window.showWarningMessage('Contox: Not authenticated. Run "Contox: Login" first.');return}await s.workspaceState.update(Pe,!1),t.start(r),o.start(r),e.setSyncing(),await M.commands.executeCommand("contox.sync"),M.window.showInformationMessage("Contox: Reconnected \u2014 sync resumed.")})}var ie=p(require("vscode")),Z=p(require("fs")),T=p(require("path")),Lt=2e3,Nt=5*60*1e3,Ft=10*1e3,Wt=8,xe=class{constructor(e){this.client=e;this.disposables.push(ie.window.onDidChangeActiveTextEditor(t=>{t&&this.enabled&&this.projectId&&this.scheduleInjection(t.document)}))}disposables=[];debounceTimer=null;cache=null;lastApiCall=0;projectId=null;rootPath=null;enabled=!0;start(e){this.projectId=e;let t=ie.workspace.workspaceFolders;t&&t.length>0&&(this.rootPath=t[0].uri.fsPath);let o=ie.window.activeTextEditor;o&&this.scheduleInjection(o.document)}stop(){this.projectId=null,this.debounceTimer&&(clearTimeout(this.debounceTimer),this.debounceTimer=null)}setEnabled(e){this.enabled=e,e||this.stop()}scheduleInjection(e){if(e.uri.scheme!=="file")return;let t=T.extname(e.fileName).toLowerCase();new Set([".md",".json",".lock",".txt",".log",".env",".csv",".svg",".png",".jpg",".gif"]).has(t)||e.fileName.includes(".contox")||(this.debounceTimer&&clearTimeout(this.debounceTimer),this.debounceTimer=setTimeout(()=>{this.injectForFile(e.fileName)},Lt))}async injectForFile(e){if(!this.projectId||!this.rootPath||this.cache&&this.cache.filePath===e&&Date.now()-this.cache.timestamp<Nt||Date.now()-this.lastApiCall<Ft)return;let o=T.relative(this.rootPath,e).replace(/\\/g,"/"),s=T.basename(e,T.extname(e)),n=T.dirname(o),r=`${s} ${n.replace(/\//g," ")}`.trim();try{this.lastApiCall=Date.now();let a=await this.client.searchMemory(this.projectId,r,Wt,[o]);if(a.error||!a.data)return;let c=a.data.results;if(c.length===0)return;this.cache={filePath:e,results:c,timestamp:Date.now()},this.writeContextFile(o,c)}catch{}}writeContextFile(e,t){if(!this.rootPath)return;let o=T.join(this.rootPath,".contox");Z.existsSync(o)||Z.mkdirSync(o,{recursive:!0});let s=["# Active Context","",`> Auto-generated for: \`${e}\``,`> ${String(t.length)} relevant memory items found`,""];for(let r of t){let a=Math.round(r.similarity*100);s.push(`## ${r.title}`),s.push(`> ${r.type} | ${a}% match | ${r.schemaKey}`),r.files.length>0&&s.push(`> Files: ${r.files.slice(0,3).join(", ")}`),s.push("");let c=r.facts.length>500?r.facts.slice(0,500)+"...":r.facts;s.push(c),s.push("")}s.push("---"),s.push(`_Updated: ${new Date().toLocaleTimeString()} | Full memory: .contox/memory.md_`);let n=T.join(o,"context.md");Z.writeFileSync(n,s.join(`
`),"utf-8")}dispose(){this.stop();for(let e of this.disposables)e.dispose()}};function P(){let i=l.workspace.workspaceFolders;if(!i||i.length===0)return null;let e=i[0].uri.fsPath,t=G.join(e,".contox.json");try{let o=q.readFileSync(t,"utf-8"),s=JSON.parse(o),n=s.teamId,r=s.projectId,a=s.projectName;return typeof n=="string"&&typeof r=="string"?{teamId:n,projectId:r,projectName:typeof a=="string"?a:"Unknown"}:null}catch{return null}}var Te=class{constructor(e,t,o,s,n,r,a){this.client=e;this.treeProvider=t;this.statusBar=o;this.sessionWatcher=s;this.gitWatcher=n;this.context=r;this.mcpReady=a}async handleUri(e){let t=new URLSearchParams(e.query),o=t.get("token"),s=t.get("teamId"),n=t.get("projectId"),r=t.get("projectName");e.path==="/setup"&&o?await this.handleSetup(o,s,n,r):e.path==="/reconnect"?await this.handleReconnect():e.path==="/desync"?await l.commands.executeCommand("contox.desync"):e.path==="/connect"&&await l.commands.executeCommand("contox.connect")}async handleSetup(e,t,o,s){await this.client.setApiKey(e);let n=null;if(o)try{let r=await this.client.getProjectHmacSecret(o);r.data?.hmacSecret&&(n=r.data.hmacSecret,await this.context.secrets.store("contox-hmac-secret",n))}catch{console.warn("Contox: Failed to fetch HMAC secret \u2014 git capture will retry later")}if(t&&o)await this.autoConfigureProject(e,t,o,s??"Project",n);else if(t)await this.showProjectPicker(t);else{l.window.showInformationMessage("$(check) Contox: Authenticated! Choose a project to get started.","Open Setup").then(r=>{r==="Open Setup"&&ve(this.client,this.treeProvider,this.statusBar,this.context)});return}}async handleReconnect(){let e=P(),t=await this.client.getApiKey();if(!e||!t){l.window.showWarningMessage('Contox: Not configured yet. Use "Connect IDE" from the dashboard first.');return}let o=l.workspace.workspaceFolders;if(!o||o.length===0){l.window.showWarningMessage("Contox: Open a workspace folder first.");return}let s=o[0].uri.fsPath,n=l.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev");try{await this.mcpReady}catch{}let r=await this.context.secrets.get("contox-hmac-secret");if(!r)try{let a=await this.client.getProjectHmacSecret(e.projectId);a.data?.hmacSecret&&(r=a.data.hmacSecret,await this.context.secrets.store("contox-hmac-secret",r))}catch{}try{Y(t,n,e.teamId,e.projectId,s,r??void 0,this.context)}catch(a){console.error("Contox: Reconnect MCP config failed:",a)}this.sessionWatcher.start(e.projectId),this.gitWatcher.start(e.projectId),await l.commands.executeCommand("contox.sync",{silent:!0}),l.window.showInformationMessage(`$(check) Contox: Reconnected to "${e.projectName}" \u2014 all MCP configs refreshed`)}async autoConfigureProject(e,t,o,s,n){let r=l.workspace.workspaceFolders;if(!r||r.length===0){l.window.showWarningMessage("Contox: Open a workspace folder first, then try again.");return}let a=r[0].uri.fsPath,c=G.join(a,".contox.json");q.writeFileSync(c,JSON.stringify({teamId:t,projectId:o,projectName:s},null,2)+`
`,"utf-8");try{let d=l.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev");ae({apiKey:e,apiUrl:d,teamId:t,projectId:o,...n?{hmacSecret:n}:{}})}catch{}let m=l.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev");try{await this.mcpReady,Y(e,m,t,o,a,n??void 0,this.context)}catch(d){console.error("Contox: Failed to configure MCP:",d)}this.sessionWatcher.start(o),this.gitWatcher.start(o),await l.commands.executeCommand("contox.sync"),Ie(this.client,a,o),l.window.showInformationMessage(`$(check) Contox: Connected to "${s}" \u2014 memory loaded for all AI tools`)}async showProjectPicker(e){let t=await this.client.listProjects(e);if(t.error||!t.data){l.window.showErrorMessage(`Contox: Failed to load projects \u2014 ${t.error??"unknown error"}`);return}let o=t.data;if(o.length===0){l.window.showWarningMessage("Contox: No projects found for this team. Create one on the dashboard first.");return}let s=await l.window.showQuickPick(o.map(n=>({label:n.name,description:n.description??"",detail:`${n.contextsCount} contexts`,projectId:n.id})),{placeHolder:"Choose a project"});if(s){let n=await this.client.getApiKey();n&&await this.autoConfigureProject(n,e,s.projectId,s.label,null)}}};function Ot(i,e,t,o){let s=G.join(i,".mcp.json"),n;try{let v=q.readFileSync(s,"utf-8");n=JSON.parse(v)}catch{return"mcp_config_missing"}let a=n.mcpServers?.contox;if(!a)return"contox_server_missing";let u=a.args?.[0];if(!u)return"no_server_path";if(u.includes("packages/mcp-server"))return"old_path_format";if(!q.existsSync(u))return"binary_missing";let m=E(o);if(G.normalize(u)!==G.normalize(m))return"path_mismatch";let d=a.env;return d?d.CONTOX_API_KEY!==t?"api_key_mismatch":d.CONTOX_TEAM_ID!==e.teamId?"team_id_mismatch":d.CONTOX_PROJECT_ID!==e.projectId?"project_id_mismatch":null:"no_env"}function Ht(i){let e=fe(i).catch(h=>{console.error("Contox: Failed to deploy MCP server:",h)}),t=l.window.createOutputChannel("Contox");i.subscriptions.push(t);let o=new ce(i.secrets),s=new ue(o),n=new pe,r=new me(o,n),a=new he(o,n,i.secrets),c=new xe(o);r.setGitWatcher(a);let u=l.window.createTreeView("contoxContexts",{treeDataProvider:s,showCollapseAll:!1}),m=!1,d=new Te(o,s,n,r,a,i,e),v=d.handleUri.bind(d);d.handleUri=async h=>(m=!0,v(h)),i.subscriptions.push(Be(o),ze(o,i),Ge(o,s,n,t),qe(o,s,n),Le(o,s,n,i),Ye(o),Xe(o),et(a),ot(n,r,a,i),st(o,n,r,a,i,()=>P()?.projectId??null),l.commands.registerCommand("contox.flushCapture",()=>{a.flush()}),u,n,r,a,c,l.window.registerUriHandler(d)),(async()=>{if(await Promise.all([new Promise(f=>{setTimeout(f,500)}),e]),m)return;let h=await o.getApiKey(),g=P(),y=l.workspace.workspaceFolders;if(h&&g&&y&&y.length>0){if(await l.commands.executeCommand("contox.sync",{silent:!0}),Ie(o,y[0].uri.fsPath,g.projectId),tt(i)){n.setDisconnected();return}if(!await i.secrets.get("contox-hmac-secret"))try{let ee=await o.getProjectHmacSecret(g.projectId);ee.data?.hmacSecret&&await i.secrets.store("contox-hmac-secret",ee.data.hmacSecret)}catch{}r.start(g.projectId),a.start(g.projectId),c.start(g.projectId);let B=y[0].uri.fsPath,it=await i.secrets.get("contox-hmac-secret");if(h&&g){let ee=Ot(B,g,h,i);if(ee)try{let Ce=l.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev");Y(h,Ce,g.teamId,g.projectId,B,it??void 0,i),console.log("Contox: MCP auto-configured for all AI tools (reason:",ee,")")}catch(Ce){console.error("Contox: Failed to auto-configure MCP:",Ce)}}}else if(l.workspace.workspaceFolders&&l.workspace.workspaceFolders.length>0){let f=await l.window.showInformationMessage("Contox: Set up AI memory for this project?","Setup from Dashboard","I Have a Key");if(f==="Setup from Dashboard"){let B=l.workspace.getConfiguration("contox").get("apiUrl","https://contox.dev");l.env.openExternal(l.Uri.parse(`${B}/dashboard/cli`))}else f==="I Have a Key"&&ve(o,s,n,i)}})()}function Ut(){}0&&(module.exports={activate,deactivate,getWorkspaceConfig});
//# sourceMappingURL=extension.js.map
