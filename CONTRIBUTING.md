# Contributing to Soroban DevConsole

First off, thank you for considering contributing to Soroban DevConsole!

This project is a comprehensive web-based developer toolkit for the Stellar/Soroban ecosystem. We are currently participating in **Drips Wave #1**, which means your contributions can earn you rewards! 🌊

## 🌊 Participating in Drips Wave #1

This project is part of the [Drips Wave program](https://www.drips.network/wave), a recurring funding cycle for open-source contributions.

### How to Earn Rewards

1.  **Find an Issue:** Look for issues labeled `wave-1`. These are funded tasks eligible for rewards.
2.  **Claim the Issue:** You **MUST** comment on the issue to claim it.
    - _Comment:_ "I would like to work on this."
    - _Wait for Assignment:_ Do not start coding until a maintainer has assigned the issue to you. This ensures multiple people don't work on the same task.
3.  **Submit a PR:** Submit your Pull Request within a reasonable timeframe (usually 2-3 days).
4.  **Get Merged:** Once your PR is reviewed and merged, you will be eligible for Wave points/rewards.

**Note:** Please check the [Wave Documentation](https://docs.drips.network/wave) for specific details on how points and rewards are calculated.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

1.  **Fork** the repository on GitHub.
2.  **Clone** your fork locally:
    ```bash
    git clone [https://github.com/your-username/soroban-dev-console.git](https://github.com/your-username/soroban-dev-console.git)
    cd soroban-dev-console
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
4.  **Start the development server:**
    ```bash
    npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

---

## 🛠️ Development Guidelines

### Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Icons:** Lucide React
- **State:** Zustand
- **Blockchain:** stellar-sdk

### 🎨 UI/UX & Design Standards

**Important:** We do not currently have a dedicated UI designer. To maintain consistency:

1.  **Stick to Defaults:** Use standard [shadcn/ui](https://ui.shadcn.com/) components. Do not override styles unless absolutely necessary.
2.  **Layout:** Use standard Tailwind spacing (e.g., `p-4`, `gap-4`, `m-4`).
3.  **Icons:** Use `lucide-react` icons for all iconography.
4.  **Theme:** Keep the design clean and minimal (Slate/Zinc palette).

### 📂 Folder Structure

- `/app`: Next.js App Router pages and layouts.
- `/components`: Reusable UI components.
  - `/components/ui`: Shadcn primitives (Buttons, Cards, etc.).
- `/lib`: Utility functions and Stellar SDK configurations.
- `/hooks`: Custom React hooks (e.g., `useWallet`).
- `/store`: Zustand state stores.

---

## 📝 Pull Request Process

1.  **Create a Branch:** Create a new branch for your feature or fix.
    - Format: `feature/issue-number-short-description`
    - Example: `feature/12-wallet-connection`
2.  **Commit Messages:** Write clear, descriptive commit messages.
3.  **Tests:** If you are adding complex logic, please include tests (Jest/React Testing Library).
4.  **Review:** Open a Pull Request against the `main` branch.
    - Reference the issue you are fixing in the description (e.g., "Fixes #12").
    - Include screenshots if you made UI changes.
5.  **Feedback:** Expect review feedback within 24-48 hours. Please address comments promptly.

---

## 📏 Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all. Please be respectful and inclusive in your interactions.

---

Happy Coding! 🚀
