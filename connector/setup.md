# How to set up Morda for this person

The person asked you to set up Morda: their list of things only they can do, which you keep current. Their phone is showing a waiting screen right now. Do these three steps in order, without asking questions first.

## 1. Fill the list now
Call `get_my_list`, follow the instructions it returns, then call `update_my_list`. Their phone shows the list within seconds.

## 2. Repeat it every hour
Create a scheduled task that runs every hour, if you can create scheduled tasks where you run.
- Name: `Morda`
- How often: every hour
- Prompt: `Update my Morda list: use the Morda connector - call get_my_list, follow the instructions it returns, then call update_my_list.`

If a scheduled task for Morda already exists, keep it and do not make a second one. If you need the person to confirm the schedule, ask in one short line.

## 3. Tell the phone
Call `report_hourly`:
- `on: true` once the hourly task exists; `where`: where it runs, e.g. "Claude scheduled task" or "Claude Code on Mac".
- `on: false` if you cannot create scheduled tasks here; `where`: one short plain reason, e.g. "This Claude cannot schedule tasks".

Then tell the person in one or two lines what you did. If you could not schedule, tell them to paste the same setup message into a Claude that can schedule tasks (the Claude desktop app, or a new chat on a paid plan).

The public copy of these steps: https://github.com/mishalyalin/morda-prompts
