// Find all our documentation at https://docs.near.org
import { NearBindgen, near, call, view, initialize, assert, validateAccountId, LookupMap, Bytes, bytes} from 'near-sdk-js';
import { blockTimestamp, ecrecover, keccak256, predecessorAccountId, signerAccountId } from 'near-sdk-js/lib/api';
import { AccountId } from "near-sdk-js/lib/types";

class Request {
    input: string;
    oracle: AccountId;
    requestor: AccountId;
    callback: AccountId;
    bounty: bigint;
    timestamp: bigint;
    expires: bigint;
    active: Boolean;
    constructor(_input, _oracle, _requestor, _callback, _bounty, _timestamp, _expires, _active){
        this.input = _input
        this.oracle = _oracle
        this.requestor = _requestor
        this.callback = _callback
        this.bounty = _bounty
        this.timestamp = _timestamp
        this.expires = _expires
        this.active = _active
    }
}

@NearBindgen({ requireInit: true })
class DVRegistry {
    owner: string;
    requests: LookupMap<Request>;
    constructor() {
        this.owner = "";
        this.requests = new LookupMap("r");
      }
    
      @initialize({})
      init({ }) {
        this.owner = signerAccountId();
      }

    @call({}) // This method changes the state, for which it cost gas
    setOwner({ _owner }: { _owner: string }): void {
        validateAccountId(_owner);
        assert(predecessorAccountId() == this.owner,"Unauthorized");
        this.owner = _owner;
    }
    
    @view({})
    getOwner({}) {
        return this.owner;
    }

    // @call({})
    // setOracle({ _isOracle }: {_isOracle: boolean}): void {
    //     this.oracles.set(predecessorAccountId(), _isOracle)
    // }

    // @view({})
    // getOracle({_oracle}: {_oracle: string}){
    //     validateAccountId(_oracle);
    //     return this.oracles.get(_oracle) || false;
    // }


    @call({ payableFunction: true})
    newRequest({ _input, _oracle, _bounty, _expiresIn, _callback }: { _input: string, _oracle: string, _bounty: string, _expiresIn: string, _callback: string}): string {
        assert(near.attachedDeposit() == BigInt(_bounty), "Invalid bounty")
        const request = new Request(_input, _oracle, predecessorAccountId(), _callback, BigInt(_bounty), blockTimestamp(), blockTimestamp() + BigInt(_expiresIn), true)
        const id = request.timestamp.toString() + request.input + _bounty + request.requestor
        this.requests.set(id.toString(), request);
        near.log("EVENT_JSON:" + JSON.stringify({
            standard: "nep171",
            version: "1.0.0",
            event: "new_request",
            data: id,
        }))
        return id.toString();
    }

    @view({})
    getRequest({_id}: {_id: string}){
        return this.requests.get(_id);
    }

    @call({})
    cancelRequest({ _id }: {_id: string}): string {
        const request = this.requests.get(_id);
        const bounty = request.bounty
        // make sure the caller is the requestor
        assert(predecessorAccountId() == request.requestor,"Unauthorized");
        request.active = false;
        request.bounty = BigInt(0);
        this.requests.set(_id, request);
        near.log("EVENT_JSON:" + JSON.stringify({
            standard: "nep171",
            version: "1.0.0",
            event: "cancel_request",
            data: _id,
        }))
        // send NEAR
        const promise = near.promiseBatchCreate(request.requestor);
        near.promiseBatchActionTransfer(promise, bounty);
        near.promiseReturn(promise);
        return _id;
    }

    @call({})
    fillRequest({ _id, _result }: { _id: string, _result: string }): string {
        const request = this.requests.get(_id)
        const bounty = request.bounty
        assert(request.expires > blockTimestamp(), "Expired request")
        assert(predecessorAccountId() == request.oracle,"Unauthorized");
        // cross contract call
        request.active = false;
        request.bounty = BigInt(0);
        this._DVCallback({_callback: this.requests.get(_id).callback, _request: _id, _result: _result})
        this.requests.set(_id, request)
        near.log("EVENT_JSON:" + JSON.stringify({
            standard: "nep171",
            version: "1.0.0",
            event: "fill_request",
            data: _id,
        }))
        // send NEAR
        const promise = near.promiseBatchCreate(request.requestor);
        near.promiseBatchActionTransfer(promise, bounty);
        near.promiseReturn(promise);
        return _id
        // const bounty = request.bounty
        // // the signer must be an oracle
        // assert(this.oracles.get(oracle) == true, "Not an oracle")
        // // the signer must be the correct oracle
        // assert(request.oracle == oracle, "Invalid oracle")
        // // the request must be active
        // assert(request.active == true, "Inactive request")
        // // the request must not be expired
        // assert(request.expires > blockTimestamp(), "Expired request")
        // // the data must be gathered after the request is submitted
        // assert(request.timestamp > blockTimestamp(), "Invalid result")
        // // the input must be the same
        // assert((request.input) == (_input), "Invalid input")
        // request.active = false
        // request.bounty = BigInt(0)
        // // cross contract call
        // this._DVCallback({_callback: this.requests.get(_id).callback, _request: _id, _result: _result})
        // this.requests.set(_id, request)
        // // send NEAR
        // const promise = near.promiseBatchCreate(request.requestor);
        // near.promiseBatchActionTransfer(promise, bounty);
        // near.promiseReturn(promise);
        // return _id
    }

    @call({})
    _DVCallback({ _callback, _request, _result }: {_callback: string, _request: string, _result: string}) {
      const promise = near.promiseBatchCreate(_callback);
      near.promiseBatchActionFunctionCall(
        promise,
        "onDVRequestFilled",
        bytes(JSON.stringify({_request: _request, _result: _result})),
        0,
        30_000_000_000_000
      );
    }
}