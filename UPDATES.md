# What's new

The latest changes to Rhythia Community PP, newest first. Updates are announced in the [Discord](https://discord.gg/YwrN6EmSZj)
too, and the [website](https://coleecvr.github.io/rhythia-pp/) always runs the newest version.

## October 2026

**Patch 21.** The website is lighter and plainer, and the bot says less and gives away less. Pages load faster: the first
visit now sends about 89 KB of fonts instead of about 430 KB, with the same look. The Maps, Challenge pool, How to submit
and How PP works pages are reworded to say one idea at a time, and the medals' flavour lines are shown as quiet lines
(thirteen of them now say something true about the feat instead of a joke). On a replay page, the numbers on the right of
the grid are no longer cut off on a phone, and Clean view (for screen recording) starts 1.5 seconds before the first
note instead of up to 2.5 seconds of empty grid. A map's page now says "Showing the top 100 of N players" when it lists
only the first 100. The `/pp` calculator gives the PP and the accuracy it really used, and no longer shows how the number is worked out. The bot's cards and
messages are plainer: normal-case labels, one flat colour for the big PP number, a whole-number change in your total, no
exclamation marks and fewer emoji, and the top-plays posts read "New #1" and "New top play". A map you add with
`/nominate` or `/submit` now stays off the public website until a curator ranks it, and you can have up to 5 such maps
waiting at a time (curators have no limit, and a map a curator adds is shown straight away). The bot no longer gives away the name of a player who opted out or was
banned when it refuses a copied replay or a shared PC, and a `/submit` that is held for review or refused is answered
privately in `#bot-commands`. The challenge sheet now understands a map link written as a spreadsheet formula and a map
that is simply called "Song". For curators: map suggestions carry `#<id>`, and a zip made on a Mac no longer adds its
hidden folder as maps. For the owner: the bot keeps the newest ten copies of each kind of safety backup, repairs a
damaged website folder once, warns before the site loses its covers or nears GitHub's size limit, keeps the newest 20
refused replay files per player, tries again when a stopped-update or backup notice did not reach Discord, and a
busy roadmap channel is edited in place instead of getting a second copy of its list. Nothing about PP or ratings
changes.

**Patch 20.** Your total PP is now the plain sum of your best play on every ranked map. Nothing is weighted by rank any
more, so no play counts for less because of the others: a play shows the PP it earned and adds exactly that to your
total, and beating your own score on a map adds the difference. How a single play's PP is worked out has not changed.
Everyone's totals are worked out again the first time the bot starts on this version (it saves a copy of the leaderboard
first), so totals go up, and a few players may reach a milestone role or medal straight away. The "counts N%" note under
each best play is gone, and the accuracy beside your total is now the plain average over all your submitted plays. Also in this
patch: map search now finds titles and artists in any alphabet and with a backslash, titles and bios are never cut in the
middle of an emoji, and replay checking is harder to stall (a replay that lists thousands of modifiers is refused, and
thousands of skips no longer freeze the bot).

**Patch 19.** Small fixes in the Discord bot. If a role update fails, the review buttons and moderator commands now
still finish their job: the log line, the message to the player and the new-#1 post are no longer skipped, and a change
that was made is no longer reported as "something went wrong". A title cut off in the middle of an emoji no longer
leaves half an emoji in a card, "59 minutes ago" no longer rounds up to "60m ago" (or "24h ago"), and a profile that
lost a tiny bit of PP no longer shows "-0pp". On its very first connect to Discord, the bot now waits out a short
network blip instead of stopping. The roadmap channels notice when an item becomes a bug, and the challenge sheet
understands more kinds of Google Sheets links and forgets an old error once it loads again. Nothing about PP or ratings
changes.

**Patch 18.** The bot looks after its data better. Just before each update installs, it now saves a copy of the
leaderboard first and keeps the newest five, a backup that fails is mentioned once instead of every hour, and a
snapshot that fails no longer replaces the good one from earlier in the day. Checking a backup by name now works, the
spreadsheet export keeps odd map names as plain text, and publishing the website refuses to run against a missing or
wrong database instead of replacing the site with an empty one. A first website build that stopped half way no longer
blocks the next one. On a player page, the latest medals now catch the light once, one after another, when the page
opens (not for anyone who asks for less motion). Nothing about PP or ratings changes.

**Patch 17.** The bot is harder to knock over by odd files and text sent from outside. A map file with a huge list of
mappers, an oversized cover, or an odd map name can no longer slow it down, a replay that was waiting for its map is
read again once the map arrives, merging two accounts keeps the bio, country, banner, colour and any ban, a brand-new
player's second /submit no longer fails because the first was refused, and a library file that was busy for a moment is
retried. Map or profile text that looks like a Discord picture address can no longer make the site copy and publish a
picture. Nothing about PP or ratings changes.

**Patch 16.** The website is easier to read and use: the footer text is clearer, links in tables are underlined, buttons
are easier to tap on a phone, and keyboard users can see where they are. Pages now rise in gently when you open them,
buttons give a little when pressed, the big numbers on the home, stats and player pages count up, and map cards ease
closer with a soft light on hover. The replay help text is plainer, and when the bot has been quiet for a while the page
now says when it last checked in and that everything still works. Behind the scenes the bot reconnects on its own after
a connection goes quiet, notices channels made while it was offline, keeps private codes out of its error messages, and
a release note is no longer lost because one side step failed. The website's server also no longer hands out a private
page to other computers. Nothing about PP or ratings changes.

**Patch 15.** Small fixes from a pass over the site on a phone: the search button in the header shows its magnifying
glass again, the rating label on a map's chart no longer sits under the peak, phone charts show fewer time labels, and an
empty map leaderboard now says "Be the first: submit a replay". The How PP works page is five short points instead of one
long paragraph. Behind the scenes, the local web server no longer hands Discord account numbers to other computers. Nothing
about PP or ratings changes.

**Patch 14.** The player page is shorter: long lists of plays show five rows with a "Show all" button, and medals sit
two to a row on phones. The Discord info pages have plain headings. The bot can now post each patch's note into an
optional channel that players switch on with a role, and the project's GitHub feed stays with staff. None of that appears
in the server until its owner turns it on. The roadmap page wording is plainer too. Nothing about PP or ratings changes.

**Patch 13.** The website looks calmer and plainer: flatter cards, simpler headings and a simpler home page, and the
roadmap page now shows what players get, in plain words. The Discord bot draws grades with the same letters as the
replay viewer, and every medal now has a name that says what it asks for, such as "2★ Pass". Nothing about PP or ratings
changes, and nobody gains or loses a medal.

**Patch 12.** The replay viewer's on-screen panels (grade, accuracy, combo, progress and health) now hold still while the
camera follows your cursor, instead of bouncing around. On the website, grade letters are drawn like the replay's: a clean
letter in the game's colours, with the shine kept for SS and the glow for charged plays. Medal pictures now show what each
medal asks for, not just its name. For anyone running their own copy, the backup list shows when each backup was taken,
how many players and plays it holds and which is newest, restoring on a new PC no longer starts an empty leaderboard, and
there is a one-page recovery guide. Nothing about PP or ratings changes.

**Patch 11.** The replay viewer's music now starts in step with the picture. After Play, a pause or a skip, the picture
waits for the song to really start instead of running ahead and catching up, so the music is no longer off for the first
second. The Audio offset slider no longer makes the song jump while you move it; the new setting takes hold a moment after
you stop, and its help now says it needs the song playing. On a phone, a late answer to the first tap no longer stops the
song. Nothing about PP or ratings changes.

**Patch 10.** The website's Rankings page now lists every ranked player, not only the first thousand. The replay viewer's
song panel now says that a curator can share a map's song so it plays for everyone, so you know to ask in the Discord.
Behind the scenes, the bot's own web server is stricter with other computers and websites: they can no longer register
players or send plays through it (Discord's /submit is unchanged). Nothing about PP or ratings changes.

**Patch 9.** The replay viewer has a new setting, Audio offset, under Viewer options. A phone's speaker or Bluetooth earbuds
can play the music a fraction of a second late, and the page cannot see that. Move the slider to the right until the music
matches the notes (to the left if it sounds early); hit sounds move with it, and it is kept in your browser. It starts at 0,
and the right number is different for every phone and pair of earbuds, so you find it by ear.

**Patch 8.** On a phone, a song should now stay in step with the notes after a skip, a pause or a drag of the timeline,
including songs a phone could not seek exactly before (variable-bitrate MP3s). The site also publishes a few plain
numbers about its songs and replays (sizes, lengths, the kind of bitrate; no names or sound) so we can see why a song
sounds off. Curators' help list now includes the commands for sharing a map's song.

**Patch 7.** The website no longer lists players' Discord account numbers: "Log in with Discord" still finds you, and
profile pictures and banners are now kept on the site itself. Curators can now choose to share the song of a map, so the
replay viewer can play it by itself for maps that had no music before (a map only gets a song when a curator says so). On
a phone, a long map title in the replay viewer is cut short instead of running under the exit button, and the bot's
profile text now names both clients, Nightly and Rewrite, like the website.

**Patch 6.** On a phone, the replay viewer's song now loads when you press play. It used to sit on "Loading the song"
with no sound, because a phone's browser only starts a song after a tap. If it is still waiting, the page now says so and
offers a "Load the song" button. Medal texts now say that a medal's stars are the stars of your play, so speed and Hard
Rock count: a 3★ map played faster can earn a 4★ medal, which is how it has always worked.

**Patch 5.** Three phone fixes from a walk through the site: the compare page's shared-maps table now fits the screen
with both players' PP side by side, a map page's two rows of speed buttons stay inside the header and swipe sideways
(Nightly's fastest speeds were off the edge before), and the week labels under the stats page's chart are a readable
size. A link to a map, player or play that has been removed now lands on a page that says so, instead of the home page
with no word.

**Patch 4.** The replay viewer's music now stays in step with the notes after an intro skip, a pause or a drag of the
timeline: some MP3 songs used to land up to half a second off, and now every one lands where it should. On a phone, full
screen now centres the play with the board under it instead of leaving the bottom half empty, and a map whose title is
one very long word no longer stretches the replay page past the edge of the screen. The challenge-sheet page has a
search box and shows 20 maps per tier with "Show more" instead of all 500 at once, and on a phone its maps are rows like
the leaderboards. Behind the scenes, the owner's replay-clock command now also checks a replay's clock against the play
itself.

**Patch 3.** The next look is the site. Everything Patch 2 let you preview with `?look=new` is now simply what everyone
sees: quieter ranks, medals that say what they take, one style across the player, map and ranking pages, and a proper
phone layout. The switch and the "preview" chip are gone. On top of that, the website's ranks and every leaderboard and
play list now follow the replay viewer's board: a plain `#1`, each row its own card, the name with a quieter second line
(accuracy, plays, the map), and the PP on the right.

**Patch 2.** A day of audits turned into fixes across the bot, the website and the replay viewer, and the website's next
look can be previewed. In this patch:

- **A preview of the next look.** Add `?look=new` to any page's address to see the website's next design in your browser
  (it remembers; `?look=classic` turns it back). Ranks are quieter pills, every medal says what it takes and each group
  shows its progress, the player, map and ranking pages share one style, and on a phone the leaderboards read as rows
  instead of a table you scroll sideways. Nothing changes for anyone who doesn't ask for it.
- **The replay viewer on a phone.** The full-screen button works where the browser has no full screen of its own (the
  viewer fills the window itself; Escape or the back button leaves), the side leaderboard becomes a compact board under
  the play, and the header's player search folds behind a magnifier button. On every screen the HUD now follows the play
  gently instead of every cursor move, with a brief stronger reaction to a miss or a new combo level, and a replay you
  leave while its song is still loading stops cleanly.
- **Profiles and rankings.** A play's PP stands on its own and the small line says what it adds to your total; a medal's
  card opens on the first tap on a phone; the Rankings page reaches every player, 100 at a time, and the country filter
  looks at all of them; a page that loads late no longer draws over the page you moved to; a peak rank is never worse
  than the rank now; a public profile says only how many plays are waiting for a curator, not which.
- **Replay checking is stricter and fairer.** Honest mirrored (HFlip or VFlip) plays pass, and a tiny map no longer
  refuses a play over one stray hit: it waits for a curator instead.
- **Submitting.** A refused first `/submit` leaves nothing behind, so there is no empty profile; a legacy replay of
  another version of the map says so; `/submit` adds a map only after the play passes its first checks; a sheet map
  waiting for its check is explained in plain words.
- **Bot and curators.** Curator commands answer at once and act only on one clear map (several matches are listed, and
  nothing changes); the weekly roundup catches up after the PC was off and the map of the week stays put; a damaged map
  or replay file says why; banned or opted-out players get the right answers; a short network blip no longer undoes an
  update, and a replacement that stops at start is undone with the old one carrying on. A zip with the same map in two
  folders adds both, a download that stalls or runs past the size limit is given up and says why, hidden characters
  leave map titles, and a review card left from before a restore says it is out of date instead of acting on another play.
- **Hardening.** The bot handles odd or oversized files and links more safely, its own web server does far less work
  per request, and a change to a play or a player (a ban, an approval, a re-score, a rename) shows on its replay page
  at once.
- **Behind the scenes.** The check that keeps the rating code and its second copy in step now covers many more kinds of
  chart and play, and a new command lets the owner measure how a replay's clock runs, for tracking down a viewer that
  drifts from its music.
- **Small fixes.** The "What counts" help is built from the mod rules so the two can't disagree; a shared Rewrite replay
  carries no in-game name (replay files published before this lose it too); the live PP curve ends at the play's PP;
  maps on an older rating version are re-rated; and a #1 medal moves on to the next player when its holder leaves the
  lists.

**Patch 1.** The first release under the new way of shipping: finished work now gathers up and goes out together, so the
bot restarts once per patch instead of after every change, and a patch is live within about a minute of being released,
with one line in the server's log channel that follows it from "noticed" to "live". In this patch:

- A map uploaded under a challenge-sheet map's ID is ranked only once the bot has checked it against the sheet's own
  file, so nobody can slip a different chart in under a ranked map's name. The bot's replies say what it is waiting for.
- Every play held for review gets a card with the approve and reject buttons, including plays moved to review by a
  rules change, with a catch-up at start and every hour.
- The website: the stats tiles read "1 player" and "1 new player this week" instead of "1 players"; the level on a
  player page has a label and says how far to the next one; no empty space where the rank graph will be until there are
  two days of history; every Top plays row has its watch button on a phone too; the Maps filters, the search and the pool
  filter keep their state while the page refreshes with new data.
- The replay viewer's staff-only controls (the player intro and Clean view) are hidden from everyone else, as intended.
- The bot's status command no longer shows "null" on its updates line right after an update.

**A clearer way in.** The home page now links straight to the submit steps (and so does every empty podium spot), the
Submit page is a proper how-to: which maps count, where to run `/submit`, what to do if the bot doesn't know your map,
and what the bot's reply means. The website's login button is quieter, because signing up is your first `/submit` in
the Discord, not a login here. On a phone the header is two tidy rows instead of three.

**Easier on a phone.** Rows that scroll sideways (the tabs, a player's sections, wide tables) fade where they continue,
and a play's details wrap instead of being cut off. A wrong or old link now says what wasn't found and where to go, a
page that fails to load offers a retry, and screen readers hear the new page's title instead of the whole page.

**In the Discord,** the welcome post and `/help` point to the website's Maps page for the list of ranked maps, and a
play on an unranked map says how to nominate it.

**Small fixes.** Maps show two to a row on a phone with a "Show more" button instead of all 518 at once; the failed-run
card's caption no longer runs into the grade; a profile with no ranked plays yet shows dashes and a hint instead of
zeros; and retrying one map many times is one row in your Recent list, not ten.

## September 2026: launch

**Every attempt counts.** Your play count and most played maps include every run, not just the ones you submitted
(the bot reads them from the game's replays folder), and passing a map after ten attempts at it earns **Never Give Up**.

**A health bar in replays,** under the grid, draining on misses and refilling on hits, just like in the game.

**Log in with Discord on the website.** Your picture and name sit top right, with a bell for your notifications (new
medals, verified plays, new #1s, rank changes), and a popup celebrates every medal you earn.

**Live PP in replays.** The replay viewer counts PP as the play goes: up with every note, down with misses, ending at
what the play was worth.

**New player pages.** A banner (your Discord banner if you have one), your global and country rank with a rank graph,
level, grade counts and a stats panel (play count, total hits, max combo, play time and more), plus your bio, best
plays, #1s, recent plays, medals and history. Write your bio with `/bio`, and set your country with `/country` for
country rankings.

**70 medals with their own art.** Every medal has its own design and a line of flavour text. Hover one to see what it
takes, when you earned it and how rare it is.

**Unranked maps say so.** Wherever a play on an unranked map shows up (score cards, profiles, map pages, replays),
it's marked UNRANKED instead of showing PP as if it counted, with what it would be worth set to the side.

**Medals.** Earn medals like osu!'s for harder passes, full combos, accuracy, playing a lot, big totals, #1s and the
challenge sheet. New ones show up when you submit, and your page on the website shows them all, with how rare each one is.

**Hide the grid in replays.** The replay viewer has a 3×3 grid switch under View.

**Every challenge sheet map is ranked.** All the maps on the community challenge sheet count toward your total, and the
bot fetches any it doesn't have by itself. A play on a sheet map counts the moment you submit it.

**Only your own plays.** Your first replay links your PC to your account, and replays recorded on someone else's PC
are refused. Copies of replays downloaded from the website can't be submitted either.

**Songs in replays, more often.** The replay viewer finds a map's song in your maps folder under any name the map
goes by, and challenge sheet maps can always load their song from the sheet.

**The bot gets back online by itself** after a network drop or when your PC wakes from sleep.

**Full-screen replays at your screen's refresh rate.** Replays draw far less each frame, so full screen keeps up
with fast screens (144 Hz, 240 Hz and up) instead of dropping to 60.

**Top plays.** The rankings page has a new tab with the best plays on ranked maps.

**Grades match the game.** D now means 80% or better, and anything lower is an F, with its own grey badge,
just like in Sound Space Plus.

**A new logo.** A game note with a star in it, for star ratings, on the Discord server, the bot and the website.

**New plays show up within about a minute.** The website follows the Discord bot closely, and pages you have
open refresh themselves when something changes: no reloading.

**Songs in replays, and smoother playback.** Connect your Sound Space Plus maps folder once, and every replay plays
its song from your own copy of the map (your browser remembers the folder). Challenge pool maps load their song by
themselves. The cursor trail is now a smooth streak like the game's, and there's an optional frame-rate counter.

**Your server profile picture.** If you use a different picture in the Discord server, the website shows that one.

**The website goes public.** The leaderboard now has its own address on the web, online all the time:
[https://coleecvr.github.io/rhythia-pp/](https://coleecvr.github.io/rhythia-pp/).

**Share links with preview cards.** Every map, player and play has a **Copy link** button. Paste the link in Discord
and it shows a card with the map, the score or the player's rank.

**Discord profile pictures on the website**, instead of a plain letter. The podium keeps #1 in the middle even while
there are fewer than three players.

**A replay viewer that looks like the game.** Watch any play with the same note colours, 3D view, cursor trail,
combo, grade and hit sounds as Sound Space Plus. Load your copy of the map and the song plays in sync. Misses show
as small, quick marks, so a rough section doesn't cover the screen.

**Every map is here.** Every downloaded map has a star rating, the PP a full combo is worth, and its own page and
leaderboard. Only ranked maps give PP. The **community challenge sheet** is built in: its maps are marked
*Challenge pool* and curators can rank them in one go.

**A new look for the website:** a podium for the top three, the latest plays and newly ranked maps on the home page,
a map grid with covers, and map and player pages with charts.

**Cards in Discord.** The bot now makes an image for everything:
- a score card for every play, with PP, accuracy and grade;
- map cards showing where the notes land and where the map gets hard;
- player cards with rank history and best plays;
- a leaderboard podium, celebrations for new ranks and milestones, and a weekly roundup poster;
- grade emojis (SS, S, A, B, C, D, F).

**The Discord bot.** Submit plays with `/submit`, look anyone up with `/profile`, check a map's leaderboard, and
follow new #1s, top plays and newly ranked maps in their own channels. Roles are given out as you climb, and
curators get tools to nominate, rank and review.

**Fair play.** Every replay is re-checked before it counts: pauses cost a little, settings that make the game easier
don't count, and anything that looks automated waits for a person to check it.

**Star ratings and PP.** The start of it all: a star rating for every map based on how hard the cursor movement is,
PP for every play, and a total that rewards great scores on many maps.
