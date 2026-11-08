# Which charts show the flow of money best

A short guide for choosing CoinLeak's next charts. It looks at nine chart
types that show where money comes from and where it goes. For each one:
the question it answers, how it can mislead, how well it fits CoinLeak's
data and calm look, and whether Recharts (the charting library CoinLeak
already uses) can draw it. It ends with the three to build next.

Written from general charting know-how and the Recharts version in the
project (3.10). No web access and none of your data were used.

## What CoinLeak already has

- **Spending through the month**: one line building up day by day, this
  month against last month.
- **Spending by category through the month** (new): the same idea for one
  category, or the top five side by side.
- **Where it went**: a donut of this month's spending by category.
- **Last 12 months**: bars stacked by category, one bar per month.

So "how much" and "how fast" are covered. What is missing is the story of
the whole month in one picture (money in, money out, what was left), what
changed since last month, and which days were heavy.

## How to read the ratings

- **Fit** is about CoinLeak's data today: income, spending by category and
  subcategory, refunds, daily totals, 12 months of history. "Good" means
  the numbers already exist in the app's core; "needs work" means core
  must learn a new summary first.
- **Recharts** says whether the library draws it out of the box, with some
  extra work, or not at all.

## The chart types

### 1. Sankey flow (money in, split into where it went)

Bands flow from the left (salary, other income) into the middle (this
month's total) and out to the right (each spending category, and "left
over"). Band thickness is the amount.

- **Answers**: Where did this month's money come from, and where did it
  all go? Did anything stay with me?
- **Misleads when**: there are many thin bands (it turns into spaghetti),
  or when spending is bigger than income, because the "left over" band has
  nowhere to come from. Needs a "from savings" band on the left for that
  case. Refunds must already be netted out, or they look like income.
- **Fit**: good. Income and spending by top-level category already exist
  for any month. Keep it to the top five or six categories plus "Other".
  Very much in CoinLeak's calm style if bands use the category colors at
  low strength.
- **Recharts**: yes, it has a built-in Sankey chart with hover and click.

### 2. Waterfall of a month

Starts with a bar for income, then steps down one bar per spending
category, ending with a bar for what was left.

- **Answers**: How did my income get used up, step by step, and what was
  left at the end?
- **Misleads when**: the order of the steps is arbitrary (the eye reads
  the first steps as "the cause"), or a month has a negative ending that
  dips below zero without a clear line at zero.
- **Fit**: good, same numbers as the Sankey. Easier to read exact
  amounts than a Sankey; less striking.
- **Recharts**: with some work. It is a bar chart where each bar floats
  between two values; Recharts supports bars that span a range.

### 3. What changed vs last month (diverging bars)

One row per category. A bar goes right if you spent more than last month,
left if you spent less, from a shared middle line.

- **Answers**: Which categories went up or down this month, and by how
  much? This is the "what changed vs last month" view that the plan of
  record (REQUIREMENTS section 6) asks for on Home and that does not exist
  yet.
- **Misleads when**: a month is still in progress. Half of November
  against all of October always looks like "less". Compare to the same
  day of last month instead, as the hero sentence already does. Also,
  small categories with big percentage swings can steal attention; show
  amounts, not percentages.
- **Fit**: good. Needs one small core summary: spending per category by
  this day of this month and last.
- **Recharts**: yes, a sideways bar chart with values on both sides of
  zero.

### 4. Calendar heatmap of daily spending

A month laid out as a calendar. Each day is a square, darker for days
with more spending.

- **Answers**: Which days were heavy? Are weekends expensive? Is there a
  pattern around payday or rent day?
- **Misleads when**: one huge day (rent, a flight) makes every other day
  look pale. Fix by capping the darkest shade or leaving out fixed bills.
  Also hard for color-blind readers unless the amount is in the tooltip.
- **Fit**: good. Daily spending already exists in core. A natural
  companion to "Spending through the month" and very calm to look at.
- **Recharts**: not directly. It is easy to build as a plain grid of
  squares without any chart library, using CoinLeak's own card styles.

### 5. Treemap of categories

Nested rectangles: big rectangles are top-level categories, smaller ones
inside are subcategories. Area is the amount.

- **Answers**: What took the biggest share, and what is inside it?
- **Misleads when**: rectangles of similar area but different shapes are
  hard to compare, and tiny categories become slivers with no room for a
  label.
- **Fit**: fair. The data exists (spending by category and subcategory).
  It mostly answers the same question as the donut, with the plus of
  showing subcategories. A good replacement for the donut later, not an
  addition.
- **Recharts**: yes, built in, with nesting and click.

### 6. Stacked area by category over months

Like the 12-month bars, but as smooth layers flowing from month to month.

- **Answers**: How has the mix of spending changed over the year?
- **Misleads when**: only the bottom layer and the total are easy to read;
  middle layers wobble because of the layers below them. With more than
  five or six layers it gets muddy.
- **Fit**: fair. Data exists (the 12-month trend). Says almost the same
  thing as the bars CoinLeak already has; the bars are easier to read
  month by month.
- **Recharts**: yes, built in.

### 7. Small multiples (one tiny chart per category)

A grid of small, identical charts, one per category, each showing its own
12 months or its own month curve, all on the same scale.

- **Answers**: How does each category behave over time, without the
  categories hiding each other?
- **Misleads when**: each tiny chart gets its own scale (then a small
  category looks as big as rent). Same scale for all, or clearly marked.
- **Fit**: good for the Categories page: each category row could carry a
  tiny 12-month line. Data exists.
- **Recharts**: yes, by drawing many small charts side by side.

### 8. Sunburst (rings of categories)

A donut with a second outer ring: inner ring for top-level categories,
outer ring for their subcategories.

- **Answers**: Same as the donut, plus what each slice is made of.
- **Misleads when**: outer slices are hard to compare, and thin slices
  have no room for labels.
- **Fit**: fair. A natural upgrade of the existing donut if you want
  subcategories there; the treemap does the same job more clearly.
- **Recharts**: yes, it has a Sunburst chart.

### 9. Income vs spending, month by month

Two bars per month (or a line for income over bars for spending), with
what was left shown as the gap.

- **Answers**: Am I spending less than I earn, month after month?
- **Misleads when**: a one-off (bonus, annual insurance) makes one month
  look great or terrible. Never use two different scales for the two
  series.
- **Fit**: good. Income and spending per month already exist in the
  12-month trend.
- **Recharts**: yes, built in.

## Summary table

| Chart | Main question | Fit today | Recharts |
|---|---|---|---|
| Sankey flow | Where did the month's money go? | Good | Built in |
| Waterfall | How was income used up? | Good | With some work |
| What changed vs last month | Which categories went up or down? | Good, one small summary | Built in |
| Calendar heatmap | Which days were heavy? | Good | Plain grid instead |
| Treemap | What took the biggest share? | Fair, overlaps donut | Built in |
| Stacked area over months | How did the mix change? | Fair, overlaps bars | Built in |
| Small multiples | How does each category behave? | Good, Categories page | Built in |
| Sunburst | Donut plus subcategories | Fair, overlaps donut | Built in |
| Income vs spending by month | Am I living within my means? | Good | Built in |

## Recommendation: the top 3 to build next

1. **What changed vs last month.** It is already promised in the plan of
   record and missing. It answers the question people ask most after "how
   much did I spend": "what is different this time?" Compared to the same
   day of last month, so a month in progress is fair. Small core work,
   built-in chart.
2. **Sankey flow of the month.** The single best picture of money coming
   in and going out, and the clearest way to show "what was left". It
   needs care: top categories only, and a "from savings" band for months
   where spending beats income. Built into Recharts.
3. **Calendar heatmap of daily spending.** Shows habits the other charts
   hide (weekends, payday, one big day). The numbers already exist and it
   needs no chart library, just a calm grid that matches the cards.

Close behind: income vs spending by month (easy, useful on a 12-month
view), and a treemap as a future replacement for the donut when
subcategories matter.
