// ====================== KONFIG ======================
const TOKEN_ADDRESS   = "0xf412de660d3914E2E5CdB5A476E35d291150C88D"; // PRP
const TOKEN_SYMBOL    = "PRP";
const TOKEN_IMAGE_URL = "https://gateway.pinata.cloud/ipfs/bafybeiayu4mujnlkwmajyo2xh2cpgpizapajatsk6jl7yx6wnk642ltnxi";

// --- Pinata config (Scoped JWT sa dozvolom: pinFileToIPFS, data:pinList, pinning:unpin) ---
const PINATA_JWT = "PASTE_SCOPED_JWT_HERE";
const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";

// ====== Domain Registry (cijena + kupovina) ======
const REGISTRY_ADDRESS = "0x286A49eF10bA8577833f4f8967F8c6b8fAe813De"; // tvoj deploy na Sepolia
const DOMAIN_ABI = [
  "function calculatePrice(string name) view returns (uint256)",
  "function registerDomain(string name)"
];
const PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com"; // read-only fallback RPC

let registryRO; // read-only (za cijenu)
let registry;   // write (za kupovinu)

// ====== PRP ABI (dodate approve/allowance) ======
const TOKEN_ABI = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"tokenPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"buyTokens","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
];

// ====================== STATE ======================
let provider, signer, prp, userAddress;
let tokenPriceEth = 0;
let prpDecimals = 18;

// ====================== HELPERS ======================
const $ = (id) => document.getElementById(id);

function debounce(fn, ms = 300) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function getReadProvider() {
  return provider || new ethers.providers.JsonRpcProvider(PUBLIC_SEPOLIA_RPC);
}
function ensureRegistries() {
  if (!registryRO) registryRO = new ethers.Contract(REGISTRY_ADDRESS, DOMAIN_ABI, getReadProvider());
  if (signer && !registry) registry = new ethers.Contract(REGISTRY_ADDRESS, DOMAIN_ABI, signer);
}

// ====================== DOM REFS ======================
const buyPRPInput = $("buy-amount");
const buyETHInput = $("buy-eth");
const walletAddrEl = $("wallet-address");
const tokenBalEl   = $("token-balance");

// Tabs / flip
const tabsWrap     = document.querySelector(".card-tabs");
const tabPerper    = $("tabPerper");
const tabDomain    = $("tabDomain");
const tabHost      = $("tabHost");
const tabIndicator = $("tabIndicator");
const glassCard    = document.querySelector(".glass-card");
const card3d       = $("flipCard");

// Back-side panels (isti flip; biramo koji se prikazuje)
const backDomain   = $("back-domain");
const backHost     = $("back-host");

// DOMAIN form refs
const domainForm       = $("domain-form");
const domainNameInput  = $("domain-name");
const domainPriceInput = $("domain-price");
const btnCheckPrice    = $("btnCheckPrice");

// Pinata Host refs
const pinataForm        = $("pinata-form");
const pinataFolder      = $("pinataFolder");
const pinataFiles       = $("pinataFiles");
const pinataResult      = $("pinataResult");
const pinataCidEl       = $("pinataCid");
const pinataUrlEl       = $("pinataUrl");
const pinataUrlDwebEl   = $("pinataUrlDweb");
const pinataBtn         = $("pinataUploadBtn");
const pinataProgDiv     = document.querySelector(".upload-progress.pinata");
const pinataProgBar     = pinataProgDiv?.querySelector("progress");
const pinataStatusText  = pinataProgDiv?.querySelector(".status");

// NOVO: liste pinova
const pinListEl      = document.getElementById("pinList");
const btnRefreshPins = document.getElementById("btnRefreshPins");
const pinFilterInput = document.getElementById("pinFilter");

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

    // pripremi write registry
    ensureRegistries();

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
        registry = null; // reset pa ponovo
        ensureRegistries();
      });
      window.ethereum.on("chainChanged", async () => {
        provider    = new ethers.providers.Web3Provider(window.ethereum);
        signer      = provider.getSigner();
        prp         = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
        prpDecimals = Number(await prp.decimals());
        await loadBalance();
        registry = null;
        ensureRegistries();
      });
    }

    listenTransfers();
  } catch (err) {
    console.error(err);
    alert("Wallet connect failed.");
  }
}

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
  } catch (e) { console.error("wallet_watchAsset error:", e); }
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
  } catch { tokenPriceEth = 0; }
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
  } catch (err) { console.error(err); alert("Buy failed"); }
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
  } catch (err) { console.error(err); alert("Transfer failed"); }
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

// ====================== DOMAIN: cijena + kupovina ======================
async function fetchDomainPrice(name) {
  ensureRegistries();
  const raw = await registryRO.calculatePrice(name);
  return raw; // BigNumber
}

async function onCheckPriceClick() {
  if (!domainNameInput || !domainPriceInput) return;
  const name = (domainNameInput.value || "").trim().toLowerCase();
  if (!name) { domainPriceInput.value = ""; return; }

  try {
    btnCheckPrice && (btnCheckPrice.disabled = true);
    domainPriceInput.value = "…";
    const raw = await fetchDomainPrice(name);
    domainPriceInput.value = `${ethers.utils.formatEther(raw)} PRP`;
  } catch (e) {
    console.warn("calculatePrice error:", e);
    domainPriceInput.value = "";
    alert("Ne mogu da izračunam cijenu za ovaj domen.");
  } finally {
    btnCheckPrice && (btnCheckPrice.disabled = false);
  }
}

async function buyDomainFlow(e){
  e?.preventDefault?.();
  if (!signer || !userAddress) return alert("Poveži wallet.");
  if (!prp) return alert("PRP contract nije spreman.");

  const name = (domainNameInput?.value || "").trim().toLowerCase();
  if (!name) return alert("Unesi domen (npr. luka.me).");

  try {
    ensureRegistries();

    // 1) cijena
    const rawPrice = await registryRO.calculatePrice(name);

    // 2) approve PRP (ako treba)
    const allowance = await prp.allowance(userAddress, REGISTRY_ADDRESS);
    if (allowance.lt(rawPrice)) {
      const txA = await prp.approve(REGISTRY_ADDRESS, rawPrice);
      await txA.wait();
    }

    // 3) register
    const btns = domainForm?.querySelectorAll("button");
    btns && btns.forEach(b => b.disabled = true);

    const tx = await registry.registerDomain(name);
    await tx.wait();
    alert(`Kupljen domen: ${name}`);

    // upiši cijenu ako polje postoji
    if (domainPriceInput) domainPriceInput.value = `${ethers.utils.formatEther(rawPrice)} PRP`;
  } catch (err) {
    console.error(err);
    alert("Kupovina nije uspjela (provjeri PRP balans/allowance i mrežu).");
  } finally {
    const btns = domainForm?.querySelectorAll("button");
    btns && btns.forEach(b => b.disabled = false);
  }
}

// ====================== PINATA UPLOAD (enforce single root + auto URL) ======================
function bindPinataUpload() {
  if (!pinataForm || !pinataFolder) return;

  const getTopFolderPrefix = (files) => {
    const paths = files.map(f => (f.webkitRelativePath || f.name));
    const firstSeg = (p) => p.includes("/") ? p.split("/")[0] : "";
    const first = firstSeg(paths[0] || "");
    if (!first) return "";
    const allSame = paths.every(p => p.includes("/") && p.split("/")[0] === first);
    return allSame ? (first + "/") : "";
  };

  // samo prikaz liste
  pinataFolder.addEventListener("change", () => {
    if (!pinataFiles) return;
    pinataFiles.innerHTML = "";
    const files = Array.from(pinataFolder.files).sort((a, b) =>
      (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name)
    );
    files.forEach(file => {
      const li = document.createElement("li");
      li.textContent = file.webkitRelativePath || file.name;
      pinataFiles.appendChild(li);
    });
  });

  pinataForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const files = Array.from(pinataFolder.files);
    if (!files.length) return alert("Izaberi folder sa fajlovima.");
    if (!PINATA_JWT || PINATA_JWT.startsWith("PASTE_")) {
      return alert("Dodaj PINATA_JWT u app.js (Scoped JWT sa pinFileToIPFS).");
    }

    // 1) Osiguraj JEDAN root: stvarni top-folder ili virtuelni "site/"
    const realTop = getTopFolderPrefix(files);        // npr. "mojSajt/"
    const rootDir = (realTop ? realTop.replace(/\/$/, "") : "site"); // ime bez "/"

    // 2) Provjera da index.html postoji UNUTAR root-a
    const hasIndex = files.some(f => {
      const p = (f.webkitRelativePath || f.name).toLowerCase();
      return realTop
        ? p === (realTop + "index.html").toLowerCase() || p.endsWith("/index.html")
        : p.endsWith("index.html"); // dodaćemo "site/" ispod
    });
    if (!hasIndex) return alert("Folder mora sadržati index.html u root-u projekta.");

    try {
      pinataProgDiv.style.display = "block";
      pinataProgBar.value = 0;
      pinataStatusText.textContent = "Preparing form data...";
      pinataBtn.disabled = true;

      const fd = new FormData();
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const metaName = `site-${ts}`;

      files.forEach(file => {
        const original = file.webkitRelativePath || file.name;
        // Ako nema zajedničkog top-foldera, nametni virtuelni "site/"
        const filename = realTop ? original : `${rootDir}/${original}`;
        fd.append("file", file, filename);
      });

      fd.append("pinataMetadata", JSON.stringify({ name: metaName }));
      fd.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", PINATA_ENDPOINT, true);
      xhr.setRequestHeader("Authorization", `Bearer ${PINATA_JWT}`);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          pinataProgBar.value = pct;
          pinataStatusText.textContent = `Uploading... ${pct}%`;
        }
      };

      xhr.onload = () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText);
            const cid = data.IpfsHash;
            pinataCidEl.textContent = cid;

            // AUTOMATSKI uključi rootDir u URL da odmah otvara index.html
            const rootPath = encodeURIComponent(rootDir);
            const ipfsUrl  = `https://ipfs.io/ipfs/${cid}/${rootPath}/`;
            const dwebUrl  = `https://${cid}.ipfs.dweb.link/${rootPath}/`;

            pinataUrlEl.href = ipfsUrl;
            pinataUrlEl.textContent = ipfsUrl;
            if (pinataUrlDwebEl) {
              pinataUrlDwebEl.href = dwebUrl;
              pinataUrlDwebEl.textContent = dwebUrl;
            }
            pinataResult.style.display = "block";
            pinataStatusText.textContent = "Done.";
          } else {
            console.error("Pinata response:", xhr.status, xhr.responseText);
            alert(`Pinata upload failed (${xhr.status}): ${xhr.responseText}`);
          }
        } catch (err) {
          console.error(err);
          alert("Invalid response from Pinata API.");
        } finally {
          pinataProgDiv.style.display = "none";
          pinataBtn.disabled = false;
        }
      };

      xhr.onerror = () => {
        alert("Network/Pinata error.");
        pinataProgDiv.style.display = "none";
        pinataBtn.disabled = false;
      };

      xhr.send(fd);

    } catch (err) {
      console.error(err);
      alert(`Greška: ${err.message}`);
      pinataProgDiv.style.display = "none";
      pinataBtn.disabled = false;
    }
  });
}

// ====================== Pinata list & delete ======================
async function pinataList({ query = "", limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({
    status: "pinned",
    pageLimit: String(limit),
    pageOffset: String(offset),
    sort: "date_pinned",
    dir: "desc"
  });
  if (query) params.set("metadata[nameContains]", query);

  const res = await fetch(`https://api.pinata.cloud/data/pinList?${params.toString()}`, {
    headers: { "Authorization": `Bearer ${PINATA_JWT}` }
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data.rows) ? data.rows : [];
}

async function pinataUnpin(cid) {
  const res = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${PINATA_JWT}` }
  });
  if (!res.ok) throw new Error(await res.text());
}

function renderPins(rows) {
  if (!pinListEl) return;
  pinListEl.innerHTML = "";
  if (!rows.length) {
    pinListEl.innerHTML = "<li class='hint'>No pins found.</li>";
    return;
  }
  rows.forEach(r => {
    const cid  = r.ipfs_pin_hash || r.IpfsHash || r.cid || "";
    const name = (r.metadata && r.metadata.name) ? r.metadata.name : "(no name)";
    const date = r.date_pinned ? (new Date(r.date_pinned)).toLocaleString() : "";
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.gap = "8px";
    li.style.alignItems = "center";
    li.style.flexWrap = "wrap";
    li.innerHTML = `
      <code style="background:#0f1528; padding:2px 6px; border-radius:6px">${name}</code>
      <a href="https://ipfs.io/ipfs/${cid}/" target="_blank" rel="noopener">${cid}</a>
      <small style="opacity:.75">${date}</small>
      <span style="flex:1"></span>
      <button data-cid="${cid}" class="btnDel" style="background:#e86b6b;color:#2a0a0a;border:0;border-radius:10px;padding:6px 10px;cursor:pointer">Delete</button>
    `;
    pinListEl.appendChild(li);
  });
}

async function refreshPins() {
  if (!PINATA_JWT || PINATA_JWT.startsWith("PASTE_")) {
    alert("PINATA_JWT nije postavljen.");
    return;
  }
  const q = (pinFilterInput?.value || "").trim();
  try {
    const rows = await pinataList({ query: q, limit: 50, offset: 0 });
    const filtered = q ? rows.filter(r => {
      const cid  = r.ipfs_pin_hash || r.IpfsHash || "";
      const name = (r.metadata && r.metadata.name) ? r.metadata.name : "";
      return cid.includes(q) || name.toLowerCase().includes(q.toLowerCase());
    }) : rows;
    renderPins(filtered);
  } catch (e) {
    console.error(e);
    alert("Ne mogu da učitam listu sa Pinata-e.");
  }
}

// klikovi na listi (Delete)
pinListEl?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.classList.contains("btnDel")) {
    const cid = btn.dataset.cid;
    if (!cid) return;
    if (!confirm(`Unpin ${cid}?`)) return;
    try {
      await pinataUnpin(cid);
      await refreshPins();
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  }
});

btnRefreshPins?.addEventListener("click", refreshPins);

// ====================== FLIP TABS (isti flip za 3 taba) ======================
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

function showBackPanel(whichBack) {
  if (backDomain) backDomain.style.display = (whichBack === "domain" ? "block" : "none");
  if (backHost)   backHost.style.display   = (whichBack === "host"   ? "block" : "none");
}

function equalizeCardHeight() {
  const front = document.querySelector(".card-front");
  const hFront = front ? front.scrollHeight : 0;
  const hBackDomain = backDomain ? backDomain.scrollHeight : 0;
  const hBackHost   = backHost   ? backHost.scrollHeight   : 0;
  const maxH = Math.max(hFront, hBackDomain, hBackHost, 420);
  if (card3d) card3d.style.height = maxH + "px";
}

function activateTab(which) {
  [tabPerper, tabDomain, tabHost].forEach(b => b.classList.remove("active"));
  if (which === "perper") {
    tabPerper?.classList.add("active");
    glassCard?.classList.remove("is-domain");
  } else if (which === "domain") {
    tabDomain?.classList.add("active");
    showBackPanel("domain");
    glassCard?.classList.add("is-domain");
  } else if (which === "host") {
    tabHost?.classList.add("active");
    showBackPanel("host");
    glassCard?.classList.add("is-domain");
    // učitaj moju listu pinova kad otvorim Host tab
    setTimeout(refreshPins, 150);
  }
  positionIndicator();
  setTimeout(equalizeCardHeight, 50);
}

// ====================== INIT ======================
function bindUI() {
  // PRP <-> ETH
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

  // gornji tabovi
  tabPerper?.addEventListener("click", () => activateTab("perper"));
  tabDomain?.addEventListener("click", () => {
    activateTab("domain");
    setTimeout(() => ensureRegistries(), 100);
  });
  tabHost  ?.addEventListener("click", () => activateTab("host"));
  window.addEventListener("resize", () => setTimeout(equalizeCardHeight, 50));

  // Domain actions
  btnCheckPrice?.addEventListener("click", onCheckPriceClick);
  domainForm?.addEventListener("submit", buyDomainFlow);

  // Pinata upload
  bindPinataUpload();
}

window.addEventListener("DOMContentLoaded", () => {
  bindUI();
  positionIndicator();
  equalizeCardHeight();
  // connectWallet(); // ako želiš auto-connect
});

window.connectWallet = connectWallet;
