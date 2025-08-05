const TOKEN_ADDRESS = "0x46B9816b6089C26b2D8e9C784fE9381781b18bAc";

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
  }
];


// Token price u WEI (isto kao u smart contractu)
const TOKEN_PRICE_ETH = 0.01; // 1 PRP = 0.01 ETH

const buyPRPInput = document.getElementById("buy-amount");
const buyETHInput = document.getElementById("buy-eth");

// Kada korisnik unese PRP, izračunaj ETH
buyPRPInput.addEventListener("input", () => {
  const prpAmount = parseFloat(buyPRPInput.value) || 0;
  const ethEquivalent = prpAmount * TOKEN_PRICE_ETH;
  buyETHInput.value = ethEquivalent.toFixed(6); // prikazuje do 6 decimala
});

// Kada korisnik unese ETH, izračunaj PRP
buyETHInput.addEventListener("input", () => {
  const ethAmount = parseFloat(buyETHInput.value) || 0;
  const prpEquivalent = ethAmount / TOKEN_PRICE_ETH;
  buyPRPInput.value = prpEquivalent.toFixed(2); // prikazuje do 2 decimale
});

// Funkcija za kupovinu tokena
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


let provider, signer, contract, userAddress;

async function connectWallet() {
  if (window.ethereum) {
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();
      userAddress = await signer.getAddress();
      contract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);

      document.getElementById("wallet-address").innerText = "Wallet: " + userAddress;
      loadBalance();
      listenTransfers();
    } catch (error) {
      console.error(error);
    }
  } else {
    alert("MetaMask nije instaliran!");
  }
}

async function loadBalance() {
  if (!contract || !userAddress) return;
  const balance = await contract.balanceOf(userAddress);
  const decimals = await contract.decimals();
  const formatted = ethers.utils.formatUnits(balance, decimals);
  document.getElementById("token-balance").innerText = `Balance: ${formatted} PPR`;
}

async function transferTokens(event) {
  event.preventDefault();
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

async function buyTokens(event) {
  event.preventDefault();
  const ethAmount = document.getElementById("buy-eth").value;
  try {
    const tx = await signer.sendTransaction({
      to: TOKEN_ADDRESS,
      value: ethers.utils.parseEther(ethAmount)
    });
    await tx.wait();
    alert(`Bought tokens with ${ethAmount} ETH`);
    loadBalance();
  } catch (error) {
    console.error(error);
    alert("Buy failed!");
  }
}

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

// Bind forme na JS
document.getElementById("transfer-form").addEventListener("submit", transferTokens);
document.getElementById("buy-form").addEventListener("submit", buyTokens);
