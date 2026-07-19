require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;
const EXPLORER = "https://testnet.arcscan.app";

// Arc'ta USDC hem native gas token hem de bu adreste bir ERC-20 arayüzü olarak
// yaşar; ikisi aynı bakiyedir. ERC-20 arayüzü 6 decimal kullanır ve Arc
// dokümantasyonu transferler için bunu önerir.
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

async function main() {
  const { PRIVATE_KEY, RECIPIENT_ADDRESS } = process.env;
  if (!PRIVATE_KEY || !RECIPIENT_ADDRESS) {
    throw new Error(".env dosyasinda PRIVATE_KEY ve RECIPIENT_ADDRESS tanimli olmali");
  }
  const recipient = ethers.getAddress(RECIPIENT_ADDRESS);

  // staticNetwork: her istekte eth_chainId sorulmasin (RPC rate limit dostu)
  const provider = new ethers.JsonRpcProvider(
    RPC_URL,
    { chainId: CHAIN_ID, name: "arc-testnet" },
    { staticNetwork: true },
  );
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);

  const balance = await usdc.balanceOf(wallet.address);
  console.log(`Cuzdan: ${wallet.address}`);
  console.log(`USDC bakiyesi: ${ethers.formatUnits(balance, 6)} USDC`);

  const amount = ethers.parseUnits("1", 6); // 1 USDC (ERC-20 arayuzu 6 decimal)
  if (balance < amount) {
    throw new Error("Yetersiz bakiye. https://faucet.circle.com adresinden test USDC alabilirsin.");
  }

  console.log(`1 USDC gonderiliyor -> ${recipient} ...`);
  const tx = await usdc.transfer(recipient, amount, {
    // Arc dokumani 20 Gwei altindaki islemlerin beklemede kalabilecegini soyluyor
    maxFeePerGas: ethers.parseUnits("20", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
  });
  console.log(`Islem hash: ${tx.hash}`);
  console.log("Onay bekleniyor...");
  await tx.wait();

  console.log("Islem onaylandi!");
  console.log(`Explorer: ${EXPLORER}/tx/${tx.hash}`);

  const newBalance = await usdc.balanceOf(wallet.address);
  console.log(`Yeni bakiye: ${ethers.formatUnits(newBalance, 6)} USDC`);
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
