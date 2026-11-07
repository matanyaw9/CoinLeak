// Every piece of English text in the window, in one place, so a Hebrew
// version can be added later without hunting through components.

import type { ProviderId, SyncStage } from "@shared/types";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-IL")} ${n === 1 ? one : many}`;

export const s = {
  app: {
    name: "CoinLeak",
    tagline: "Your money, kept local",
    localOnly: "Local only",
    localOnlyHint: "Your data never leaves this computer.",
    demo: "Demo data",
    demoHint: "Made-up numbers to show the app.",
  },

  nav: {
    home: "Home",
    transactions: "Transactions",
    categories: "Categories",
    accounts: "Accounts",
    settings: "Settings",
  },

  month: {
    previous: "Previous month",
    next: "Next month",
    hint: "Use the left and right arrow keys to change month",
  },

  sync: {
    button: "Sync",
    syncing: "Syncing",
    title: "Sync your accounts",
    intro: "A private browser opens on your bank's own website. You log in there, and CoinLeak downloads your transactions.",
    syncOne: "Sync",
    cancel: "Cancel",
    never: "Not synced yet",
    lastSynced: (when: string) => `Synced ${when}`,
    stage: {
      opening_browser: "Opening a private browser",
      waiting_for_login: "Waiting for you to log in",
      downloading: "Downloading transactions",
      saving: "Saving to this computer",
      done: "All done",
      failed: "Sync stopped",
    } satisfies Record<SyncStage, string>,
    stageShort: {
      opening_browser: "Opening browser",
      waiting_for_login: "Log in to continue",
      downloading: "Downloading",
      saving: "Saving",
      done: "Done",
      failed: "Stopped",
    } satisfies Record<SyncStage, string>,
    upToDate: (provider: string) => `${provider} is up to date`,
    added: (provider: string, n: number) => `${plural(n, "new transaction", "new transactions")} from ${provider}`,
    updated: (n: number) => plural(n, "row updated", "rows updated"),
  },

  providers: {
    discount: { name: "Discount Bank", short: "Discount", kind: "Bank" },
    visaCal: { name: "Cal", short: "Cal", kind: "Credit cards" },
  } satisfies Record<ProviderId, { name: string; short: string; kind: string }>,

  common: {
    uncategorized: "Uncategorized",
    other: "Other",
    clear: "Clear",
    loading: "Loading",
    retry: "Try again",
    transactions: (n: number) => plural(n, "transaction", "transactions"),
    categories: (n: number) => plural(n, "category", "categories"),
  },

  empty: {
    noDataTitle: "Nothing here yet",
    noDataBody: "Sync your bank and cards on the Accounts page, and your money will show up here.",
    goToAccounts: "Go to Accounts",
    errorTitle: "That did not load",
  },

  home: {
    title: "Home",
    todayLine: (today: string, daysLeft: number) =>
      `${today} · ${daysLeft === 0 ? "last day of the month" : `${plural(daysLeft, "day", "days")} to go`}`,
    pastLine: (month: string) => `Looking back at ${month}`,
    headlineSoFar: "You've spent",
    headlineSoFarTail: "so far this month.",
    headlinePast: "You spent",
    headlinePastTail: (month: string) => `in ${month}.`,
    nothingYet: "Nothing spent yet this month.",
    nothingPast: (month: string) => `No spending in ${month}.`,
    vsLess: (amount: string) => `${amount} less`,
    vsMore: (amount: string) => `${amount} more`,
    vsSameDay: (month: string) => ` than by this day in ${month}.`,
    vsWholeMonth: (month: string) => ` than in ${month}.`,
    vsSame: (month: string) => `About the same as ${month}.`,
    thatIs: "That's ",
    income: "Income",
    spent: "Spent",
    left: "What was left",
    leftSoFar: "Left so far",
    overspent: "Spent more than came in",
    incomeHint: "Salary and other money in",
    spentHint: "After refunds, card bills counted once",
    leftHint: "Income minus spending",
    review: (n: number) => `${plural(n, "transaction needs", "transactions need")} a look`,
    reviewAction: "Review",
    curveTitle: "Spending through the month",
    curveThis: (month: string) => month,
    curveLast: (month: string) => month,
    curveByDay: (day: number, month: string) => `by day ${day} in ${month}`,
    curveEmpty: "No spending to draw yet.",
    donutTitle: "Where it went",
    donutCenter: "spent",
    donutEmpty: "No spending this month.",
    trendTitle: "Last 12 months",
    trendEmpty: "Not enough history yet.",
    trendHint: "Click a bar to see that month's transactions",
    viewAll: "All transactions",
  },

  transactions: {
    title: "Transactions",
    all: "All",
    needsReview: "Needs review",
    searchPlaceholder: "Search descriptions and notes",
    filteredBy: "Showing",
    clearFilter: "Clear filter",
    daySpent: "spent",
    dayBack: "back",
    pending: "Pending",
    pendingHint: "Not final yet. The amount or date can still change.",
    installment: (n: number, total: number) => `${n} of ${total}`,
    foreign: (amount: string) => `Paid ${amount}`,
    chooseCategory: "Choose a category",
    reason: {
      internal: "Card bill",
      internalColumn: "Counted on the card",
      internalHint: "This pays a card you track here. Its purchases are counted one by one instead, so this line is not counted.",
      excluded: "Excluded",
      excludedHint: "You chose not to count this one.",
      refund: "Refund",
      possibleCardBill: "Card bill?",
      possibleCardBillHint: "Looks like a card bill for a card that is not tracked here. It counts as spending until you add that card.",
    },
    emptyTitle: (month: string) => `No transactions in ${month}`,
    emptyBody: "Pick another month, or sync your accounts to bring in new ones.",
    noMatchTitle: "Nothing matches",
    noMatchBody: "Try a different search, or clear the filters.",
    reviewDoneTitle: "All caught up",
    reviewDoneBody: "Every transaction this month has a category. Nice.",
    selected: (n: number) => `${n.toLocaleString("en-IL")} selected`,
    categorize: "Categorize",
    clearSelection: "Clear selection",
    select: "Select",
    categorized: (name: string, n: number) =>
      n === 1 ? `Moved to ${name}` : `Moved ${plural(n, "transaction", "transactions")} to ${name}`,
    uncategorizedDone: (n: number) => (n === 1 ? "Category removed" : `Removed the category from ${n} transactions`),
    count: (n: number) => plural(n, "transaction", "transactions"),
  },

  picker: {
    search: "Find a category",
    noMatch: "No category by that name",
    spending: "Spending",
    income: "Income",
    none: "No category",
  },

  categories: {
    title: "Categories",
    intro: "Your categories, two levels deep. Amounts are for",
    spending: "Spending",
    income: "Income",
    search: "Search categories",
    spentIn: (amount: string) => amount,
    noSpend: "Nothing yet",
    emptyTitle: "No categories yet",
    emptyBody: "Categories arrive with your first sync.",
    noMatch: "No category matches that search.",
  },

  accounts: {
    title: "Accounts",
    intro: "Each sync opens your bank's own login page. You type your password there, never in CoinLeak, and the app never sees or stores it.",
    bankAccount: "Bank account",
    card: "Card",
    cardMode: { credit: "Credit, billed monthly", debit: "Debit, charged right away" },
    accountsCount: (n: number) => plural(n, "account", "accounts"),
    cardsCount: (n: number) => plural(n, "card", "cards"),
    noAccounts: "No accounts yet. Sync once and they will appear here.",
    safeTitle: "Safe by design",
    safe: [
      "Your password goes only to the bank's own website.",
      "The sync browser is private and is deleted right after.",
      "Your data stays in one file on this computer.",
    ],
  },

  settings: {
    title: "Settings",
    appearance: "Appearance",
    appearanceHint: "Pick how CoinLeak looks. System follows your computer.",
    theme: { system: "System", light: "Light", dark: "Dark" },
    data: "Your data",
    dataHint: "Everything CoinLeak knows lives in one file on this computer.",
    dataFolder: "Data folder",
    version: "Version",
    devBuild: "Development build",
    privacyTitle: "Privacy",
    privacy:
      "CoinLeak has no account, no cloud and no tracking. It only goes online while you sync, and then only to your bank.",
    about: "About",
    aboutBody:
      "Design and ideas from Spent by Shaya16. Transactions are downloaded with israeli-bank-scrapers.",
  },

  errors: {
    notFoundTitle: "Page not found",
    notFoundBody: "That page does not exist. Let's go home.",
    crashTitle: "Something went wrong",
    crashBody: "This screen hit a problem. Your data is safe.",
    goHome: "Go home",
  },
};

export type Strings = typeof s;
