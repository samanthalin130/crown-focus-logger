# How to use the focus logger

Written for someone who does not write software. No terminal needed for most of
this.

## What this is

A way to record your own focus sessions from a Neurosity Crown, keep that
recording, and look at it afterwards.

**Your data stays with you.** It is saved in your own browser, on your own
computer. There is no account and nothing to sign into. Nobody else can see it,
including the person who made this, because there is no place for it to go.

The catch: if you clear your browser history and site data, your sessions go too.
So download a copy of anything you care about. The page has a button for it.

---

## Part 1. Try it without a headset

You do not need the Crown to see how this works.

1. Open the logger page.
2. Click **Load the example session**.
3. You land on a page of results. Everything on it was worked out from that one
   example file, right there in your browser.

If you would rather make your own practice recording, use the
**Try it with demo data** card instead: click **Start demo session**, wait
twenty or thirty seconds, then click **Stop and save**.

The numbers in both cases are made up. Anything made up is labelled
**synthetic** so you can never confuse it with a real reading.

---

## Part 2. Record a real session

This part needs the Crown, and it needs one thing to run on your computer rather
than in the web page. That is on purpose: it means your Neurosity password is
never typed into a website.

**One-time setup**

1. Install Node.js from [nodejs.org](https://nodejs.org) if you do not have it.
2. Open Terminal.
3. Paste these lines in, one at a time, pressing Return after each:

   ```
   git clone https://github.com/samanthalin130/crown-focus-logger.git
   cd crown-focus-logger
   npm install
   cp .env.example .env
   ```

4. Open the file called `.env` in the `crown-focus-logger` folder with any text
   editor. Put your Neurosity email after `NEUROSITY_EMAIL=` and your password
   after `NEUROSITY_PASSWORD=`. Save it and close it.

   That file stays on your computer. It is never uploaded and never committed.

**Every time you want to record**

1. Put the Crown on and wait for good contact.
2. In Terminal, in the `crown-focus-logger` folder, type:

   ```
   npm run live
   ```

3. You will see a bar showing your focus while it records.
4. When you are done, press **Ctrl** and **C** together. It tells you how many
   readings it saved.

You now have a file called `focus-log.csv` in that folder. That file is your
recording. It is yours.

> **Note:** if it says it is waiting for the first readings and never starts,
> the headset is not connected or the streams have not started. Check the Crown
> is on and in contact.

---

## Part 3. Put your recording into the logger

1. Open the logger page.
2. Click **Import a CSV or backup**.
3. Choose your `focus-log.csv`.

It appears under **Your log**, and you can open it.

---

## Part 4. Read your session

Click **Read it back** on any session. You get:

**The four boxes at the top**

- **Length**: how long the recording ran, and how many readings it holds.
- **Usable signal**: how much of the recording had good enough sensor contact to
  trust. Anything recorded with a loose electrode is thrown out rather than
  mixed in, because a loose sensor produces numbers that look convincing and
  mean nothing. If this number is low, the session is not telling you much.
- **Your focus range**: the lowest, middle and highest focus scores in this
  session. Not compared to anyone else. Just you, this time.
- **Longest good stretch**: the longest unbroken run where your focus stayed at
  or above your own middle score, and when it happened.

**The chart**

Focus and calm across the session, against the clock. The dashed line is your
own middle focus score for this session. The shaded band is your longest good
stretch.

**Band power**

The five brainwave bands, averaged over the session. Useful for comparing bands
to each other within one session. Not useful for comparing today to last week,
because these values have no fixed unit.

**Sensor contact**

How the recording split between good and bad contact. If a lot of it is orange
or grey, adjust the headset next time.

---

## Part 5. Keep your data

Three ways to hold on to it.

- **Export this session as CSV.** A spreadsheet file. Opens in Excel, Numbers or
  Google Sheets by double-clicking it. Use this if you want to do your own
  analysis.
- **Export everything (backup).** One file with every session in it. Use this to
  move your log to a different computer or browser: export on one, then use
  **Import a file** on the other.
- **Do nothing.** Sessions stay in your browser until you delete them or clear
  your browsing data.

**Delete everything** removes all of it permanently. There is no undo and no
copy anywhere else, so export first if you are not sure.

---

## Questions you will probably have

**Is my brain data being sent anywhere?**
No. The page makes no network requests. The recorder on your computer talks to
Neurosity, because that is how the headset works, and writes a file locally.
Nothing goes to the person who built this.

**What do the focus and calm numbers actually mean?**
They are Neurosity's own scores, between 0 and 1, produced by models trained in
advance. They are interpretations, not measurements, and they are not comparable
between people or reliably between different sittings. That is exactly why this
app never says "you were focused" against a fixed number, and instead compares
you to yourself within one session.

**Why is my usable signal low?**
Dry electrodes need contact with skin, not hair. Reseat the headset, push it
down through the hair at the back, and check the Neurosity console's own signal
screen before you start recording.

**Can I use this on my phone?**
The reading part, yes, if you import a file. The recording part needs a computer.

**I cleared my browser and lost everything.**
There is no backup unless you exported one. That is the cost of nobody else
holding your data. Export after any session you care about.
