// ====================== KONFIG ======================
const TOKEN_ADDRESS   = "0xf412de660d3914E2E5CdB5A476E35d291150C88D"; // PRP
const TOKEN_SYMBOL    = "PRP";
const TOKEN_IMAGE_URL = "https://gateway.pinata.cloud/ipfs/bafybeiayu4mujnlkwmajyo2xh2cpgpizapajatsk6jl7yx6wnk642ltnxi";

// --- Pinata config (Scoped JWT: pinFileToIPFS, data:pinList, pinning:unpin) ---
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxOTdmOGNkZi1lZWI3LTRiMmMtODI1MC1mN2NlZTZiZmU2OTEiLCJlbWFpbCI6Imx1a2FyYWR1bG92aWMxOTk4QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJjOGVhZDhlZWZiOTgyYjNhMjYzMyIsInNjb3BlZEtleVNlY3JldCI6IjNlMjk0MmVhZTZmZWMyZmYxYzE4NDRkYzY4NjdmZWJjMDIyNzkwMmIxNDZlMjA0NWMxNzNiZDgwYjM3N2UwY2QiLCJleHAiOjE3ODY2NDYyNDN9.Oo02AwpOKs-fzvYn6So4r_gTk7dL12Qy8yuM6t7fVQg";
const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";

// ====== Domain Registry (cijene, kupovina, hosting, receiver) ======
const REGISTRY_ADDRESS = "0x286A49eF10bA8577833f4f8967F8c6b8fAe813De"; // Sepolia

const DOMAIN_ABI = [
  // osnovno
  "function calculatePrice(string name) view returns (uint256)",
  "function registerDomain(string name)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function nameToId(string name) view returns (uint256)",
  "function tokenIdOf(string name) view returns (uint256)",
  "function domains(uint256) view returns (tuple(string name,uint256 cost,uint64 expiresAt,string ipfsHash,string siteCID,string siteURL,uint32 storageLimit,uint32 usedStorage,address receiver))",
  // hosting
  "function setSiteCID(uint256 id, string cid)",
  "function setSiteURL(uint256 id, string url)",
  "function getSiteCID(string name) view returns (string)",
  "function getSiteURL(string name) view returns (string)",
  // receiver
  "function setReceiver(uint256 id, address receiver)",
  "function getReceiver(string name) view returns (address)",
  // events (za fallback čitanje imena)
  "event DomainRegistered(uint256 indexed id, string name, address owner, uint256 price)"
];

// ====== PRP ABI (approve/allowance/buy/transfer) ======
const TOKEN_ABI = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"tokenPrice","outputs":[{"internalType":"uint256","name":"priceWei","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"buyTokens","outputs":[{"internalType":"bool","name":"success","type":"bool"}],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
];

const PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

// ====================== STATE ======================
let provider, signer, prp, userAddress;
let registryRO, registry;            // read-only i write
let tokenPriceEth = 0, prpDecimals = 18;
let hasDomainAccess = false;
let currentDomainId = null;          // tokenId domena koji user posjeduje/je izabrao
let currentDomainName = "";          // ime domena (ako ga pročitamo)
let ownedDomainIds = [];             // lista tokenId-ova koje user posjeduje
let domainCache = {};                // id -> {name, siteCID, siteURL, receiver}

// ====================== HELPERS ======================
const $ = (id) => document.getElementById(id);
const isAddr = (v) => { try { return ethers.utils.isAddress(v); } catch { return false; } };
const getReadProvider = () => provider || new ethers.providers.JsonRpcProvider(PUBLIC_SEPOLIA_RPC);
function ensureRegistries() {
  if (!registryRO) registryRO = new ethers.Contract(REGISTRY_ADDRESS, DOMAIN_ABI, getReadProvider());
  if (signer && !registry) registry = new ethers.Contract(REGISTRY_ADDRESS, DOMAIN_ABI, signer);
}

// Transfer topic (ERC721)
const TRANSFER_TOPIC = ethers.utils.id("Transfer(address,address,uint256)");
// Interface za parsiranje DomainRegistered fallback-a
const DOMAIN_IFACE = new ethers.utils.Interface([
  "event DomainRegistered(uint256 indexed id, string name, address owner, uint256 price)"
]);

// ====================== DOM REFS ======================
// PRP buy/transfer
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

// Back panels
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

// Pinata lista
const pinListEl      = document.getElementById("pinList");
const btnRefreshPins = document.getElementById("btnRefreshPins");
const pinFilterInput = document.getElementById("pinFilter");

// Domain select (ako postoji u HTML-u)
let domainSelectEl = $("domainSelect");

// ====================== PERSIST KEYS ======================
const selKey = (addr) => `selected_domain_${(addr||"").toLowerCase()}`;

// ====================== HOST TAB GATING & OTKRIVANJE NFT-A ======================
function toggleHostTab(enabled) {
  if (!tabHost) return;
  hasDomainAccess = !!enabled;
  tabHost.style.display = enabled ? "" : "none";
  if (!enabled && tabHost.classList.contains("active")) activateTab("domain");
  positionIndicator();
  setTimeout(equalizeCardHeight, 50);
}

// ---- lista domena iz Transfer logova (bez brute-force ownerOf skeniranja) ----
async function listOwnedTokenIdsByLogs(ownerAddr) {
  ensureRegistries();
  const target = (ownerAddr || "").toLowerCase();
  if (!target || !isAddr(target)) return [];

  const readProv = getReadProvider();
  const filter = {
    address: REGISTRY_ADDRESS,
    topics: [
      TRANSFER_TOPIC,                              // Transfer topic
      null,                                        // from (bilo ko)
      ethers.utils.hexZeroPad(target, 32)          // to == ownerAddr
    ],
    fromBlock: 0,
    toBlock: "latest"
  };

  let logs = [];
  try {
    logs = await readProv.getLogs(filter);
  } catch (e) {
    console.warn("getLogs failed:", e);
    return [];
  }

  const set = new Set();
  for (const lg of logs) {
    try {
      // ERC721: tokenId je INDEXED => topics[3]
      const topicTokenId = lg.topics[3];
      const idBN = ethers.BigNumber.from(topicTokenId);
      const id = idBN.toNumber ? idBN.toNumber() : Number(idBN);
      if (Number.isFinite(id)) set.add(id);
    } catch {}
  }

  // potvrdi da i dalje pripada useru
  const ids = Array.from(set);
  const owned = [];
  for (const id of ids) {
    try {
      const o = await registryRO.ownerOf(id);
      if ((o || "").toLowerCase() === target) owned.push(id);
    } catch {
      // ignoriši (npr. burn/nepostojeći)
    }
  }
  return owned.sort((a,b)=>a-b);
}

// ---- helper: vrati ime domena po ID-u; primarno iz structa, fallback iz event loga ----
async function getDomainNameById(id) {
  ensureRegistries();

  // 1) pokušaj iz structa
  try {
    const d = await registryRO.domains(id);
    const nm = (d?.name || "").trim();
    if (nm) return nm.toLowerCase();
  } catch {/* ignore */}

  // 2) fallback: DomainRegistered(id, name, ...)
  try {
    const idTopic = ethers.utils.hexZeroPad(ethers.BigNumber.from(id).toHexString(), 32);
    const filter = {
      address: REGISTRY_ADDRESS,
      topics: [ DOMAIN_IFACE.getEventTopic("DomainRegistered"), idTopic ],
      fromBlock: 0,
      toBlock: "latest"
    };
    const logs = await getReadProvider().getLogs(filter);
    if (logs.length) {
      // uzmi najnoviji za taj ID
      const parsed = DOMAIN_IFACE.parseLog(logs[logs.length - 1]);
      const nm = (parsed.args.name || "").trim();
      if (nm) return nm.toLowerCase();
    }
  } catch (e) {
    console.warn("fallback name via logs failed for id", id, e);
  }

  return ""; // nema imena
}

function populateDomainSelector() {
  // Ako nema select element u HTML-u, napravi ga iznad forme za upload
  if (!domainSelectEl) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "8px";
    wrap.style.alignItems = "center";
    wrap.style.margin = "8px 0 16px 0";

    const label = document.createElement("label");
    label.textContent = "Domen:";
    label.style.minWidth = "60px";

    domainSelectEl = document.createElement("select");
    domainSelectEl.id = "domainSelect";
    domainSelectEl.style.padding = "6px 10px";
    domainSelectEl.style.borderRadius = "10px";
    domainSelectEl.style.border = "1px solid #2b365a";
    domainSelectEl.style.background = "#0b1226";
    domainSelectEl.style.color = "#cfd7ff";

    wrap.appendChild(label);
    wrap.appendChild(domainSelectEl);

    // umetni ispred pinata forme
    if (backHost) backHost.insertBefore(wrap, backHost.firstChild);
  }

  // napuni opcije
  domainSelectEl.innerHTML = "";
  if (!ownedDomainIds.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nema domena";
    domainSelectEl.appendChild(opt);
    domainSelectEl.disabled = true;
    return;
  }

  domainSelectEl.disabled = false;

  ownedDomainIds.forEach((id) => {
    const d = domainCache[id] || {};
    const nm = (d.name || "").trim();
    const opt = document.createElement("option");
    opt.value = String(id);                      // value ostaje ID (za logiku)
    opt.textContent = nm || "(unknown domain)";  // prikaz = naziv domena
    domainSelectEl.appendChild(opt);
  });

  if (currentDomainId && ownedDomainIds.includes(currentDomainId)) {
    domainSelectEl.value = String(currentDomainId);
  } else {
    domainSelectEl.value = String(ownedDomainIds[0]);
  }

  // onChange
  domainSelectEl.onchange = async () => {
    const pick = Number(domainSelectEl.value);
    setCurrentDomain(pick);
    await updateUploadFormVisibility();
    await refreshPins();
  };
}

function setCurrentDomain(id) {
  if (!id || !ownedDomainIds.includes(id)) return;
  currentDomainId = id;
  const d = domainCache[id] || {};
  currentDomainName = (d.name || "").toLowerCase();
  if (userAddress) localStorage.setItem(selKey(userAddress), String(id));
}

async function loadOwnedDomainsForUser() {
  ownedDomainIds = [];
  domainCache = {};
  currentDomainId = null;
  currentDomainName = "";
  if (!userAddress) { toggleHostTab(false); return; }

  try {
    ensureRegistries();
    const cnt = await (registry || registryRO).balanceOf(userAddress);
    toggleHostTab(cnt.gt(0));
    if (!cnt.gt(0)) return;

    ownedDomainIds = await listOwnedTokenIdsByLogs(userAddress);

    await Promise.all(ownedDomainIds.map(async (id) => {
      let nm = "";
      let siteCID = "", siteURL = "", receiver = "";

      // pokušaj pročitati kompletan struct
      try {
        const d = await registryRO.domains(id);
        siteCID  = d?.siteCID || d?.ipfsHash || "";
        siteURL  = d?.siteURL || "";
        receiver = d?.receiver || "";
        nm       = (d?.name || "").toLowerCase();
      } catch {/* ignore */}

      // fallback ime iz event loga
      if (!nm) nm = await getDomainNameById(id);

      domainCache[id] = { name: nm, siteCID, siteURL, receiver };
    }));

    // validiraj/odaberi aktivni
    const saved = Number(localStorage.getItem(selKey(userAddress)) || "0");
    let pick = (saved && ownedDomainIds.includes(saved)) ? saved : (ownedDomainIds[0] || null);

    if (pick) {
      try {
        const o = await registryRO.ownerOf(pick);
        if ((o || "").toLowerCase() !== userAddress.toLowerCase()) pick = null;
      } catch { pick = null; }
    }
    if (!pick) {
      for (const id of ownedDomainIds) {
        try {
          const oo = await registryRO.ownerOf(id);
          if ((oo || "").toLowerCase() === userAddress.toLowerCase()) { pick = id; break; }
        } catch {}
      }
    }
    if (pick) setCurrentDomain(pick);

    populateDomainSelector();
  } catch (e) {
    console.warn("loadOwnedDomainsForUser error:", e);
  }
}

async function updateHostAccess() {
  try {
    ensureRegistries();
    if (!userAddress) { toggleHostTab(false); return; }
    const cnt = await (registry || registryRO).balanceOf(userAddress);
    toggleHostTab(cnt.gt(0));
    if (cnt.gt(0)) {
      await loadOwnedDomainsForUser();
      await updateUploadFormVisibility(); // uskladi upload UI odmah
    }
  } catch (e) {
    console.warn("balanceOf check failed:", e);
    toggleHostTab(false);
  }
}

// ============= UTIL: čitanje on-chain stanja sajta i kontrola upload forme ============
async function readCurrentOnChainSite() {
  ensureRegistries();
  if (!currentDomainId) return { cid: "", url: "" };
  try {
    const d = await (registry || registryRO).domains(currentDomainId);
    const cid = (d?.siteCID || d?.ipfsHash || "").trim();
    const url = (d?.siteURL || "").trim();
    return { cid, url };
  } catch {
    return { cid: "", url: "" };
  }
}

function showUploadForm() {
  if (pinataForm) pinataForm.style.display = "";
  // sekcija "Selected Files"
  if (pinataFiles?.parentElement?.parentElement) pinataFiles.parentElement.parentElement.style.display = "";
  if (pinataResult) {
    pinataResult.style.display = "none";
    // pinataForm.style.display = "none";
    if (pinataCidEl) pinataCidEl.textContent = "";
    if (pinataUrlEl) { pinataUrlEl.href = "#"; pinataUrlEl.textContent = "open via ipfs.io"; }
    if (pinataUrlDwebEl) { pinataUrlDwebEl.href = "#"; pinataUrlDwebEl.textContent = "dweb.link"; }
  } 
    
}

function showCurrentSite(cid, url) {
  if (pinataForm) pinataForm.style.display = "none";
  if (pinataFiles?.parentElement?.parentElement) pinataFiles.parentElement.parentElement.style.display = "none";
  if (pinataResult) {
    pinataResult.style.display = "block";
    if (pinataCidEl) pinataCidEl.textContent = cid || "(no CID)";
    const u = url || (cid ? `https://ipfs.io/ipfs/${cid}/` : "#");
    if (pinataUrlEl) { pinataUrlEl.href = u; pinataUrlEl.textContent = u; }
    if (pinataUrlDwebEl) {
      const dweb = cid ? `https://${cid}.ipfs.dweb.link/` : "#";
      pinataUrlDwebEl.href = dweb;
      pinataUrlDwebEl.textContent = dweb;
    }
  }
}

async function updateUploadFormVisibility() {
  try {
    if (!hasDomainAccess || !currentDomainId) { showUploadForm(); return; }
    const { cid, url } = await readCurrentOnChainSite();
    if (cid || url) showCurrentSite(cid, url);
    else showUploadForm();
    setTimeout(equalizeCardHeight, 50);
  } catch (e) {
    console.warn("updateUploadFormVisibility:", e);
  }
}

// ====================== WALLET ======================
async function connectWallet() {
  if (!window.ethereum) return alert("MetaMask nije instaliran!");
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider    = new ethers.providers.Web3Provider(window.ethereum);
    signer      = provider.getSigner();
    userAddress = await signer.getAddress();
    prp         = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);

    walletAddrEl && (walletAddrEl.innerText = "Wallet: " + userAddress);

    prpDecimals = Number(await prp.decimals());
    await loadBalance();
    await loadTokenPrice();
    await addTokenToMetaMaskOnce(userAddress);

    ensureRegistries();
    await updateHostAccess();

    // očisti stari selection ako više nije važeći
    try {
      if (userAddress && currentDomainId && !ownedDomainIds.includes(currentDomainId)) {
        localStorage.removeItem(selKey(userAddress));
      }
    } catch {}

    if (window.ethereum?.on) {
      window.ethereum.on("accountsChanged", async () => {
        provider    = new ethers.providers.Web3Provider(window.ethereum);
        signer      = provider.getSigner();
        userAddress = await signer.getAddress();
        prp         = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
        prpDecimals = Number(await prp.decimals());
        walletAddrEl && (walletAddrEl.innerText = "Wallet: " + userAddress);
        await addTokenToMetaMaskOnce(userAddress);
        await loadBalance();
        registry = null; ensureRegistries();
        await updateHostAccess();
      });
      window.ethereum.on("chainChanged", async () => {
        provider    = new ethers.providers.Web3Provider(window.ethereum);
        signer      = provider.getSigner();
        prp         = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
        prpDecimals = Number(await prp.decimals());
        await loadBalance();
        registry = null; ensureRegistries();
        await updateHostAccess();
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
      params: { type: "ERC20", options: { address: TOKEN_ADDRESS, symbol: TOKEN_SYMBOL, decimals: prpDecimals, image: TOKEN_IMAGE_URL } }
    });

    if (wasAdded) {
      imported.push(TOKEN_ADDRESS.toLowerCase());
      localStorage.setItem(key, JSON.stringify(imported));
    }
  } catch (e) { console.error("wallet_watchAsset error:", e); }
}

// ====================== TOKEN: balance/buy/transfer ======================
async function loadBalance() {
  if (!prp || !userAddress || !tokenBalEl) return;
  const bal = await prp.balanceOf(userAddress);
  tokenBalEl.innerText = `Balance: ${ethers.utils.formatUnits(bal, prpDecimals)} PRP`;
}
async function loadTokenPrice() {
  if (!prp) return;
  try { tokenPriceEth = parseFloat(ethers.utils.formatEther(await prp.tokenPrice())); }
  catch { tokenPriceEth = 0; }
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

// --- transfer PRP sa podrškom za domen kao primaoca ---
async function resolveDomainToAddress(domainName) {
  ensureRegistries();
  const nm = (domainName || "").trim().toLowerCase();
  if (!nm) throw new Error("Prazan domen.");
  let recv;
  try { recv = await registryRO.getReceiver(nm); } catch {}
  if (!recv || recv === ethers.constants.AddressZero) {
    const id = await registryRO.tokenIdOf(nm);
    if (!id || id.eq(0)) throw new Error("Domen ne postoji.");
    recv = await registryRO.ownerOf(id);
  }
  if (!isAddr(recv)) throw new Error("Nevalidan primaoc.");
  return recv;
}

async function transferTokens(e) {
  e?.preventDefault?.();
  if (!prp || !userAddress) return alert("Connect wallet prvo.");

  const recipientRaw = $("recipient")?.value?.trim();
  const amountStr    = $("amount")?.value?.trim();
  if (!recipientRaw || !amountStr) return alert("Unesi primaoca i iznos.");

  let toAddress = null;
  if (isAddr(recipientRaw)) toAddress = recipientRaw;
  else {
    try { toAddress = await resolveDomainToAddress(recipientRaw); }
    catch (err) { console.error(err); return alert("Primaoc nije adresa niti validan domen."); }
  }

  const parsedAmount = ethers.utils.parseUnits(amountStr, prpDecimals);
  try {
    const tx = await prp.transfer(toAddress, parsedAmount);
    await tx.wait();
    alert(`Poslano ${amountStr} PRP na ${toAddress}`);
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
  return await registryRO.calculatePrice(name);
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

async function buyDomainFlow(e) {
  e?.preventDefault?.();
  if (!signer || !userAddress) return alert("Poveži wallet.");
  if (!prp) return alert("PRP contract nije spreman.");

  const name = (domainNameInput?.value || "").trim().toLowerCase();
  if (!name) return alert("Unesi domen (npr. luka.me).");

  try {
    ensureRegistries();

    // 1) cijena
    const rawPrice = await registryRO.calculatePrice(name);

    // 2) approve PRP
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

    // 4) post-setup
    try {
      const id = await registryRO.tokenIdOf(name);
      const owner = await registryRO.ownerOf(id);
      const d = await registryRO.domains(id);
      if (!d?.receiver || d.receiver === ethers.constants.AddressZero || d.receiver.toLowerCase() !== owner.toLowerCase()) {
        await (await registry.setReceiver(id, owner)).wait();
      }
      currentDomainId = id.toNumber ? id.toNumber() : Number(id);
      currentDomainName = name;
      if (!ownedDomainIds.includes(currentDomainId)) ownedDomainIds.push(currentDomainId);
      domainCache[currentDomainId] = {
        name,
        siteCID: "",
        siteURL: "",
        receiver: owner
      };
    } catch (e2) { console.warn("setReceiver post-setup skip:", e2?.message || e2); }

    await updateHostAccess();
    if (domainPriceInput) domainPriceInput.value = `${ethers.utils.formatEther(rawPrice)} PRP`;

  } catch (err) {
    console.error(err);
    alert("Kupovina nije uspjela (provjeri PRP balans/allowance i mrežu).");
  } finally {
    const btns = domainForm?.querySelectorAll("button");
    btns && btns.forEach(b => b.disabled = false);
  }
}

// ====================== ON-CHAIN UPDATE POSLIJE UPLOAD-A / DELETE-A ======================
async function updateDomainOnChainById(cid, webUrl) {
  if (!signer || !userAddress) { alert("Poveži wallet."); return; }
  if (!currentDomainId) { await loadOwnedDomainsForUser(); }
  const id = currentDomainId;
  if (!id) return alert("Nije pronađen domen (tokenId) za ovaj wallet.");

  ensureRegistries();
  try {
    let ownerAddr;
    try {
      ownerAddr = await (registry || registryRO).ownerOf(id);
    } catch {
      await loadOwnedDomainsForUser();
      if (!currentDomainId) throw new Error("Nevažeći tokenId (nema domena).");
      ownerAddr = await (registry || registryRO).ownerOf(currentDomainId);
    }
    if ((ownerAddr || "").toLowerCase() !== userAddress.toLowerCase()) {
      return alert("Nisi vlasnik ovog domena.");
    }

    const tx1 = await registry.setSiteCID(currentDomainId, cid || "");
    await tx1.wait();
    const tx2 = await registry.setSiteURL(currentDomainId, webUrl || "");
    await tx2.wait();

    // update cache
    if (!domainCache[currentDomainId]) domainCache[currentDomainId] = {};
    domainCache[currentDomainId].siteCID = cid || "";
    domainCache[currentDomainId].siteURL = webUrl || "";

    await updateUploadFormVisibility();
    alert(cid ? "Sajt povezan sa domenom ✅" : "Sajt uklonjen sa domena ✅");
  } catch (e) {
    console.error("updateDomainOnChainById error:", e);
    alert("Nije uspjelo upisivanje/brisanje CID/URL na domen.");
  }
}

async function getCurrentDomainCid() {
  const { cid } = await readCurrentOnChainSite();
  return cid;
}

// ====================== PINATA UPLOAD ======================
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

  // lista fajlova
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
    if (!PINATA_JWT || PINATA_JWT.startsWith("PASTE_")) return alert("Dodaj PINATA_JWT u app.js.");

    const ownerAddr = (userAddress || "").toLowerCase();
    if (!ownerAddr) return alert("Poveži wallet prije uploada.");

    if (!currentDomainId) await loadOwnedDomainsForUser();
    if (!currentDomainId) return alert("Nije pronađen domen za ovaj wallet.");

    // root folder + index.html validacija
    const realTop = getTopFolderPrefix(files);                     // npr. "mojSajt/"
    const rootDir = (realTop ? realTop.replace(/\/$/, "") : "site");
    const hasIndex = files.some(f => {
      const p = (f.webkitRelativePath || f.name).toLowerCase();
      return realTop ? p === (realTop + "index.html").toLowerCase() || p.endsWith("/index.html")
                     : p.endsWith("index.html");
    });
    if (!hasIndex) return alert("Folder mora sadržati index.html u root-u projekta.");

    try {
      if (pinataProgDiv) pinataProgDiv.style.display = "block";
      if (pinataProgBar) pinataProgBar.value = 0;
      if (pinataStatusText) pinataStatusText.textContent = "Preparing form data...";
      if (pinataBtn) pinataBtn.disabled = true;

      const fd = new FormData();
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const metaName = `site-${ts}`;

      // Ako nema pravog top foldera, virtualizuj ga pod "site/"
      files.forEach(file => {
        const original = file.webkitRelativePath || file.name;
        const filename = realTop ? original : `${rootDir}/${original}`;
        fd.append("file", file, filename);
      });

      fd.append("pinataMetadata", JSON.stringify({
        name: metaName,
        keyvalues: {
          owner: ownerAddr,
          tokenId: String(currentDomainId),
          ...(currentDomainName ? { domain: currentDomainName } : {})
        }
      }));
      fd.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", PINATA_ENDPOINT, true);
      xhr.setRequestHeader("Authorization", `Bearer ${PINATA_JWT}`);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && pinataProgBar && pinataStatusText) {
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
            if (pinataCidEl) pinataCidEl.textContent = cid;

            const rootPath       = encodeURIComponent(rootDir);
            const ipfsUrl        = `https://ipfs.io/ipfs/${cid}`;
            const ipfsUrlRooted  = `https://ipfs.io/ipfs/${cid}/${rootPath}/`;
            const dwebUrl        = `https://${cid}.ipfs.dweb.link/${rootPath}/`;

            if (pinataUrlEl) { pinataUrlEl.href = ipfsUrl; pinataUrlEl.textContent = ipfsUrl; }
            if (pinataUrlDwebEl) { pinataUrlDwebEl.href = dwebUrl; pinataUrlDwebEl.textContent = dwebUrl; }
            if (pinataResult) pinataResult.style.display = "block";
            if (pinataStatusText) pinataStatusText.textContent = "Done.";

            // upiši na NFT (CID + URL) i sakrij formu
            updateDomainOnChainById(cid, ipfsUrlRooted);
          } else {
            console.error("Pinata response:", xhr.status, xhr.responseText);
            alert(`Pinata upload failed (${xhr.status}): ${xhr.responseText}`);
          }
        } catch (err) {
          console.error(err);
          alert("Invalid response from Pinata API.");
        } finally {
          if (pinataProgDiv) pinataProgDiv.style.display = "none";
          if (pinataBtn) pinataBtn.disabled = false;
        }
      };

      xhr.onerror = () => {
        alert("Network/Pinata error.");
        if (pinataProgDiv) pinataProgDiv.style.display = "none";
        if (pinataBtn) pinataBtn.disabled = false;
      };

      xhr.send(fd);
    } catch (err) {
      console.error(err);
      alert(`Greška: ${err.message}`);
      if (pinataProgDiv) pinataProgDiv.style.display = "none";
      if (pinataBtn) pinataBtn.disabled = false;
    }
  });
}

// ====================== Pinata list & delete (filter: owner + tokenId) ======================
async function pinataList({ query = "", limit = 50, offset = 0 } = {}) {
  if (!userAddress) throw new Error("Connect wallet prvo.");
  const params = new URLSearchParams({
    status: "pinned",
    pageLimit: String(limit),
    pageOffset: String(offset),
    sort: "date_pinned",
    dir: "desc"
  });
  params.set("metadata[keyvalues][owner]", JSON.stringify({ value: userAddress.toLowerCase(), op: "eq" }));
  if (currentDomainId) params.set("metadata[keyvalues][tokenId]", JSON.stringify({ value: String(currentDomainId), op: "eq" }));
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
  if (!PINATA_JWT || PINATA_JWT.startsWith("PASTE_")) { alert("PINATA_JWT nije postavljen."); return; }
  if (!userAddress) {
    if (pinListEl) pinListEl.innerHTML = "<li class='hint'>Connect wallet da vidiš svoje fajlove.</li>";
    return;
  }
  if (!currentDomainId) await loadOwnedDomainsForUser();
  try {
    const q = (pinFilterInput?.value || "").trim();
    const rows = await pinataList({ query: q, limit: 50, offset: 0 });
    renderPins(rows);
  } catch (e) {
    console.error(e);
    alert("Ne mogu da učitam listu sa Pinata-e.");
  }
}

pinListEl?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.classList.contains("btnDel")) {
    const cid = btn.dataset.cid;
    if (!cid) return;
    if (!confirm(`Unpin ${cid}?`)) return;
    try {
      await pinataUnpin(cid);

      // Ako brišemo baš aktivni sajt, očisti NFT i vrati formu
      try {
        const curCid = await getCurrentDomainCid();
        if (curCid && curCid.toLowerCase() === cid.toLowerCase()) {
          await updateDomainOnChainById("", ""); // ukloni linkove sa NFT-a
        } else {
          await updateUploadFormVisibility();
        }
      } catch (e2) { console.warn("Cleanup on-chain failed:", e2); }

      await refreshPins();
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    }
  }
});
btnRefreshPins?.addEventListener("click", refreshPins);

// ====================== FLIP TABS ======================
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
  [tabPerper, tabDomain, tabHost].forEach(b => b && b.classList.remove("active"));
  if (which === "perper") {
    tabPerper?.classList.add("active");
    glassCard?.classList.remove("is-domain");
  } else if (which === "domain") {
    tabDomain?.classList.add("active");
    showBackPanel("domain");
    glassCard?.classList.add("is-domain");
  } else if (which === "host") {
    if (!hasDomainAccess) return;
    tabHost?.classList.add("active");
    showBackPanel("host");
    glassCard?.classList.add("is-domain");
    (async () => {
      if (!currentDomainId) await loadOwnedDomainsForUser();
      await updateUploadFormVisibility(); // prikaži/sakrij formu prema NFT-u
      setTimeout(refreshPins, 150);
    })();
  }
  positionIndicator();
  setTimeout(equalizeCardHeight, 50);
}

// ====================== INIT ======================
function bindUI() {
  if (tabHost) tabHost.style.display = "none";

  // PRP <-> ETH kalkulacija
  buyPRPInput?.addEventListener("input", () => {
    const prpAmount = parseFloat(buyPRPInput.value) || 0;
    if (tokenPriceEth > 0 && buyETHInput) buyETHInput.value = (prpAmount * tokenPriceEth).toFixed(6);
  });
  buyETHInput?.addEventListener("input", () => {
    const ethAmount = parseFloat(buyETHInput.value) || 0;
    if (tokenPriceEth > 0 && buyPRPInput) buyPRPInput.value = (ethAmount / tokenPriceEth).toFixed(2);
  });

  $("buy-form")?.addEventListener("submit", buyTokens);
  $("transfer-form")?.addEventListener("submit", transferTokens);

  tabPerper?.addEventListener("click", () => activateTab("perper"));
  tabDomain?.addEventListener("click", () => { activateTab("domain"); setTimeout(() => ensureRegistries(), 100); });
  tabHost  ?.addEventListener("click", () => activateTab("host"));
  window.addEventListener("resize", () => setTimeout(equalizeCardHeight, 50));

  btnCheckPrice?.addEventListener("click", onCheckPriceClick);
  domainForm?.addEventListener("submit", buyDomainFlow);

  bindPinataUpload();
}

window.addEventListener("DOMContentLoaded", () => {
  bindUI();
  positionIndicator();
  equalizeCardHeight();
  // connectWallet(); // ako želiš auto-connect
});



window.connectWallet = connectWallet;
