import { Worker, NearAccount } from 'near-workspaces';
import anyTest, { TestFn } from 'ava';

const test = anyTest as TestFn<{
  worker: Worker;
  accounts: Record<string, NearAccount>;
}>;

test.beforeEach(async (t) => {
  // Init the worker and start a Sandbox server
  const worker = await Worker.init();

  // Deploy contract
  const root = worker.rootAccount;
  const dvRegistry = await root.createSubAccount('dv-registry');
  const scaffold = await root.createSubAccount('scaffold')

  // Get wasm file path from package.json test script in folder above
  await dvRegistry.deploy(
    process.argv[2],
  );

  await scaffold.deploy(
    "./contract/build/Scaffold.wasm"
  )

  await root.call(dvRegistry, "init", {
    _oracle: root.accountId,
  });

  await root.call(scaffold, "init", {
    _registry: dvRegistry.accountId,
  })
  // Save state for test runs, it is unique for each test
  t.context.worker = worker;
  t.context.accounts = { root, dvRegistry, scaffold };
});

test.afterEach.always(async (t) => {
  // Stop Sandbox server
  await t.context.worker.tearDown().catch((error) => {
    console.log('Failed to stop the Sandbox:', error);
  });
});

test('gets the owner', async(t) => {
  const { root, dvRegistry } = t.context.accounts;
  const owner: string = await dvRegistry.view('getOwner', {});
  t.is(owner, root.accountId);
})

test('sets the owner', async(t) => {
  const { root, dvRegistry } = t.context.accounts;
  const o = await root.createSubAccount("o");
  await root.call(dvRegistry, 'setOwner', { _owner: o.accountId });
  const owner: string = await dvRegistry.view('getOwner', {});
  t.is(owner, o.accountId);
})

test('setOwner failures', async(t) => {
  const { root, dvRegistry } = t.context.accounts;
  const o = await root.createSubAccount("o");
  const error1 = await t.throwsAsync(() => o.call(dvRegistry, 'setOwner', { _owner: o.accountId}));
  t.assert(error1?.message?.includes(`Unauthorized`));
})

// test('gets the oracle', async(t) => {
//   const { root, contract } = t.context.accounts;
//   const status: boolean = await contract.view('getOracle', { _oracle: root.accountId });
//   t.is(status, true);
// })

// test('sets the oracle', async(t) => {
//   const { root, contract } = t.context.accounts;
//   await root.call(contract, 'setOracle', { _isOracle: false });
//   const status: boolean = await contract.view('getOracle', { _oracle: root.accountId });
//   t.is(status, false)
// })

// test('creates a new request from the scaffold', async(t) => {
//   const { root, dvRegistry, scaffold } = t.context.accounts;
//   const 
// })

test('creates a new request', async(t) => {
  const { root, dvRegistry, scaffold } = t.context.accounts;
  const bounty = 10_000_000_000_000
  // await root.call(contract, 'setOracle', { _isOracle: true });
  const data = { _input: "http://h8jmnn0fdld39b2hp1l5v0c6a8.ingress.akt.computer/test", _oracle: root.accountId, _bounty: bounty, _expiresIn: "86400000000000", _callback: scaffold.accountId}
  const id = await root.call(dvRegistry, 'newRequest', data, {attachedDeposit: bounty.toString()})
  const status:any = await dvRegistry.view('getRequest', {_id: id})
  t.is(Object(status)['active'], true)
})

test('cancels a request', async(t) => {
  const { root, dvRegistry, scaffold } = t.context.accounts;
  const bounty = 10_000_000_000_000
  // await root.call(contract, 'setOracle', { _isOracle: true });
  const data = { _input: "http://h8jmnn0fdld39b2hp1l5v0c6a8.ingress.akt.computer/test", _oracle: root.accountId, _bounty: bounty, _expiresIn: "86400000000000", _callback: scaffold.accountId}
  const id = await root.call(dvRegistry, 'newRequest', data, {attachedDeposit: bounty.toString()})
  await root.call(dvRegistry, 'cancelRequest', {_id: id})
  const status = await dvRegistry.view('getRequest', { _id: id });
  t.is(Object(status)['active'], false)
})

// only the requestor can cancel a request
test('cancel request failures', async(t) => {
  const { root, dvRegistry, scaffold } = t.context.accounts;
  const bounty = 10_000_000_000_000
  const data = { _input: "http://h8jmnn0fdld39b2hp1l5v0c6a8.ingress.akt.computer/test", _oracle: root.accountId, _bounty: bounty, _expiresIn: "86400000000000", _callback: scaffold.accountId}
  const id = await root.call(dvRegistry, 'newRequest', data, {attachedDeposit: bounty.toString()})
  const a = await root.createSubAccount("a");
  const error1 = await t.throwsAsync(() => a.call(dvRegistry, 'cancelRequest', { _id: id}));
  t.assert(error1?.message?.includes(`Unauthorized`));
})

test('fills a request', async(t) => {
  // create a request
  const { root, dvRegistry, scaffold } = t.context.accounts;
  const bounty = 10_000_000_000_000
  // await root.call(contract, 'setOracle', { _isOracle: true });
  const data = { _input: "http://h8jmnn0fdld39b2hp1l5v0c6a8.ingress.akt.computer/test", _oracle: root.accountId, _bounty: bounty, _expiresIn: "86400000000000", _callback: scaffold.accountId}
  const id = await root.call(dvRegistry, 'newRequest', data, {attachedDeposit: bounty.toString()})

  const result = "httpbin.org"
  // fill the request
  // We're making 2 calls here (cross contract call) so we will send 2x the normal gas
  const res = await root.call(dvRegistry, 'fillRequest', {_id: id, _result: result}, {gas: String(60_000_000_000_000)})
  const status:any = await scaffold.view('getResults', {_i: 0})

  t.is(JSON.parse(status)['result'], result)
})


// test('fills a request', async(t) => {
//   const { root, contract } = t.context.accounts
  
  
// })

// test('returns the default greeting', async (t) => {
//   const { contract } = t.context.accounts;
//   const message: string = await contract.view('get_greeting', {});
//   t.is(message, 'Hello');
// });

// test('changes the message', async (t) => {
//   const { root, contract } = t.context.accounts;
//   await root.call(contract, 'set_greeting', { message: 'Howdy' });
//   const message: string = await contract.view('get_greeting', {});
//   t.is(message, 'Howdy');
// });