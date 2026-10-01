# What's new

The latest changes to Rhythia Community PP, newest first. Updates are announced in the [Discord](https://discord.gg/YwrN6EmSZj)
too, and the [website](https://coleecvr.github.io/rhythia-pp/) always runs the newest version.

## October 2026

**Easier to read and use.** The website's buttons have stronger contrast, and charts, search boxes and tables are
labelled for screen readers. Player pages no longer show "No country set" to visitors.

**The website tells you when the bot is offline.** The bot runs on one PC, so sometimes it's off. The website
now notices: if it hasn't heard from the bot in a few hours, every page shows a note saying so, and new plays
appear as soon as it's back.

**The website, one tap away.** After a play counts, `/submit` now has buttons to watch your replay and open your
page on the website. `/profile` and `/map` have Website buttons too, every new #1 in #top-plays can be watched with
one tap, and `/help` and #welcome-rules link to the site. `/help` also
lists `/nominate`, for suggesting maps for the ranked pool.

**Clearer when a play doesn't count.** If a play isn't counted, the bot now tells you what to do about it: play it
without pausing, get the current version of the map, use a ranked speed, and so on. If a play is held for a curator
to check, there's nothing you need to do, and the bot now messages you once it's decided. `/submit` explains where
to find replays and maps for both Nightly and Rewrite.

**Safer behind the scenes.** Every day the leaderboard is backed up in full, including every replay, and each backup
is checked. Any re-score can be undone. The bot also has sensible limits on how fast commands can be used, so one
person can't slow it down for everyone.

**PP re-weighed on real plays.** We went through real replays note by note to see where misses actually happen. They
land on the hard parts of a map, mostly in short runs, so a few misses usually mean one tough section rather than a
sloppy play. Misses now cost a little less: on a 1,000-note map an S (98%) keeps about three quarters of a full combo,
an A (95%) about half and a B (90%) about a third. Every miss still costs something, and a full combo is still clearly
worth the most. A 5★ full combo is now worth 120pp (it was 100), so totals are back where they're meant to be. Every
play has been re-scored automatically.

**Misses count properly.** Every miss now costs something on its own, so a long map can't hide them. On a typical
2,000-note map one miss keeps 98% of the play, five keep 92% and twenty keep 77% (before, twenty misses still kept
94%). A full combo is always clearly worth the most, and a one-miss play on a hard map is still a great play. Every
play was re-scored. Hard Rock is now rated at 1.35× the stars.

**Replays show the leaderboard.** While you watch a play, the map's leaderboard sits beside it. The play you're
watching starts from zero and climbs as it goes, passing the scores it beats, while everyone else shows their final
result (press L to hide it). The play's speed and mods sit quietly under the grid.

**For Nightly and Rewrite.** Community Ranked is one ranking shared by both Rhythia clients: Nightly (the final Sound
Space Plus) and Rewrite. Submit a replay from either one (`%APPDATA%\SoundSpacePlus\replays` or
`%APPDATA%\Rhythia\replays`) and it lands on the same leaderboards. Each play is judged by the rules of the game it
was played in.

**Speeds the way your game says them.** Plays now show their speed in each game's own terms: Nightly's `<` button
reads **< 87%** (it really is 1 ÷ 1.15, not 85%), and a Rewrite play at 90% reads **90%**. The numbers behind it were
already right: the replays only line up with their maps at exactly those speeds. Map pages now rate each map at every
speed button in both games.

**Flashlight, Nearsighted and Hard Rock count.** Nightly plays with them now earn PP. Flashlight and Nearsighted add a
bonus. Hard Rock is rated on the map the way it plays: notes spread out, the cursor reaching further and a tighter
hit window, so its stars go up just like a faster speed. The replay viewer draws Hard Rock's bigger grid, and there's a
medal for each one.

**Grades that tell the story.** An SS (always a full combo) now shines with a rainbow rim, and an S just one miss from
it turns silver. Set either with a mod that adds PP in the game it was played in, or faster than 100%, and
it's **charged**: the grade glows on a dark tile with a spark. You'll see them on score cards, in Discord, on the
website and in the replay viewer.

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
