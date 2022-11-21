# Dataverse-Contracts
All smart contracts for Dataverse protocol

Addresses of deployed `DVRegistry.sol` can be found [here](https://github.com/Fluffy9/Dataverse/wiki/Contract-Addresses)

## Integration

`Integration.sol` is a contract demonstrating how to implement a request into your smart contract. The two main functions to look at are `requestData` and `onDVRequestFilled`

```
    function requestData(address oracle, string memory input, uint256 bounty) public payable {
        IDVRegistry(registry).newRequest{value: msg.value}(input, oracle, bounty, 86400, address(this));
    }
```

`requestData` models how you should request data from the registry. You need to submit an input URL/IPFS hash, the address of the oracle/provider you want to use, the bounty (must match the value amount), the amount of time until expiry (86400 being 1 day), and the callback address. Take into account a higher bounty means the request will be more likely to be filled, so while you can set it to 0 it may result in your request never being filled. If you messed up and need to cancel your request `cancelRequest(bytes32 _id)` will send you your bounty back. 

```
    function onDVRequestFilled(bytes memory data) public {
        require(msg.sender == registry);
        (IDVRegistry.Request memory request, string memory result) = abi.decode(data, (IDVRegistry.Request, string));           
        emit RequestFilled(request.input, result);
    }
```

`onDVRequestFilled` will be called when a keeper fills your data request. It's important that you restrict access to this function to the registry contract only. The request will return to you your original request and a string result. 

## Near Contracts

Check out the dv-near folder
