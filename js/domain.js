// ---------------- KONFIG ----------------
const PRP_TOKEN_ADDRESS = "0xf412de660d3914E2E5CdB5A476E35d291150C88D"; // Perper token
const PRP_TOKEN_SYMBOL  = "PRP";
const PRP_TOKEN_IMAGE   = "https://gateway.pinata.cloud/ipfs/bafybeiayu4mujnlkwmajyo2xh2cpgpizapajatsk6jl7yx6wnk642ltnxi";

const DOMAIN_CONTRACT_ADDRESS = "OVDJE_STAVI_ETHENTITY_ADRESU"; // Ethentity (hardkodirani PRP unutra)
const MIN_REQUIRED_PRP = 10; // minimalno PRP za registraciju (prilagodi po potrebi)

// PRP (ERC-20) ABI – minimalno što koristimo
const TOKEN_ABI = [
  { "inputs":[{"internalType":"address","name":"","type":"address"}],
    "name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability":"view","type":"function" },
  { "inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],
    "stateMutability":"view","type":"function" },
  { "inputs":[],"name":"tokenPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability":"view","type":"function" },
  { "inputs":[],"name":"buyTokens","outputs":[{"internalType":"bool","name":"","type":"bool"}],
    "stateMutability":"payable","type":"function" },
];

// Ethentity ABI – minimalno što koristimo
const DOMAIN_ABI = [
  { "inputs":[{"internalType":"string","name":"rawName","type":"string"}],
    "name":"idOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
    "stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],
    "name":"getDomain",
    "outputs":[{"components":[
      {"internalType":"string","name":"name","type":"string"},
      {"internalType":"uint256","name":"regPrice","type":"uint256"},
      {"internalType":"uint256","name":"renewPrice","type":"uint256"},
      {"internalType":"bool","name":"isOwned","type":"bool"},
      {"internalType":"uint64","name":"expiresAt","type":"uint64"},
      {"internalType":"string","name":"ipfsHash","type":"string"},
      {"internalType":"uint256","name":"storageLimit","type":"uint256"},
      {"internalType":"uint256","name":"usedStorage","type":"uint256"},
      {"internalType":"bool","name":"forSale","type":"bool"},
      {"internalType":"uint256","name":"salePrice","type":"uint256"}
    ],"internalType":"struct Ethentity.Domain","name":"","type":"tuple"}],
    "stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],
    "name":"mintDomain","outputs":[],
    "stateMutability":"nonpayable","type":"function" },
];

// ---------------- VARIJABLE ----------------
let provider, signer, prpContract, domainContract, userAddress;
let tokenPriceEth = 0;
let prpDecimals = 18; // učitavamo iz kontrakta, default 18

// ---------------- WALLET ----------------
async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask nije instaliran!");
    return;
  }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    prpContract    = new ethers.Contract(PRP_TOKEN_ADDRESS, TOKEN_ABI, signer);
    domainContract = new ethers.Contract(DOMAIN_CONTRACT_ADDRESS, DOMAIN_ABI, signer);

    // učitaj decimals/cijenu i importuj token samo AKO već nije importovan za taj nalog
    prpDecimals = Number(await prpContract.decimals());
    await loadTokenPrice();
    await addTokenToMetaMaskOnce(userAddress);

    await checkPRPBalance();

    // re-eval nakon promjene naloga/mreže
    if (window.ethereum?.on) {
      window.ethereum.on("accountsChanged", async () => {
        try {
          provider = new ethers.providers.Web3Provider(window.ethereum);
          signer = provider.getSigner();
          userAddress = await signer.getAddress();
          prpContract    = new ethers.Contract(PRP_TOKEN_ADDRESS, TOKEN_ABI, signer);
          domainContract = new ethers.Contract(DOMAIN_CONTRACT_ADDRESS, DOMAIN_ABI, signer);
          prpDecimals = Number(await prpContract.decimals());
          await addTokenToMetaMaskOnce(userAddress);
          await checkPRPBalance();
        } catch (e) { console.error(e); }
      });
      window.ethereum.on("chainChanged", async () => {
        try {
          provider = new ethers.providers.Web3Provider(window.ethereum);
          signer = provider.getSigner();
          prpContract    = new ethers.Contract(PRP_TOKEN_ADDRESS, TOKEN_ABI, signer);
          domainContract = new ethers.Contract(DOMAIN_CONTRACT_ADDRESS, DOMAIN_ABI, signer);
          prpDecimals = Number(await prpContract.decimals());
          await checkPRPBalance();
        } catch (e) { console.error(e); }
      });
    }
  } catch (err) {
    console.error(err);
  }
}

// Import PRP samo jednom po nalogu (lokalno pamćenje)
async function addTokenToMetaMaskOnce(account) {
  try {
    if (!window.ethereum) return;
    if (!account) return;

    const key = `imported_${account.toLowerCase()}`;
    const imported = JSON.parse(localStorage.getItem(key) || "[]");
    if (imported.includes(PRP_TOKEN_ADDRESS.toLowerCase())) {
      // već importovano za ovaj nalog
      return;
    }

    const wasAdded = await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: PRP_TOKEN_ADDRESS,
          symbol: PRP_TOKEN_SYMBOL,
          decimals: prpDecimals,
          image: PRP_TOKEN_IMAGE
        }
      }
    });

    if (wasAdded) {
      imported.push(PRP_TOKEN_ADDRESS.toLowerCase());
      localStorage.setItem(key, JSON.stringify(imported));
    }
  } catch (err) {
    console.error("Greška pri dodavanju PRP tokena:", err);
  }
}

// ---------------- TOKEN FUNKCIJE ----------------
async function loadTokenPrice() {
  const priceWei = await prpContract.tokenPrice();
  tokenPriceEth = parseFloat(ethers.utils.formatEther(priceWei));
}

async function checkPRPBalance() {
  if (!prpContract || !userAddress) {
    goToStep(1);
    return;
  }
  const bal = await prpContract.balanceOf(userAddress);
  const prp = parseFloat(ethers.utils.formatUnits(bal, prpDecimals));
  if (prp >= MIN_REQUIRED_PRP) goToStep(2); else goToStep(1);
}

async function buyTokens(e) {
  e.preventDefault();
  if (!signer) return alert("Poveži novčanik prvo");

  const ethInput = parseFloat(document.getElementById("buy-eth").value);
  if (isNaN(ethInput) || ethInput <= 0) return alert("Unesi validan iznos u ETH");

  try {
    const tx = await prpContract.buyTokens({ value: ethers.utils.parseEther(ethInput.toString()) });
    await tx.wait();
    alert("PRP kupovina uspješna");
    await checkPRPBalance();
  } catch (err) {
    console.error(err);
    alert("Kupovina nije uspjela");
  }
}

// ---------------- DOMENE ----------------
async function registerDomain(e) {
  e.preventDefault();
  if (!signer) return alert("Poveži novčanik prvo");

  const name = document.getElementById("domain-name").value.trim();
  if (!name) return alert("Unesi naziv domene");

  try {
    const id = await domainContract.idOf(name);
    if (id.toString() === "0") return alert("Domena nije listana za registraciju");

    const d = await domainContract.getDomain(id);
    if (d.isOwned) return alert("Domena je već zauzeta");

    const tx = await domainContract.mintDomain(id);
    await tx.wait();

    alert(`Domena ${name} je uspješno registrovana!`);
  } catch (err) {
    console.error(err);
    alert("Registracija nije uspjela");
  }
}

// ---------------- UI ----------------
function goToStep(step) {
  const s1 = document.getElementById("step1");
  const s2 = document.getElementById("step2");
  const c1 = document.getElementById("step1-content");
  const c2 = document.getElementById("step2-content");

  if (s1) s1.classList.toggle("active", step === 1);
  if (s2) s2.classList.toggle("active", step === 2);
  if (c1) c1.style.display = step === 1 ? "block" : "none";
  if (c2) c2.style.display = step === 2 ? "block" : "none";
}

// ---------------- EVENT LISTENERI ----------------
const buyFormEl    = document.getElementById("buy-form");
const domainFormEl = document.getElementById("domain-form");
if (buyFormEl)    buyFormEl.addEventListener("submit", buyTokens);
if (domainFormEl) domainFormEl.addEventListener("submit", registerDomain);

// PRP <-> ETH konverzija po cijeni iz kontrakta
const buyAmountEl = document.getElementById("buy-amount");
const buyEthEl    = document.getElementById("buy-eth");
if (buyAmountEl) {
  buyAmountEl.addEventListener("input", () => {
    const prpAmount = parseFloat(buyAmountEl.value) || 0;
    if (tokenPriceEth > 0) buyEthEl.value = (prpAmount * tokenPriceEth).toFixed(6);
  });
}
if (buyEthEl) {
  buyEthEl.addEventListener("input", () => {
    const ethAmount = parseFloat(buyEthEl.value) || 0;
    if (tokenPriceEth > 0) buyAmountEl.value = (ethAmount / tokenPriceEth).toFixed(2);
  });
}

// Ako korisnik već ima konekciju – klikom na “Connect” u HTML pozovi connectWallet()
// Poželjno je ručno povezivanje zbog MetaMask dozvola
