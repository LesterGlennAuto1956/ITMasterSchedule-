<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Projects · IT Master Tool</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/app.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📌</text></svg>">
</head>
<body data-page="projects">
<div class="wrap">
  <header class="top">
    <div>
      <h1>IT projects</h1>
      <p>What the team is working on, where, and where things stand. <span class="who-am-i" id="whoami"></span></p>
    </div>
    <div class="top-alert-wrap"><button class="btn top-alert" id="topAlert" type="button" hidden><span aria-hidden="true">🔔</span> <span id="topAlertText"></span></button></div>
  </header>

  <nav class="tabs page-tabs" aria-label="Sections">
    <a href="/" id="navSched" class="ptab">Schedule</a>
    <a href="/timeoff/" id="navTimeoff" class="ptab">Time off</a>
    <a href="/projects/" id="navProj" class="ptab" aria-current="page">Projects</a>
    <a href="/inventory/" id="navInv" class="ptab">Inventory</a>
    <a href="/newhires/" id="navHire" class="ptab">New Hires</a>
  </nav>

  <div class="notice" id="notice" hidden></div>

  <section class="panel sl-panel" aria-labelledby="slH">
    <div class="panel-head"><h2 id="slH">Where is Scissor Lift Currently?</h2><span class="emp-role" id="slWhen"></span></div>
    <div class="sl-now">
      <label for="slWhere" class="vh">Where is Scissor Lift Currently?</label>
      <select id="slWhere" class="sl-select"><option value="">Not set</option><option>Lester Glenn Mazda of Toms River</option><option>Lester Glenn Hyundai of Toms River</option><option>Lester Glenn Chevy of Toms River</option><option>Lester Glenn GMC of Toms River</option><option>Lester Glenn Subaru of Toms River</option><option>Lester Glenn Collision of Toms River</option><option>Lester Glenn Chrysler of Toms River</option><option>Lester Glenn Honda of Sea Girt</option><option>Lester Glenn Ford of Ocean</option><option>Lester Glenn Chevy of Freehold</option><option>Lester Glenn Chevy of Old Bridge</option><option>Lester Glenn Corporate of Toms River</option><option>Lester Glenn Warranty of Toms River</option><option>Lester Glenn Service BDC of Toms River</option><option>Lester Glenn Marketing</option><option>Lester Glenn Used Car Dept</option><option>Other location</option></select>
      <span class="sl-tip">Update this whenever the lift is moved, so everyone knows where to find it.</span>
    </div>
  </section>

  <section class="panel" id="projPanel" aria-labelledby="pjH">
    <div class="panel-head">
      <h2 id="pjH">Projects Calendar</h2>
      <div class="cal-nav" style="flex-wrap:wrap">
        <button class="btn ghost" id="pjPrev" type="button" aria-label="Previous month">‹</button>
        <strong id="pjLabel" style="min-width:150px"></strong>
        <button class="btn ghost" id="pjNext" type="button" aria-label="Next month">›</button>
        <button class="btn" id="pjToday" type="button">Today</button>
        <button class="btn" id="pjFull" type="button" aria-pressed="false">⤢ Full screen</button>
        <button class="btn primary" id="pjAdd" type="button">Add project</button>
      </div>
    </div>
    <div class="proj-stats" id="projStats" role="group" aria-label="Filter projects"></div>
      <div class="scroll"><div class="cal proj-cal" id="projCal"></div></div>
    <div class="panel-sub"><h3 id="projListTitle">All projects</h3></div>
    <div class="scroll" id="projList"></div>
    <div class="foot-note">Select an empty spot on a day to add a project starting then, or select a project to open it. Completed projects turn blue. Use the boxes above the calendar to show all, ongoing, or completed projects.</div>
  </section>
</div>

<dialog id="ongoingDlg">
  <form method="dialog" id="ongoingForm">
    <h3 id="ongoingTitle">Ongoing project</h3>
    <p class="emp-role" style="margin:-8px 0 12px">Leave notes so whoever picks this up next knows exactly where things stand.</p>
    <div class="field"><label for="oLeft">Where did you leave off?</label><textarea id="oLeft" rows="3" maxlength="1000" required placeholder="e.g. Ran cable to the first 4 bays and mounted 2 of 3 access points"></textarea></div>
    <div class="field"><label for="oTodo">What still needs to be completed?</label><textarea id="oTodo" rows="3" maxlength="1000" required placeholder="e.g. Mount the last access point, configure the VLAN, test in the waiting area"></textarea></div>
    <div class="err" id="ongoingErr"></div>
    <div class="dlg-actions"><div class="right">
      <button class="btn ghost" value="cancel" formnovalidate>Cancel</button>
      <button class="btn primary" value="save">Save progress notes</button>
    </div></div>
  </form>
</dialog>

<dialog id="projDlg">
  <form method="dialog" id="projForm">
    <h3 id="projTitle">Add project</h3>
    <div class="field"><label for="pName">Project name</label><input id="pName" maxlength="100" autocomplete="off" required placeholder="e.g. Service drive Wi-Fi upgrade"></div>
    <div class="row2">
      <div class="field"><label for="pStart">Start date</label><input id="pStart" type="date" required></div>
      <div class="field"><label for="pEnd">End date</label><input id="pEnd" type="date" required></div>
    </div>
    <div class="row2">
      <div class="field"><label for="pStatus">Status</label><select id="pStatus"><option>Planned</option><option value="In progress">Ongoing</option><option>On hold</option><option value="Done">Completed</option></select></div>
      <div class="field"><label for="pLoc">Location</label><select id="pLoc"><option value="">Not set</option><option>Lester Glenn Mazda of Toms River</option><option>Lester Glenn Hyundai of Toms River</option><option>Lester Glenn Chevy of Toms River</option><option>Lester Glenn GMC of Toms River</option><option>Lester Glenn Subaru of Toms River</option><option>Lester Glenn Collision of Toms River</option><option>Lester Glenn Chrysler of Toms River</option><option>Lester Glenn Honda of Sea Girt</option><option>Lester Glenn Ford of Ocean</option><option>Lester Glenn Chevy of Freehold</option><option>Lester Glenn Chevy of Old Bridge</option><option>Lester Glenn Corporate of Toms River</option><option>Lester Glenn Warranty of Toms River</option><option>Lester Glenn Service BDC of Toms River</option><option>Lester Glenn Marketing</option><option>Lester Glenn Used Car Dept</option><option>Remote</option><option>Other location</option></select></div>
    </div>
    <div class="field"><label for="pDept">Department</label><select id="pDept"><option value="">Not set</option><option>Finance</option><option>Sales</option><option>Sales BDC</option><option>Service</option><option>Service BDC</option><option>Marketing</option><option>IT Dept</option><option>Corporate</option><option>Warranty</option><option>Shop</option><option>Parts</option></select></div>
    <fieldset><legend>Who's working on it</legend><div class="people-pick" id="pPeople"></div></fieldset>
    <fieldset class="projinv"><legend>Inventory Needed</legend>
      <div id="pInvItems"></div>
      <button class="btn small" id="pInvAdd" type="button">+ Add inventory item</button>
      <small class="emp-role" style="display:block;margin-top:6px">Link items from Inventory and how many this project needs. They’re deducted from stock and reserved for this project when you save.</small>
    </fieldset>
    <fieldset class="equipment"><legend>Equipment Needed</legend>
      <div class="people-pick" id="pEquip"><label><input type="checkbox" value="Scissor Lift"><span>Scissor Lift</span></label><label><input type="checkbox" value="Fork Lift"><span>Fork Lift</span></label><label><input type="checkbox" value="Fork Lift Basket"><span>Fork Lift Basket</span></label></div>
      <div class="mail-box" id="slBox" hidden>
        <div class="mail-info"><b>Scissor lift transport</b><div class="emp-role" id="slPreview"></div></div>
        <a class="btn primary" id="slMail" href="#" role="button">✉ Email Scissor Lift Transport</a>
        <div class="sl-current"><label for="slWhere2"><b>Where is Scissor Lift Currently?</b></label>
          <select id="slWhere2" class="sl-select"><option value="">Not set</option><option>Lester Glenn Mazda of Toms River</option><option>Lester Glenn Hyundai of Toms River</option><option>Lester Glenn Chevy of Toms River</option><option>Lester Glenn GMC of Toms River</option><option>Lester Glenn Subaru of Toms River</option><option>Lester Glenn Collision of Toms River</option><option>Lester Glenn Chrysler of Toms River</option><option>Lester Glenn Honda of Sea Girt</option><option>Lester Glenn Ford of Ocean</option><option>Lester Glenn Chevy of Freehold</option><option>Lester Glenn Chevy of Old Bridge</option><option>Lester Glenn Corporate of Toms River</option><option>Lester Glenn Warranty of Toms River</option><option>Lester Glenn Service BDC of Toms River</option><option>Lester Glenn Marketing</option><option>Lester Glenn Used Car Dept</option><option>Other location</option></select><span class="emp-role" id="slWhen2"></span></div>
      </div>
    </fieldset>
    <div class="field"><label for="pNotes">Notes (optional)</label><textarea id="pNotes" rows="3" maxlength="1000" placeholder="Scope, vendor, ticket number…"></textarea></div>
    <div id="projProgress" hidden>
      <div class="proj-actions">
        <button class="btn done-btn" id="projDoneBtn" type="button">✓ Completed project</button>
        <button class="btn ongoing-btn" id="projOngoingBtn" type="button">↻ Ongoing project</button>
      </div>
      <div id="projUpdates"></div>
    </div>
    <div class="err" id="projErr"></div>
    <div class="dlg-actions">
      <button class="btn danger" id="projDel" type="button" hidden>Delete project</button>
      <div class="right">
        <button class="btn ghost" value="cancel" formnovalidate>Cancel</button>
        <button class="btn primary" id="projSave" value="save">Save project</button>
      </div>
    </div>
  </form>
</dialog>

<div class="toast" id="toast" role="status"></div>
<script src="/app.js"></script>
</body>
</html>
