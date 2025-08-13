// ====================== KONFIG ======================
const TOKEN_ADDRESS   = "0xf412de660d3914E2E5CdB5A476E35d291150C88D"; // PRP
const TOKEN_SYMBOL    = "PRP";
const TOKEN_IMAGE_URL = "https://gateway.pinata.cloud/ipfs/bafybeiayu4mujnlkwmajyo2xh2cpgpizapajatsk6jl7yx6wnk642ltnxi";

// Crust Network konfig
const CRUST_GATEWAY = "https://gw.crustfiles.net";
const CRUST_AUTH = "your_crust_auth_token"; // Zamijeni sa stvarnim tokenom

const TOKEN_ABI = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"tokenPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"buyTokens","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"payable","type":"function"},
];

// ====================== STATE ======================
let provider, signer, prp, userAddress;
let tokenPriceEth = 0;
let prpDecimals = 18;

// ====================== HELPERS ======================
const $ = (id) => document.getElementById(id);

// ====================== DOM REFS ======================
// Perper UI
const buyPRPInput = $("buy-amount");
const buyETHInput = $("buy-eth");
const walletAddrEl = $("wallet-address");
const tokenBalEl   = $("token-balance");

// Tabs / flip
const glassCard    = document.querySelector(".glass-card");
const tabsWrap     = document.querySelector(".card-tabs");
const tabPerper    = $("tabPerper");
const tabDomain    = $("tabDomain");
const tabHost      = $("tabHost");
const tabIndicator = $("tabIndicator");
const flipCard     = $("flipCard");
const hostPane     = $("hostPane");

// Crust Host
const crustForm   = $("crust-form");
const crustFolder = $("crustFolder");
const crustFiles  = $("crustFiles");
const crustResult = $("crustResult");
const crustCidEl  = $("crustCid");
const crustUrlEl  = $("crustUrl");
const crustBtn    = $("crustUploadBtn");
const pinCrustBtn = $("pinToCrustBtn");
const progressDiv = document.querySelector(".upload-progress");
const progressBar = progressDiv?.querySelector("progress");
const statusText  = progressDiv?.querySelector(".status");

// ====================== WALLET ======================
async function connectWallet() {
  if (!window.ethereum) return alert("MetaMask nije instaliran!");
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider    = new ethers.providers.Web3Provider(window.ethereum);
    signer      = provider.getSigner();
    userAddress = await signer.getAddress();
    prp         = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);

    if (walletAddrEl) walletAddrEl.innerText = "Wallet: " + userAddress;

    prpDecimals = Number(await prp.decimals());
    await loadBalance();
    await loadTokenPrice();
    await addTokenToMetaMaskOnce(userAddress);

    if (window.ethereum?.on) {
      window.ethereum.on("accountsChanged", async () => {
        provider    = new ethers.providers.Web3Provider(window.ethereum);
        signer      = provider.getSigner();
        userAddress = await signer.getAddress();
        prp         = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
        prpDecimals = Number(await prp.decimals());
        if (walletAddrEl) walletAddrEl.innerText = "Wallet: " + userAddress;
        await addTokenToMetaMaskOnce(userAddress);
        await loadBalance();
      });
      window.ethereum.on("chainChanged", async () => {
        provider    = new ethers.providers.Web3Provider(window.ethereum);
        signer      = provider.getSigner();
        prp         = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
        prpDecimals = Number(await prp.decimals());
        await loadBalance();
      });
    }

    listenTransfers();
  } catch (err) {
    console.error(err);
    alert("Wallet connect failed.");
  }
}

// Import PRP samo jednom po nalogu (localStorage flag)
async function addTokenToMetaMaskOnce(account) {
  try {
    if (!window.ethereum || !account) return;
    const key = `imported_${account.toLowerCase()}`;
    const imported = JSON.parse(localStorage.getItem(key) || "[]");
    if (imported.includes(TOKEN_ADDRESS.toLowerCase())) return;

    const wasAdded = await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: { address: TOKEN_ADDRESS, symbol: TOKEN_SYMBOL, decimals: prpDecimals, image: TOKEN_IMAGE_URL }
      }
    });

    if (wasAdded) {
      imported.push(TOKEN_ADDRESS.toLowerCase());
      localStorage.setItem(key, JSON.stringify(imported));
    }
  } catch (e) {
    console.error("wallet_watchAsset error:", e);
  }
}

// ====================== TOKEN FUNKCIJE ======================
async function loadBalance() {
  if (!prp || !userAddress || !tokenBalEl) return;
  const bal = await prp.balanceOf(userAddress);
  const formatted = ethers.utils.formatUnits(bal, prpDecimals);
  tokenBalEl.innerText = `Balance: ${formatted} PRP`;
}

async function loadTokenPrice() {
  if (!prp) return;
  try {
    const priceWei = await prp.tokenPrice();
    tokenPriceEth = parseFloat(ethers.utils.formatEther(priceWei));
  } catch {
    tokenPriceEth = 0;
  }
}

async function buyTokens(e) {
  e?.preventDefault?.();
  if (!signer || !userAddress) return alert("Connect wallet prvo.");
  const ethAmount = parseFloat(buyETHInput?.value || "0");
  if (!ethAmount || ethAmount <= 0) return alert("Unesi validan ETH iznos.");
  try {
    await addTokenToMetaMaskOnce(userAddress);
    const tx = await prp.buyTokens({ value: ethers.utils.parseEther(ethAmount.toString()) });
    await tx.wait();
    alert(`Kupovina uspješna`);
    loadBalance();
  } catch (err) {
    console.error(err);
    alert("Buy failed");
  }
}

async function transferTokens(e) {
  e?.preventDefault?.();
  if (!prp || !userAddress) return alert("Connect wallet prvo.");
  const recipient = $("recipient")?.value?.trim();
  const amountStr = $("amount")?.value?.trim();
  if (!recipient || !amountStr) return alert("Unesi adresu i iznos.");
  const parsedAmount = ethers.utils.parseUnits(amountStr, prpDecimals);
  try {
    const tx = await prp.transfer(recipient, parsedAmount);
    await tx.wait();
    alert(`Poslano ${amountStr} PRP na ${recipient}`);
    loadBalance();
  } catch (err) {
    console.error(err);
    alert("Transfer failed");
  }
}

function listenTransfers() {
  const historyEl = $("history-list");
  if (!prp || !historyEl) return;
  prp.on("Transfer", async (from, to, value, event) => {
    try {
      const amount = ethers.utils.formatUnits(value, prpDecimals);
      const li = document.createElement("li");
      li.innerText = `From: ${from} -> To: ${to} | Amount: ${amount} PRP | Tx: ${event.transactionHash}`;
      historyEl.prepend(li);
    } catch (e) { console.error(e); }
  });
}

// ====================== CRUST UPLOAD ======================
function bindCrustUpload() {
  if (!crustForm || !crustFolder) return;

  // Prikaži listu fajlova
  crustFolder.addEventListener("change", () => {
    if (!crustFiles) return;
    crustFiles.innerHTML = "";
    const files = Array.from(crustFolder.files).sort((a, b) => 
      (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name)
    );
    
    files.forEach(file => {
      const li = document.createElement("li");
      li.textContent = file.webkitRelativePath || file.name;
      crustFiles.appendChild(li);
    });
  });

  // Upload na Crust
  crustForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const files = Array.from(crustFolder.files);
    if (files.length === 0) return alert("Izaberite folder sa fajlovima");

    try {
      // Priprema UI
      progressDiv.style.display = "block";
      progressBar.value = 0;
      statusText.textContent = "Packing files...";
      crustBtn.disabled = true;

      // Kreiraj CAR arhivu
      const { root, car } = await window.IpfsCar.packToBlob({
        input: files.map(file => ({
          path: file.webkitRelativePath || file.name,
          content: file
        })),
        wrapWithDirectory: true
      });

      const rootCid = root.toString();
      progressBar.value = 50;
      statusText.textContent = "Uploading to IPFS...";

      // Upload CAR fajla na Crust
      const formData = new FormData();
      formData.append("file", new Blob([car]), `${rootCid}.car`);

      const response = await fetch(`${CRUST_GATEWAY}/api/v0/add`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CRUST_AUTH}`
        },
        body: formData
      });

      if (!response.ok) throw new Error("Upload failed");

      // Prikaži rezultate
      crustCidEl.textContent = rootCid;
      crustUrlEl.href = `https://${rootCid}.ipfs.dweb.link`;
      crustUrlEl.textContent = `https://${rootCid}.ipfs.dweb.link`;
      crustResult.style.display = "block";

      // Omogući pinning
      pinCrustBtn.onclick = () => pinToCrust(rootCid);

    } catch (error) {
      console.error(error);
      alert(`Error: ${error.message}`);
    } finally {
      progressDiv.style.display = "none";
      crustBtn.disabled = false;
    }
  });

  // Funkcija za pinning
  async function pinToCrust(cid) {
    try {
      const response = await fetch(`${CRUST_GATEWAY}/api/v0/pin/add?arg=${cid}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CRUST_AUTH}`
        }
      });
      
      if (response.ok) {
        alert("Uspešno pinovano na Crust mrežu!");
      } else {
        throw new Error(await response.text());
      }
    } catch (error) {
      console.error(error);
      alert(`Pinning failed: ${error.message}`);
    }
  }
}

// ====================== UI: TABS / FLIP ======================
function positionIndicator() {
  if (!tabsWrap || !tabIndicator) return;
  const active = document.querySelector(".card-tab.active");
  if (!active) return;
  const wrapRect = tabsWrap.getBoundingClientRect();
  const btnRect  = active.getBoundingClientRect();
  const dx = btnRect.left - wrapRect.left;
  tabIndicator.style.width = btnRect.width + "px";
  tabIndicator.style.transform = `translateX(${dx}px)`;
}

function activateTab(which) {
  [tabPerper, tabDomain, tabHost].filter(Boolean).forEach(b => b.classList.remove("active"));
  if (which === "perper") {
    tabPerper?.classList.add("active");
    hostPane && (hostPane.style.display = "none");
    glassCard?.classList.remove("is-domain");
  } else if (which === "domain") {
    tabDomain?.classList.add("active");
    hostPane && (hostPane.style.display = "none");
    glassCard?.classList.add("is-domain"); // flip na BACK
  } else if (which === "host") {
    tabHost?.classList.add("active");
    hostPane && (hostPane.style.display = "block");
    glassCard?.classList.remove("is-domain"); // flip ostaje na front
  }
  positionIndicator();
}

// ====================== INIT / BINDINGS ======================
function bindUI() {
  // konverzije PRP <-> ETH
  buyPRPInput?.addEventListener("input", () => {
    const prpAmount = parseFloat(buyPRPInput.value) || 0;
    if (tokenPriceEth > 0 && buyETHInput) buyETHInput.value = (prpAmount * tokenPriceEth).toFixed(6);
  });
  buyETHInput?.addEventListener("input", () => {
    const ethAmount = parseFloat(buyETHInput.value) || 0;
    if (tokenPriceEth > 0 && buyPRPInput) buyPRPInput.value = (ethAmount / tokenPriceEth).toFixed(2);
  });

  // forme
  $("buy-form")?.addEventListener("submit", buyTokens);
  $("transfer-form")?.addEventListener("submit", transferTokens);

  // tabs
  tabPerper?.addEventListener("click", () => activateTab("perper"));
  tabDomain?.addEventListener("click", () => activateTab("domain"));
  tabHost  ?.addEventListener("click", () => activateTab("host"));
  window.addEventListener("resize", positionIndicator);

  // crust upload
  bindCrustUpload();
}

// start
window.addEventListener("DOMContentLoaded", () => {
  bindUI();
  positionIndicator();
  // connectWallet(); // ako želiš auto-connect
});

window.connectWallet = connectWallet;