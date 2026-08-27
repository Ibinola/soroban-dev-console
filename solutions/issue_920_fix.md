Below is a **minimal, production‑ready patch** that adds a “transaction‑diff” view to the TxMonitor UI.  
The patch is split into three logical parts:

| Part | What it does | File(s) |
|------|--------------|---------|
| 1️⃣  | **UI for selecting two transactions** – a tiny multi‑select in the feed | `src/components/TxFeed.tsx` |
| 2️⃣  | **Diff modal** – renders side‑by‑side JSON diff + latency/fee highlights | `src/components/TxDiffModal.tsx` |
| 3️⃣  | **Utility helpers** – JSON diffing & simple numeric diff | `src/utils/txDiff.ts` |

> **Assumptions**  
> * The repo uses **React + TypeScript** (the rest of the codebase follows the same pattern).  
> * `Tx` type is already defined in `src/types/tx.ts`.  
> * The feed component already renders a list of transactions.  
> * Styling is done with CSS modules (or `styled-components` – the snippet uses CSS modules for clarity).  

---

## 1️⃣  Feed – add a “compare” selector

```tsx
// src/components/TxFeed.tsx
import React, { useState } from 'react';
import { Tx } from '../types/tx';
import TxDiffModal from './TxDiffModal';
import styles from './TxFeed.module.css';

type Props = {
  txs: Tx[];
};

export default function TxFeed({ txs }: Props) {
  // keep track of up to two selected txs
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDiff, setShowDiff] = useState(false);

  const toggleSelect = (id: string) => {
    const newSel = new Set(selected);
    if (newSel.has(id)) newSel.delete(id);
    else newSel.add(id);
    setSelected(newSel);
    if (newSel.size === 2) setShowDiff(true);
  };

  const selectedTxs = txs.filter((t) => selected.has(t.id));

  return (
    <div className={styles.feed}>
      {txs.map((tx) => (
        <div
          key={tx.id}
          className={`${styles.txItem} ${
            selected.has(tx.id) ? styles.selected : ''
          }`}
          onClick={() => toggleSelect(tx.id)}
        >
          <span>{tx.hash.slice(0, 8)}…</span>
          <span>{tx.method}</span>
        </div>
      ))}

      {showDiff && (
        <TxDiffModal
          txA={selectedTxs[0]}
          txB={selectedTxs[1]}
          onClose={() => {
            setShowDiff(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
```

**CSS (TxFeed