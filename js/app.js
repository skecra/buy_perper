// -------------------- KONFIGURACIJA --------------------

const TOKEN_ADDRESS = "0xf412de660d3914E2E5CdB5A476E35d291150C88D";
const TOKEN_SYMBOL = "PRP";
const TOKEN_IMAGE_URL = "https://gateway.pinata.cloud/ipfs/bafybeiayu4mujnlkwmajyo2xh2cpgpizapajatsk6jl7yx6wnk642ltnxi";

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
  },
  // Funkcija za kupovinu tokena
  {
    "inputs": [],
    "name": "buyTokens",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "payable",
    "type": "function"
  }
];

// -------------------- GLOBALNE PROMJENLJIVE --------------------

let provider, signer, contract, userAddress;
let tokenPriceEth = 0;

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
      await addTokenToMetaMask(userAddress);

      listenTransfers();

      if (window.ethereum?.on) {
        window.ethereum.on("accountsChanged", async (accounts) => {
          try {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            userAddress = await signer.getAddress();
            document.getElementById("wallet-address").innerText = "Wallet: " + userAddress;
            await loadBalance();
            await addTokenToMetaMask(userAddress);
          } catch (e) { console.error(e); }
        });
        window.ethereum.on("chainChanged", async () => {
          try {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            contract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
            await loadBalance();
            await addTokenToMetaMask(userAddress);
          } catch (e) { console.error(e); }
        });
      }
    } catch (error) {
      console.error(error);
    }
  } else {
    alert("MetaMask nije instaliran!");
  }
}

// Dodavanje tokena u MetaMask po nalogu
async function addTokenToMetaMask(account) {
  try {
    if (!window.ethereum || !contract) return;
    if (!account) return;

    const storageKey = `imported_${account.toLowerCase()}`;
    const importedTokens = JSON.parse(localStorage.getItem(storageKey) || "[]");

    if (importedTokens.includes(TOKEN_ADDRESS.toLowerCase())) {
      console.log(`Token već dodat za nalog ${account}`);
      return;
    }

    const decimals = await contract.decimals();
    const wasAdded = await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: TOKEN_ADDRESS,
          symbol: TOKEN_SYMBOL,
          decimals: Number(decimals),
          image: TOKEN_IMAGE_URL
        }
      }
    });

    if (wasAdded) {
      console.log(`Token dodat u MetaMask za nalog ${account}`);
      importedTokens.push(TOKEN_ADDRESS.toLowerCase());
      localStorage.setItem(storageKey, JSON.stringify(importedTokens));
    } else {
      console.log(`Korisnik odbio dodavanje tokena za nalog ${account}`);
    }
  } catch (err) {
    console.error("Greška pri dodavanju tokena u MetaMask:", err);
  }
}

// Učitavanje balansa korisnika
async function loadBalance() {
  if (!contract || !userAddress) return;
  const balance = await contract.balanceOf(userAddress);
  const decimals = await contract.decimals();
  const formatted = ethers.utils.formatUnits(balance, decimals);
  document.getElementById("token-balance").innerText = `Balance: ${formatted} PRP`;
}

// Učitavanje cijene tokena iz ugovora
async function loadTokenPrice() {
  if (!contract) return;
  const priceWei = await contract.tokenPrice();
  tokenPriceEth = parseFloat(ethers.utils.formatEther(priceWei));
  console.log("Token price:", tokenPriceEth, "ETH per PRP");
}

// Kupovina tokena preko funkcije buyTokens
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
    await addTokenToMetaMask(userAddress);

    const tx = await contract.buyTokens({
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
    alert(`Sent ${amount} PRP to ${recipient}`);
    loadBalance();
  } catch (error) {
    console.error(error);
    alert("Transfer failed!");
  }
}

// Slušanje Transfer eventova
function listenTransfers() {
  if (!contract) return;
  contract.on("Transfer", (from, to, value, event) => {
    contract.decimals().then((decimals) => {
      const amount = ethers.utils.formatUnits(value, decimals);
      const li = document.createElement("li");
      li.innerText = `From: ${from} -> To: ${to} | Amount: ${amount} PRP | Tx: ${event.transactionHash}`;
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


  // --- Flip logika: Buy Perper / Buy Domain ---
  const flipCard = document.getElementById('flipCard');
  const glassCard = document.querySelector('.glass-card');
  const tabPerper = document.getElementById('tabPerper');
  const tabDomain = document.getElementById('tabDomain');
  const tabIndicator = document.getElementById('tabIndicator');

  // inicijalni položaj indikatora (ispod "Buy Perper")
  function positionIndicator() {
    const active = document.querySelector('.card-tab.active');
    if (!active) return;
    const parentRect = document.querySelector('.card-tabs').getBoundingClientRect();
    const btnRect = active.getBoundingClientRect();
    const dx = btnRect.left - parentRect.left;
    tabIndicator.style.width = btnRect.width + 'px';
    tabIndicator.style.transform = `translateX(${dx}px)`;
  }
  window.addEventListener('load', positionIndicator);
  window.addEventListener('resize', positionIndicator);

  function activate(target) {
    // active tab stil + indikator
    [tabPerper, tabDomain].forEach(b => b.classList.remove('active'));
    if (target === 'perper') {
      tabPerper.classList.add('active');
      glassCard.classList.remove('is-domain');
    } else {
      tabDomain.classList.add('active');
      glassCard.classList.add('is-domain');
    }
    positionIndicator();
  }

  tabPerper.addEventListener('click', () => activate('perper'));
  tabDomain.addEventListener('click', () => activate('domain'));

  const tabsWrap    = document.querySelector('.card-tabs');
  

  function positionIndicator() {
    const active = document.querySelector('.card-tab.active');
    if (!active || !tabsWrap) return;

    const tabsRect = tabsWrap.getBoundingClientRect();
    const btnRect  = active.getBoundingClientRect();
    const dx = btnRect.left - tabsRect.left - 10;

    tabIndicator.style.width = btnRect.width + 'px';
    tabIndicator.style.transform = `translateX(${dx}px)`;
  }

  function activate(target) {
    [tabPerper, tabDomain].forEach(b => b.classList.remove('active'));
    if (target === 'perper') {
      tabPerper.classList.add('active');
      glassCard.classList.remove('is-domain');
    } else {
      tabDomain.classList.add('active');
      glassCard.classList.add('is-domain');
    }
    positionIndicator();
  }

  tabPerper.addEventListener('click', () => activate('perper'));
  tabDomain.addEventListener('click', () => activate('domain'));
  window.addEventListener('load', positionIndicator);
  window.addEventListener('resize', positionIndicator);
