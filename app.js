// Adresa PRP token ugovora iz truffle migrate outputa
const TOKEN_ADDRESS = "0xdFa9EE546D51A20740E12E0cdFa4f401aa849bc1"; // zamijeni ako je drugačije

// ABI PRP tokena (kopiraj iz build/contracts/Perper.json)
const TOKEN_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "_initialSupply", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
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
    "name": "name",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
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

let provider, signer, contract, userAddress;

// Funkcija za povezivanje sa MetaMask
async function connectWallet() {
  if (window.ethereum) {
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();
      userAddress = await signer.getAddress();
      contract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
      document.getElementById("wallet-address").innerText = "Wallet: " + userAddress;
      console.log("Povezan MetaMask nalog:", userAddress);
      loadBalance();
    } catch (error) {
      console.error(error);
    }
  } else {
    alert("MetaMask nije instaliran!");
  }
}

// Učitaj PRP balans
async function loadBalance() {
  const balance = await contract.balanceOf(userAddress);
  const decimals = await contract.decimals();
  const formatted = ethers.utils.formatUnits(balance, decimals);
  document.getElementById("token-balance").innerText = `Balans: ${formatted} PRP`;
}

// Transfer PRP tokena
async function transferTokens() {
  const recipient = document.getElementById("recipient").value;
  const amount = document.getElementById("amount").value;
  const decimals = await contract.decimals();
  const parsedAmount = ethers.utils.parseUnits(amount, decimals);

  try {
    const tx = await contract.transfer(recipient, parsedAmount);
    await tx.wait();
    alert(`Uspješno poslano ${amount} PRP na ${recipient}`);
    loadBalance();
  } catch (error) {
    console.error(error);
    alert("Greška prilikom slanja tokena!");
  }
}
