// -------------------- KONFIGURACIJA --------------------

const TOKEN_ADDRESS = "0xf412de660d3914E2E5CdB5A476E35d291150C88D";

const TOKEN_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "from", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "_to", "type": "address"},
      {"internalType": "uint256", "name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokenPrice",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// -------------------- GLOBALNE PROMJENLJIVE --------------------

let provider, signer, contract, userAddress;
let tokenPriceEth = 0; // cijena tokena u ETH za preračunavanje

// Input polja sa frontenda
const buyPRPInput = document.getElementById("buy-amount");
const buyETHInput = document.getElementById("buy-eth");

// -------------------- FUNKCIJE --------------------

// Povezivanje sa MetaMask
async function connectWallet() {
  if (typeof window.ethereum !== "undefined") {
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();
      userAddress = await signer.getAddress();
      contract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);

      document.getElementById("wallet-address").innerText = "Wallet: " + userAddress;

      await loadBalance();
      await loadTokenPrice();
      listenTransfers();

    } catch (error) {
      console.error(error);
    }
  } else {
    alert("MetaMask nije instaliran!");
  }
}

// Učitavanje balansa korisnika
async function loadBalance() {
  if (!contract || !userAddress) return;
  const balance = await contract.balanceOf(userAddress);
  const decimals = await contract.decimals();
  const formatted = ethers.utils.formatUnits(balance, decimals);
  document.getElementById("token-balance").innerText = `Balance: ${formatted} PPR`;
}

// Učitavanje cijene tokena iz ugovora
async function loadTokenPrice() {
  if (!contract) return;
  const priceWei = await contract.tokenPrice();
  tokenPriceEth = parseFloat(ethers.utils.formatEther(priceWei));
  console.log("Token price:", tokenPriceEth, "ETH per PRP");
}

// Kupovina tokena
async function buyTokens(event) {
  event.preventDefault();

  if (!signer || !userAddress) {
    alert("Please connect your wallet first!");
    return;
  }

  const ethAmount = parseFloat(buyETHInput.value);
  if (isNaN(ethAmount) || ethAmount <= 0) {
    alert("Please enter a valid ETH amount!");
    return;
  }

  try {
    const tx = await signer.sendTransaction({
      to: TOKEN_ADDRESS,
      value: ethers.utils.parseEther(ethAmount.toString())
    });
    await tx.wait();
    alert(`Kupili ste ${buyPRPInput.value} PRP za ${ethAmount} ETH`);
    loadBalance();
  } catch (error) {
    console.error(error);
    alert("Buy failed!");
  }
}

// Transfer tokena
async function transferTokens(event) {
  event.preventDefault();

  if (!contract || !userAddress) {
    alert("Please connect your wallet first!");
    return;
  }

  const recipient = document.getElementById("recipient").value;
  const amount = document.getElementById("amount").value;

  const decimals = await contract.decimals();
  const parsedAmount = ethers.utils.parseUnits(amount, decimals);

  try {
    const tx = await contract.transfer(recipient, parsedAmount);
    await tx.wait();
    alert(`Sent ${amount} PPR to ${recipient}`);
    loadBalance();
  } catch (error) {
    console.error(error);
    alert("Transfer failed!");
  }
}

// Slušanje Transfer eventova
function listenTransfers() {
  contract.on("Transfer", (from, to, value, event) => {
    contract.decimals().then((decimals) => {
      const amount = ethers.utils.formatUnits(value, decimals);
      const li = document.createElement("li");
      li.innerText = `From: ${from} -> To: ${to} | Amount: ${amount} PPR | Tx: ${event.transactionHash}`;
      document.getElementById("history-list").prepend(li);
    });
  });
}

// -------------------- EVENT LISTENERI --------------------

// Automatska konverzija PRP -> ETH
buyPRPInput.addEventListener("input", () => {
  const prpAmount = parseFloat(buyPRPInput.value) || 0;
  if (tokenPriceEth > 0) {
    buyETHInput.value = (prpAmount * tokenPriceEth).toFixed(6);
  }
});

// Automatska konverzija ETH -> PRP
buyETHInput.addEventListener("input", () => {
  const ethAmount = parseFloat(buyETHInput.value) || 0;
  if (tokenPriceEth > 0) {
    buyPRPInput.value = (ethAmount / tokenPriceEth).toFixed(2);
  }
});

// Povezivanje formi sa JS funkcijama
document.getElementById("transfer-form").addEventListener("submit", transferTokens);
document.getElementById("buy-form").addEventListener("submit", buyTokens);
