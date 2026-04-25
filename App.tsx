import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type Language = "zh" | "en";
type LetterState = "correct" | "present" | "absent";
type FeedbackMode = "classic" | "pro";
type SessionMode = "daily" | "unlimited" | "speed";
type ViewTab = "play" | "leaderboard";
type SiteView = "game" | "promo";
type ModeKind = "wordle" | "semantic" | "globle" | "mathle" | "spellingbee" | "waffle" | "strands" | "squaredle" | "queens";
type GameModeKey =
  | "daily"
  | "unlimited"
  | "wordlepro"
  | "dordle"
  | "quordle"
  | "octordle"
  | "sedecordle"
  | "duotrigordle"
  | "speed"
  | "semantic"
  | "globle"
  | "mathle"
  | "spellingbee"
  | "waffle"
  | "strands"
  | "squaredle"
  | "queens";

type PlayerProfile = { id: number; name: string };
type LetterResult = { char: string; state: LetterState };
type Country = { name: string; lat: number; lng: number };
type SemanticGuessPoint = { word: string; x: number; y: number; similarity: number };
type GlobleGuess = { word: string; distance: number; direction: string; heat: number };

type LeaderboardEntry = {
  id: string;
  name: string;
  mode: GameModeKey;
  score: number;
  detail: string;
  date: string;
};

type GameModeConfig = {
  kind: ModeKind;
  label: { zh: string; en: string };
  desc: { zh: string; en: string };
  boards?: number;
  attempts?: number;
  feedback?: FeedbackMode;
  session?: SessionMode;
  baseScore: number;
  remainBonus: number;
};

const STORAGE_KEYS = {
  player: "wordles.player",
  playerCount: "wordles.playerCount",
  leaderboard: "wordles.leaderboard",
};

const MODES: Record<GameModeKey, GameModeConfig> = {
  daily: { kind: "wordle", label: { zh: "每日 Wordle", en: "Daily Wordle" }, desc: { zh: "每天一题，6次机会", en: "New daily puzzle, 6 tries" }, boards: 1, attempts: 6, feedback: "classic", session: "daily", baseScore: 70, remainBonus: 16 },
  unlimited: { kind: "wordle", label: { zh: "无限模式", en: "Unlimited" }, desc: { zh: "无限开局，无需等待", en: "Unlimited rounds" }, boards: 1, attempts: 6, feedback: "classic", session: "unlimited", baseScore: 40, remainBonus: 10 },
  wordlepro: { kind: "wordle", label: { zh: "WordlePro", en: "WordlePro" }, desc: { zh: "10次机会，仅显示G/Y/R数量", en: "10 tries, count-only feedback" }, boards: 1, attempts: 10, feedback: "pro", session: "unlimited", baseScore: 120, remainBonus: 18 },
  dordle: { kind: "wordle", label: { zh: "Dordle", en: "Dordle" }, desc: { zh: "2盘同猜，7次", en: "2 boards, 7 tries" }, boards: 2, attempts: 7, feedback: "classic", session: "unlimited", baseScore: 130, remainBonus: 18 },
  quordle: { kind: "wordle", label: { zh: "Quordle", en: "Quordle" }, desc: { zh: "4盘同猜，9次", en: "4 boards, 9 tries" }, boards: 4, attempts: 9, feedback: "classic", session: "unlimited", baseScore: 190, remainBonus: 22 },
  octordle: { kind: "wordle", label: { zh: "Octordle", en: "Octordle" }, desc: { zh: "8盘同猜，13次", en: "8 boards, 13 tries" }, boards: 8, attempts: 13, feedback: "classic", session: "unlimited", baseScore: 300, remainBonus: 25 },
  sedecordle: { kind: "wordle", label: { zh: "Sedecordle", en: "Sedecordle" }, desc: { zh: "16盘同猜，21次", en: "16 boards, 21 tries" }, boards: 16, attempts: 21, feedback: "classic", session: "unlimited", baseScore: 480, remainBonus: 30 },
  duotrigordle: { kind: "wordle", label: { zh: "Duotrigordle", en: "Duotrigordle" }, desc: { zh: "32盘同猜，37次", en: "32 boards, 37 tries" }, boards: 32, attempts: 37, feedback: "classic", session: "unlimited", baseScore: 900, remainBonus: 40 },
  speed: { kind: "wordle", label: { zh: "Speed Streak", en: "Speed Streak" }, desc: { zh: "90秒冲刺连胜", en: "90-second streak" }, boards: 1, attempts: 6, feedback: "classic", session: "speed", baseScore: 100, remainBonus: 0 },
  semantic: { kind: "semantic", label: { zh: "Semantic Explorer", en: "Semantic Explorer" }, desc: { zh: "猜语义相似度", en: "Guess semantic closeness" }, baseScore: 150, remainBonus: 12 },
  globle: { kind: "globle", label: { zh: "Globle", en: "Globle" }, desc: { zh: "猜国家，获取距离方向", en: "Guess country with distance and direction" }, baseScore: 150, remainBonus: 14 },
  mathle: { kind: "mathle", label: { zh: "Mathle", en: "Mathle" }, desc: { zh: "猜数学等式", en: "Guess the equation" }, baseScore: 120, remainBonus: 16 },
  spellingbee: { kind: "spellingbee", label: { zh: "Spelling Bee", en: "Spelling Bee" }, desc: { zh: "7字母找词", en: "Build words from 7 letters" }, baseScore: 180, remainBonus: 6 },
  waffle: { kind: "waffle", label: { zh: "Waffle", en: "Waffle" }, desc: { zh: "重排字母还原目标词", en: "Rearrange letters to target" }, baseScore: 130, remainBonus: 12 },
  strands: { kind: "strands", label: { zh: "Strands", en: "Strands" }, desc: { zh: "主题找词", en: "Find themed words" }, baseScore: 150, remainBonus: 8 },
  squaredle: { kind: "squaredle", label: { zh: "Squaredle", en: "Squaredle" }, desc: { zh: "方格连词", en: "Find words in a grid" }, baseScore: 160, remainBonus: 8 },
  queens: { kind: "queens", label: { zh: "Queens", en: "Queens" }, desc: { zh: "四皇后放置", en: "4-queens placement" }, baseScore: 200, remainBonus: 0 },
};

const WORD_BANK: Record<number, string[]> = {
  4: ["game", "grid", "clue", "tide", "glow", "play", "code", "flux", "mind", "word", "mode", "tile"],
  5: ["apple", "grape", "smile", "trace", "light", "crane", "plane", "sugar", "dream", "flame", "stone", "pride", "brave", "skill", "pixel"],
  6: ["planet", "silver", "castle", "stream", "friend", "breeze", "strike", "orange", "flight", "thrive", "matrix", "bridge"],
  7: ["quantum", "glimmer", "resolve", "fortune", "network", "premium", "letters", "clarity", "concept", "connect"],
  8: ["strategy", "optimize", "feedback", "dynamics", "discovery", "insights", "platform", "reactions"],
};

const SEMANTIC_TARGETS = [
  "ocean",
  "music",
  "future",
  "dream",
  "planet",
  "energy",
  "forest",
  "network",
  "signal",
  "memory",
  "freedom",
  "shadow",
  "culture",
  "vision",
  "voyage",
  "horizon",
  "motion",
  "bridge",
  "rhythm",
  "galaxy",
];
const COUNTRIES: Country[] = [
  { name: "china", lat: 35.8, lng: 104.1 },
  { name: "japan", lat: 36.2, lng: 138.2 },
  { name: "india", lat: 20.5, lng: 78.9 },
  { name: "brazil", lat: -14.2, lng: -51.9 },
  { name: "france", lat: 46.2, lng: 2.2 },
  { name: "canada", lat: 56.1, lng: -106.3 },
  { name: "egypt", lat: 26.8, lng: 30.8 },
  { name: "australia", lat: -25.2, lng: 133.7 },
  { name: "argentina", lat: -38.4, lng: -63.6 },
  { name: "mexico", lat: 23.6, lng: -102.5 },
];
const MATHLE_BANK = ["3+4=7", "8-3=5", "2+6=8", "9-4=5", "1+8=9"];
const BEE_PACK = { center: "a", ring: ["e", "r", "t", "l", "s", "n"], words: ["late", "teal", "alert", "stare", "learn", "rental", "lanes", "real", "near", "stale"] };
const WAFFLE_PACK = { source: "LPAEP", target: "APPLE" };
const STRANDS_PACK = { theme: "Space", words: ["STAR", "MOON", "MARS", "COMET"] };
const SQUAREDLE_PACK = { grid: ["S", "T", "A", "R", "M", "O", "O", "N", "P", "L", "A", "N", "E", "T", "S", "X"], words: ["STAR", "MOON", "PLANET"] };
const QUEENS_SOLUTION = ["A2", "B4", "C1", "D3"];

const i18n = {
  zh: {
    title: "WORDLES.PRO",
    sub: "更美观、更整合的全玩法大厅",
    language: "语言",
    username: "用户名",
    save: "保存",
    friend: "好友名",
    online: "联机",
    length: "单词位数",
    mode: "玩法",
    play: "对局",
    board: "榜单",
    submit: "提交",
    newRound: "新一局",
    attempts: "次数",
    remain: "剩余",
    score: "得分",
    noData: "暂无记录",
    inputWord: "输入英文单词",
  },
  en: {
    title: "WORDLES.PRO",
    sub: "A cleaner, visual-first all-mode game hub",
    language: "Language",
    username: "Username",
    save: "Save",
    friend: "Friend Name",
    online: "Online",
    length: "Word Length",
    mode: "Mode",
    play: "Play",
    board: "Leaderboard",
    submit: "Submit",
    newRound: "New Round",
    attempts: "Attempts",
    remain: "Remaining",
    score: "Score",
    noData: "No records",
    inputWord: "Enter English word",
  },
};

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function dateText() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function evaluateGuess(guess: string, target: string): LetterResult[] {
  const result: LetterResult[] = guess.split("").map((char) => ({ char, state: "absent" }));
  const remaining = target.split("");
  for (let i = 0; i < guess.length; i += 1) {
    if (guess[i] === target[i]) {
      result[i].state = "correct";
      remaining[i] = "#";
    }
  }
  for (let i = 0; i < guess.length; i += 1) {
    if (result[i].state !== "absent") continue;
    const idx = remaining.indexOf(guess[i]);
    if (idx !== -1) {
      result[i].state = "present";
      remaining[idx] = "#";
    }
  }
  return result;
}

function makePlayer(): PlayerProfile {
  const existing = safeGet<PlayerProfile | null>(STORAGE_KEYS.player, null);
  if (existing?.name) return existing;
  const count = safeGet<number>(STORAGE_KEYS.playerCount, 0) + 1;
  const created = { id: count, name: `worder${count}` };
  window.localStorage.setItem(STORAGE_KEYS.playerCount, JSON.stringify(count));
  window.localStorage.setItem(STORAGE_KEYS.player, JSON.stringify(created));
  return created;
}

function pickWords(length: number, count: number, seed: number) {
  const bank = WORD_BANK[length] || WORD_BANK[5];
  const list = [...bank];
  const rand = seededRandom(seed);
  list.sort(() => rand() - 0.5);
  const picks: string[] = [];
  while (picks.length < count) picks.push(list[picks.length % list.length]);
  return picks;
}

function calcDistance(a: Country, b: Country) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function semanticPointForWord(word: string) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  const h1 = hashString(clean || "word");
  const h2 = hashString((clean || "word").split("").reverse().join(""));
  return {
    x: 0.05 + ((h1 % 9000) / 9000) * 0.9,
    y: 0.05 + ((h2 % 9000) / 9000) * 0.9,
  };
}

function semanticSimilarity(a: string, b: string) {
  const p1 = semanticPointForWord(a);
  const p2 = semanticPointForWord(b);
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, Math.min(100, Math.round(100 - dist * 115)));
}

function ModeVisual({ mode }: { mode: GameModeConfig }) {
  if (mode.kind === "globle") {
    return (
      <div className="mode-visual mode-globe">
        <div className="orb" />
        <div className="ring ring-1" />
        <div className="ring ring-2" />
      </div>
    );
  }
  if (mode.kind === "semantic") {
    return (
      <div className="mode-visual mode-semantic">
        <div className="node n1" />
        <div className="node n2" />
        <div className="node n3" />
        <div className="link l1" />
        <div className="link l2" />
      </div>
    );
  }
  if (mode.kind === "mathle") {
    return (
      <div className="mode-visual mode-mathle">
        {"3+4=7".split("").map((char, i) => (
          <div key={i} className="symbol-tile">
            {char}
          </div>
        ))}
      </div>
    );
  }
  if (mode.kind === "spellingbee") {
    return (
      <div className="mode-visual mode-bee">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={`hex h${i}`} />
        ))}
      </div>
    );
  }
  return <div className="mode-visual mode-default" />;
}

const PROMO_MODE_ITEMS = [
  ["Daily + Unlimited", "Classic ritual or infinite practice, both in one flow."],
  ["WordlePro", "Pure logic pressure with aggregate feedback only."],
  ["Dordle to Duotrigordle", "From 2 boards to 32 boards with escalating mastery."],
  ["Semantic Explorer", "Navigate a live meaning map with animated guess points."],
  ["Globle + Mathle", "Geography intuition and equation patterning in one stack."],
  ["Bee / Waffle / Strands / Squaredle / Queens", "Fast variety modes for retention and challenge diversity."],
] as const;

function PromoSite({ onBack }: { onBack: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ["start start", "end end"] });
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, 1.08]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0.35]);
  const driftY = useTransform(scrollYProgress, [0, 1], ["-6%", "18%"]);

  return (
    <div ref={wrapRef} className="min-h-screen bg-[#04050a] text-white">
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 -z-10 promo-ambient" style={{ y: driftY }} />
      <section className="relative min-h-screen overflow-hidden px-6 pb-18 pt-7 md:px-10">
        <motion.div className="absolute inset-0 -z-10" style={{ scale: heroScale, opacity: heroOpacity }}>
          <div className="promo-bg" />
        </motion.div>

        <motion.nav
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex w-full max-w-6xl items-center justify-between border-b border-white/12 pb-5"
        >
          <p className="text-2xl font-semibold tracking-[0.24em]">WORDLES.PRO</p>
          <button onClick={onBack} className="mini-btn">
            Back To Game
          </button>
        </motion.nav>

        <div className="mx-auto flex min-h-[calc(100vh-6.2rem)] w-full max-w-6xl flex-col items-start justify-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.15 }}
            className="mb-6 text-xs tracking-[0.36em] text-cyan-200/80"
          >
            WORD PUZZLES REIMAGINED
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-5xl text-4xl font-semibold leading-[1.04] tracking-tight md:text-6xl lg:text-7xl"
          >
            A Premium Universe Of Word Games.
            <br />
            <span className="bg-gradient-to-r from-cyan-200 via-indigo-100 to-violet-300 bg-clip-text text-transparent">One Domain. Infinite Play.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.36 }}
            className="mt-8 max-w-2xl text-base leading-relaxed text-white/72 md:text-lg"
          >
            From Daily Wordle to Globle, Semantic Explorer, Mathle and multi-board extremes. WORDLES.PRO delivers silky interactions, elegant feedback, and serious puzzle depth.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.48 }}
            className="mt-10 flex flex-wrap gap-3"
          >
            <button className="action-btn">Play Now</button>
            <button className="action-btn ghost">Explore Modes</button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.54 }}
            className="mt-12 flex gap-2"
          >
            {"WORDLES.PRO".split("").map((ch, i) => (
              <motion.div
                key={`${ch}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.6 + i * 0.06 }}
                className="tile h-10 w-8 text-xs tile-empty md:h-12 md:w-10"
              >
                {ch}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="px-6 py-22 md:px-10">
        <div className="mx-auto grid w-full max-w-6xl gap-8 border-y border-white/10 py-12 md:grid-cols-3">
          {[
            ["Classic + Pro", "Choose classic tile feedback or Pro aggregate counts only."],
            ["17 Modes", "Daily, Unlimited, Quordle, Sedecordle, Globle, Mathle and more."],
            ["No Signup Barrier", "Instant play, editable username, leaderboard-ready sessions."],
          ].map(([title, desc], idx) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.55 }}
              transition={{ duration: 0.65, delay: idx * 0.12 }}
            >
              <p className="text-xl font-medium tracking-tight">{title}</p>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-6 py-22 md:px-10">
        <div className="mx-auto w-full max-w-6xl border-y border-white/10 py-12">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.45 }}
            className="text-xs tracking-[0.32em] text-white/45"
          >
            MODE ATLAS
          </motion.p>
          <motion.h3
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.45 }}
            className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight md:text-5xl"
          >
            Detailed mode narratives with visual-first interactions.
          </motion.h3>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {PROMO_MODE_ITEMS.map(([title, desc], idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.55, delay: idx * 0.06 }}
                className="border-b border-white/10 pb-4"
              >
                <p className="text-lg font-medium tracking-tight">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/64">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          className="mx-auto grid w-full max-w-6xl gap-8 border-y border-white/10 py-12 md:grid-cols-3"
        >
          {[
            ["Step 01", "Pick a mode and enter immersive play view instantly."],
            ["Step 02", "Read animated feedback and optimize attempts for score."],
            ["Step 03", "Finish, rank, and jump to another mode without friction."],
          ].map(([k, v], i) => (
            <motion.div key={k} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
              <p className="text-xs tracking-[0.2em] text-cyan-200/80">{k}</p>
              <p className="mt-2 text-sm text-white/66">{v}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="px-6 pb-24 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.8 }}
          className="mx-auto w-full max-w-6xl border-t border-white/10 pt-10"
        >
          <p className="text-xs tracking-[0.34em] text-white/48">READY TO PLAY</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">wordles.pro</p>
        </motion.div>
      </section>
    </div>
  );
}

export default function App() {
  const [siteView, setSiteView] = useState<SiteView>("game");
  const [language, setLanguage] = useState<Language>("zh");
  const t = i18n[language];

  const [viewTab, setViewTab] = useState<ViewTab>("play");
  const [immersive, setImmersive] = useState(false);
  const [player, setPlayer] = useState<PlayerProfile>(() => makePlayer());
  const [nameDraft, setNameDraft] = useState(player.name);
  const [friendName, setFriendName] = useState("buddy");
  const [onlineEnabled, setOnlineEnabled] = useState(false);

  const [modeKey, setModeKey] = useState<GameModeKey>("daily");
  const mode = MODES[modeKey];
  const [wordLength, setWordLength] = useState(5);

  const [targets, setTargets] = useState<string[]>([]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("Ready");
  const [locked, setLocked] = useState(false);

  const [speedSeconds, setSpeedSeconds] = useState(90);
  const [speedSolved, setSpeedSolved] = useState(0);

  const [duoTurn, setDuoTurn] = useState<"me" | "friend">("me");
  const [duoMe, setDuoMe] = useState<string[]>([]);
  const [duoFriend, setDuoFriend] = useState<string[]>([]);

  const [semanticTarget, setSemanticTarget] = useState("ocean");
  const [semanticInput, setSemanticInput] = useState("");
  const [semanticHints, setSemanticHints] = useState<string[]>([]);
  const [semanticGuesses, setSemanticGuesses] = useState<SemanticGuessPoint[]>([]);

  const [globleTarget, setGlobleTarget] = useState<Country>(COUNTRIES[0]);
  const [globleInput, setGlobleInput] = useState("");
  const [globleHints, setGlobleHints] = useState<string[]>([]);
  const [globleGuessPoints, setGlobleGuessPoints] = useState<GlobleGuess[]>([]);

  const [mathleTarget, setMathleTarget] = useState(MATHLE_BANK[0]);
  const [mathleInput, setMathleInput] = useState("");
  const [mathleGuesses, setMathleGuesses] = useState<string[]>([]);

  const [beeInput, setBeeInput] = useState("");
  const [beeFound, setBeeFound] = useState<string[]>([]);

  const [waffleInput, setWaffleInput] = useState("");
  const [strandsInput, setStrandsInput] = useState("");
  const [strandsFound, setStrandsFound] = useState<string[]>([]);
  const [squaredleInput, setSquaredleInput] = useState("");
  const [squaredleFound, setSquaredleFound] = useState<string[]>([]);
  const [queenInput, setQueenInput] = useState("");

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => safeGet(STORAGE_KEYS.leaderboard, []));

  const boards = mode.kind === "wordle" ? (onlineEnabled ? 1 : mode.boards ?? 1) : 1;
  const attempts = mode.attempts ?? 6;
  const feedback = mode.feedback ?? "classic";
  const session = mode.session ?? "unlimited";

  const visibleTargets = useMemo(() => {
    if (modeKey === "duotrigordle") return targets.slice(0, 8);
    if (modeKey === "sedecordle") return targets.slice(0, 8);
    return targets;
  }, [targets, modeKey]);

  const pushScore = (name: string, score: number, detail: string) => {
    const entry: LeaderboardEntry = { id: `${Date.now()}-${Math.random()}`, name, mode: modeKey, score, detail, date: dateText() };
    const merged = [entry, ...leaderboard].sort((a, b) => b.score - a.score).slice(0, 60);
    setLeaderboard(merged);
    window.localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(merged));
  };

  const resetMode = () => {
    setLocked(false);
    setInput("");
    setGuesses([]);
    setDuoMe([]);
    setDuoFriend([]);
    setDuoTurn("me");
    setSpeedSeconds(90);
    setSpeedSolved(0);

    const dailySeed = hashString(`${player.id}-${dateText()}-${wordLength}-${modeKey}`);
    const randomSeed = hashString(`${Date.now()}-${player.id}-${modeKey}`);
    const seed = session === "daily" ? dailySeed : randomSeed;
    setTargets(pickWords(wordLength, boards, seed));

    const rand = seededRandom(seed);
    setSemanticTarget(SEMANTIC_TARGETS[Math.floor(rand() * SEMANTIC_TARGETS.length)]);
    setSemanticInput("");
    setSemanticHints([]);
    setSemanticGuesses([]);

    setGlobleTarget(COUNTRIES[Math.floor(rand() * COUNTRIES.length)]);
    setGlobleInput("");
    setGlobleHints([]);
    setGlobleGuessPoints([]);

    setMathleTarget(MATHLE_BANK[Math.floor(rand() * MATHLE_BANK.length)]);
    setMathleInput("");
    setMathleGuesses([]);
    setBeeInput("");
    setBeeFound([]);
    setWaffleInput("");
    setStrandsInput("");
    setStrandsFound([]);
    setSquaredleInput("");
    setSquaredleFound([]);
    setQueenInput("");

    setMessage(language === "zh" ? "新对局已开始" : "New round started");
  };

  useEffect(() => {
    resetMode();
  }, [modeKey, wordLength, onlineEnabled]);

  useEffect(() => {
    if (modeKey !== "speed" || locked) return;
    if (speedSeconds <= 0) {
      setLocked(true);
      const score = mode.baseScore + speedSolved * 60;
      pushScore(player.name, score, `solved ${speedSolved}`);
      setMessage(language === "zh" ? `时间到，得分 ${score}` : `Time up, score ${score}`);
      return;
    }
    const timer = window.setInterval(() => setSpeedSeconds((v) => v - 1), 1000);
    return () => window.clearInterval(timer);
  }, [speedSeconds, modeKey, locked, speedSolved]);

  const saveName = () => {
    const name = nameDraft.trim();
    if (!name) return;
    const updated = { ...player, name };
    setPlayer(updated);
    window.localStorage.setItem(STORAGE_KEYS.player, JSON.stringify(updated));
    setMessage(language === "zh" ? "用户名已更新" : "Username updated");
  };

  const submitWordleGuess = () => {
    if (locked) return;
    const guess = input.trim().toLowerCase();
    const pool = WORD_BANK[wordLength] || WORD_BANK[5];
    if (guess.length !== wordLength || !/^[a-z]+$/.test(guess) || !pool.includes(guess)) {
      setMessage(language === "zh" ? "请输入有效英文单词" : "Enter a valid English word");
      return;
    }

    if (modeKey === "speed") {
      if (guess === targets[0]) {
        setSpeedSolved((v) => v + 1);
        setTargets(pickWords(wordLength, 1, hashString(`${Date.now()}-${player.id}`)));
        setGuesses([]);
        setMessage(language === "zh" ? "命中，切换下一题" : "Solved, next puzzle");
      } else {
        const next = [...guesses, guess];
        setGuesses(next);
        if (next.length >= attempts) {
          setTargets(pickWords(wordLength, 1, hashString(`${Date.now()}-${player.id}`)));
          setGuesses([]);
        }
      }
      setInput("");
      return;
    }

    if (onlineEnabled && friendName.trim()) {
      const activeName = duoTurn === "me" ? player.name : friendName;
      const active = duoTurn === "me" ? duoMe : duoFriend;
      const nextActive = [...active, guess];
      if (duoTurn === "me") setDuoMe(nextActive);
      else setDuoFriend(nextActive);
      if (guess === targets[0]) {
        setLocked(true);
        const score = mode.baseScore + Math.max(attempts - nextActive.length, 0) * mode.remainBonus;
        pushScore(activeName, score, `${nextActive.length}/${attempts}`);
        setMessage(language === "zh" ? `${activeName} 获胜 +${score}` : `${activeName} wins +${score}`);
      } else {
        setDuoTurn((v) => (v === "me" ? "friend" : "me"));
      }
      setInput("");
      return;
    }

    const nextGuesses = [...guesses, guess];
    setGuesses(nextGuesses);
    setInput("");
    const solved = targets.map((target) => nextGuesses.some((g) => g === target));
    if (solved.every(Boolean)) {
      setLocked(true);
      const score = mode.baseScore + boards * 22 + Math.max(attempts - nextGuesses.length, 0) * mode.remainBonus;
      pushScore(player.name, score, `${nextGuesses.length}/${attempts}`);
      setMessage(language === "zh" ? `通关 +${score}` : `Solved +${score}`);
      return;
    }
    if (nextGuesses.length >= attempts) {
      setLocked(true);
      setMessage(language === "zh" ? `次数用完，答案 ${targets.join("/")}` : `Out of attempts. ${targets.join("/")}`);
    }
  };

  const submitModeAction = () => {
    if (mode.kind === "wordle") {
      submitWordleGuess();
      return;
    }
    if (locked) return;

    if (mode.kind === "semantic") {
      const guess = semanticInput.trim().toLowerCase();
      if (!guess) return;
      if (!/^[a-z]{3,}$/.test(guess)) {
        setMessage(language === "zh" ? "请输入至少3位英文单词" : "Enter at least 3 English letters");
        return;
      }
      const guessPoint = semanticPointForWord(guess);
      const scorePct = semanticSimilarity(guess, semanticTarget);

      const next = [...semanticHints, `${guess}: ${scorePct}%`];
      setSemanticHints(next.slice(-8));
      setSemanticGuesses((prev) => [...prev, { word: guess, x: guessPoint.x, y: guessPoint.y, similarity: scorePct }]);
      setSemanticInput("");
      if (guess === semanticTarget) {
        setLocked(true);
        const score = mode.baseScore + Math.max(8 - next.length, 0) * mode.remainBonus;
        pushScore(player.name, score, `${next.length} hints`);
      }
      return;
    }

    if (mode.kind === "globle") {
      const guess = globleInput.trim().toLowerCase();
      const country = COUNTRIES.find((c) => c.name === guess);
      if (!country) {
        setMessage(language === "zh" ? "请输入国家英文名" : "Enter a valid country name");
        return;
      }
      const dist = calcDistance(country, globleTarget);
      const ns = country.lat < globleTarget.lat ? "N" : "S";
      const ew = country.lng < globleTarget.lng ? "E" : "W";
      const heat = Math.max(0, 100 - Math.round((dist / 17000) * 100));
      const next = [...globleHints, `${guess}: ${dist}km ${ns}${ew}`];
      setGlobleHints(next.slice(-8));
      setGlobleGuessPoints((prev) => [...prev, { word: guess, distance: dist, direction: `${ns}${ew}`, heat }].slice(-18));
      setGlobleInput("");
      if (guess === globleTarget.name) {
        setLocked(true);
        const score = mode.baseScore + Math.max(8 - next.length, 0) * mode.remainBonus;
        pushScore(player.name, score, `${next.length} tries`);
      }
      return;
    }

    if (mode.kind === "mathle") {
      const guess = mathleInput.trim();
      if (!MATHLE_BANK.includes(guess)) {
        setMessage(language === "zh" ? "格式如 3+4=7" : "Use format 3+4=7");
        return;
      }
      const next = [...mathleGuesses, guess];
      setMathleGuesses(next);
      setMathleInput("");
      if (guess === mathleTarget) {
        setLocked(true);
        const score = mode.baseScore + Math.max(6 - next.length, 0) * mode.remainBonus;
        pushScore(player.name, score, `${next.length}/6`);
      }
      return;
    }

    if (mode.kind === "spellingbee") {
      const guess = beeInput.trim().toLowerCase();
      if (!guess.includes(BEE_PACK.center) || !BEE_PACK.words.includes(guess) || beeFound.includes(guess)) return;
      const next = [...beeFound, guess];
      setBeeFound(next);
      setBeeInput("");
      if (next.length === BEE_PACK.words.length) {
        setLocked(true);
        pushScore(player.name, mode.baseScore + 70, `found ${next.length}`);
      }
      return;
    }

    if (mode.kind === "waffle") {
      if (waffleInput.trim().toUpperCase() === WAFFLE_PACK.target) {
        setLocked(true);
        pushScore(player.name, mode.baseScore + 45, "solved");
      }
      return;
    }

    if (mode.kind === "strands") {
      const guess = strandsInput.trim().toUpperCase();
      if (STRANDS_PACK.words.includes(guess) && !strandsFound.includes(guess)) {
        const next = [...strandsFound, guess];
        setStrandsFound(next);
        if (next.length === STRANDS_PACK.words.length) {
          setLocked(true);
          pushScore(player.name, mode.baseScore + 55, `found ${next.length}`);
        }
      }
      setStrandsInput("");
      return;
    }

    if (mode.kind === "squaredle") {
      const guess = squaredleInput.trim().toUpperCase();
      if (SQUAREDLE_PACK.words.includes(guess) && !squaredleFound.includes(guess)) {
        const next = [...squaredleFound, guess];
        setSquaredleFound(next);
        if (next.length === SQUAREDLE_PACK.words.length) {
          setLocked(true);
          pushScore(player.name, mode.baseScore + 55, `found ${next.length}`);
        }
      }
      setSquaredleInput("");
      return;
    }

    if (mode.kind === "queens") {
      const picks = queenInput
        .toUpperCase()
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      if (picks.length === 4 && QUEENS_SOLUTION.every((x) => picks.includes(x))) {
        setLocked(true);
        pushScore(player.name, mode.baseScore + 60, "4/4");
      }
    }
  };

  const renderModeBoard = () => {
    if (mode.kind !== "wordle") {
      if (mode.kind === "semantic") {
        const target = semanticPointForWord(semanticTarget);
        return (
          <div className="mode-panel">
            <div className="semantic-map">
              <div className="semantic-grid" />
              <motion.div
                className="semantic-target"
                animate={{ scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
              >
                {locked ? semanticTarget.toUpperCase() : "?"}
              </motion.div>

              {semanticGuesses.map((point, index) => (
                <motion.div
                  key={`${point.word}-${index}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.35) }}
                  className="semantic-dot"
                  style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                >
                  <span>{point.word}</span>
                  <em>{point.similarity}%</em>
                </motion.div>
              ))}
            </div>

            <div className="mt-3 grid gap-1 text-xs text-white/70 md:grid-cols-2">
              {semanticHints.map((h) => (
                <p key={h}>{h}</p>
              ))}
            </div>
          </div>
        );
      }
      if (mode.kind === "globle") {
        return (
          <div className="mode-panel">
            <div className="globle-stage">
              <motion.div
                className="globle-orb"
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              />
              {globleGuessPoints.map((point, index) => (
                <motion.div
                  key={`${point.word}-${index}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="globle-ping"
                  style={{
                    left: `${12 + (index * 11) % 76}%`,
                    top: `${16 + (index * 17) % 66}%`,
                    borderColor: `hsl(${Math.max(0, point.heat) * 1.2}, 90%, 62%)`,
                  }}
                >
                  <span>{point.word}</span>
                  <em>{point.distance}km</em>
                </motion.div>
              ))}
            </div>
            <div className="mt-3 grid gap-1 text-xs text-white/70 md:grid-cols-2">
              {globleHints.map((h) => (
                <p key={h}>{h}</p>
              ))}
            </div>
          </div>
        );
      }
      if (mode.kind === "mathle") {
        return (
          <div className="mode-panel">
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, rowIndex) => {
                const guess = mathleGuesses[rowIndex] || "";
                return (
                  <div key={rowIndex} className="flex gap-1">
                    {Array.from({ length: 5 }).map((__, colIndex) => {
                      const char = guess[colIndex] || "";
                      const ok = char && mathleTarget[colIndex] === char;
                      return (
                        <motion.div
                          key={`${rowIndex}-${colIndex}`}
                          initial={char ? { rotateX: -90, opacity: 0 } : false}
                          animate={char ? { rotateX: 0, opacity: 1 } : { opacity: 1 }}
                          className={`tile h-9 w-9 text-xs ${char ? (ok ? "tile-correct" : "tile-present") : "tile-empty"}`}
                        >
                          {char}
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      if (mode.kind === "spellingbee") {
        return (
          <div className="mode-panel">
            <div className="bee-board">
              {Array.from({ length: 7 }).map((_, i) => {
                const isCenter = i === 0;
                const label = isCenter ? BEE_PACK.center.toUpperCase() : BEE_PACK.ring[i - 1].toUpperCase();
                return (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.1 }}
                    className={`bee-cell b${i}`}
                  >
                    {label}
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {beeFound.map((w) => (
                <motion.span key={w} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="found-chip">
                  {w}
                </motion.span>
              ))}
            </div>
          </div>
        );
      }
      if (mode.kind === "waffle") {
        return (
          <div className="mode-panel">
            <div className="flex gap-2">
              {WAFFLE_PACK.source.split("").map((char, index) => (
                <motion.div
                  key={index}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.1 }}
                  className="tile h-10 w-10 tile-empty"
                >
                  {char}
                </motion.div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/65">target: {WAFFLE_PACK.target}</p>
          </div>
        );
      }
      if (mode.kind === "strands") {
        return (
          <div className="mode-panel">
            <p className="text-xs text-white/60">theme: {STRANDS_PACK.theme}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STRANDS_PACK.words.map((word) => {
                const found = strandsFound.includes(word);
                return (
                  <motion.span
                    key={word}
                    animate={found ? { scale: [1, 1.08, 1] } : { opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    className={`found-chip ${found ? "found-chip-hit" : ""}`}
                  >
                    {word}
                  </motion.span>
                );
              })}
            </div>
          </div>
        );
      }
      if (mode.kind === "squaredle") {
        return (
          <div className="mode-panel">
            <div className="grid w-fit grid-cols-4 gap-1">{SQUAREDLE_PACK.grid.map((c, i) => <div key={i} className="tile h-8 w-8 tile-empty text-xs">{c}</div>)}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {squaredleFound.map((word) => (
                <motion.span key={word} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="found-chip found-chip-hit">
                  {word}
                </motion.span>
              ))}
            </div>
          </div>
        );
      }
      const queenMarks = queenInput
        .toUpperCase()
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      return (
        <div className="mode-panel">
          <div className="queens-grid">
            {Array.from({ length: 4 }).map((_, row) =>
              Array.from({ length: 4 }).map((__, col) => {
                const mark = `${String.fromCharCode(65 + col)}${row + 1}`;
                const selected = queenMarks.includes(mark);
                return (
                  <motion.div key={mark} className={`queen-cell ${(row + col) % 2 === 0 ? "queen-light" : "queen-dark"}`}>
                    {selected ? "Q" : ""}
                  </motion.div>
                );
              }),
            )}
          </div>
          <p className="mt-2 text-xs text-white/60">target: A2, B4, C1, D3</p>
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleTargets.map((target, boardIndex) => {
          const rows = onlineEnabled
            ? [
                { name: player.name, guesses: duoMe },
                { name: friendName, guesses: duoFriend },
              ]
            : [{ name: "solo", guesses }];

          return (
            <div key={`${target}-${boardIndex}`} className="mode-panel border border-white/10 p-3">
              <div className="mb-2 flex justify-between text-xs text-white/50">
                <span>BOARD {boardIndex + 1}</span>
                <span>{guesses.some((g) => g === target) ? "solved" : "..."}</span>
              </div>
              {rows.map((row) => (
                <div key={row.name} className="mb-2">
                  {onlineEnabled ? <p className="mb-1 text-[11px] text-white/40">{row.name}</p> : null}
                  <div className="space-y-1">
                    {Array.from({ length: attempts }).map((_, rIdx) => {
                      const guess = row.guesses[rIdx];
                      const hasGuess = typeof guess === "string";
                      const evals = hasGuess ? evaluateGuess(guess, target) : [];
                      if (feedback === "pro" && hasGuess) {
                        const g = evals.filter((x) => x.state === "correct").length;
                        const y = evals.filter((x) => x.state === "present").length;
                        const r = evals.filter((x) => x.state === "absent").length;
                        return (
                          <motion.div
                            key={rIdx}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center justify-between border border-white/10 px-2 py-1 text-xs"
                          >
                            <span className="font-mono">{guess.toUpperCase()}</span>
                            <span><span className="text-[#35d07f]">G{g}</span> <span className="text-[#f3c747]">Y{y}</span> <span className="text-[#ff4f5f]">R{r}</span></span>
                          </motion.div>
                        );
                      }
                      return (
                        <div key={rIdx} className="flex gap-1">
                          {Array.from({ length: wordLength }).map((__, cIdx) => {
                            const char = hasGuess ? guess[cIdx]?.toUpperCase() : "";
                            const st = hasGuess ? evals[cIdx]?.state : undefined;
                            return (
                              <motion.div
                                key={cIdx}
                                initial={hasGuess ? { rotateX: -90, opacity: 0 } : false}
                                animate={hasGuess ? { rotateX: 0, opacity: 1 } : { opacity: 1 }}
                                transition={{ duration: 0.28, delay: cIdx * 0.035 }}
                                className={`tile h-8 w-8 text-xs ${st ? `tile-${st}` : "tile-empty"}`}
                              >
                                {char}
                              </motion.div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const nonWordInput =
    mode.kind === "semantic"
      ? { value: semanticInput, set: setSemanticInput, placeholder: "try: ocean, music, planet" }
      : mode.kind === "globle"
        ? { value: globleInput, set: setGlobleInput, placeholder: "country name" }
        : mode.kind === "mathle"
          ? { value: mathleInput, set: setMathleInput, placeholder: "3+4=7" }
          : mode.kind === "spellingbee"
            ? { value: beeInput, set: setBeeInput, placeholder: `must include ${BEE_PACK.center}` }
            : mode.kind === "waffle"
              ? { value: waffleInput, set: setWaffleInput, placeholder: WAFFLE_PACK.target }
              : mode.kind === "strands"
                ? { value: strandsInput, set: setStrandsInput, placeholder: STRANDS_PACK.theme }
                : mode.kind === "squaredle"
                  ? { value: squaredleInput, set: setSquaredleInput, placeholder: "STAR" }
                  : { value: queenInput, set: setQueenInput, placeholder: "A2,B4,C1,D3" };

  if (siteView === "promo") {
    return <PromoSite onBack={() => setSiteView("game")} />;
  }

  const modeBgClass =
    mode.kind === "semantic"
      ? "immersive-semantic"
      : mode.kind === "globle"
        ? "immersive-globle"
        : mode.kind === "mathle"
          ? "immersive-mathle"
          : "immersive-default";

  if (immersive) {
    return (
      <div className={`immersive-shell ${modeBgClass}`}>
        <motion.div className="immersive-bg" animate={{ opacity: [0.55, 0.78, 0.55] }} transition={{ duration: 6, repeat: Infinity }} />
        <div className="mx-auto w-full max-w-6xl px-5 py-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/12 pb-4">
            <div>
              <p className="text-xs tracking-[0.2em] text-white/55">WORDLES.PRO</p>
              <p className="text-2xl font-semibold tracking-tight">{mode.label[language]}</p>
              <p className="text-sm text-white/60">{mode.desc[language]}</p>
            </div>
            <button onClick={() => setImmersive(false)} className="mini-btn">
              {language === "zh" ? "返回大厅" : "Back To Hub"}
            </button>
          </div>

          <div className="panel mb-4">
            <AnimatePresence mode="wait">
              <motion.div key={`immersive-visual-${modeKey}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
                <ModeVisual mode={mode} />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="panel mb-4">
            <div className="flex flex-wrap gap-2">
              <input
                value={mode.kind === "wordle" ? input : nonWordInput.value}
                onChange={(e) => (mode.kind === "wordle" ? setInput(e.target.value.toLowerCase()) : nonWordInput.set(e.target.value.toLowerCase()))}
                onKeyDown={(e) => e.key === "Enter" && submitModeAction()}
                placeholder={mode.kind === "wordle" ? `${t.inputWord} (${wordLength})` : nonWordInput.placeholder}
                className="input-main"
              />
              <button onClick={submitModeAction} className="action-btn">{t.submit}</button>
              <button onClick={resetMode} className="action-btn ghost">{t.newRound}</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/65">
              {mode.kind === "wordle" ? (
                <>
                  <span>{t.attempts}: {onlineEnabled ? Math.max(duoMe.length, duoFriend.length) : guesses.length}/{attempts}</span>
                  <span>{t.remain}: {Math.max(attempts - (onlineEnabled ? Math.max(duoMe.length, duoFriend.length) : guesses.length), 0)}</span>
                  {modeKey === "speed" ? <span>{speedSeconds}s | solved {speedSolved}</span> : null}
                  {onlineEnabled ? <span>turn: {duoTurn === "me" ? player.name : friendName}</span> : null}
                </>
              ) : null}
            </div>
            <AnimatePresence mode="wait">
              <motion.p key={message} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -7 }} className="mt-2 text-sm text-cyan-100/90">
                {message}
              </motion.p>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={`immersive-board-${modeKey}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4 }}>
              {renderModeBoard()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05060b] px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="hero-plane">
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-semibold tracking-[0.22em] md:text-5xl">
            {t.title}
          </motion.h1>
          <p className="mt-3 max-w-2xl text-white/70">{t.sub}</p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="panel">
              <p className="panel-title">{t.language}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setLanguage("zh")} className={`mini-btn ${language === "zh" ? "active" : ""}`}>中文</button>
                <button onClick={() => setLanguage("en")} className={`mini-btn ${language === "en" ? "active" : ""}`}>EN</button>
              </div>
            </div>

            <div className="panel">
              <p className="panel-title">{t.username}</p>
              <div className="mt-2 flex gap-2">
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="input-mini" />
                <button onClick={saveName} className="mini-btn active">{t.save}</button>
              </div>
            </div>

            <div className="panel">
              <p className="panel-title">{t.friend}</p>
              <input value={friendName} onChange={(e) => setFriendName(e.target.value)} className="input-mini mt-2" />
              <button onClick={() => setOnlineEnabled((v) => !v)} className={`mini-btn mt-2 w-full ${onlineEnabled ? "active-green" : ""}`}>{t.online}: {onlineEnabled ? "ON" : "OFF"}</button>
            </div>

            <div className="panel">
              <p className="panel-title">{t.length}</p>
              <input type="number" min={4} max={8} value={wordLength} onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= 4 && n <= 8) setWordLength(n);
              }} className="input-mini mt-2" />
            </div>
          </aside>

          <main>
            <div className="panel mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setViewTab("play")} className={`mini-btn ${viewTab === "play" ? "active" : ""}`}>{t.play}</button>
                  <button onClick={() => setViewTab("leaderboard")} className={`mini-btn ${viewTab === "leaderboard" ? "active" : ""}`}>{t.board}</button>
                  <button onClick={() => setSiteView("promo")} className="mini-btn active">Promo Site</button>
                </div>
                <div className="text-sm text-white/65">{t.mode}: {mode.label[language]}</div>
              </div>
            </div>

            {viewTab === "play" ? (
              <>
                <div className="panel mb-4">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {(Object.keys(MODES) as GameModeKey[]).map((key) => {
                      const cfg = MODES[key];
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setModeKey(key);
                            setViewTab("play");
                            setImmersive(true);
                          }}
                          className={`mode-chip ${key === modeKey ? "mode-chip-active" : ""}`}
                        >
                          <span>{cfg.label[language]}</span>
                          <span className="mode-chip-meta">{cfg.desc[language]}</span>
                        </button>
                      );
                    })}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div key={`hub-visual-${modeKey}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                      <ModeVisual mode={mode} />
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="panel mb-4">
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={mode.kind === "wordle" ? input : nonWordInput.value}
                      onChange={(e) => (mode.kind === "wordle" ? setInput(e.target.value.toLowerCase()) : nonWordInput.set(e.target.value.toLowerCase()))}
                      onKeyDown={(e) => e.key === "Enter" && submitModeAction()}
                      placeholder={mode.kind === "wordle" ? `${t.inputWord} (${wordLength})` : nonWordInput.placeholder}
                      className="input-main"
                    />
                    <button onClick={submitModeAction} className="action-btn">{t.submit}</button>
                    <button onClick={resetMode} className="action-btn ghost">{t.newRound}</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/65">
                    {mode.kind === "wordle" ? (
                      <>
                        <span>{t.attempts}: {onlineEnabled ? Math.max(duoMe.length, duoFriend.length) : guesses.length}/{attempts}</span>
                        <span>{t.remain}: {Math.max(attempts - (onlineEnabled ? Math.max(duoMe.length, duoFriend.length) : guesses.length), 0)}</span>
                        {modeKey === "speed" ? <span>{speedSeconds}s | solved {speedSolved}</span> : null}
                        {onlineEnabled ? <span>turn: {duoTurn === "me" ? player.name : friendName}</span> : null}
                      </>
                    ) : null}
                  </div>
                  {mode.kind === "semantic" ? (
                    <p className="mt-2 text-xs text-white/50">
                      semantic map now supports every English word input (3+ letters), each word has its own generated point.
                    </p>
                  ) : null}
                  <AnimatePresence mode="wait">
                    <motion.p key={message} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -7 }} className="mt-2 text-sm text-cyan-100/90">
                      {message}
                    </motion.p>
                  </AnimatePresence>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={`hub-board-${modeKey}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
                    {renderModeBoard()}
                  </motion.div>
                </AnimatePresence>
              </>
            ) : (
              <div className="panel">
                <div className="space-y-2">
                  {leaderboard.length === 0 ? <p className="text-sm text-white/45">{t.noData}</p> : null}
                  {leaderboard.map((entry, idx) => (
                    <div key={entry.id} className="flex items-center justify-between border-b border-white/10 pb-2 text-sm">
                      <div>
                        <p>{idx + 1}. {entry.name}</p>
                        <p className="text-xs text-white/45">{MODES[entry.mode].label[language]} | {entry.detail} | {entry.date}</p>
                      </div>
                      <p className="font-semibold text-cyan-100">{entry.score}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
