(function () {
  const KEY = 'previsit-demo-v1';
  const patientIds = ['DEMO-001', 'DEMO-002', 'DEMO-003'];
  function fresh() {
    const patients = {};
    patientIds.forEach((id, i) => {
      patients[id] = {
        id, name: ['示例患者一', '示例患者二', '示例患者三'][i],
        procedure: '择期开颅手术 · 术式待确认',
        videos: {}, concerns: [], feeling: '', questions: [], checks: {}, prep: {}, handoff: '', events: [], quizAttempts: [], quizDraft: {}, faqDone: false, drafts: {}
      };
    });
    return {schema: 1, revision: 0, activePatient: patientIds[0], patients};
  }
  let memory = fresh();
  let persistent = true;
  function valid(data) {
    return data && data.schema === 1 && data.patients && patientIds.every(id => data.patients[id] && Array.isArray(data.patients[id].questions));
  }
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (valid(data)) memory = data;
      }
    } catch (_) { persistent = false; }
    return memory;
  }
  function mutate(fn) {
    const data = read();
    fn(data);
    data.revision = (data.revision || 0) + 1;
    memory = data;
    try { localStorage.setItem(KEY, JSON.stringify(data)); persistent = true; }
    catch (_) { persistent = false; }
    return data;
  }
  function patient(data) { return data.patients[data.activePatient] || data.patients[patientIds[0]]; }
  function id() { return 'item-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9); }
  function event(p, text) {
    p.events.unshift({id: id(), text, at: new Date().toISOString()});
    p.events = p.events.slice(0, 100);
  }
  window.CareStore = {read, mutate, patient, fresh, id, event, isPersistent: () => persistent};
})();
