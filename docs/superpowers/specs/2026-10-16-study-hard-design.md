# Study Hard — Design Spec

*Status: written for review · 2026-10-16*

A separate Android app that teaches arithmetic to children aged 3–16 through a long, fine-grained learning path. Real-world rewards keep children coming back. Boss fights and a two-player Face-off make it a game.

## 1. Intent

**What the user asked for:**
- A **separate app** named **Study Hard**, in **English only**.
- **Parents add a profile per child**, and every child gets their own path.
- A huge path from **very basic (age 3)** to **very advanced (age 15–16)**, with lots of practice for every skill.
- **Placement by asking the parent**: "Can your child easily do 17 + 34?" Yes skips ahead; the questions continue until the answer changes.
- **Rewards:**
  - The child picks a reward from a fixed catalogue of **at least 100**, and it is locked until earned.
  - A slow **progress bar is always visible**. A treat takes about a week; a toy takes 1–2 months.
  - The bar **falls on days the child doesn't play**.
  - Bigger targets such as toys are saved for alongside the treats.
  - A parent can attach an **optional photo** of the agreed reward.
- **A daily time limit** set by the parent (default 30 minutes, adjustable by slider). The parent also chooses whether play **stops** or only **stops earning** when time is up.
- **Boss fights:** real fights with a different boss and different animations for each one, including attack and defend.
- **Face-off:** two players race on one phone.
- **A modern, smooth, premium motion style** in the spirit of the Darcy's page (self-drawing lines, staged loaders, liquid transitions), without copying its theme or logo. App size doesn't matter.
- **Room to add other areas of maths later**, such as geometry and measurement.

**Assumed from the conversation and the Pairfall work:**
- APK-only distribution on Android, with the OnePlus 13R as the reference phone.
- Works fully offline, with no accounts and no servers.
- Built on the same toolchain and CI as Pairfall.

**Success looks like:**
- A 3-year-old can play with no reading, guided by voice and pictures.
- A 15-year-old finds the final stages genuinely demanding.
- Pacing simulations confirm a treat takes about a week and a toy about 1–2 months at 30 minutes a day.
- Every APK passes the emulator smoke test before release.

## 2. The learning path

### 2.1 Structure

- **Maths areas:** the first area is **Arithmetic**. Geometry, Measurement & Time, and Data can be added later as separate areas with their own maps, sharing profiles, coins and rewards.
- **Stages:** Arithmetic has 7 stages, each mapped to an age band.
- **Skills:** each stage holds an ordered list of small skills (321 in total). A skill belongs to one **strand**:
  - Counting & Number
  - Add & Subtract
  - Multiply & Divide
  - Fractions, Decimals & Percent
  - Algebra & Powers
  - Mental Tricks
  - Word Problems & Money
- **A skill is a self-contained generator.** It produces unlimited questions, each with:
  - a prompt (text, plus an optional spoken line and picture);
  - the answer;
  - three distractors;
  - an answer format;
  - a difficulty parameter from 0 to 1 within the skill.
- **Levels:** every skill has a ladder of 5 levels. Every 5 skills there is a Review level, played as a minion fight. Every stage has a mid-stage boss and a final boss.
  - Total: 321 × 5 + 64 reviews + 14 bosses = **1,683 levels**.

| Level | Name | Rules |
|---|---|---|
| 1 | Learn | Worked example first. Hints and pictures available. No timer. 8 questions. |
| 2 | Practice | Easy end of the skill. Gentle help after a wrong answer. 10 questions. |
| 3 | Practise more | Full range of the skill, plus 2 questions from earlier skills. 10 questions. |
| 4 | Speed | A relaxed timer per question, set per skill (e.g. 8 s for Stage 2 facts, 20 s for Stage 6 equations). 10 questions. |
| 5 | Master | 10 in a row without a mistake. Earns the skill's star badge. |

- **Passing a level:** levels 1–4 need at least 8 out of 10 correct (6 out of 8 for Learn). A failed level can be replayed straight away, with fresh questions.
- **Mastery:** a skill is mastered when its Master level is passed.
- **Spaced revision:** a mastered skill not seen for 14 days adds 2 questions to the next day's first level as a warm-up.
- **Answer formats**, chosen by stage:
  - **Picture choice:** 3 large pictures, used in Stages 1–2. Every prompt is spoken aloud.
  - **Choice:** 4 large buttons, used in speed rounds and Face-off.
  - **Number pad:** digits, backspace and OK, from Stage 2 on.
  - **Extended pad:** adds the minus sign, decimal point, fraction bar, and "x =" / two-answer entry, for Stages 4–7.

### 2.2 Skill catalogue (Arithmetic)

**Stage 1 — Tiny Counters** (ages 3–4, 30 skills)

- Count 1–3 objects
- Count 1–5 objects
- Count scattered objects 1–5
- Count 1–10 objects
- Count scattered objects 1–10
- Recognise dots at a glance (1–3)
- Recognise dots at a glance (1–5)
- Recognise numerals 1–5
- Recognise numerals 6–10
- Match a numeral to a group (1–5)
- Match a numeral to a group (1–10)
- Zero: none left
- Which group has more?
- Which group has fewer?
- Same amount?
- Bigger number (1–10)
- Order numbers 1–5
- Missing number on a 1–10 line
- Count back from 5
- Count back from 10
- One more than (to 10)
- One less than (to 10)
- Ten frame: how many?
- Continue a pattern (AB, ABB)
- Add within 3 with pictures
- Add within 5 with pictures
- Take away within 3 with pictures
- Take away within 5 with pictures
- Make 5
- Picture stories: add or take away within 5

**Stage 2 — Number Friends** (ages 5–6, 45 skills)

*Counting & Number*
- Count to 20
- Count to 50
- Count to 100
- Numerals 11–20
- Numerals to 100
- Compare to 20
- Compare to 100 (< >)
- Order three numbers to 20
- Before and after (to 100)
- Count in 2s
- Count in 5s
- Count in 10s
- Odd or even
- Ordinals to 10th
- Teens as ten and ones
- Number line to 20

*Add & Subtract*
- Add within 10
- Add 0
- Count on 1 and 2
- Doubles to 5 + 5
- Near doubles
- Pairs that make 10
- Add three small numbers
- Add within 20 without bridging (12 + 5)
- Add within 20 bridging 10 (8 + 5)
- Add 10
- Missing addend within 10
- Missing addend within 20
- Take away within 10
- Subtract 0, 1 and 2
- Subtract from 10
- Difference between two numbers
- Subtract within 20 without bridging
- Subtract within 20 bridging 10 (15 − 7)
- Subtract 10
- Missing number in subtraction
- Fact families

*Mixed*
- Add/subtract word problems within 20
- Choose + or −
- Equal or not equal (3 + 4 = 5 + 2?)
- Count coins to ₹20
- Halve even numbers to 20
- Double to 20
- Speed mix within 10
- Speed mix within 20

**Stage 3 — Big Numbers** (ages 7–8, 56 skills)

*Place value*
- Tens and ones to 100
- Expanded form
- 3-digit place value
- Compare 3-digit numbers
- Order 3-digit numbers
- Round to the nearest 10
- Before and after to 1000
- Count in 3s and 4s
- Count in 100s

*Add*
- 2-digit + 1-digit, no carrying
- 2-digit + tens
- 2-digit + 2-digit, no carrying
- 2-digit + 1-digit, carrying
- 2-digit + 2-digit, carrying
- Three 2-digit numbers
- +9 and +11 tricks
- 3-digit + 1-digit
- 3-digit + tens
- 3-digit + hundreds
- 3-digit + 3-digit, no carrying
- 3-digit + 3-digit, carrying
- Missing addend to 100
- Make 100

*Subtract*
- 2-digit − 1-digit, no borrowing
- 2-digit − tens
- 2-digit − 2-digit, no borrowing
- 2-digit − 1-digit, borrowing
- 2-digit − 2-digit, borrowing
- Subtract from 100
- 3-digit − 1-digit
- 3-digit − hundreds
- 3-digit − 3-digit, no borrowing
- 3-digit − 3-digit, borrowing
- How many more?
- Missing subtrahend

*Multiply*
- Equal groups (pictures)
- Arrays
- × 2
- × 10
- × 5
- × 3
- × 4
- Mixed 2, 5, 10
- Mixed 2–5
- Double and halve to 100
- × 1 and × 0

*Divide*
- Sharing equally (pictures)
- ÷ 2
- ÷ 5
- ÷ 10
- ÷ 3
- ÷ 4
- Halves and quarters

*Mixed*
- Money and change to ₹100
- Two-step word problems
- Speed mix

**Stage 4 — Times Master** (ages 9–10, 55 skills)

*Facts*
- × 6
- × 7
- × 8
- × 9
- × 11
- × 12
- Mixed tables to 12
- Squares to 12²
- ÷ 6
- ÷ 7
- ÷ 8
- ÷ 9
- ÷ 11 and ÷ 12
- Mixed division facts

*Multiply*
- 2-digit × 1-digit, no carrying
- 2-digit × 1-digit, carrying
- × 10 and × 100
- × multiples of 10 (40 × 7)
- 3-digit × 1-digit
- 2-digit × 2-digit by partitioning
- 2-digit × 11 trick
- × 25 by quartering
- Double-and-halve strategy

*Divide*
- 2-digit ÷ 1-digit, exact
- 2-digit ÷ 1-digit with remainder
- 3-digit ÷ 1-digit
- ÷ 10 and ÷ 100
- Divisibility by 2, 3, 5, 9, 10

*Big numbers*
- Place value to 1 lakh (Indian and international commas)
- Compare and order large numbers
- Round to 100 and 1000
- Estimate sums
- 4-digit addition
- 4-digit subtraction

*Fractions*
- Fraction of a shape
- Unit fraction of a number
- Fraction of a number (¾ of 20)
- Equivalent fractions
- Compare fractions with the same denominator
- Add fractions with the same denominator
- Subtract fractions with the same denominator
- Mixed and improper fractions

*Decimals*
- Tenths
- Hundredths
- Decimal ↔ fraction (0.5 = ½)
- Compare decimals
- Add 1-dp decimals
- Subtract 1-dp decimals
- × and ÷ decimals by 10 and 100

*Mixed*
- Money with paise
- Negative numbers via temperature
- Order of operations without brackets
- Two-step word problems
- Multiples and factors (intro)
- Speed mix

**Stage 5 — Fraction Explorer** (ages 11–12, 50 skills)

*Fractions*
- Simplify
- Compare unlike fractions
- Add unlike fractions
- Subtract unlike fractions
- Add mixed numbers
- Subtract mixed numbers
- Fraction × whole
- Fraction × fraction
- Whole ÷ fraction
- Fraction ÷ fraction
- Multi-step fraction of a quantity

*Decimals*
- Add/subtract 2-dp decimals
- Decimal × whole
- Decimal × decimal
- Decimal ÷ whole
- ÷ by a decimal
- Round decimals
- Common fraction ↔ decimal

*Percent*
- % ↔ fraction ↔ decimal
- 10%, 25% and 50% of
- Any % of
- What percent of the total?
- Simple percentage increase

*Ratio*
- Simplify a ratio
- Share in a ratio
- Unitary method
- Scaling (recipes)

*Integers*
- Negatives on a number line
- Add integers
- Subtract integers
- Multiply integers
- Divide integers

*Order of operations*
- BODMAS without brackets
- BODMAS with brackets

*Number theory*
- Factors
- Multiples
- Primes to 100
- Prime factorisation
- HCF
- LCM
- Divisibility by 4, 6, 8 and 11

*Mental and mixed*
- × 9 and × 99 tricks
- Compensation (+ near hundreds)
- Averages
- Estimate products
- Squares to 20²
- Fraction and percent word problems
- Missing-operation puzzles
- Check by inverse operation
- Speed mix

**Stage 6 — Power Up** (ages 13–14, 45 skills)

*Powers*
- Cubes to 10³
- Square roots to √400
- Cube roots
- Powers of 2, 3 and 10
- Multiply powers
- Divide powers
- Power of a power
- Zero and negative exponents
- Estimate square roots

*Algebra*
- Substitute into expressions
- Collect like terms
- Expand a single bracket
- One-step equations
- Two-step equations (3x + 4 = 19)
- Unknowns on both sides
- Equations with brackets
- Simple inequalities
- Word problems to equations
- Linear sequences: nth term

*Money and percent*
- Percentage change
- Reverse percentages
- Profit and loss
- Discount
- Simple interest
- Compound interest (1–2 years)
- Adding GST
- Successive percentages

*Rational numbers*
- Operations on rationals
- Negative fractions
- BODMAS with powers and negatives

*Number*
- Standard form (large numbers)
- HCF/LCM word problems
- Three-part ratios
- Direct and inverse proportion
- Speed, distance and time
- Averages with a missing value

*Mental*
- Squares 21–30
- × 11 for any 2-digit number
- × 5, × 25 and × 125 tricks
- ÷ 5 and ÷ 25 tricks
- Percent shortcuts
- Two-step word problems
- Estimation and approximation
- Digit-sum checks
- Speed mix

**Stage 7 — Maths Ninja** (ages 15–16, 40 skills)

*Algebra*
- Expand (a + b)²
- Expand (a − b)²
- Expand (a + b)(a − b)
- Expand two brackets
- Factorise a common factor
- Factorise x² + bx + c
- Difference of squares
- Solve quadratics by factorising (two answers)
- Simple simultaneous equations
- Rearrange formulas
- Evaluate polynomials

*Surds and indices*
- Simplify surds
- Multiply surds
- Rationalise simple denominators
- Fractional indices
- Standard form × and ÷

*Number*
- Recurring decimals → fractions
- Multi-year compound interest
- Depreciation
- Chains of percentage change
- Advanced ratio and proportion
- Log basics (log₁₀ of powers of 10, log₂)

*Mental tricks*
- Squares ending in 5
- Squares near 50
- Squares near 100
- Base method near 100
- × 11 for 3-digit numbers
- 2-digit × 2-digit cross method
- Complements for × 9s
- Divisibility by 7, 11 and 13
- Cube roots of 6-digit perfect cubes
- Square roots of 4-digit perfect squares
- Fast fraction addition
- x% of y = y% of x
- Estimating products and roots

*Mixed*
- Speed mix
- Multi-step problems
- Algebra sprint
- Missing-operator puzzles
- Grand review

Counts: 30 + 45 + 56 + 55 + 50 + 45 + 40 = **321 skills**.

### 2.3 Question quality rules (enforced by tests)

- **The answer is computed, never hand-written.** Distractors are plausible: off-by-one, a carry error, the wrong operation, or a swapped digit. They are never equal to the answer.
- **No immediate repeats.** The same question may not reappear within one level, and the last 50 questions of a skill are remembered.
- **Difficulty never decreases** as the difficulty parameter rises within a skill, and the numbers stay within the skill's stated range.
- **Stage 1–2 picture questions** use a fixed object set (mangoes, balloons, ducks, stars, cars, flowers and so on) and are spoken in clear English.

## 3. Children, placement and the parent area

- **Grown-up check:** parent-only actions are guarded by a typed answer to a random multiplication, 2-digit × 1-digit (e.g. "47 × 3"). After 3 wrong answers it is locked for 30 seconds. There is no PIN to forget.
- **Child profile:** name, age (3–16), cartoon avatar (choice of 24) and colour. Several children per phone.
- **Placement:**
  - The starting guess comes from age: the middle of that age's stage.
  - For each strand relevant to the age, the parent sees a real example: "Can Aarav easily do 17 + 34?"
  - The answers are **Yes, easily** / **With a little effort** / **Not yet**.
    - *Yes* moves 4 skills ahead (2 if the previous answer was *effort*).
    - *Effort* places the child at that skill.
    - *Not yet* moves back 2 skills.
  - It stops when an answer flips, or after 4 questions in that strand. That's about 6–10 questions in total.
  - **"Let them try"** replaces a parent question with a 6-question placement check the child plays (2 minutes).
  - **Placed skills:** skills below the placement point are marked *skipped*. They stay open on the map with 0 stars, and passing their Master level grants the star.
  - **Self-correction:** in the first 3 levels after placement, a score below 6/10 steps the strand back one skill.
  - Placement can be redone from the parent area.
- **Parent area** (behind the grown-up check):
  - Children: add, edit or remove.
  - Daily limit slider: 10–120 minutes, default 30, in 5-minute steps.
  - When time is up: **Stop for today** or **Keep playing without coins**.
  - Holiday mode, which pauses melting.
  - Hide reward categories.
  - Redo placement.
  - **Progress report** per child:
    - skills mastered by strand;
    - minutes played per day for the last 14 days (bar chart);
    - strongest and weakest strand;
    - bosses beaten;
    - rewards earned, with dates.

## 4. Rewards

- **Coins per activity:**

| Activity | Coins |
|---|---|
| Passed level | 10 |
| Stars | 1★ +1, 2★ +3, 3★ +5 |
| Review (minion) win | 15 |
| Boss win | 50 |
| Face-off win | 5 |
| Replay of an already-passed level | half the coins |

- **Daily limit:** only play inside the day's limit counts (active time in a level, boss fight or Face-off; menus don't count).
  - In **Keep playing** mode, play after the limit earns nothing.
  - In **Stop** mode, the "See you tomorrow 🌙" screen appears, with Face-off and levels closed until local midnight.
- **Two jars:** each coin earned is split **80% to the treat jar** and **20% to the big goal jar**.
- **Catalogue:** 128 picture-card rewards in 12 categories.

| Price level | Coins | Takes about (30 min a day) | Jar |
|---|---|---|---|
| Small | 350 | 1 week | Treat |
| Medium | 600 | 2 weeks | Treat |
| Large | 900 | 3 weeks | Treat |
| Toy · small | 400 | 1 month | Big goal |
| Toy · medium | 550 | 1½ months | Big goal |
| Toy · big | 700 | 2 months | Big goal |
| Dream goal | 1,500 | 4–5 months | Big goal |

- **The catalogue**, with price level in brackets:
  1. **Sweets** (Small): milk chocolate bar, chocolate wafer, candy buttons, lollipop, toffees, jelly sweets, cotton candy, gulab jamun, jalebi, ladoo, rasgulla, kaju katli.
  2. **Snacks** (Small): chips, nachos, popcorn, masala puffs, samosa, pani puri, momos, French fries, sandwich, noodles, pav bhaji, vada pav.
  3. **Drinks** (Small): cold drink, mango shake, chocolate milkshake, fresh juice, lassi, coconut water, lemonade, iced tea, hot chocolate, smoothie.
  4. **Ice cream & desserts**
     - Small: ice-cream cone, ice-cream cup, kulfi, ice lolly.
     - Medium: sundae, brownie, cupcake, pastry, doughnut, falooda.
  5. **Treat meals**
     - Medium: pizza night, burger meal, pasta night, dosa outing, pancake breakfast, choose tonight's dinner, Chinese takeaway.
     - Large: restaurant dinner.
  6. **Screen time**
     - Small: 15 extra minutes of cartoons, choose the car music.
     - Medium: 30 extra minutes of cartoons, 30 minutes of video games, pick the family movie, movie night with popcorn.
  7. **Outings**
     - Medium: park, playground, cycling ride, picnic, swimming, museum, fair.
     - Large: zoo, aquarium, beach, trampoline park, bowling, arcade, cinema.
  8. **Family time**
     - Small: extra bedtime story, stay up 30 minutes late, board game with Mummy or Papa, paint together.
     - Medium: bake together, blanket fort, living-room camping, choose the weekend plan, kite flying, sleepover with a cousin.
  9. **Little things**
     - Small: sticker pack, fancy pencil, eraser set, balloons, bubble wand, temporary tattoos, keychain, stamp set.
     - Medium: colouring book, crayons, sketch pens, notebook, slime, play-dough.
  10. **Books & kits**
      - Medium: comic book, story book, puzzle book.
      - Large: jigsaw puzzle, science kit, magic kit.
  11. **Toys**
      - Toy · small: toy car, yo-yo, puzzle cube, skipping rope, water gun, football, doll.
      - Toy · medium: action figure, teddy bear, board game, art kit, badminton set, cricket bat.
      - Toy · big: building-brick set, remote-control car, train set, toy kitchen, doctor set, dollhouse, music keyboard, walkie-talkies, roller skates.
  12. **Dream goals** (Dream): bicycle, kick scooter, giant brick castle, play tent.
- **Choosing:**
  - The child picks one treat (Small, Medium or Large) and one big goal (a Toy or Dream reward) from picture grids. Hidden categories are not shown.
  - Each card shows a drawing, name, cost and "about N weeks".
  - **Once chosen, a reward is locked** until earned.
  - An optional **"Add photo of what we agreed"** lets a parent attach a camera or gallery image, behind the grown-up check. It is stored on the phone only, downscaled to 1280 px, and shown on the card, the bar and the unlock screen.
- **The bar:**
  - The treat bar is pinned to the top of every child screen.
  - It fills with a sparkle on each coin, and celebrates at 25%, 50% and 75%.
  - The big goal jar sits beside it.
- **Melting:**
  - For each full local day with no counted play, the treat jar loses **5% of the treat's cost** and the big goal jar loses **2% of the goal's cost**.
  - Neither ever goes below 0. Earned rewards are never removed.
  - **Holiday mode** pauses melting.
  - On return, the child sees the melt shown in the chocolate-drip animation, then "Welcome back!".
- **Unlocking:**
  - Confetti, then the reward drawn in and the photo (if any), with "Show this to Mummy/Papa!".
  - It stays **Waiting to be given** until a parent passes the grown-up check and taps **Given ✓**.
  - The child then chooses the next reward.
  - Coins over the cost carry into the next jar.
- **Pacing check:** the economy simulation (§10) must show, at 30 minutes a day:
  - 5 ± 1.5 levels a day;
  - a Small treat in 6–9 days;
  - a Toy · big in 45–70 days.

## 5. Boss fights and minions

**Fight rules:**
- The boss has health and the player has 3 hearts.
- Each correct answer is an attack. Answering in under 40% of the time limit is a **critical hit**, with slow motion, screen shake and a "CRITICAL!" burst.
- **5 in a row** triggers a unique special-move animation and takes off 25% of the boss's health.
- **Every 3 questions the boss attacks.** A warning flash and a **defend** question follow, with half the normal time. A correct answer is a successful block; a miss costs a heart.
- **Three phases** at 66% and 33% health. Each phase draws questions from a different set of the stage's skills, and the boss's look becomes angrier.
- **Losing** offers a retry with one hint per phase.
- **Winning** gives a trophy, 50 coins, a stage badge, and an entry in the Defeated Bosses gallery.

**Every boss has unique animations for:**
- entrance (drawn in line by line, then coloured);
- idle;
- hit and critical hit;
- its attack;
- the player's successful block and failed block;
- the phase change;
- the special-move finisher;
- defeat.

All of it is cartoon slapstick, with nothing frightening. Stage 1–2 bosses are cute and slow.

| Stage | Mid boss | Final boss |
|---|---|---|
| 1 | **Mr Bubbles**: dart pops bubbles; giant bubble attack; ✔ pops into stars / ✘ you float off; shrinks and pops | **Gobble the Sock Monster**: socks flung back; stinky sock attack; ✔ shield bounce / ✘ nose-holding wobble; sneezes out every sock |
| 2 | **Professor Hoot**: feather darts; book swoop; ✔ duck / ✘ bonk and spinning stars; falls asleep | **Captain Tenbeard**: cannon blasts; cannonball; ✔ shield rings / ✘ drenched; ship sinks, paddles off in a tub |
| 3 | **Gloop the Slime King**: water bucket; slime spit; ✔ umbrella / ✘ slimed; melts with crown on top | **Blaze the Carry Dragon**: ice arrows; fireball; ✔ ice wall steams / ✘ smoking hair; becomes a lizard |
| 4 | **Clockwork Crab**: wrench strikes; pincer snap; ✔ slow-motion dodge / ✘ hop on one foot; springs burst out | **Robo-Multiplex**: lasers break armour plates; missile barrage; ✔ fireworks / ✘ screen glitch; shuts down with "404" flag |
| 5 | **Chef Fractio**: pie slices; frying pan; ✔ catch and flip a pancake / ✘ BONG; faints into his soup | **The Pizza Wizard**: spinning cutter; cheese lasso; ✔ slice the string / ✘ tangled; turns into a pizza a mouse eats |
| 6 | **Volt the Storm Cloud**: wind fan; lightning; ✔ lightning-rod sparks / ✘ hair on end; rains out into a rainbow | **Kraken of Powers**: harpoon; ink splash; ✔ bubble shield / ✘ inked screen wiped clean; tentacles knot, sinks |
| 7 | **Mirror Mage**: reflected spell; copy-clones; ✔ clones shatter / ✘ screen flips briefly; cracks into sparkles | **Shadow Sensei**: shuriken flurry; sword dash; ✔ parry / ✘ slow-motion fall and bounce; bows, hands you a black belt |

**Minions:**
- Each Review level is a 10-question minion fight using the stage's theme:
  - sock goblins, owlets, parrots;
  - slime blobs, baby dragons;
  - gear bugs, mini-bots;
  - pie imps, cheese mice;
  - sparks, crablets;
  - shadow clones, ninja frogs.
- Each minion has its own hit and defeat animation.
- 1 heart only. Losing simply replays.

## 6. Face-off

- **Layout:** the phone lies flat; the top half of the screen is rotated 180°.
- **Players:** a child profile, or a **Guest** (grown-up or friend) with a level slider (Stage 1–7, then skill).
- **Fair questions:** each player gets questions from **their own skill position**. For child profiles that's their current mastered frontier; for guests, the slider.
  - **Auto-balance:** after 3 points in a row, that player moves 3 skills harder for the rest of the match.
- **Answering:**
  - 4 large choice buttons per side.
  - A wrong tap freezes that side for 1 second.
  - Stage 1–2 players get picture-only questions with no speech, since two voices at once would clash.
- **Modes:**
  - **Tug of War** (default): a rope moves one notch per correct answer, and the first to pull the flag over their line wins (7 notches).
  - **Race to 10:** independent question streams; the first to 10 correct wins.
  - **Showdown:** both players get the same question, and the first correct answer takes the point (first to 7). It is offered when the players' positions are within 10 skills of each other.
- **Results:**
  - Winner animation, Rematch, Swap sides.
  - A per-pair scoreboard (e.g. Aarav vs Dadi 12–9), kept in the parent area.
- **For children:** Face-off counts towards the daily limit, and a win earns 5 coins.

## 7. Screens

1. **Loader:** see §8.
2. **First-run setup** (grown-up): add children, daily limit and time-up mode.
3. **Who's playing?** Avatar grid, plus a Face-off button.
4. **Placement** (per child, first time).
5. **Choose rewards:** treat grid and big goal grid, with the optional photo.
6. **Home map:**
   - One illustrated world per stage, along a winding path of level nodes with stars, minion and boss nodes.
   - The treat bar and big goal jar at the top, a time-left ring, and buttons for Trophy room and Switch child.
7. **Level:** question card, answer input, 🔊 replay button, progress dots, and a hint (Learn and Practice levels).
8. **Level complete:** stars, coins flying into the jars, then Next.
9. **Minion fight** and **boss fight**.
10. **Reward unlocked** and **Waiting to be given**.
11. **Melted** ("Welcome back").
12. **Time's up.**
13. **Face-off:** setup, then the match, then results.
14. **Trophy room:** Defeated Bosses gallery, skill badges by strand, and rewards earned.
15. **Parent area:** see §3.

**Back button:**
- Closes an open sheet.
- In a level or fight, it pauses.
- Map → Who's playing → the press-again-to-leave hint.

## 8. Look and motion

The aim is a premium, modern, smooth feel. The motion techniques are inspired by the Darcy's page, but Study Hard has its own palette, characters and logo.

**Look:**
- Bright, rich gradients with soft shadows.
- One rounded modern sans-serif, bundled with the app so it works offline.
- Generous sizes:
  - Stages 1–2 answers at least 64 px tall.
  - Body text at least 18 px.
- **Each stage world has its own palette and backdrop:** Meadow, Pirate Sea, Dragon Volcano, Robot City, Pizza Kitchen, Storm Ocean, Ninja Mountains.

**Loader:**
- Four stages, each with its own line drawing that **draws itself stroke by stroke**:
  - a pencil ("Sharpening pencils");
  - a star ("Counting the stars");
  - number blocks ("Waking up the numbers");
  - a rocket ("Ready, set, learn!").
- One caption at a time, fading up and out. Each stays up for at least 1.1 seconds.
- Then the **Study Hard logo draws in outline and fills with colour**.

**Transitions:**
- **Liquid wipe** in the stage's colour between the map and levels or fights.
- Sheets rise with a soft overshoot.
- Lists and cards use **staggered rise-and-fade entrances**, about 60–90 ms apart.

**The map:**
- Newly unlocked nodes draw their outline, then glow.
- The path **draws itself** to the next node.
- Gentle always-on details per world: clouds, grass, waves, lava glow, blinking city lights, steam, falling leaves.

**Play:**
- The question card flips in, and keys press with a soft bounce.
- **Correct:** a ring burst, the number pulses gold, and coins fly along a curved path into the jar.
- **Wrong:** a gentle shake, then the correct answer draws itself in.

**Rewards:**
- The bar has a slow glint sweep and the big goal jar has rising bubbles.
- **Unlock:** the reward is drawn in outline, fills, then a spotlight sweep and confetti.
- The melt is a chocolate drip that reshapes when the child returns.

**Bosses:** see §5. Shared effects:
- screen shake;
- 0.3× slow motion on critical hits;
- particle bursts;
- impact frames.

**Performance and comfort:**
- Only GPU-friendly properties are animated (transform, opacity), with a Canvas 2D particle layer.
- The target is the phone's full refresh rate (120 Hz on the 13R).
- Motion is reduced automatically when the system "remove animations" setting is on.
- Stages 1–2 use slower, softer timings.

## 9. Architecture

**Toolchain:** the same as Pairfall.
- TypeScript with no runtime dependencies, bundled by a project script into one HTML file.
- Wrapped with **Capacitor 8**.
- Built, signed and released by GitHub Actions, with **its own repository, app id (`com.studyhard.app`) and signing key**.
- The emulator smoke test runs before every release.

```
src/
  core/                 pure logic, no DOM
    rng.ts              seeded random numbers
    question.ts         Question, AnswerFormat, grading
    areas/arithmetic/   stages.ts + one file per strand of skill generators
    areas/index.ts      registry of maths areas (Arithmetic now; more later)
    path.ts             levels from skills; level rules; mastery; spaced revision
    placement.ts        parent-question walk and child check
    economy.ts          coins, jars, costs, melting, daily limit
    rewards.ts          the 128-item catalogue
    boss.ts             fight state machine (hearts, health, phases, defend timing)
    faceoff.ts          match state machine for the 3 modes, auto-balance
  render/               DOM/SVG/Canvas views and motion helpers
    motion.ts           draw-on strokes, liquid wipe, stagger, springs
    particles.ts        bursts, confetti, coins
    bosses/<name>.ts    each boss's SVG rig and its animations
    worlds/<stage>.ts   map backdrops and ambient motion
  ui/                   screens (§7)
  audio/                synthesised sound effects and music
  platform/             native bridge
  storage/              versioned save + native mirror; photo store
scripts/                build, android project, icons, simulation
test/  e2e/             unit tests, browser tests
native/android/         MainActivity + StudyHardPlugin, resources
```

**Native plugin (`StudyHardPlugin`), reusing Pairfall's proven code:**
- haptics;
- back button;
- immersive full screen;
- highest refresh rate;
- keep screen on;
- save mirror;
- **text-to-speech** using Android's TextToSpeech, preferring an English (India) voice, then any English voice;
- **photo storage** as files in the app's private storage.

In the browser preview, speech falls back to the web speech API and photos to IndexedDB.

**Saving:**
- A versioned save (primary + backup key) holds profiles, progress, jars and settings, mirrored natively.
- Questions are generated, not stored. Only skill progress and the last-50 history are saved.
- Time is counted from active play with a monotonic clock. Day changes use the phone's local date.

**Errors:**
- A damaged save loads the backup copy.
- If text-to-speech is unavailable, a speaker icon with on-screen text is shown, plus a one-time parent notice.
- If the photo picker is cancelled, nothing changes.
- If a generator throws, the level uses another skill from the same stage and the error is logged.

## 10. Testing

**Unit tests, for every skill generator, across 2,000 seeds per difficulty step:**
- the answer is correct (computed by a separate checker);
- distractors are unique and not equal to the answer;
- numbers stay in the skill's range;
- no repeats within a level;
- difficulty is monotonic.

**Unit tests for the other core logic:**
- level rules;
- mastery;
- placement walk (scripted parent answers land on the expected skills);
- economy;
- boss and Face-off state machines;
- grown-up check.

**Economy simulation (`npm run simulate`)** models simulated children of each age with realistic accuracy and speed over 120 days. It must meet the pacing in §4 and the melt rules.

**Browser tests (Playwright):**
- first-run setup through placement and reward choice to the first level;
- a level pass with coins into the jars;
- a boss win and loss;
- time-up in both modes;
- melting after skipped days (with a faked clock);
- unlock → Given;
- a Face-off match in each mode.

**Emulator smoke test** on every build: launch, setup, play a level, back button, Face-off start.

**Visual review:** screenshots of every screen and every boss at 13R size before each milestone.

## 11. Delivery

1. **Milestone 1:**
   - setup, profiles, grown-up check and placement;
   - Stages 1–3 (131 skills) with 4 bosses and their minions;
   - the full rewards system with melting and photos;
   - the parent area (without the report), loader and motion system.
   - This produces the first APK children can use.
2. **Milestone 2:**
   - Stages 4–7 (190 skills) with 10 bosses;
   - Trophy room;
   - progress report.
3. **Milestone 3:** Face-off (3 modes, guests, scoreboard).

**What the user needs to do:** create an empty public repository (e.g. `study-hard`), add it to the Claude GitHub app, and add the `STUDYHARD_SIGNING_PASSWORD` secret, which I will provide.

## 12. Out of scope (for now)

- Other maths areas: the structure is ready for them, but they are not built yet.
- Accounts, cloud sync, online play, ads and in-app purchases.
- Languages other than English.
