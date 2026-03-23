// src/App.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useDisconnect,
} from "@reown/appkit/react";
import type { Provider } from "@reown/appkit/react";

/* ── Constants ────────────────────────────────────────────────────────────── */

const CONTRACT_ADDRESS = "0x83468af1d0576fd5b4df3a90d02a240bb7d6de6a";
const RPC_URL = "https://rpc.sepolia-api.lisk.com";

const ABI = [
  { type:"function", name:"FAUCET_AMOUNT",       inputs:[],                                                                               outputs:[{type:"uint256"}], stateMutability:"view"       },
  { type:"function", name:"FAUCET_COOLDOWN",      inputs:[],                                                                               outputs:[{type:"uint256"}], stateMutability:"view"       },
  { type:"function", name:"MAX_SUPPLY",           inputs:[],                                                                               outputs:[{type:"uint256"}], stateMutability:"view"       },
  { type:"function", name:"allowance",            inputs:[{name:"owner",type:"address"},{name:"spender",type:"address"}],                  outputs:[{type:"uint256"}], stateMutability:"view"       },
  { type:"function", name:"balanceOf",            inputs:[{name:"account",type:"address"}],                                                outputs:[{type:"uint256"}], stateMutability:"view"       },
  { type:"function", name:"decimals",             inputs:[],                                                                               outputs:[{type:"uint8"}],   stateMutability:"view"       },
  { type:"function", name:"getRemainingCooldown", inputs:[{name:"user",type:"address"}],                                                   outputs:[{type:"uint256"}], stateMutability:"view"       },
  { type:"function", name:"lastRequestTime",      inputs:[{name:"user",type:"address"}],                                                   outputs:[{type:"uint256"}], stateMutability:"view"       },
  { type:"function", name:"mint",                 inputs:[{name:"to",type:"address"},{name:"amount",type:"uint256"}],                      outputs:[],                 stateMutability:"nonpayable" },
  { type:"function", name:"name",                 inputs:[],                                                                               outputs:[{type:"string"}],  stateMutability:"view"       },
  { type:"function", name:"owner",                inputs:[],                                                                               outputs:[{type:"address"}], stateMutability:"view"       },
  { type:"function", name:"requestTokens",        inputs:[],                                                                               outputs:[],                 stateMutability:"nonpayable" },
  { type:"function", name:"symbol",               inputs:[],                                                                               outputs:[{type:"string"}],  stateMutability:"view"       },
  { type:"function", name:"totalSupply",          inputs:[],                                                                               outputs:[{type:"uint256"}], stateMutability:"view"       },
  { type:"function", name:"transfer",             inputs:[{name:"to",type:"address"},{name:"value",type:"uint256"}],                       outputs:[{type:"bool"}],    stateMutability:"nonpayable" },
  { type:"function", name:"transferFrom",         inputs:[{name:"from",type:"address"},{name:"to",type:"address"},{name:"value",type:"uint256"}], outputs:[{type:"bool"}], stateMutability:"nonpayable" },
];

/* ── Types ────────────────────────────────────────────────────────────────── */

interface TokenStats {
  totalSupply: string; maxSupply: string; faucetAmount: string;
  cooldownSecs: number; name: string; symbol: string;
  decimals: number; owner: string; myBalance: string;
}
interface TxState { status: "idle"|"pending"|"success"|"error"; message: string; }
interface Toast   { id: number; msg: string; type: "success"|"error"; }

/* ── Utils ────────────────────────────────────────────────────────────────── */

function fmt(bn: ethers.BigNumber|null|undefined, dec: number): string {
  if (!bn) return "0";
  try {
    const v = parseFloat(ethers.utils.formatUnits(bn, dec));
    if (v >= 1_000_000) return (v/1_000_000).toFixed(2)+"M";
    if (v >= 1_000)     return v.toLocaleString(undefined,{maximumFractionDigits:2});
    return v.toFixed(2);
  } catch { return "—"; }
}

function fmtSecs(s: number): string {
  if (s<=0) return "0s";
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return [h&&`${h}h`,m&&`${m}m`,(sec||(!h&&!m))&&`${sec}s`].filter(Boolean).join(" ");
}

function fmtCountdown(ms: number): string {
  const s=Math.max(0,Math.floor(ms/1000));
  return `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

function fmtHuman(ms: number): string {
  const s=Math.max(0,Math.floor(ms/1000));
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  const p:string[]=[];
  if (h)                p.push(`${h} ${h===1?"hour":"hours"}`);
  if (m)                p.push(`${m} ${m===1?"min":"mins"}`);
  if (sec||!p.length)   p.push(`${sec} ${sec===1?"sec":"secs"}`);
  return p.join(" ");
}

const short=(a:string)=>a?`${a.slice(0,6)}…${a.slice(-4)}`:"—";

function ro(): ethers.Contract {
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, new ethers.providers.JsonRpcProvider(RPC_URL));
}

function extractErr(e:unknown): string {
  const err=e as Record<string,unknown>;
  return String(err?.reason??(err?.error as Record<string,unknown>)?.message??err?.data??err?.message??"Transaction failed");
}

/* ── Hook: useToasts ──────────────────────────────────────────────────────── */

function useToasts() {
  const [toasts, set] = useState<Toast[]>([]);
  const ctr = useRef(0);
  const add = useCallback((msg:string, type:"success"|"error") => {
    const id=++ctr.current;
    set(p=>[...p,{id,msg,type}]);
    setTimeout(()=>set(p=>p.filter(t=>t.id!==id)),4500);
  },[]);
  return {toasts, add};
}

/* ── Hook: useSignerContract ──────────────────────────────────────────────── */

function useSignerContract() {
  const {walletProvider} = useAppKitProvider<Provider>("eip155");
  const {isConnected}    = useAppKitAccount();
  const ref = useRef<ethers.Contract|null>(null);

  useEffect(()=>{
    if (!isConnected||!walletProvider) { ref.current=null; return; }
    const p = new ethers.providers.Web3Provider(walletProvider as ethers.providers.ExternalProvider,"any");
    p.ready.then(()=>{
      ref.current = new ethers.Contract(CONTRACT_ADDRESS, ABI, p.getSigner());
    }).catch(()=>{ ref.current=null; });
  },[isConnected,walletProvider]);

  return ref;
}

/* ── Hook: useTokenStats ──────────────────────────────────────────────────── */

function useTokenStats(account:string|undefined) {
  const [stats,setStats]=useState<TokenStats|null>(null);

  const load=useCallback(async()=>{
    try {
      const rc=ro();
      const [total,max,faucetAmt,cooldown,dec,name,sym,owner]=await Promise.all([
        rc.totalSupply(),rc.MAX_SUPPLY(),rc.FAUCET_AMOUNT(),rc.FAUCET_COOLDOWN(),
        rc.decimals(),rc.name(),rc.symbol(),rc.owner(),
      ]);
      const d=Number(dec);
      let myBalance="—";
      if (account) { const bal=await rc.balanceOf(account); myBalance=fmt(bal,d)+" "+sym; }
      setStats({
        totalSupply:fmt(total,d)+" "+sym, maxSupply:fmt(max,d)+" "+sym,
        faucetAmount:fmt(faucetAmt,d), cooldownSecs:Number(cooldown),
        name, symbol:sym, decimals:d, owner, myBalance,
      });
    } catch(e){ console.error("useTokenStats:",e); }
  },[account]);

  useEffect(()=>{ load(); },[load]);
  return {stats, reload:load};
}

/* ── Hook: useCooldown ────────────────────────────────────────────────────── */
// Per-user, keyed by wallet address. Isolated from the Cooldown Status panel.

function useCooldown(account:string|undefined) {
  const [endMs,setEndMs]       = useState<number|null>(null);
  const [remaining,setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const refresh = useCallback(async(addr:string)=>{
    try {
      const rem:ethers.BigNumber = await ro().getRemainingCooldown(addr);
      const n=rem.toNumber();
      if (n>0) setEndMs(Date.now()+n*1000);
      else     { setEndMs(null); setRemaining(0); }
    } catch(e){ console.error("useCooldown:",e); }
  },[]);

  useEffect(()=>{
    if (!account){ setEndMs(null); setRemaining(0); return; }
    refresh(account);
  },[account,refresh]);

  useEffect(()=>{
    if (timerRef.current) clearInterval(timerRef.current);
    if (!endMs){ setRemaining(0); return; }
    const tick=()=>{
      const rem=endMs-Date.now();
      if (rem<=0){ setRemaining(0); setEndMs(null); clearInterval(timerRef.current!); }
      else         setRemaining(rem);
    };
    tick();
    timerRef.current=setInterval(tick,1000);
    return ()=>{ if (timerRef.current) clearInterval(timerRef.current); };
  },[endMs]);

  return {remaining, isOnCooldown:remaining>0, refresh};
}

/* ── Atoms ────────────────────────────────────────────────────────────────── */

function Spinner(){ return <span className="spinner"/>; }

function StatusMsg({status,message}:TxState){
  if (status==="idle"||!message) return null;
  return (
    <div className={`status-msg status-${status}`}>
      {status==="pending"?<Spinner/>:status==="success"?"✓":"✗"}
      <span>{message}</span>
    </div>
  );
}

function StatCard({label,value,sub,color}:{label:string;value:string;sub?:string;color?:string}){
  return (
    <div className="stat-card"
      onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(124,58,237,0.4)")}
      onMouseLeave={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.07)")}
    >
      <div className="stat-label">
        <span className="stat-dot" style={color?{background:color}:{}}/>
        {label}
      </div>
      {value
        ? <div className="stat-value" style={color?{color}:{}}>{value}</div>
        : <div className="skeleton"/>}
      {sub&&<div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Panel({title,icon,desc,children}:{title:string;icon:string;desc:string;children:React.ReactNode}){
  return (
    <div className="panel"
      onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(124,58,237,0.3)")}
      onMouseLeave={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.07)")}
    >
      <div className="panel-head">
        <span className="panel-icon">{icon}</span>
        <div>
          <div className="panel-title">{title}</div>
          <div className="panel-desc">{desc}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({label,value,onChange,placeholder,type="text"}:{
  label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string;
}){
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input className="field-input" type={type} value={value}
        placeholder={placeholder} onChange={e=>onChange(e.target.value)}/>
    </div>
  );
}

function Btn({onClick,disabled,variant="purple",children}:{
  onClick:()=>void;disabled?:boolean;variant?:"purple"|"cyan"|"green"|"amber";children:React.ReactNode;
}){
  return (
    <button className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function NoWallet({action}:{action:string}){
  return (
    <div className="no-wallet">
      Connect your wallet to <strong>{action}</strong>
    </div>
  );
}

/* ── Panel: Faucet ────────────────────────────────────────────────────────── */

function FaucetPanel({stats,isConnected,account,contractRef,remaining,onSuccess,toast,refresh}:{
  stats:TokenStats|null; isConnected:boolean; account:string|undefined;
  contractRef:React.MutableRefObject<ethers.Contract|null>;
  remaining:number; onSuccess:()=>void;
  toast:(m:string,t:"success"|"error")=>void;
  refresh:(addr:string)=>void;
}){
  const [tx,setTx]=useState<TxState>({status:"idle",message:""});
  const cooling=remaining>0, pending=tx.status==="pending";

  const request=async()=>{
    if (!contractRef.current||!account) return;
    setTx({status:"pending",message:"Awaiting wallet confirmation…"});
    try {
      const t=await contractRef.current.requestTokens();
      setTx({status:"pending",message:`Tx submitted: ${t.hash.slice(0,16)}…`});
      await t.wait();
      setTx({status:"success",message:"Tokens received! ✓"});
      toast("Tokens received successfully!","success");
      onSuccess(); refresh(account);
    } catch(e){
      const msg=extractErr(e);
      setTx({status:"error",message:msg});
      toast("Failed: "+msg,"error");
      if (account) refresh(account);
    }
  };

  return (
    <div className="faucet-card">
      <div className="faucet-glow"/>
      <div className="faucet-body">
        <div className="faucet-heading"><span>💧</span><span>Request Tokens</span></div>
        <p className="faucet-sub">
          Claim free <strong>{stats?.name??"CaesarCoin"}</strong> tokens once per cooldown period on Lisk Sepolia
        </p>

        {stats&&(
          <div className="faucet-amount-block">
            <span className="faucet-label">You will receive</span>
            <span className="faucet-big">{stats.faucetAmount}</span>
            <span className="faucet-sym">{stats.symbol} per request</span>
          </div>
        )}

        {isConnected&&cooling&&(
          <div className="cooldown-box">
            <span className="cd-clock">⏳</span>
            <div>
              <div className="cd-label">Cooldown active — retry in</div>
              <div className="cd-countdown">{fmtCountdown(remaining)}</div>
              <div className="cd-human">{fmtHuman(remaining)}</div>
            </div>
          </div>
        )}

        <div className="faucet-action">
          {!isConnected
            ? <NoWallet action="request tokens"/>
            : (
              <button
                className={`faucet-btn${cooling||pending?" faucet-btn--disabled":""}`}
                disabled={cooling||pending} onClick={request}
              >
                {pending?<><Spinner/> Processing…</>
                :cooling?`⏳ Retry in ${fmtHuman(remaining)}`
                :"💧 Request Tokens"}
              </button>
            )}
          <StatusMsg {...tx}/>
        </div>
      </div>
    </div>
  );
}

/* ── Panel: Transfer ──────────────────────────────────────────────────────── */

function TransferPanel({stats,isConnected,contractRef,onSuccess,toast}:{
  stats:TokenStats|null; isConnected:boolean;
  contractRef:React.MutableRefObject<ethers.Contract|null>;
  onSuccess:()=>void; toast:(m:string,t:"success"|"error")=>void;
}){
  const [to,setTo]=useState(""), [amt,setAmt]=useState("");
  const [tx,setTx]=useState<TxState>({status:"idle",message:""});

  const send=async()=>{
    if (!contractRef.current) return;
    if (!ethers.utils.isAddress(to)){ setTx({status:"error",message:"Invalid recipient address"}); return; }
    if (!amt||isNaN(+amt)||+amt<=0)  { setTx({status:"error",message:"Enter a valid amount"}); return; }
    setTx({status:"pending",message:"Awaiting wallet confirmation…"});
    try {
      const wei=ethers.utils.parseUnits(amt,stats?.decimals??18);
      const t=await contractRef.current.transfer(to,wei);
      setTx({status:"pending",message:`Tx: ${t.hash.slice(0,16)}…`});
      await t.wait();
      setTx({status:"success",message:`Sent ${amt} ${stats?.symbol} to ${short(to)}`});
      toast(`Sent ${amt} ${stats?.symbol}!`,"success");
      setTo(""); setAmt(""); onSuccess();
    } catch(e){
      setTx({status:"error",message:extractErr(e)});
      toast("Transfer failed","error");
    }
  };

  return (
    <Panel title="Transfer Tokens" icon="→" desc={`Send ${stats?.symbol??"tokens"} to any address`}>
      {!isConnected?<NoWallet action="transfer tokens"/>:(
        <>
          <Field label="Recipient Address" value={to} onChange={setTo} placeholder="0x…"/>
          <Field label={`Amount (${stats?.symbol??"tokens"})`} value={amt} onChange={setAmt} placeholder="100" type="number"/>
          <Btn onClick={send} disabled={tx.status==="pending"} variant="cyan">
            {tx.status==="pending"?<><Spinner/> Sending…</>:"→ Send Tokens"}
          </Btn>
          <StatusMsg {...tx}/>
        </>
      )}
    </Panel>
  );
}

/* ── Panel: Mint ──────────────────────────────────────────────────────────── */

function MintPanel({stats,isConnected,contractRef,onSuccess,toast}:{
  stats:TokenStats|null; isConnected:boolean;
  contractRef:React.MutableRefObject<ethers.Contract|null>;
  onSuccess:()=>void; toast:(m:string,t:"success"|"error")=>void;
}){
  const [to,setTo]=useState(""), [amt,setAmt]=useState("");
  const [tx,setTx]=useState<TxState>({status:"idle",message:""});

  const mint=async()=>{
    if (!contractRef.current) return;
    if (!ethers.utils.isAddress(to)){ setTx({status:"error",message:"Invalid address"}); return; }
    if (!amt||isNaN(+amt)||+amt<=0)  { setTx({status:"error",message:"Enter a valid amount"}); return; }
    setTx({status:"pending",message:"Awaiting wallet confirmation…"});
    try {
      const wei=ethers.utils.parseUnits(amt,stats?.decimals??18);
      const t=await contractRef.current.mint(to,wei);
      setTx({status:"pending",message:`Tx: ${t.hash.slice(0,16)}…`});
      await t.wait();
      setTx({status:"success",message:`Minted ${amt} ${stats?.symbol} to ${short(to)}`});
      toast(`Minted ${amt} ${stats?.symbol}!`,"success");
      setTo(""); setAmt(""); onSuccess();
    } catch(e){
      const msg=extractErr(e);
      setTx({status:"error",message:msg});
      toast("Mint failed: "+msg,"error");
    }
  };

  return (
    <Panel title="Mint Tokens" icon="⚡" desc="Owner-only: mint tokens to any address">
      {!isConnected?<NoWallet action="mint tokens"/>:(
        <>
          <Field label="Recipient Address" value={to} onChange={setTo} placeholder="0x…"/>
          <Field label={`Amount (${stats?.symbol??"tokens"})`} value={amt} onChange={setAmt} placeholder="1000" type="number"/>
          <Btn onClick={mint} disabled={tx.status==="pending"} variant="green">
            {tx.status==="pending"?<><Spinner/> Minting…</>:"⚡ Mint Tokens"}
          </Btn>
          <StatusMsg {...tx}/>
        </>
      )}
    </Panel>
  );
}

/* ── Panel: Balance Lookup ────────────────────────────────────────────────── */

function BalanceLookupPanel({stats}:{stats:TokenStats|null}){
  const [addr,setAddr]=useState(""), [result,setResult]=useState<string|null>(null);
  const [loading,setLoading]=useState(false), [err,setErr]=useState("");

  const check=async()=>{
    if (!ethers.utils.isAddress(addr)){ setErr("Invalid address"); return; }
    setErr(""); setResult(null); setLoading(true);
    try { const bal=await ro().balanceOf(addr); setResult(fmt(bal,stats?.decimals??18)); }
    catch(e){ setErr(extractErr(e)); } finally{ setLoading(false); }
  };

  return (
    <Panel title="Balance Lookup" icon="🔍" desc="Check any wallet's token balance">
      <Field label="Wallet Address" value={addr} onChange={setAddr} placeholder="0x…"/>
      <Btn onClick={check} disabled={loading} variant="purple">
        {loading?<><Spinner/> Fetching…</>:"🔍 Check Balance"}
      </Btn>
      {err&&<p className="inline-err">✗ {err}</p>}
      {result!==null&&(
        <div className="lookup-result">
          <span className="lookup-addr">{short(addr)}</span>
          <span className="lookup-val">{result} <span className="lookup-sym">{stats?.symbol}</span></span>
        </div>
      )}
    </Panel>
  );
}

/* ── Panel: Allowance ─────────────────────────────────────────────────────── */

function AllowancePanel({stats}:{stats:TokenStats|null}){
  const [owner,setOwner]=useState(""), [spender,setSpender]=useState("");
  const [result,setResult]=useState<string|null>(null);
  const [loading,setLoading]=useState(false), [err,setErr]=useState("");

  const check=async()=>{
    if (!ethers.utils.isAddress(owner)||!ethers.utils.isAddress(spender))
      { setErr("Both addresses must be valid"); return; }
    setErr(""); setResult(null); setLoading(true);
    try { const val=await ro().allowance(owner,spender); setResult(fmt(val,stats?.decimals??18)); }
    catch(e){ setErr(extractErr(e)); } finally{ setLoading(false); }
  };

  return (
    <Panel title="Allowance Check" icon="🔑" desc="Check spending allowance between two addresses">
      <Field label="Owner Address"   value={owner}   onChange={setOwner}   placeholder="0x…"/>
      <Field label="Spender Address" value={spender} onChange={setSpender} placeholder="0x…"/>
      <Btn onClick={check} disabled={loading} variant="amber">
        {loading?<><Spinner/> Checking…</>:"🔑 Check Allowance"}
      </Btn>
      {err&&<p className="inline-err">✗ {err}</p>}
      {result!==null&&(
        <div className="lookup-result">
          <span className="lookup-addr">{short(owner)} → {short(spender)}</span>
          <span className="lookup-val lookup-amber">{result} <span className="lookup-sym">{stats?.symbol}</span></span>
        </div>
      )}
    </Panel>
  );
}

/* ── Panel: Cooldown Status ───────────────────────────────────────────────── */
// One-shot RPC read — never touches the live useCooldown hook.

function CooldownStatusPanel({account}:{account:string|undefined}){
  const [addr,setAddr]=useState(""), [remSecs,setRemSecs]=useState<number|null>(null);
  const [loading,setLoading]=useState(false), [err,setErr]=useState("");

  const check=async()=>{
    const target=addr.trim()||account||"";
    if (!ethers.utils.isAddress(target)){ setErr("Enter a valid address (or connect wallet to check yours)"); return; }
    setErr(""); setRemSecs(null); setLoading(true);
    try { const rem:ethers.BigNumber=await ro().getRemainingCooldown(target); setRemSecs(rem.toNumber()); }
    catch(e){ setErr(extractErr(e)); } finally{ setLoading(false); }
  };

  return (
    <Panel title="Cooldown Status" icon="⏱" desc="Check remaining cooldown for any address">
      <Field label={account?"Address (blank = yours)":"Wallet Address"} value={addr} onChange={setAddr} placeholder={account||"0x…"}/>
      <Btn onClick={check} disabled={loading} variant="cyan">
        {loading?<><Spinner/> Fetching…</>:"⏱ Check Cooldown"}
      </Btn>
      {err&&<p className="inline-err">✗ {err}</p>}
      {remSecs!==null&&(
        remSecs===0
          ? <p className="cd-clear">✓ No cooldown active — can request now</p>
          : <div className="cd-result">
              <span className="cd-result-label">Retry in</span>
              <span className="cd-result-val">{fmtHuman(remSecs*1000)}</span>
              <span className="cd-result-mono">({fmtCountdown(remSecs*1000)})</span>
            </div>
      )}
    </Panel>
  );
}

/* ── Panel: Contract Info ─────────────────────────────────────────────────── */

function ContractInfoPanel({stats}:{stats:TokenStats|null}){
  const rows=stats?[
    {k:"Name",      v:stats.name},
    {k:"Symbol",    v:stats.symbol},
    {k:"Decimals",  v:String(stats.decimals)},
    {k:"Max Supply",v:stats.maxSupply},
    {k:"Cooldown",  v:fmtSecs(stats.cooldownSecs)},
    {k:"Owner",     v:short(stats.owner),        full:stats.owner},
    {k:"Contract",  v:short(CONTRACT_ADDRESS),   full:CONTRACT_ADDRESS},
  ]:[];
  return (
    <Panel title="Contract Info" icon="📋" desc="Token metadata & on-chain details">
      {rows.length===0
        ? Array.from({length:6}).map((_,i)=>(
            <div key={i} className="info-row">
              <div className="skeleton sk-short"/><div className="skeleton sk-mid"/>
            </div>
          ))
        : rows.map(r=>(
            <div key={r.k} className="info-row">
              <span className="info-key">{r.k}</span>
              <span className="info-val" title={r.full}>{r.v}</span>
            </div>
          ))}
    </Panel>
  );
}

/* ── App ──────────────────────────────────────────────────────────────────── */

export default function App(){
  const {toasts, add:toast}            = useToasts();
  const {open}                         = useAppKit();
  const {disconnect}                   = useDisconnect();
  const {address, isConnected}         = useAppKitAccount();
  const contractRef                    = useSignerContract();
  const {stats, reload}                = useTokenStats(address);
  const {remaining, refresh}           = useCooldown(address);

  const onSuccess=useCallback(()=>reload(),[reload]);

  return (
    <div className="app">

      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">C</div>
          <div>
            <div className="logo-name">CaesarCoin</div>
            <div className="logo-sub">FAUCET DAPP</div>
          </div>
        </div>
        <div className="header-right">
          <div className="net-badge">
            <span className="net-dot"/>
            Lisk Sepolia
          </div>
          {isConnected
            ? <div className="wallet-row">
                <span className="wallet-addr">{short(address!)}</span>
                <button className="disconnect-btn" onClick={()=>disconnect()}>Disconnect</button>
              </div>
            : <button className="connect-btn" onClick={()=>open()}>Connect Wallet</button>
          }
        </div>
      </header>

      {/* Main */}
      <main className="main">
        <div className="hero">
          <h1 className="hero-title">
            Get <span className="hero-accent">CaesarCoin</span> Tokens
          </h1>
          <p className="hero-sub">
            Request free testnet tokens on Lisk Sepolia — powered by a cooldown faucet with a 10M token max supply.
          </p>
        </div>

        <div className="stats-grid">
          <StatCard label="Total Supply"  value={stats?.totalSupply??""}  sub="tokens minted"/>
          <StatCard label="Max Supply"    value={stats?.maxSupply??""}    sub="10M hard cap"   color="#4ade80"/>
          <StatCard label="Faucet Amount" value={stats?`${stats.faucetAmount} ${stats.symbol}`:""} sub="per request" color="#a78bfa"/>
          <StatCard label="Cooldown"      value={stats?fmtSecs(stats.cooldownSecs):""} sub="between requests"/>
          <StatCard label="Your Balance"  value={isConnected?(stats?.myBalance??"Loading…"):"—"} sub={isConnected?"your tokens":"connect wallet"} color="#67e8f9"/>
        </div>

        <div className="panels">
          <div className="panel-wide">
            <FaucetPanel stats={stats} isConnected={isConnected} account={address}
              contractRef={contractRef} remaining={remaining}
              onSuccess={onSuccess} toast={toast} refresh={refresh}/>
          </div>
          <TransferPanel      stats={stats} isConnected={isConnected} contractRef={contractRef} onSuccess={onSuccess} toast={toast}/>
          <MintPanel          stats={stats} isConnected={isConnected} contractRef={contractRef} onSuccess={onSuccess} toast={toast}/>
          <BalanceLookupPanel stats={stats}/>
          <AllowancePanel     stats={stats}/>
          <CooldownStatusPanel account={address}/>
          <ContractInfoPanel  stats={stats}/>
        </div>
      </main>

      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map(t=>(
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type==="success"?"✓ ":"✗ "}{t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}