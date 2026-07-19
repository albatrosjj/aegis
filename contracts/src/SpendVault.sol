// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Minimal ERC-20 arayüzü — Arc'ta USDC'nin ERC-20 yüzü (6 decimal) için yeterli.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title SpendVault — AI ajanları için on-chain harcama güvenlik duvarı
/// @notice Para bu kasada durur; ajan yalnızca `spend` çağırabilir ve
///         zincir üstündeki sert kurallar (limit, allowlist, pause) aşılamaz.
contract SpendVault {
    IERC20 public immutable usdc;

    address public owner;  // insan: kuralları koyar, acil durdurmayı yönetir
    address public agent;  // AI ajanı: sadece spend() çağırabilir

    uint256 public maxPerTx;    // işlem-başı üst limit (6 decimal USDC)
    uint256 public dailyLimit;  // kayan 24 saatlik pencere limiti
    bool public paused;         // circuit-breaker bayrağı

    mapping(address => bool) public allowlist;

    // Kayan 24s pencere: her harcamayı kaydet, sorguda son 24 saati topla.
    struct Spend {
        uint64 timestamp;
        uint192 amount;
    }
    Spend[] public spends;
    uint256 private windowStart; // 24 saatten eski kayıtları atlamak için imleç

    event Spent(address indexed to, uint256 amount);
    event Paused(address indexed by);
    event Unpaused();
    event AllowlistUpdated(address indexed target, bool allowed);
    event LimitsUpdated(uint256 maxPerTx, uint256 dailyLimit);
    event AgentUpdated(address indexed agent);

    error NotOwner();
    error NotAgent();
    error VaultPaused();
    error NotAllowlisted(address to);
    error ExceedsPerTxLimit(uint256 amount, uint256 maxPerTx);
    error ExceedsDailyLimit(uint256 attempted, uint256 dailyLimit);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _usdc, address _agent, uint256 _maxPerTx, uint256 _dailyLimit) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
        agent = _agent;
        maxPerTx = _maxPerTx;
        dailyLimit = _dailyLimit;
    }

    // ---- Ajanın tek kapısı ----

    /// @notice Ajan buradan harcar; kurallardan biri bile sağlanmazsa revert.
    function spend(address to, uint256 amount) external {
        if (msg.sender != agent) revert NotAgent();
        if (paused) revert VaultPaused();
        if (!allowlist[to]) revert NotAllowlisted(to);
        if (amount > maxPerTx) revert ExceedsPerTxLimit(amount, maxPerTx);

        uint256 spent = spentLast24h();
        if (spent + amount > dailyLimit) revert ExceedsDailyLimit(spent + amount, dailyLimit);

        spends.push(Spend(uint64(block.timestamp), uint192(amount)));
        require(usdc.transfer(to, amount), "USDC transfer failed");
        emit Spent(to, amount);
    }

    /// @notice Son 24 saatte harcanan toplam (kayan pencere).
    function spentLast24h() public view returns (uint256 total) {
        uint256 cutoff = _cutoff();
        for (uint256 i = windowStart; i < spends.length; i++) {
            if (spends[i].timestamp >= cutoff) total += spends[i].amount;
        }
    }

    /// @notice Eski kayıt imlecini ilerletir; gaz tasarrufu için herkes çağırabilir.
    function pruneWindow() external {
        uint256 cutoff = _cutoff();
        uint256 i = windowStart;
        while (i < spends.length && spends[i].timestamp < cutoff) i++;
        windowStart = i;
    }

    /// Zincir yaşı 24 saatten kısayken underflow olmasın diye 0'a sabitlenir.
    function _cutoff() private view returns (uint256) {
        return block.timestamp > 24 hours ? block.timestamp - 24 hours : 0;
    }

    // ---- Sahip / risk-beyni kontrolleri ----

    /// @notice Acil durdurma: owner ya da agent (risk beyni ajan anahtarıyla da tetikleyebilir).
    function pause() external {
        if (msg.sender != owner && msg.sender != agent) revert NotOwner();
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Yalnızca insan (owner) yeniden açabilir.
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    function setAllowlist(address target, bool allowed) external onlyOwner {
        allowlist[target] = allowed;
        emit AllowlistUpdated(target, allowed);
    }

    function setLimits(uint256 _maxPerTx, uint256 _dailyLimit) external onlyOwner {
        maxPerTx = _maxPerTx;
        dailyLimit = _dailyLimit;
        emit LimitsUpdated(_maxPerTx, _dailyLimit);
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
        emit AgentUpdated(_agent);
    }

    /// @notice Owner kasadan istediği zaman parayı geri çekebilir (para hep insanın).
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(usdc.transfer(to, amount), "USDC transfer failed");
    }
}
