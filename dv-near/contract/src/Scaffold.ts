// Find all our documentation at https://docs.near.org
import { NearBindgen, near, call, view, initialize, validateAccountId, bytes, assert, LookupMap } from 'near-sdk-js';
import { blockTimestamp, predecessorAccountId, signerAccountId } from 'near-sdk-js/lib/api';
import { AccountId } from "near-sdk-js/lib/types";


@NearBindgen({ requireInit: true })
class Scaffold {
  registry: string;
  requests: Array<string>;
  results: Array<string>;
  items: number;
  constructor() {
    this.registry = "";
    this.requests = new Array();
    this.results = new Array()
    this.items = 0;
  }

  @initialize({})
  init({ _registry }: { _registry: string }) {
    validateAccountId(_registry);
    this.registry = _registry;
  }
  @call({ payableFunction: true})
  requestData({_oracle, _input, _bounty}: {_oracle: string, _input: string, _bounty: string }): void {
    const promise = near.promiseBatchCreate(this.registry);
    near.promiseBatchActionFunctionCall(
      promise,
      "newRequest",
      bytes(JSON.stringify({_input: _input, _oracle: _oracle, _bounty: _bounty, _expiresIn: 86_400_000_000_000, _callback: near.currentAccountId()})),
      near.attachedDeposit(),
      30_000_000_000_000
    );
  }
  @call({})
  onDVRequestFilled({_request, _result}: {_request: string, _result: string}): string {
    assert(predecessorAccountId() == this.registry, "Unauthorized");
    const requests = this.requests.push(_request)
    const results = this.results.push(_result)
    this.items = requests
    near.log("EVENT_JSON:" + JSON.stringify({
      standard: "nep171",
      version: "1.0.0",
      event: "result",
      data: _result,
    }))
    return _request;
  }
  @view({})
  getResults({_i}:{_i: number}): string {
    return JSON.stringify({length: this.items, request: this.requests[_i], result: this.results[_i]})
  }
}