/**
 * Seed the database with sample content so a fresh checkout has a feed to look at.
 *
 * Everything below is FICTIONAL DEMO DATA written for local development — the
 * headlines are invented, the links are illustrative, and none of it should be
 * read as reporting. Run `npm run reset` to wipe and re-seed.
 */
import { getDb, closeDb } from './db.js';
import { hashPassword } from './auth.js';
import * as db from './models.js';
import { nowSeconds } from './util.js';

const HOUR = 3600;

/** Deterministic PRNG so repeat seeds produce the same feed. */
function makeRandom(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const USERS = [
  ['helix_witch', 'A community lab organiser. Yeast, plasmids, and a deep dislike of paywalls.'],
  ['pipette_punk', 'Building open hardware for wet labs. Everything I make is CERN-OHL.'],
  ['crispr_kid', 'Grad student. Base editors, off-target analysis, too much coffee.'],
  ['wetware_ann', 'Neuro. Organoids and the ethics thereof.'],
  ['garage_genome', 'Sequencing things that should not be sequenced. Kitchen, not cleanroom.'],
  ['ferment_or_die', 'Precision fermentation, mostly for food. Ask me about bioreactor foam.'],
  ['biosafety_bee', 'Biosafety officer by day. I flag things so you do not have to.'],
  ['open_assay', 'Assay development, open protocols, reproducibility crank.'],
  ['mycelium_max', 'Fungal materials. Growing furniture, slowly.'],
  ['plasmid_mule', 'Freelance molecular biologist for hire.'],
];

const STORIES = [
  ['Show BN: A $180 open-source thermocycler that hits 3 °C/s ramp rates', 'https://github.com/example/openpcr-mk3', 'hardware', 'pipette_punk', 214, 4],
  ['Base editor corrects a point mutation in adult mouse liver with no detectable off-targets', 'https://www.biorxiv.org/content/10.1101/2026.02.14.000001v1', 'crispr', 'crispr_kid', 187, 9],
  ['Ask BN: How do you validate a community lab BSL-1 setup without an institution behind you?', null, 'diybio', 'helix_witch', 156, 6],
  ['A cell-free protein synthesis kit you can freeze-dry at home', 'https://www.protocols.io/view/example-cfps-lyophilised', 'synbio', 'open_assay', 143, 12],
  ['The reproducibility crisis is a metadata crisis', 'https://www.nature.com/articles/example-metadata-crisis', 'bioinformatics', 'open_assay', 138, 16],
  ['Show BN: I sequenced my sourdough starter and built a strain tracker for it', 'https://github.com/example/sourdough-atlas', 'diybio', 'garage_genome', 129, 8],
  ['Precision fermentation hits $2/kg for a single-cell protein at pilot scale', 'https://www.example-biomanufacturing.org/reports/scp-cost-curve', 'biomanufacturing', 'ferment_or_die', 118, 14],
  ['Organoid intelligence: what we can and cannot claim right now', 'https://www.cell.com/example-organoid-intelligence-review', 'neuro', 'wetware_ann', 112, 22],
  ['A public benchmark for protein design models that actually gets wet-lab validated', 'https://www.biorxiv.org/content/10.1101/2026.01.30.000002v2', 'bioinformatics', 'crispr_kid', 104, 11],
  ['Ask BN: Best way to get a plasmid across a border legally?', null, 'biosecurity', 'plasmid_mule', 97, 31],
  ['Screening DNA synthesis orders: the new baseline every provider should meet', 'https://www.example-policy.org/dna-synthesis-screening-baseline', 'biosecurity', 'biosafety_bee', 94, 19],
  ['Mycelium composites pass a commercial fire rating for the first time', 'https://www.example-materials.com/mycelium-fire-rating', 'biomanufacturing', 'mycelium_max', 88, 7],
  ['Show BN: Open microfluidics — a chip you can cut on a $300 vinyl cutter', 'https://github.com/example/vinyl-microfluidics', 'hardware', 'pipette_punk', 83, 13],
  ['Senolytics in humans: reading the phase 2 data honestly', 'https://www.example-longevity-journal.org/senolytics-phase2-readout', 'longevity', 'open_assay', 79, 27],
  ['A ten-line protocol that doubled our transformation efficiency', 'https://www.protocols.io/view/example-transformation-tweak', 'synbio', 'helix_witch', 76, 9],
  ['Ask BN: What killed your first startup — the science or the burn rate?', null, 'funding', 'ferment_or_die', 71, 44],
  ['Structural prediction is solved. Function is not.', 'https://www.example-structural-bio.org/function-gap-essay', 'bioinformatics', 'crispr_kid', 68, 18],
  ['Community lab network passes 200 spaces worldwide', 'https://www.example-diybio-atlas.org/2026-census', 'diybio', 'helix_witch', 64, 5],
  ['Cheap continuous culture: a turbidostat from aquarium parts', 'https://github.com/example/aquastat', 'hardware', 'garage_genome', 61, 10],
  ['Show BN: A lab notebook that is just plain text files and a Makefile', 'https://github.com/example/plaintext-lab', 'bioinformatics', 'open_assay', 58, 25],
  ['Gene therapy pricing is a manufacturing problem, not a science problem', 'https://www.example-therapeutics.org/gene-therapy-cogs', 'therapeutics', 'wetware_ann', 54, 21],
  ['The FDA draft guidance on decentralised manufacturing, annotated', 'https://www.example-regulatory.org/decentralised-manufacturing-annotated', 'biosecurity', 'biosafety_bee', 49, 12],
  ['Ask BN: Anyone running a lab entirely on second-hand equipment?', null, 'diybio', 'garage_genome', 46, 33],
  ['Directed evolution in a droplet: 10^7 variants per afternoon', 'https://www.biorxiv.org/content/10.1101/2026.03.02.000003v1', 'synbio', 'plasmid_mule', 44, 8],
  ['A cheap dye-free viability assay that works in undergrad teaching labs', 'https://www.protocols.io/view/example-viability-assay', 'diybio', 'open_assay', 41, 6],
  ['Longevity clinics are selling interventions with no endpoint', 'https://www.example-longevity-journal.org/clinic-critique', 'longevity', 'biosafety_bee', 38, 29],
  ['Show BN: Bioreactor firmware rewritten in Rust, now open source', 'https://github.com/example/ferment-rs', 'hardware', 'ferment_or_die', 35, 9],
  ['Neural organoid recordings released as an open dataset (2.4 TB)', 'https://www.example-datasets.org/organoid-mea-2026', 'neuro', 'wetware_ann', 31, 4],
  ['What a biotech seed round actually looks like in 2026', 'https://www.example-venture.org/seed-terms-2026', 'funding', 'plasmid_mule', 27, 15],
  ['Ask BN: Teaching CRISPR to teenagers — what is actually safe?', null, 'diybio', 'helix_witch', 24, 17],
  ['Cold chain without the cold: trehalose stabilisation for field diagnostics', 'https://www.biorxiv.org/content/10.1101/2026.02.28.000004v1', 'therapeutics', 'crispr_kid', 21, 5],
  ['A benchtop sequencer teardown, with schematics', 'https://www.example-teardown.org/benchtop-sequencer', 'hardware', 'pipette_punk', 18, 11],
];

const LURKER_STEMS = [
  'agar', 'anneal', 'blot', 'buffer', 'clone', 'ferment', 'gel', 'incubate',
  'ligase', 'lysate', 'micron', 'primer', 'sterile', 'vector',
];

const COMMENTS = [
  'The ramp rate claim is doing a lot of work here — is that block temperature or sample temperature? Those diverge badly above 2 °C/s with thin-wall tubes.',
  'Sample temperature, measured with a thermocouple in a dummy tube of mineral oil. Plot is in the repo under docs/thermal.',
  'We ran this protocol in our community lab last month. Two of five transformations failed until we dropped the heat shock to 42 s. Worth adding a note.',
  'Off-target analysis with GUIDE-seq only tells you about the sites you could capture. I would want long-read whole-genome on at least a few animals before "no detectable" goes in a title.',
  'Fair. The preprint does have ONT data in supplementary S4, though the coverage is thin.',
  'This is the third time this month someone has posted a "cheap X" build where the cost excludes the thing that actually costs money. Where is the temperature controller in that BOM?',
  'It is in there — line 14, the $22 board. The expensive part historically was the Peltier driver and that is what got cheap.',
  'Biosafety take: none of this is a problem at BSL-1 with non-pathogenic chassis. The failure mode in community labs is almost never the organism, it is the chemical waste.',
  'Strongly agree. Our incident log is 90% solvent handling and 10% sharps. Zero biological.',
  'Anyone else notice that the reproducibility argument always ends with "we need better metadata" and never with "we need to fund replication"?',
  'Because metadata is cheap to advocate for and replication is not.',
  'The cost curve here is real but the pilot scale is 500 L. Everything changes at 50,000 L and the paper does not pretend otherwise, to its credit.',
  'Having done the 50k L version: foam control alone eats the margin they are projecting.',
  'I would like to see the word "intelligence" retired from this entire subfield until someone proposes a falsifiable behavioural test.',
  'The review actually proposes three. Section 4. They are weak, but they exist.',
  'Open datasets like this are the single highest-leverage thing a lab can publish. Papers age, data compounds.',
  'Counterpoint: undocumented data compounds confusion. The README here is genuinely good, which is why it works.',
  'Started my lab entirely on auction equipment. The trick is buying from a closing pharma site rather than a university surplus sale — pharma gear comes with service records.',
  'This matches my experience. Also: never buy a -80 freezer sight unseen.',
  'The border question has no general answer. It is per-country, per-organism, and sometimes per-customs-officer. Talk to the receiving institution first, always.',
  'Add: get the material transfer agreement signed before shipping, not after. Customs asks for paperwork, not for vibes.',
  'Screening baseline is good but voluntary. Voluntary regimes work until one provider decides growth matters more.',
  'Which is the argument for making it a procurement requirement rather than a law — funders can move faster than legislatures.',
  'Rewriting firmware in Rust is fun but the actual reliability win here was the watchdog, which you could have added in C.',
  'True, and said so in the README. The Rust part was mostly so contributors stop segfaulting the pH loop.',
  'Every time gene therapy pricing comes up someone says "manufacturing" and then nobody funds manufacturing. It is the least glamorous line item in every deck I have seen.',
  'We got a term sheet last year that explicitly cut the CMC budget to make the burn look better. Declined.',
  'This is the most honest write-up of seed terms I have read. The part about pro-rata rights is the part founders always skip.',
  'Teaching teenagers: use non-pathogenic yeast, keep everything on plates, and let them design the experiment. The safety risk is boredom-driven improvisation, not the enzyme.',
  'We run exactly this curriculum. Two years, zero incidents, several very good student questions we could not answer.',
  'Trehalose stabilisation is old but the field-deployment data is what makes this worth reading. 40 °C for six weeks is a real number.',
  'The teardown is beautiful. Note the flow cell is still proprietary, so "open" has a ceiling here.',
];

function seed({ reset = false } = {}) {
  const instance = getDb();

  if (reset) {
    instance.exec('DELETE FROM votes; DELETE FROM flags; DELETE FROM favorites; DELETE FROM sessions; DELETE FROM items; DELETE FROM users;');
    instance.exec("DELETE FROM sqlite_sequence WHERE name = 'items'");
  }

  if (instance.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0 && !reset) {
    console.log('Database already has content — nothing to seed. Use `npm run reset` to start over.');
    return;
  }

  const random = makeRandom(1312);
  const now = nowSeconds();

  for (const [id, about] of USERS) {
    db.createUser({ id, passwordHash: hashPassword(`${id}-demo-pass`) });
    db.updateUser(id, { about });
  }
  // A moderator handle, so admin paths are exercised too.
  db.createUser({ id: 'curator', passwordHash: hashPassword('curator-demo-pass'), isAdmin: true });
  db.updateUser('curator', { about: 'Moderation and cleanup. Flag things; I read the queue.' });

  const storyIds = [];
  STORIES.forEach(([title, url, topic, author, targetPoints, commentCount], index) => {
    // Spread submissions over the last five days, newest first in the list.
    const age = Math.floor((index * 3.4 + random() * 5) * HOUR);
    const id = db.createStory({
      by: author,
      title,
      url,
      text: url ? null : askText(title),
      topic,
      kind: url ? (title.startsWith('Show BN') ? 'show' : 'link') : 'ask',
    });
    getDb().prepare('UPDATE items SET created_at = ? WHERE id = ?').run(now - age, id);
    storyIds.push({ id, author, targetPoints, commentCount, createdAt: now - age });
  });

  // A wider pool of quiet accounts so vote counts can actually differentiate
  // stories — every point on the site is a real row in the votes table.
  const lurkers = LURKER_STEMS.flatMap((stem, i) =>
    [1, 2, 3, 4, 5, 6].map((n) => `${stem}${(i + n * 7) % 97}`),
  ).slice(0, 72);
  // One shared hash for the quiet accounts: scrypt is deliberately slow, and
  // hashing 72 throwaway logins individually makes seeding take seconds.
  const lurkerHash = hashPassword('lurker-demo-pass');
  for (const id of lurkers) db.createUser({ id, passwordHash: lurkerHash });

  const handles = [...USERS.map(([id]) => id), 'curator', ...lurkers];

  // Votes: real rows in the votes table, so unvoting and karma both behave.
  for (const story of storyIds) {
    const voters = pickVoters(handles, story.author, story.targetPoints, random);
    for (const voter of voters) db.vote(voter, story.id);
  }

  // Comments, threaded: some replies attach to earlier comments on the same story.
  let commentCursor = 0;
  for (const story of storyIds) {
    const wanted = Math.min(story.commentCount, 6);
    const posted = [];
    for (let i = 0; i < wanted; i++) {
      const text = COMMENTS[commentCursor++ % COMMENTS.length];
      const author = handles[Math.floor(random() * handles.length)];
      if (author === story.author && i === 0) continue;
      const parent = posted.length && random() < 0.45 ? posted[Math.floor(random() * posted.length)] : story.id;
      const id = db.createComment({ by: author, parentId: parent, text });
      const age = Math.max(60, Math.floor((now - story.createdAt) * (0.15 + random() * 0.7)));
      getDb().prepare('UPDATE items SET created_at = ? WHERE id = ?').run(now - age, id);
      posted.push(id);
      for (const voter of pickVoters(handles, author, Math.floor(random() * 14) + 1, random)) {
        db.vote(voter, id);
      }
    }
    // Keep the story's cached comment count honest after the loop's skips.
    getDb()
      .prepare("UPDATE items SET comment_count = (SELECT COUNT(*) FROM items c WHERE c.story_id = ? AND c.type = 'comment' AND c.deleted = 0) WHERE id = ?")
      .run(story.id, story.id);
  }

  const stats = db.siteStats();
  console.log(`Seeded ${stats.stories} submissions, ${stats.comments} comments, ${stats.votes} votes, ${stats.users} handles.`);
  console.log('Demo logins: any named handle with password "<handle>-demo-pass" (e.g. helix_witch / helix_witch-demo-pass).');
  console.log('The quiet vote-only accounts all share the passphrase "lurker-demo-pass".');
  console.log('All seed content is fictional sample data.');
}

function pickVoters(handles, author, wanted, random) {
  const pool = handles.filter((h) => h !== author);
  const chosen = new Set();
  const count = Math.min(pool.length, Math.max(0, Math.round(wanted / 3)));
  while (chosen.size < count) chosen.add(pool[Math.floor(random() * pool.length)]);
  return [...chosen];
}

function askText(title) {
  return `${title.replace(/^Ask BN:\s*/, '')}\n\nContext, constraints and what I have already tried are below — replies with concrete numbers appreciated over general encouragement.`;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seed({ reset: process.argv.includes('--reset') });
  closeDb();
}

export { seed };
