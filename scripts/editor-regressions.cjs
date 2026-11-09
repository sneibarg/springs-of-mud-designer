// Focused state regressions without an Angular test runner. Browser checks cover
// DOM reconciliation, focus, labels, and layout; these tests use mocked transport.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
class EventEmitter {
  emit(value) { this.last = value; this.listener?.(value); }
}
const decorator = () => () => {};
const core = { Component: decorator, Injectable: decorator, Input: decorator,
  Output: decorator, ViewChild: decorator, HostListener: decorator, EventEmitter, afterNextRender: callback => callback(), forwardRef: callback => callback };
function load(file) {
  file = path.resolve(__dirname, '..', file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText;
  const localRequire = name => name === '@angular/core' ? core : name.startsWith('@angular/') ? {}
    : name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name);
  vm.runInThisContext('(function(require,module,exports){' + js + '\n})', { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
global.window = { localStorage: { getItem: () => null } };
const { AppComponent } = load('src/app/app.component.ts');
const { ResourceFormComponent } = load('src/app/resource-form.component.ts');
const { GuardListComponent } = load('src/app/guard-list.component.ts');
const { LambdaListComponent } = load('src/app/lambda-list.component.ts');
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;});return {promise,resolve,reject}; }
function appWith(api = {}) {
  const app = new AppComponent({ list: async () => [], getAreas: async () => [], ...api }, { markForCheck() {} });
  app.unsavedDialog = { nativeElement: { showModal() {}, close() {} } };
  return app;
}
async function discard(app, action) {
  const pending = action();
  app.finishDraftDecision(true);
  await pending;
}
test('UX-001: Stay protects drafts; same selection is a no-op; Discard continues', async () => {
  const app = appWith();
  app.updateRawJson('{"name":"keep"}');
  await app.setActiveKind('spells');
  assert.equal(app.resourceDraft.name, 'keep');
  const navigation = app.setActiveKind('classes');
  app.finishDraftDecision(false);
  await navigation;
  assert.equal(app.activeKind, 'spells');
  assert.equal(app.resourceDraft.name, 'keep');
  await discard(app, () => app.setActiveKind('classes'));
  assert.equal(app.activeKind, 'classes');
  assert.equal(app.isDirty, false);
});
test('UX-001: Reload and New respect Stay, and beforeunload protects dirty work', async () => {
  let reads = 0;
  const app = appWith({ list: async () => { reads++; return []; } });
  app.updateRawJson('{"name":"keep"}');
  for (const action of [() => app.createNewResource(), () => app.loadActiveDocuments()]) {
    const pending = action();app.finishDraftDecision(false);await pending;
    assert.equal(app.resourceDraft.name, 'keep');
  }
  assert.equal(reads, 0);
  let prevented = false; app.beforeUnload({ preventDefault() {prevented=true;} });
  assert.equal(prevented, true);
});
test('UX-002: raw edits synchronize and invalid raw blocks structured overwrite', () => {
  const app = appWith();
  app.updateRawJson('{"name":"raw","payload":{"nested":[true,null,3]}}');
  app.updateResourceDraft({ ...app.resourceDraft, beats: 2 });
  assert.equal(JSON.parse(app.resourceDraftText).name, 'raw');
  app.updateRawJson('{broken');
  app.updateResourceDraft({ name: 'overwrite' });
  assert.equal(app.resourceDraftText, '{broken');
  assert.equal(app.saveBlocked, true);
  assert.ok(app.createRequest.blocked);
});
test('UX-003: guard keys survive typing and moves without entering payloads', () => {
  const guards = new GuardListComponent();
  guards.guards = [{ predicate: '', messageKey: '', extra: { enabled: true } }, { predicate: 'two' }];
  guards.guardsChange.listener = value => { guards.guards = value; };
  const firstKey = guards.trackGuard(0, guards.guards[0]);
  const secondKey = guards.trackGuard(1, guards.guards[1]);
  guards.updateGuardField(0, 'messageKey', 'abc', true);
  assert.equal(guards.trackGuard(0, guards.guards[0]), firstKey);
  assert.equal(guards.trackGuard(1, guards.guards[1]), secondKey);
  guards.moveGuard(0, 1);
  assert.equal(guards.trackGuard(1, guards.guards[1]), firstKey);
  assert.deepEqual(guards.guards[1].extra, { enabled: true });
  assert.deepEqual(Object.keys(guards.guards[1]).sort(), ['extra','messageKey','predicate']);
});
test('UX-004: invalid field JSON blocks saving; repair commits typed values; document switch clears buffers', async () => {
  let writes = 0;
  const app = appWith({ save: async () => { writes++; } });
  app.updateRawJson('{"name":"spell","payload":{"old":true}}');
  const form = new ResourceFormComponent();
  form.draft = app.resourceDraft;
  form.invalidJsonChange.listener = value => app.updateFieldValidity(value);
  form.draftChange.listener = value => {app.updateResourceDraft(value);form.draft=app.resourceDraft;};
  form.updateJsonText('payload', '{broken');
  await app.saveActiveDocument();
  assert.equal(writes, 0);
  assert.equal(app.isDirty, true);
  assert.equal(form.jsonErrors.has('payload'), true);
  form.updateJsonText('payload', '[true,null,3,{"x":"y"}]');
  assert.deepEqual(app.resourceDraft.payload, [true,null,3,{x:'y'}]);
  assert.equal(app.fieldJsonInvalid, false);
  form.updateJsonText('payload', '{broken');
  form.draft = { payload: { next: true } };
  form.ngOnChanges({ documentIdentity: {} });
  assert.equal(form.jsonErrors.size, 0);
  assert.deepEqual(JSON.parse(form.jsonValue('payload')), { next: true });
});
test('UX-005: late reads and failed obsolete reads cannot replace another workspace', async () => {
  for (const failure of [false,true]) {
    const response = deferred();const app = appWith({ list: () => response.promise });
    const reading = app.loadActiveDocuments(false);
    await app.createNewResource();
    app.updateRawJson('{"name":"newer"}');
    if (failure) response.reject(new Error('old failure')); else response.resolve([{id:'old',name:'old'}]);
    await reading;
    assert.equal(app.resourceDraft.name, 'newer');
    assert.equal(app.resourceMessage.includes('old failure'), false);
  }
});
test('UX-005: automatic startup loading preserves edits that predate the read', async () => {
  const app = appWith({ list: async () => [{id:'old',name:'old'}] });
  app.updateRawJson('{"name":"typed during startup"}');
  await app.loadActiveDocuments(false);
  assert.equal(app.resourceDraft.name, 'typed during startup');
});
test('UX-005: concurrent saves are blocked; late success leaves newer draft intact', async () => {
  const response = deferred();let writes=0;
  const app = appWith({ save: () => {writes++;return response.promise;} });
  app.updateRawJson('{"name":"original"}');
  const saving = app.saveActiveDocument();
  await app.saveActiveDocument();
  assert.equal(writes, 1);
  await discard(app, () => app.createNewResource());
  app.updateRawJson('{"name":"newer"}');
  response.resolve({id:'saved',name:'original'});
  await saving;
  assert.equal(app.resourceDraft.name, 'newer');
  assert.equal(app.selectedResourceId, 'new');
});
test('UX-005: failed saves retain input; Save and continue stays on failure', async () => {
  const app = appWith({ save: async () => {throw Error('mock failure');} });
  app.updateRawJson('{"name":"keep"}');
  const pending = app.setActiveKind('classes');
  await app.saveAndContinue();
  assert.equal(app.activeKind, 'spells');
  assert.equal(app.resourceDraft.name, 'keep');
  assert.match(app.resourceMessage, /mock failure/);
  app.finishDraftDecision(false);await pending;
});
test('UX-001/007: Save and continue persists the same operation shown in preview', async () => {
  let sent;
  const app = appWith({ save: async (_server,_proxy,endpoint,payload,existing) => {sent={endpoint,payload,existing};return {...payload,id:'saved'};} });
  app.updateRawJson('{"name":"ready","payload":{"x":[true,null]}}');
  const preview = app.createRequest;
  const navigation = app.setActiveKind('classes');
  await app.saveAndContinue();await navigation;
  assert.equal(preview.method, 'POST');
  assert.deepEqual(sent.payload, preview.body);
  assert.equal(sent.endpoint, '/api/v1/spells');
  assert.equal(app.activeKind, 'classes');
});
test('UX-007: existing drafts preview PUT and identity cannot be lost in raw edits', () => {
  const app = appWith();app.resourceDocuments=[{id:'existing',name:'loaded'}];app.openResource('existing');
  app.updateRawJson('{"name":"edited"}');
  assert.equal(app.createRequest.method, 'PUT');
  assert.match(app.createRequest.url, /\/spells\/existing$/);
  assert.equal(app.createRequest.body.id, 'existing');
});
test('UX-008: local search filters names, vnums and nested content without changing drafts', () => {
  const app = appWith();app.resourceDocuments=[{id:'a',name:'fire',vnum:123,payload:{script:'flame'}},{id:'b',name:'ice'}];
  for (const query of ['FIRE','123','flame']) { app.searchQuery=query;assert.equal(app.filteredDocuments.length,1); }
  app.searchQuery='absent';assert.equal(app.filteredDocuments.length,0);
  app.searchQuery='';assert.equal(app.filteredDocuments.length,2);
  assert.equal(app.isDirty,false);
});

test('UX-001: cancelled area and document selection retain the current workspace', async () => {
  const app = appWith();app.activeKind='rooms';app.selectedResourceAreaId='A';
  app.replaceDraft({id:'room',areaId:'A',name:'room'},'room');
  app.updateResourceDraft({...app.resourceDraft,name:'edited'});
  const select = {value:'B'};
  const areaChange=app.onAreaFilterChange('B',select);
  app.finishDraftDecision(false);await areaChange;
  assert.equal(app.selectedResourceAreaId,'A');assert.equal(select.value,'A');
  const documentChange=app.selectResource('other');
  app.finishDraftDecision(false);await documentChange;
  assert.equal(app.selectedResourceId,'room');assert.equal(app.resourceDraft.name,'edited');
});
test('UX-005: post-submit edits keep a newly assigned ID and next save uses PUT', async () => {
  const response=deferred();let writes=0;
  const app=appWith({save:()=>{writes++;return response.promise;}});
  app.updateRawJson('{"name":"original"}');
  const saving=app.saveActiveDocument();
  app.updateRawJson('{broken');
  response.resolve({id:'created',name:'original'});await saving;
  assert.equal(app.resourceDraftText,'{broken');
  app.updateRawJson('{"name":"corrected"}');
  assert.equal(app.createRequest.method,'PUT');assert.equal(app.createRequest.body.id,'created');
  assert.equal(writes,1);
});
test('UX-005: out-of-order lists cannot clear the newest loading state', async () => {
  const first=deferred(),second=deferred();let reads=0;
  const app=appWith({list:()=>++reads===1?first.promise:second.promise});
  const oldRead=app.loadActiveDocuments(false),newRead=app.loadActiveDocuments(false);
  first.resolve([{id:'old',name:'old'}]);await oldRead;
  assert.equal(app.resourceStatus,'loading');
  second.resolve([{id:'current',name:'current'}]);await newRead;
  assert.equal(app.resourceDocuments[0].id,'current');assert.equal(app.resourceStatus,'idle');
});

const json = load('src/domain/json-editor.ts');
const { itemEditorRules } = load('src/domain/item-editor.ts');
const { JsonPayloadEditorComponent } = load('src/app/json-payload-editor/json-payload-editor.component.ts');
const { JsonValueEditorComponent } = load('src/app/json-value-editor/json-value-editor.component.ts');
async function payloadEditor(value, options = {}) {
  const editor = new JsonPayloadEditorComponent();
  Object.assign(editor, { value, documentKey: 'one' }, options);
  editor.ngOnChanges({ documentKey: {} });
  await Promise.resolve();
  return editor;
}

test('Commands: payload and other field errors independently block saving and preserve input', async () => {
  const app = appWith();
  await app.setActiveKind('commands');
  const raw = '{ "name": "test", "payload": null, "lambdas": ["lambda ctx: True"] }';
  app.updateRawJson(raw);
  const key = app.editorIdentity;
  const editor = await payloadEditor(app.jsonFieldValue('payload'), { documentKey: key, requireObject: true });
  editor.stateChange.listener = state => app.updateJsonField('payload', state, key);
  app.updateJsonField('payload', editor.stateChange.last, key);
  assert.equal(app.resourceDraftText, raw);
  assert.equal(app.resourceDraft.payload, null);

  editor.switchMode('json');
  editor.editRaw('[]');
  app.updateFieldValidity(true);
  app.updateFieldValidity(false);
  assert.equal(app.saveBlocked, true);
  assert.equal(editor.rawText, '[]');
  assert.equal(app.resourceDraft.payload, null);

  app.updateFieldValidity(true);
  editor.editRaw('{"nested":[false,null,2]}');
  assert.equal(app.saveBlocked, true);
  app.updateFieldValidity(false);
  assert.equal(app.saveBlocked, false);
  assert.deepEqual(app.createRequest.body.payload, { nested: [false, null, 2] });
  assert.deepEqual(app.createRequest.body.lambdas, ['lambda ctx: True']);

  app.updateRawJson('{"name":"test","lambdas":[{}]}');
  assert.match(app.rawJsonError, /\/lambdas\/0/);
  assert.equal(app.saveBlocked, true);
  app.updateRawJson('{"name":"test","payload":{"replacement":true}}');
  app.updateJsonField('payload', editor.stateChange.last, key);
  assert.deepEqual(app.resourceDraft.payload, { replacement: true });
});

test('Skills: each scoped editor keeps its own validation state and preserves the other fields', async () => {
  const app = appWith();
  await app.setActiveKind('skills');
  app.updateRawJson(JSON.stringify({
    name: 'bash',
    ratingByClass: { warrior: 2 },
    levelByClass: { warrior: 10 },
    fightPlan: { steps: [{ enabled: true, weight: 0.5 }] },
    payload: null,
    guards: [{ predicate: 'lambda ctx: True' }],
  }));
  const key = app.editorIdentity;
  const editors = {};
  for (const field of app.jsonEditorFields) {
    assert.equal(app.structuredFieldNames.includes(field.key), false);
    const editor = await payloadEditor(app.jsonFieldValue(field.key), {
      documentKey: key, requireObject: true, rules: field.rules,
    });
    editor.stateChange.listener = state => app.updateJsonField(field.key, state, key);
    app.updateJsonField(field.key, editor.stateChange.last, key);
    editor.switchMode('json');
    editors[field.key] = editor;
  }
  assert.deepEqual(Object.keys(editors), ['ratingByClass', 'levelByClass', 'fightPlan', 'payload']);
  assert.equal(app.resourceDraft.payload, null);

  editors.ratingByClass.editRaw('{"warrior":1.5}');
  editors.levelByClass.editRaw('{"warrior":"12"}');
  editors.payload.editRaw('{"args":[false,null,3]}');
  assert.equal(app.saveBlocked, true);
  editors.ratingByClass.editRaw('{"warrior":3}');
  assert.equal(app.saveBlocked, true);
  assert.equal(editors.levelByClass.rawText, '{"warrior":"12"}');
  editors.levelByClass.editRaw('{"warrior":12}');
  assert.equal(app.saveBlocked, false);
  assert.deepEqual(app.createRequest.body.ratingByClass, { warrior: 3 });
  assert.deepEqual(app.createRequest.body.levelByClass, { warrior: 12 });
  assert.deepEqual(app.createRequest.body.payload, { args: [false, null, 3] });
  assert.deepEqual(app.createRequest.body.fightPlan, { steps: [{ enabled: true, weight: 0.5 }] });
  assert.deepEqual(app.createRequest.body.guards, [{ predicate: 'lambda ctx: True' }]);

  app.updateRawJson('{"name":"bash","levelByClass":{"warrior":12.5}}');
  assert.match(app.rawJsonError, /\/levelByClass\/warrior.*whole number/);
  assert.equal(app.saveBlocked, true);
});

test('Commands: ordered lambda cards preserve source and row identity across draft echoes', () => {
  const list = new LambdaListComponent({ nativeElement: { querySelector: () => null, querySelectorAll: () => [] } });
  const original = ['lambda ctx: True', 'lambda ctx: True'];
  list.lambdas = original;
  list.ngOnChanges({ lambdas: {} });
  list.lambdasChange.listener = lambdas => {
    list.lambdas = lambdas;
    list.ngOnChanges({ lambdas: {} });
  };
  const first = list.rows[0];
  const source = 'lambda ctx: (\n    ctx.actor\n)  ';
  list.updateSource(first, source);
  list.move(first, 1);
  assert.equal(list.rows[1], first);
  assert.deepEqual(list.lambdas, [original[1], source]);
  list.startDrag({ dataTransfer: { setData() {} } }, first);
  list.drop({ preventDefault() {} }, 0);
  assert.equal(list.rows[0], first);
  assert.deepEqual(list.lambdas, [source, original[1]]);
  list.add();
  list.remove(1);
  assert.deepEqual(list.lambdas, [source, '']);
  assert.equal(original[0], 'lambda ctx: True');
  list.lambdas = ['lambda ctx: None'];
  list.ngOnChanges({ lambdas: {} });
  assert.deepEqual(list.rows.map(row => row.source), ['lambda ctx: None']);
  list.lambdas = undefined;
  list.ngOnChanges({ lambdas: {} });
  assert.equal(list.rows.length, 0);
});

function valueEditor(node, options = {}) {
  const view = new JsonValueEditorComponent({ nativeElement: { querySelector: () => null } });
  Object.assign(view, { node }, options);
  return view;
}
test('JSON editor: all JSON types round-trip without mutating the input or serializing UI keys', async () => {
  const source = { name: 'item', nested: { yes: true, nil: null, list: [1, 'two', false, { child: [] }] } };
  const editor = await payloadEditor(source);
  assert.deepEqual(json.jsonNodeValue(editor.root), source);
  editor.root.children[0].scalar = 'edited';editor.root.children[0].text = 'edited';editor.edited();
  assert.equal(source.name, 'item');
  assert.equal(editor.stateChange.last.value.name, 'edited');
  assert.deepEqual(Object.keys(editor.stateChange.last.value).sort(), ['name','nested']);
  for (const value of [null, true, 42, 'text', [], {}]) {
    const scalar = await payloadEditor(value);
    assert.deepEqual(scalar.stateChange.last.value, value);
  }
});
test('JSON editor: input boundaries reject unsupported, cyclic and non-finite values', async () => {
  const cycle = {};cycle.self=cycle;
  for (const value of [undefined, {x:undefined}, Infinity, NaN, new Date(), cycle, [,,]]) {
    assert.equal(json.isJsonValue(value), false);
    const editor=await payloadEditor(value);
    assert.equal(editor.stateChange.last.status,'invalid');
    assert.equal('value' in editor.stateChange.last,false);
  }
});
test('JSON editor: numeric buffers survive incomplete input and block stale-value emission', async () => {
  const editor=await payloadEditor({cost:12});const cost=editor.root.children[0];
  json.updateJsonScalar(cost,'1e-');editor.edited();
  assert.equal(cost.text,'1e-');assert.equal(cost.scalar,12);
  assert.equal(editor.stateChange.last.status,'invalid');
  assert.equal('value' in editor.stateChange.last,false);
  editor.switchMode('json');assert.equal(editor.mode,'form');
  json.updateJsonScalar(cost,'1e2');editor.edited();
  assert.equal(editor.stateChange.last.value.cost,100);
});
test('JSON editor: raw errors retain exact text and recover into the form', async () => {
  const editor=await payloadEditor({enabled:true});editor.switchMode('json');
  editor.editRaw('{invalid');
  assert.equal(editor.rawText,'{invalid');assert.equal(editor.stateChange.last.status,'invalid');
  editor.switchMode('form');assert.equal(editor.mode,'json');
  editor.editRaw('{"enabled":false,"values":[null,3,"4"]}');
  editor.switchMode('form');
  assert.equal(editor.mode,'form');
  assert.deepEqual(editor.stateChange.last.value,{enabled:false,values:[null,3,'4']});
});
test('JSON editor: read-only IDs are protected in JSON and structural actions', async () => {
  const editor=await payloadEditor({id:'existing',name:'item'},{readOnlyPaths:['/id'],requireObject:true});
  editor.switchMode('json');editor.editRaw('{"id":"changed","name":"item"}');
  assert.equal(editor.stateChange.last.status,'invalid');
  assert.equal(editor.issues[0].path,'/id');
  editor.editRaw('{"name":"item"}');assert.equal(editor.stateChange.last.status,'invalid');
  editor.editRaw('{"id":"existing","name":"edited"}');assert.equal(editor.stateChange.last.status,'valid');
  const view=valueEditor(editor.root,{options:editor.options});
  view.remove(editor.root.children[0],0);
  assert.equal(json.jsonNodeValue(editor.root).id,'existing');
  assert.equal(view.structureLocked,true);
});
test('JSON editor: echo updates preserve row identity and in-progress numeric text', async () => {
  const editor=await payloadEditor({n:1});const root=editor.root,id=root.children[0].id;
  json.updateJsonScalar(root.children[0],'2');editor.edited();
  editor.value=editor.stateChange.last.value;editor.ngOnChanges({value:{}});
  assert.equal(editor.root,root);assert.equal(editor.root.children[0].id,id);
  json.updateJsonScalar(root.children[0],'-');editor.edited();
  editor.readonly=true;editor.ngOnChanges({readonly:{}});
  assert.equal(editor.root.children[0].text,'-');
  editor.documentKey='two';editor.value={n:3};editor.ngOnChanges({documentKey:{},value:{}});
  await Promise.resolve();
  assert.equal(editor.root.children[0].text,'3');assert.equal(editor.invalid,false);assert.equal(editor.dirty,false);
});
test('JSON editor: external updates cannot silently replace dirty state', async () => {
  const editor=await payloadEditor({name:'old'});
  editor.root.children[0].scalar='local';editor.edited();
  editor.value={name:'incoming'};editor.ngOnChanges({value:{}});await Promise.resolve();
  assert.equal(editor.hasIncomingValue,true);
  assert.equal(editor.stateChange.last.status,'invalid');
  assert.equal(json.jsonNodeValue(editor.root).name,'local');
  editor.keepDraft();assert.equal(editor.stateChange.last.value.name,'local');
  editor.value={name:'next'};editor.ngOnChanges({value:{}});await Promise.resolve();editor.loadIncoming();await Promise.resolve();
  assert.equal(editor.stateChange.last.value.name,'next');assert.equal(editor.dirty,false);
});
test('JSON editor: array editing preserves row IDs, order and nested data', async () => {
  const editor=await payloadEditor(['first',{nested:[true,null]}]);
  const view=valueEditor(editor.root);view.edited.listener=()=>editor.edited();
  const moved=editor.root.children[1];view.move(1,-1);
  assert.equal(editor.root.children[0],moved);
  assert.deepEqual(editor.stateChange.last.value,[{nested:[true,null]},'first']);
  view.remove(editor.root.children[1],1);
  assert.deepEqual(editor.stateChange.last.value,[{nested:[true,null]}]);
  view.newType='boolean';view.add();
  assert.deepEqual(editor.stateChange.last.value,[{nested:[true,null]},false]);
});
test('JSON editor: duplicate property names are rejected; JSON pointer keys and prototype names are preserved', async () => {
  const source=JSON.parse('{"a/b~c":null,"__proto__":{"safe":true}}');
  const editor=await payloadEditor(source);const view=valueEditor(editor.root);
  view.newKey='a/b~c';view.newType='string';view.add();
  assert.equal(editor.root.children.length,2);assert.match(view.actionError,/already exists/);
  view.newKey='new';view.newType='object';view.add();
  assert.equal(editor.root.children.length,3);
  view.renameText='renamed';view.rename(editor.root.children[0],0);
  assert.equal(editor.root.children[0].key,'renamed');
  assert.equal(json.jsonPointer('', 'a/b~c'),'/a~1b~0c');
  assert.equal(Object.prototype.safe,undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(json.jsonNodeValue(editor.root),'__proto__'),true);
});
test('JSON editor: explicit type replacement preserves identity and removes old contents', () => {
  const node=json.createJsonNode({nested:[1,2]});const id=node.id;
  json.setJsonNodeType(node,'boolean');
  assert.equal(node.id,id);assert.equal(json.jsonNodeValue(node),false);
  json.setJsonNodeType(node,'array');assert.deepEqual(json.jsonNodeValue(node),[]);
});
test('Items adapter: existing string arrays, string flags and integer scalars keep their contracts', async () => {
  const editor=await payloadEditor({vnum:'001',extraFlags:'0',cost:12,affectData:[],extraDescription:[]},{rules:itemEditorRules,requireObject:true});
  const affects=editor.root.children.find(n=>n.key==='affectData');
  const view=valueEditor(affects,{path:'/affectData',rule:itemEditorRules['/affectData'],options:editor.options});
  view.startAdd();assert.equal(view.newType,'string');assert.deepEqual(view.addTypes,['string']);
  editor.switchMode('json');editor.editRaw('{"cost":"12","affectData":[{"wrong":true}]}');
  assert.equal(editor.stateChange.last.status,'invalid');
  assert.ok(editor.issues.some(issue=>issue.path==='/cost'));
  assert.ok(editor.issues.some(issue=>issue.path==='/affectData/0'));
  editor.editRaw('{"cost":12,"vnum":"001","extraFlags":"0","affectData":["A 1 2"]}');
  assert.equal(editor.stateChange.last.status,'valid');
  const numeric=valueEditor(json.createJsonNode(1),{rule:itemEditorRules['/cost']});
  numeric.scalarChanged('1.5');assert.match(numeric.node.error,/whole number/);
});
test('Items integration: reverting to the original value updates the parent and saved payload', async () => {
  let saved;
  const app=appWith({save:async(_base,_proxy,_endpoint,payload)=>{saved=payload;return {...payload,id:'created'};}});
  app.activeKind='items';app.replaceDraft({areaId:'A',name:'original',cost:1});
  const editor=await payloadEditor(app.resourceDraft,{rules:itemEditorRules,requireObject:true});
  editor.stateChange.listener=state=>app.updatePayloadEditor(state);
  const name=editor.root.children.find(n=>n.key==='name');
  json.updateJsonScalar(name,'changed');editor.edited();
  assert.equal(app.resourceDraft.name,'changed');
  json.updateJsonScalar(name,'original');editor.edited();
  assert.equal(editor.stateChange.last.dirty,false);assert.equal(app.resourceDraft.name,'original');
  await app.saveActiveDocument();assert.equal(saved.name,'original');
});
test('Items integration: invalid editor state blocks writes and navigation respects Stay', async () => {
  let writes=0;const app=appWith({save:async()=>{writes++;}});app.activeKind='items';
  app.replaceDraft({areaId:'A',name:'item',cost:1});
  const editor=await payloadEditor(app.resourceDraft,{rules:itemEditorRules});
  editor.stateChange.listener=state=>app.updatePayloadEditor(state);
  editor.switchMode('json');editor.editRaw('{invalid');
  await app.saveActiveDocument();assert.equal(writes,0);assert.equal(app.isDirty,true);assert.equal(app.saveBlocked,true);
  const nav=app.setActiveKind('rooms');app.finishDraftDecision(false);await nav;
  assert.equal(app.activeKind,'items');assert.equal(editor.rawText,'{invalid');
});
test('Items integration: new/existing saves preserve nested unknown data and use POST/PUT respectively', async () => {
  for (const existing of [false,true]) {
    let request;
    const app=appWith({save:async(_base,_proxy,endpoint,payload,isExisting)=>{request={endpoint,payload,isExisting};return {...payload,id:'record'};}});
    app.activeKind='items';app.replaceDraft({areaId:'A',name:'item',...(existing?{id:'record'}:{})},existing?'record':'new');
    const extra={nested:[true,null,{enabled:false}],number:3};
    app.updatePayloadEditor({status:'valid',dirty:true,value:{...app.resourceDraft,extra}});
    await app.saveActiveDocument();
    assert.equal(request.isExisting,existing);
    assert.equal(request.endpoint,existing?'/api/v1/items/record':'/api/v1/items');
    assert.deepEqual(request.payload.extra,extra);
  }
});

test('JSON editor: protected array positions cannot be shifted by structural editing', async () => {
  const editor=await payloadEditor(['first','protected','last'],{readOnlyPaths:['/1']});
  const view=valueEditor(editor.root,{options:editor.options});
  view.move(0,1);view.remove(editor.root.children[0],0);view.newType='string';view.add();
  assert.deepEqual(json.jsonNodeValue(editor.root),['first','protected','last']);
});
test('JSON editor: object-only documents reject scalar and array raw input without losing the correction buffer', async () => {
  const editor=await payloadEditor({name:'item'},{requireObject:true});editor.switchMode('json');
  for (const text of ['null','[]','"text"','123']) {
    editor.editRaw(text);assert.equal(editor.rawText,text);assert.equal(editor.stateChange.last.status,'invalid');
  }
  editor.editRaw('{"name":"repaired"}');editor.switchMode('form');
  assert.equal(editor.stateChange.last.value.name,'repaired');
});

const { mobileEditorRules, roomEditorRules } = load('src/domain/world-resource-editor.ts');
const { emptyMobileDraft, emptyRoomDraft } = load('src/domain/constants.ts');
for (const [kind, defaults, rules] of [['mobiles',emptyMobileDraft,mobileEditorRules],['rooms',emptyRoomDraft,roomEditorRules]]) {
  test(kind + ': defaults and editor selection follow their backend field types', async () => {
    const app=appWith();app.activeKind=kind;app.selectedResourceAreaId='A';
    await app.createNewResource();
    assert.equal(app.usesJsonPayloadEditor(),true);
    assert.equal(app.payloadEditorLabel,kind==='rooms'?'Room':'Mobile');
    assert.equal(app.payloadEditorRules,rules);
    const editor=await payloadEditor(app.resourceDraft,{rules,requireObject:true,readOnlyPaths:['/id']});
    assert.equal(editor.stateChange.last.status,'valid');
    assert.equal(app.resourceDraft.areaId,'A');
    if(kind==='mobiles') { assert.equal(typeof app.resourceDraft.flags,'string');assert.deepEqual(app.resourceDraft.statusFlags,{}); }
    else { assert.equal(typeof app.resourceDraft.pvp,'boolean');assert.deepEqual(app.resourceDraft.exits,[]); }
  });
  test(kind + ': new and existing saves preserve structured content and use their own collection', async () => {
    for(const existing of [false,true]) {
      let sent;const app=appWith({save:async(_base,_proxy,endpoint,payload,isExisting)=>{sent={endpoint,payload,isExisting};return {...payload,id:'record'};}});
      app.activeKind=kind;
      const value={...structuredClone(defaults),areaId:'A',name:'record',...(existing?{id:'record'}:{})};
      if(kind==='rooms') { value.exits=['{"direction": 0, "to_room_vnum": 42}'];value.mobiles={'mob/a':'002'}; }
      else { value.flags='AB';value.statusFlags={awake:true,nested:{count:3,optional:null,list:[false,2]}}; }
      value.extension={preserved:[true,null,'text']};
      app.replaceDraft(value,existing?'record':'new');
      const editor=await payloadEditor(app.resourceDraft,{rules,requireObject:true,readOnlyPaths:['/id']});
      editor.stateChange.listener=state=>app.updatePayloadEditor(state);
      const name=editor.root.children.find(n=>n.key==='name');json.updateJsonScalar(name,'edited');editor.edited();
      await app.saveActiveDocument();
      assert.equal(sent.endpoint,'/api/v1/'+kind+(existing?'/record':''));assert.equal(sent.isExisting,existing);
      assert.deepEqual(sent.payload.extension,value.extension);
      if(kind==='rooms') { assert.deepEqual(sent.payload.exits,value.exits);assert.deepEqual(sent.payload.mobiles,value.mobiles); }
      else { assert.equal(sent.payload.flags,'AB');assert.deepEqual(sent.payload.statusFlags,value.statusFlags); }
    }
  });
  test(kind + ': invalid JSON and malformed contract values block writes and preserve corrections', async () => {
    let writes=0;const app=appWith({save:async()=>{writes++;}});app.activeKind=kind;
    app.replaceDraft({...structuredClone(defaults),areaId:'A',name:'draft'});
    const editor=await payloadEditor(app.resourceDraft,{rules,requireObject:true});
    editor.stateChange.listener=state=>app.updatePayloadEditor(state);editor.switchMode('json');editor.editRaw('{invalid');
    await app.saveActiveDocument();assert.equal(writes,0);assert.equal(app.saveBlocked,true);
    const invalid={...structuredClone(defaults),areaId:'A',name:'draft'};
    if(kind==='rooms') { invalid.exits=[{direction:0}];invalid.mobiles={bad:2}; }
    else { invalid.flags=0;invalid.statusFlags=0; }
    editor.editRaw(JSON.stringify(invalid));assert.equal(editor.stateChange.last.status,'invalid');
    await app.saveActiveDocument();assert.equal(writes,0);
    editor.editRaw(JSON.stringify({...structuredClone(defaults),areaId:'A',name:'repaired'}));
    assert.equal(app.resourceDraft.name,'repaired');assert.equal(app.saveBlocked,false);
  });
  test(kind + ': save failure retains edits and area cancellation retains the draft', async () => {
    const app=appWith({save:async()=>{throw Error('fixture failure');}});app.activeKind=kind;app.selectedResourceAreaId='A';
    app.replaceDraft({...structuredClone(defaults),areaId:'A',name:'record'});
    app.updatePayloadEditor({status:'valid',dirty:true,value:{...app.resourceDraft,name:'unsaved'}});
    await app.saveActiveDocument();assert.equal(app.resourceDraft.name,'unsaved');assert.match(app.resourceMessage,/fixture failure/);
    const select={value:'B'},change=app.onAreaFilterChange('B',select);app.finishDraftDecision(false);await change;
    assert.equal(select.value,'A');assert.equal(app.resourceDraft.name,'unsaved');
  });
}
test('Room mobile-map editing inserts strings and reports typed-member errors by path', async () => {
  const editor=await payloadEditor({mobiles:{'a/b':'001'}},{rules:roomEditorRules});
  const node=editor.root.children[0];const view=valueEditor(node,{path:'/mobiles',options:editor.options,rule:roomEditorRules['/mobiles']});
  assert.deepEqual(view.addTypes,['string']);view.startAdd();assert.equal(view.newType,'string');
  view.newKey='second';view.add();assert.deepEqual(json.jsonNodeValue(node),{'a/b':'001',second:''});
  assert.equal(view.childRule(node.children[1],1).type,'string');
  editor.switchMode('json');editor.editRaw('{"mobiles":{"a/b":false}}');
  assert.equal(editor.issues[0].path,'/mobiles/a~1b');
});
test('Switching between JSON resource kinds resets buffers and selects the new rules', async () => {
  const app=appWith();app.activeKind='mobiles';app.replaceDraft({...structuredClone(emptyMobileDraft),areaId:'A',name:'mobile'});
  const editor=await payloadEditor(app.resourceDraft,{rules:mobileEditorRules});
  editor.stateChange.listener=state=>app.updatePayloadEditor(state);editor.switchMode('json');editor.editRaw('{invalid');
  const navigation=app.setActiveKind('rooms');app.finishDraftDecision(false);await navigation;
  assert.equal(app.activeKind,'mobiles');assert.equal(editor.rawText,'{invalid');
  await discard(app,()=>app.setActiveKind('rooms'));
  editor.value=app.resourceDraft;editor.rules=app.payloadEditorRules;editor.documentKey='room';editor.ngOnChanges({documentKey:{},value:{},rules:{}});await Promise.resolve();
  assert.equal(editor.mode,'form');assert.equal(app.fieldJsonInvalid,false);assert.equal(app.payloadEditorRules,roomEditorRules);
});

test('Late editor emissions cannot modify another resource document', async () => {
  const app=appWith();app.activeKind='mobiles';app.replaceDraft({...structuredClone(emptyMobileDraft),areaId:'A',name:'mobile'});
  const oldKey=app.editorIdentity;
  await app.setActiveKind('rooms');
  app.updatePayloadEditor({status:'valid',dirty:true,value:{areaId:'A',name:'late mobile'}},oldKey);
  app.updatePayloadEditor({status:'invalid',dirty:true,issues:[{path:'',message:'old error'}]},oldKey);
  assert.equal(app.activeKind,'rooms');assert.equal(app.resourceDraft.name,'');assert.equal(app.fieldJsonInvalid,false);
});

const { JsonStringEditorComponent } = load('src/app/json-string-editor/json-string-editor.component.ts');
async function exitEditor(source) {
  const adapter=new JsonStringEditorComponent();adapter.node=json.createJsonNode(source);adapter.label='exits item 1';
  adapter.ngOnChanges({node:{}});await Promise.resolve();return adapter;
}
test('Embedded exit: initialization and unchanged edits preserve the exact serialized source', async () => {
  const source='{ "direction": 0, "description": "Keep spacing", "extra": {"values":[true,null,3]} }';
  const adapter=await exitEditor(source);
  assert.deepEqual(adapter.innerValue,JSON.parse(source));assert.equal(adapter.node.scalar,source);
  adapter.updateInner({status:'valid',dirty:false,value:structuredClone(adapter.innerValue)});
  assert.equal(adapter.node.scalar,source);assert.equal(adapter.edited.last,undefined);
});
test('Embedded exit: changed typed fields encode to a string; reverting restores original bytes', async () => {
  const source='{ "direction": 0, "extra": { "flag": false, "list": [null, 2] } }';const adapter=await exitEditor(source);
  adapter.updateInner({status:'valid',dirty:true,value:{...adapter.innerValue,direction:1}});
  assert.equal(typeof adapter.node.scalar,'string');assert.equal(JSON.parse(adapter.node.scalar).direction,1);
  assert.deepEqual(JSON.parse(adapter.node.scalar).extra,JSON.parse(source).extra);
  adapter.updateInner({status:'valid',dirty:false,value:JSON.parse(source)});
  assert.equal(adapter.node.scalar,source);
});
test('Embedded exit: invalid child buffers prevent saving the old string and recover on correction', async () => {
  let writes=0;const source='{"direction":0,"description":"Original"}';
  const app=appWith({save:async()=>{writes++;}});app.activeKind='rooms';app.replaceDraft({...structuredClone(emptyRoomDraft),areaId:'A',name:'room',exits:[source]});
  const outer=await payloadEditor(app.resourceDraft,{rules:roomEditorRules});outer.stateChange.listener=state=>app.updatePayloadEditor(state);
  const adapter=await exitEditor(source);outer.root.children.find(n=>n.key==='exits').children[0]=adapter.node;
  adapter.edited.listener=()=>outer.edited();
  const inner=await payloadEditor(adapter.innerValue,{requireObject:true});inner.stateChange.listener=state=>adapter.updateInner(state);
  const direction=inner.root.children.find(n=>n.key==='direction');json.updateJsonScalar(direction,'1e-');inner.edited();
  assert.match(adapter.node.error,/finite JSON number/);assert.equal(adapter.node.scalar,source);
  await app.saveActiveDocument();assert.equal(writes,0);assert.equal(app.saveBlocked,true);
  json.updateJsonScalar(direction,'2');inner.edited();
  assert.equal(app.saveBlocked,false);assert.equal(JSON.parse(app.resourceDraft.exits[0]).direction,2);
});
test('Embedded exit: malformed source is retained, explicitly corrected, and scalar roots are rejected', async () => {
  const adapter=await exitEditor('{broken');assert.equal(adapter.innerValue,undefined);assert.equal(adapter.sourceText,'{broken');assert.ok(adapter.node.error);
  adapter.updateSource('[]');adapter.applySource();assert.equal(adapter.sourceText,'[]');assert.ok(adapter.node.error);assert.equal(adapter.node.scalar,'{broken');
  adapter.updateSource('{"direction":1,"custom":{"enabled":true}}');
  assert.equal(adapter.node.scalar,'{broken');adapter.applySource();
  assert.equal(adapter.node.error,'');assert.equal(adapter.innerValue.direction,1);
  assert.deepEqual(JSON.parse(adapter.node.scalar).custom,{enabled:true});
});
test('Embedded exit: new entries start as JSON objects while normal string arrays stay unchanged', async () => {
  const exits=json.createJsonNode([]);const view=valueEditor(exits,{path:'/exits',rule:roomEditorRules['/exits']});
  view.startAdd();view.add();assert.equal(exits.children[0].scalar,'{}');
  assert.equal(view.childRule(exits.children[0],0).stringFormat,'json-object');
  const items=valueEditor(json.createJsonNode([]),{rule:itemEditorRules['/affectData']});items.startAdd();items.add();
  assert.equal(items.node.children[0].scalar,'');assert.equal(items.childRule(items.node.children[0],0).stringFormat,undefined);
});
test('Embedded exit: raw Room JSON validates the inner document and retains the serialized list contract', async () => {
  const editor=await payloadEditor({exits:['{}']},{rules:roomEditorRules});editor.switchMode('json');
  for(const entry of ['{invalid','null','[]','123',"{'direction':0}"]) {
    editor.editRaw(JSON.stringify({exits:[entry]}));assert.equal(editor.stateChange.last.status,'invalid');assert.equal(editor.issues[0].path,'/exits/0');
    assert.equal(JSON.parse(editor.rawText).exits[0],entry);
  }
  editor.editRaw(JSON.stringify({exits:['{"direction":2}']}));assert.equal(editor.stateChange.last.status,'valid');
  assert.equal(editor.stateChange.last.value.exits[0],'{"direction":2}');
  editor.editRaw('{"exits":[{"direction":2}]}');assert.equal(editor.stateChange.last.status,'invalid');
});
test('Embedded exit: reordering retains invalid row identity and reports its current array path', async () => {
  const editor=await payloadEditor({exits:['{"direction":0}','{"direction":1}']},{rules:roomEditorRules});
  const exits=editor.root.children[0],first=exits.children[0];first.error='Nested correction required';
  const view=valueEditor(exits,{path:'/exits',rule:roomEditorRules['/exits']});view.edited.listener=()=>editor.edited();
  view.move(0,1);assert.equal(exits.children[1],first);assert.equal(editor.issues[0].path,'/exits/1');
});
test('Embedded exit: read-only state and document replacement cannot leak old edits', async () => {
  const adapter=await exitEditor('{"direction":0}');adapter.readonly=true;
  adapter.updateInner({status:'valid',dirty:true,value:{direction:2}});adapter.updateSource('{broken');
  assert.equal(adapter.node.scalar,'{"direction":0}');
  adapter.readonly=false;adapter.node=json.createJsonNode('{"direction":3}');adapter.ngOnChanges({node:{}});await Promise.resolve();
  assert.equal(adapter.innerValue.direction,3);assert.equal(adapter.sourceText,'{"direction":3}');
});
test('Embedded exit: mocked Room saves submit strings and preserve untouched neighboring exits', async () => {
  const first='{ "direction": 0, "extra": [true,null] }',second='{ "direction": 2 }';let payload;
  const app=appWith({save:async(_base,_proxy,_endpoint,value)=>{payload=value;return {...value,id:'room'};}});
  app.activeKind='rooms';app.replaceDraft({...structuredClone(emptyRoomDraft),id:'room',areaId:'A',name:'room',exits:[first,second]},'room');
  const outer=await payloadEditor(app.resourceDraft,{rules:roomEditorRules});outer.stateChange.listener=state=>app.updatePayloadEditor(state);
  const adapter=await exitEditor(first);outer.root.children.find(n=>n.key==='exits').children[0]=adapter.node;adapter.edited.listener=()=>outer.edited();
  adapter.updateInner({status:'valid',dirty:true,value:{direction:1,extra:[true,null]}});await app.saveActiveDocument();
  assert.equal(typeof payload.exits[0],'string');assert.equal(JSON.parse(payload.exits[0]).direction,1);assert.equal(payload.exits[1],second);
});

const { specialEditorRules } = load('src/domain/world-resource-editor.ts');
test('Specials: lambda rows use code editors with ordered labels and preserved source text', async () => {
  const lambdas=["lambda ctx: ctx.require_position('standing')",'lambda ctx: (\n    ctx.say("hello")\n)'];
  const editor=await payloadEditor({areaId:'A',specialFunction:lambdas},{rules:specialEditorRules});
  const root=valueEditor(editor.root,{options:editor.options});const functions=editor.root.children.find(n=>n.key==='specialFunction');
  assert.equal(root.childLabel(functions,1),'Special Function');
  const list=valueEditor(functions,{path:'/specialFunction',rule:specialEditorRules['/specialFunction'],options:editor.options});
  assert.equal(list.childLabel(functions.children[0],0),'Lambda 1');
  const rule=list.childRule(functions.children[0],0);assert.equal(rule.editor,'code');assert.equal(rule.type,'string');assert.equal(rule.stringFormat,undefined);
  const row=valueEditor(functions.children[0],{rule});assert.equal(row.codeEditor,true);assert.equal(row.embeddedJson,false);
  row.edited.listener=()=>editor.edited();row.scalarChanged('lambda ctx: ctx.say("changed")\n');
  assert.equal(editor.stateChange.last.value.specialFunction[0],'lambda ctx: ctx.say("changed")\n');
  assert.equal(editor.stateChange.last.value.specialFunction[1],lambdas[1]);
});
test('Specials: add, reorder and remove operate on the exact ordered string list', async () => {
  const node=json.createJsonNode(['lambda ctx: True','lambda ctx: False']);
  const list=valueEditor(node,{path:'/specialFunction',rule:specialEditorRules['/specialFunction']});
  const first=node.children[0];list.addCodeEntry();assert.equal(node.children.length,3);assert.equal(node.children[2].scalar,'');
  list.move(0,1);assert.equal(node.children[1],first);assert.deepEqual(json.jsonNodeValue(node),['lambda ctx: False','lambda ctx: True','']);
  list.remove(node.children[2],2);assert.deepEqual(json.jsonNodeValue(node),['lambda ctx: False','lambda ctx: True']);
  list.readonly=true;list.addCodeEntry();assert.equal(node.children.length,2);
});
test('Specials: new and existing saves keep lambda strings and select the Specials endpoint', async () => {
  for(const existing of [false,true]) {
    let sent;const app=appWith({save:async(_base,_proxy,endpoint,payload,isExisting)=>{sent={endpoint,payload,isExisting};return {...payload,id:'special'};}});
    app.activeKind='specials';const source=["lambda ctx: ctx.require_position('fighting')",'lambda ctx: ctx.say("hello")\n'];
    app.replaceDraft({areaId:'A',mobVnum:'001',name:'spec_custom',comment:'note',specialFunction:source},existing?'special':'new');
    assert.equal(app.usesJsonPayloadEditor(),true);assert.equal(app.payloadEditorLabel,'Special');assert.equal(app.payloadEditorRules,specialEditorRules);
    const editor=await payloadEditor(app.resourceDraft,{rules:specialEditorRules});editor.stateChange.listener=state=>app.updatePayloadEditor(state);
    const comment=editor.root.children.find(n=>n.key==='comment');json.updateJsonScalar(comment,'changed');editor.edited();
    await app.saveActiveDocument();assert.equal(sent.isExisting,existing);assert.equal(sent.endpoint,existing?'/api/v1/specials/special':'/api/v1/specials');
    assert.deepEqual(sent.payload.specialFunction,source);assert.equal(sent.payload.mobVnum,'001');
  }
});
test('Specials: invalid JSON and non-string lambda entries block saves without losing text', async () => {
  let writes=0;const app=appWith({save:async()=>{writes++;}});app.activeKind='specials';app.replaceDraft({areaId:'A',specialFunction:['lambda ctx: True']});
  const editor=await payloadEditor(app.resourceDraft,{rules:specialEditorRules});editor.stateChange.listener=state=>app.updatePayloadEditor(state);
  editor.switchMode('json');editor.editRaw('{broken');await app.saveActiveDocument();assert.equal(writes,0);assert.equal(editor.rawText,'{broken');
  editor.editRaw('{"areaId":"A","specialFunction":[{"lambda":"text"}]}');assert.equal(editor.issues[0].path,'/specialFunction/0');await app.saveActiveDocument();assert.equal(writes,0);
  editor.editRaw('{"areaId":"A","specialFunction":["lambda ctx: False"]}');assert.equal(app.fieldJsonInvalid,false);assert.equal(app.resourceDraft.specialFunction[0],'lambda ctx: False');
});

const { gameEditorRules } = load('src/domain/game-editor.ts');
const gameFixture={id:'ruleset-id',kind:'ruleset',status:'active',version:{family:'ROM',lineage:['ROM24'],semver:'1.0',createdAt:'2026-01-01T00:00:00Z',notes:'sample'},enums:{directions:{north:0,east:1}},classes:{mage:{enabled:true,bonuses:[1,null,'text']}},combat:{damage:{multipliers:[1,2,3]}},groupRewards:{default:{value:4}},clans:{one:{title:'One'}},integrity:{contentHash:'hash',build:{source:'fixture',toolVersion:'1',extra:{flag:false}}},denyList:['example'],custom:{unknown:[true,null,4]}};
test('Game Data: top-level loading uses the game endpoint and preserves the entire ruleset', async () => {
  let endpoint;const app=appWith({list:async(_base,_proxy,path)=>{endpoint=path;return [structuredClone(gameFixture)];}});app.activeKind='game';
  assert.equal(app.usesJsonPayloadEditor(),true);assert.equal(app.payloadEditorLabel,'Game Data');assert.equal(app.payloadEditorRules,gameEditorRules);
  assert.equal(app.requiresAreaFilter(),false);await app.loadActiveDocuments(false);assert.equal(endpoint,'/api/v1/game');
  await app.selectResource('ruleset-id');assert.deepEqual(app.resourceDraft.custom,gameFixture.custom);assert.deepEqual(app.resourceDraft.combat,gameFixture.combat);
  const editor=await payloadEditor(app.resourceDraft,{rules:gameEditorRules,requireObject:true,readOnlyPaths:['/id']});
  assert.equal(editor.stateChange.last.status,'valid');assert.deepEqual(editor.stateChange.last.value.groupRewards,gameFixture.groupRewards);
});
test('Game Data: nested edits preserve unrelated tables, unknown fields and scalar types', async () => {
  const app=appWith();app.activeKind='game';app.replaceDraft(structuredClone(gameFixture),'ruleset-id');
  const editor=await payloadEditor(app.resourceDraft,{rules:gameEditorRules,requireObject:true,readOnlyPaths:['/id']});editor.stateChange.listener=state=>app.updatePayloadEditor(state);
  const classes=editor.root.children.find(n=>n.key==='classes'),mage=classes.children[0],enabled=mage.children.find(n=>n.key==='enabled');
  enabled.scalar=false;editor.edited();
  assert.equal(app.resourceDraft.classes.mage.enabled,false);assert.deepEqual(app.resourceDraft.custom,gameFixture.custom);
  assert.deepEqual(app.resourceDraft.enums,gameFixture.enums);assert.deepEqual(app.resourceDraft.integrity,gameFixture.integrity);
  assert.deepEqual(JSON.parse(app.resourceDraftText).classes.mage.bonuses,[1,null,'text']);
});
test('Game Data: malformed JSON and incorrect section types retain editable text and recover', async () => {
  const app=appWith();app.activeKind='game';app.replaceDraft(structuredClone(gameFixture),'ruleset-id');
  const editor=await payloadEditor(app.resourceDraft,{rules:gameEditorRules,readOnlyPaths:['/id']});editor.stateChange.listener=state=>app.updatePayloadEditor(state);editor.switchMode('json');
  editor.editRaw('{invalid');assert.equal(app.fieldJsonInvalid,true);assert.equal(editor.rawText,'{invalid');assert.equal(app.resourceDraft.id,'ruleset-id');
  editor.editRaw(JSON.stringify({...gameFixture,enums:[]}));assert.ok(editor.issues.some(x=>x.path==='/enums'));
  editor.editRaw(JSON.stringify({...gameFixture,version:{...gameFixture.version,lineage:[12]}}));assert.ok(editor.issues.some(x=>x.path==='/version/lineage/0'));
  editor.editRaw(JSON.stringify({...gameFixture,status:'draft'}));assert.equal(app.fieldJsonInvalid,false);assert.equal(app.resourceDraft.status,'draft');
});
test('Game Data: ID protection and local edits respect Stay and Discard', async () => {
  const app=appWith();app.activeKind='game';app.replaceDraft(structuredClone(gameFixture),'ruleset-id');
  const editor=await payloadEditor(app.resourceDraft,{rules:gameEditorRules,readOnlyPaths:['/id']});editor.stateChange.listener=state=>app.updatePayloadEditor(state);editor.switchMode('json');
  editor.editRaw(JSON.stringify({...gameFixture,id:'changed'}));assert.equal(editor.stateChange.last.status,'invalid');
  const navigation=app.setActiveKind('rooms');app.finishDraftDecision(false);await navigation;assert.equal(app.activeKind,'game');
  assert.equal(JSON.parse(editor.rawText).id,'changed');await discard(app,()=>app.setActiveKind('rooms'));assert.equal(app.activeKind,'rooms');assert.equal(app.fieldJsonInvalid,false);
});
test('Game Data: unsupported write methods never reach the API for new or loaded documents', async () => {
  for(const existing of [false,true]) {
    let writes=0;const app=appWith({save:async()=>{writes++;}});app.activeKind='game';app.replaceDraft({...structuredClone(gameFixture),...(existing?{}:{id:undefined})},existing?'ruleset-id':'new');
    assert.equal(app.saveBlocked,true);await app.saveActiveDocument();assert.equal(writes,0);assert.match(app.resourceMessage,/supports loading only/);
    assert.match(app.createRequest.blocked,/supports loading only/);
  }
});
test('Game Data: selecting a different document closes its optional JSON preview', async () => {
  const app=appWith();app.activeKind='game';app.resourceDocuments=[structuredClone(gameFixture),{...structuredClone(gameFixture),id:'second'}];
  await app.selectResource('ruleset-id');app.gamePreviewExpanded=true;await app.selectResource('second');assert.equal(app.gamePreviewExpanded,false);assert.equal(app.selectedResourceId,'second');
});
