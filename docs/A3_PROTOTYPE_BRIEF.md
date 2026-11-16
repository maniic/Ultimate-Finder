# Ultimate Finder: A3 Prototype Brief

Last updated: November 16, 2026. Living copy: https://claude.ai/artifact/3CjDK6Kbi7gQiry86ktFr1

This brief is the shared source of truth for building the Ultimate Finder high-fidelity prototype for CSC318 A3. It is written for Abdullah, Jun and Muhammad, and for any AI assistant they use. Sections 3 to 6 follow the four prototype rubric items, which together are worth 30 of 100 points.

## 1. How to use this brief

- **People:** read sections 2 and 7 first, then the rubric section for the screen you own.
- **AI assistants:** this file lives in the repo at `docs/A3_PROTOTYPE_BRIEF.md` and `CLAUDE.md` loads it at the start of every session, so there is nothing to paste. Assistants that do not read `CLAUDE.md` should be told to read this file first. Section 7 ends with rules that every assistant must follow in the repo.
- **Status of the ideas:** items marked *Proposed* are recommendations and are not yet agreed by the team. Items marked *Verify* are facts that someone must check on site before they go into the app.
- **Keeping it current:** this repo copy is the source of truth. When the team makes a decision, change the line here in a pull request and note it in `AI_HANDOFF.md`.

### Project context

Ultimate Finder is a mobile web app that guides University of Toronto students to an exact room or facility inside St. George campus buildings. Existing tools stop at the building. Our A1 research found that 65% of questionnaire respondents (11 of 17) said directions inside buildings were missing or hard to find, and all nine interviewees described difficulty finding a room.

The design direction chosen in A2 is an interactive floor plan with step-by-step cards that show a photo of what the user should see. Users advance the steps themselves, because the prototype does not assume indoor positioning works.

| Item | Detail |
| --- | --- |
| Course | CSC318, University of Toronto, Fall 2026 |
| Team | Abdullah Chabaytah, Junaid Arshad (Jun), Muhammad Alharbi, Logan Sohne, Aaron Mandel, Ludan Ye |
| Prototype owners | Abdullah and Jun, with Muhammad on floor plans and field data |
| Repo | github.com/maniic/Ultimate-Finder (public) |
| Live site | ultimate-finder.junaidarshad.com, deployed automatically from `main` |
| Prototype finished | Sunday November 22 |
| Usability testing | Monday November 23 and Tuesday November 24, with 8 to 12 participants |
| Studio presentation (S3a) | Friday November 20, 10 AM |
| A3 report and A4 video due | Wednesday December 2, 11 AM Toronto time |

### What A3 asks of the prototype

The assignment says to turn the paper prototype into a functional high-fidelity prototype based on the A2 results. The report must give a link and tested instructions for launching it. Two warnings in the spec shape this whole brief:

- A realistic map image with preprogrammed landmarks is enough. Do not spend hours integrating Google Maps.
- Fewer elements that are fully interactive are better than a larger mix of working and non-working ones, because dead elements make participants doubt the prototype.

| Rubric item | Points | Section |
| --- | --- | --- |
| The prototype is aesthetically pleasing | 8 | 3 |
| Sufficient functionality and realism for usability testing | 8 | 4 |
| Connection to each of the 5 functional requirements from A1 (2 each, at least 3 sentences each in the report) | 10 | 5 |
| The prototype addresses the issues discovered in A2 (at least 3 sentences each in the report) | 4 | 6 |

The rubric also has a 15-point Quality Merit line for work that goes beyond the standard criteria through depth, polish or creative insight. A real hosted app tested inside a real building, with real photos, is the team's best argument for those points.

## 2. Where the repo stands and what is still open

The app shell and six screens already exist, but they run on invented OISE data with one scripted route. The main work left is real building data, real routing, real photos and visual polish.

### What is already built (as of November 16)

- A Node and Express server that serves a static front end with plain HTML, CSS and JavaScript modules. There is no build step.
- Six phone-first screens, one folder each under `public/views/`: `search`, `preview`, `floorplan`, `navigate`, `recover` and `facilities`.
- Screens pass state only through the URL, for example `#/preview?b=OI&r=10-210`.
- Shared design tokens in `public/css/base.css`, with light and dark themes.
- A small SVG floor plan renderer that draws rooms as rectangles on an abstract 100 by 60 grid.
- Mock data in `public/js/data.js` for OISE room 10-210. None of it is verified on site.
- Early versions of several A2 fixes: Previous step, Finish route, a map legend, and search by building name.

### Hosting limits that affect design

- Every merge to `main` goes live within about two minutes.
- The server has a read-only file system and no outbound network access, so there is no database. Anything a user saves must stay in the browser on their own phone.
- Calls made from the browser, such as loading a font or a map tile, do work.

### Decisions the team still has to make

| Decision | Proposed answer | Why |
| --- | --- | --- |
| Which building is done in depth | Bahen (BA), floors 1 to 3 | Every needed floor has a numbered plan, many students have classes there, and testing can happen inside it. *Verify* which floors hold the most classrooms. |
| Second building | Sandford Fleming (SF), floors 1 and 2, only if time allows | Numbered plans and next door to Bahen. Myhal floors 1 and 2 have no room numbers, and floor 3 is missing. |
| Libraries (Robarts, Gerstein) | Skip | No plans in the review packet and no room-number classes. |
| How routes are produced | Real plan image, hand-placed waypoints, shortest-path search | Gives any start, any destination, nearest facility, step-free and rerouting from one piece of code. See section 7. |
| Where testing happens | Inside Bahen, with participants walking | Makes the three required applicability findings credible. |
| Street-level entrance recommendation | A street picker and a static map image, decided Thursday November 19 | The spec warns against integrating live maps, and GPS in a browser is unreliable. Drop it if it is shaky. |

### Floor plan coverage from Muhammad's review

| Building | Plans available | Gap |
| --- | --- | --- |
| Bahen (BA) | Basement, floors 1 to 5, 7 and 8, with room numbers | Floor 6 is only a partial library map. Drawings date from 2004. |
| Myhal (MY) | Floors 1, 2, 4 to 8 | Level 0 and floor 3 missing. Floors 1 and 2 have no room numbers. |
| Sandford Fleming (SF) | Floors 1 to 4, with room numbers | Basement missing. |
| University College (UC) | Basement and floors 1 to 3 | Schematic maps, not measured drawings. |
| Galbraith (GB) | Basement and floors 1 to 4, with room numbers | Old drawings, and basement construction may affect routes. |
| Gage (GA) | Basement and floors 1 to 3, with room numbers | Mainly research use, with fob access after hours. |

None of the plans show washrooms, bottle fillers, microwaves or charging spots, so those must be collected by walking the building.

## 3. Rubric item 1: aesthetically pleasing (8 points)

The app should look like a calm, modern maps app in which the floor plan is the hero and one colour always means "your route". The grader mostly judges this from screenshots in the report, so the figures matter as much as the live site.

### Design principles

1. **The map is the product.** On the floor plan and step screens the plan fills the top of the screen and information sits in a sheet at the bottom, as in familiar maps apps.
2. **One accent has one meaning.** Amber (`--highlight`) is used only for the user's route and destination. Navy (`--accent`) is used for buttons and links. Nothing else is amber.
3. **Room numbers are the headline.** A student glances at the phone while walking, so the room number and the next instruction are the largest text on the screen.
4. **Every screen has one main action.** It is a full-width button within thumb reach at the bottom.
5. **Nothing looks unfinished.** There are no placeholder boxes, no sample text and no disabled features in the version participants use.

### Visual system

- **Colour:** keep the tokens already in `base.css`. Status colours are green for working, red for out of order and grey for not confirmed, always paired with a word or icon so colour is never the only signal.
- **Type:** one typeface. The system font stack already in use is fine and loads instantly inside buildings with weak signal. Use four sizes only: 28 px for room numbers and screen titles, 20 px for the current instruction, 16 px for body text and 14 px for secondary text. Nothing smaller than 14 px.
- **Spacing and shape:** an 8 px spacing grid, 12 px corner radius on cards and sheets, one soft shadow for raised sheets, and touch targets at least 48 px tall.
- **Icons:** one open-source outline icon set with a consistent stroke, copied into the repo as inline SVG. Lucide and Phosphor both work. Do not use emoji as icons.
- **Identity:** a simple wordmark and a small pin-in-a-doorway mark, used as the favicon and home-screen icon. Do not use the U of T crest or logo, because the app is not an official university product.
- **Dark mode:** already supported by the tokens. Check every screen in it, including a dark version of the floor plan.

### Making the floor plans look good

The source plans are 2004 engineering drawings with title blocks, scale bars and dense line work. Shown raw, they will make the app look like a scanned document. Three levels of effort, in order:

| Level | What it involves | When to use it |
| --- | --- | --- |
| A. Clean image | Crop the title block and margins, raise contrast, export one sharp image per floor, and draw overlays on top | Minimum for every floor in the app |
| B. Image plus redrawn rooms | Show the image at low opacity and draw tinted shapes with clear labels for classrooms, corridors, elevators, stairs and washrooms | *Proposed* for every floor used in a study task |
| C. Full retrace | Redraw the whole floor as clean vector shapes | Only if time is left after everything else works |

Other map ideas:

- Draw the route as a thick rounded line with a white outline so it stays readable over the plan, with a start dot, direction arrows at turns and a destination pin.
- Animate the route drawing itself over about 600 ms when a route first appears.
- Show a pulsing "you are here" dot at the current step.
- Fill the destination room in amber and label it in large type.
- Show a floor change as a clear badge on the map, for example "Elevator to floor 2", and switch the plan automatically on the next step.
- Use small round facility pins with the facility icon, coloured by status.
- Support pinch to zoom and drag to pan, and open the plan already centred on the route.

### Screen-by-screen ideas

| Screen | Ideas |
| --- | --- |
| Home and search | One large search field that accepts "BA 2175", "Bahen 2175" or a facility name. Below it, quick tiles for Washroom, Water, Microwave and Charging, then recent destinations. |
| Route preview | A summary card with three large facts: walk time, entrance and floor. A clearly labelled step-free switch. A photo of the recommended entrance. |
| Floor plan | Full-width plan, floor selector as a vertical strip of numbered pills, legend behind a small button, and a bottom sheet that shows the tapped room. |
| Step by step | A real photo with an arrow drawn on it, the instruction in 20 px type, progress dots, a mini map, and Previous and Next buttons. |
| Arrival | A calm confirmation with the door photo, the room plate number and which side of the hall it is on. The main button reads "Finish route". |
| Recovery | Large photo cards of nearby landmarks to choose from, and an "I'm not sure" option that is as prominent as the others. |
| Facilities | A list with icon, floor, walk time and a status chip with "confirmed 2 days ago". Tapping one shows it on the plan with a "Take me there" button. |

### Photos

- Take every step photo in landscape, at eye level, from where the user would be standing, in the same lighting if possible.
- Avoid identifiable faces. Retake or crop if people are recognisable.
- Add the arrow or highlight in an image editor, or draw it as an overlay so it stays sharp.
- Export at about 1200 px wide in WebP or compressed JPEG, under about 150 KB each, so they load on cellular data.

### Motion and feedback

- Slide between steps in 150 to 200 ms, in the direction of travel.
- Give every tap visible feedback through a pressed state.
- Honour the reduced-motion setting by switching animations off.

### Designed empty and error states

- Unknown room: "We could not find BA 9999. Did you mean BA 2175?" with suggestions.
- Floor not covered: "We do not have a plan for this floor yet", with a way back.
- Facility out of order: show the next nearest working one straight away.

### Finishing touches

- Set the page title, favicon, theme colour and a web app manifest so the site looks right in the browser and when added to a home screen.
- Remove default blue underlined links and browser-default form styles.
- Prevent layout jumps by reserving space for photos before they load.
- Add a hidden `#/styleguide` page that shows every colour, text size, button, chip and card. Each teammate's AI assistant can then be told to reuse those components, which keeps six screens built by different people looking like one app.
- For report figures, capture every screen at the same phone size and place the screenshots in a consistent phone frame.

### What to avoid

- Purple gradients, glass effects and heavy shadows, which make an app look generated and generic.
- More than one accent colour.
- Long paragraphs on any screen a user reads while walking.
- Anything labelled "Not available in this prototype". Remove the control.

## 4. Rubric item 2: functionality and realism for usability testing (8 points)

The prototype is functional enough when a participant can complete every study task inside Bahen on their own phone without a team member stepping in. Build the study tasks first and treat everything else as optional.

### The tasks the prototype must support

These are *Proposed* tasks for the study team to confirm. Room numbers are placeholders to *Verify*.

| Task | What the participant does | Requirements it exercises |
| --- | --- | --- |
| 1. Find a room from outside | Starting at a named entrance, reach a classroom on another floor | R1, R2, R4 |
| 2. Find the nearest facility | From that classroom, find the nearest working bottle filler or microwave | R5, R1 |
| 3. Recover from a blocked route | Midway through a route, be told the elevator is out, and get a new route | R3 |
| 4. Choose a step-free route | Plan a route that avoids stairs and say which entrance it uses | R3, R4 |
| 5. Report a problem | Mark a facility as out of order or missing | R5 |

### Core functions

- **Search:** accept a building name or code with a room number, in one field or two. Suggest matches while typing. Cover every room on the supported floors, not only the task rooms, so a participant who explores does not hit a dead end.
- **Start point:** choose an entrance or "I am at room ...". Default to the recommended entrance.
- **Destination:** a room, or the nearest facility of a chosen type.
- **Route:** computed by shortest path over the waypoint graph, drawn on the plan, crossing floors by elevator or stairs.
- **Steps:** one instruction per card, written by hand for key waypoints, each with a real photo. The user taps Next after reaching each checkpoint.
- **Time:** walk time shown before starting and time remaining shown during the route.
- **Step-free:** a switch that removes stair links from the search and may change the entrance.
- **Recovery:** "This isn't what I see" on every step, leading to go back a step, report a blocked elevator or stairs, or pick where you are from landmark photos.
- **Facilities:** filter by exact type, sorted by walking distance from the chosen spot, with status and the date it was last confirmed.
- **Reports:** mark a facility as out of order or missing, or add one. The change is saved on the device and shows immediately.

### Realism

- Use real Bahen entrances, room numbers, elevator and stair positions, and facility locations, collected on a field walk.
- Time real walks with a stopwatch for a few routes and set the walking speed and elevator wait so the estimates match.
- Give every facility a believable status and confirmation date. Include at least one that is out of order so task 2 has something to avoid.
- Write instructions the way a person would say them, using landmarks that are actually visible, for example a named café or a coloured sign.
- Say honestly what is outside coverage. A clear "not covered yet" message is more realistic than a broken screen.

### No dead ends

- Every control on screen works. If a feature is not built, remove its button.
- The browser back button and page refresh keep the user's place, which the URL-based state already supports.
- Every error state offers a next action.

### Working without positioning

The app cannot know where the user is indoors. Be open about it instead of faking it:

- The user advances steps by tapping Next, with a one-line hint that says so.
- Recovery asks where the user is, using photos.
- *Nice to have:* a short code or QR sticker on a landmark that sets the user's position. This is easy to fake convincingly in a study and addresses the A2 finding about lost users.

### Support for the usability study

- **Session tagging:** open the site with `?p=P03` so a session is tied to a participant number and never to a name.
- **Event log:** record in the browser when each route starts and ends, each Next and Previous tap, each use of recovery and each search that fails. This gives completion time and error counts without a stopwatch.
- **Facilitator page:** a hidden `#/debug` page shows the log so the facilitator can screenshot or copy it after each session.
- **Reset:** one button on that page clears saved state before the next participant.
- **Frozen version:** tag the commit used for testing, for example `study-v1`, and merge nothing to `main` on November 23 and 24. The report must state which changes were made after the study, and the tag makes that easy to show.
- **QR code:** a printed QR code that opens the live site with the participant number already filled in.

### Checks before testing starts

- [ ] Works in Safari on an iPhone and Chrome on an Android phone
- [ ] Usable on a small phone, about 375 px wide
- [ ] Loads on cellular data inside Bahen, including the lowest floor used
- [ ] Readable with the phone's large text setting and in dark mode
- [ ] Two teammates have walked every task route following only the app
- [ ] Every photo matches what is there today

### Launch instructions for the report

The report needs a link and tested instructions. *Proposed* wording: open the URL or scan the QR code on a phone, no install or account is needed, and start by searching for the task room. As a fallback for graders, clone the repo and run `npm install` and `npm start`, then open `http://localhost:3000`. Someone outside the prototype pair should follow these instructions once to confirm they work.

## 5. Rubric item 3: the five functional requirements from A1 (10 points)

Each requirement is worth 2 points and needs at least 3 sentences in the report explaining how the prototype meets it, or honestly where it falls short. Each one below lists the exact A1 wording, the features that satisfy it, ideas that would strengthen it, and the evidence the report should show.

### R1. Indoor guidance to a room or facility

> The design must guide a user from a building code and room number, or from the name of a facility, to the exact spot inside the building, including which entrance to use, which floor to go to and which way to turn.

- **Must have:** search by building and room or by facility type, a recommended entrance, the destination floor, and a turn-by-turn route drawn on the plan.
- **Ideas:** accept one-line input such as "BA 2175". Explain floor numbering where it is confusing, for example that the first digit of a Bahen room is the floor. Show which side of the corridor the door is on. Let the user start from a room as well as an entrance.
- **Report evidence:** a figure sequence from search to arrival for one real room, and a second sequence for a facility.

### R2. Confirming the route and destination

> The design must let users check, while they are walking, that they are still going the right way, and recognize their room or facility when they reach it.

- **Must have:** a photo of what the user should see at each step, a mini map with their position on the route, a progress indicator, and an arrival card with the door photo and room plate.
- **Ideas:** an arrow drawn on each photo. A "Does this match?" prompt on harder steps with Yes and No, where No opens recovery. Name landmarks that are permanent, such as signs and stairwells, over things that move.
- **Report evidence:** a step card beside a photo of the same spot, and the arrival screen.

### R3. Recovering when the route fails

> When the planned route doesn't work or the user gets lost, the design must give them a next step from where they are, including a route without stairs when needed.

- **Must have:** "This isn't what I see" on every step, a way to report a blocked elevator or stairs and get a new route that avoids it, a way to say where you are using landmark photos, and a step-free option.
- **Ideas:** an "I'm not sure where I am" path that asks one or two easy questions, such as which floor number is on the nearest sign, then shows matching photos. A fallback that routes from the last confirmed step. A reported blockage that stays active for later routes on that phone.
- **Report evidence:** the reroute before and after on the plan, and the step-free route beside the standard one.

### R4. Knowing the time needed

> Before setting out, the user must be able to see roughly how long it will take to reach a room or facility, so they can plan to arrive on time.

- **Must have:** walk time on the route preview before starting, which changes when step-free is switched on.
- **Ideas:** time remaining during the route. An "arrive by" line such as "Leave by 10:02 for a 10:10 class". A note on what the estimate includes, such as the elevator wait. Times calibrated against stopwatch walks, which is a strong realism point for the report.
- **Report evidence:** the preview card, and a small table comparing estimated and measured times for the test routes.

### R5. Finding the nearest usable facility

> The design must let users find the nearest facility of the type they need, such as water bottle filler, charging spot, microwave or prayer room, and know whether it is usable before they go.

- **Must have:** a choice of exact facility type, results sorted by walking distance from where the user is, a status for each, and a route to the chosen one.
- **Ideas:** a "last confirmed" date on every status. User reports of out-of-order or missing facilities. Automatic skipping of out-of-order ones with a note explaining why. Useful details such as "bottle filler, not a fountain" or "two microwaves, busy at noon".
- **Report evidence:** the facility list with mixed statuses, and the report flow changing a status.

### Coverage check

| Requirement | Screens that carry it | Study task that tests it |
| --- | --- | --- |
| R1 | Search, route preview, floor plan, steps | 1 and 2 |
| R2 | Steps, arrival | 1 |
| R3 | Recovery, route preview (step-free) | 3 and 4 |
| R4 | Route preview, steps | 1 and 4 |
| R5 | Facilities, report flow | 2 and 5 |

## 6. Rubric item 4: addressing the issues found in A2 (4 points)

The A2 think-aloud study (5 students) and heuristic evaluation (4 classmates) raised six issues and confirmed two strengths. The report needs at least 3 sentences per issue, so each fix should be visible on screen and easy to capture in a before-and-after figure against the paper prototype.

| A2 issue | Source and severity | Fix in the prototype | Status in repo |
| --- | --- | --- | --- |
| Recovery assumes users know where they are | Heuristic evaluators HE1 and HE3, severity 3 | Location choices shown as landmark photos with short descriptions, plus an "I'm not sure" path | Stubbed; needs real photos and a real flow |
| Step-free option not understood | Think-aloud P4; HE1 and HE4, severity 2 | Label it "Step-free route (avoids stairs)", show a clear on state, and name the entrance and elevators it uses | Switch exists; wording and feedback to do |
| Accessible entrance information and reliance on visuals | HE1, severity 3 | Mark each entrance as step-free or not with the reason, and offer read-aloud on step cards | To do; read-aloud is optional |
| Going back was hidden, and arrival still said "Next step" | HE1 and HE2, severity 2 | A visible Previous step button, and "Finish route" on the arrival card | Done in starter; confirm people notice |
| Map symbols and when to advance were unexplained | HE3, severity 2 | A short legend on the plan and a one-line hint to tap Next after reaching each checkpoint | Done in starter; check wording |
| The app asked for a building code, but people think in names | Think-aloud P1, P3 and P5 | Search accepts names and codes, with autocomplete and a browsable list | Name search done; needs the real building list |

### Strengths to keep

- Photo and landmark guidance was the most liked part of the paper prototype, mentioned by P1, P3 and P5. Real photos are therefore a priority, not decoration.
- The facilities finder was valued beyond room-finding by P1, P3 and P5. *Proposed:* put facility shortcuts on the home screen.
- Evaluators praised the step counter, the progress bar, the visible destination and the instruction to check the room plate.

### Lower-priority items from A2

- Recent destinations and saved rooms, suggested by HE4.
- Audio guidance, which A2 said should be explored with users who need it. If it is built, ask about it in the study.

### How to write this up

For each issue, the report should state what A2 found and who raised it, what changed in the high-fidelity prototype, and where to see it, with a figure. Keep a running list of these changes while building so the section is quick to write.

## 7. Build plan

The field data and the waypoint placing are likely to take longer than the code, so both start on Tuesday November 17.

### Priorities

**Must do**

- A data model change, made by one person in one pull request, before parallel work starts
- An editor page for placing waypoints on a plan image
- The main path on real Bahen data: search, start, destination, preview, route on the plan, steps across floors, arrival
- One field walk for entrances, elevators, stairs, facilities and step photos
- All six A2 fixes from section 6, visible in the app
- All five A1 requirements from section 5, demonstrable
- A visual polish pass against section 3
- A tagged, frozen study version, tested on an iPhone and an Android phone

**Should do**

- Event log and facilitator page
- Reporting a missing or broken facility, saved on the device
- "Last confirmed" dates on facility status
- Entrance recommendation from a street picker and a static map image
- Facility shortcuts on the home screen

**Nice to have**

- A second building at one or two floors
- Read-aloud for step cards
- Recent and saved rooms
- An "arrive by" time on the preview
- Position codes or QR stickers on landmarks
- A fully retraced vector plan

### Proposed data model

Each building has its own folder so data work never collides with screen work, for example `public/data/BA/`. Plan images go in `public/img/plans/` and step photos in `public/img/photos/`.

- **Building:** code, name, list of floors, entrances.
- **Floor:** floor number, plan image path, image width and height in pixels.
- **Node:** id, floor, x and y in image pixels, kind, and optional label, photo and landmark description. Kinds are `room`, `corridor`, `entrance`, `elevator`, `stairs` and `facility`.
- **Edge:** two node ids, a walking time in seconds, and a `stairs` flag. Elevators and stairs connect the matching nodes on different floors.
- **Room:** room number, type, the node at its door, and which side of the corridor it is on.
- **Facility:** type, node, status, date last confirmed, and a short note.

How the features fall out of this:

| Feature | How it works on the graph |
| --- | --- |
| Route from any start to any room | Shortest path between two nodes |
| Step-free route | The same search with stair edges removed |
| Blocked elevator or stairs | The same search with the reported edge removed |
| Nearest facility | Shortest path to every facility of that type, then the smallest |
| Walk time | Sum of edge times on the path |
| Step cards | One card per node on the path that has a photo or landmark description; plain corridor nodes are skipped |
| Route drawing | A line through the node positions on each floor's image |

The editor page shows a plan image, lets the user tap to add a node, tap two nodes to join them, set the kind and label, and export the result as JSON to paste into the data folder. It is for the team only and is not linked from the app.

### Field walk checklist

For each floor in scope, record on a printed plan and photograph:

- [ ] Every public entrance, its street, and whether it has steps, a ramp or an automatic door
- [ ] Every elevator and staircase, and which floors each one reaches
- [ ] Washrooms, including accessible and all-gender ones
- [ ] Bottle fillers and water fountains, noted separately
- [ ] Microwaves, charging spots and any prayer or quiet room
- [ ] The door and room plate of every task room
- [ ] A landmark photo at every turn on the task routes
- [ ] Stopwatch times for the task routes, including the elevator wait
- [ ] Places where the 2004 plan no longer matches the building

### Repo workflow

- Branch from `main`, one branch per screen or task, named `view/<name>` or `data/<building>`.
- Stay inside your own folder. Shared files are add-only in feature branches.
- Open a pull request. A person merges it, because merging deploys.
- Run the app locally and click through your change before merging.
- Update `AI_HANDOFF.md` at the end of each working session.

*Proposed* ownership:

| Person | Area |
| --- | --- |
| Abdullah | Data model, routing, editor page, floor plan and step screens |
| Jun | Search, route preview, facilities, reporting, study logging, hosting |
| Muhammad | Plan images, field walk, photos, entering the waypoint data |

### Timeline

| Day | Goal |
| --- | --- |
| Mon Nov 16 | Agree building, floors, data model and owners |
| Tue Nov 17 | Data model merged, editor page working, plan images cleaned, field walk done |
| Wed Nov 18 | Route drawn on a real Bahen floor; search with real rooms |
| Thu Nov 19 | Main path works end to end on a phone; decide on entrance recommendation; screenshots for the studio slides |
| Fri Nov 20 | Studio presentation at 10 AM; no new features started after tonight |
| Sat Nov 21 | Recovery, facilities, reporting, step-free, study logging, visual polish |
| Sun Nov 22 | Two teammates walk every task route on two phones; fix; tag `study-v1`; freeze `main` |
| Mon Nov 23 and Tue Nov 24 | Usability testing; critical fixes only, each one written down |
| Wed Nov 25 to Tue Dec 1 | Write the prototype section, make post-study fixes on a branch, polish the demo |
| Wed Dec 2, 11 AM | A3 report and A4 video due |

### Rules for AI assistants working in this repo

1. Read `CLAUDE.md` and `AI_HANDOFF.md` in the repo before changing anything, and update `AI_HANDOFF.md` when you finish.
2. Never commit or push to `main`. Work on a branch and open a pull request. A person merges.
3. Keep the deploy contract: the `Dockerfile` builds with `docker build .`, the server listens on port 3000, and `GET /healthz` returns 200.
4. Do not add a database, a build step, a framework or a server-side call to an outside service without the team agreeing first. Saved state lives in the browser.
5. Do not add live maps or GPS. Use static images and preset data.
6. Do not invent building facts. Room numbers, entrances, facility locations and statuses come only from the data files. If something is missing, ask or mark it *Verify*.
7. Reuse the design tokens and shared components in `base.css` and `ui.js`. Do not introduce new colours, fonts or icon sets.
8. Design for a phone first, at 375 px wide, with touch targets of at least 48 px, in both light and dark themes.
9. Build page elements with the `h()` helper, never by inserting data as raw HTML, and never put user input into a link or image address.
10. Remove any control that does not work. Do not leave placeholders or "coming soon" labels.
11. Never commit secrets or anything that identifies a study participant. The repo is public.
12. Tie each change to a rubric item, an A1 requirement or an A2 issue from this brief, and say which one in the pull request.

### Sources

- A3 and A4 assignment pages and the A3 rubric on Quercus, read November 16, 2026
- The team's A1 report (design requirements) and A2 report (evaluation findings and design changes), in `submitted_docs/` in the repo
- Muhammad's six-building floor plan review, dated November 15, 2026
- The repo's `README.md`, `CLAUDE.md` and `AI_HANDOFF.md` as of November 16, 2026
- The team meeting transcript and group chat from November 15 and 16, 2026
