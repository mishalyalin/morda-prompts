# How to set up Morda for this person

The person sent the setup message from the Morda app. Their phone shows each step as it finishes, so do not ask them anything. Do the steps in order. If a step is blocked, skip it, do the rest, and say why in step 4.

## 1. Fill the list now
Call `get_my_list`, follow the instructions it returns, then call `update_my_list`. Their phone shows the list within seconds.

## 2. Let Morda see the Claude chats on this Mac
Only if you run in Claude Code on the person's Mac and can run shell commands. Anywhere else, skip to step 4.

a) Run this and compare the sum it prints with `{{SHA}}`:
   `mkdir -p ~/.claude/morda && curl -fsS {{BASE}}/v8/mac/morda_mac.py -o ~/.claude/morda/morda_mac.py && shasum -a 256 ~/.claude/morda/morda_mac.py`
   If the sum is different, delete that file and skip steps 2 and 3.
b) Run: `python3 ~/.claude/morda/morda_mac.py install --key {{KEY}} --base {{BASE}}`
   It prints `add_to_settings_json_hooks`. The key is private: never repeat it in your answers.
c) Add those hooks to `~/.claude/settings.json`: under `"hooks"`, append each entry to the list for its event. Keep everything already in the file exactly as it is. If an entry for `morda_mac.py` is already there, keep one.
d) Run `python3 ~/.claude/morda/morda_mac.py check`. `missing` must be empty.

This helper sends Morda only chat names, folder names, and the questions Claude asks the person. Never what the person typed, files or passwords.

## 3. The Morda task, every 15 minutes
Only if step 2 worked. Create a scheduled task where you run:
- Name: `Morda`
- How often: every 15 minutes
- Prompt: `Morda: run python3 ~/.claude/morda/morda_mac.py tick and read the JSON it prints. For each item in replies: use ListAgents to find the open Claude chat whose name is exactly the item's "to", send it the item's "message" word for word with SendMessage, then run python3 ~/.claude/morda/morda_mac.py ack <id> delivered. If no open chat or more than one has that name, or sending fails, run python3 ~/.claude/morda/morda_mac.py ack <id> closed instead. If update_list is true, call get_my_list from the Morda connector, follow its instructions, and call update_my_list. Do nothing else and ask nothing.`

If a scheduled task named Morda already exists, change it to this instead of making a second one.

## 4. Tell the phone
Call `report_setup`:
- `hook`: true if step 2 worked, false if not.
- `task`: true if the Morda task exists, false if not.
- `where`: a few plain words, e.g. "Claude Code on this Mac", or why a step could not be done, e.g. "Not allowed to edit settings.json".

## If something is blocked
If a permission, a policy or a safety check stops a step, do not try to get around it and do not ask the person to change settings. Skip it, do the others, and put the reason in `report_setup`. If `update_my_list` itself is blocked, end with one line: "Morda could not be set up here - paste the setup message into Claude on your Mac instead."

## At the end
Say in one line what you did: how many items you sent, and whether Morda now follows the chats on this Mac. No questions.

The public copy of these steps: https://github.com/mishalyalin/morda-prompts
