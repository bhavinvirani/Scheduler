/*
 * Demo data seeder for the Shift Schedule Builder.
 *
 * It fills a realistic two-week schedule so you can show what the tool looks
 * like without typing everything by hand. Nothing seeds automatically — the app
 * never does this on its own. You run it by hand, and only on your LOCAL dev
 * server; it refuses to touch the deployed site so a demo can't get polluted.
 *
 * HOW TO SEED (manual, local only)
 *   1. Start the dev server:  npm run dev   (serves http://localhost:5173/)
 *   2. Open http://localhost:5173/ in your browser.
 *   3. Open DevTools → Console (Cmd/Ctrl + Option/Shift + J).
 *   4. Paste this whole file and press Enter. (First time, Chrome may ask you
 *      to type "allow pasting" — do that, then paste again.)
 *   The page reloads with the example fortnight, starting this week's Monday.
 *
 * ONE-CLICK BOOKMARKLET (optional)
 *   Make a new bookmark and set its URL to the single line in
 *   scripts/seed-demo.bookmarklet.txt. Click it while on localhost to seed.
 *
 * TO CLEAR IT AGAIN
 *   Run:  localStorage.removeItem('shift-scheduler:v1:current'); location.reload();
 *   or use the app's "Clear shifts" button (keeps the roster) / remove people.
 */
(() => {
  // Local-only guard: never seed the deployed site (or any non-localhost host).
  const host = location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') {
    console.warn(
      `Demo seed is local-only — it won't run on "${host}". Start "npm run dev" and seed on http://localhost:5173/.`,
    );
    return;
  }

  const STORAGE_KEY = 'shift-scheduler:v1:current';

  // --- This week's Monday, as a local YYYY-MM-DD (never new Date('YYYY-MM-DD')). ---
  const now = new Date();
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  anchor.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7)); // back up to Monday
  const pad = (n) => String(n).padStart(2, '0');
  const startDate = `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}`;

  // --- Shift shapes (minutes from midnight). Stored as { start, duration }. ---
  const shift = (start, duration) => ({ kind: 'shift', start, duration });
  const CODES = {
    D: shift(7 * 60, 8 * 60), //  7:00 AM – 3:00 PM  (day)
    M: shift(9 * 60, 8 * 60), //  9:00 AM – 5:00 PM  (mid)
    E: shift(15 * 60, 8 * 60), //  3:00 PM – 11:00 PM (evening)
    N: shift(23 * 60, 8 * 60), // 11:00 PM – 7:00 AM  (overnight)
    O: { kind: 'off' },
    P: { kind: 'pto' },
    H: { kind: 'holiday' },
    '.': null, // leave the cell empty
  };

  // Six people, one 14-day pattern each (day 0 = week-1 Monday). A believable
  // rotation with every cell type — and a couple of deliberate weekend night
  // gaps, which is exactly what the coverage strip will highlight later.
  //                                    Mon Tue Wed Thu Fri Sat Sun | week 2 →
  const roster = [
    { name: 'Priya Sharma', pattern: 'DDDDDOO' + 'DDDDDOO' }, // day charge
    { name: 'Marcus Bell', pattern: 'EEEEOOE' + 'EEEOOEE' }, // evenings
    { name: 'Elena Novak', pattern: 'NNNOONN' + 'NNNOONN' }, // nights
    { name: 'David Okonkwo', pattern: 'MMODDDO' + 'OMMDDD.' }, // mid/day, one open cell
    { name: 'Sofia Ramirez', pattern: 'DDPPDDO' + 'DDDDOOH' }, // day + PTO + a holiday
    { name: 'Tom Whitfield', pattern: 'OEEEEEO' + 'OEEEEOO' }, // evening flex
  ];

  const people = [];
  const assignments = {};
  for (const { name, pattern } of roster) {
    const id = crypto.randomUUID();
    people.push({ id, name });
    for (let day = 0; day < 14; day++) {
      const value = CODES[pattern[day]];
      if (value) assignments[`${id}:${day}`] = value;
    }
  }

  const schedule = { version: 1, startDate, weekCount: 2, people, assignments };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));

  console.log(
    `Seeded ${people.length} people across a 2-week schedule starting ${startDate}. Reloading…`,
  );
  location.reload();
})();
