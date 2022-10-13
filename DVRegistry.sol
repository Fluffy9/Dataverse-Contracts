pragma solidity 0.8.7;
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IDVConsumer {
    function onDVRequestFilled(bytes memory data) external;
}
error InvalidOracle();
error InvalidInput();
error Expired();
error NotActive();
error NotAnOracle();
error Unauthorized();
error InvalidBounty();
error InvalidResult();
error NotRequestor();
contract DVRegistry {
    using ECDSA for bytes32;
    event NewRequest(bytes32 indexed _id, address indexed _requestor, uint256 indexed _bounty, string input);
    event CanceledRequest(bytes32 indexed _guid);
    event FilledRequest(bytes32 indexed _guid, string _data);
    event ModifiedOwner(address indexed _oldOwner, address indexed _owner);
    event ModifiedOracles(address indexed _oracle, bool indexed _isOracle);

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
    modifier onlyOwner(){
        if(msg.sender != owner) revert Unauthorized();
        _;
    }
    address public owner;
    mapping(bytes32 => Request) public requests;
    mapping(address => bool) public oracles;
    constructor(address _owner){
        owner = _owner;
    }
    function setOwner(address _owner) external onlyOwner{
        emit ModifiedOwner(owner, _owner);
        owner = _owner;
    }
    function setOracle(bool _isOracle) external {
        oracles[msg.sender] = _isOracle;
        emit ModifiedOracles(msg.sender, _isOracle);
    }
    function newRequest(string memory _input, address _oracle, uint256 _bounty, uint256 expiresIn, address _callback) external payable returns(bytes32) {
        if(_bounty != msg.value){
            revert InvalidBounty();
        }
        if(!oracles[_oracle]){
            revert InvalidOracle();
        }
        Request memory request = Request(_input, _oracle, msg.sender, _callback, _bounty, block.timestamp, block.timestamp + expiresIn, true);
        bytes32 id = keccak256(abi.encodePacked(request.timestamp, request.input, request.bounty, request.requestor));
        requests[id] = request;
        emit NewRequest(id, msg.sender, _bounty, _input);
        return id;

    }
    function cancelRequest(bytes32 _id) external returns(bytes32){
        Request memory request = requests[_id];
        if(msg.sender != request.requestor){
            revert NotRequestor();
        }
        else{
            requests[_id].active = false;
            requests[_id].bounty = 0;
            (bool success, ) = address(msg.sender).call{value: request.bounty}("");
            require(success);        
            emit CanceledRequest(_id);
            return _id;
        }
    }
    function signer(bytes memory _signature, bytes32 _msgHash) internal pure returns (address) {
        return _msgHash.toEthSignedMessageHash().recover(_signature);
    }
    function fillRequest(bytes32 _id, bytes memory _signature, bytes memory _data) external returns(bytes32){
        Request memory request = requests[_id];
        (string memory input, string memory result, uint256 timestamp) = abi.decode(_data, (string, string, uint256));
        address oracle = signer(_signature, keccak256(_data));
        // the signer must be an oracle
        if(!oracles[oracle]) revert NotAnOracle();
        // the signer must be the correct oracle
        if(request.oracle != oracle) revert InvalidOracle();
        // the request must be active
        if(!request.active) revert NotActive();
        // the request must not be expired
        if(request.expires < block.timestamp) revert Expired();
        // the data must be gathered after the request is submitted
        if(request.timestamp > timestamp) revert InvalidResult();
        // the input must be the same
        if(keccak256(bytes(request.input)) != keccak256(bytes(input))) revert InvalidInput();
        
        // Fill the request, pay msg.sender the bounty
        requests[_id].active = false;
        requests[_id].bounty = 0;
        IDVConsumer(request.callback).onDVRequestFilled(abi.encode(request, result));
        (bool success, ) = address(msg.sender).call{value: request.bounty}("");
        require(success);
        emit FilledRequest(_id, result);
        return _id;
    }
}
