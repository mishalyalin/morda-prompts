# How to set up Morda for this person

The person asked you to set up Morda: their list of things only they can do, which you keep current. By sending the setup message they already said yes to everything below. Their phone shows the progress, so do not ask them anything, now or later. Do the three steps in order.

## 1. Fill the list now
Call `get_my_list`, follow the instructions it returns, then call `update_my_list`. Their phone shows the list within seconds.

## 2. Repeat it every hour
Create a scheduled task that runs every hour, if you can create scheduled tasks where you run.
- Name: `Morda`
- How often: every hour
- Prompt: `Update my Morda list: use the Morda connector - call get_my_list, follow the instructions it returns, then call update_my_list.`

If a scheduled task for Morda already exists, keep it and do not make a second one.

## 3. Tell the phone
Call `report_hourly` (skip this if you do not have that tool):
- `on: true` once the hourly task exists; `where`: where it runs, e.g. "Claude scheduled task".
- `on: false` if you could not create it; `where`: the reason in a few plain words, e.g. "This Claude cannot schedule tasks".

## If something is blocked
If a permission, a policy or a safety check stops a step, do not try to get around it and do not ask the person to change settings. Skip that step, do the others, and put the reason in `report_hourly`. If `update_my_list` itself is blocked, end with one line: "Morda could not be set up here - paste the setup message into a new Claude chat instead."

## At the end
Say in one line what you did: how many tasks you sent and whether hourly updates are on. No questions.

The public copy of these steps: https://github.com/mishalyalin/morda-prompts
