import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Zap, Eye, Loader2 } from "lucide-react";

type Protocol = "rtu" | "ascii" | "tcp" | "can2a" | "can2b";

interface FrameBlock {
  id: string; label: string; value: string;
  color: "primary" | "secondary" | "orange" | "red" | "muted";
  widthClass: string;
}

// ── CRC-16 Modbus RTU (polynomial 0xA001) ──
function calcCRC16(bytes: number[]): string {
  let crc = 0xFFFF;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      if (crc & 1) { crc = (crc >> 1) ^ 0xA001; }
      else { crc >>= 1; }
    }
  }
  const h = crc.toString(16).padStart(4, "0").toUpperCase();
  return h.substring(2, 4) + " " + h.substring(0, 2); // Little-Endian
}

// ── LRC Modbus ASCII (complement à 2) ──
function calcLRC(bytes: number[]): string {
  let sum = 0;
  for (const b of bytes) sum = (sum + b) & 0xFF;
  const lrc = ((~sum) + 1) & 0xFF;
  return lrc.toString(16).padStart(2, "0").toUpperCase();
}

// ── Checksum TCP (complément à 1 sur 16 bits) ──
function calcTCPChecksum(bytes: number[]): string {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    const word = (bytes[i] << 8) | (bytes[i + 1] || 0);
    sum += word;
    while (sum > 0xFFFF) sum = (sum & 0xFFFF) + 1;
  }
  const checksum = (~sum) & 0xFFFF;
  return checksum.toString(16).padStart(4, "0").toUpperCase();
}

// ── CRC-15 CAN (polynomial 0x4599) ──
function calcCRC15(bits: number[]): string {
  let crc = 0;
  for (const bit of bits) {
    const nxtbit = bit ^ ((crc >> 14) & 1);
    crc = ((crc << 1) & 0x7FFF);
    if (nxtbit) crc ^= 0x4599;
  }
  return crc.toString(16).padStart(4, "0").toUpperCase();
}

function hexToBits(hex: string): number[] {
  const bits: number[] = [];
  for (const c of hex) {
    const n = parseInt(c, 16);
    for (let i = 3; i >= 0; i--) bits.push((n >> i) & 1);
  }
  return bits;
}

export default function GenerateurTrame() {
  const [protocol, setProtocol] = useState<Protocol>("rtu");
  const [mbAddr, setMbAddr] = useState("01");
  const [mbFc, setMbFc] = useState("03");
  const [mbData, setMbData] = useState("00 6B 00 03");
  const [canId, setCanId] = useState("7FF");
  const [canRtr, setCanRtr] = useState("0");
  const [canDlc, setCanDlc] = useState("8");
  const [canData, setCanData] = useState("11 22 33 44 55 66 77 88");
  const [blocks, setBlocks] = useState<FrameBlock[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [calcSteps, setCalcSteps] = useState<{
    algo: string; poly: string; input: string;
    currentCrc: string; finalCrc: string | null;
  }>({ algo: "", poly: "", input: "", currentCrc: "0x0000", finalCrc: null });

  const parseHexBytes = (hex: string): number[] => {
    const clean = hex.replace(/\s+/g, "");
    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i += 2)
      bytes.push(parseInt(clean.substring(i, i + 2), 16) || 0);
    return bytes;
  };

  const generateBlocks = () => {
    setIsSimulating(true);
    const newBlocks: FrameBlock[] = [];
    const addr = mbAddr.padStart(2, "0").toUpperCase();
    const fc = mbFc.padStart(2, "0").toUpperCase();
    const data = mbData.replace(/\s+/g, "").toUpperCase();
    const allHex = addr + fc + data;
    const bytes = parseHexBytes(allHex);

    if (protocol === "rtu") {
      newBlocks.push({ id: "addr", label: "Adresse", value: addr, color: "primary", widthClass: "min-w-[6rem]" });
      newBlocks.push({ id: "fc", label: "Fonction", value: fc, color: "secondary", widthClass: "min-w-[6rem]" });
      if (data) newBlocks.push({ id: "data", label: "Données", value: data.match(/.{1,4}/g)?.join(" ") || data, color: "orange", widthClass: "min-w-[8rem] px-4" });
      newBlocks.push({ id: "crc", label: "CRC-16", value: "...", color: "red", widthClass: "min-w-[6rem]" });
    } else if (protocol === "ascii") {
      const asciiFrame = ":" + allHex;
      newBlocks.push({ id: "start", label: "Start", value: ":", color: "muted", widthClass: "min-w-[4rem]" });
      newBlocks.push({ id: "addr", label: "Adresse", value: addr, color: "primary", widthClass: "min-w-[6rem]" });
      newBlocks.push({ id: "fc", label: "Fonction", value: fc, color: "secondary", widthClass: "min-w-[6rem]" });
      if (data) newBlocks.push({ id: "data", label: "Données", value: data.match(/.{1,4}/g)?.join(" ") || data, color: "orange", widthClass: "min-w-[8rem] px-4" });
      newBlocks.push({ id: "lrc", label: "LRC", value: "...", color: "red", widthClass: "min-w-[6rem]" });
      newBlocks.push({ id: "end", label: "End", value: "CR LF", color: "muted", widthClass: "min-w-[5rem]" });
    } else if (protocol === "tcp") {
      const pduLen = (1 + bytes.length).toString(16).padStart(4, "0").toUpperCase();
      newBlocks.push({ id: "tid", label: "Trans. ID", value: "00 01", color: "primary", widthClass: "min-w-[6rem]" });
      newBlocks.push({ id: "pid", label: "Proto. ID", value: "00 00", color: "primary", widthClass: "min-w-[6rem]" });
      newBlocks.push({ id: "len", label: "Longueur", value: pduLen, color: "primary", widthClass: "min-w-[6rem]" });
      newBlocks.push({ id: "uid", label: "Unit ID", value: addr, color: "secondary", widthClass: "min-w-[6rem]" });
      newBlocks.push({ id: "fc", label: "Fonction", value: fc, color: "secondary", widthClass: "min-w-[6rem]" });
      if (data) newBlocks.push({ id: "data", label: "Données", value: data.match(/.{1,4}/g)?.join(" ") || data, color: "orange", widthClass: "min-w-[8rem] px-4" });
      newBlocks.push({ id: "tcp-info", label: "Checksum TCP", value: "...", color: "red", widthClass: "min-w-[6rem]" });
    } else {
      const id = canId.toUpperCase();
      const rtr = canRtr;
      const dlc = canDlc;
      const cData = canData.replace(/\s+/g, "").toUpperCase();
      newBlocks.push({ id: "sof", label: "SOF", value: "0", color: "muted", widthClass: "min-w-[4rem]" });
      newBlocks.push({ id: "id", label: `ID (${protocol === "can2a" ? "11" : "29"}b)`, value: id, color: "primary", widthClass: "min-w-[6rem]" });
      newBlocks.push({ id: "rtr", label: "RTR", value: rtr, color: "secondary", widthClass: "min-w-[4rem]" });
      newBlocks.push({ id: "ide", label: "IDE", value: protocol === "can2a" ? "0" : "1", color: "secondary", widthClass: "min-w-[4rem]" });
      newBlocks.push({ id: "dlc", label: "DLC", value: dlc, color: "orange", widthClass: "min-w-[4rem]" });
      if (cData && rtr === "0") newBlocks.push({ id: "cdata", label: "Données", value: cData.match(/.{1,2}/g)?.join(" ") || cData, color: "orange", widthClass: "min-w-[8rem] px-4" });
      newBlocks.push({ id: "crc", label: "CRC-15", value: "...", color: "red", widthClass: "min-w-[6rem]" });
      newBlocks.push({ id: "ack", label: "ACK", value: "1", color: "muted", widthClass: "min-w-[4rem]" });
      newBlocks.push({ id: "eof", label: "EOF", value: "1111111", color: "muted", widthClass: "min-w-[5rem]" });
    }

    setBlocks([]);
    newBlocks.forEach((block, idx) => {
      setTimeout(() => setBlocks(prev => [...prev, block]), idx * 150);
    });
    setTimeout(() => runCalcAnim(protocol, bytes, allHex), newBlocks.length * 150 + 300);
  };

  const runCalcAnim = (proto: Protocol, bytes: number[], allHex: string) => {
    let finalVal = "";
    let algoName = "";
    let polyName = "";

    if (proto === "rtu") {
      algoName = "CRC-16 Modbus RTU";
      polyName = "0xA001 (x¹⁶+x¹⁵+x²+1)";
      finalVal = calcCRC16(bytes);
    } else if (proto === "ascii") {
      algoName = "LRC Modbus ASCII";
      polyName = "Complément à 2 (Σ octets)";
      finalVal = calcLRC(bytes);
    } else if (proto === "tcp") {
      algoName = "Checksum TCP (couche 4)";
      polyName = "Complément à 1 (Σ mots 16-bit)";
      finalVal = calcTCPChecksum(bytes);
    } else {
      algoName = "CRC-15 CAN";
      polyName = "0x4599 (x¹⁵+x¹⁴+x¹⁰+x⁸+x⁷+x⁴+x³+1)";
      const cData = canData.replace(/\s+/g, "").toUpperCase();
      const frameBits = hexToBits(canId + cData);
      finalVal = calcCRC15(frameBits);
    }

    setCalcSteps({ algo: algoName, poly: polyName, input: allHex || "Trame binaire", currentCrc: "0x0000", finalCrc: null });

    let loops = 0;
    const interval = setInterval(() => {
      loops++;
      setCalcSteps(prev => ({
        ...prev,
        currentCrc: "0x" + Math.floor(Math.random() * 65535).toString(16).padStart(4, "0").toUpperCase()
      }));
      if (loops > 20) {
        clearInterval(interval);
        setCalcSteps(prev => ({ ...prev, finalCrc: finalVal }));
        setIsSimulating(false);
        setBlocks(prev => prev.map(b =>
          (b.id === "crc" || b.id === "lrc" || b.id === "tcp-info")
            ? { ...b, value: finalVal, color: "primary" as const } : b
        ));
      }
    }, 50);
  };

  const colorMap = {
    primary: "border-[#00C9A7]/40 bg-[#00C9A7]/10 text-[#00C9A7]",
    secondary: "border-[#3D8BFF]/40 bg-[#3D8BFF]/10 text-[#3D8BFF]",
    orange: "border-[#FFB547]/40 bg-[#FFB547]/10 text-[#FFB547]",
    red: "border-[#FF6B6B]/40 bg-[#FF6B6B]/10 text-[#FF6B6B]",
    muted: "border-[#64748B]/40 bg-[#64748B]/10 text-[#64748B]"
  };
  const accentMap = {
    primary: "bg-[#00C9A7]", secondary: "bg-[#3D8BFF]",
    orange: "bg-[#FFB547]", red: "bg-[#FF6B6B]", muted: "bg-[#64748B]"
  };

  const isModbus = protocol === "rtu" || protocol === "ascii" || protocol === "tcp";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pt-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Générateur de Trame Interactif</h1>
        <p className="text-[#64748B]">Saisie manuelle, construction animée et calcul LRC / CRC en temps réel.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="col-span-1 bg-[#111C35] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00C9A7]/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150" />

          <label className="block text-xs font-black text-[#64748B] uppercase tracking-widest mb-3">Protocole</label>
          <select value={protocol} onChange={(e) => setProtocol(e.target.value as Protocol)}
            className="w-full bg-[#060913] border border-[#1E293B] rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-[#00C9A7] focus:ring-1 focus:ring-[#00C9A7] outline-none transition-all mb-6 cursor-pointer">
            <option value="rtu">Modbus RTU — CRC-16 (0xA001)</option>
            <option value="ascii">Modbus ASCII — LRC (Checksum)</option>
            <option value="tcp">Modbus TCP/IP — MBAP Header</option>
            <option value="can2a">CAN 2.0A (Standard 11-bit)</option>
            <option value="can2b">CAN 2.0B (Extended 29-bit)</option>
          </select>

          {/* Info badge */}
          <div className="mb-4 p-3 rounded-xl border border-white/5 bg-[#060913]">
            <div className="text-[9px] text-[#64748B] uppercase tracking-widest mb-1">Méthode de vérification</div>
            <div className="text-sm font-bold text-white">
              {protocol === "rtu" && "CRC-16 — Polynôme générateur 0xA001"}
              {protocol === "ascii" && "LRC — Complément à 2 de la somme"}
              {protocol === "tcp" && "Pas de CRC — Checksum TCP (couche 4)"}
              {protocol.startsWith("can") && "CRC-15 — Polynôme générateur 0x4599"}
            </div>
          </div>

          <div className="space-y-4">
            {isModbus && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">
                    {protocol === "tcp" ? "Unit ID (Hex)" : "Adresse Esclave (Hex)"}
                  </label>
                  <input type="text" value={mbAddr} onChange={e => setMbAddr(e.target.value)} maxLength={2}
                    className="w-full bg-[#060913] border border-[#1E293B] rounded-lg px-4 py-3 text-sm font-mono font-bold text-white focus:border-[#00C9A7] outline-none uppercase transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">Code Fonction (Hex)</label>
                  <input type="text" value={mbFc} onChange={e => setMbFc(e.target.value)} maxLength={2}
                    className="w-full bg-[#060913] border border-[#1E293B] rounded-lg px-4 py-3 text-sm font-mono font-bold text-white focus:border-[#3D8BFF] outline-none uppercase transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">Données (Hex)</label>
                  <input type="text" value={mbData} onChange={e => setMbData(e.target.value)}
                    className="w-full bg-[#060913] border border-[#1E293B] rounded-lg px-4 py-3 text-sm font-mono font-bold text-white focus:border-[#FFB547] outline-none uppercase transition-colors" />
                </div>
              </motion.div>
            )}

            {protocol.startsWith("can") && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">
                    Identifiant ({protocol === "can2a" ? "11" : "29"}-bit Hex)
                  </label>
                  <input type="text" value={canId} onChange={e => setCanId(e.target.value)} maxLength={protocol === "can2a" ? 3 : 8}
                    className="w-full bg-[#060913] border border-[#1E293B] rounded-lg px-4 py-3 text-sm font-mono font-bold text-white focus:border-[#00C9A7] outline-none uppercase transition-colors" />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">RTR</label>
                    <select value={canRtr} onChange={e => setCanRtr(e.target.value)}
                      className="w-full bg-[#060913] border border-[#1E293B] rounded-lg px-4 py-3 text-sm font-mono font-bold text-white focus:border-[#3D8BFF] outline-none transition-colors">
                      <option value="0">0 (Data)</option>
                      <option value="1">1 (Remote)</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">DLC</label>
                    <input type="number" min="0" max="8" value={canDlc} onChange={e => setCanDlc(e.target.value)}
                      className="w-full bg-[#060913] border border-[#1E293B] rounded-lg px-4 py-3 text-sm font-mono font-bold text-white focus:border-[#FFB547] outline-none transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-2">Données (Hex)</label>
                  <input type="text" value={canData} onChange={e => setCanData(e.target.value)} disabled={canRtr === "1"}
                    className="w-full bg-[#060913] border border-[#1E293B] rounded-lg px-4 py-3 text-sm font-mono font-bold text-white focus:border-[#FFB547] outline-none uppercase transition-colors disabled:opacity-50" />
                </div>
              </motion.div>
            )}
          </div>

          <button onClick={generateBlocks} disabled={isSimulating}
            className="w-full mt-8 bg-[#00C9A7]/10 hover:bg-[#00C9A7] text-[#00C9A7] hover:text-[#0A0F1E] disabled:opacity-50 border border-[#00C9A7]/20 hover:border-[#00C9A7] transition-all font-black text-xs uppercase tracking-widest py-4 rounded-xl flex justify-center items-center gap-2 group/btn shadow-[0_0_20px_rgba(0,201,167,0.1)] hover:shadow-[0_0_30px_rgba(0,201,167,0.4)]">
            {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 group-hover/btn:animate-bounce" />}
            {isSimulating ? "Génération en cours..." : "Construire & Animer"}
          </button>
        </div>

        {/* Visualization & CRC Engine */}
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#111C35] border border-white/5 rounded-2xl p-6 flex flex-col h-[220px]">
            <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-6 flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#3D8BFF]" /> Visualisation de la Trame
            </h3>
            <div className="flex-1 flex items-center justify-start gap-3 overflow-x-auto pb-4 scrollbar-hide px-2">
              <AnimatePresence>
                {blocks.length === 0 && !isSimulating && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-[#64748B]/50 text-sm italic font-medium w-full text-center border border-dashed border-white/10 rounded-xl py-10">
                    Sélectionnez un protocole et cliquez sur "Construire & Animer"
                  </motion.div>
                )}
                {blocks.map((block) => (
                  <motion.div key={block.id} initial={{ opacity: 0, x: -20, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                    className={`shrink-0 ${block.widthClass} bg-[#060913] border ${colorMap[block.color].split(" ")[0]} rounded-xl p-3 flex flex-col items-center justify-center relative shadow-lg`}>
                    <div className={`absolute top-0 left-0 right-0 h-1 ${accentMap[block.color]} rounded-t-xl opacity-50`} />
                    <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1 text-center">{block.label}</span>
                    <motion.span key={block.value} initial={{ scale: block.value !== "..." ? 1.3 : 1 }} animate={{ scale: 1 }}
                      className={`font-mono font-black text-sm ${colorMap[block.color].split(" ")[2]}`}>
                      {block.value}
                    </motion.span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* CRC Engine */}
          <AnimatePresence>
            {(isSimulating || calcSteps.finalCrc) && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#0A0F1E]/80 border border-[#00C9A7]/20 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden flex-1">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00C9A7]" />
                <h4 className="text-[10px] font-black text-[#00C9A7] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Cpu className="w-4 h-4" /> Moteur de Calcul
                </h4>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-[#00C9A7] animate-ping" />
                  <span className="text-white font-bold">{calcSteps.algo}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-[#64748B] uppercase tracking-widest mb-1">Polynôme / Méthode</div>
                    <div className="font-bold text-[#3D8BFF] font-mono text-sm">{calcSteps.poly}</div>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                    <div className="text-[9px] text-[#64748B] uppercase tracking-widest mb-1">Données d'entrée</div>
                    <div className="font-bold text-[#FFB547] font-mono truncate text-sm" title={calcSteps.input}>{calcSteps.input}</div>
                  </div>
                </div>
                <div className="p-5 bg-[#060913] rounded-xl border border-white/10 text-center relative overflow-hidden">
                  {!calcSteps.finalCrc && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite]" />
                  )}
                  <div className="text-[10px] uppercase text-[#64748B] tracking-widest mb-2 relative z-10">
                    {protocol === "ascii" ? "Registre LRC" : protocol === "tcp" ? "Info TCP" : "Registre Shift / CRC"}
                  </div>
                  <motion.div key={calcSteps.finalCrc || calcSteps.currentCrc}
                    initial={{ scale: calcSteps.finalCrc ? 1.2 : 1 }} animate={{ scale: 1 }}
                    className={`text-2xl font-black font-mono tracking-widest relative z-10 ${calcSteps.finalCrc ? "text-[#00C9A7] drop-shadow-[0_0_15px_rgba(0,201,167,0.5)]" : "text-white"}`}>
                    {calcSteps.finalCrc || calcSteps.currentCrc}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
