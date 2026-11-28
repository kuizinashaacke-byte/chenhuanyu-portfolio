(function () {
  'use strict';
  const content = window.CareContent;
  const store = window.CareStore;
  const main = document.getElementById('main');
  const dialog = document.getElementById('dialog');
  const symbols = {home:'⌂', video:'▷', faq:'?', quiz:'✓', nurse:'▤', prep:'☷', check:'☑', records:'≡', info:'i'};
  let view = {role:'patient', page:'home', video:'overview', category:'全部', stage:'before', quizIndex:0};
  let player = null;
  let toastTimer;
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = iso => iso ? new Date(iso).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '';
  const action = (label, name, value = '', style = '') => `<button class="btn ${style}" data-action="${name}" data-value="${escape(value)}">${label}</button>`;
  const nav = (label, page, icon) => `<button class="nav-item ${view.page === page ? 'active' : ''}" data-action="navigate" data-value="${page}" ${view.page === page ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`;
  const storageNotice = () => store.isPersistent() ? '' : '<p class="notice">当前设备的本地存储不可用，记录暂存于本次打开期间。请导出演示记录后再关闭。</p>';

  function getPatient() { return store.patient(store.read()); }
  function normalize(p) {
    p.quizAttempts = p.quizAttempts || [];
    p.quizDraft = p.quizDraft || {};
    p.drafts = p.drafts || {};
    return p;
  }
  function update(fn) {
    store.mutate(data => fn(normalize(store.patient(data)), data));
  }
  function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }
  function watched(p) { return (p.videos.overview || {}).completed === true; }
  function latestAttempt(p) { return (p.quizAttempts || [])[0]; }
  function pending(p) { return p.questions.filter(q => q.status !== 'replied').length; }
  function answeredCount(p) { return p.questions.filter(q => q.status === 'replied').length; }
  function coverage(record) {
    if (!record || !record.duration) return 0;
    return Math.min(100, Math.round((record.seen || []).length / Math.ceil(record.duration) * 100));
  }
  function stopPlayer() {
    if (!player) return;
    player.persist();
    player.element.pause();
    player = null;
  }
  function go(page) {
    stopPlayer();
    view.page = page;
    render();
    window.scrollTo(0,0);
    main.focus({preventScroll:true});
  }
  function pageHeading(eyebrow, title, description) {
    return `<div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${description ? `<p class="muted">${description}</p>` : ''}`;
  }
  function patientTabs(data) {
    return `<div class="patient-tabs" aria-label="选择虚拟患者">${Object.values(data.patients).map(p => `<button data-action="patient" data-value="${p.id}" class="${data.activePatient === p.id ? 'active' : ''}">${escape(p.name)}<small class="muted">　${p.id}</small></button>`).join('')}</div>`;
  }
  function shell(p) {
    const patientNav = nav('访视首页','home',symbols.home) + nav('宣教视频','video',symbols.video) + nav('问答与护士','faq',symbols.faq) + nav('理解测验','quiz',symbols.quiz);
    const nurseNav = nav('访视工作台','nurse',symbols.nurse) + nav('手术准备','prep',symbols.prep) + nav('分阶段核对','check',symbols.check) + nav('记录与交接','records',symbols.records);
    const links = view.role === 'patient' ? patientNav : nurseNav;
    document.getElementById('sidebar').innerHTML = `<a class="brand" href="#" data-action="brand"><img src="icon.png" alt=""><span><strong>术前安心</strong><small>神经外科术前访视</small></span></a><div class="side-nav">${links}</div><div class="side-bottom">本机演示<br>${escape(p.id)} · ${escape(p.name)}<br>${action('使用与内容说明','navigate','info','outline small full')}</div>`;
    document.getElementById('header').innerHTML = `<div class="header-context">${view.role === 'patient' ? '患者与家属' : '护理工作台'}<br><strong>${escape(p.id)} · 本机演示</strong></div><div class="role-pill" aria-label="切换演示角色"><button data-action="role" data-value="patient" class="${view.role === 'patient' ? 'selected' : ''}">患者端</button><button data-action="role" data-value="nurse" class="${view.role === 'nurse' ? 'selected' : ''}">护士端</button></div>`;
    document.getElementById('bottom').innerHTML = links;
  }
  function steps(p) {
    const step = watched(p) ? (p.faqDone ? 3 : 2) : 1;
    return `<div class="row small muted" style="margin-bottom:22px"><span class="tag ${step === 1 ? '' : 'warn'}">${watched(p) ? '✓' : '1'} 看宣教</span><span>${p.faqDone ? '✓' : '2'} 问明白</span><span>${latestAttempt(p) ? '✓' : '3'} 十题理解测验</span></div>`;
  }
  function home(p) {
    const attempt = latestAttempt(p);
    return `<div class="hero"><div><div class="eyebrow">开颅手术术前访视</div><h1>把疑问说出来<br>把准备弄明白</h1><p class="muted">先用约一分钟了解手术前后的配合，再把疑问问清楚。最后完成十道题，帮助护士了解需要再讲解的地方。</p>${action(watched(p) ? '继续我的访视' : '开始观看一分钟宣教','navigate',watched(p) ? 'faq' : 'video','light')}</div><div class="hero-visual"><div class="care-orbit"><img src="icon.png" alt="术前安心"></div><div class="orbit-note">患者 · 家属 · 护士，一起沟通</div></div></div>${steps(p)}<div class="grid"><section class="card"><div class="row between"><h2>我的访视进度</h2><span class="tag">${p.id}</span></div><div class="stack"><div class="row between"><span>宣教视频</span><strong>${watched(p) ? '已观看' : '待观看'}</strong></div><div class="row between"><span>问答确认</span><strong>${p.faqDone ? '已完成' : '待确认'}</strong></div><div class="row between"><span>十道理解题</span><strong>${attempt ? attempt.score + ' / 10' : '待完成'}</strong></div></div><div class="progress" style="margin-top:20px"><span style="width:${[watched(p),p.faqDone,!!attempt].filter(Boolean).length/3*100}%"></span></div></section><section class="card"><div class="row between"><h2>护士的回复</h2><span class="tag">${answeredCount(p)} 条回复</span></div><p class="muted">${p.questions.length ? `您有 ${pending(p)} 条问题待处理。切换护士端，可以演示回复和跟进。` : '看完视频后，您可以随时留下没有弄明白的问题。'}</p>${action('查看问题与回复','navigate','faq','secondary')}</section></div><div class="section-title"><h2>先认识术前访视</h2>${action('内容说明','navigate','info','outline small')}</div><div class="card"><div class="row between"><div><h3>开颅手术术前宣教</h3><p class="muted">中文字幕 · 配音 · 可暂停与重看</p></div>${action('观看短片','navigate','video')}</div><p class="small muted">视频为课程制作草稿，内容与表述待科室审核。</p></div><div class="notice">如有新发或加重的不适，请立即联系现场医护人员。App 留言用于一般问题。</div>`;
  }
  function video(p) {
    const item = content.videos[0];
    const record = p.videos.overview || {};
    return `${pageHeading('先看宣教','一分钟，了解与配合','可以请家属陪您一起观看，随时暂停、重播。')}${steps(p)}<div class="video-player"><video id="education-video" controls playsinline preload="metadata" poster="media/overview-poster.jpg" aria-label="开颅手术术前宣教视频"><source src="media/overview.mp4" type="video/mp4"><track kind="captions" src="media/overview.vtt" srclang="zh" label="中文字幕"></video></div><div class="row between" style="margin:14px 0"><span id="watch-progress" class="small muted">实际观看进度 ${coverage(record)}%</span><span class="tag warn">内容草稿 · 待科室审核</span></div><div class="row">${action(watched(p) ? '继续查看问答' : '观看后，继续问答','video-next','','',)}${action('这里还有疑问','video-question','','secondary')}</div><p id="watch-tip" class="small muted" style="margin-top:12px">${watched(p) ? '已完成视频观看，可以进入问答。' : '完成至少 90% 的实际观看后进入下一步。已看内容会保存在本机。'}</p><details class="card transcript"><summary>查看文字内容</summary>${item.transcript.map(t=>`<p>${escape(t)}</p>`).join('')}<p class="small muted">一般信息参考 UCLH 患者资料与 WHO 安全核查框架，具体执行以本院审核内容和个人医嘱为准。</p></details><div class="notice">播放出现问题时，可先阅读文字内容，并联系护士协助。此演示记录用于检查观看流程。</div>`;
  }
  function questionList(p, nurse) {
    if (!p.questions.length) return '<div class="empty">还没有问题。患者提交后，会在这里显示。</div>';
    return [...p.questions].reverse().map(q => `<article class="question-item"><div class="row between"><span class="tag ${q.status === 'replied' ? '' : 'warn'}">${q.status === 'replied' ? '已回复' : q.status === 'following' ? '跟进中' : '待护士回复'}</span><time class="small muted">${date(q.at)}</time></div><div class="bubble question-title">${escape(q.text)}</div>${q.replies.map(r=>`<div class="bubble reply"><strong>示例护士</strong><div>${escape(r.text)}</div><small class="muted">${date(r.at)}</small></div>`).join('')}${nurse ? `<form data-form="reply" data-question="${q.id}"><div class="field"><label for="reply-${q.id}">${q.replies.length ? '补充回复' : '回复患者'}</label><textarea id="reply-${q.id}" name="reply" data-draft="reply-${q.id}" maxlength="1500" required placeholder="填写需要解释或跟进的内容">${escape(p.drafts['reply-'+q.id] || '')}</textarea></div><div class="row">${action('保存回复','reply',q.id)}${q.status !== 'following' ? action('标记跟进中','following',q.id,'outline') : ''}</div><p class="error" role="alert"></p></form>` : q.status === 'replied' ? action('仍有疑问，继续追问','followup',q.id,'outline small') : '<p class="small muted">本机演示中的护士端可以查看并回复这条问题。</p>'}</article>`).join('');
  }
  function faq(p) {
    const categories = ['全部',...new Set(content.faq.map(q=>q.category))];
    return `${pageHeading('再问明白','您的问题，我们一起了解','先查常见问题，未解决的问题可以交给护士。')}${steps(p)}${!watched(p) ? '<div class="notice" style="margin-bottom:18px">建议先完成宣教视频。您仍可随时向护士提问。</div>' : ''}<div class="field"><label for="faq-search">搜索常见问题</label><input id="faq-search" type="search" placeholder="试试输入 麻醉、吃喝、疼痛" autocomplete="off"></div><div class="chips">${categories.map(c=>`<button class="chip ${view.category === c ? 'active' : ''}" data-action="category" data-value="${c}">${c}</button>`).join('')}</div><div id="faq-results"></div><div class="card"><h2>这些问题讲清楚了吗？</h2><p class="muted">有疑问可以继续问护士。理解题将帮助护士知道哪些地方需要再讲一遍。</p><label class="choice"><input type="checkbox" id="faq-confirm" ${p.faqDone ? 'checked' : ''}>我已查看问答，未解决的问题可以继续向护士提出</label><div style="margin-top:16px">${action('完成问答，进入十道题','faq-next')}</div></div><section class="card" id="ask-nurse"><h2>把其他问题写给护士</h2><form data-form="ask"><div class="field"><label for="question-text">您还想了解什么？</label><textarea id="question-text" name="question" data-draft="question" maxlength="1000" required placeholder="例如：我还是很担心麻醉，想请护士帮我进一步了解。">${escape(p.drafts.question || '')}</textarea><small class="muted">请使用虚拟信息演示。问题和回复仅在这台设备中保存。</small></div><button class="btn" type="submit">提交给护士</button><p class="error" role="alert"></p></form><div class="notice">现在有新发或加重的不适时，请立即联系现场医护。</div></section><section class="card"><h2>我的问题与回复</h2>${questionList(p,false)}</section><section class="card"><h2>把担心也告诉护士</h2><form data-form="concerns"><div class="grid" style="margin-bottom:18px">${content.concerns.map((c,i)=>`<label class="choice"><input type="checkbox" name="concern" value="${i}" ${p.concerns.includes(c)?'checked':''}>${c}</label>`).join('')}</div><div class="field"><label for="feeling">现在的感受</label><select name="feeling" id="feeling"><option value="">请选择</option>${['比较平静','有一点紧张','很紧张，希望再聊一聊'].map(x=>`<option ${p.feeling===x?'selected':''}>${x}</option>`).join('')}</select></div><button type="submit" class="btn secondary">保存给护士看</button><p class="small muted" style="margin-top:10px">个人自述用于沟通，护士会进一步了解您的感受。</p></form></section>`;
  }
  function faqResults() {
    const box = document.getElementById('faq-results');
    if (!box) return;
    const input = document.getElementById('faq-search');
    const term = (input.value || '').trim().toLowerCase();
    const found = content.faq.filter(item => (view.category === '全部' || item.category === view.category) && (!term || (item.q+item.a+item.category).toLowerCase().includes(term)));
    box.innerHTML = found.length ? found.map(item => `<details class="faq"><summary>${escape(item.q)}</summary><div class="answer"><p>${escape(item.a)}</p><div class="row"><span class="tag warn">宣教草稿 · 待审核</span>${action('重看宣教','navigate','video','outline small')}</div></div></details>`).join('') : `<div class="card empty"><p>暂时没有找到这个问题。</p>${action('写给护士','scroll-ask','','secondary')}</div>`;
  }
  function quiz(p) {
    if (!watched(p) || !p.faqDone) return `${pageHeading('最后确认理解','十道理解题','完成视频与问答后，开始这次测验。')}<div class="card"><h2>${!watched(p)?'先看约一分钟的宣教视频':'请先确认问答环节'}</h2><p class="muted">题目帮助发现需要再讲解的内容。每次共十道题，提交后查看解释。</p>${action(!watched(p)?'去看宣教':'去查看问答','navigate',!watched(p)?'video':'faq')}</div>`;
    const q = content.quiz[view.quizIndex];
    const attempt = latestAttempt(p);
    return `${pageHeading('最后确认理解','十道理解题','答错的地方会交给护士再次讲解，您也可以查看解释后重做。')}<div class="row between" style="margin-bottom:12px"><strong>第 ${view.quizIndex+1} / 10 题</strong><span class="small muted">已作答 ${Object.keys(p.quizDraft).length} / 10</span></div><div class="progress"><span style="width:${(view.quizIndex+1)*10}%"></span></div><section class="card" style="margin-top:20px"><h2>${escape(q.q)}</h2><div class="stack">${q.options.map((opt,i)=>`<label class="choice"><input type="radio" name="quiz-answer" value="${i}" ${p.quizDraft[q.id]===i?'checked':''}>${escape(opt)}</label>`).join('')}</div><div class="row between" style="margin-top:22px">${view.quizIndex ? action('上一题','quiz-prev','','outline') : '<span></span>'}${action(view.quizIndex === 9?'提交十道题':'下一题',view.quizIndex === 9?'quiz-submit':'quiz-next')}</div><p class="error" id="quiz-error" role="alert"></p></section><div class="chips" aria-label="跳转题目">${content.quiz.map((item,i)=>`<button class="chip ${i===view.quizIndex?'active':''}" data-action="quiz-jump" data-value="${i}" aria-label="第${i+1}题${p.quizDraft[item.id]!==undefined?'已作答':''}">${i+1}${p.quizDraft[item.id]!==undefined?' ✓':''}</button>`).join('')}</div>${attempt?`<div class="card"><h3>上次测验</h3><p class="muted">${date(attempt.at)} · ${attempt.score} / 10</p>${action('查看结果与讲解','navigate','result','secondary')}</div>`:''}`;
  }
  function result(p) {
    const attempt = latestAttempt(p);
    if (!attempt) return quiz(p);
    return `${pageHeading('理解测验结果',`本次答对 ${attempt.score} / 10 题`,'护士可以查看每道题的结果，并针对需要加强的部分再次讲解。')}<div class="notice calm">分数用于宣教沟通参考。患者是否理解和临床决策由医护人员结合沟通评估。</div><section class="card" style="margin-top:20px"><h2>${attempt.score===10?'谢谢您认真了解':'这些地方，我们再看一遍'}</h2>${content.quiz.map((q,i)=>{const correct=attempt.answers[q.id]===q.correct;return `<details class="faq" ${correct?'':'open'}><summary><span>${i+1}. ${escape(q.topic)}</span><span class="tag ${correct?'':'warn'}">${correct?'答对':'需再讲解'}</span></summary><div class="answer"><p>${escape(q.q)}</p><p>您的选择　${escape(q.options[attempt.answers[q.id]])}</p><p><strong>建议理解　${escape(q.options[q.correct])}</strong></p><p>${escape(q.why)}</p></div></details>`}).join('')}<div class="row">${action('重新做十道题','quiz-restart','','secondary')}${action('还有疑问，问护士','navigate','faq')}</div></section>`;
  }
  function patientSummary(p) {
    const attempt = latestAttempt(p);
    const weak = attempt ? content.quiz.filter(q=>attempt.answers[q.id]!==q.correct).map(q=>q.topic) : [];
    return `<div class="card nurse-hero"><div class="row between"><div><div class="eyebrow">${p.id} · 虚拟患者</div><h2>${escape(p.name)}</h2><p>${escape(p.procedure)}</p></div><span class="tag warn">待科室审核的演示流程</span></div><div class="mini-metrics"><div><strong>${watched(p)?'已观看':'待观看'}</strong><span>宣教视频</span></div><div><strong>${attempt?attempt.score+' / 10':'待完成'}</strong><span>最近理解测验</span></div><div><strong>${pending(p)}</strong><span>待跟进问题</span></div></div>${weak.length?`<p style="margin-top:16px">需再讲解　${escape(weak.join('、'))}</p>`:''}</div>`;
  }
  function nurse(p,data) {
    return `${pageHeading('护士工作台','把患者的担心，接到手里','患者端与护士端在本机演示同一份记录，角色切换用于课堂展示。')}${patientTabs(data)}${patientSummary(p)}<div class="grid" style="margin:20px 0"><section class="card"><h2>患者的担忧</h2><p>${p.concerns.length?escape(p.concerns.join('、')):'患者尚未选择担忧事项。'}</p><p class="muted">当前感受　${escape(p.feeling||'待了解')}</p>${action('查看患者流程','role','patient','outline small')}</section><section class="card"><h2>理解情况</h2><p class="muted">${latestAttempt(p)?'已完成 '+p.quizAttempts.length+' 次测验。请结合错题再次讲解。':'完成十道理解题后，在此查看结果。'}</p>${latestAttempt(p)?action('查看逐题结果','navigate','result','secondary small'):''}<p class="small muted" style="margin-top:10px">观看完成和答题分数均为宣教辅助记录。</p></section></div><section class="card"><h2>问题与回复</h2>${questionList(p,true)}</section>`;
  }
  function checkControls(id, record, group) {
    const status = record ? record.status : 'pending';
    return `<div class="check-options">${[['pending','待核实'],['verified','已核实'],['issue','有异常'],['na','不适用']].map(([value,label])=>`<label class="check-option ${value==='issue'?'issue':''}"><input type="radio" name="${group}-${id}" data-check="${id}" data-group="${group}" value="${value}" ${status===value?'checked':''}><span>${label}</span></label>`).join('')}</div>${status==='issue'||status==='na'?`<form class="check-note" data-form="check-note" data-check="${id}" data-group="${group}"><label class="small" for="note-${id}">${status==='issue'?'异常、处理或待跟进情况':'不适用的原因'}</label><textarea id="note-${id}" maxlength="1000" name="note">${escape(record.note||'')}</textarea><button class="btn small secondary" type="submit">保存说明</button><p class="error" role="alert">${record.note?'':'请补充说明，此项当前仍待处理。'}</p></form>`:''}${record?`<div class="check-meta">示例护士 · ${date(record.at)}${record.note?' · '+escape(record.note):''}</div>`:''}`;
  }
  function prep(p,data) {
    return `${pageHeading('护士工作台','开颅手术准备','依本次手术方案和本院流程，逐项核实准备情况。')}${patientTabs(data)}<div class="notice" style="margin-bottom:20px">以下是可操作的准备模板。具体器械、体位、设备与护理要求，待科室提供并审核后配置。</div><section class="card">${content.prep.map(item=>`<article class="check-item"><h3>${item.title}</h3><p class="muted">${item.text}</p>${checkControls(item.id,p.prep[item.id],'prep')}</article>`).join('')}</section>`;
  }
  function checks(p,data) {
    const stage = content.stages.find(s=>s.id===view.stage) || content.stages[0];
    const records = stage.items.map(([id])=>p.checks[id]);
    const confirmed = records.filter(r=>r && (r.status==='verified'||(r.status==='na'&&r.note))).length;
    return `${pageHeading('护士工作台','按手术阶段，核实与记录','每一项保留状态和时间，异常事项继续跟进。')}${patientTabs(data)}<div class="notice">核对模板待本院审核。团队核查需按本院制度由相关人员共同完成，应用记录由示例护士操作。</div><div class="tabs">${content.stages.map(s=>`<button class="chip ${s.id===stage.id?'active':''}" data-action="stage" data-value="${s.id}">${s.title}</button>`).join('')}</div><section class="card"><div class="row between"><h2>${stage.title}</h2><span class="tag">已记录 ${confirmed} / ${stage.items.length}</span></div><p class="muted">${stage.team}</p>${stage.items.map(([id,title])=>`<article class="check-item"><div class="check-title">${title}</div>${checkControls(id,p.checks[id],'checks')}</article>`).join('')}</section><p class="small muted">三个安全核查节点参考 WHO 核查表。术中护理记录为待科室配置的补充模板。</p>`;
  }
  function records(p,data) {
    const all = [...Object.values(p.prep),...Object.values(p.checks)];
    const unresolved = all.filter(r=>r.status==='issue'||(r.status==='na'&&!r.note)).length;
    return `${pageHeading('护士工作台','记录与交接','本机保留宣教、沟通、理解测验和核对的演示记录。')}${patientTabs(data)}<div class="grid"><div class="card"><div class="count">${unresolved}</div><p class="muted">异常或待补说明的核对项</p></div><div class="card"><div class="count">${pending(p)}</div><p class="muted">待回复或跟进中的问题</p></div></div><section class="card" style="margin-top:20px"><h2>交接与再次讲解</h2><form data-form="handoff"><div class="field"><label for="handoff">需要继续关注的事项</label><textarea id="handoff" name="handoff" maxlength="3000" data-draft="handoff" placeholder="例如：患者仍担心麻醉，已请相关团队继续沟通。">${escape(p.drafts.handoff===undefined?p.handoff:p.drafts.handoff)}</textarea></div><button type="submit" class="btn">保存交接记录</button></form></section><section class="card"><div class="row between"><h2>操作记录</h2>${action('导出本机演示记录','export','','outline small')}</div>${p.events.length?`<ol class="timeline">${p.events.map(e=>`<li>${escape(e.text)}<time>${date(e.at)}</time></li>`).join('')}</ol>`:'<div class="empty">完成宣教、提问或核对后，操作记录会显示在这里。</div>'}</section>`;
  }
  function info(p,data) {
    return `${pageHeading('使用与内容说明','术前安心','神经外科开颅手术术前访视 · 课程演示 v'+content.version)}<section class="card"><h2>演示方式</h2><p>患者先观看约一分钟的视频，再查阅常见问答或向护士提问，最后完成十道理解题。护士查看担忧、问题和测验结果，并记录准备、核对及交接。</p><p>当前使用三位虚拟患者，角色切换用于体验两端。本机浏览器或同一 App 安装内保存记录，跨设备联通需要后续接入医院认可的服务和身份权限。</p>${patientTabs(data)}<p class="muted">可以切换虚拟患者，分别体验独立的访视记录。</p></section><section class="card"><h2>医学内容与审核</h2><p>视频、常见问答、十道题及核对条目均为待科室审核的内容草稿。临床使用前需要由本院确认适用人群、具体术式、流程、知识内容和版本。</p><p>测验用于发现需要再讲解的主题，题目为课程自编，分数供沟通参考。</p><div class="link-list">${content.sources.map(s=>`<div><a href="${s.url}" target="_blank" rel="noopener">${s.title}</a><p class="small muted">${s.scope}</p></div>`).join('')}</div></section><section class="card"><h2>记录与设备</h2><p>演示信息保存在本机。卸载、清除应用数据或清除浏览器存储会删除这些信息。导出的文件包含本机全部虚拟患者的演示记录。</p><p>安卓安装包采用本地页面封装，可离线播放内置视频并保存操作。真机安装和实际临床使用分别需要进一步验证。</p><div class="row">${action('导出演示记录','export','','secondary')}${action('重置全部演示记录','reset','','danger')}</div></section>`;
  }
  function render() {
    const data = store.read();
    const p = normalize(store.patient(data));
    shell(p);
    const pages = {home,video,faq,quiz,result,nurse,prep,check:checks,records,info};
    const page = pages[view.page] || home;
    main.innerHTML = storageNotice() + page(p,data);
    if (view.page==='faq') faqResults();
    if (view.page==='video') setupPlayer(p);
  }
  function setupPlayer(p) {
    const videoEl = document.getElementById('education-video');
    const record = p.videos.overview || {};
    const seen = new Set(record.seen || []);
    let previous = null;
    let duration = record.duration || 0;
    let lastSaved = 0;
    const persist = () => {
      if (!duration) return;
      update(patient => {
        const old = patient.videos.overview || {};
        const merged = new Set([...(old.seen||[]), ...seen]);
        const completed = old.completed || merged.size / Math.ceil(duration) >= .9;
        if (completed && !old.completed) store.event(patient,'完成一分钟宣教视频观看');
        patient.videos.overview = {seen:[...merged],duration,completed,at:new Date().toISOString()};
      });
    };
    const progress = () => {
      const value = Math.min(100,Math.round(seen.size/Math.ceil(duration)*100));
      document.getElementById('watch-progress').textContent = '实际观看进度 '+value+'%';
      if (value>=90) document.getElementById('watch-tip').textContent = '已完成视频观看，可以继续进入问答。';
    };
    videoEl.addEventListener('loadedmetadata',()=>{ duration=videoEl.duration; progress(); });
    videoEl.addEventListener('seeking',()=>{previous=null;});
    videoEl.addEventListener('play',()=>{previous=null;});
    videoEl.addEventListener('timeupdate',()=>{
      const now=videoEl.currentTime;
      if (!videoEl.paused && previous!==null && now>=previous && now-previous<2) {
        for(let i=Math.floor(previous);i<Math.floor(now);i++) seen.add(i);
      }
      previous=now;
      if(duration) progress();
      if(now-lastSaved>4){persist();lastSaved=now;}
    });
    videoEl.addEventListener('pause',persist);
    videoEl.addEventListener('ended',persist);
    videoEl.addEventListener('error',()=>{ document.getElementById('watch-tip').textContent='视频暂时无法播放，请查看文字内容或联系护士协助。'; });
    player={element:videoEl,persist};
  }
  function validateQuizSelection() {
    const q=content.quiz[view.quizIndex];
    if(getPatient().quizDraft[q.id]===undefined){document.getElementById('quiz-error').textContent='请先选择一个答案。';return false;}
    return true;
  }
  function exportRecords() {
    stopPlayer();
    const payload=JSON.stringify({exportedAt:new Date().toISOString(),version:content.version,environment:'fictional-local-demo',...store.read()},null,2);
    const name='previsit-demo-'+new Date().toISOString().slice(0,10)+'.json';
    if(window.AndroidCare && typeof window.AndroidCare.saveText==='function') {
      window.AndroidCare.saveText(name,payload);
      return;
    }
    const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('已导出本机演示记录');
  }
  function checkUpdate(el) {
    const id=el.dataset.check,group=el.dataset.group;
    if(!['prep','checks'].includes(group))return;
    update(p=>{const old=p[group][id]||{};p[group][id]={...old,status:el.value,at:new Date().toISOString(),actor:'示例护士'};store.event(p,`更新${group==='prep'?'手术准备':'护理核对'}记录`);});
    render();
  }
  document.addEventListener('click', event=>{
    const el=event.target.closest('[data-action]');
    if(!el)return;
    event.preventDefault();
    const name=el.dataset.action,value=el.dataset.value;
    if(name==='navigate')return go(value);
    if(name==='brand')return go(view.role==='patient'?'home':'nurse');
    if(name==='role'){view.role=value;return go(value==='nurse'?'nurse':'home');}
    if(name==='patient'){stopPlayer();store.mutate(data=>{if(data.patients[value])data.activePatient=value;});view.quizIndex=0;render();return;}
    if(name==='category'){view.category=value;const term=document.getElementById('faq-search').value;render();document.getElementById('faq-search').value=term;faqResults();return;}
    if(name==='scroll-ask'){document.getElementById('ask-nurse').scrollIntoView({behavior:'smooth'});document.getElementById('question-text').focus({preventScroll:true});return;}
    if(name==='video-next'){
      if(player)player.persist();
      if(!watched(getPatient()))return toast('请先完成至少 90% 的实际视频观看。');
      return go('faq');
    }
    if(name==='video-question'){update(p=>{p.drafts.question='关于宣教视频，我还想了解：';});go('faq');document.getElementById('ask-nurse').scrollIntoView();return;}
    if(name==='faq-next'){
      if(!watched(getPatient()))return toast('请先完成宣教视频观看。');
      if(!document.getElementById('faq-confirm').checked)return toast('请先勾选问答确认。');
      update(p=>{p.faqDone=true;store.event(p,'完成问答确认');});return go('quiz');
    }
    if(name==='quiz-prev'){view.quizIndex--;return go('quiz');}
    if(name==='quiz-next'){if(validateQuizSelection()){view.quizIndex++;go('quiz');}return;}
    if(name==='quiz-jump'){view.quizIndex=Number(value);return go('quiz');}
    if(name==='quiz-submit'){
      if(!validateQuizSelection())return;
      const p=getPatient();
      const missing=content.quiz.findIndex(q=>p.quizDraft[q.id]===undefined);
      if(missing!==-1){view.quizIndex=missing;go('quiz');return toast('还有题目未作答，已转到未答题。');}
      update(patient=>{const answers={...patient.quizDraft};const score=content.quiz.filter(q=>answers[q.id]===q.correct).length;patient.quizAttempts.unshift({id:store.id(),at:new Date().toISOString(),answers,score});patient.quizAttempts=patient.quizAttempts.slice(0,30);patient.quizDraft={};store.event(patient,'完成十道理解题，答对 '+score+' 题');});
      return go('result');
    }
    if(name==='quiz-restart'){update(p=>{p.quizDraft={};});view.quizIndex=0;return go('quiz');}
    if(name==='stage'){view.stage=value;return go('check');}
    if(name==='following'){update(p=>{const q=p.questions.find(q=>q.id===value);if(q){q.status='following';store.event(p,'将患者问题标记为跟进中');}});return render();}
    if(name==='reply'){el.closest('form').requestSubmit();return;}
    if(name==='followup'){update(p=>{const q=p.questions.find(q=>q.id===value);p.drafts.question='关于“'+q.text.slice(0,90)+'”，我还想问：';});go('faq');document.getElementById('question-text').focus();return;}
    if(name==='export')return exportRecords();
    if(name==='reset'){
      dialog.innerHTML='<h2>重置全部演示记录？</h2><p>将清除这台设备内三位虚拟患者的观看、提问、测验和核对记录。可以先导出备份。</p><div class="row">'+action('保留记录','dialog-close','','outline')+action('清除并重新演示','reset-confirm','','danger')+'</div>';dialog.showModal();return;
    }
    if(name==='dialog-close')return dialog.close();
    if(name==='reset-confirm'){stopPlayer();store.mutate(data=>{Object.assign(data,store.fresh());});dialog.close();view.page='home';view.role='patient';view.quizIndex=0;render();toast('演示记录已重置');}
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.name==='quiz-answer'){const q=content.quiz[view.quizIndex];update(p=>{p.quizDraft[q.id]=Number(el.value);});const error=document.getElementById('quiz-error');if(error)error.textContent='';}
    if(el.dataset.check)checkUpdate(el);
  });
  document.addEventListener('input',event=>{
    const el=event.target;
    if(el.id==='faq-search')faqResults();
    if(el.dataset.draft)update(p=>{p.drafts[el.dataset.draft]=el.value;});
  });
  document.addEventListener('submit',event=>{
    const form=event.target;
    if(!form.dataset.form)return;
    event.preventDefault();
    const data=new FormData(form);
    const kind=form.dataset.form;
    if(kind==='ask'){
      const text=String(data.get('question')||'').trim();
      if(!text){form.querySelector('.error').textContent='请写下您想问的问题。';return;}
      update(p=>{p.questions.push({id:store.id(),text,at:new Date().toISOString(),status:'pending',replies:[]});p.drafts.question='';store.event(p,'患者提交了一条问题');});render();toast('问题已保存，切换护士端可演示回复。');return;
    }
    if(kind==='reply'){
      const text=String(data.get('reply')||'').trim();
      if(!text){form.querySelector('.error').textContent='请填写回复内容。';return;}
      update(p=>{const q=p.questions.find(q=>q.id===form.dataset.question);if(q){q.replies.push({text,at:new Date().toISOString(),actor:'示例护士'});q.status='replied';p.drafts['reply-'+q.id]='';store.event(p,'护士回复了患者问题');}});render();toast('回复已保存，患者端可以查看。');return;
    }
    if(kind==='concerns'){
      update(p=>{p.concerns=data.getAll('concern').map(i=>content.concerns[Number(i)]).filter(Boolean);p.feeling=String(data.get('feeling')||'');store.event(p,'患者更新担忧与感受');});toast('担忧和感受已保存');return;
    }
    if(kind==='check-note'){
      const note=String(data.get('note')||'').trim();
      if(!note){form.querySelector('.error').textContent='请补充异常情况或不适用原因。';return;}
      update(p=>{const r=p[form.dataset.group][form.dataset.check];if(r){r.note=note;r.at=new Date().toISOString();store.event(p,'保存核对说明');}});render();toast('说明已保存');return;
    }
    if(kind==='handoff'){update(p=>{p.handoff=String(data.get('handoff')||'').trim();delete p.drafts.handoff;store.event(p,'保存交接与再次讲解记录');});render();toast('交接记录已保存');}
  });
  window.addEventListener('storage',()=>{if(!document.activeElement.matches('textarea,input,select')&&!player)render();});
  window.addEventListener('pagehide',()=>{if(player)player.persist();});
  window.CareApp={navigate:go,view:()=>({...view})};
  render();
})();
