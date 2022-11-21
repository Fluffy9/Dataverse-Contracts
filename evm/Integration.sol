pragma solidity 0.8.7;

interface IDVRegistry {
    struct Request {
        string input;
        address oracle;
        address requestor;
        address callback;
        uint256 bounty;
        uint256 timestamp;
        uint256 expires;
        bool active;
    }
    function newRequest(string memory input, address oracle, uint256 bounty, uint256 expiresIn, address callback) external payable;
}

contract Integration {
    address public registry;
    event RequestFilled(string indexed _input, string _result);
    constructor(address _registry){
        registry = _registry;
    }
    function requestData(address oracle, string memory input, uint256 bounty) public payable {
        IDVRegistry(registry).newRequest{value: msg.value}(input, oracle, bounty, 86400, address(this));
    }
    function onDVRequestFilled(bytes memory data) public {
        require(msg.sender == registry);
        (IDVRegistry.Request memory request, string memory result) = abi.decode(data, (IDVRegistry.Request, string));           
        emit RequestFilled(request.input, result);
    }
}